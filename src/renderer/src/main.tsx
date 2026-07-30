import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './assets/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="app-drag-region fixed inset-x-0 top-0 z-50 h-10" />
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
