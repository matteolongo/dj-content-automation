import { NextRequest, NextResponse } from 'next/server';
import { regenerateDraft } from '@/lib/workflow-engine';
import { loadReviewDraftById } from '@/lib/sheets';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await params;
    const body = (await request.json()) as { notes?: string; week_id?: string };
    const notes = typeof body.notes === 'string' ? body.notes : '';
    const weekId = typeof body.week_id === 'string' ? body.week_id.trim() : '';

    if (!weekId) {
      return NextResponse.json({ error: 'week_id is required' }, { status: 400 });
    }

    await regenerateDraft(draftId, weekId, notes);

    const draft = await loadReviewDraftById(draftId);

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found after regeneration' }, { status: 404 });
    }

    return NextResponse.json({ draft }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
