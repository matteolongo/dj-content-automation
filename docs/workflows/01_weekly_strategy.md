# 01 — weekly_strategy

## Goal
Generate the weekly content theme, summarize the trend fit, save the weekly plan, and send the asset request email.

## Trigger
- schedule trigger
- run weekly on Sunday morning

## Inputs
- `brand_profile` from Google Sheets
- `trends_input` from Google Sheets

## Output
- one new row in `weekly_plan`
- one email with the weekly asset request

## Main nodes
1. Schedule Trigger
2. Set week_id
3. Google Sheets Read `brand_profile`
4. Google Sheets Read `trends_input`
5. Set prompt
6. HTTP Request to OpenAI Responses API
7. Code node to parse model JSON
8. Google Sheets Append `weekly_plan`
9. Email Send

## Fields written to `weekly_plan`
- `week_id`
- `theme`
- `trend_summary`
- `asset_request_message`
- `status=waiting_assets`

## Manual validation checklist
- one row is appended to `weekly_plan`
- the email is readable
- the week theme is not generic
- the asset request is specific enough
