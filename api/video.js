import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).send('Missing video id');

  const dbFile = path.join('/tmp', 'videos_db.json');
  let db = {};
  try {
    db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
  } catch {}

  const video = db[id];
  if (!video) return res.status(404).send('Video not found');

  // Serve your HTML player page
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
}
