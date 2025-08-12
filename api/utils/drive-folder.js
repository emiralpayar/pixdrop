export async function createEventFolder(eventName, parentFolderId) {
  const { google } = await import('googleapis');

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

  try {
    // Create folder
    const folderResponse = await drive.files.create({
      requestBody: {
        name: eventName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId]
      },
      fields: 'id,name,webViewLink',
      supportsAllDrives: true
    });

    console.log('Created event folder:', folderResponse.data);
    return folderResponse.data;

  } catch (error) {
    console.error('Failed to create event folder:', error);
    throw error;
  }
}

export async function checkFolderExists(folderName, parentFolderId) {
  const { google } = await import('googleapis');

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    `${process.env.PUBLIC_BASE_URL || 'https://www.pixdrop.cloud'}/api/oauth/callback`
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });

  try {
    const response = await drive.files.list({
      q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id,name,webViewLink)',
      supportsAllDrives: true
    });

    return response.data.files.length > 0 ? response.data.files[0] : null;

  } catch (error) {
    console.error('Failed to check folder existence:', error);
    return null;
  }
}