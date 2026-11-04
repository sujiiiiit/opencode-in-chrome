import type { ReactNode } from 'react';
import { ThinkingStatus } from '@/components/loader-demo/thinking-status';

export function SettingsPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-10 px-6 py-12 text-text-primary">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-text-secondary">Opencode extension preferences.</p>
      </header>

      <Section title="Components">
        <Card label="Thinking status">
          <ThinkingStatus />
        </Card>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium text-text-secondary">{title}</h2>
      {children}
    </section>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-xs text-text-secondary">{label}</span>
      <div className="rounded-lg border border-border p-6">{children}</div>
    </div>
  );
}
