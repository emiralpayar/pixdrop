export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `OAuth error: ${error}` });
  }

  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }

  try {
    const { google } = await import('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.PUBLIC_BASE_URL || 'https://www.pixdrop.cloud'}/api/oauth/callback`
    );

    // Exchange code for tokens
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
      details: error.message
    });
  }
}