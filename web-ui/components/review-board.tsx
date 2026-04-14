'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AssetPreview, ReviewContext, ReviewDraft, WeekSummary } from '@/lib/types';

type DraftFormState = {
  caption: string;
  tiktok_caption: string;
  hashtags: string;
  scheduled_date: string;
  scheduled_time: string;
  platform: string;
  notes: string;
  approval_status: string;
};

const DEFAULT_FORM: DraftFormState = {
  caption: '',
  tiktok_caption: '',
  hashtags: '',
  scheduled_date: '',
  scheduled_time: '',
  platform: '',
  notes: '',
  approval_status: 'pending'
};

const PLATFORMS = ['instagram', 'tiktok'] as const;
const INSTAGRAM_CHAR_LIMIT = 2200;

function parsePlatforms(value: string): Set<string> {
  return new Set(
    value
      .split(',')
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean)
  );
}

function serializePlatforms(platforms: Set<string>): string {
  return Array.from(platforms).join(',');
}

function formatContentType(value: string) {
  if (!value) return 'Draft';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'needs_changes', label: 'Needs changes' },
  { value: 'rejected', label: 'Rejected' }
];

function formatWeekLabel(week: WeekSummary) {
  return `${week.week_id} · ${week.total} drafts`;
}

function statusClass(status: string) {
  switch (status) {
    case 'approved':
      return 'pill pill-approved';
    case 'needs_changes':
      return 'pill pill-warn';
    case 'rejected':
      return 'pill pill-reject';
    default:
      return 'pill pill-pending';
  }
}

function statusLabel(status: string) {
  const normalized = status.trim().toLowerCase();
  const option = STATUS_OPTIONS.find((item) => item.value === normalized);
  return option?.label ?? (status || 'Pending');
}

function previewImage(asset: AssetPreview) {
  if (asset.resolved_url) {
    return asset.resolved_url;
  }

  if (asset.file_url && !asset.file_url.includes('drive.google.com')) {
    return asset.file_url;
  }

  return '';
}

function isEmptyPreview(url: string) {
  return !url.trim();
}

function AssetImage({
  src,
  alt,
  className
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [src]);

  if (isEmptyPreview(src) || broken) {
    return (
      <div className={`asset-fallback ${className ?? ''}`.trim()}>
        <span>Preview unavailable</span>
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} />;
}

function toFormState(draft?: ReviewDraft | null): DraftFormState {
  if (!draft) {
    return DEFAULT_FORM;
  }

  return {
    caption: draft.caption ?? '',
    tiktok_caption: draft.tiktok_caption ?? '',
    hashtags: draft.hashtags ?? '',
    scheduled_date: draft.scheduled_date ?? '',
    scheduled_time: draft.scheduled_time ?? '',
    platform: draft.platform ?? '',
    notes: draft.notes ?? '',
    approval_status: draft.approval_status || 'pending'
  };
}

type WeeklyPlan = {
  theme?: string;
  trend_summary?: string;
  asset_request_message?: string;
  status?: string;
} | null;

export function ReviewBoard() {
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [drafts, setDrafts] = useState<ReviewContext['drafts']>([]);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [form, setForm] = useState<DraftFormState>(DEFAULT_FORM);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.draft_id === selectedDraftId) ?? null,
    [drafts, selectedDraftId]
  );

  async function loadContext(weekId?: string) {
    setLoading(true);
    setError('');
    setWeeklyPlan(null);

    try {
      const url = weekId ? `/api/review-queue?week_id=${encodeURIComponent(weekId)}` : '/api/review-queue';
      const response = await fetch(url, { cache: 'no-store' });
      const data = (await response.json()) as ReviewContext & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load review queue');
      }

      const resolvedWeekId = data.selectedWeekId ?? '';
      setWeeks(data.weeks ?? []);
      setSelectedWeekId(resolvedWeekId);
      setDrafts(data.drafts ?? []);
      setSelectedDraftId((data.drafts?.[0]?.draft_id as string) ?? '');

      if (resolvedWeekId) {
        const planResponse = await fetch(
          `/api/weekly-plan?week_id=${encodeURIComponent(resolvedWeekId)}`,
          { cache: 'no-store' }
        );
        const planData = (await planResponse.json()) as { plan: WeeklyPlan };
        setWeeklyPlan(planData.plan ?? null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load review queue');
      setWeeks([]);
      setDrafts([]);
      setSelectedWeekId('');
      setSelectedDraftId('');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadContext();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ workflowKey: string; weekId: string }>).detail;

      if (!detail?.weekId) {
        return;
      }

      void loadContext(detail.weekId);
    };

    window.addEventListener('workflow-run-complete', handler as EventListener);

    return () => {
      window.removeEventListener('workflow-run-complete', handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!selectedDraft) {
      setForm(DEFAULT_FORM);
      return;
    }

    setForm(toFormState(selectedDraft));
  }, [selectedDraft]);

  const weekSummary = useMemo(() => {
    return drafts.reduce(
      (summary, draft) => {
        summary.total += 1;
        const status = draft.approval_status.trim().toLowerCase();

        if (status === 'approved') {
          summary.approved += 1;
        } else if (status === 'needs_changes') {
          summary.needs_changes += 1;
        } else if (status === 'rejected') {
          summary.rejected += 1;
        } else {
          summary.pending += 1;
        }

        return summary;
      },
      { total: 0, pending: 0, approved: 0, needs_changes: 0, rejected: 0 }
    );
  }, [drafts]);

  async function handleWeekChange(nextWeekId: string) {
    setSelectedWeekId(nextWeekId);
    setSelectedDraftId('');
    await loadContext(nextWeekId);
  }

  async function handleSave() {
    if (!selectedDraft) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/review-queue/${encodeURIComponent(selectedDraft.draft_id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      const data = (await response.json()) as { draft?: ReviewDraft & { assets: AssetPreview[] }; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to save changes');
      }

      if (data.draft) {
        setDrafts((currentDrafts) =>
          currentDrafts.map((draft) =>
            draft.draft_id === data.draft?.draft_id ? data.draft! : draft
          )
        );
        setSelectedDraftId(data.draft.draft_id);
        setForm(toFormState(data.draft));
      }

      setMessage('Saved to review_queue.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    if (!selectedDraft) {
      return;
    }

    setRegenerating(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(
        `/api/review-queue/${encodeURIComponent(selectedDraft.draft_id)}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notes: form.notes, week_id: selectedDraft.week_id })
        }
      );

      const data = (await response.json()) as { draft?: ReviewDraft & { assets: AssetPreview[] }; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to regenerate draft');
      }

      if (data.draft) {
        setDrafts((current) =>
          current.map((d) => (d.draft_id === data.draft?.draft_id ? data.draft! : d))
        );
        setSelectedDraftId(data.draft.draft_id);
        setForm(toFormState(data.draft));
      }

      setMessage('Draft regenerated from notes.');
    } catch (regenError) {
      setError(regenError instanceof Error ? regenError.message : 'Failed to regenerate draft');
    } finally {
      setRegenerating(false);
    }
  }

  const emptyState =
    !loading && weeks.length === 0 ? (
      <div className="empty-state">
        <h3>No review rows found</h3>
        <p>
          Populate <code>review_queue</code> by running the workflow that copies drafts from
          <code>content_drafts</code>.
        </p>
      </div>
    ) : null;

  const selectedDraftAssets = selectedDraft?.assets ?? [];

  return (
    <section className="board">
      <header className="board-toolbar">
        <div>
          <p className="toolbar-label">Selected week</p>
          <select
            className="select"
            value={selectedWeekId}
            onChange={(event) => {
              void handleWeekChange(event.target.value);
            }}
            disabled={loading || weeks.length === 0}
          >
            {weeks.map((week) => (
              <option key={week.week_id} value={week.week_id}>
                {formatWeekLabel(week)}
              </option>
            ))}
          </select>
        </div>

        <div className="summary-row">
          <div className="summary-card">
            <span>Total</span>
            <strong>{weekSummary.total}</strong>
          </div>
          <div className="summary-card">
            <span>Approved</span>
            <strong>{weekSummary.approved}</strong>
          </div>
          <div className="summary-card">
            <span>Pending</span>
            <strong>{weekSummary.pending}</strong>
          </div>
          <div className="summary-card">
            <span>Needs changes</span>
            <strong>{weekSummary.needs_changes}</strong>
          </div>
        </div>
      </header>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {message ? <div className="alert alert-success">{message}</div> : null}

      {emptyState}

      {weeklyPlan?.theme ? (
        <div className="strategy-panel">
          <p className="eyebrow">This week&apos;s strategy</p>
          <p className="strategy-theme">{weeklyPlan.theme}</p>
          {weeklyPlan.trend_summary ? (
            <p className="strategy-trend">{weeklyPlan.trend_summary}</p>
          ) : null}
          {weeklyPlan.asset_request_message ? (
            <p className="strategy-asset-req">
              <strong>Asset request:</strong> {weeklyPlan.asset_request_message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="board-grid">
        <aside className="draft-list-panel">
          <div className="panel-header">
            <h2>Drafts</h2>
            <span>{drafts.length}</span>
          </div>

          <div className="draft-list">
            {loading ? (
              <div className="panel-placeholder">Loading review queue…</div>
            ) : null}

            {!loading && drafts.length === 0 ? (
              <div className="panel-placeholder">No drafts for this week.</div>
            ) : null}

            {drafts.map((draft) => {
              const cover = draft.assets[0];
              const isActive = draft.draft_id === selectedDraftId;

              return (
                <button
                  key={draft.draft_id}
                  type="button"
                  className={`draft-card ${isActive ? 'draft-card-active' : ''}`}
                  onClick={() => setSelectedDraftId(draft.draft_id)}
                >
                  <div className="draft-card-top">
                    <div>
                      <p className="draft-meta">Post {draft.post_number || '—'}</p>
                      <h3>{formatContentType(draft.content_type)}</h3>
                    </div>
                    <span className={statusClass(draft.approval_status)}>
                      {statusLabel(draft.approval_status)}
                    </span>
                  </div>

                  <p className="draft-preview">
                    {draft.caption || 'No caption yet'}
                  </p>

                  {cover ? (
                    <div className="draft-cover">
                      <AssetImage
                        src={previewImage(cover)}
                        alt={cover.file_name || draft.draft_id}
                        className="draft-cover-image"
                      />
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="draft-detail-panel">
          {selectedDraft ? (
            <>
              <div className="panel-header">
                <div>
                  <h2>Draft editor</h2>
                  <p>
                    Week <strong>{selectedDraft.week_id}</strong> · Post{' '}
                    <strong>{selectedDraft.post_number || '—'}</strong>
                  </p>
                </div>
                <span className={statusClass(selectedDraft.approval_status)}>
                  {statusLabel(selectedDraft.approval_status)}
                </span>
              </div>

              <div className="asset-grid">
                {selectedDraftAssets.length > 0 ? (
                  selectedDraftAssets.map((asset) => (
                    <figure key={asset.asset_id} className="asset-card">
                      <AssetImage
                        src={previewImage(asset)}
                        alt={asset.file_name || asset.asset_id}
                        className="asset-card-image"
                      />
                      <figcaption>
                        <strong>{asset.file_name || asset.asset_id}</strong>
                        <span>{asset.asset_type || 'asset'}</span>
                      </figcaption>
                    </figure>
                  ))
                ) : (
                  <div className="panel-placeholder">No linked assets for this draft.</div>
                )}
              </div>

              <div className="editor-form">
                <div>
                  <label>
                    <span>Instagram caption</span>
                    <textarea
                      rows={6}
                      value={form.caption}
                      onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))}
                    />
                  </label>
                  <p className={`char-count ${form.caption.length > INSTAGRAM_CHAR_LIMIT ? 'char-count-over' : ''}`}>
                    {form.caption.length} / {INSTAGRAM_CHAR_LIMIT}
                  </p>
                </div>

                <label>
                  <span>TikTok caption</span>
                  <textarea
                    rows={4}
                    value={form.tiktok_caption}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, tiktok_caption: event.target.value }))
                    }
                  />
                </label>

                <div className="split-row">
                  <label>
                    <span>Hashtags</span>
                    <textarea
                      rows={5}
                      value={form.hashtags}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, hashtags: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    <span>Notes <em className="field-optional">(used for regeneration)</em></span>
                    <textarea
                      rows={5}
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, notes: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <div className="split-row">
                  <label>
                    <span>Scheduled date</span>
                    <input
                      type="date"
                      value={form.scheduled_date}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, scheduled_date: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    <span>Scheduled time</span>
                    <input
                      type="time"
                      value={form.scheduled_time}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, scheduled_time: event.target.value }))
                      }
                    />
                  </label>
                </div>

                <div className="split-row">
                  <div>
                    <p className="editor-form-label">Platforms</p>
                    <div className="platform-checkboxes">
                      {PLATFORMS.map((platform) => {
                        const checked = parsePlatforms(form.platform).has(platform);
                        return (
                          <label key={platform} className="platform-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const platforms = parsePlatforms(form.platform);
                                if (event.target.checked) {
                                  platforms.add(platform);
                                } else {
                                  platforms.delete(platform);
                                }
                                setForm((current) => ({
                                  ...current,
                                  platform: serializePlatforms(platforms)
                                }));
                              }}
                            />
                            {platform.charAt(0).toUpperCase() + platform.slice(1)}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <label>
                    <span>Approval status</span>
                    <select
                      value={form.approval_status}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, approval_status: event.target.value }))
                      }
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleRegenerate}
                    disabled={regenerating || saving}
                    title="Re-run AI generation for this post using the notes field as revision instructions"
                  >
                    {regenerating ? 'Regenerating…' : 'Regenerate from notes'}
                  </button>
                  <button type="button" className="primary-button" onClick={handleSave} disabled={saving || regenerating}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state detail-empty">
              <h3>Select a draft</h3>
              <p>Pick a draft on the left to inspect the generated content and make edits.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
