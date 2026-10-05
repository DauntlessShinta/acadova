import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import './index.css'
import App from './App.jsx'
import { ConfirmProvider } from './context/ConfirmContext'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider><ConfirmProvider><App /></ConfirmProvider></ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
