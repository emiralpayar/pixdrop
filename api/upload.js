// ESM – Vercel Node Function
export default async function handler(req, res) {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT || '';
  let svc;
  try { svc = JSON.parse(raw); }
  catch { return res.status(500).json({ error: 'Invalid GOOGLE_SERVICE_ACCOUNT JSON' }); }

  // ESM'de dynamic import
  const { default: Busboy } = await import('busboy');
  const { google } = await import('googleapis');
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { default: mime } = await import('mime-types');

  const auth = new google.auth.JWT(
    svc.client_email,
    null,
    svc.private_key,
    ['https://www.googleapis.com/auth/drive']
  );
  const drive = google.drive({ version: 'v3', auth });

  let tmpFilePath = null;
  let filename = null;
  let contentType = null;
  const fields = { folderId: process.env.DRIVE_FOLDER_ID || '' };

  try {
    await new Promise((resolve, reject) => {
      const bb = Busboy({ headers: req.headers });
      bb.on('file', (name, file, info) => {
        const safeName = info.filename || 'upload.bin';
        filename = safeName;
        contentType = info.mimeType || mime.lookup(safeName) || 'application/octet-stream';
        tmpFilePath = path.join(os.tmpdir(), Date.now() + '-' + safeName.replace(/[^a-zA-Z0-9._-]/g, '_'));
        const writeStream = fs.createWriteStream(tmpFilePath);
        file.pipe(writeStream);
        writeStream.on('close', () => {});
      });
      bb.on('field', (name, val) => { fields[name] = val; });
      bb.on('error', reject);
      bb.on('finish', resolve);
      req.pipe(bb);
    });
  } catch (err) {
    console.error('Busboy error:', err);
    return res.status(400).json({ error: 'Invalid multipart form data' });
  }

  if (!tmpFilePath || !fs.existsSync(tmpFilePath)) {
    return res.status(400).json({ error: 'No file received' });
  }

  const folderId = fields.folderId || process.env.DRIVE_FOLDER_ID;
  if (!folderId) return res.status(400).json({ error: 'No folderId provided and DRIVE_FOLDER_ID not set' });

  const prefixParts = [];
  if (fields.weddingCode) prefixParts.push(fields.weddingCode);
  if (fields.uploaderName) prefixParts.push(fields.uploaderName);
  const finalName = (prefixParts.length ? prefixParts.join('_') + '_' : '') + (filename || 'upload');

  try {
    const createRes = await drive.files.create({
      requestBody: { name: finalName, parents: [folderId] },
      media: { mimeType: contentType, body: fs.createReadStream(tmpFilePath) },
      fields: 'id,name,webViewLink,webContentLink'
    });

    const fileId = createRes.data.id;

    if ((process.env.DRIVE_PUBLIC || '').toLowerCase() === 'true') {
      try {
        await drive.permissions.create({
          fileId,
          requestBody: { role: 'reader', type: 'anyone' }
        });
      } catch (e) {
        console.warn('Could not set public permission:', e?.message);
      }
    }

    try { fs.unlinkSync(tmpFilePath); } catch {}
    return res.status(200).json(createRes.data);
  } catch (err) {
    console.error('Drive upload error:', err?.message || err);
    return res.status(500).json({ error: 'Drive upload failed', details: String(err?.message || err) });
  }
}
