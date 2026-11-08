import { describe, expect, it } from 'vitest';
import { mentionShape } from '@/components/chat/prompt-box/mention-shape';

describe('mention background silhouette', () => {
  it('does not draw a badge without visible text', () => {
    expect(mentionShape([])).toBe('');
  });

  it('joins wrapped lines in one closed shape with a rounded inner corner', () => {
    const path = mentionShape([
      { left: 0, right: 200, top: 0, bottom: 18 },
      { left: 0, right: 80, top: 22, bottom: 40 },
    ]);
    expect(path.match(/M/g)).toHaveLength(1);
    expect(path.match(/Z/g)).toHaveLength(1);
    expect(path).toContain('Q83,20 83,28');
    expect(path).not.toMatch(/NaN|Infinity/);
  });

  it('flattens small differences between line widths to avoid tiny notches', () => {
    const path = mentionShape([
      { left: 3, right: 200, top: 0, bottom: 18 },
      { left: 0, right: 196, top: 22, bottom: 40 },
    ]);
    expect(path.match(/Q/g)).toHaveLength(4);
    expect(path).not.toMatch(/NaN|Infinity/);
  });
});
