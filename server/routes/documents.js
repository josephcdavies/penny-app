const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.md') {
      return cb(new Error('Only .md files are accepted'));
    }
    cb(null, true);
  },
});

// POST /api/documents
router.post('/', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File exceeds 1MB limit' });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'A .md file is required' });
    }

    const { title, description, deadline } = req.body;

    if (!title) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Title is required' });
    }

    try {
      const doc = db.prepare(
        `INSERT INTO documents (title, description, filename, original_name, uploaded_by, deadline)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(title, description || null, req.file.filename, req.file.originalname, req.user.id, deadline || null);

      db.prepare(
        `INSERT INTO revision_history (document_id, event_type, description, actor)
         VALUES (?, ?, ?, ?)`
      ).run(doc.lastInsertRowid, 'created', `Document "${title}" uploaded`, req.user.name);

      const created = db.prepare('SELECT * FROM documents WHERE id = ?').get(doc.lastInsertRowid);
      res.status(201).json(created);
    } catch (err) {
      fs.unlink(req.file.path, () => {});
      res.status(500).json({ error: 'Failed to save document' });
    }
  });
});

// GET /api/documents
router.get('/', requireAuth, (req, res) => {
  const docs = db.prepare(
    `SELECT d.*,
       COUNT(DISTINCT sa.id) AS sme_count,
       COUNT(DISTINCT CASE WHEN sa.status = 'Submitted' THEN sa.id END) AS submitted_count
     FROM documents d
     LEFT JOIN sme_assignments sa ON sa.document_id = d.id
     WHERE d.uploaded_by = ?
     GROUP BY d.id
     ORDER BY d.created_at DESC`
  ).all(req.user.id);

  res.json(docs);
});

// GET /api/documents/:id
router.get('/:id', requireAuth, (req, res) => {
  const doc = db.prepare(
    'SELECT * FROM documents WHERE id = ? AND uploaded_by = ?'
  ).get(req.params.id, req.user.id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const assignments = db.prepare(
    'SELECT * FROM sme_assignments WHERE document_id = ? ORDER BY created_at ASC'
  ).all(doc.id);

  for (const assignment of assignments) {
    assignment.comments = db.prepare(
      'SELECT * FROM inline_comments WHERE assignment_id = ? ORDER BY line_number ASC, created_at ASC'
    ).all(assignment.id);
  }

  const history = db.prepare(
    'SELECT * FROM revision_history WHERE document_id = ? ORDER BY created_at ASC'
  ).all(doc.id);

  res.json({ ...doc, assignments, history });
});

// DELETE /api/documents/:id
router.delete('/:id', requireAuth, (req, res) => {
  const doc = db.prepare(
    'SELECT * FROM documents WHERE id = ? AND uploaded_by = ?'
  ).get(req.params.id, req.user.id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);

  const filePath = path.join(UPLOADS_DIR, doc.filename);
  fs.unlink(filePath, (err) => {
    if (err) console.error(`Failed to delete file ${doc.filename}:`, err.message);
  });

  res.json({ message: 'Document deleted' });
});

// GET /api/documents/:id/download
router.get('/:id/download', requireAuth, (req, res) => {
  const doc = db.prepare(
    'SELECT * FROM documents WHERE id = ? AND uploaded_by = ?'
  ).get(req.params.id, req.user.id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const filePath = path.join(UPLOADS_DIR, doc.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  // Load all submitted inline comments grouped by line number
  const comments = db.prepare(
    `SELECT ic.line_number, ic.comment_text, sa.sme_name
     FROM inline_comments ic
     JOIN sme_assignments sa ON sa.id = ic.assignment_id
     WHERE sa.document_id = ? AND sa.status = 'Submitted'
     ORDER BY ic.line_number ASC, sa.sme_name ASC, ic.created_at ASC`
  ).all(doc.id);

  // Load general notes from submitted assignments
  const generalNotes = db.prepare(
    `SELECT sme_name, general_notes FROM sme_assignments
     WHERE document_id = ? AND status = 'Submitted' AND general_notes IS NOT NULL AND general_notes != ''
     ORDER BY submitted_at ASC`
  ).all(doc.id);

  // Group comments by line number: { lineNumber -> [{sme_name, comment_text}] }
  const commentsByLine = {};
  for (const c of comments) {
    if (!commentsByLine[c.line_number]) commentsByLine[c.line_number] = [];
    commentsByLine[c.line_number].push(c);
  }

  // Inject comments into source markdown
  const source = fs.readFileSync(filePath, 'utf8');
  const lines = source.split('\n');
  const output = [];

  for (let i = 0; i < lines.length; i++) {
    output.push(lines[i]);
    const lineComments = commentsByLine[i + 1]; // line numbers are 1-indexed
    if (lineComments) {
      output.push('');
      for (const c of lineComments) {
        output.push(`> **${c.sme_name}:** ${c.comment_text}`);
      }
      output.push('');
    }
  }

  // Append general notes section
  if (generalNotes.length > 0) {
    output.push('');
    output.push('---');
    output.push('');
    output.push('## SME General Notes');
    output.push('');
    for (const n of generalNotes) {
      output.push(`**${n.sme_name}:** ${n.general_notes}`);
      output.push('');
    }
  }

  const annotated = output.join('\n');
  const downloadName = doc.original_name.replace(/\.md$/i, '-reviewed.md');

  res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.send(annotated);
});

module.exports = router;
