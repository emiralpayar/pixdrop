import React, { useEffect, useState } from 'react'

const BACKEND_URL = import.meta.env?.VITE_API_BASE || ''

interface EventItem {
  id: string
  name: string
  slug: string
  folderId: string
}

export default function Admin() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [form, setForm] = useState<Partial<EventItem>>({})

  const load = () => {
    fetch(`${BACKEND_URL}/events`).then(r => r.json()).then(setEvents).catch(() => setEvents([]))
  }
  useEffect(load, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.slug || !form.folderId) return
    const method = form.id ? 'PUT' : 'POST'
    const url = form.id ? `${BACKEND_URL}/events/${form.id}` : `${BACKEND_URL}/events`
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setForm({})
    load()
  }

  const edit = (ev: EventItem) => setForm(ev)
  const del = async (id: string) => { await fetch(`${BACKEND_URL}/events/${id}`, { method: 'DELETE' }); load() }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Event Admin</h1>
      <form onSubmit={submit} className="space-y-2 mb-6">
        <input className="w-full border p-2" placeholder="Name" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})} />
        <input className="w-full border p-2" placeholder="Slug (subdomain)" value={form.slug||''} onChange={e=>setForm({...form, slug:e.target.value})} />
        <input className="w-full border p-2" placeholder="Drive Folder ID" value={form.folderId||''} onChange={e=>setForm({...form, folderId:e.target.value})} />
        <button className="px-3 py-2 bg-sky-500 text-white rounded" type="submit">{form.id? 'Update':'Add'} Event</button>
        {form.id && <button type="button" className="ml-2 px-3 py-2 border rounded" onClick={()=>setForm({})}>Cancel</button>}
      </form>
      <ul className="space-y-2">
        {events.map(ev => (
          <li key={ev.id} className="border p-2 rounded flex justify-between items-center">
            <div>
              <div className="font-medium">{ev.name}</div>
              <div className="text-xs text-slate-600">{ev.slug} → {ev.folderId}</div>
            </div>
            <div className="flex gap-2">
              <button className="px-2 py-1 border rounded" onClick={()=>edit(ev)}>Edit</button>
              <button className="px-2 py-1 border rounded" onClick={()=>del(ev.id)}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
