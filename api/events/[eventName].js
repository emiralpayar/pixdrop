import { getEventByName } from '../utils/events-store.js';

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

  const event = getEventByName(eventName);

  if (!event) {
    return res.status(404).json({ error: 'Event not found' });
  }

  return res.json(event);
}