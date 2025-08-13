import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

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
    console.log('Event lookup request:', { eventName, method: req.method, headers: req.headers.origin });
    console.log('Looking for event:', eventName);
    
    const events = await redis.get(EVENTS_KEY) || [];
    console.log('Found events in Redis:', events.length);
    
    const event = events.find(e => {
      const slug = e.name?.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matches = {
        exactName: e.name?.toLowerCase() === eventName?.toLowerCase(),
        slugMatch: e.slug === eventName?.toLowerCase(),
        nameSlugMatch: slug === eventName?.toLowerCase()
      };
      console.log(`Checking event "${e.name}":`, matches);
      return matches.exactName || matches.slugMatch || matches.nameSlugMatch;
    });

    if (!event) {
      console.log('Event not found in Redis, available events:', events.map(e => ({ name: e.name, slug: e.slug })));
      return res.status(404).json({ 
        error: 'Event not found',
        availableEvents: events.map(e => e.name),
        requestedEvent: eventName
      });
    }

    console.log('Found event:', event);
    return res.json(event);

  } catch (error) {
    console.error('Failed to lookup event in Redis:', error);
    return res.status(500).json({ 
      error: 'Failed to lookup event',
      details: error.message
    });
  }
}