# 06 — ready_to_schedule

## Goal
Read approved rows from `review_queue` and send a final ready-to-schedule email.

## Trigger
- manual trigger for v1

## Inputs
- `review_queue`
- selected `week_id`

## Output
- one HTML email containing approved posts only

## Main nodes
1. Manual Trigger
2. Set week_id
3. Google Sheets Read `review_queue`
4. Code node to filter approved rows by `week_id`
5. Code node to build ready-to-schedule HTML email
6. Email Send

## Email includes
- image previews
- caption
- hashtags
- platforms
- scheduled date and time
- notes

## Manual validation checklist
- only approved posts are included
- each post shows schedule info
- output is easy to use for manual publishing
