const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { recalculateStatus } = require('../utils/status');
const { sendWrongPersonNotification } = require('../slack');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// GET /api/sme/:token
router.get('/:token', (req, res) => {
  const assignment = db.prepare(
    'SELECT * FROM sme_assignments WHERE token = ?'
  ).get(req.params.token);

  if (!assignment) {
    return res.status(404).json({ error: 'Invalid or expired review link' });
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(assignment.document_id);

  const filePath = path.join(UPLOADS_DIR, doc.filename);
  let fileContent = null;
  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return res.status(500).json({ error: 'Document file could not be read' });
  }

  const comments = db.prepare(
    'SELECT * FROM inline_comments WHERE assignment_id = ? ORDER BY line_number ASC, created_at ASC'
  ).all(assignment.id);

  res.json({
    assignment: {
      id: assignment.id,
      sme_name: assignment.sme_name,
      status: assignment.status,
      decision: assignment.decision,
      general_notes: assignment.general_notes,
    },
    document: {
      id: doc.id,
      title: doc.title,
      description: doc.description,
      deadline: doc.deadline,
    },
    fileContent,
    comments,
  });
});

// POST /api/sme/:token/comment
router.post('/:token/comment', (req, res) => {
  const assignment = db.prepare(
    'SELECT * FROM sme_assignments WHERE token = ?'
  ).get(req.params.token);

  if (!assignment) {
    return res.status(404).json({ error: 'Invalid or expired review link' });
  }
  if (assignment.status === 'Submitted') {
    return res.status(403).json({ error: 'Review already submitted' });
  }

  const { line_number, comment_text } = req.body;

  if (!line_number || !comment_text) {
    return res.status(400).json({ error: 'line_number and comment_text are required' });
  }
  if (!Number.isInteger(Number(line_number)) || Number(line_number) < 1) {
    return res.status(400).json({ error: 'line_number must be a positive integer' });
  }
  if (comment_text.trim().length === 0) {
    return res.status(400).json({ error: 'comment_text cannot be empty' });
  }

  const result = db.prepare(
    'INSERT INTO inline_comments (assignment_id, line_number, comment_text) VALUES (?, ?, ?)'
  ).run(assignment.id, Number(line_number), comment_text.trim());

  const comment = db.prepare('SELECT * FROM inline_comments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(comment);
});

// DELETE /api/sme/:token/comment/:id
router.delete('/:token/comment/:id', (req, res) => {
  const assignment = db.prepare(
    'SELECT * FROM sme_assignments WHERE token = ?'
  ).get(req.params.token);

  if (!assignment) {
    return res.status(404).json({ error: 'Invalid or expired review link' });
  }
  if (assignment.status === 'Submitted') {
    return res.status(403).json({ error: 'Review already submitted' });
  }

  const comment = db.prepare(
    'SELECT * FROM inline_comments WHERE id = ? AND assignment_id = ?'
  ).get(req.params.id, assignment.id);

  if (!comment) {
    return res.status(404).json({ error: 'Comment not found' });
  }

  db.prepare('DELETE FROM inline_comments WHERE id = ?').run(comment.id);
  res.json({ message: 'Comment deleted' });
});

// POST /api/sme/:token/submit
router.post('/:token/submit', (req, res) => {
  const assignment = db.prepare(
    'SELECT * FROM sme_assignments WHERE token = ?'
  ).get(req.params.token);

  if (!assignment) {
    return res.status(404).json({ error: 'Invalid or expired review link' });
  }
  if (assignment.status === 'Submitted') {
    return res.status(403).json({ error: 'Review already submitted' });
  }

  const { decision, general_notes } = req.body;
  const validDecisions = ['Approve', 'Reject', 'Needs Changes'];

  if (!decision || !validDecisions.includes(decision)) {
    return res.status(400).json({ error: `decision must be one of: ${validDecisions.join(', ')}` });
  }

  db.prepare(
    `UPDATE sme_assignments
     SET status = 'Submitted', decision = ?, general_notes = ?, submitted_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  ).run(decision, general_notes || null, assignment.id);

  const newStatus = recalculateStatus(assignment.document_id);

  db.prepare(
    `INSERT INTO revision_history (document_id, event_type, description, actor)
     VALUES (?, ?, ?, ?)`
  ).run(
    assignment.document_id,
    'sme_submitted',
    `${assignment.sme_name} submitted review: ${decision}`,
    assignment.sme_name
  );

  res.json({ message: 'Review submitted', documentStatus: newStatus });
});

// POST /api/sme/:token/wrong-person
router.post('/:token/wrong-person', async (req, res) => {
  try {
    const assignment = db.prepare(
      'SELECT * FROM sme_assignments WHERE token = ?'
    ).get(req.params.token);

    if (!assignment) {
      return res.status(404).json({ error: 'Invalid or expired review link' });
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(assignment.document_id);
    const tw = db.prepare('SELECT name FROM users WHERE id = ?').get(doc.uploaded_by);

    await sendWrongPersonNotification(assignment.sme_name, doc, tw.name);

    res.json({ twName: tw.name });
  } catch (err) {
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
