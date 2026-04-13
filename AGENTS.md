# AGENTS.md — DJ Content Automation System

## 1. Objective

Build and evolve an **AI-powered content automation system for DJs** that:

* Translates artistic identity into weekly content strategy
* Generates high-quality social content with minimal human effort
* Maintains authenticity (non-generic, non-influencer tone)
* Supports a human-in-the-loop approval workflow
* Scales into semi-automated publishing

---

## 2. System Philosophy

### Core Principle

> Reduce cognitive load, not creative identity.

The system must:

* Eliminate execution friction
* Preserve artistic direction
* Avoid generic AI outputs

---

## 3. Architecture Overview

### Orchestration Layer

* n8n workflows (primary runtime)
* Manual triggers (current)
* Future: scheduled + event-driven

### Data Layer (Google Sheets)

* `brand_profile`
* `weekly_plan`
* `assets`
* `content_drafts`
* `review_queue`

### Storage Layer

* Google Drive (assets)

### AI Layer

* OpenAI (`gpt-4.1-mini`)
* Strict JSON outputs
* Prompt-driven behavior

---

## 4. Current Workflows

### 1. weekly_strategy_v2

* Input: brand_profile + manual trend_text
* Output: weekly content strategy → `weekly_plan`

### 2. asset_intake_v1

* Input: Google Drive folder
* Output: assets → `assets` sheet

### 3. content_generation_v1

* Input: weekly_plan + assets
* Output: 3 posts → `content_drafts`

### 4. send_drafts_for_approval_v1

* Input: content_drafts
* Output: HTML email (review)

### 5. populate_review_queue_v1

* Input: content_drafts
* Output: `review_queue`

### 6. ready_to_schedule_v1

* Input: approved posts
* Output: email with final publishing info

---

## 5. Design Constraints

### Output Quality

* NEVER generic
* NEVER influencer tone
* ALWAYS aligned with underground electronic scene

### Prompting Rules

* Always enforce JSON output
* Always include anti-patterns
* Never allow hallucinated context (events, crowd, etc.)

### Workflow Rules

* Each workflow must be independently executable
* No hidden dependencies between nodes
* All data must be persisted in Sheets

---

## 6. Coding Standards (n8n + JS nodes)

### JavaScript Nodes

* Always validate inputs
* Always throw explicit errors
* Never silently fail

### Naming

* Nodes must have explicit names (no defaults)
* Use snake_case for sheet fields
* Use consistent `week_id`

### Data Contracts

Each workflow must respect schema:

#### weekly_plan

* week_id
* theme
* trend_summary
* asset_request_message
* status

#### assets

* asset_id
* week_id
* file_url
* asset_type

#### content_drafts

* draft_id
* week_id
* caption
* hashtags
* approval_status

#### review_queue

* approval_status
* scheduled_date
* platform

---

## 7. Anti-Patterns (Strict)

DO NOT:

* Add complex state management
* Introduce databases (yet)
* Over-engineer orchestration
* Replace Google Sheets prematurely
* Add ML or scoring prematurely

---

## 8. Future Extensions

* Trend ingestion (TikTok / IG scraping)
* Auto-scheduling (Buffer / Meta API)
* WhatsApp approval flow
* Performance feedback loop
* Content scoring system

---

## 9. Development Workflow

When modifying system:

1. Update workflow JSON
2. Export from n8n
3. Commit to `/workflows/exports`
4. Document changes in `/docs/workflows`
5. Keep system runnable locally

---

## 10. Priority Mindset

Always prioritize:

1. Reliability
2. Simplicity
3. UX for the DJ
4. Output quality

NOT:

* Fancy architecture
* Over-automation
* Premature scaling

---

## 11. Definition of Done

A feature is complete when:

* Works end-to-end in n8n
* Produces stable output
* Requires minimal manual intervention
* Can be used by a non-technical DJ

---
