import { google } from 'googleapis';

export default async function handler(req, res) {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { folderId } = req.query;
  
  if (!folderId) {
    return res.status(400).json({ error: 'Folder ID is required' });
  }

  if (!process.env.GOOGLE_OAUTH_CLIENT_ID || !process.env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Google OAuth credentials not configured' });
  }

  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    return res.status(500).json({ error: 'Google refresh token not configured' });
  }

  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      `${process.env.PUBLIC_BASE_URL || 'https://www.pixdrop.cloud'}/api/oauth/callback`
    );

    // Set the refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Fetch files from the folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and (mimeType contains 'image/')`,
      fields: 'files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 50 // Limit to 50 most recent photos
    });

    const photos = response.data.files || [];

    // Generate thumbnail URLs for the photos
    const photosWithThumbnails = photos.map(photo => ({
      id: photo.id,
      name: photo.name,
      mimeType: photo.mimeType,
      webViewLink: photo.webViewLink,
      thumbnailLink: photo.thumbnailLink,
      // Create a direct view URL for the image
      directLink: `https://drive.google.com/uc?id=${photo.id}`,
      createdTime: photo.createdTime
    }));

    return res.json({
      success: true,
      photos: photosWithThumbnails,
      count: photosWithThumbnails.length
    });

  } catch (error) {
    console.error('Failed to fetch photos from Drive:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch photos',
      details: error.message
    });
  }
}
