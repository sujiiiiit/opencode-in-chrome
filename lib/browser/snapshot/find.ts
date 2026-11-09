// Local `find` (spec browser/page-snapshot): ranks snapshot lines against a plain-words
// query without calling a model. Claude in Chrome spends an LLM call per find; this is a
// token-overlap score over role, name and attributes, exact names first.

const LINE = /^\s*(\S+)(?: "((?:[^"\\]|\\.)*)")?\s*\[(e\d+)\](.*)$/;

const ROLE_WORDS: Record<string, string[]> = {
  button: ['button'],
  btn: ['button'],
  link: ['link'],
  anchor: ['link'],
  input: ['textbox', 'searchbox', 'combobox', 'spinbutton'],
  field: ['textbox', 'searchbox', 'combobox', 'spinbutton'],
  textbox: ['textbox'],
  box: ['textbox', 'searchbox', 'checkbox'],
  search: ['searchbox'],
  checkbox: ['checkbox'],
  check: ['checkbox'],
  radio: ['radio'],
  dropdown: ['combobox', 'listbox'],
  select: ['combobox', 'listbox'],
  menu: ['menuitem', 'menu', 'menubar'],
  tab: ['tab'],
  toggle: ['switch', 'checkbox'],
  switch: ['switch'],
  slider: ['slider'],
  frame: ['iframe'],
  iframe: ['iframe'],
  editor: ['textbox'],
};
const STOP = new Set(['the', 'a', 'an', 'to', 'of', 'for', 'on', 'in', 'with', 'and', 'or', 'that', 'this', 'element', 'containing', 'called', 'named', 'labelled', 'labeled']);

const tokens = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t && !STOP.has(t));

export type FindResult = { matches: string[]; total: number };

export function findInLines(lines: readonly string[], query: string, limit = 20): FindResult {
  const words = tokens(query);
  const scored: Array<{ line: string; score: number; order: number; specific: boolean }> = [];
  lines.forEach((raw, order) => {
    const match = LINE.exec(raw);
    if (!match) return;
    const [, role, name = '', ref, rest] = match;
    const nameText = name.replace(/\\"/g, '"').toLowerCase();
    const { score, hits, specific } = scoreWords(words, role!, nameText, rest ?? '');
    if (hits === 0) return;
    const queryText = words.join(' ');
    // Every word matched counts more than many matches of one word.
    const bonus = (queryText && nameText === queryText ? 5 : 0) + (hits === words.length ? 4 : 0);
    scored.push({ line: raw.trim(), score: score + bonus, order, specific });
  });
  const kept = prune(scored);
  kept.sort((a, b) => b.score - a.score || a.order - b.order);
  return { matches: kept.slice(0, limit).map((s) => s.line), total: kept.length };
}

/**
 * Drops noise: elements that matched only a type word ("link", "button") when others matched
 * the name or attributes, and anything scoring under half of the best.
 */
function prune<T extends { score: number; specific: boolean }>(scored: T[]): T[] {
  const named = scored.some((s) => s.specific) ? scored.filter((s) => s.specific) : scored;
  const best = Math.max(0, ...named.map((s) => s.score));
  return named.filter((s) => s.score * 2 >= best);
}

function scoreWords(words: string[], role: string, name: string, rest: string): { score: number; hits: number; specific: boolean } {
  const nameTokens = new Set(tokens(name));
  const restTokens = new Set(tokens(rest));
  let score = 0;
  let hits = 0;
  let specific = false;
  for (const word of words) {
    const nameScore = scoreName(nameTokens, name, word);
    const roleScore = scoreRole(role, word);
    const restScore = restTokens.has(word) ? 1 : 0;
    score += nameScore + roleScore + restScore;
    if (nameScore || roleScore || restScore) hits += 1;
    if (nameScore || restScore) specific = true;
  }
  return { score, hits, specific };
}

function scoreName(tokensInName: Set<string>, name: string, word: string): number {
  if (tokensInName.has(word)) return 3;
  return name.includes(word) ? 2 : 0;
}

function scoreRole(role: string, word: string): number {
  const single = word.length > 3 ? word.replace(/s$/, '') : word;
  return ROLE_WORDS[single]?.includes(role) || single === role ? 2 : 0;
}
