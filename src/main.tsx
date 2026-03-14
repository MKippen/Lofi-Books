import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import {
  EventType,
  type AuthenticationResult,
} from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import { loginRequest } from './auth/msalConfig'
import { msalInstance } from './auth/msalInstance'
import { hasUsableAccountIdentity } from './auth/account'
import App from './App'
import './index.css'

// Show a loading indicator while MSAL initializes
const root = ReactDOM.createRoot(document.getElementById('root')!);

function clearMsalCache() {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('msal.') || key.includes('msal')) localStorage.removeItem(key);
  });
  sessionStorage.clear();
}

function renderLoginFallback() {
  root.render(
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, background: '#f8f4ee' }}>
      <div style={{ textAlign: 'center', maxWidth: 420, background: 'white', padding: 32, borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
        <h1 style={{ color: '#6e5a7f', marginBottom: 8 }}>Lofi Books</h1>
        <p style={{ color: '#666', marginBottom: 20 }}>Sign in with your Microsoft account to access your books and OneDrive backup.</p>
        <button
          onClick={() => {
            msalInstance.loginRedirect(loginRequest).catch((error) => {
              console.error('Login failed:', error);
            });
          }}
          style={{ padding: '10px 20px', background: '#8B7EC8', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}
        >
          Sign in with Microsoft
        </button>
        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => {
              clearMsalCache();
              window.location.reload();
            }}
            style={{ padding: '8px 16px', background: 'transparent', color: '#6e5a7f', border: '1px solid #d7cfe3', borderRadius: 10, cursor: 'pointer' }}
          >
            Clear cache and retry
          </button>
        </div>
      </div>
    </div>
  );
}

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
    const isBypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

    if (response && hasUsableAccountIdentity(response.account)) {
      msalInstance.setActiveAccount(response.account);
    } else {
      const account = msalInstance.getAllAccounts().find(hasUsableAccountIdentity);
      if (account) {
        msalInstance.setActiveAccount(account);
      }
    }

    const activeAccount = msalInstance.getActiveAccount();

    if (!isBypassAuth && !hasUsableAccountIdentity(activeAccount)) {
      const hasAnyAccounts = msalInstance.getAllAccounts().length > 0;
      if (hasAnyAccounts) {
        clearMsalCache();
      }
      renderLoginFallback();
      return;
    }

    // Listen for login success
    msalInstance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
        const result = event.payload as AuthenticationResult;
        if (hasUsableAccountIdentity(result.account)) {
          msalInstance.setActiveAccount(result.account);
        }
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
      clearMsalCache();
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
              clearMsalCache();
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
