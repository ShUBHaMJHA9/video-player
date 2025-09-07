import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const DB_FILE = path.join('/tmp', 'videos_db.json'); // writeable tmp folder

// Initialize DB if not exists
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, '{}', 'utf8');
}

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

export default async function handler(req, res) {
  const db = readDB();

  if (req.method === 'POST') {
    const body = req.body;
    if (!body.servers || !Array.isArray(body.servers) || body.servers.length === 0) {
      return res.status(400).json({ error: 'servers array required' });
    }

    const id = uuidv4();
    db[id] = {
      id,
      title: body.title || `Video ${id}`,
      servers: body.servers,
      createdAt: new Date().toISOString()
    };
    writeDB(db);
    return res.status(200).json({ id, url: `/video?id=${id}` });
  }

  if (req.method === 'GET') {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const video = db[id];
    if (!video) return res.status(404).json({ error: 'Video not found' });
    return res.status(200).json(video);
  }

  res.status(405).json({ error: 'Method not allowed' });
}
