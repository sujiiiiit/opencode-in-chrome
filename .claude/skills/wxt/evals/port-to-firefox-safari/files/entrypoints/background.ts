export default defineBackground(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (msg.type === 'summarize') {
      const html = await fetch(msg.url).then((r) => r.text());
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.DOM_PARSER],
        justification: 'Parse fetched HTML',
      });
      const text = await chrome.runtime.sendMessage({ type: 'parse', html });
      return text.slice(0, 500);
    }
  });
});
