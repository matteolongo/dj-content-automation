# ROADMAP — DJ Content Automation System

## Current Status

MVP COMPLETE ✅

* Strategy generation
* Asset ingestion
* Content generation
* Email review
* Review queue
* Ready-to-schedule flow

---

# 🔥 PHASE 1 — Make it REAL (Next 7–10 days)

## 1. Fix Known Issues

* [ ] Fix `weed_id` typo in `asset_intake_v1`
* [ ] Normalize `week_id` across all workflows
* [ ] Add duplicate protection in `review_queue`

---

## 2. Trend Ingestion (CRITICAL)

### Goal

Remove manual trend input.

### Options

#### Option A — Simple (recommended)

* Tavily API (search-based)
* Query: "tiktok dj trends electronic music"

#### Option B — Advanced

* Scrape TikTok / Instagram reels
* Extract:

  * formats
  * hooks
  * audio trends

### Output

Structured trends:

```json
{
  "trend_summary": "...",
  "formats": [],
  "hooks": []
}
```

---

## 3. Improve Asset Selection

Current:

* all assets used blindly

Upgrade:

* match assets to content_plan

Add:

* asset tagging (manual or AI)
* simple classifier:

  * dj_pov
  * crowd
  * aesthetic

---

# ⚡ PHASE 2 — UX Upgrade (1–2 weeks)

## 4. Replace Email with Review Dashboard

Options:

* Notion
* Airtable
* Simple web UI (Streamlit)

Goal:

* approve/edit posts visually
* no email friction

---

## 5. WhatsApp Integration (HIGH VALUE)

Replace email with:

* WhatsApp message:

  * preview posts
  * approve via buttons

Tools:

* Twilio
* WhatsApp Business API

---

## 6. Better Prompt System

* Modular prompts
* Reusable templates
* Versioned prompts

---

# 🚀 PHASE 3 — Automation Layer

## 7. Scheduling Integration

Integrate:

* Buffer API
* Meta Graph API (IG + FB)
* TikTok API (if available)

Goal:

* auto-post approved content

---

## 8. Weekly Automation

Replace manual trigger:

* Cron workflow
* Every Sunday:

  * generate strategy
  * request assets

---

## 9. Performance Tracking

Track:

* likes
* saves
* views

Store in:

* `performance_metrics` sheet

---

# 🧠 PHASE 4 — Intelligence Layer

## 10. Feedback Loop

* analyze best performing posts
* adapt prompts automatically

---

## 11. Content Scoring

Before sending drafts:

* score quality
* filter weak content

---

## 12. Personalization Engine

Learn:

* which captions work
* which visuals work

---

# 🧱 PHASE 5 — Production Ready

## 13. Replace Google Sheets

Move to:

* Postgres / Supabase

---

## 14. Multi-DJ Support

* multi-tenant system
* config per artist

---

## 15. UI Product

* login
* dashboard
* analytics

---

# ⚠️ PRIORITY ORDER (IMPORTANT)

DO IN THIS ORDER:

1. Trend ingestion
2. Asset matching
3. Review UX (replace email)
4. Scheduling integration

NOT:

* database
* scaling
* fancy UI

---

# 🎯 FINAL VISION

A system where the DJ:

* uploads 3–4 clips
* clicks ONE button

And gets:

* strategy
* content
* scheduling

Fully aligned with their identity.

---
