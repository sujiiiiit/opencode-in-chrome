chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'parse') {
    const doc = new DOMParser().parseFromString(msg.html, 'text/html');
    sendResponse(doc.body.innerText);
  }
});
