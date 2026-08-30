import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/components/ui/Toast'
import './index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('FraudShield could not mount: #root is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
