import { createEventFolder, checkFolderExists } from './utils/drive-folder.js';

// In-memory storage (you can replace this with a database later)
let events = [];

export default async function handler(req, res) {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.json(events);
  }

  if (req.method === 'POST') {
    const { name, createFolder = true } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
      // Check if event already exists
      const existingEvent = events.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (existingEvent) {
        return res.status(400).json({ error: 'Event with this name already exists' });
      }

      let eventFolderId = process.env.DRIVE_FOLDER_ID; // Default to main folder
      let folderWebViewLink = '';

      if (createFolder && process.env.GOOGLE_REFRESH_TOKEN) {
        try {
          console.log('Creating folder for event:', name);
          
          // Check if folder already exists
          const existingFolder = await checkFolderExists(name, process.env.DRIVE_FOLDER_ID);
          
          if (existingFolder) {
            console.log('Folder already exists:', existingFolder);
            eventFolderId = existingFolder.id;
            folderWebViewLink = existingFolder.webViewLink;
          } else {
            // Create new folder
            const folder = await createEventFolder(name, process.env.DRIVE_FOLDER_ID);
            eventFolderId = folder.id;
            folderWebViewLink = folder.webViewLink;
          }
          
        } catch (folderError) {
          console.error('Failed to create folder, using default:', folderError);
          // Continue with default folder if folder creation fails
        }
      }

      const event = {
        id: Date.now().toString(),
        name: name.trim(),
        folderId: eventFolderId,
        folderLink: folderWebViewLink,
        link: `${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}.pixdrop.cloud`,
        createdAt: new Date().toISOString(),
        hasCustomFolder: eventFolderId !== process.env.DRIVE_FOLDER_ID
      };

      events.push(event);
      console.log('Created event:', event);
      
      return res.json(event);
    } catch (error) {
      console.error('Failed to create event:', error);
      return res.status(500).json({ error: 'Failed to create event', details: error.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Event ID is required' });

    const initialLength = events.length;
    events = events.filter(e => e.id !== id);
    
    if (events.length === initialLength) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
