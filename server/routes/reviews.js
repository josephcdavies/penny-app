const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');
const { sendSlackNotification } = require('../slack');
const { recalculateStatus } = require('../utils/status');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const router = express.Router();

// POST /api/reviews
router.post('/', requireAuth, async (req, res) => {
  const { document_id, deadline, smes } = req.body;

  if (!document_id) {
    return res.status(400).json({ error: 'document_id is required' });
  }
  if (!Array.isArray(smes) || smes.length === 0) {
    return res.status(400).json({ error: 'At least one SME is required' });
  }
  for (const sme of smes) {
    if (!sme.name || !sme.name.trim()) {
      return res.status(400).json({ error: 'Each reviewer must have a name' });
    }
    if (!sme.email || !EMAIL_RE.test(sme.email)) {
      return res.status(400).json({ error: `Invalid email address for reviewer "${sme.name}"` });
    }
  }

  const doc = db.prepare(
    'SELECT * FROM documents WHERE id = ? AND uploaded_by = ?'
  ).get(document_id, req.user.id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Update deadline if provided
  if (deadline) {
    db.prepare('UPDATE documents SET deadline = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(deadline, doc.id);
  }

  // Insert new SME assignments (additive — never touch existing ones)
  const insertSme = db.prepare(
    `INSERT INTO sme_assignments (document_id, sme_name, sme_email, token)
     VALUES (?, ?, ?, ?)`
  );

  const newAssignments = [];
  for (const sme of smes) {
    const token = uuidv4();
    const result = insertSme.run(doc.id, sme.name, sme.email, token);
    newAssignments.push({
      id: result.lastInsertRowid,
      sme_name: sme.name,
      sme_email: sme.email,
      token,
    });

    db.prepare(
      `INSERT INTO revision_history (document_id, event_type, description, actor)
       VALUES (?, ?, ?, ?)`
    ).run(doc.id, 'sme_assigned', `${sme.name} (${sme.email}) assigned as reviewer`, req.user.name);
  }

  // Move status to In Review if it was Draft
  const updatedDoc = db.prepare('SELECT * FROM documents WHERE id = ?').get(doc.id);
  if (updatedDoc.status === 'Draft') {
    db.prepare("UPDATE documents SET status = 'In Review', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(doc.id);
  }

  // Send Slack notifications (non-blocking)
  const docForSlack = db.prepare('SELECT * FROM documents WHERE id = ?').get(doc.id);
  for (const assignment of newAssignments) {
    sendSlackNotification(assignment, docForSlack, req.user.name).catch(() => {});
  }

  res.status(201).json({ assignments: newAssignments });
});

module.exports = router;
