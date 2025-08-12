// ESM – Vercel Node Function
export default async function handler(req, res) {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Debug environment variables
  console.log('Environment debug:', {
    hasClientId: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
    hasFolderId: !!process.env.DRIVE_FOLDER_ID,
    folderId: process.env.DRIVE_FOLDER_ID,
    hasPublicSetting: !!process.env.DRIVE_PUBLIC,
    publicSetting: process.env.DRIVE_PUBLIC
  });

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Google OAuth credentials not configured' });
  }

  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return res.status(500).json({ 
      error: 'Google refresh token not configured',
      instructions: 'Visit /api/oauth/authorize to set up OAuth'
    });
  }

  let tmpFilePath = null;

  try {
    // Use dynamic imports for ESM
    const { google } = await import('googleapis');
    const busboy = await import('busboy');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');

    // Create OAuth2 client
    console.log('Creating Google OAuth2 client...');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.PUBLIC_BASE_URL || 'https://www.pixdrop.cloud'}/api/oauth/callback`
    );

    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    console.log('OAuth2 client configured with refresh token');

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Parse multipart form data
    let filename = 'upload.bin';
    let contentType = 'application/octet-stream';
    const fields = {};

    await new Promise((resolve, reject) => {
      const bb = busboy.default({ headers: req.headers });
      
      bb.on('file', (name, file, info) => {
        filename = info.filename || 'upload.bin';
        contentType = info.mimeType || 'application/octet-stream';
        tmpFilePath = path.join(os.tmpdir(), Date.now() + '-' + filename.replace(/[^a-zA-Z0-9._-]/g, '_'));
        
        console.log('Receiving file:', { filename, contentType, tmpFilePath });
        
        const writeStream = fs.createWriteStream(tmpFilePath);
        file.pipe(writeStream);
        
        file.on('end', () => {
          writeStream.end();
        });
      });

      bb.on('field', (name, val) => {
        fields[name] = val;
      });

      bb.on('finish', resolve);
      bb.on('error', reject);

      req.pipe(bb);
    });

    if (!tmpFilePath || !fs.existsSync(tmpFilePath)) {
      return res.status(400).json({ error: 'No file received' });
    }

    const folderId = fields.folderId || fields.eventFolderId || process.env.DRIVE_FOLDER_ID;
    if (!folderId) {
      try { fs.unlinkSync(tmpFilePath); } catch {}
      return res.status(400).json({ error: 'No folderId provided and DRIVE_FOLDER_ID not set' });
    }

    console.log('Uploading to Google Drive folder:', folderId);

    const prefixParts = [];
    if (fields.weddingCode || fields.eventName) {
      prefixParts.push(fields.weddingCode || fields.eventName);
    }
    if (fields.uploaderName) prefixParts.push(fields.uploaderName);
    const finalName = (prefixParts.length ? prefixParts.join('_') + '_' : '') + filename;

    console.log('Final filename:', finalName);

    // Upload to shared drive
    const createRes = await drive.files.create({
      requestBody: { 
        name: finalName, 
        parents: [folderId] 
      },
      media: { 
        mimeType: contentType, 
        body: fs.createReadStream(tmpFilePath) 
      },
      fields: 'id,name,webViewLink,webContentLink',
      supportsAllDrives: true  // For shared drives
    });

    console.log('File uploaded successfully:', createRes.data);

    const fileId = createRes.data.id;

    // Make file public if specified
    if ((process.env.DRIVE_PUBLIC || '').toLowerCase() === 'true') {
      try {
        await drive.permissions.create({
          fileId,
          requestBody: { role: 'reader', type: 'anyone' },
          supportsAllDrives: true
        });
        console.log('File made public');
      } catch (e) {
        console.warn('Could not set public permission:', e?.message);
      }
    }

    try { fs.unlinkSync(tmpFilePath); } catch {}
    return res.status(200).json(createRes.data);

  } catch (err) {
    console.error('Drive upload error:', err?.message || err);
    console.error('Full error:', err);
    if (tmpFilePath) {
      try { 
        const fs = await import('node:fs');
        fs.unlinkSync(tmpFilePath); 
      } catch {}
    }
    return res.status(500).json({ 
      error: 'Drive upload failed', 
      details: String(err?.message || err) 
    });
  }
}
