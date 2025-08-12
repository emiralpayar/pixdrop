import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const EVENTS_KEY = 'pixdrop:events';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    // Test Redis connection
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
        hasKvToken: !!process.env.KV_REST_API_TOKEN,
        hasRedisUrl: !!process.env.REDIS_URL
      }
    });
    
  } catch (error) {
    console.error('Redis debug error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString(),
      envVars: {
        hasKvUrl: !!process.env.KV_REST_API_URL,
        hasKvToken: !!process.env.KV_REST_API_TOKEN,
        hasRedisUrl: !!process.env.REDIS_URL
      }
    });
  }
}