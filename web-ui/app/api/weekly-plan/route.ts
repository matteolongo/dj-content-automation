import { NextRequest, NextResponse } from 'next/server';
import { loadWeeklyPlan } from '@/lib/sheets';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const weekId = request.nextUrl.searchParams.get('week_id')?.trim() ?? '';

    if (!weekId) {
      return NextResponse.json({ plan: null }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const plan = await loadWeeklyPlan(weekId);

    return NextResponse.json({ plan }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Missing sheet tab or empty sheet — not a hard error for the UI
    return NextResponse.json({ plan: null }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
