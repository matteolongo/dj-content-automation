import { ReviewBoard } from '@/components/review-board';
import { WorkflowLauncher } from '@/components/workflow-launcher';

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">DJ Content Automation</p>
          <h1>Run the content pipeline and review drafts in one place.</h1>
          <p className="lede">
            Launch the weekly workflow chain from the UI, watch the latest runs update in real
            time, and then refine the generated captions and assets without living in Google
            Sheets.
          </p>
        </div>
        <div className="hero-note">
          <strong>Workflow state:</strong> <span>workflow_runs</span>
          <strong>Source of truth:</strong> <span>review_queue</span>
        </div>
      </section>

      <WorkflowLauncher />
      <ReviewBoard />
    </main>
  );
}
