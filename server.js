// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const { MongoClient } = require('mongodb');
const path = require('path');

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static('public')); // serve frontend files

// MongoDB connection (URL-encode password if it contains special chars like @)
const MONGO_URI =
  process.env.MONGO_URI ||
  'mongodb+srv://sh23becse50:Sjha%402005@bot.exfn3.mongodb.net/bot?retryWrites=true&w=majority&appName=bot';
const DB_NAME = process.env.DB_NAME || 'bot';
const COLLECTION = 'videos';

let videosCollection;

// Connect to MongoDB
MongoClient.connect(MONGO_URI)
  .then(client => {
    const db = client.db(DB_NAME);
    videosCollection = db.collection(COLLECTION);
    console.log('✅ Connected to MongoDB');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// POST /api/videos → store video and return only id & url or error
app.post('/api/videos', async (req, res) => {
  const body = req.body || {};
  if (!body.servers || !Array.isArray(body.servers) || body.servers.length === 0) {
    return res.status(400).json({ error: 'servers array required' });
  }

  const id = uuidv4();
  const videoData = {
    _id: id,
    title: body.title || `Video ${id}`,
    servers: body.servers,
    createdAt: new Date()
  };

  try {
    await videosCollection.insertOne(videoData);
    // ✅ Return only id & url
    return res.json({ id, url: `/video?id=${id}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to save video' });
  }
});

// GET single video metadata by id
app.get('/api/videos/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const video = await videosCollection.findOne({ _id: id });
    if (!video) return res.status(404).json({ error: 'Video not found' });
    res.json(video);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Video player endpoint
app.get('/video', async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).send('Missing video id');

  try {
    const video = await videosCollection.findOne({ _id: id });
    if (!video) return res.status(404).send('Video not found');

    if (req.query.json) return res.json(video);
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } catch (err) {
    res.status(500).send('Database error');
  }
});

// List all videos
app.get('/api/videos', async (req, res) => {
  try {
    const allVideos = await videosCollection.find({}).toArray();
    res.json(allVideos);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
