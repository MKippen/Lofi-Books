import { type ReactNode, useEffect, useState } from 'react';
import {
  PublicClientApplication,
  EventType,
  type EventMessage,
  type AuthenticationResult,
} from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './msalConfig';

// Create the MSAL instance ONCE, outside React render cycle
// msal-react's MsalProvider handles initialization internally
const msalInstance = new PublicClientApplication(msalConfig);

interface AuthProviderProps {
  children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize and handle any redirect response
    msalInstance
      .initialize()
      .then(() => {
        // Handle redirect promise AFTER initialization
        return msalInstance.handleRedirectPromise();
      })
      .then((response) => {
        if (response) {
          msalInstance.setActiveAccount(response.account);
        } else {
          const accounts = msalInstance.getAllAccounts();
          if (accounts.length > 0) {
            msalInstance.setActiveAccount(accounts[0]);
          }
        }
        setIsReady(true);
      })
      .catch((err) => {
        console.error('MSAL init error:', err);
        // On error, clear all MSAL cache and try once more
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (errorMsg.includes('no_token_request_cache_error') || errorMsg.includes('interaction_in_progress')) {
          // Stale cache — auto-clear and retry
          console.log('[AuthProvider] Clearing stale MSAL cache and retrying...');
          Object.keys(localStorage).forEach((key) => {
            if (key.startsWith('msal.') || key.includes('msal')) {
              localStorage.removeItem(key);
            }
          });
          Object.keys(sessionStorage).forEach((key) => {
            if (key.startsWith('msal.') || key.includes('msal')) {
              sessionStorage.removeItem(key);
            }
          });
          window.location.reload();
          return;
        }
        setError(errorMsg);
        setIsReady(true); // Still show error UI rather than infinite spinner
      });

    // Listen for login success events
    const callbackId = msalInstance.addEventCallback((event: EventMessage) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
        const result = event.payload as AuthenticationResult;
        msalInstance.setActiveAccount(result.account);
      }
    });

    return () => {
      if (callbackId) {
        msalInstance.removeEventCallback(callbackId);
      }
    };
  }, []);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-indigo/40 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-cream">
        <div className="bg-surface rounded-2xl shadow-xl border-2 border-secondary/30 p-8 max-w-md text-center">
          <h2 className="font-heading text-xl text-indigo mb-2">
            Authentication Error
          </h2>
          <p className="text-indigo/50 text-sm mb-4">{error}</p>
          <p className="text-indigo/30 text-xs mb-4">
            Check that VITE_MSAL_CLIENT_ID in .env matches your Azure AD App
            Registration, and that{' '}
            <code className="bg-cream px-1 rounded">
              {window.location.origin}
            </code>{' '}
            is added as a SPA redirect URI in Azure Portal.
          </p>
          <button
            type="button"
            onClick={() => {
              Object.keys(localStorage).forEach((key) => {
                if (key.startsWith('msal.') || key.includes('msal')) {
                  localStorage.removeItem(key);
                }
              });
              sessionStorage.clear();
              window.location.reload();
            }}
            className="px-4 py-2 rounded-xl bg-primary text-white font-semibold cursor-pointer hover:brightness-110 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      {children}
    </MsalProvider>
  );
}

export { msalInstance };
