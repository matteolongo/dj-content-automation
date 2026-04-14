# DJ Content MVP

A local-first n8n project that automates a lightweight weekly content workflow for a DJ brand.

## What it does

This project implements a practical MVP for a DJ content pipeline:

1. generate a weekly content strategy
2. request assets
3. ingest assets from Google Drive
4. generate social post drafts with OpenAI
5. send drafts for approval by email
6. copy approved drafts into a review queue
7. send a ready-to-schedule email for approved posts
8. run the workflows from the UI and watch new drafts appear live
9. review and edit drafts in a dedicated UI instead of Sheets

The current implementation is intentionally simple:

- local n8n via Docker Compose
- Google Sheets as the operational database
- Google Drive as the asset source
- OpenAI Responses API for generation
- email for review and handoff
- manual scheduling for v1

## Repository structure

```text
.
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── web-ui/
│   ├── app/
│   ├── components/
│   └── lib/
├── docs/
│   └── workflows/
│       ├── 01_weekly_strategy.md
│       ├── 02_asset_intake.md
│       ├── 03_content_generation.md
│       ├── 04_send_drafts_for_approval.md
│       ├── 05_populate_review_queue.md
│       └── 06_ready_to_schedule.md
├── workflows/
│   ├── README.md
│   └── exports/
└── scripts/
    └── export_instructions.md
```

## Important note about workflow versioning

This repository is ready to version your n8n workflows, but it does **not** include exact exported workflow JSON files from your local instance yet.

That is because the safest way to version n8n workflows is:

1. finish and test each workflow locally
2. export the workflow JSON from n8n
3. save the exported JSON into `workflows/exports/`
4. commit it to git

This repo already includes the full workflow specifications in markdown so you can reconstruct or verify each workflow even before export.

## Prerequisites

- Docker Desktop or Docker Engine
- a Google account with:
  - Google Sheets access
  - Google Drive access
- an OpenAI API key
- an SMTP account or Gmail app password for email sending

## Environment variables

Copy the example env file:

```bash
cp .env.example .env
```

Then update the values you need.

The review UI needs the Google Sheets spreadsheet ID, the service account email, and the private key. It also uses basic auth with `REVIEW_UI_USERNAME` and `REVIEW_UI_PASSWORD` from `.env`.

The workflow launcher also needs `OPENAI_API_KEY` for generation and `GOOGLE_DRIVE_ASSET_FOLDER_ID` for asset intake.

## Run locally

```bash
docker compose up -d
```

Open n8n at:

```text
http://localhost:5678
```

Open the review UI at:

```text
http://localhost:3000
```

## Import workflows in bulk

If you want to load every exported workflow into n8n at once, start the stack first and then run:

```bash
bash scripts/import_workflows.sh
```

That script calls the n8n CLI inside the running container and imports every JSON file in `workflows/exports/`.

If you prefer the raw command, it is:

```bash
docker compose exec -u node n8n n8n import:workflow --separate --input=/workspace/workflows/exports
```

Stop it with:

```bash
docker compose down
```

## Persistence

This setup stores n8n data in a local Docker volume named `n8n_data`.

That means your workflows and credentials survive container restarts.

The review UI reads and writes the Google Sheet directly using a service account, and the workflow launcher uses the same Sheets-backed state plus `OPENAI_API_KEY` and `GOOGLE_DRIVE_ASSET_FOLDER_ID` for execution.

## Recommended local setup flow

1. start n8n with Docker Compose
2. connect Google Sheets credentials
3. connect Google Drive credentials
4. configure email credentials
5. add your OpenAI API key to the UI runner or the n8n OpenAI nodes
6. create the Google Sheets tabs
7. share the spreadsheet with the Google service account email
8. set `OPENAI_API_KEY` and `GOOGLE_DRIVE_ASSET_FOLDER_ID` in `.env`
9. build and test each workflow in the order documented in `docs/workflows/`
10. export each finished workflow JSON into `workflows/exports/`
11. use the UI workflow launcher at `http://localhost:3000`
12. review and edit drafts in the UI at `http://localhost:3000`
13. commit to git

## Suggested git workflow

```bash
git init
git add .
git commit -m "Initial repo scaffold for DJ Content MVP"
```

Then after each workflow change:

```bash
git add .
git commit -m "Update content_generation workflow"
```

## Google Sheets tabs expected by the MVP

The project expects these tabs in your operational spreadsheet:

- `brand_profile`
- `trends_input`
- `weekly_plan`
- `assets`
- `content_drafts`
- `review_queue`
- `workflow_runs`

The `review_queue` table is the editable operational table for the new UI.
The `workflow_runs` table records UI-launched run status and summaries.

## Next recommended improvements

- duplicate protection before appending into `review_queue`
- auto-update approval status from replies
- scheduler integration with Buffer or Later
- replace manual trend input with automatic trend ingestion
