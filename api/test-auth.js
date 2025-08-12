export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT || '';
    console.log('Testing auth with service account length:', raw.length);
    console.log('First 50 characters:', raw.substring(0, 50));
    console.log('Last 50 characters:', raw.substring(raw.length - 50));
    
    if (!raw) {
      return res.status(500).json({
        success: false,
        error: 'GOOGLE_SERVICE_ACCOUNT environment variable is empty'
      });
    }

    let svc;
    try {
      svc = JSON.parse(raw);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to parse GOOGLE_SERVICE_ACCOUNT JSON',
        details: parseError.message,
        rawLength: raw.length
      });
    }

    console.log('Parsed service account fields:', {
      type: svc.type,
      project_id: svc.project_id,
      client_email: svc.client_email,
      hasPrivateKey: !!svc.private_key,
      privateKeyLength: svc.private_key?.length,
      privateKeyStart: svc.private_key?.substring(0, 30)
    });

    if (!svc.client_email || !svc.private_key) {
      return res.status(500).json({
        success: false,
        error: 'Missing required fields in service account',
        fields: {
          hasClientEmail: !!svc.client_email,
          hasPrivateKey: !!svc.private_key,
          hasProjectId: !!svc.project_id
        }
      });
    }

    const { google } = await import('googleapis');
    
    console.log('Creating JWT with:', {
      email: svc.client_email,
      keyLength: svc.private_key.length
    });

    const auth = new google.auth.JWT(
      svc.client_email,
      null,
      svc.private_key.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive.file']
    );

    console.log('Attempting to authorize...');
    await auth.authorize();
    console.log('Auth successful');

    const drive = google.drive({ version: 'v3', auth });
    
    // Test by listing files in the folder
    const folderId = process.env.DRIVE_FOLDER_ID;
    console.log('Testing folder access for:', folderId);
    
    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      pageSize: 1,
      fields: 'files(id, name)'
    });

    res.json({
      success: true,
      message: 'Authentication successful',
      folderAccess: true,
      filesFound: response.data.files?.length || 0,
      folderId: folderId
    });

  } catch (error) {
    console.error('Auth test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString(),
      stack: error.stack
    });
  }
}