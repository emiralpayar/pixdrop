let store = [];
let seq = 1;

export default async function handler(req, res) {
  const allowed = ['https://pixdrop.cloud', 'https://www.pixdrop.cloud'];
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') return res.status(200).json(store);

  if (req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const item = { id: String(seq++), name: data.name || 'Event', slug: data.slug || 'event', folderId: data.folderId || '' };
        store.push(item);
        res.status(201).json(item);
      } catch { res.status(400).json({ error: 'Invalid JSON' }); }
    });
    return;
  }

  if (req.method === 'PUT') {
    const id = (req.url.split('/').pop() || '').trim();
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const idx = store.findIndex(x => x.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        store[idx] = { ...store[idx], ...data, id };
        res.status(200).json(store[idx]);
      } catch { res.status(400).json({ error: 'Invalid JSON' }); }
    });
    return;
  }

  if (req.method === 'DELETE') {
    const id = (req.url.split('/').pop() || '').trim();
    const before = store.length;
    store = store.filter(x => x.id !== id);
    return res.status(200).json({ removed: before - store.length });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
