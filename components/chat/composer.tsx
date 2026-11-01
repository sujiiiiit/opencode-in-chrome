import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  disabled: boolean;
  onSend: (text: string) => void;
};

export function Composer({ disabled, onSend }: Props) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText('');
    onSend(trimmed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex items-end gap-2 border-t border-border p-3">
      <textarea
        aria-label="Message"
        className="max-h-40 min-h-9 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50"
        placeholder="Message opencode…"
        rows={1}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <Button type="button" onClick={submit} disabled={disabled || !text.trim()}>
        Send
      </Button>
    </div>
  );
}
