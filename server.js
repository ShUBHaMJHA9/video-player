'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://sh23becse50:Sjha%402005@bot.exfn3.mongodb.net/bot?retryWrites=true&w=majority';
const DB_NAME = process.env.DB_NAME || 'bot';
const COLLECTION = process.env.COLLECTION || 'videos';
const PORT = process.env.PORT || 3000;

let dbClient = null;
let videosCollection = null;

/**
 * Connect to MongoDB and ensure collection exists
 */
async function prepareDatabase() {
  if (!MONGO_URI) throw new Error('MONGO_URI is not set');

  dbClient = await MongoClient.connect(MONGO_URI); // no deprecated options
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
  return videosCollection;
}

/**
 * Start Express server only after DB is ready
 */
async function start() {
  try {
    await prepareDatabase();

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

// ========== ROUTES ==========

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
    return res.status(200).json({ id, url: `/video?id=${id}` });
  } catch (err) {
    console.error('POST /api/videos error:', err);
    return res.status(500).json({ error: 'Failed to save video' });
  }
});

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

app.get('/video', async (req, res) => {
  try {
    if (!videosCollection) return res.status(500).send('Database not ready');

    const id = req.query.id;
    if (!id) return res.status(400).send('Missing video id');

    const video = await videosCollection.findOne({ _id: id });
    if (!video) return res.status(404).send('Video not found');

    if (req.query.json) return res.json(video);

    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (err) {
    console.error('GET /video error:', err);
    return res.status(500).send('Database error');
  }
});

app.get('/health', (req, res) => {
  res.json({ ok: true, db: !!videosCollection });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

process.on('SIGTERM', async () => { if (dbClient) await dbClient.close(); process.exit(0); });
process.on('SIGINT', async () => { if (dbClient) await dbClient.close(); process.exit(0); });
process.on('unhandledRejection', (reason, p) => console.error('Unhandled Rejection at:', p, 'reason:', reason));

start();
