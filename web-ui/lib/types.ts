export type SheetRow = Record<string, string>;

export interface ReviewDraft {
  draft_id: string;
  week_id: string;
  post_number: string;
  content_type: string;
  caption: string;
  hashtags: string;
  asset_ids: string;
  approval_status: string;
  scheduled_date: string;
  scheduled_time: string;
  platform: string;
  notes: string;
}

export interface AssetRecord {
  asset_id: string;
  week_id: string;
  file_url: string;
  asset_type: string;
  file_name: string;
  file_extension: string;
  file_size: string;
  mime_type: string;
  source: string;
}

export interface AssetPreview extends AssetRecord {
  resolved_url: string;
}

export interface WeekSummary {
  week_id: string;
  total: number;
  pending: number;
  approved: number;
  needs_changes: number;
  rejected: number;
}

export interface ReviewPayload {
  caption: string;
  hashtags: string;
  scheduled_date: string;
  scheduled_time: string;
  platform: string;
  notes: string;
  approval_status: string;
}

export interface ReviewContext {
  weeks: WeekSummary[];
  selectedWeekId: string;
  drafts: Array<ReviewDraft & { assets: AssetPreview[] }>;
}
