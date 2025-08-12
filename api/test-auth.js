export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT || '';
    console.log('Testing auth with service account length:', raw.length);
    
    const svc = JSON.parse(raw);
    console.log('Parsed service account for:', svc.client_email);

    const { google } = await import('googleapis');
    
    const auth = new google.auth.JWT(
      svc.client_email,
      null,
      svc.private_key.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive.file']
    );

    await auth.authorize();
    console.log('Auth successful');

    const drive = google.drive({ version: 'v3', auth });
    
    // Test by listing files in the folder
    const folderId = process.env.DRIVE_FOLDER_ID;
    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      pageSize: 1,
      fields: 'files(id, name)'
    });

    res.json({
      success: true,
      message: 'Authentication successful',
      folderAccess: true,
      filesFound: response.data.files?.length || 0
    });

  } catch (error) {
    console.error('Auth test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString()
    });
  }
}