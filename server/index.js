import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { google } from 'googleapis';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });
const app = express();
app.use(cors());

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

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const folderId = req.body.folderId || process.env.DRIVE_FOLDER_ID;
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
