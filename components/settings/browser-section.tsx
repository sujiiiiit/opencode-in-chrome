import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import type { ApprovalMode, SiteRule, SiteSettings } from '@/lib/browser/policy';
import { siteFromInput, useBrowserSettings } from './use-browser-settings';

const MODES: Array<{ value: ApprovalMode; label: string; hint: string }> = [
  { value: 'ask', label: 'Ask before acting', hint: 'The agent asks before it first uses a site, and before every submit, send, delete or payment.' },
  { value: 'act', label: 'Act on allowed sites', hint: 'No first-visit question for sites you have not blocked. Submits and sends still ask.' },
];

const RULES: Array<{ value: SiteRule; label: string }> = [
  { value: 'allow', label: 'Allow' },
  { value: 'ask', label: 'Ask' },
  { value: 'block', label: 'Block' },
];

const row = 'flex items-start gap-3 border-b border-border-secondary-transparent px-4 py-3 last:border-b-0';

function SiteRow({ site, settings, onChange }: { site: string; settings: SiteSettings; onChange: (value: SiteSettings | null) => void }) {
  return (
    <li className={`${row} items-center`} data-site={site}>
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{site}</span>
      <RadioGroup
        aria-label={`Rule for ${site}`}
        value={settings.rule}
        onValueChange={(value) => onChange({ ...settings, rule: value as SiteRule })}
        className="flex flex-row gap-3"
      >
        {RULES.map((rule) => (
          <label key={rule.value} className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary">
            <RadioGroupItem value={rule.value} />
            {rule.label}
          </label>
        ))}
      </RadioGroup>
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-secondary" title="Leaving this site after reading it needs your OK">
        <Checkbox checked={settings.sensitive === true} onCheckedChange={(checked) => onChange({ ...settings, sensitive: checked === true })} />
        Sensitive
      </label>
      <Button variant="ghost" size="icon-xs" aria-label={`Remove ${site}`} onClick={() => onChange(null)}>
        <Icon name="close" />
      </Button>
    </li>
  );
}

/** Browser access: the on switch, the approval mode and the per-site rules. */
export function BrowserSection() {
  const { state, setEnabled, setMode, setSite } = useBrowserSettings();
  const [draft, setDraft] = useState('');
  if (!state) return null;
  const sites = Object.entries(state.policy.sites).sort(([a], [b]) => a.localeCompare(b));

  const add = (event: FormEvent) => {
    event.preventDefault();
    const site = siteFromInput(draft);
    if (!site) return;
    void setSite(site, state.policy.sites[site] ?? { rule: 'allow' });
    setDraft('');
  };

  return (
    <div className="space-y-6">
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border px-4 py-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-text-primary">Let chats use the browser</span>
          <span className="block text-xs text-text-secondary">
            The agent can open tabs in its own tab group, read pages, click and type. It never touches your other tabs.
          </span>
        </span>
        <Switch aria-label="Let chats use the browser" checked={state.enabled} onCheckedChange={(checked) => void setEnabled(checked)} className="mt-0.5" />
      </label>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Approvals</h3>
        <RadioGroup
          aria-label="Approvals"
          value={state.policy.mode}
          onValueChange={(value) => void setMode(value as ApprovalMode)}
          className="gap-0 overflow-hidden rounded-2xl border border-border"
        >
          {MODES.map((mode) => (
            <label key={mode.value} className={`${row} cursor-pointer hover:bg-background-secondary has-data-checked:bg-background-secondary`}>
              <RadioGroupItem value={mode.value} className="mt-0.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-text-primary">{mode.label}</span>
                <span className="block text-xs text-text-secondary">{mode.hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>
        <p className="text-xs text-text-tertiary">Passwords, one-time codes, card numbers, CAPTCHAs and sign-in consent are always left to you.</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Sites</h3>
        <form onSubmit={add} className="flex gap-2">
          <Input aria-label="Add a site" placeholder="example.com" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <Button type="submit" variant="secondary" disabled={!siteFromInput(draft)}>
            Add
          </Button>
        </form>
        {sites.length === 0 ? (
          <p className="text-sm text-text-secondary">No sites yet. Sites you allow or block while chatting appear here.</p>
        ) : (
          <ul aria-label="Sites" className="overflow-hidden rounded-2xl border border-border">
            {sites.map(([site, settings]) => (
              <SiteRow key={site} site={site} settings={settings} onChange={(value) => void setSite(site, value)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
