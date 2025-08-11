import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Admin from './Admin'
import './styles.css'
import { Toaster } from 'sonner'

const path = window.location.pathname
const Page = path.startsWith('/admin') ? Admin : App

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Page />
    <Toaster position="top-center" richColors />
  </React.StrictMode>
)
