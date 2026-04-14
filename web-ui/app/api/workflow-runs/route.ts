import { NextResponse } from 'next/server';
import { listWorkflowRunHistory } from '@/lib/workflow-engine';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const runs = await listWorkflowRunHistory();

    return NextResponse.json(
      { runs },
      {
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
