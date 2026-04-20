import { CopilotChatView } from './chat-view';

export const dynamic = 'force-dynamic';

export default function CopilotPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Copilot</h1>
        <p className="text-sm text-muted-foreground">
          Phase 4.3 · Claude-native sidebar with read-only tool access to products, orders,
          modules, and semantic search. Falls back to a deterministic stub when{' '}
          <code>ANTHROPIC_API_KEY</code> is not configured.
        </p>
      </header>
      <CopilotChatView />
    </div>
  );
}
