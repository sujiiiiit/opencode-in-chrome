import { createContext, useContext } from 'react';
import type { NoticeState } from '@/lib/opencode/background';

type Background = {
  /** Background subagents whose completion reached the chat, by child session id. */
  finished?: Record<string, NoticeState>;
};

const BackgroundContext = createContext<Background>({});
export const BackgroundProvider = BackgroundContext.Provider;
export const useBackground = () => useContext(BackgroundContext);
