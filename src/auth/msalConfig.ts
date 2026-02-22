import { type Configuration, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_MSAL_CLIENT_ID || '',
    authority: import.meta.env.VITE_MSAL_AUTHORITY || 'https://login.microsoftonline.com/common',
    redirectUri: window.location.origin + import.meta.env.BASE_URL,
    postLogoutRedirectUri: window.location.origin + import.meta.env.BASE_URL,
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
