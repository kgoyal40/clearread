// Service worker — opens side panel and relays messages

// Open side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id })
})

// Relay messages between side panel and content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXTRACT_ARTICLE') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ error: 'No active tab found' })
        return
      }

      const tabId = tabs[0].id

      // Inject content script on demand (in case declarative injection missed it)
      chrome.scripting.executeScript(
        { target: { tabId }, files: ['content.js'] },
        () => {
          // Ignore injection errors (script may already be injected)
          if (chrome.runtime.lastError) {
            // Still try to send message
          }

          chrome.tabs.sendMessage(tabId, { type: 'EXTRACT' }, (response) => {
            if (chrome.runtime.lastError) {
              sendResponse({ error: 'Could not extract article. Make sure you are on a web page.' })
            } else {
              sendResponse(response)
            }
          })
        }
      )
    })
    return true // keep channel open for async response
  }
})
