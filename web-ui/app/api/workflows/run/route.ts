import { NextRequest, NextResponse } from 'next/server';
import { startWorkflowRun } from '@/lib/workflow-engine';
import type { WorkflowKey, WorkflowRunRequest } from '@/lib/types';

export const runtime = 'nodejs';

const VALID_WORKFLOW_KEYS = new Set<WorkflowKey>([
  'weekly_strategy',
  'asset_intake',
  'content_generation',
  'populate_review_queue',
  'ready_to_schedule',
  'full_pipeline'
]);

function isWorkflowRunRequest(value: unknown): value is WorkflowRunRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.workflow_key === 'string' && VALID_WORKFLOW_KEYS.has(candidate.workflow_key as WorkflowKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;

    if (!isWorkflowRunRequest(body)) {
      return NextResponse.json(
        { error: 'Invalid payload. Expected workflow_key and optional week_id/trend_text.' },
        { status: 400 }
      );
    }

    const run = await startWorkflowRun(body);

    return NextResponse.json(
      { run },
      {
        status: 202,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
