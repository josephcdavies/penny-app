require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Auto-generate JWT_SECRET if not set
(function ensureJwtSecret() {
  const secretFile = path.join(__dirname, 'db', '.jwt_secret');

  if (!process.env.JWT_SECRET) {
    // Try loading from persisted secret file (e.g. Docker volume)
    if (fs.existsSync(secretFile)) {
      process.env.JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
      return;
    }

    const generated = crypto.randomBytes(32).toString('hex');
    process.env.JWT_SECRET = generated;

    // Try writing back to .env
    const envPath = path.join(__dirname, '..', '.env');
    try {
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const updated = envContent.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${generated}`);
        fs.writeFileSync(envPath, updated);
        console.warn('⚠  JWT_SECRET was not set. A secret has been generated and saved to .env.');
        return;
      }
    } catch (_) {
      // Fall through to secret file
    }

    // Fallback: persist to db directory (survives Docker container restarts via volume)
    try {
      fs.mkdirSync(path.join(__dirname, 'db'), { recursive: true });
      fs.writeFileSync(secretFile, generated);
    } catch (_) {
      // Best effort — secret is still set in memory for this run
    }
    console.warn('⚠  JWT_SECRET was not set. A secret has been generated and saved. Set JWT_SECRET in .env to silence this warning.');
  }
})();

const setupRoutes = require('./routes/setup');
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const reviewRoutes = require('./routes/reviews');
const smeRoutes = require('./routes/sme');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Static file serving for uploaded documents
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve built React client (../client/dist works in both dev and Docker)
app.use(express.static(path.join(__dirname, '../client/dist')));

// API routes — add new routes here, above the SPA catch-all
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/sme', smeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// SPA catch-all — must stay after all API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Catch-all error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
