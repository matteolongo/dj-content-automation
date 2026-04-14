# Review UI Image Proxy

## Context

The review UI now renders Google Drive asset previews through an internal Next.js proxy route instead of loading raw Drive URLs in the browser.

The fix stays inside the existing `web-ui` Next.js app.

## Goal

Keep browser previews on the app origin while the server fetches Drive bytes with the service account.

## Implemented Behavior

1. The review UI should render image previews using an internal URL such as `/api/assets/<asset_id>`.
2. The proxy route should authenticate with the existing Google service account credentials from `.env`.
3. The proxy route should fetch the Drive file server-side and stream the bytes back to the browser.
4. The UI should continue to work when the Drive file is not public.
5. If an asset cannot be fetched, the UI should show a graceful fallback instead of a broken layout.

## Constraints

- Keep everything inside the current `web-ui` app.
- Do not introduce another Docker service.
- Do not replace Google Sheets.
- Do not change the `review_queue` schema.
- Reuse the existing `googleapis` dependency if possible.
- Keep the current basic auth middleware.

## Files

- `web-ui/lib/google.ts` shared server-only Google auth helper
- `web-ui/app/api/assets/[assetId]/route.ts` Drive proxy route
- `web-ui/lib/sheets.ts` asset URL resolution
- `web-ui/components/review-board.tsx` preview rendering and fallback UI

## Runtime Notes

- The proxy route returns `200` with the asset bytes when the Drive file is accessible.
- The proxy route returns `403` or `404` when the file is inaccessible or missing.
- The response includes a safe cache header such as `private, max-age=300`.
- A rebuild is required after code changes: `docker compose up -d --build review-ui`.

## Validation

- `npm run build` passes in `web-ui`
- The review queue API now emits `/api/assets/<asset_id>` preview URLs
- Direct requests to `/api/assets/<asset_id>` return image bytes from the app

## Non-Goals

- No separate API backend.
- No new database.
- No authentication redesign.
- No change to the workflow JSONs unless absolutely necessary.

## Notes

- Keep server-only Google logic out of client components.
- Do not delete the current Google Sheets integration.
- Do not reintroduce raw `drive.google.com` preview URLs in the browser.
