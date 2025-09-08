'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'))); // serve frontend files

// ---------- CONFIG ----------
const DB_URL = process.env.DATABASE_URL;
const PORT = process.env.PORT || 3000;

if (!DB_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false }, // Required for Render Postgres
});

// Initialize table
async function prepareDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS videos (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      servers JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Database ready: videos table created (if not exists)');
}

// ---------- ROUTES ----------

// Create new video entry
app.post('/api/videos', async (req, res) => {
  try {
    await prepareDatabase();
    const body = req.body || {};

    if (!body.servers || !Array.isArray(body.servers) || body.servers.length === 0) {
      return res.status(400).json({ error: 'servers array is required and must not be empty' });
    }

    const id = uuidv4();
    const title = body.title || `Video ${id}`;
    const servers = JSON.stringify(body.servers);

    await pool.query(
      'INSERT INTO videos (id, title, servers) VALUES ($1, $2, $3)',
      [id, title, servers]
    );

    const host = req.headers.origin || `https://${req.headers.host}`;
    res.status(201).json({
      message: '✅ Video uploaded successfully',
      id,
      url: `${host}/api/videos/${id}`,
    });
  } catch (err) {
    console.error('POST /api/videos error:', err);
    res.status(500).json({ error: 'Failed to save video' });
  }
});

// Fetch video by ID
app.get('/api/videos/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM videos WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/videos/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});
// Minimal embed route (just the video player)
app.get('/embed/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM videos WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).send('<h2 style="color:white;background:black">Video not found</h2>');
    }

    const video = result.rows[0];
    const servers = video.servers || [];
    const firstServer = servers[0] || {};
    const qualities = firstServer.qualities || [];
    const firstQuality = qualities[0] || {};
    const videoUrl = firstQuality.url;

    res.send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <style>
            body { margin:0; background:#000; display:flex; align-items:center; justify-content:center; height:100vh; }
            video { width:100%; height:100%; }
          </style>
        </head>
        <body>
          <video src="${videoUrl}" controls autoplay></video>
        </body>
      </html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('<h2 style="color:white;background:black">Server error</h2>');
  }
});

// Serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
