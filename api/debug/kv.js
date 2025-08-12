import { kv } from '@vercel/kv';

const EVENTS_KEY = 'pixdrop:events';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  try {
    // Test KV connection
    const events = await kv.get(EVENTS_KEY) || [];
    
    // Test write operation
    const testKey = 'test:timestamp';
    await kv.set(testKey, new Date().toISOString());
    const testValue = await kv.get(testKey);
    
    return res.json({
      success: true,
      kvConnection: 'working',
      eventsCount: events.length,
      events: events,
      testWrite: testValue,
      envVars: {
        hasKvUrl: !!process.env.KV_URL,
        hasKvToken: !!process.env.KV_REST_API_TOKEN,
        hasKvReadToken: !!process.env.KV_REST_API_READ_ONLY_TOKEN,
        hasKvRestUrl: !!process.env.KV_REST_API_URL
      }
    });
    
  } catch (error) {
    console.error('KV debug error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString()
    });
  }
}