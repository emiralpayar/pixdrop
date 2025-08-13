import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import clsx from 'clsx'

const BACKEND_URL = import.meta.env?.VITE_API_BASE || ''

type Event = {
  id: string
  name: string
  slug: string
  folderId: string
  folderLink: string
  link: string
  createdAt: string
  hasCustomFolder: boolean
}

type Item = {
  id: string
  file: File
  name: string
  size: number
  type: string
  preview: string
  progress: number
  status: 'ready'|'uploading'|'done'|'error'|'canceled'
  canceler: AbortController | null
  driveMeta: any
}

export default function App() {
  // Detect if this is an event page
  const pathname = window.location.pathname
  const isEventPage = pathname.startsWith('/event/')
  const eventName = isEventPage ? pathname.split('/event/')[1] : null

  const [event, setEvent] = useState<Event | null>(null)
  const [eventLoading, setEventLoading] = useState(isEventPage)
  const [files, setFiles] = useState<Item[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [compress, setCompress] = useState(true)
  const [stripExif, setStripExif] = useState(true)
  const [weddingCode, setWeddingCode] = useState('OurBigDay2025')
  const [uploaderName, setUploaderName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const inputRef = useRef<HTMLInputElement|null>(null)
  const dropRef = useRef<HTMLDivElement|null>(null)

  // Fetch event details if this is an event page
  useEffect(() => {
    if (isEventPage && eventName) {
      setEventLoading(true)
      const apiUrl = BACKEND_URL ? `${BACKEND_URL}/api/events/${eventName}` : `/api/events/${eventName}`
      console.log('Fetching event from:', apiUrl)
      fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            toast.error(`Event not found: ${eventName}`)
          } else {
            setEvent(data)
            setWeddingCode(data.name)
          }
        })
        .catch(err => {
          console.error('Failed to fetch event:', err)
          toast.error('Failed to load event details')
        })
        .finally(() => setEventLoading(false))
    }
  }, [isEventPage, eventName])

  useEffect(() => {
    const url = window.location.origin + window.location.pathname
    QRCode.toDataURL(url, { margin: 1, scale: 6 }).then(setQrDataUrl).catch(() => {})
  }, [])

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || [])
      const imageItems = items.filter(i => i.type?.startsWith('image/'))
      if (imageItems.length) {
        const fls = imageItems.map(i => i.getAsFile()).filter(Boolean) as File[]
        if (fls.length) handleIncomingFiles(fls)
      }
    }
    window.addEventListener('paste', onPaste as any)
    return () => window.removeEventListener('paste', onPaste as any)
  }, [])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.target === dropRef.current) setDragActive(false)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragActive(false)
    const fileList = Array.from(e.dataTransfer?.files || [])
    if (fileList.length) handleIncomingFiles(fileList)
  }

  async function handleIncomingFiles(incoming: File[]) {
    const accepted = incoming.filter(f => /image\/(jpeg|png|webp|heic|heif)/i.test(f.type))
    if (accepted.length !== incoming.length) toast.warning('Only images are allowed (jpeg/png/webp/heic)')
    const mapped: Item[] = await Promise.all(accepted.map(async (f) => ({
      id: crypto.randomUUID(),
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      preview: URL.createObjectURL(f),
      progress: 0,
      status: 'ready',
      canceler: null,
      driveMeta: null
    })))
    setFiles(prev => [...mapped, ...prev])
  }

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))
  const clearAll = () => setFiles([])
  const pickFiles = () => inputRef.current?.click()

  const maybeCompress = async (file: File) => {
    if (!compress && !stripExif) return file
    try {
      const bitmap = await createImageBitmap(file)
      const maxSide = 3000
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
      const targetW = Math.round(bitmap.width * scale)
      const targetH = Math.round(bitmap.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = targetW; canvas.height = targetH
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bitmap, 0, 0, targetW, targetH)
      const blob: Blob = await new Promise(res => canvas.toBlob(res as any, 'image/jpeg', 0.88) as any)
      return new File([blob], file.name.replace(/\.(heic|heif|webp|png)$/i, '.jpg'), { type: 'image/jpeg' })
    } catch (e) {
      console.warn('Compress failed, using original:', e)
      return file
    }
  }

  async function uploadOne(item: Item) {
    const controller = new AbortController()
    updateFile(item.id, { status: 'uploading', canceler: controller })

    try {
      const prepared = await maybeCompress(item.file)
      const form = new FormData()
      form.append('file', prepared)
      
      // Use event folder if available, otherwise use form inputs
      if (event?.folderId) {
        form.append('eventFolderId', event.folderId)
        form.append('eventName', event.name)
      } else {
        if (weddingCode) form.append('weddingCode', weddingCode)
      }
      
      if (uploaderName) form.append('uploaderName', uploaderName)

      const uploadUrl = BACKEND_URL ? `${BACKEND_URL}/api/upload` : `/api/upload`
      console.log('Uploading to:', uploadUrl)
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: form,
        signal: controller.signal
      })

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const meta = await res.json()
      updateFile(item.id, { status: 'done', progress: 100, driveMeta: meta, canceler: null })
      toast.success(`Uploaded: ${item.name}`)
    } catch (err: any) {
      if (controller.signal.aborted) {
        updateFile(item.id, { status: 'canceled', canceler: null })
        toast(`Canceled: ${item.name}`)
      } else {
        console.error(err)
        if (!BACKEND_URL) {
          updateFile(item.id, { status: 'done', progress: 100 })
          toast.success(`(Demo) Uploaded: ${item.name}`)
        } else {
          updateFile(item.id, { status: 'error', canceler: null })
          toast.error(`Failed: ${item.name}`)
        }
      }
    }
  }

  function updateFile(id: string, patch: Partial<Item>) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  async function uploadAll() {
    const queue = files.filter(f => ['ready','error','canceled'].includes(f.status))
    if (queue.length === 0) return toast('No files to upload')
    setIsUploading(true)
    for (const f of queue) {
      updateFile(f.id, { progress: 5 })
      await uploadOne(f)
    }
    setIsUploading(false)
  }

  function cancelUpload(id: string) {
    const f = files.find(x => x.id === id)
    if (f?.canceler) f.canceler.abort()
  }

  const totalSize = useMemo(() => files.reduce((s, f) => s + (f.size || 0), 0), [files])

  const prettyBytes = (n: number) => {
    if (!Number.isFinite(n)) return '0 B'
    const units = ['B','KB','MB','GB']; let i = 0; let val = n
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++ }
    return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
  }

  return (
    <div className="app-container">
      <div className="mx-auto max-w-6xl p-6 md:p-10">
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-3xl md:text-4xl font-semibold tracking-tight">
              {isEventPage ? event?.name || eventName : 'PixDrop'}
            </div>
            <p className="text-slate-600 mt-1">
              {isEventPage 
                ? `Upload your photos for ${event?.name || eventName}` 
                : 'Drop, paste, or snap. We\'ll take care of the rest ✨'}
            </p>
            {eventLoading && (
              <p className="text-sm text-slate-500">Loading event details...</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-lg border hover:bg-slate-50" onClick={() => setQrOpen(true)}>Share QR</button>
            {event?.folderLink && (
              <a 
                href={event.folderLink} 
                target="_blank" 
                rel="noreferrer"
                className="px-3 py-2 rounded-lg bg-sky-500 text-white hover:bg-sky-600"
              >
                View Folder
              </a>
            )}
            {!isEventPage && (
              <a 
                href="/admin" 
                className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-black"
              >
                Admin
              </a>
            )}
          </div>
        </header>

        <div className="rounded-2xl border bg-white shadow-sm border-slate-200">
          <div className="p-5 md:p-6 border-b">
            <div className="flex items-center justify-between">
              <span className="font-medium">Upload Box</span>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">{files.length} selected · {prettyBytes(totalSize)}</span>
            </div>
          </div>

          <div className="p-5 md:p-8">
            <div
              ref={dropRef}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={clsx(
                "relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition bg-white",
                dragActive ? "border-slate-900 bg-slate-50" : "border-slate-300"
              )}
            >
              <AnimatePresence>
                {dragActive && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 rounded-2xl bg-slate-100/60 pointer-events-none" />
                )}
              </AnimatePresence>

              <div className="flex flex-col items-center gap-3">
                <div className="text-lg">Drag & drop photos here</div>
                <div className="text-sm text-slate-500">or</div>
                <div className="flex gap-2 flex-wrap justify-center">
                  <button onClick={() => inputRef.current?.click()} className="px-3 py-2 rounded-lg bg-sky-500 text-white hover:bg-sky-600">Choose from device</button>
                  <label className="inline-flex">
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleIncomingFiles(Array.from(e.target.files || []))} />
                    <span className="px-3 py-2 rounded-lg border hover:bg-slate-50">Open camera</span>
                  </label>
                </div>
                <div className="text-xs text-slate-500 mt-1">Tip: You can also paste images (Ctrl/⌘+V)</div>
                <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleIncomingFiles(Array.from(e.target.files || []))} />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {files.map((f) => (
                    <motion.div key={f.id} layout className="group relative">
                      <div className="aspect-square overflow-hidden rounded-xl ring-1 ring-slate-200 shadow-sm">
                        <img src={f.preview} alt={f.name} className="h-full w-full object-cover transition group-hover:scale-105" />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{f.name}</div>
                          <div className="text-xs text-slate-500">{prettyBytes(f.size)}</div>
                        </div>
                        <StatusPill status={f.status} />
                      </div>
                      {(f.status === 'uploading' || f.progress > 0) && (
                        <div className="mt-2 h-2 rounded bg-slate-200 overflow-hidden">
                          <div className="h-full bg-sky-500 transition-all" style={{ width: `${f.progress}%` }} />
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        {['ready','error','canceled'].includes(f.status) && (
                          <button className="px-2 py-1 rounded bg-sky-500 text-white hover:bg-sky-600 text-sm" onClick={() => uploadOne(f)}>Upload</button>
                        )}
                        {f.status === 'uploading' && (
                          <button className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-sm" onClick={() => cancelUpload(f.id)}>Cancel</button>
                        )}
                        {f.status === 'done' && f.driveMeta?.webViewLink && (
                          <a className="px-2 py-1 rounded border hover:bg-slate-50 text-sm" href={f.driveMeta.webViewLink} target="_blank" rel="noreferrer">Open</a>
                        )}
                        <button className="px-2 py-1 rounded text-sm hover:bg-rose-50" onClick={() => removeFile(f.id)}>Remove</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {files.length === 0 && (
                  <div className="text-center text-slate-500 text-sm">No photos yet. Add some above!</div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border p-4">
                  <div className="font-medium mb-3">Upload Settings</div>
                  <div className="grid grid-cols-1 gap-3">
                    {!isEventPage && (
                      <label className="grid grid-cols-3 items-center gap-2">
                        <span className="text-sm text-slate-700">Event code</span>
                        <input className="col-span-2 px-3 py-2 rounded border" value={weddingCode} onChange={(e) => setWeddingCode(e.target.value)} placeholder="Optional code" />
                      </label>
                    )}
                    <label className="grid grid-cols-3 items-center gap-2">
                      <span className="text-sm text-slate-700">Your name</span>
                      <input className="col-span-2 px-3 py-2 rounded border" value={uploaderName} onChange={(e) => setUploaderName(e.target.value)} placeholder="(optional)" />
                    </label>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} />
                      <span className="text-sm">Compress & resize</span>
                    </label>
                    <span className="text-xs px-2 py-1 rounded border">~3000px / 88%</span>
                  </div>

                  <label className="mt-2 inline-flex items-center gap-2">
                    <input type="checkbox" checked={stripExif} onChange={(e) => setStripExif(e.target.checked)} />
                    <span className="text-sm">Strip EXIF (basic)</span>
                  </label>

                  <div className="mt-3 flex gap-2">
                    <button disabled={isUploading || files.length === 0} onClick={uploadAll} className="px-3 py-2 rounded bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50">
                      {isUploading ? 'Uploading…' : 'Upload all'}
                    </button>
                    <button onClick={clearAll} disabled={isUploading || files.length === 0} className="px-3 py-2 rounded hover:bg-slate-50 border disabled:opacity-50">Clear</button>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="font-medium mb-2">Share</div>
                  <p className="text-sm text-slate-600">
                    {isEventPage 
                      ? `Share this page so guests can upload photos for ${event?.name || eventName}.`
                      : 'Everyone can visit this page to upload their photos. Share it via QR.'
                    }
                  </p>
                  <button onClick={() => setQrOpen(true)} className="mt-2 px-3 py-2 rounded border hover:bg-slate-50">Show QR</button>
                  {event?.folderLink && (
                    <a href={event.folderLink} target="_blank" rel="noreferrer" className="block mt-2">
                      <span className="px-3 py-2 inline-block rounded bg-slate-900 text-white hover:bg-black">Open Folder</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-slate-400 mt-8">
          Built with ❤️ for your big day · 
          {isEventPage ? ` Photos uploaded to ${event?.name || eventName}` : ' Create events in admin panel'}
        </footer>
      </div>

      <AnimatePresence>
        {qrOpen && (
          <motion.div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={() => setQrOpen(false)}>
            <motion.div className="bg-white rounded-2xl p-6 w-[360px] max-w-full" initial={{scale:0.95, y:8, opacity:0}} animate={{scale:1, y:0, opacity:1}} exit={{scale:0.95, y:8, opacity:0}} onClick={(e)=>e.stopPropagation()}>
              <div className="text-lg font-semibold">Share this page</div>
              <div className="text-sm text-slate-600">Guests can scan to open the uploader.</div>
              <div className="mt-4 flex justify-center">
                {qrDataUrl ? <img src={qrDataUrl} alt="QR" className="rounded-xl ring-1 ring-slate-200" /> : <div className="h-40 w-40 bg-slate-100 animate-pulse rounded-xl" />}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button className="px-3 py-2 rounded border hover:bg-slate-50" onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy page link</button>
                <button className="px-3 py-2 rounded bg-sky-500 text-white hover:bg-sky-600" onClick={() => setQrOpen(false)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatusPill({ status }:{ status: Item['status'] }) {
  const map: Record<Item['status'], {text:string, cls:string}> = {
    ready: { text: 'Ready', cls: 'bg-slate-100 text-slate-700' },
    uploading: { text: 'Uploading', cls: 'bg-sky-100 text-sky-700' },
    done: { text: 'Uploaded', cls: 'bg-emerald-100 text-emerald-700' },
    error: { text: 'Error', cls: 'bg-rose-100 text-rose-700' },
    canceled: { text: 'Canceled', cls: 'bg-amber-100 text-amber-700' },
  }
  const { text, cls } = map[status] || map.ready
  return <span className={clsx('text-xs px-2 py-1 rounded-full', cls)}>{text}</span>
}
