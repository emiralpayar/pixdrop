export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { google } = await import('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.PUBLIC_BASE_URL || 'https://www.pixdrop.cloud'}/api/oauth/callback`
    );

    const scopes = [
      'https://www.googleapis.com/auth/drive.file'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Important: gets refresh token
      scope: scopes,
      prompt: 'consent', // Forces consent screen to get refresh token
      include_granted_scopes: true,
      state: Date.now().toString() // Add state for security
    });

    console.log('Generated auth URL:', authUrl);

    // Redirect to Google's OAuth consent screen
    return res.redirect(authUrl);

  } catch (error) {
    console.error('OAuth authorize error:', error);
    return res.status(500).json({
      error: 'Failed to generate authorization URL',
      details: error.message
    });
  }
}