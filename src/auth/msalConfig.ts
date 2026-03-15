import { type Configuration, LogLevel } from '@azure/msal-browser';

const basePath = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
const defaultRedirectUri = `${window.location.origin}${basePath}`;
const redirectUri = import.meta.env.VITE_MSAL_REDIRECT_URI || defaultRedirectUri;
const postLogoutRedirectUri = import.meta.env.VITE_MSAL_POST_LOGOUT_REDIRECT_URI || redirectUri;

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID || '',
    authority: import.meta.env.VITE_MSAL_AUTHORITY || 'https://login.microsoftonline.com/consumers',
    redirectUri,
    postLogoutRedirectUri,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
    },
  },
};

// Scopes requested at login — User.Read for profile, Files.ReadWrite for OneDrive
export const loginRequest = {
  scopes: ['User.Read', 'Files.ReadWrite'],
};

// Scopes for Graph API calls
export const graphScopes = {
  scopes: ['User.Read', 'Files.ReadWrite'],
};
