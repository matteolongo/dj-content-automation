# 04 — send_drafts_for_approval

## Goal
Read the weekly drafts and send a readable approval email with image previews.

## Trigger
- manual trigger for v1

## Inputs
- `content_drafts`
- the selected `week_id`

## Output
- one HTML email for review

## Main nodes
1. Manual Trigger
2. Set week_id
3. Google Sheets Read `content_drafts`
4. Code node to filter drafts by `week_id`
5. Code node to build HTML email body
6. Email Send

## Email includes
- post number
- image preview from Google Drive
- content type
- caption
- hashtags
- current approval status

## Manual validation checklist
- email renders properly
- image previews load
- posts are in the correct order
