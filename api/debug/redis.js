import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
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
        hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
      }
    });
    
  } catch (error) {
    console.error('Redis debug error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString(),
      envVars: {
        hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasUpstashToken: !!process.env.UPSTASH_REDIS_REST_TOKEN
      }
    });
  }
}