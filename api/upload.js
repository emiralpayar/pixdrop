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
    hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT,
    serviceAccountLength: process.env.GOOGLE_SERVICE_ACCOUNT?.length,
    hasFolderId: !!process.env.DRIVE_FOLDER_ID,
    folderId: process.env.DRIVE_FOLDER_ID,
    hasPublicSetting: !!process.env.DRIVE_PUBLIC,
    publicSetting: process.env.DRIVE_PUBLIC
  });

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT || '';
  if (!raw) {
    console.error('GOOGLE_SERVICE_ACCOUNT environment variable not set');
    return res.status(500).json({ error: 'Google service account not configured' });
  }

  let svc;
  try { 
    svc = JSON.parse(raw); 
    console.log('Service account parsed successfully:', {
      type: svc.type,
      project_id: svc.project_id,
      client_email: svc.client_email,
      hasPrivateKey: !!svc.private_key,
      privateKeyLength: svc.private_key?.length
    });
  } catch (err) { 
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT JSON:', err.message);
    console.error('Raw content length:', raw.length);
    console.error('First 100 chars:', raw.substring(0, 100));
    return res.status(500).json({ error: 'Invalid GOOGLE_SERVICE_ACCOUNT JSON', details: err.message }); 
  }

  // Validate required fields
  if (!svc.client_email || !svc.private_key || !svc.project_id) {
    console.error('Missing required fields in service account:', {
      has_client_email: !!svc.client_email,
      has_private_key: !!svc.private_key,
      has_project_id: !!svc.project_id
    });
    return res.status(500).json({ error: 'Invalid service account format' });
  }

  try {
    // Use dynamic imports for ESM
    const { google } = await import('googleapis');
    const busboy = await import('busboy');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');

    // Create JWT auth with correct scopes
    console.log('Creating Google Auth...');
    const auth = new google.auth.JWT(
      svc.client_email,
      null,
      svc.private_key.replace(/\\n/g, '\n'), // Fix newlines in private key
      ['https://www.googleapis.com/auth/drive.file'] // Correct scope
    );

    // Test authentication
    console.log('Testing Google Auth...');
    await auth.authorize();
    console.log('Google auth successful');

    const drive = google.drive({ version: 'v3', auth });

    // Parse multipart form data
    let tmpFilePath = null;
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

    const folderId = fields.folderId || process.env.DRIVE_FOLDER_ID;
    if (!folderId) {
      try { fs.unlinkSync(tmpFilePath); } catch {}
      return res.status(400).json({ error: 'No folderId provided and DRIVE_FOLDER_ID not set' });
    }

    console.log('Uploading to Google Drive folder:', folderId);

    const prefixParts = [];
    if (fields.weddingCode) prefixParts.push(fields.weddingCode);
    if (fields.uploaderName) prefixParts.push(fields.uploaderName);
    const finalName = (prefixParts.length ? prefixParts.join('_') + '_' : '') + filename;

    console.log('Final filename:', finalName);

    const createRes = await drive.files.create({
      requestBody: { 
        name: finalName, 
        parents: [folderId] 
      },
      media: { 
        mimeType: contentType, 
        body: fs.createReadStream(tmpFilePath) 
      },
      fields: 'id,name,webViewLink,webContentLink'
    });

    console.log('File uploaded successfully:', createRes.data);

    const fileId = createRes.data.id;

    // Make file public if specified
    if ((process.env.DRIVE_PUBLIC || '').toLowerCase() === 'true') {
      try {
        await drive.permissions.create({
          fileId,
          requestBody: { role: 'reader', type: 'anyone' }
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
      try { fs.unlinkSync(tmpFilePath); } catch {}
    }
    return res.status(500).json({ 
      error: 'Drive upload failed', 
      details: String(err?.message || err) 
    });
  }
}
