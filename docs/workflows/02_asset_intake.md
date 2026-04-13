# 02 — asset_intake

## Goal
Read files from the weekly Google Drive folder, classify them as photo or video, and append them into `assets`.

## Trigger
- manual trigger for v1

## Inputs
- `week_id`
- Google Drive folder contents

## Output
- one row per file in `assets`

## Main nodes
1. Manual Trigger
2. Set week_id
3. Google Drive Search in the weekly `raw` folder
4. Google Drive Download file
5. Code node to normalize metadata and classify asset type
6. Google Sheets Append `assets`

## Fields written to `assets`
- `asset_id`
- `week_id`
- `file_url`
- `asset_type`
- `source=drive`
- optional metadata:
  - `file_name`
  - `file_extension`
  - `file_size`
  - `mime_type`

## Manual validation checklist
- the workflow finds files in the target folder
- photos are classified as `photo`
- videos are classified as `video`
- rows are appended only once per intended run
