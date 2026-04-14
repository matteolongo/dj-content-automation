import 'server-only';

import { google } from 'googleapis';
import { randomUUID } from 'node:crypto';
import { createGoogleAuthClient } from '@/lib/google';
import { getConfig } from '@/lib/env';
import {
  appendTrendInput,
  appendWorkflowRun,
  loadWorkflowRuns,
  readSheetTable,
  updateWorkflowRun,
  upsertSheetRow
} from '@/lib/sheets';
import type {
  WorkflowKey,
  WorkflowRunRecord,
  WorkflowRunRequest
} from '@/lib/types';

const WORKFLOW_COLUMNS = {
  weekly_plan: ['week_id', 'theme', 'trend_summary', 'asset_request_message', 'status'],
  assets: [
    'asset_id',
    'week_id',
    'file_url',
    'asset_type',
    'source',
    'file_name',
    'file_extension',
    'file_size',
    'mime_type'
  ],
  content_drafts: [
    'draft_id',
    'week_id',
    'post_number',
    'content_type',
    'caption',
    'hashtags',
    'asset_ids',
    'approval_status'
  ],
  review_queue: [
    'draft_id',
    'week_id',
    'post_number',
    'content_type',
    'caption',
    'hashtags',
    'asset_ids',
    'approval_status',
    'scheduled_date',
    'scheduled_time',
    'platform',
    'notes'
  ]
} as const;

type WorkflowProgress = {
  runId: string;
  workflowKey: WorkflowKey;
  weekId: string;
  summary: string;
  lastOutput?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function createWeekId() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid'
  }).format(new Date());
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function truncate(value: string, maxLength = 240) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractOpenAIText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('OpenAI response was empty');
  }

  const response = payload as {
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text) {
        return content.text.trim();
      }
    }
  }

  throw new Error('Could not find output_text in OpenAI response');
}

async function callOpenAIJson(prompt: string) {
  const config = getConfig();

  if (!config.openaiApiKey) {
    throw new Error('Missing required environment variable: OPENAI_API_KEY');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: prompt
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as unknown;
  const text = extractOpenAIText(payload);

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    throw new Error(`Failed to parse model JSON: ${message}\nRaw text:\n${text}`);
  }
}

async function loadBrandProfile() {
  const parsed = await readSheetTable('brand_profile');
  const row = parsed.rows[0]?.values;

  if (!row) {
    throw new Error('No brand_profile row found');
  }

  return row;
}

async function loadLatestTrendText(weekId: string) {
  const config = getConfig();
  const parsed = await readSheetTable(config.trendInputSheetName);
  const matches = parsed.rows
    .map((row) => row.values)
    .filter((row) => normalizeText(row.week_id) === weekId);

  const latest = matches[matches.length - 1];

  return normalizeText(latest?.trend_text);
}

async function saveTrendText(weekId: string, trendText: string) {
  await appendTrendInput({
    week_id: weekId,
    trend_text: trendText,
    source_query: 'ui',
    raw_summary: ''
  });
}

async function resolveTrendText(weekId: string, trendText?: string) {
  const normalizedTrendText = normalizeText(trendText);

  if (normalizedTrendText) {
    await saveTrendText(weekId, normalizedTrendText);
    return normalizedTrendText;
  }

  const existingTrendText = await loadLatestTrendText(weekId);

  if (!existingTrendText) {
    throw new Error(`No trend_text found for week_id=${weekId}`);
  }

  return existingTrendText;
}

async function loadLatestRowByWeekId(sheetName: string, weekId: string) {
  const parsed = await readSheetTable(sheetName);
  const matches = parsed.rows
    .map((row) => row.values)
    .filter((row) => normalizeText(row.week_id) === weekId);

  return matches[matches.length - 1] ?? null;
}

async function loadRowsByWeekId(sheetName: string, weekId: string) {
  const parsed = await readSheetTable(sheetName);

  return parsed.rows
    .map((row) => row.values)
    .filter((row) => normalizeText(row.week_id) === weekId);
}

async function withWorkflowRun(
  initial: WorkflowRunRecord,
  fn: (progress: WorkflowProgress) => Promise<string>
) {
  const running = {
    ...initial,
    status: 'running' as const,
    output_summary: 'Starting workflow',
    error_message: '',
    finished_at: ''
  };

  await updateWorkflowRun(running);

  try {
    const summary = await fn({
      runId: initial.run_id,
      workflowKey: initial.workflow_key,
      weekId: initial.week_id,
      summary: 'Starting workflow'
    });

    const completed = {
      ...running,
      status: 'completed' as const,
      finished_at: nowIso(),
      output_summary: summary,
      error_message: ''
    };

    await updateWorkflowRun(completed);
    return completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const failed = {
      ...running,
      status: 'failed' as const,
      finished_at: nowIso(),
      error_message: message,
      output_summary: truncate(`Failed: ${message}`, 240)
    };

    await updateWorkflowRun(failed);
    return failed;
  }
}

function summarizeAssetCounts(rows: Array<Record<string, string>>) {
  const counts = rows.reduce(
    (accumulator, row) => {
      if (normalizeText(row.asset_type) === 'video') {
        accumulator.video += 1;
      } else if (normalizeText(row.asset_type) === 'photo') {
        accumulator.photo += 1;
      } else {
        accumulator.other += 1;
      }

      return accumulator;
    },
    { photo: 0, video: 0, other: 0 }
  );

  return `Assets ready: ${rows.length} total (${counts.photo} photo, ${counts.video} video, ${counts.other} other)`;
}

function formatDraftSummary(posts: Array<Record<string, unknown>>) {
  return posts
    .map((post) => {
      const postNumber = normalizeText(post.post_number);
      const caption = normalizeText(post.instagram_caption ?? post.caption);
      return `Post ${postNumber || '?'}: ${truncate(caption || 'No caption', 110)}`;
    })
    .join(' | ');
}

async function runWeeklyStrategy(progress: WorkflowProgress, trendText?: string) {
  const brand = await loadBrandProfile();
  const normalizedTrendText = await resolveTrendText(progress.weekId, trendText);

  const prompt = `
You are a senior social media strategist specialized in underground electronic music DJs.

Your task is to generate a weekly content strategy based on the artist identity and current trend signals.

ARTIST PROFILE:
Artist name: ${normalizeText(brand.artist_name)}
Tone: ${normalizeText(brand.tone)}
Colors: ${normalizeText(brand.colors)}
Audience: ${normalizeText(brand.audience)}
Goals: ${normalizeText(brand.goals)}
Anti-patterns: ${normalizeText(brand.anti_patterns)}

INPUT TRENDS:
${normalizedTrendText}

CONSTRAINTS:
- Exactly 3 posts
- English only
- Content must feel underground, elegant, emotional
- No generic ideas
- No meme-based formats
- No content that feels commercial or influencer-like
- Never invent events, crowds, locations, or partnerships
- Focus on authenticity and identity

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "week_theme": "string",
  "trend_fit_summary": "string",
  "content_plan": [
    {
      "post_number": 1,
      "content_type": "raw_club_energy | dj_pov | artistic_identity",
      "goal": "string",
      "required_assets": ["string", "string"]
    },
    {
      "post_number": 2,
      "content_type": "string",
      "goal": "string",
      "required_assets": ["string", "string"]
    },
    {
      "post_number": 3,
      "content_type": "string",
      "goal": "string",
      "required_assets": ["string", "string"]
    }
  ],
  "asset_request_message": "string"
}

IMPORTANT:
- Return ONLY valid JSON
- No markdown
- No explanations
- No comments
`;

  progress.summary = 'Generating weekly strategy';

  const parsed = await callOpenAIJson(prompt);
  const weeklyPlan = {
    week_id: progress.weekId,
    theme: normalizeText(parsed.week_theme),
    trend_summary: normalizeText(parsed.trend_fit_summary),
    asset_request_message: normalizeText(parsed.asset_request_message),
    status: 'waiting_assets'
  };

  await upsertSheetRow(
    'weekly_plan',
    'week_id',
    WORKFLOW_COLUMNS.weekly_plan as unknown as string[],
    weeklyPlan
  );

  const summary = [
    `Weekly theme: ${truncate(weeklyPlan.theme || 'Untitled theme', 100)}`,
    `Trend fit: ${truncate(weeklyPlan.trend_summary || 'No summary', 120)}`,
    `Asset request: ${truncate(weeklyPlan.asset_request_message || 'No request', 120)}`
  ].join(' | ');

  return { summary, weeklyPlan };
}

async function runAssetIntake(progress: WorkflowProgress) {
  const config = getConfig();

  if (!config.driveAssetFolderId) {
    throw new Error('Missing required environment variable: GOOGLE_DRIVE_ASSET_FOLDER_ID');
  }

  const auth = createGoogleAuthClient();
  const drive = google.drive({ version: 'v3', auth });

  const response = await drive.files.list({
    q: `'${config.driveAssetFolderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, size, webViewLink, webContentLink, modifiedTime)',
    pageSize: 1000
  });

  const files = (response.data.files ?? []).filter(
    (file) => normalizeText(file.id) && file.mimeType !== 'application/vnd.google-apps.folder'
  );

  if (files.length === 0) {
    throw new Error(`No assets found in Drive folder ${config.driveAssetFolderId}`);
  }

  const assetRows = files.map((file) => {
    const name = normalizeText(file.name);
    const mimeType = normalizeText(file.mimeType);
    const fileSize = normalizeText(file.size);
    const fileExtension = name.includes('.') ? name.split('.').pop() ?? '' : '';
    let assetType = 'photo';

    if (mimeType.includes('video')) {
      assetType = 'video';
    } else if (!mimeType.includes('image')) {
      const lower = name.toLowerCase();
      if (lower.endsWith('.mp4') || lower.endsWith('.mov') || lower.endsWith('.m4v') || lower.endsWith('.avi')) {
        assetType = 'video';
      } else {
        assetType = 'other';
      }
    }

    return {
      asset_id: normalizeText(file.id),
      week_id: progress.weekId,
      file_url: file.webViewLink || `https://drive.google.com/uc?export=view&id=${normalizeText(file.id)}`,
      asset_type: assetType,
      source: 'drive',
      file_name: name,
      file_extension: fileExtension,
      file_size: fileSize,
      mime_type: mimeType
    };
  });

  for (const row of assetRows) {
    await upsertSheetRow('assets', 'asset_id', WORKFLOW_COLUMNS.assets as unknown as string[], row);
  }

  return {
    summary: summarizeAssetCounts(assetRows),
    assets: assetRows
  };
}

async function runContentGeneration(progress: WorkflowProgress) {
  const weeklyPlan = await loadLatestRowByWeekId('weekly_plan', progress.weekId);

  if (!weeklyPlan) {
    throw new Error(`No weekly_plan row found for week_id=${progress.weekId}`);
  }

  const assets = await loadRowsByWeekId('assets', progress.weekId);

  if (assets.length === 0) {
    throw new Error(`No assets found for week_id=${progress.weekId}`);
  }

  const brand = await loadBrandProfile();
  const prompt = `
You are the content engine for a niche underground electronic DJ brand.

Your job is to generate 3 social posts that feel authentic, distinctive, and aligned with the artist identity.

ARTIST PROFILE:
Artist name: ${normalizeText(brand.artist_name)}
Tone: ${normalizeText(brand.tone)}
Colors: ${normalizeText(brand.colors)}
Audience: ${normalizeText(brand.audience)}
Goals: ${normalizeText(brand.goals)}
Anti-patterns: ${normalizeText(brand.anti_patterns)}

WEEKLY PLAN:
${JSON.stringify(weeklyPlan, null, 2)}

AVAILABLE ASSETS:
${JSON.stringify(assets, null, 2)}

RULES:
- English only
- Generate exactly 3 posts
- Each post must feel unique and intentional
- Keep captions concise and evocative
- Avoid clichés completely
- Never invent facts such as events, crowds, or locations
- Stay grounded in authenticity
- Subtle irony is allowed but must be minimal
- Hashtags must be relevant, not spammy

OUTPUT FORMAT (STRICT JSON):
{
  "posts": [
    {
      "post_number": 1,
      "content_type": "string",
      "asset_ids": ["id1", "id2"],
      "instagram_caption": "string",
      "instagram_short_caption": "string",
      "tiktok_caption": "string",
      "hashtags": ["tag1", "tag2", "tag3"],
      "posting_recommendation": {
        "day": "string",
        "time_window": "string"
      },
      "rationale": "short explanation of why this works"
    },
    {
      "post_number": 2,
      "content_type": "string",
      "asset_ids": ["id1"],
      "instagram_caption": "string",
      "instagram_short_caption": "string",
      "tiktok_caption": "string",
      "hashtags": ["tag1", "tag2", "tag3"],
      "posting_recommendation": {
        "day": "string",
        "time_window": "string"
      },
      "rationale": "short explanation of why this works"
    },
    {
      "post_number": 3,
      "content_type": "string",
      "asset_ids": ["id1"],
      "instagram_caption": "string",
      "instagram_short_caption": "string",
      "tiktok_caption": "string",
      "hashtags": ["tag1", "tag2", "tag3"],
      "posting_recommendation": {
        "day": "string",
        "time_window": "string"
      },
      "rationale": "short explanation of why this works"
    }
  ]
}

IMPORTANT:
- Return ONLY valid JSON
- No markdown
- No explanations
`;

  progress.summary = 'Generating content drafts';

  const parsed = await callOpenAIJson(prompt);
  const posts = Array.isArray(parsed.posts) ? (parsed.posts as Array<Record<string, unknown>>) : [];

  if (posts.length === 0) {
    throw new Error('No posts returned by model');
  }

  const drafts = posts.map((post, index) => {
    const postNumber = Number(post.post_number) || index + 1;
    const assetIds = Array.isArray(post.asset_ids)
      ? (post.asset_ids as unknown[]).map((value: unknown) => normalizeText(value)).filter(Boolean)
      : [];
    const hashtags = Array.isArray(post.hashtags)
      ? (post.hashtags as unknown[]).map((value: unknown) => normalizeText(value)).filter(Boolean)
      : [];

    return {
      draft_id: `${progress.weekId}-post-${postNumber}`,
      week_id: progress.weekId,
      post_number: String(postNumber),
      content_type: normalizeText(post.content_type),
      caption: normalizeText(post.instagram_caption || post.instagram_short_caption || ''),
      hashtags: hashtags.join(', '),
      asset_ids: assetIds.join(', '),
      approval_status: 'pending'
    };
  });

  for (const draft of drafts) {
    await upsertSheetRow(
      'content_drafts',
      'draft_id',
      WORKFLOW_COLUMNS.content_drafts as unknown as string[],
      draft
    );
  }

  const summary = `Generated ${drafts.length} drafts | ${formatDraftSummary(posts)}`;

  return { summary, drafts };
}

async function runPopulateReviewQueue(progress: WorkflowProgress) {
  const drafts = await loadRowsByWeekId('content_drafts', progress.weekId);

  if (drafts.length === 0) {
    throw new Error(`No drafts found for week_id=${progress.weekId}`);
  }

  const reviewRows = drafts.map((draft) => ({
    draft_id: normalizeText(draft.draft_id),
    week_id: normalizeText(draft.week_id),
    post_number: normalizeText(draft.post_number),
    content_type: normalizeText(draft.content_type),
    caption: normalizeText(draft.caption),
    hashtags: normalizeText(draft.hashtags),
    asset_ids: normalizeText(draft.asset_ids),
    approval_status: normalizeText(draft.approval_status) || 'pending',
    scheduled_date: normalizeText(draft.scheduled_date),
    scheduled_time: normalizeText(draft.scheduled_time),
    platform: normalizeText(draft.platform) || 'instagram,tiktok',
    notes: normalizeText(draft.notes)
  }));

  for (const row of reviewRows) {
    await upsertSheetRow(
      'review_queue',
      'draft_id',
      WORKFLOW_COLUMNS.review_queue as unknown as string[],
      row
    );
  }

  return {
    summary: `Copied ${reviewRows.length} drafts into review_queue`
  };
}

async function runReadyToSchedule(progress: WorkflowProgress) {
  const rows = await loadRowsByWeekId('review_queue', progress.weekId);
  const approved = rows.filter(
    (row) => normalizeText(row.approval_status).toLowerCase() === 'approved'
  );

  if (approved.length === 0) {
    throw new Error(`No approved posts found for week_id=${progress.weekId}`);
  }

  const sorted = approved.slice().sort((left, right) => {
    const leftNumber = Number(left.post_number);
    const rightNumber = Number(right.post_number);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return normalizeText(left.post_number).localeCompare(normalizeText(right.post_number));
  });

  const subject = `Approved Posts Ready to Schedule — ${progress.weekId}`;
  const body = sorted
    .map((post) => {
      const assetIds = normalizeText(post.asset_ids)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);

      return [
        `Post ${normalizeText(post.post_number) || '?'}`,
        `Platform: ${normalizeText(post.platform) || 'instagram,tiktok'}`,
        `Scheduled: ${normalizeText(post.scheduled_date) || 'TBD'} ${normalizeText(post.scheduled_time) || ''}`,
        `Caption: ${normalizeText(post.caption) || 'No caption'}`,
        `Hashtags: ${normalizeText(post.hashtags) || 'No hashtags'}`,
        `Assets: ${assetIds.join(', ') || 'None'}`
      ].join(' | ');
    })
    .join('\n');

  return {
    summary: `Ready-to-schedule preview for ${approved.length} approved posts | ${subject}`,
    email_subject: subject,
    email_body: body
  };
}

async function executeWorkflow(progress: WorkflowProgress, request: WorkflowRunRequest) {
  switch (progress.workflowKey) {
    case 'weekly_strategy':
      return runWeeklyStrategy(progress, request.trend_text);
    case 'asset_intake':
      return runAssetIntake(progress);
    case 'content_generation':
      return runContentGeneration(progress);
    case 'populate_review_queue':
      return runPopulateReviewQueue(progress);
    case 'ready_to_schedule':
      return runReadyToSchedule(progress);
    case 'full_pipeline': {
      const weeklyStrategy = await runWeeklyStrategy(progress, request.trend_text);
      const assetIntake = await runAssetIntake(progress);
      const contentGeneration = await runContentGeneration(progress);
      const reviewQueue = await runPopulateReviewQueue(progress);

      return {
        summary: [
          weeklyStrategy.summary,
          assetIntake.summary,
          contentGeneration.summary,
          reviewQueue.summary
        ].join(' || ')
      };
    }
    default:
      throw new Error(`Unsupported workflow key: ${progress.workflowKey}`);
  }
}

export async function startWorkflowRun(request: WorkflowRunRequest) {
  const workflowKey = request.workflow_key;
  const weekId = normalizeText(request.week_id) || createWeekId();
  const runId = randomUUID();
  const initial: WorkflowRunRecord = {
    run_id: runId,
    workflow_key: workflowKey,
    week_id: weekId,
    status: 'queued',
    started_at: nowIso(),
    finished_at: '',
    error_message: '',
    output_summary: 'Queued'
  };

  await appendWorkflowRun(initial);

  void withWorkflowRun(initial, async (progress) => {
    const result = await executeWorkflow(progress, request);
    return truncate(result.summary, 280);
  }).catch(async (error) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await updateWorkflowRun({
      ...initial,
      status: 'failed',
      finished_at: nowIso(),
      error_message: message,
      output_summary: truncate(`Failed: ${message}`, 240)
    });
  });

  return initial;
}

export async function listWorkflowRunHistory() {
  const runs = await loadWorkflowRuns();

  return runs.slice().reverse();
}
