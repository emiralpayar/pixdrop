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

## Built-in Backend (Node + Google Drive)
A minimal Express server lives in the `server/` directory. It can upload
files to a Google Drive folder or, if no credentials are provided, fall back
to saving them on the local filesystem.

### Setup
1. Create a Google Cloud service account and enable the Drive API.
2. Share your target Drive folder with the service account and note the
   folder ID.
3. In the `server` directory, create an `.env` file (or export variables) with:
   - `GOOGLE_SERVICE_ACCOUNT` – JSON credentials for the service account.
   - `DRIVE_FOLDER_ID` – ID of the shared Drive folder.
   - `PORT` (optional) – port to listen on.
4. Install deps and start the server:

```
cd server
npm install
npm start
```

Set `VITE_API_BASE` in the frontend to point to this server.

## Own Drive (S3/R2)
Use presigned uploads:
- `POST /sign-upload` → returns `{ uploadUrl, key }`
- Frontend PUTs the file to `uploadUrl`
- Serve via CDN: `https://cdn.pixdrop.cloud/{key}`
