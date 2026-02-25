import { google } from "googleapis";

/**
 * Parse a PEM private key from environment variable format.
 * Handles surrounding quotes and literal \n sequences.
 */
export function parsePrivateKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let key = raw;
  // Strip surrounding quotes if present (env files sometimes double-quote values)
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  // Replace literal \n sequences with real newlines
  key = key.replace(/\\n/g, "\n");
  return key;
}

/**
 * Create a GoogleAuth client with the service account credentials.
 * Accepts an array of scopes so the same service account can be used
 * for Sheets, Drive, or any other Google API.
 */
export function getGoogleAuthClient(scopes: string[]) {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: parsePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
    },
    scopes,
  });
}
