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
  
  try {
    const events = await redis.get(EVENTS_KEY) || [];
    
    const lookupDetails = {
      requestedEventName: eventName,
      totalEvents: events.length,
      allEvents: events.map(e => ({
        id: e.id,
        name: e.name,
        slug: e.slug,
        nameSlug: e.name?.toLowerCase().replace(/[^a-z0-9]/g, ''),
        matches: {
          exactName: e.name?.toLowerCase() === eventName?.toLowerCase(),
          slugMatch: e.slug === eventName?.toLowerCase(),
          nameSlugMatch: e.name?.toLowerCase().replace(/[^a-z0-9]/g, '') === eventName?.toLowerCase()
        }
      })),
      searchCriteria: {
        eventNameLower: eventName?.toLowerCase(),
        searchPatterns: [
          'exact name match',
          'slug match', 
          'name-based slug match'
        ]
      }
    };

    const foundEvent = events.find(e => {
      const slug = e.name?.toLowerCase().replace(/[^a-z0-9]/g, '');
      return e.name?.toLowerCase() === eventName?.toLowerCase() || 
             e.slug === eventName?.toLowerCase() ||
             slug === eventName?.toLowerCase();
    });

    return res.json({
      success: true,
      found: !!foundEvent,
      foundEvent,
      debug: lookupDetails,
      redisConnection: 'working'
    });

  } catch (error) {
    console.error('Event lookup debug error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString()
    });
  }
}
