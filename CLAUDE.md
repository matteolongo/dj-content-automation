# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A local-first DJ content automation pipeline. n8n handles workflow orchestration; a Next.js UI (the "review UI") lets you launch workflows, watch run status live, and review/edit generated drafts — without touching Google Sheets directly.

## Running the stack

```bash
# Start everything (n8n + review UI)
docker compose up -d

# Stop
docker compose down
```

- n8n: `http://localhost:5678`
- Review UI: `http://localhost:3000`

Import all workflow JSONs into a running n8n instance:
```bash
bash scripts/import_workflows.sh
```

## Web UI development

The UI lives in `web-ui/` and is a Next.js 15 app (React 19, TypeScript, no test setup).

```bash
cd web-ui
npm install
npm run dev        # dev server on port 3000
npm run build      # production build
```

Required env vars (from `.env` at repo root, loaded by Docker; set manually for local dev):
- `GOOGLE_SHEET_ID` — spreadsheet ID
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — service account email
- `GOOGLE_PRIVATE_KEY` — service account private key (escape `\n` as `\\n` in `.env`)
- `OPENAI_API_KEY` — for content generation
- `GOOGLE_DRIVE_ASSET_FOLDER_ID` — Drive folder for assets

## Architecture

### n8n workflows (`workflows/exports/`)
Six sequential workflows that must be run in order:
1. `weekly_strategy` — reads `brand_profile` + trend text → writes `weekly_plan`
2. `asset_intake` — reads Google Drive folder → writes `assets`
3. `content_generation` — reads `weekly_plan` + `assets` → writes `content_drafts`
4. `send_drafts_for_approval` — sends HTML approval email
5. `populate_review_queue` — copies `content_drafts` → `review_queue`
6. `ready_to_schedule` — emails approved posts with scheduling info

The UI also exposes a `full_pipeline` key that runs workflows 1–5 in sequence.

### Web UI (`web-ui/`)

**Data flow:** All state lives in Google Sheets. The UI has no local DB.

- `lib/sheets.ts` — all Google Sheets reads/writes via `googleapis`. Key operations: `readSheetTable`, `upsertSheetRow`, `appendSheetRow`.
- `lib/workflow-engine.ts` — re-implements the n8n workflows in TypeScript, calls OpenAI Responses API (`gpt-4.1-mini`), writes results to Sheets. Run state is tracked in the `workflow_runs` sheet.
- `lib/google.ts` — creates the Google auth client (service account).
- `lib/env.ts` — typed config via `getConfig()`. All env vars are validated here.
- `lib/types.ts` — shared TypeScript types.

**API routes (`app/api/`):**
- `POST /api/workflows/run` — triggers a workflow run (fire-and-forget; returns `202` immediately)
- `GET /api/workflow-runs` — polls run history from `workflow_runs` sheet
- `GET /api/review-queue` — loads review context (drafts + week summaries)
- `PATCH /api/review-queue/[draftId]` — updates caption, status, scheduling info
- `GET /api/assets/[assetId]` — proxies Google Drive file downloads (avoids CORS/auth issues in browser)

**Components:**
- `WorkflowLauncher` — selects and launches a workflow, polls run status live
- `ReviewBoard` — week selector + draft cards with inline edit

### Google Sheets schema

Each sheet tab is the canonical data store. Key columns by tab:

| Tab | Key column | Purpose |
|-----|-----------|---------|
| `brand_profile` | — | Artist identity, tone, anti-patterns |
| `trends_input` | `week_id` | Manual trend text per week |
| `weekly_plan` | `week_id` | Strategy output |
| `assets` | `asset_id` | Drive file metadata |
| `content_drafts` | `draft_id` | AI-generated post drafts |
| `review_queue` | `draft_id` | Editable drafts for review/approval |
| `workflow_runs` | `run_id` | Run history and status |

`upsertSheetRow` matches on the key column — insert if missing, update if found.

## Workflow/AI constraints (from AGENTS.md)

- AI output must always be **strict JSON** — no markdown, no explanations
- Model: `gpt-4.1-mini` via OpenAI Responses API (`POST /v1/responses`)
- Content tone: underground electronic scene — never generic, never influencer-like, never invented facts (events, crowds, locations)
- Each workflow must be independently executable with no hidden node dependencies
- All persisted data goes to Sheets — no local DB, no caching layer

## Adding or modifying workflows

1. Edit the logic in `lib/workflow-engine.ts` (for the UI runner) **and** the corresponding n8n workflow in n8n UI
2. Export updated workflow JSON from n8n → `workflows/exports/`
3. Document changes in `docs/workflows/`
4. Sheet schema changes require updating `WORKFLOW_COLUMNS` in `workflow-engine.ts`
