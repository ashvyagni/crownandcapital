import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './gameplay.css'
import './exchange.css'
import './art-direction.css'

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js')

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
