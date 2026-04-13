# 05 — populate_review_queue

## Goal
Copy generated drafts into the operational `review_queue` tab.

## Trigger
- manual trigger for v1

## Inputs
- `content_drafts`
- selected `week_id`

## Output
- one row per draft in `review_queue`

## Main nodes
1. Manual Trigger
2. Set week_id
3. Google Sheets Read `content_drafts`
4. Code node to filter drafts for the week and normalize row structure
5. Google Sheets Append `review_queue`

## Fields written to `review_queue`
- `draft_id`
- `week_id`
- `post_number`
- `content_type`
- `caption`
- `hashtags`
- `asset_ids`
- `approval_status`
- `scheduled_date`
- `scheduled_time`
- `platform`
- `notes`

## Manual validation checklist
- all generated drafts appear in `review_queue`
- default platform is set
- statuses are editable manually
