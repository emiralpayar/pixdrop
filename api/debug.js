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

  const { type, eventName } = req.query;

  try {
    switch (type) {
      case 'redis':
        return await debugRedis(res);
      case 'env':
        return debugEnv(res);
      case 'event-lookup':
        return await debugEventLookup(res, eventName);
      case 'events':
        return await debugEvents(res);
      default:
        return res.json({
          message: 'Debug API - Available endpoints',
          endpoints: {
            '/api/debug?type=redis': 'Test Redis connection and list events',
            '/api/debug?type=env': 'Show environment variables status',
            '/api/debug?type=event-lookup&eventName=SLUG': 'Debug specific event lookup',
            '/api/debug?type=events': 'List all events in Redis'
          }
        });
    }
  } catch (error) {
    console.error('Debug API error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString()
    });
  }
}

async function debugRedis(res) {
  const events = await redis.get(EVENTS_KEY) || [];
  
  // Test write operation
  const testKey = 'test:timestamp';
  await redis.set(testKey, new Date().toISOString());
  const testValue = await redis.get(testKey);
  
  return res.json({
    success: true,
    redisConnection: 'working',
    eventsCount: events.length,
    events: events,
    testWrite: testValue,
    envVars: {
      hasKvUrl: !!process.env.KV_REST_API_URL,
      hasKvToken: !!process.env.KV_REST_API_TOKEN
    }
  });
}

function debugEnv(res) {
  return res.json({
    environment: {
      hasKvUrl: !!process.env.KV_REST_API_URL,
      hasKvToken: !!process.env.KV_REST_API_TOKEN,
      hasOAuthClientId: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
      hasOAuthClientSecret: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
      hasDriveFolderId: !!process.env.DRIVE_FOLDER_ID,
      hasPublicBaseUrl: !!process.env.PUBLIC_BASE_URL,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV
    }
  });
}

async function debugEventLookup(res, eventName) {
  if (!eventName) {
    return res.status(400).json({ error: 'eventName parameter required' });
  }

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
    debug: lookupDetails
  });
}

async function debugEvents(res) {
  const events = await redis.get(EVENTS_KEY) || [];
  return res.json({
    success: true,
    totalEvents: events.length,
    events: events
  });
}
