import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#fff', color: '#17281e', border: '1px solid #dce5dd' },
          success: { iconTheme: { primary: '#06452b', secondary: '#fff' } },
          error: { iconTheme: { primary: '#c33b35', secondary: '#fff' } },
        }}
      />
    </AuthProvider>
  </StrictMode>,
);