export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error, state } = req.query;

  // Debug environment variables
  console.log('OAuth callback debug:', {
    hasClientId: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    clientIdLength: process.env.GOOGLE_OAUTH_CLIENT_ID?.length,
    clientSecretLength: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.length,
    redirectUri: `${process.env.PUBLIC_BASE_URL || 'https://www.pixdrop.cloud'}/api/oauth/callback`,
    hasCode: !!code,
    codeLength: code?.length,
    error: error,
    state: state
  });

  if (error) {
    return res.status(400).json({ 
      error: `OAuth error: ${error}`,
      description: 'User denied access or there was an OAuth error'
    });
  }

  if (!code) {
    return res.status(400).json({ 
      error: 'No authorization code provided',
      description: 'The OAuth flow did not complete properly'
    });
  }

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return res.status(500).json({ 
      error: 'OAuth credentials not configured',
      debug: {
        hasClientId: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET
      }
    });
  }

  try {
    const { google } = await import('googleapis');

    const redirectUri = `${process.env.PUBLIC_BASE_URL || 'https://www.pixdrop.cloud'}/api/oauth/callback`;
    
    console.log('Creating OAuth2Client with:', {
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID?.substring(0, 20) + '...',
      clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.substring(0, 10) + '...',
      redirectUri
    });

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirectUri
    );

    // Exchange code for tokens
    console.log('Exchanging code for tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('OAuth tokens received:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiryDate: tokens.expiry_date
    });

    if (!tokens.refresh_token) {
      return res.status(400).json({
        error: 'No refresh token received',
        message: 'This usually means you need to revoke access and try again',
        instructions: [
          '1. Go to https://myaccount.google.com/permissions',
          '2. Find your PixDrop app and remove access',
          '3. Try the OAuth flow again'
        ]
      });
    }

    // Return success page with instructions
    return res.status(200).send(`
      <html>
        <head>
          <title>OAuth Success - PixDrop</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; }
            .token { background: #f8f9fa; border: 1px solid #dee2e6; padding: 10px; border-radius: 3px; font-family: monospace; word-break: break-all; }
            .instructions { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="success">
            <h2>✅ OAuth Authorization Successful!</h2>
            <p>Your Google Drive integration is now configured.</p>
          </div>
          
          <div class="instructions">
            <h3>Next Steps:</h3>
            <ol>
              <li>Copy the refresh token below</li>
              <li>Go to your Vercel Dashboard → Settings → Environment Variables</li>
              <li>Add a new variable: <strong>GOOGLE_REFRESH_TOKEN</strong></li>
              <li>Paste the refresh token as the value</li>
              <li>Redeploy your app</li>
            </ol>
          </div>
          
          <h3>Refresh Token:</h3>
          <div class="token">${tokens.refresh_token}</div>
          
          <p><a href="/admin">← Back to Admin Panel</a></p>
        </body>
      </html>
    `);

  } catch (error) {
    console.error('OAuth callback error:', error);
    
    let errorMessage = 'Failed to exchange authorization code';
    let suggestions = [];
    
    if (error.message.includes('invalid_grant')) {
      errorMessage = 'Authorization code expired or already used';
      suggestions = [
        'Authorization codes expire quickly (usually 10 minutes)',
        'Try the OAuth flow again: /api/oauth/authorize',
        'Make sure you complete the process quickly after clicking authorize'
      ];
    } else if (error.message.includes('invalid_client')) {
      errorMessage = 'OAuth client configuration error';
      suggestions = [
        'Check your GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET',
        'Verify redirect URIs in Google Cloud Console',
        'Make sure the OAuth client is for a "Web application"'
      ];
    }
    
    return res.status(500).json({
      error: errorMessage,
      details: error.message,
      suggestions: suggestions,
      fullError: error.toString()
    });
  }
}