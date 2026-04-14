import 'server-only';

import { google } from 'googleapis';
import { getConfig } from '@/lib/env';

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly'
];

export function createGoogleAuthClient() {
  const config = getConfig();

  return new google.auth.JWT(
    config.serviceAccountEmail,
    undefined,
    config.privateKey,
    GOOGLE_SCOPES
  );
}

