export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  // Get all environment variables that contain 'REDIS'
  const redisEnvs = {};
  Object.keys(process.env).forEach(key => {
    if (key.includes('REDIS') || key.includes('UPSTASH')) {
      redisEnvs[key] = process.env[key] ? 'SET' : 'NOT_SET';
    }
  });
  
  return res.json({
    redisEnvironmentVariables: redisEnvs,
    specificChecks: {
      UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      REDIS_URL: !!process.env.REDIS_URL,
      REDIS_TOKEN: !!process.env.REDIS_TOKEN
    }
  });
}