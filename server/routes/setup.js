const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/setup/status — check whether first-run setup is needed
router.get('/status', (req, res) => {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
  res.json({ setupRequired: count === 0 });
});

// POST /api/setup — create the first admin user (only works when no users exist)
router.post('/', (req, res) => {
  const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (count > 0) {
    return res.status(403).json({ error: 'Setup has already been completed' });
  }

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  if (!name.trim()) {
    return res.status(400).json({ error: 'Name cannot be blank' });
  }

  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const password_hash = bcrypt.hashSync(password, 12);

  try {
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
    ).run(name.trim(), email, password_hash);

    const token = jwt.sign(
      { id: result.lastInsertRowid, email, name: name.trim() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({ token, user: { id: result.lastInsertRowid, name: name.trim(), email } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create account' });
  }
});

module.exports = router;
