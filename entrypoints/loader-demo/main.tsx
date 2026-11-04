import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import SquiggleLoader from '@/components/ui/squiggle-loader';
import { ThinkingStatus } from '@/components/loader-demo/thinking-status';
import '@/assets/styles/global.css';

const USAGE = `<div className=" text-sm flex gap-2 items-center ">
  <SquiggleLoader strokeColor="#86837e" />
  <TextLoop loop={false}>
    <TextShimmer>Preparing</TextShimmer>
    <TextShimmer>Analyzing</TextShimmer>
    <TextShimmer>Thinking</TextShimmer>
    <TextShimmer>Generating</TextShimmer>
    <span className="text-(--shimmer-text-highlight-color)">
      Took 3 min to generate
    </span>
  </TextLoop>
</div>`;

const PROPS: [string, string, string][] = [
  ['width', '24', 'Width of the drawing area in CSS px'],
  ['height', '16', 'Height of the drawing area in CSS px'],
  ['strokeColor', '#000000', 'Colour of the squiggle'],
  ['strokeWidth', '1.5', 'Line width'],
  ['tempo', '18', 'Speed of the scribble'],
  ['acceleration', '0.3', 'How much the stroke speeds up and slows down'],
  ['tailLength', '72', 'How long the trailing stroke is'],
];

function Demo() {
  // Remounting the status restarts its label cycle.
  const [run, setRun] = useState(0);
  return (
    <main className="mx-auto max-w-2xl space-y-10 px-6 py-12 text-text-primary">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Squiggle loader</h1>
        <p className="text-sm text-text-secondary">
          A hand-drawn squiggle that scribbles on a canvas while something is thinking. Ported from
          openscreen-studio's transcribe tab.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-text-secondary">Thinking status</h2>
        <div key={run} className="rounded-lg border border-border p-6">
          <ThinkingStatus />
        </div>
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Replay
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-text-secondary">Variants</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Variant label="Default">
            <SquiggleLoader />
          </Variant>
          <Variant label="Fast, short tail">
            <SquiggleLoader tempo={30} tailLength={30} />
          </Variant>
          <Variant label="Large, thick">
            <SquiggleLoader width={48} height={32} strokeWidth={2.5} />
          </Variant>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-text-secondary">Usage</h2>
        <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
          <code>{USAGE}</code>
        </pre>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium text-text-secondary">Props</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-text-secondary">
            <tr>
              <th className="py-2 pr-4 font-medium">Prop</th>
              <th className="py-2 pr-4 font-medium">Default</th>
              <th className="py-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {PROPS.map(([name, def, desc]) => (
              <tr key={name} className="border-t border-border align-top">
                <td className="py-2 pr-4 font-mono text-xs">{name}</td>
                <td className="py-2 pr-4 font-mono text-xs">{def}</td>
                <td className="py-2 text-text-secondary">{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function Variant({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-6">
      {children}
      <span className="text-xs text-text-secondary">{label}</span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>,
);
