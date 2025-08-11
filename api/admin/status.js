// Vercel Serverless Function (Node)
// GET /api/admin/status
module.exports = (req, res) => {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT || '';
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch {}
  const hasServiceAccount = !!(parsed && parsed.client_email && parsed.private_key);

  res.setHeader('Content-Type','application/json');
  res.status(200).send(JSON.stringify({
    hasServiceAccount,
    folderId: process.env.DRIVE_FOLDER_ID || null,
    backendUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    timestamp: new Date().toISOString()
  }));
};
