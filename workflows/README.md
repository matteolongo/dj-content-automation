# Workflow exports

Put exported n8n workflow JSON files here.

Suggested names:

- `01_weekly_strategy.json`
- `02_asset_intake.json`
- `03_content_generation.json`
- `04_send_drafts_for_approval.json`
- `05_populate_review_queue.json`
- `06_ready_to_schedule.json`

Suggested process:

1. finish testing a workflow in n8n
2. export it from the n8n UI
3. save it into `workflows/exports/`
4. commit it to git
