// Content script — extracts article text from the current page's DOM

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXTRACT') {
    sendResponse(extractArticle())
  }
})

function extractArticle() {
  // Try semantic selectors in priority order
  const selectors = [
    'article',
    '[role="main"]',
    'main',
    '.article-body',
    '.post-content',
    '.entry-content',
    '.story-body',
    '.article__body',
    '.article-content',
    '#article-body',
  ]

  let el = null
  for (const sel of selectors) {
    const candidate = document.querySelector(sel)
    if (candidate && candidate.innerText.trim().length > 200) {
      el = candidate
      break
    }
  }

  // Fallback to body if nothing better found
  if (!el) el = document.body

  // Get title from h1 or document.title
  const h1 = document.querySelector('h1')
  const title = h1?.innerText?.trim() || document.title || ''

  // Clean up text — collapse whitespace
  const text = el.innerText.replace(/\n{3,}/g, '\n\n').trim()

  return {
    text,
    title,
    url: window.location.href,
  }
}
