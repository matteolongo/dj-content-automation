# Review UI

This repo now includes a local-first review app for the human approval step.

## Purpose

The UI replaces Google Sheets as the day-to-day review surface while keeping Sheets as the source of truth.

## Data flow

1. `content_generation_v1` writes generated posts into `content_drafts`
2. `populate_review_queue_v1` copies the drafts into `review_queue`
3. the review UI reads `review_queue`, renders previews through the internal asset proxy, and lets the DJ edit the row
4. saved edits go back to `review_queue`
5. `ready_to_schedule_v1` reads only approved rows from `review_queue`

## Editable fields

The UI edits:

- `caption`
- `hashtags`
- `scheduled_date`
- `scheduled_time`
- `platform`
- `notes`
- `approval_status`

## Setup

1. Share the Google Sheet with the service account email.
2. Set the Google auth and sheet environment variables in `.env`.
3. Start or rebuild the stack with `docker compose up -d --build review-ui`.
4. Open the review UI at `http://localhost:3000`.

## Notes

- `content_drafts` stays immutable.
- `review_queue` is the operational review table.
- The UI uses `draft_id` as the stable row key.
- Image previews are served from the app at `/api/assets/<asset_id>`.
- Raw `drive.google.com` preview URLs are no longer required in the browser.

## Follow-up

If image previews fail in the browser, see:

- [`docs/review-ui-image-proxy-agent.md`](./review-ui-image-proxy-agent.md)
