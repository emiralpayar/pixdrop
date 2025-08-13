// ESM – Vercel Node Function
export default async function handler(req, res) {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Check for OAuth2 authentication method
  const hasOAuthCredentials = !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
  const hasRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN;
  
  // Determine authentication status
  let authMethod = 'None';
  let isAuthenticated = false;
  
  if (hasOAuthCredentials && hasRefreshToken) {
    authMethod = 'OAuth2';
    isAuthenticated = true;
  } else if (hasOAuthCredentials) {
    authMethod = 'OAuth2 (Partial - missing refresh token)';
    isAuthenticated = false;
  }

  res.json({
    folderId: process.env.DRIVE_FOLDER_ID || '',
    isAuthenticated,
    authMethod,
    hasOAuthCredentials,
    hasRefreshToken,
    backendUrl: req.headers.host,
    timestamp: new Date().toISOString()
  });
}
