# 03 — content_generation

## Goal
Read the weekly plan and asset list, generate 3 social drafts with OpenAI, and save them into `content_drafts`.

## Trigger
- manual trigger for v1

## Inputs
- `weekly_plan`
- `assets`
- fixed artist profile embedded in the prompt

## Output
- three rows in `content_drafts`

## Main nodes
1. Manual Trigger
2. Set week_id
3. Google Sheets Read `weekly_plan`
4. Code node to filter `weekly_plan` by `week_id`
5. Google Sheets Read `assets`
6. Code node to filter and aggregate assets by `week_id`
7. Merge node
8. Code node to build the prompt
9. HTTP Request to OpenAI Responses API
10. Code node to parse generated posts
11. Google Sheets Append `content_drafts`

## Fields written to `content_drafts`
- `draft_id`
- `week_id`
- `post_number`
- `content_type`
- `caption`
- `hashtags`
- `asset_ids`
- `approval_status=pending`

## Manual validation checklist
- exactly 3 rows are appended
- captions are distinct
- hashtags are present
- asset IDs are mapped
