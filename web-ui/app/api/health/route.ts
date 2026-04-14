import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const required = [
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY'
  ];
  const executionRequired = ['OPENAI_API_KEY', 'GOOGLE_DRIVE_ASSET_FOLDER_ID'];

  const missing = required.filter((name) => !process.env[name]);
  const executionMissing = executionRequired.filter((name) => !process.env[name]);

  return NextResponse.json({
    ok: missing.length === 0,
    missing,
    executionReady: executionMissing.length === 0,
    executionMissing
  });
}
