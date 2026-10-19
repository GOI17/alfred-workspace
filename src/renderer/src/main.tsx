import { createRoot } from 'react-dom/client'
import { App } from './app'
import './assets/main.css'

const root = document.getElementById('root')
if (!root) throw new Error('Alfred root container was not found.')
createRoot(root).render(<App />)
