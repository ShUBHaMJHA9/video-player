// server.js
'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public')); // serve frontend files from /public

// ---------- CONFIG ----------
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sh23becse50:Sjha%402005@bot.exfn3.mongodb.net/bot?retryWrites=true&w=majority&appName=bot';
// Note: if your password contains special characters (like @) it must be URL-encoded, e.g. @ -> %40
const DB_NAME = process.env.DB_NAME || 'bot';
const COLLECTION = process.env.COLLECTION || 'videos';
const PORT = process.env.PORT || 3000;
// ----------------------------

let dbClient = null;
let videosCollection = null;

/**
 * Initialize MongoDB connection and start the Express server.
 * We wait for DB connection before listening so routes can use the DB safely.
 */
async function start() {
  if (!MONGO_URI) {
    console.error('MONGO_URI is not set. Set process.env.MONGO_URI and restart.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    dbClient = await MongoClient.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = dbClient.db(DB_NAME);

    // Check if collection exists, otherwise create it
    const collections = await db.listCollections({ name: COLLECTION }).toArray();
    if (collections.length === 0) {
      console.log(`Collection "${COLLECTION}" does not exist. Creating it...`);
      videosCollection = await db.createCollection(COLLECTION);
      console.log(`✅ Collection "${COLLECTION}" created.`);
    } else {
      videosCollection = db.collection(COLLECTION);
      console.log(`✅ Using existing collection "${COLLECTION}".`);
    }

    // Optional: create unique index on _id
    await videosCollection.createIndex({ _id: 1 }, { unique: true });

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}


// ========== ROUTES ==========

/**
 * POST /api/videos
 * Body must include "servers": an array.
 * On success: returns { id, url }
 * On failure: returns an error JSON
 */
app.post('/api/videos', async (req, res) => {
  try {
    if (!videosCollection) return res.status(500).json({ error: 'Database not ready' });

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

    await videosCollection.insertOne(videoDoc);
    // Return only id & url as requested
    return res.status(200).json({ id, url: `/video?id=${id}` });
  } catch (err) {
    console.error('POST /api/videos error:', err);
    return res.status(500).json({ error: 'Failed to save video' });
  }
});

/**
 * GET /api/videos
 * Returns array of all videos
 */
app.get('/api/videos', async (req, res) => {
  try {
    if (!videosCollection) return res.status(500).json({ error: 'Database not ready' });
    const all = await videosCollection.find({}).toArray();
    return res.status(200).json(all);
  } catch (err) {
    console.error('GET /api/videos error:', err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /api/videos/:id
 * Returns single video document by id
 */
app.get('/api/videos/:id', async (req, res) => {
  try {
    if (!videosCollection) return res.status(500).json({ error: 'Database not ready' });
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const video = await videosCollection.findOne({ _id: id });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    return res.status(200).json(video);
  } catch (err) {
    console.error(`GET /api/videos/${req.params.id} error:`, err);
    return res.status(500).json({ error: 'Database error' });
  }
});

/**
 * GET /video?id=UUID[&json=1]
 * If ?json=1 returns video JSON, otherwise serves public/index.html (player).
 */
app.get('/video', async (req, res) => {
  try {
    if (!videosCollection) return res.status(500).send('Database not ready');

    const id = req.query.id;
    if (!id) return res.status(400).send('Missing video id');

    const video = await videosCollection.findOne({ _id: id });
    if (!video) return res.status(404).send('Video not found');

    if (req.query.json) {
      return res.json(video);
    }

    // Serve HTML player (make sure public/index.html exists)
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (err) {
    console.error('GET /video error:', err);
    return res.status(500).send('Database error');
  }
});

/**
 * Small health endpoint
 */
app.get('/health', (req, res) => {
  res.json({ ok: true, db: !!videosCollection });
});

// Catch-all for unknown API endpoints
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing MongoDB connection...');
  if (dbClient) await dbClient.close();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('SIGINT received, closing MongoDB connection...');
  if (dbClient) await dbClient.close();
  process.exit(0);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

// Start
start();
