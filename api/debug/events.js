import { getEvents } from '../utils/events-store.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  
  const events = getEvents();
  
  return res.json({
    eventsCount: events.length,
    events: events,
    message: events.length === 0 ? 'Events array is empty - this is why event lookup fails' : 'Events found'
  });
}