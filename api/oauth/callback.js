export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error } = req.query;

  // Debug environment variables
  console.log('OAuth callback debug:', {
    hasClientId: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    clientIdLength: process.env.GOOGLE_OAUTH_CLIENT_ID?.length,
    clientSecretLength: process.env.GOOGLE_OAUTH_CLIENT_SECRET?.length,
    redirectUri: `${process.env.PUBLIC_BASE_URL || 'https://www.pixdrop.cloud'}/api/oauth/callback`,
    hasCode: !!code,
    error: error
  });

  if (error) {
    return res.status(400).json({ error: `OAuth error: ${error}` });
  }

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
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

    // Return tokens (in production, you'd store the refresh_token securely)
    return res.status(200).json({
      success: true,
      message: 'OAuth authorization successful!',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      },
      instructions: `
        Copy the refresh_token and add it to your Vercel environment variables as:
        GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}
      `
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.status(500).json({
      error: 'Failed to exchange authorization code',
      details: error.message,
      fullError: error.toString()
    });
  }
}