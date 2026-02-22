import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import {
  PublicClientApplication,
  EventType,
  type AuthenticationResult,
} from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { msalConfig } from './auth/msalConfig'
import App from './App'
import './index.css'

const msalInstance = new PublicClientApplication(msalConfig);

// Show a loading indicator while MSAL initializes
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '4px solid #ddd', borderTopColor: '#8B7EC8',
        animation: 'spin 1s linear infinite', margin: '0 auto 16px'
      }} />
      <p style={{ color: '#666', fontSize: 14 }}>Loading...</p>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

msalInstance
  .initialize()
  .then(() => msalInstance.handleRedirectPromise())
  .then((response) => {
    if (response) {
      msalInstance.setActiveAccount(response.account);
    } else {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        msalInstance.setActiveAccount(accounts[0]);
      }
    }

    // Listen for login success
    msalInstance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
        const result = event.payload as AuthenticationResult;
        msalInstance.setActiveAccount(result.account);
      }
    });

    // Render the app
    root.render(
      <React.StrictMode>
        <MsalProvider instance={msalInstance}>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <App />
          </BrowserRouter>
        </MsalProvider>
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    console.error('MSAL init error:', err);
    const msg = err instanceof Error ? err.message : String(err);

    // Auto-clear stale cache errors
    if (msg.includes('no_token_request_cache_error') || msg.includes('interaction_in_progress')) {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('msal.') || key.includes('msal')) localStorage.removeItem(key);
      });
      sessionStorage.clear();
      window.location.reload();
      return;
    }

    root.render(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', maxWidth: 400, padding: 24 }}>
          <h2 style={{ color: '#333', marginBottom: 8 }}>Startup Error</h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>{msg}</p>
          <button
            onClick={() => {
              Object.keys(localStorage).forEach((key) => {
                if (key.startsWith('msal.') || key.includes('msal')) localStorage.removeItem(key);
              });
              sessionStorage.clear();
              window.location.reload();
            }}
            style={{ padding: '8px 24px', background: '#8B7EC8', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Clear Cache &amp; Retry
          </button>
        </div>
      </div>
    );
  });

export { msalInstance };
