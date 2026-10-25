import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './gameplay.css'
import './exchange.css'
import './art-direction.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
