import { ReviewBoard } from '@/components/review-board';
import { WorkflowLauncher } from '@/components/workflow-launcher';

export default function HomePage() {
  return (
    <main className="shell">
      <WorkflowLauncher />
      <ReviewBoard />
    </main>
  );
}
