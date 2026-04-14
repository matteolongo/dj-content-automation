import { NextRequest, NextResponse } from 'next/server';
import { loadReviewDraftById, updateReviewDraft } from '@/lib/sheets';
import { ReviewPayload } from '@/lib/types';

export const runtime = 'nodejs';

function isReviewPayload(value: unknown): value is ReviewPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const requiredKeys: Array<keyof ReviewPayload> = [
    'caption',
    'tiktok_caption',
    'hashtags',
    'scheduled_date',
    'scheduled_time',
    'platform',
    'notes',
    'approval_status'
  ];

  return requiredKeys.every((key) => typeof candidate[key] === 'string');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await params;
    const draft = await loadReviewDraftById(draftId);

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  try {
    const { draftId } = await params;
    const body = await request.json();

    if (!isReviewPayload(body)) {
      return NextResponse.json(
        { error: 'Invalid payload. Expected editable draft fields.' },
        { status: 400 }
      );
    }

    const updatedDraft = await updateReviewDraft(draftId, body);

    if (!updatedDraft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    return NextResponse.json({ draft: updatedDraft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
