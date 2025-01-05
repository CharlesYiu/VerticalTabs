function getFaviconUrl(url) {
    return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
}
async function getCurrentTab() {
    return (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]
}
async function getAllTabs() {
    return await chrome.tabs.query({ currentWindow: true })
}