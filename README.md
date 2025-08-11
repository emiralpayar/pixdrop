# PixDrop (Frontend)
Modern, elegant photo uploader for events. Drag & drop, paste, camera capture, client-side compression, simple sharing via QR. Ready to connect to Google Drive or your own S3/R2 backend.

## Quick Start
```bash
npm i
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Configure
- Set `VITE_API_BASE` in `.env` when your backend is ready.
- For demo, the app fakes success and points to a dummy Drive link.

## Deploy (Vercel recommended)
1. Push this repo to GitHub
2. Import to Vercel
3. Set Environment Variable: `VITE_API_BASE` (optional for demo)
4. Attach your domain `pixdrop.cloud`

## Backend Contract (expected)
`POST /upload` (multipart/form-data)
- file: Blob (image), folderId: string
- optional: weddingCode, uploaderName
- returns: `{ id, name, webViewLink? }`

## Own Drive (S3/R2)
Use presigned uploads:
- `POST /sign-upload` → returns `{ uploadUrl, key }`
- Frontend PUTs the file to `uploadUrl`
- Serve via CDN: `https://cdn.pixdrop.cloud/{key}`
