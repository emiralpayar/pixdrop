import { kv } from '@vercel/kv';

const EVENTS_KEY = 'pixdrop:events';

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

  try {
    console.log('Looking for event:', eventName);
    
    // Get events from KV storage
    const events = await kv.get(EVENTS_KEY) || [];
    console.log('Found events in KV:', events.length);
    
    // Find event by name or slug
    const event = events.find(e => {
      const slug = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      return e.name.toLowerCase() === eventName.toLowerCase() || 
             e.slug === eventName.toLowerCase() ||
             slug === eventName.toLowerCase();
    });

    if (!event) {
      console.log('Event not found in KV, available events:', events.map(e => e.name));
      return res.status(404).json({ 
        error: 'Event not found',
        availableEvents: events.map(e => e.name)
      });
    }

    console.log('Found event:', event);
    return res.json(event);

  } catch (error) {
    console.error('Failed to lookup event in KV:', error);
    return res.status(500).json({ 
      error: 'Failed to lookup event',
      details: error.message
    });
  }
}