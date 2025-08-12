// Temporary in-memory storage (replace with database later)
let events = [];

export function addEvent(event) {
  events.push(event);
}

export function getEvents() {
  return events;
}

export function getEventByName(name) {
  return events.find(e => {
    const slug = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return e.name.toLowerCase() === name.toLowerCase() || slug === name.toLowerCase();
  });
}

export function deleteEvent(id) {
  const initialLength = events.length;
  events = events.filter(e => e.id !== id);
  return events.length !== initialLength;
}

export function updateEvent(id, updates) {
  const index = events.findIndex(e => e.id === id);
  if (index !== -1) {
    events[index] = { ...events[index], ...updates };
    return events[index];
  }
  return null;
}
