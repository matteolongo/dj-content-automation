'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AssetPreview, ReviewContext, ReviewDraft, WeekSummary } from '@/lib/types';

type DraftFormState = {
  caption: string;
  hashtags: string;
  scheduled_date: string;
  scheduled_time: string;
  platform: string;
  notes: string;
  approval_status: string;
};

const DEFAULT_FORM: DraftFormState = {
  caption: '',
  hashtags: '',
  scheduled_date: '',
  scheduled_time: '',
  platform: '',
  notes: '',
  approval_status: 'pending'
};

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
  return asset.resolved_url || asset.file_url;
}

function toFormState(draft?: ReviewDraft | null): DraftFormState {
  if (!draft) {
    return DEFAULT_FORM;
  }

  return {
    caption: draft.caption ?? '',
    hashtags: draft.hashtags ?? '',
    scheduled_date: draft.scheduled_date ?? '',
    scheduled_time: draft.scheduled_time ?? '',
    platform: draft.platform ?? '',
    notes: draft.notes ?? '',
    approval_status: draft.approval_status || 'pending'
  };
}

export function ReviewBoard() {
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState('');
  const [drafts, setDrafts] = useState<ReviewContext['drafts']>([]);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [form, setForm] = useState<DraftFormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.draft_id === selectedDraftId) ?? null,
    [drafts, selectedDraftId]
  );

  async function loadContext(weekId?: string) {
    setLoading(true);
    setError('');

    try {
      const url = weekId ? `/api/review-queue?week_id=${encodeURIComponent(weekId)}` : '/api/review-queue';
      const response = await fetch(url, { cache: 'no-store' });
      const data = (await response.json()) as ReviewContext & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to load review queue');
      }

      setWeeks(data.weeks ?? []);
      setSelectedWeekId(data.selectedWeekId ?? '');
      setDrafts(data.drafts ?? []);
      setSelectedDraftId((data.drafts?.[0]?.draft_id as string) ?? '');
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
                      <p className="draft-meta">
                        Post {draft.post_number || '—'} · {draft.content_type || 'Draft'}
                      </p>
                      <h3>{draft.draft_id}</h3>
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
                      <img src={previewImage(cover)} alt={cover.file_name || draft.draft_id} />
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
                      <img src={previewImage(asset)} alt={asset.file_name || asset.asset_id} />
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
                <label>
                  <span>Caption</span>
                  <textarea
                    rows={8}
                    value={form.caption}
                    onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))}
                  />
                </label>

                <div className="split-row">
                  <label>
                    <span>Hashtags</span>
                    <textarea
                      rows={6}
                      value={form.hashtags}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, hashtags: event.target.value }))
                      }
                    />
                  </label>

                  <label>
                    <span>Notes</span>
                    <textarea
                      rows={6}
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
                  <label>
                    <span>Platform</span>
                    <input
                      type="text"
                      value={form.platform}
                      placeholder="instagram,tiktok"
                      onChange={(event) =>
                        setForm((current) => ({ ...current, platform: event.target.value }))
                      }
                    />
                  </label>

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
                  <button type="button" className="primary-button" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save to review_queue'}
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
