import { memo, type ReactNode } from 'react';
import { ProviderLogo } from '@/components/chat/model/provider-logo';
import type { CatalogModel, CatalogProvider, ModelPrice } from '@/lib/opencode/models/catalog';

const chip = 'rounded-full bg-background-tertiary px-2 py-0.5 text-xs text-text-primary';

/** 200000 → "200K", 1048576 → "1M". */
function tokens(count: number): string {
  if (count >= 1_000_000) return `${+(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return String(count);
}

const dollars = (amount: number) =>
  `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-medium text-text-tertiary">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="shrink-0 text-text-secondary">{label}</dt>
      <dd className="min-w-0 text-right text-text-primary">{children}</dd>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {items.map((item) => (
        <span key={item} className={chip}>
          {item}
        </span>
      ))}
    </span>
  );
}

function PriceRows({ price }: { price: ModelPrice }) {
  return (
    <>
      <Row label="Input">{dollars(price.input)}</Row>
      <Row label="Output">{dollars(price.output)}</Row>
      {price.cacheRead > 0 && <Row label="Cache read">{dollars(price.cacheRead)}</Row>}
      {price.cacheWrite > 0 && <Row label="Cache write">{dollars(price.cacheWrite)}</Row>}
    </>
  );
}

function Pricing({ model }: { model: CatalogModel }) {
  const prices = model.details?.prices ?? [];
  if (model.free) {
    return (
      <Section title="Pricing">
        <Row label="Cost">Free</Row>
      </Section>
    );
  }
  const [base, ...tiers] = prices;
  if (!base) return null;
  return (
    <Section title="Pricing, per million tokens">
      <PriceRows price={base} />
      {tiers.map((tier) => (
        <div key={tier.contextOver} className="space-y-1.5 border-t border-border-secondary-transparent pt-1.5">
          <p className="text-xs text-text-tertiary">{`Over ${tokens(tier.contextOver ?? 0)} context`}</p>
          <PriceRows price={tier} />
        </div>
      ))}
    </Section>
  );
}

function Badges({ model }: { model: CatalogModel }) {
  const details = model.details;
  const badges = [
    details?.type && details.type !== 'chat' ? capitalize(details.type) : '',
    details && details.status !== 'active' ? capitalize(details.status) : '',
    model.free ? 'Free' : '',
    model.latest ? 'Latest' : '',
  ].filter(Boolean);
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span key={badge} className={chip}>
          {badge}
        </span>
      ))}
    </div>
  );
}

function Header({ model, provider }: { model: CatalogModel; provider: CatalogProvider | undefined }) {
  return (
    <header className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs text-text-secondary">
        {provider && <ProviderLogo provider={provider} />}
        <span className="truncate">{provider?.name ?? model.providerID}</span>
        {model.family && <span className="truncate text-text-tertiary">{`· ${model.family}`}</span>}
      </p>
      <h2 className="text-base font-semibold text-text-primary">{model.name}</h2>
      <p className="font-mono text-xs break-all text-text-tertiary">{model.modelID}</p>
      <Badges model={model} />
    </header>
  );
}

function Capabilities({ model }: { model: CatalogModel }) {
  const details = model.details;
  const outputs = details?.outputs ?? [];
  return (
    <Section title="Capabilities">
      <Row label="Input">
        <Chips items={model.inputs.length > 0 ? model.inputs.map(capitalize) : ['Text']} />
      </Row>
      {outputs.length > 0 && (
        <Row label="Output">
          <Chips items={outputs.map(capitalize)} />
        </Row>
      )}
      <Row label="Tool use">{yesNo(model.tools)}</Row>
      {details?.temperature !== undefined && <Row label="Temperature">{yesNo(details.temperature)}</Row>}
      {model.variants.length > 0 && (
        <Row label="Reasoning effort">
          <Chips items={model.variants} />
        </Row>
      )}
    </Section>
  );
}

/** A token count as a row, left out when the catalog doesn't give it. */
function TokenRow({ label, count }: { label: string; count: number | undefined }) {
  return count ? <Row label={label}>{`${tokens(count)} tokens`}</Row> : null;
}

function Limits({ model }: { model: CatalogModel }) {
  const { maxInput, maxOutput } = model.details ?? { maxInput: 0, maxOutput: 0 };
  if (!model.context && !maxInput && !maxOutput) return null;
  return (
    <Section title="Limits">
      <TokenRow label="Context window" count={model.context} />
      <TokenRow label="Max input" count={maxInput} />
      <TokenRow label="Max output" count={maxOutput} />
    </Section>
  );
}

function Release({ model }: { model: CatalogModel }) {
  if (!Number.isFinite(model.released)) return null;
  const date = new Date(model.released).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return (
    <Section title="Release">
      <Row label="Released">{date}</Row>
    </Section>
  );
}

/** Everything the catalog knows about one model, laid out as labelled sections. */
export const ModelCard = memo(function ModelCard({ model, provider }: { model: CatalogModel; provider: CatalogProvider | undefined }) {
  return (
    <div className="w-76 space-y-4 p-2.5">
      <Header model={model} provider={provider} />
      <Capabilities model={model} />
      <Limits model={model} />
      <Pricing model={model} />
      <Release model={model} />
    </div>
  );
});
