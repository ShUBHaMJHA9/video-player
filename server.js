'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'))); // Ensure correct path for static files

// ---------- CONFIG ----------
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'bot';
const COLLECTION = process.env.COLLECTION || 'videos';
const PORT = process.env.PORT || 3000;

let dbClient = null;
let videosCollection = null;
// ----------------------------

async function prepareDatabase() {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI environment variable is not set');
  }

  if (!dbClient) {
    dbClient = await MongoClient.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout for MongoDB connection
    });
    const db = dbClient.db(DB_NAME);

    const collections = await db.listCollections({ name: COLLECTION }).toArray();
    videosCollection =
      collections.length === 0
        ? await db.createCollection(COLLECTION)
        : db.collection(COLLECTION);

    console.log(`✅ Database ready: ${DB_NAME}/${COLLECTION}`);
  }
  return videosCollection;
}

// Handle MongoDB connection errors gracefully
process.on('SIGINT', async () => {
  if (dbClient) {
    await dbClient.close();
    console.log('MongoDB connection closed');
  }
  process.exit(0);
});

// ---------- ROUTES ----------

// Create new video entry
app.post('/api/videos', async (req, res) => {
  try {
    const collection = await prepareDatabase();
    const body = req.body || {};

    if (!body.servers || !Array.isArray(body.servers) || body.servers.length === 0) {
      return res.status(400).json({ error: 'servers array is required and must not be empty' });
    }

    const id = uuidv4();
    const videoDoc = {
      _id: id,
      title: body.title || `Video ${id}`,
      servers: body.servers,
      createdAt: new Date(),
    };

    await collection.insertOne(videoDoc);

    const host = req.headers.origin || `https://${req.headers.host}`;
    return res.status(201).json({
      message: '✅ Video uploaded successfully',
      id,
      url: `${host}/api/videos/${id}`,
    });
  } catch (err) {
    console.error('POST /api/videos error:', err);
    return res.status(500).json({ error: 'Failed to save video' });
  }
});

// Fetch video by ID
app.get('/api/videos/:id', async (req, res) => {
  try {
    const collection = await prepareDatabase();
    const video = await collection.findOne({ _id: req.params.id });

    if (!video) return res.status(404).json({ error: 'Video not found' });

    return res.json(video);
  } catch (err) {
    console.error('GET /api/videos/:id error:', err);
    return res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await prepareDatabase();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// Serve index.html for SPA (if applicable)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
