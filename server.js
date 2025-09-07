'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

// ---------- CONFIG ----------
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'bot';
const COLLECTION = process.env.COLLECTION || 'videos';

let dbClient = null;
let videosCollection = null;
// ----------------------------

/**
 * Connect to MongoDB and ensure collection exists
 */
async function prepareDatabase() {
  if (!MONGO_URI) throw new Error('MONGO_URI is not set');

  if (!dbClient) {
    dbClient = await MongoClient.connect(MONGO_URI);
    const db = dbClient.db(DB_NAME);

    // Ensure collection exists
    const collections = await db.listCollections({ name: COLLECTION }).toArray();
    if (collections.length === 0) {
      console.log(`Creating collection "${COLLECTION}"...`);
      videosCollection = await db.createCollection(COLLECTION);
    } else {
      videosCollection = db.collection(COLLECTION);
      console.log(`✅ Using existing collection "${COLLECTION}".`);
    }

    console.log(`✅ Database ready: ${DB_NAME}/${COLLECTION}`);
  }

  return videosCollection;
}

// ========== ROUTES ==========

/**
 * POST /api/videos
 * Creates a video entry and returns an ID + playable URL
 */
app.post('/api/videos', async (req, res) => {
  try {
    const collection = await prepareDatabase();

    const body = req.body || {};
    if (!body.servers || !Array.isArray(body.servers) || body.servers.length === 0) {
      return res.status(400).json({ error: 'servers array required' });
    }

    const id = uuidv4();
    const videoDoc = {
      _id: id,
      title: body.title || `Video ${id}`,
      servers: body.servers,
      createdAt: new Date()
    };

    await collection.insertOne(videoDoc);

    // ✅ Generate absolute URL for Vercel
    const host = req.headers.origin || `https://${req.headers.host}`;
    return res.status(200).json({ id, url: `${host}/video/${id}` });
  } catch (err) {
    console.error('POST /api/videos error:', err);
    return res.status(500).json({ error: 'Failed to save video' });
  }
});

/**
 * GET /api/videos
 * Returns all videos
 */
app.get('/api/videos', async (req, res) => {
  try {
    const collection = await prepareDatabase();
    const all = await collection.find({}).toArray();
    return res.status(200).json(all);
  } catch (err) {
    console.error('GET /api/videos error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /api/videos/:id
 * Returns video metadata by id
 */
app.get('/api/videos/:id', async (req, res) => {
  try {
    const collection = await prepareDatabase();
    const video = await collection.findOne({ _id: req.params.id });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    return res.status(200).json(video);
  } catch (err) {
    console.error(`GET /api/videos/${req.params.id} error:`, err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /video/:id
 * Serves the player page for a video
 */
app.get('/video/:id', async (req, res) => {
  try {
    const collection = await prepareDatabase();
    const video = await collection.findOne({ _id: req.params.id });
    if (!video) return res.status(404).send('Video not found');

    if (req.query.json) return res.json(video);

    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (err) {
    console.error('GET /video/:id error:', err);
    return res.status(500).send('Database error');
  }
});

/**
 * Health check
 */
app.get('/health', async (req, res) => {
  try {
    await prepareDatabase();
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

// Catch-all
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// ========== EXPORT FOR VERCEL ==========
module.exports = app;
