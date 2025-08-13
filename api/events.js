import { Redis } from '@upstash/redis';
import { createEventFolder, checkFolderExists } from './utils/drive-folder.js';

// Use the KV REST API variables that you have
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const EVENTS_KEY = 'pixdrop:events';

export default async function handler(req, res) {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    try {
      const events = await redis.get(EVENTS_KEY) || [];
      console.log('Retrieved events from Redis:', events.length);
      return res.json(events);
    } catch (error) {
      console.error('Failed to get events from Redis:', error);
      return res.json([]);
    }
  }

  if (req.method === 'POST') {
    const { name, createFolder = true } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
      const events = await redis.get(EVENTS_KEY) || [];
      console.log('Current events in Redis:', events.length);
      
      const existingEvent = events.find(e => e.name.toLowerCase() === name.toLowerCase());
      if (existingEvent) {
        return res.status(400).json({ error: 'Event with this name already exists' });
      }

      let eventFolderId = process.env.DRIVE_FOLDER_ID;
      let folderWebViewLink = '';

      if (createFolder && process.env.GOOGLE_REFRESH_TOKEN) {
        try {
          console.log('Creating folder for event:', name);
          
          const existingFolder = await checkFolderExists(name, process.env.DRIVE_FOLDER_ID);
          
          if (existingFolder) {
            console.log('Folder already exists:', existingFolder);
            eventFolderId = existingFolder.id;
            folderWebViewLink = existingFolder.webViewLink;
          } else {
            const folder = await createEventFolder(name, process.env.DRIVE_FOLDER_ID);
            eventFolderId = folder.id;
            folderWebViewLink = folder.webViewLink;
            console.log('Created new folder:', folder);
          }
        } catch (folderError) {
          console.error('Failed to create folder, using default:', folderError);
        }
      }

      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const event = {
        id: Date.now().toString(),
        name: name.trim(),
        slug: slug,
        folderId: eventFolderId,
        folderLink: folderWebViewLink,
        link: `pixdrop.cloud/event/${slug}`,
        createdAt: new Date().toISOString(),
        hasCustomFolder: eventFolderId !== process.env.DRIVE_FOLDER_ID
      };

      events.push(event);
      await redis.set(EVENTS_KEY, events);
      
      console.log('Created event and saved to Redis:', event);
      return res.json(event);
      
    } catch (error) {
      console.error('Failed to create event:', error);
      return res.status(500).json({ error: 'Failed to create event', details: error.message });
    }
  }

  if (req.method === 'DELETE') {
    // Support both URL parameter and request body for event ID
    const eventId = req.query.id || req.body?.id;
    
    if (!eventId) {
      return res.status(400).json({ error: 'Event ID is required' });
    }

    const events = await redis.get(EVENTS_KEY) || [];
    const initialLength = events.length;
    const updatedEvents = events.filter(event => event.id !== eventId);
    
    if (events.length === updatedEvents.length) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await redis.set(EVENTS_KEY, updatedEvents);
    
    console.log(`Event deleted successfully: ${eventId}`);
    return res.json({ 
      success: true, 
      message: 'Event deleted successfully',
      deletedEventId: eventId,
      remainingEvents: updatedEvents.length
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
