import { ReviewBoard } from '@/components/review-board';

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">DJ Content Automation</p>
          <h1>Review drafts without living in Google Sheets.</h1>
          <p className="lede">
            Check the generated captions, inspect the asset previews, make edits, and
            push approval state back into the operational queue.
          </p>
        </div>
        <div className="hero-note">
          <strong>Source of truth:</strong> <span>review_queue</span>
          <strong>Immutable output:</strong> <span>content_drafts</span>
        </div>
      </section>

      <ReviewBoard />
    </main>
  );
}
