// A bot check ("Just a moment...", "unusual traffic") is not the page the model asked for, and
// reading it as if it were gives it empty results to puzzle over. The tools say what it is.
const CHALLENGE_TITLE = /^(just a moment|attention required|verify you are human|are you a robot|security check|checking your browser|one more step|human verification|please verify)/i;
const CHALLENGE_URL = /\/sorry\/index|__cf_chl_|\/cdn-cgi\/challenge|\/captcha(\/|\?|$)/i;

const NOTE =
  'This is a bot check, not the page you asked for. Do not try to solve or get around it. ' +
  'Tell the user: they can complete it in this tab and you retry, or you can use another source.';

/** A note for the model when the tab shows a bot-check page; undefined otherwise. */
export function botCheckNote(tab: { title?: string; url?: string }): string | undefined {
  return CHALLENGE_TITLE.test(tab.title ?? '') || CHALLENGE_URL.test(tab.url ?? '') ? NOTE : undefined;
}
