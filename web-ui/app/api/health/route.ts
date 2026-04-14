import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const required = [
    'GOOGLE_SHEET_ID',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY'
  ];

  const missing = required.filter((name) => !process.env[name]);

  return NextResponse.json({
    ok: missing.length === 0,
    missing
  });
}
