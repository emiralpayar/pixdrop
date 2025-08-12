// In-memory storage (should match events.js)
let events = [];

export default async function handler(req, res) {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { eventName } = req.query;
  if (!eventName) return res.status(400).json({ error: 'Event name is required' });

  // Find event by name (case insensitive)
  const event = events.find(e => 
    e.name.toLowerCase() === eventName.toLowerCase() ||
    e.name.toLowerCase().replace(/[^a-z0-9]/g, '') === eventName.toLowerCase()
  );

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  return res.json(event);
}

// In your upload function, get the event details first
const eventResponse = await fetch(`/api/events/${eventName}`);
const eventData = await eventResponse.json();

// Then use the event's folder ID when uploading
const formData = new FormData();
formData.append('file', file);
formData.append('eventFolderId', eventData.folderId);
formData.append('eventName', eventData.name);
formData.append('uploaderName', uploaderName);