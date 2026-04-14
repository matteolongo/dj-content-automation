import { google } from 'googleapis';
import {
  AssetPreview,
  AssetRecord,
  ReviewContext,
  ReviewDraft,
  ReviewPayload,
  SheetRow,
  WeekSummary
} from '@/lib/types';
import { getConfig } from '@/lib/env';
import { createGoogleAuthClient } from '@/lib/google';

const REVIEW_STATUS_VALUES = ['pending', 'approved', 'needs_changes', 'rejected'];

type ParsedSheet = {
  headers: string[];
  rows: Array<{
    rowNumber: number;
    values: SheetRow;
  }>;
};

function createSheetsClient() {
  const auth = createGoogleAuthClient();
  return google.sheets({ version: 'v4', auth });
}

function normalizeCellValue(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  return String(value);
}

function columnToLetter(columnNumber: number) {
  let dividend = columnNumber;
  let columnLetter = '';

  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnLetter = String.fromCharCode(65 + modulo) + columnLetter;
    dividend = Math.floor((dividend - modulo) / 26);
  }

  return columnLetter;
}

function parseTable(values: unknown[][] | undefined): ParsedSheet {
  if (!values || values.length === 0) {
    return { headers: [], rows: [] };
  }

  const [rawHeaders, ...rawRows] = values;
  const headers = rawHeaders.map((header, index) => {
    const normalized = normalizeCellValue(header);
    return normalized || `column_${index + 1}`;
  });

  const rows = rawRows.map((row, index) => {
    const valuesObject: SheetRow = {};

    headers.forEach((header, headerIndex) => {
      valuesObject[header] = normalizeCellValue(row?.[headerIndex]);
    });

    return {
      rowNumber: index + 2,
      values: valuesObject
    };
  });

  return { headers, rows };
}

async function readSheet(sheetName: string) {
  const config = getConfig();
  const sheets = createSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${sheetName}!A:ZZ`,
    majorDimension: 'ROWS'
  });

  return parseTable(response.data.values as unknown[][] | undefined);
}

function splitCsvValue(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function toReviewDraft(values: SheetRow): ReviewDraft {
  return {
    draft_id: normalizeCellValue(values.draft_id),
    week_id: normalizeCellValue(values.week_id),
    post_number: normalizeCellValue(values.post_number),
    content_type: normalizeCellValue(values.content_type),
    caption: normalizeCellValue(values.caption),
    hashtags: normalizeCellValue(values.hashtags),
    asset_ids: normalizeCellValue(values.asset_ids),
    approval_status: normalizeCellValue(values.approval_status) || 'pending',
    scheduled_date: normalizeCellValue(values.scheduled_date),
    scheduled_time: normalizeCellValue(values.scheduled_time),
    platform: normalizeCellValue(values.platform),
    notes: normalizeCellValue(values.notes)
  };
}

function toAssetRecord(values: SheetRow): AssetRecord {
  return {
    asset_id: normalizeCellValue(values.asset_id),
    week_id: normalizeCellValue(values.week_id),
    file_url: normalizeCellValue(values.file_url),
    asset_type: normalizeCellValue(values.asset_type),
    file_name: normalizeCellValue(values.file_name),
    file_extension: normalizeCellValue(values.file_extension),
    file_size: normalizeCellValue(values.file_size),
    mime_type: normalizeCellValue(values.mime_type),
    source: normalizeCellValue(values.source)
  };
}

function resolveAssetUrl(asset: AssetRecord) {
  if (asset.asset_id) {
    return `/api/assets/${encodeURIComponent(asset.asset_id)}`;
  }

  if (asset.file_url && !asset.file_url.includes('drive.google.com')) {
    return asset.file_url;
  }

  return '';
}

function compareDrafts(a: ReviewDraft, b: ReviewDraft) {
  const aNumber = Number(a.post_number);
  const bNumber = Number(b.post_number);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber) && aNumber !== bNumber) {
    return aNumber - bNumber;
  }

  return a.post_number.localeCompare(b.post_number);
}

function summarizeWeeks(rows: Array<{ values: SheetRow }>) {
  const summaryMap = new Map<string, WeekSummary>();

  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    const weekId = normalizeCellValue(row.values.week_id);

    if (!weekId) {
      continue;
    }

    if (!summaryMap.has(weekId)) {
      summaryMap.set(weekId, {
        week_id: weekId,
        total: 0,
        pending: 0,
        approved: 0,
        needs_changes: 0,
        rejected: 0
      });
    }

    const summary = summaryMap.get(weekId)!;
    summary.total += 1;

    const status = normalizeCellValue(row.values.approval_status).toLowerCase();

    if (status === 'approved') {
      summary.approved += 1;
    } else if (status === 'needs_changes') {
      summary.needs_changes += 1;
    } else if (status === 'rejected') {
      summary.rejected += 1;
    } else {
      summary.pending += 1;
    }
  }

  return Array.from(summaryMap.values());
}

function pickSelectedWeekId(weeks: WeekSummary[], requestedWeekId?: string | null) {
  if (requestedWeekId && weeks.some((week) => week.week_id === requestedWeekId)) {
    return requestedWeekId;
  }

  return weeks[0]?.week_id ?? '';
}

async function loadAssetsMap() {
  const config = getConfig();
  const parsedAssets = await readSheet(config.assetsSheetName);
  const map = new Map<string, AssetRecord>();

  for (const row of parsedAssets.rows) {
    const asset = toAssetRecord(row.values);
    if (asset.asset_id) {
      map.set(asset.asset_id, asset);
    }
  }

  return map;
}

function buildAssetPreviews(assetIds: string, assetMap: Map<string, AssetRecord>): AssetPreview[] {
  const resolvedIds = splitCsvValue(assetIds);

  return resolvedIds.map((assetId) => {
    const asset = assetMap.get(assetId);

    if (asset) {
      return {
        ...asset,
        resolved_url: resolveAssetUrl(asset)
      };
    }

    return {
      asset_id: assetId,
      week_id: '',
      file_url: '',
      asset_type: 'unknown',
      file_name: '',
      file_extension: '',
      file_size: '',
      mime_type: '',
      source: '',
      resolved_url: `/api/assets/${encodeURIComponent(assetId)}`
    };
  });
}

async function loadReviewRows() {
  const config = getConfig();
  const parsedReviewQueue = await readSheet(config.reviewQueueSheetName);
  return parsedReviewQueue.rows;
}

export async function loadReviewContext(requestedWeekId?: string | null): Promise<ReviewContext> {
  const [reviewRows, assetMap] = await Promise.all([loadReviewRows(), loadAssetsMap()]);
  const weeks = summarizeWeeks(reviewRows);
  const selectedWeekId = pickSelectedWeekId(weeks, requestedWeekId);

  const drafts = reviewRows
    .map((row) => toReviewDraft(row.values))
    .filter((draft) => !selectedWeekId || draft.week_id === selectedWeekId)
    .sort(compareDrafts)
    .map((draft) => ({
      ...draft,
      assets: buildAssetPreviews(draft.asset_ids, assetMap)
    }));

  return {
    weeks,
    selectedWeekId,
    drafts
  };
}

export async function loadReviewDraftById(draftId: string) {
  const [reviewRows, assetMap] = await Promise.all([loadReviewRows(), loadAssetsMap()]);
  const row = reviewRows.find((candidate) => normalizeCellValue(candidate.values.draft_id) === draftId);

  if (!row) {
    return null;
  }

  const draft = toReviewDraft(row.values);

  return {
    ...draft,
    assets: buildAssetPreviews(draft.asset_ids, assetMap)
  };
}

export async function updateReviewDraft(draftId: string, payload: ReviewPayload) {
  const config = getConfig();
  const sheets = createSheetsClient();
  const parsedReviewQueue = await readSheet(config.reviewQueueSheetName);
  const targetRow = parsedReviewQueue.rows.find((row) => normalizeCellValue(row.values.draft_id) === draftId);

  if (!targetRow) {
    return null;
  }

  const editableRecord: Record<string, string> = {
    ...targetRow.values,
    caption: payload.caption.trim(),
    hashtags: payload.hashtags.trim(),
    scheduled_date: payload.scheduled_date.trim(),
    scheduled_time: payload.scheduled_time.trim(),
    platform: payload.platform.trim(),
    notes: payload.notes.trim(),
    approval_status: REVIEW_STATUS_VALUES.includes(payload.approval_status.trim())
      ? payload.approval_status.trim()
      : 'pending'
  };

  const rowValues = parsedReviewQueue.headers.map((header) => editableRecord[header] ?? '');
  const endColumn = columnToLetter(parsedReviewQueue.headers.length);
  const range = `${config.reviewQueueSheetName}!A${targetRow.rowNumber}:${endColumn}${targetRow.rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [rowValues]
    }
  });

  return loadReviewDraftById(draftId);
}
