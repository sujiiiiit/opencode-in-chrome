/**
 * Whether the current platform is macOS (or iOS), used for shortcut labels.
 *
 * Prefers `navigator.userAgentData.platform` (Chromium 90+) and falls back to
 * a user-agent regex for browsers that do not expose it (Firefox, Safari).
 */
function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as Navigator & { userAgentData?: { platform: string } })
    .userAgentData;
  if (uaData?.platform) return uaData.platform === 'macOS';
  return /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
}

const MAC_SHORTCUT_GLYPHS: Record<string, string> = {
  '⌘': 'Ctrl',
  '⇧': 'Shift',
  '⌥': 'Alt',
  '⌫': 'Backspace'
};

/**
 * Rewrites a Mac-glyph shortcut label (`⌘G`, `⇧⌫`) for the platform reading
 * it, so Windows and Linux users are not shown keys their keyboard lacks.
 */
export function shortcutLabel(label: string): string {
  if (isMacOS()) return label;
  return (
    label
      .replace(/[⌘⇧⌥⌫]\s*/g, (glyph, at: number, whole: string) => {
        const word = MAC_SHORTCUT_GLYPHS[glyph.trim()];
        const next = whole[at + glyph.length];
        // A modifier joins the key it modifies with `+` — but `⌘ +` and `⌘ −`
        // name the plus and minus keys, and `Ctrl++` reads as a typo. Brackets
        // are in the joined set since editors write `Ctrl+]` / `Ctrl+Shift+[`.
        return next && /[0-9A-Za-z[\]⌘⇧⌥⌫]/.test(next)
          ? `${word}+`
          : `${word} `;
      })
      .trimEnd()
      // Mac orders modifiers ⇧⌘; Windows and Linux write Ctrl before Shift.
      .replace('Shift+Ctrl+', 'Ctrl+Shift+')
  );
}
