'use client';

import { useEffect, useRef, useState } from 'react';
import type { WorkflowKey, WorkflowRunRecord } from '@/lib/types';

const WORKFLOW_OPTIONS: Array<{
  key: WorkflowKey;
  label: string;
  description: string;
  needsTrendText?: boolean;
}> = [
  {
    key: 'weekly_strategy',
    label: 'Weekly strategy',
    description: 'Build the theme and asset request from the trend note.',
    needsTrendText: true
  },
  {
    key: 'asset_intake',
    label: 'Asset intake',
    description: 'Pull new files from the weekly Drive folder.'
  },
  {
    key: 'content_generation',
    label: 'Content generation',
    description: 'Generate 3 drafts from the weekly plan and available assets.'
  },
  {
    key: 'populate_review_queue',
    label: 'Populate review queue',
    description: 'Copy the generated drafts into the editable review tab.'
  },
  {
    key: 'ready_to_schedule',
    label: 'Ready to schedule',
    description: 'Build a final handoff preview for all approved posts.'
  },
  {
    key: 'full_pipeline',
    label: 'Run full pipeline',
    description: 'Strategy → asset intake → content generation → review queue.',
    needsTrendText: true
  }
];

const REFRESH_WORKFLOWS = new Set<WorkflowKey>([
  'content_generation',
  'populate_review_queue',
  'full_pipeline'
]);

function defaultWeekId() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid'
  }).format(new Date());
}

function formatTime(value: string) {
  if (!value) {
    return 'just now';
  }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    default:
      return 'Queued';
  }
}

function statusClass(status: string) {
  switch (status) {
    case 'running':
      return 'pill pill-warn';
    case 'completed':
      return 'pill pill-approved';
    case 'failed':
      return 'pill pill-reject';
    default:
      return 'pill pill-pending';
  }
}

export function WorkflowLauncher() {
  const [weekId, setWeekId] = useState(defaultWeekId);
  const [trendWhat, setTrendWhat] = useState('');
  const [trendWhy, setTrendWhy] = useState('');
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<WorkflowKey | ''>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const seenStatusesRef = useRef(new Map<string, string>());
  const hasLoadedOnceRef = useRef(false);

  async function loadRuns() {
    try {
      const response = await fetch('/api/workflow-runs', {
        cache: 'no-store'
      });
      const data = (await response.json()) as { runs?: WorkflowRunRecord[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load workflow runs');
      }

      const nextRuns = data.runs ?? [];
      const previousStatuses = seenStatusesRef.current;
      const nextStatuses = new Map<string, string>();
      const shouldDispatchRefreshEvents = hasLoadedOnceRef.current;

      for (const run of nextRuns) {
        nextStatuses.set(run.run_id, run.status);

        const previousStatus = previousStatuses.get(run.run_id);
        if (
          shouldDispatchRefreshEvents &&
          previousStatus !== 'completed' &&
          run.status === 'completed' &&
          REFRESH_WORKFLOWS.has(run.workflow_key)
        ) {
          window.dispatchEvent(
            new CustomEvent('workflow-run-complete', {
              detail: {
                workflowKey: run.workflow_key,
                weekId: run.week_id,
                runId: run.run_id
              }
            })
          );
          setMessage(`Refreshed latest drafts for ${run.week_id}.`);
        }
      }

      seenStatusesRef.current = nextStatuses;
      hasLoadedOnceRef.current = true;
      setRuns(nextRuns);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load workflow runs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRuns();
    const interval = window.setInterval(() => {
      void loadRuns();
    }, 4000);

    return () => window.clearInterval(interval);
  }, []);

  async function startRun(workflowKey: WorkflowKey) {
    const workflow = WORKFLOW_OPTIONS.find((option) => option.key === workflowKey);

    if (workflow?.needsTrendText && !trendWhat.trim()) {
      setError('Trend text is required for Weekly Strategy and the Full Pipeline.');
      return;
    }

    setSubmitting(workflowKey);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/workflows/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workflow_key: workflowKey,
          week_id: weekId.trim(),
          trend_text: trendWhat.trim()
            ? [
                `What's trending: ${trendWhat.trim()}`,
                trendWhy.trim() ? `Why it fits this artist: ${trendWhy.trim()}` : ''
              ]
                .filter(Boolean)
                .join('\n\n')
            : ''
        })
      });

      const data = (await response.json()) as { run?: WorkflowRunRecord; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to start workflow run');
      }

      const run = data.run;
      if (run?.week_id) {
        setWeekId(run.week_id);
      }

      setMessage(`${workflow?.label ?? workflowKey} started for ${run?.week_id ?? weekId}.`);
      await loadRuns();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Failed to start workflow run');
    } finally {
      setSubmitting('');
    }
  }

  const recentRuns = runs.slice(0, 6);
  const runningRun = runs.find((run) => run.status === 'running' || run.status === 'queued');

  return (
    <section className="launcher">
      <div className="launcher-header">
        <div className="launcher-title">
          <p className="eyebrow">Workflow console</p>
          <h2>Run the weekly pipeline.</h2>
        </div>

        <div className="hero-note launcher-note">
          <strong>Current week</strong>
          <span>{weekId}</span>
          <strong>Active run</strong>
          <span>{runningRun ? `${statusLabel(runningRun.status)} · ${runningRun.workflow_key}` : 'Idle'}</span>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      <div className="launcher-grid">
        <div className="launcher-panel">
          <div className="panel-header">
            <div>
              <h3>Inputs</h3>
              <p>Shared across all workflow steps.</p>
            </div>
          </div>

          <div className="editor-form launcher-form">
            <div className="trend-input-block">
              <p className="trend-block-label">
                Trend input
                <em className="trend-required">Required for strategy steps</em>
              </p>
              <label>
                <span>What&apos;s trending this week</span>
                <textarea
                  rows={3}
                  value={trendWhat}
                  placeholder="e.g. slow-burn hypnotic sets, lo-fi club footage, crowd-less atmosphere shots…"
                  onChange={(event) => setTrendWhat(event.target.value)}
                />
              </label>
              <label>
                <span>Why it fits this artist <em className="field-optional">(optional)</em></span>
                <textarea
                  rows={2}
                  value={trendWhy}
                  placeholder="e.g. aligns with the dark minimal direction, contrasts the usual polished DJ aesthetic…"
                  onChange={(event) => setTrendWhy(event.target.value)}
                />
              </label>
            </div>

            <label>
              <span>Week ID</span>
              <input value={weekId} onChange={(event) => setWeekId(event.target.value)} />
            </label>
          </div>
        </div>

        <div className="launcher-panel">
          <div className="panel-header">
            <div>
              <h3>Workflow actions</h3>
              <p>Each button starts a tracked run and updates Sheets.</p>
            </div>
          </div>

          <div className="workflow-button-grid">
            {WORKFLOW_OPTIONS.map((workflow) => (
              <button
                key={workflow.key}
                type="button"
                className={`workflow-button ${workflow.key === 'full_pipeline' ? 'workflow-button-primary' : ''}`}
                onClick={() => void startRun(workflow.key)}
                disabled={Boolean(submitting)}
              >
                <strong>{submitting === workflow.key ? 'Starting…' : workflow.label}</strong>
                <span>{workflow.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="launcher-panel launcher-runs-panel">
          <div className="panel-header">
            <div>
              <h3>Recent runs</h3>
              <p>{loading ? 'Loading…' : `${recentRuns.length} most recent`}</p>
            </div>
          </div>

          <div className="run-list">
            {recentRuns.length === 0 && !loading ? (
              <div className="panel-placeholder">No tracked runs yet.</div>
            ) : null}

            {recentRuns.map((run) => (
              <article key={run.run_id} className="run-card">
                <div className="run-card-top">
                  <div>
                    <p className="draft-meta">
                      {run.workflow_key} · {run.week_id}
                    </p>
                    <h4>{formatTime(run.started_at)}</h4>
                  </div>
                  <span className={statusClass(run.status)}>{statusLabel(run.status)}</span>
                </div>

                <p className="run-summary">{run.output_summary || 'No summary yet.'}</p>

                {run.error_message ? <p className="run-error">{run.error_message}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
