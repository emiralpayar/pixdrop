export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT || '';
    console.log('Testing auth with service account length:', raw.length);
    
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

    // Debug the private key format
    console.log('Private key analysis:', {
      hasPrivateKey: !!svc.private_key,
      privateKeyLength: svc.private_key?.length,
      privateKeyStart: svc.private_key?.substring(0, 50),
      privateKeyEnd: svc.private_key?.substring(svc.private_key?.length - 50),
      containsBeginMarker: svc.private_key?.includes('-----BEGIN PRIVATE KEY-----'),
      containsEndMarker: svc.private_key?.includes('-----END PRIVATE KEY-----'),
      hasEscapedNewlines: svc.private_key?.includes('\\n'),
      hasActualNewlines: svc.private_key?.includes('\n')
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
    
    // Try different ways to format the private key
    let privateKey = svc.private_key;
    
    // If it has escaped newlines, convert them
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      console.log('Converted escaped newlines to actual newlines');
    }
    
    console.log('Final private key format:', {
      length: privateKey.length,
      startsWithBegin: privateKey.startsWith('-----BEGIN PRIVATE KEY-----'),
      endsWithEnd: privateKey.endsWith('-----END PRIVATE KEY-----\n') || privateKey.endsWith('-----END PRIVATE KEY-----'),
      hasNewlines: privateKey.includes('\n')
    });

    // Try creating the JWT auth
    try {
      console.log('Creating JWT with client_email:', svc.client_email);
      
      const auth = new google.auth.JWT(
        svc.client_email,
        null,
        privateKey,
        ['https://www.googleapis.com/auth/drive.file']
      );

      console.log('JWT created, attempting to authorize...');
      await auth.authorize();
      console.log('Auth successful!');

      const drive = google.drive({ version: 'v3', auth });
      
      // Test folder access
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

    } catch (authError) {
      console.error('JWT Auth error:', authError);
      
      // Try alternative method using fromJSON
      try {
        console.log('Trying alternative auth method with fromJSON...');
        const auth = google.auth.fromJSON(svc);
        auth.scopes = ['https://www.googleapis.com/auth/drive.file'];
        
        await auth.authorize();
        console.log('Alternative auth successful!');
        
        res.json({
          success: true,
          message: 'Authentication successful (alternative method)',
          method: 'fromJSON'
        });
        
      } catch (altError) {
        console.error('Alternative auth also failed:', altError);
        throw authError; // Throw the original error
      }
    }

  } catch (error) {
    console.error('Auth test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString(),
      stack: error.stack?.split('\n').slice(0, 5).join('\n') // Limit stack trace
    });
  }
}