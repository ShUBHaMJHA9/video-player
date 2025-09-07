
// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_FILE = path.join(__dirname, 'videos_db.json');

// Helpers for DB
function readDB() {
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}
function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static('public')); // serve frontend files from /public

// Save video metadata
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
    servers: body.servers,
    createdAt: new Date().toISOString()
  };
  writeDB(db);
  res.json({ id, url: `/video?id=${id}` }); // return endpoint url too
});

// Get video metadata (internal API)
app.get('/api/videos/:id', (req, res) => {
  const id = req.params.id;
  const db = readDB();
  if (!db[id]) return res.status(404).json({ error: 'not found' });
  res.json(db[id]);
});

// 🎬 Video player endpoint
app.get('/video', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send('Missing video id');

  const db = readDB();
  if (!db[id]) return res.status(404).send('Video not found');

  // Serve the HTML player page (public/player.html)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// List all videos (dev)
app.get('/api/videos', (req, res) => {
  const db = readDB();
  res.json(Object.values(db));
});

// Add this new endpoint
app.get('/video', (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send('Missing id');

  const db = readDB();
  const video = db[id];
  if (!video) return res.status(404).send('Video not found');

  // Send JSON (or you can render HTML here)
  res.json(video);
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
