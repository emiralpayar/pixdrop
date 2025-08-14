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
    console.log('Fetching photos for folder:', folderId);
    
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
    console.log('Querying Google Drive for images in folder:', folderId);
    
    // First verify the folder exists and we can access it
    try {
      const folderInfo = await drive.files.get({
        fileId: folderId,
        fields: 'id,name,mimeType,parents'
      });
      console.log('Folder info:', folderInfo.data);
    } catch (folderError) {
      console.error('Error accessing folder:', folderError.message);
      return res.json({
        success: false,
        error: `Cannot access folder: ${folderError.message}`,
        photos: [],
        count: 0
      });
    }
    
    // First, let's try to get ALL files in the folder to see what's there
    const allFilesResponse = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,parents,webViewLink,webContentLink,thumbnailLink,createdTime)',
      pageSize: 50
    });
    
    console.log('All files in folder:', allFilesResponse.data.files?.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      id: f.id
    })));
    
    // Now try the specific image query
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false and (mimeType contains 'image/')`,
      fields: 'files(id,name,mimeType,webViewLink,webContentLink,thumbnailLink,createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 50 // Limit to 50 most recent photos
    });

    const photos = response.data.files || [];
    console.log(`Found ${photos.length} photos in folder ${folderId}`);
    console.log('Image files found:', photos.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      id: f.id
    })));

    // Generate thumbnail URLs for the photos
    const photosWithThumbnails = photos.map(photo => {
      // Try different methods to get viewable images
      const directLink = photo.thumbnailLink || `https://drive.google.com/uc?id=${photo.id}&export=view`;
      
      return {
        id: photo.id,
        name: photo.name,
        mimeType: photo.mimeType,
        webViewLink: photo.webViewLink,
        thumbnailLink: photo.thumbnailLink,
        // Use thumbnail link if available, otherwise try direct access
        directLink: directLink,
        createdTime: photo.createdTime
      };
    });

    console.log('Returning photos with thumbnails:', photosWithThumbnails.map(p => ({ name: p.name, id: p.id })));

    return res.json({
      success: true,
      photos: photosWithThumbnails,
      count: photosWithThumbnails.length,
      folderId: folderId
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
