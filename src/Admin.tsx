import React, { useEffect, useState } from 'react'

const BACKEND_URL = import.meta.env?.VITE_API_BASE || ''
const BASE_DOMAIN = import.meta.env?.VITE_BASE_DOMAIN || ''
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

interface EventItem {
  id: string
  name: string
  slug: string
  folderId: string
}

interface AdminStatus {
  folderId: string
  isAuthenticated: boolean
  authMethod: string
  hasOAuthCredentials: boolean
  hasRefreshToken: boolean
  backendUrl: string
  timestamp: string
}

export default function Admin() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [form, setForm] = useState<Partial<EventItem>>({})
  const [status, setStatus] = useState<AdminStatus | null>(null)
  const [activeTab, setActiveTab] = useState<'events' | 'status'>('events')

  const load = () => {
    fetch(`${BACKEND_URL}/events`).then(r => r.json()).then(setEvents).catch(() => setEvents([]))
  }

  const loadStatus = () => {
    fetch(`${BACKEND_URL}/admin/status`)
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus(null))
  }

  useEffect(() => {
    load()
    loadStatus()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name) return
    const method = form.id ? 'PUT' : 'POST'
    const url = form.id ? `${BACKEND_URL}/events/${form.id}` : `${BACKEND_URL}/events`
    const payload: any = { name: form.name }
    if (form.slug) payload.slug = form.slug
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setForm({})
    load()
  }

  const edit = (ev: EventItem) => setForm({ id: ev.id, name: ev.name, slug: ev.slug })
  const del = async (id: string) => { await fetch(`${BACKEND_URL}/events/${id}`, { method: 'DELETE' }); load() }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-4">PixDrop Admin</h1>
        <div className="flex gap-4 border-b">
          <button 
            className={`px-4 py-2 font-medium ${activeTab === 'events' ? 'border-b-2 border-sky-500 text-sky-600' : 'text-slate-600'}`}
            onClick={() => setActiveTab('events')}
          >
            Events Management
          </button>
          <button 
            className={`px-4 py-2 font-medium ${activeTab === 'status' ? 'border-b-2 border-sky-500 text-sky-600' : 'text-slate-600'}`}
            onClick={() => setActiveTab('status')}
          >
            System Status
          </button>
        </div>
      </div>

      {activeTab === 'events' && (
        <div>
          <form onSubmit={submit} className="space-y-2 mb-6 p-4 border rounded-lg bg-slate-50">
            <h2 className="text-lg font-medium mb-2">Add/Edit Event</h2>
            <input className="w-full border p-2 rounded" placeholder="Event Name" value={form.name||''} onChange={e=>{const name=e.target.value; setForm(f=>({...f, name, slug: f.slug||slugify(name)}))}} />
            <input className="w-full border p-2 rounded" placeholder="Slug (subdomain)" value={form.slug||''} onChange={e=>setForm({...form, slug:e.target.value})} />
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-sky-500 text-white rounded hover:bg-sky-600" type="submit">
                {form.id? 'Update':'Add'} Event
              </button>
              {form.id && (
                <button type="button" className="px-4 py-2 border rounded hover:bg-slate-50" onClick={()=>setForm({})}>
                  Cancel
                </button>
              )}
            </div>
          </form>
          
          <div className="space-y-2">
            <h2 className="text-lg font-medium">Existing Events</h2>
            {events.length === 0 ? (
              <p className="text-slate-500 p-4 border rounded">No events created yet.</p>
            ) : (
              <ul className="space-y-2">
                {events.map(ev => (
                  <li key={ev.id} className="border p-4 rounded flex justify-between items-center bg-white">
                    <div>
                      <div className="font-medium">{ev.name}</div>
                      <div className="text-sm text-slate-600">
                        {(() => {
                          const url = BASE_DOMAIN
                            ? `https://${ev.slug}.${BASE_DOMAIN}`
                            : `https://pixdrop.cloud/event/${ev.slug}`
                          const label = BASE_DOMAIN
                            ? `${ev.slug}.${BASE_DOMAIN}`
                            : `pixdrop.cloud/event/${ev.slug}`
                          return (
                            <>Link: <a href={url} target="_blank" rel="noreferrer" className="text-sky-600 underline">{label}</a></>
                          )
                        })()}
                      </div>
                      <div className="text-xs text-slate-500">Folder ID: {ev.folderId}</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 border rounded hover:bg-slate-50" onClick={()=>edit(ev)}>Edit</button>
                      <button className="px-3 py-1 border rounded text-red-600 hover:bg-red-50" onClick={()=>del(ev.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-white">
              <h2 className="font-medium mb-3">Backend Connection</h2>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${BACKEND_URL ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{BACKEND_URL ? 'Connected' : 'No backend configured'}</span>
              </div>
              {BACKEND_URL && <p className="text-xs text-slate-500">Endpoint: {BACKEND_URL}</p>}
              {status && <p className="text-xs text-slate-500">Last check: {new Date(status.timestamp).toLocaleString()}</p>}
            </div>

            <div className="p-4 rounded-lg border bg-white">
              <h2 className="font-medium mb-3">Google Drive Integration</h2>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${status?.isAuthenticated ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">
                  {status?.isAuthenticated ? `Connected (${status.authMethod})` : 'Not authenticated'}
                </span>
              </div>
              {status?.folderId && (
                <p className="text-xs text-slate-500">Default Folder: {status.folderId}</p>
              )}
              {status && (
                <div className="text-xs text-slate-500 mt-2 space-y-1">
                  <div>OAuth Credentials: {status.hasOAuthCredentials ? '✓' : '✗'}</div>
                  <div>Refresh Token: {status.hasRefreshToken ? '✓' : '✗'}</div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-lg border bg-white">
              <h2 className="font-medium mb-3">Environment Variables</h2>
              <div className="text-xs text-slate-600 space-y-1">
                <div>VITE_API_BASE: {import.meta.env.VITE_API_BASE || 'Not set'}</div>
                <div>Backend URL: {status?.backendUrl || 'No response'}</div>
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-white">
              <h2 className="font-medium mb-3">Quick Actions</h2>
              <div className="space-y-2">
                <button 
                  onClick={loadStatus} 
                  className="w-full px-3 py-2 bg-slate-100 rounded hover:bg-slate-200"
                >
                  Refresh Status
                </button>
                <a 
                  href="/" 
                  className="block w-full px-3 py-2 bg-sky-500 text-white rounded hover:bg-sky-600 text-center"
                >
                  Back to Upload
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
