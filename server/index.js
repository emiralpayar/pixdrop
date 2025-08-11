import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { google } from 'googleapis';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';



dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENTS_FILE = path.join(__dirname, 'events.json');
let events = [];

async function loadEvents() {
  try {
    const data = await fs.readFile(EVENTS_FILE, 'utf8');
    events = JSON.parse(data);
  } catch {
    events = [];
  }
}
async function saveEvents() {
  await fs.writeFile(EVENTS_FILE, JSON.stringify(events, null, 2));
}
loadEvents();

app.use(cors());
app.use(express.json());

function getDriveClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT)
    : null;
  if (!credentials) return null;
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
  return google.drive({ version: 'v3', auth });
}


function eventForHost(host) {
  if (!host) return null;
  const slug = host.split('.')[0];
  return events.find(e => e.slug === slug);
}

app.get('/events', (req, res) => {
  res.json(events);
});

app.post('/events', async (req, res) => {
  const { name, slug, folderId } = req.body;
  if (!name || !slug || !folderId) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  const event = { id: randomUUID(), name, slug, folderId };
  events.push(event);
  await saveEvents();
  res.json(event);
});

app.put('/events/:id', async (req, res) => {
  const { id } = req.params;
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const { name, slug, folderId } = req.body;
  events[idx] = { ...events[idx], name, slug, folderId };
  await saveEvents();
  res.json(events[idx]);
});

app.delete('/events/:id', async (req, res) => {
  const { id } = req.params;
  const idx = events.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const [removed] = events.splice(idx, 1);
  await saveEvents();
  res.json(removed);
});

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const event = eventForHost(req.headers.host);
    const folderId = event?.folderId || req.body.folderId || process.env.DRIVE_FOLDER_ID;

    if (!req.file) return res.status(400).json({ error: 'No file' });

    const drive = getDriveClient();
    if (drive && folderId) {
      const fileMetadata = { name: req.file.originalname, parents: [folderId] };
      const media = {
        mimeType: req.file.mimetype,
        body: Readable.from(req.file.buffer)
      };
      const response = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id,name,webViewLink,webContentLink'
      });
      return res.json(response.data);
    }

    const dir = process.env.LOCAL_UPLOAD_DIR || 'uploads';
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, req.file.originalname);
    await fs.writeFile(filePath, req.file.buffer);
    return res.json({ localPath: filePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`PixDrop server listening on port ${port}`);
});
