import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatedDoodle, DOODLE_NAMES, type DoodleName } from '@/components/ui/doodle';
import { Icon } from '@/components/ui/icon';
import { useTextColor } from '@/components/ui/use-text-color';
import type { MentionItem } from '@/lib/opencode/mentions';
import { mentionShape } from './mention-shape';

type Shape = { path: string; fill: string };
type ChipIcon = { target: HTMLElement; kind: string; name: string };

function AgentIcon({ name }: { name: DoodleName }) {
  const [ref, color] = useTextColor<HTMLSpanElement>();
  return <span ref={ref} className="inline-flex items-center justify-center">{color && <AnimatedDoodle name={name} size={16} weight={0.2} color={color} />}</span>;
}

/** Backgrounds live outside contenteditable, so selection, copying and chip deletion stay native. */
export function MentionBackgrounds({ editor, text, agents }: { editor: RefObject<HTMLDivElement | null>; text: string; agents?: readonly MentionItem[] }) {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [icons, setIcons] = useState<ChipIcon[]>([]);
  useLayoutEffect(() => {
    const root = editor.current;
    if (!root) return;
    const measure = () => {
      const origin = root.getBoundingClientRect();
      const chips = Array.from(root.querySelectorAll<HTMLElement>('[data-mention]'));
      const next = chips.map((chip) => {
        const lines = Array.from(chip.getClientRects()).filter((rect) => rect.width > 0).map((rect) => ({
          left: rect.left - origin.left, right: rect.right - origin.left,
          top: rect.top - origin.top, bottom: rect.bottom - origin.top,
        }));
        return { path: mentionShape(lines), fill: getComputedStyle(chip).getPropertyValue('--chip-fill') };
      });
      setShapes(next);
      setIcons(chips.flatMap((chip) => {
        const target = chip.querySelector<HTMLElement>('[data-mention-icon]');
        return target ? [{ target, kind: chip.dataset.mention ?? '', name: chip.dataset.name ?? '' }] : [];
      }));
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    const changes = new MutationObserver(measure);
    changes.observe(root, { childList: true, subtree: true, characterData: true });
    let mounted = true;
    void document.fonts?.ready.then(() => { if (mounted) measure(); });
    return () => { mounted = false; resize.disconnect(); changes.disconnect(); };
  }, [editor, text]);
  return <>
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible" data-slot="mention-backgrounds">
      {shapes.map((shape, index) => <path key={index} d={shape.path} fill={shape.fill} />)}
    </svg>
    {icons.map(({ target, kind, name }, index) => createPortal(
      kind === 'agent'
        ? <AgentIcon name={DOODLE_NAMES[Math.max(0, agents?.findIndex((agent) => agent.name === name) ?? 0) % DOODLE_NAMES.length]!} />
        : <Icon name="skill" className="size-[14px]" />,
      target,
      String(index),
    ))}
  </>;
}
