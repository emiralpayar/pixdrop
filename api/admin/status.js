// ESM – Vercel Node Function
export default async function handler(req, res) {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  res.json({
    folderId: process.env.DRIVE_FOLDER_ID || '',
    hasOAuthCredentials: !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET),
    hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
    backendUrl: req.headers.host,
    timestamp: new Date().toISOString(),
    authMethod: 'OAuth2'
  });
}
