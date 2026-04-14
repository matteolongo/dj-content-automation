import { NextRequest, NextResponse } from 'next/server';
import { loadReviewContext } from '@/lib/sheets';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const requestedWeekId = request.nextUrl.searchParams.get('week_id');
    const context = await loadReviewContext(requestedWeekId);

    return NextResponse.json(context, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
