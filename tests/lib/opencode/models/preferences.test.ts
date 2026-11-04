import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  EMPTY_PREFERENCES,
  PREFERENCES_KEY,
  RECENT_LIMIT,
  isVisible,
  loadPreferences,
  parsePreferences,
  pushRecent,
  savePreferences,
  setVisibility,
  toggleFavorite,
  watchPreferences,
} from '@/lib/opencode/models/preferences';

const m = (modelID: string, providerID = 'p') => ({ providerID, modelID });

describe('model preferences', () => {
  it('keeps the recent models newest first, unique and capped', () => {
    let prefs = EMPTY_PREFERENCES;
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'b']) prefs = pushRecent(prefs, m(id));
    expect(prefs.recent.map((x) => x.modelID)).toEqual(['b', 'f', 'e', 'd', 'c']);
    expect(prefs.recent).toHaveLength(RECENT_LIMIT);
  });

  it('adds a favorite at the front and removes it on a second toggle', () => {
    let prefs = toggleFavorite(toggleFavorite(EMPTY_PREFERENCES, m('a')), m('b'));
    expect(prefs.favorite.map((x) => x.modelID)).toEqual(['b', 'a']);
    prefs = toggleFavorite(prefs, m('b'));
    expect(prefs.favorite.map((x) => x.modelID)).toEqual(['a']);
  });

  it('overrides the default visibility per model', () => {
    const defaults = new Set(['p:a']);
    expect(isVisible(EMPTY_PREFERENCES, defaults, m('a'))).toBe(true);
    expect(isVisible(EMPTY_PREFERENCES, defaults, m('b'))).toBe(false);
    const prefs = setVisibility(setVisibility(EMPTY_PREFERENCES, [m('a')], false), [m('b'), m('a')], true);
    expect(isVisible(prefs, defaults, m('a'))).toBe(true);
    expect(isVisible(prefs, defaults, m('b'))).toBe(true);
    expect(prefs.user).toHaveLength(2);
  });

  it('drops malformed stored values', () => {
    expect(
      parsePreferences({
        user: [{ providerID: 'p', modelID: 'a', visibility: 'maybe' }, { providerID: 'p', modelID: 'b', visibility: 'hide' }],
        recent: [m('a'), 'junk', m('a')],
        favorite: null,
        // Stored by an earlier version (efforts per model); no longer kept.
        variant: { 'p/a': 'high' },
      }),
    ).toEqual({
      user: [{ providerID: 'p', modelID: 'b', visibility: 'hide' }],
      recent: [m('a')],
      favorite: [],
    });
    expect(parsePreferences('nope')).toEqual(EMPTY_PREFERENCES);
  });

  it('round-trips through storage and reports changes from another panel', async () => {
    const seen = vi.fn();
    const stop = watchPreferences(seen);
    const prefs = pushRecent(EMPTY_PREFERENCES, m('a'));
    await savePreferences(prefs);
    expect(await loadPreferences()).toEqual(prefs);
    await vi.waitFor(() => expect(seen).toHaveBeenCalledWith(prefs));
    stop();
    await fakeBrowser.storage.local.set({ [PREFERENCES_KEY]: EMPTY_PREFERENCES });
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
