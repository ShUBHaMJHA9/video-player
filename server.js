// server.js
// Simple Express backend that stores video metadata in a JSON file (or in memory)
// POST /api/videos  -> { id }  (send JSON body with { title, servers: [...] })
// GET  /api/videos/:id -> returns stored video object

const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'videos_db.json');

function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {}; // empty db
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static('public')); // optional: serve frontend from /public

// Create/Save video metadata
app.post('/api/videos', (req, res) => {
  const body = req.body || {};
  if (!body.servers || !Array.isArray(body.servers) || body.servers.length === 0) {
    return res.status(400).json({ error: 'servers array required' });
  }
  const id = uuidv4();
  const db = readDB();
  db[id] = {
    id,
    title: body.title || `Video ${id}`,
    servers: body.servers, // expect [{ name, qualities: [{res,url}], subtitles: [{lang,url}] }]
    createdAt: new Date().toISOString()
  };
  writeDB(db);
  res.json({ id });
});

// Get video metadata by id
app.get('/api/videos/:id', (req, res) => {
  const id = req.params.id;
  const db = readDB();
  if (!db[id]) return res.status(404).json({ error: 'not found' });
  res.json(db[id]);
});

// Optionally list all (for dev)
app.get('/api/videos', (req, res) => {
  const db = readDB();
  res.json(Object.values(db));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
