// The window an MCP session's approval opens (lib/browser/popup-approvals.ts): what the agent
// wants to do, and the same choices the chat's approval form offers.
import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { Button } from '@/components/ui/button';
import { approvalForm } from '@/lib/browser/approvals';
import { APPROVAL_PREFIX, type StoredApproval } from '@/lib/browser/popup-approvals';
import type { ApprovalAnswer } from '@/lib/browser/policy';

export function ApprovalWindow({ id }: { id: string }) {
  const key = `${APPROVAL_PREFIX}${id}`;
  const [stored, setStored] = useState<StoredApproval | null | undefined>(undefined);

  useEffect(() => {
    void browser.storage.session.get(key).then((value) => setStored((value[key] as StoredApproval | undefined) ?? null));
  }, [key]);

  const choose = async (answer: ApprovalAnswer) => {
    if (!stored) return;
    await browser.storage.session.set({ [key]: { ...stored, answer } });
    window.close();
  };

  if (stored === undefined) return null;
  if (stored === null) return <p className="p-5 text-sm text-text-secondary">This request was already answered.</p>;
  const form = approvalForm(stored.request);
  const field = form.fields[0]!;
  return (
    <main className="flex min-h-screen flex-col gap-4 bg-background p-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-text-secondary">An MCP client is using the Opencode browser</p>
        <h1 className="text-base font-medium text-text-primary">{form.title}</h1>
        <p className="text-sm text-text-primary">{field.title}</p>
        <p className="text-xs text-text-secondary">{field.description}</p>
      </div>
      <div className="mt-auto flex flex-wrap justify-end gap-2">
        {field.options.map((option) => (
          <Button key={option.value} variant={option.value === 'deny' ? 'outline' : 'default'} onClick={() => void choose(option.value as ApprovalAnswer)}>
            {option.label}
          </Button>
        ))}
      </div>
    </main>
  );
}
