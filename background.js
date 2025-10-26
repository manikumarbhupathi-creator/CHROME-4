let currentTabId = null;
let currentDomain = null;
let startTime = null;

const productiveWebsites = [
  "stackoverflow.com",
  "github.com",
  "stackoverflow.co",
  "codepen.io",
  "developer.mozilla.org"
];

const unproductiveWebsites = [
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "reddit.com",
  "youtube.com"
];

// Helper: extract domain from URL
function extractDomain(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return null;
  }
}

// Store time data locally before sending to backend
let timeData = {};

// Start tracking time
function startTracking(tabId, domain) {
  if (currentTabId !== null) {
    stopTracking();
  }
  currentTabId = tabId;
  currentDomain = domain;
  startTime = Date.now();
}

// Stop tracking and save data
function stopTracking() {
  if (currentDomain && startTime) {
    let elapsed = Date.now() - startTime;
    if (!timeData[currentDomain]) {
      timeData[currentDomain] = 0;
    }
    timeData[currentDomain] += elapsed;
    // Optionally send periodically to backend here or save persistently using chrome.storage
  }
  currentTabId = null;
  currentDomain = null;
  startTime = null;
}

// Send time data to backend every 5 minutes
function sendDataToBackend() {
  const userId = "demo-user"; // For demo, a static userId. In real use, use auth
  const payload = {
    userId,
    timeData,
    timestamp: new Date().toISOString()
  };

  fetch('http://localhost:5000/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(() => {
    // reset local data after sending
    timeData = {};
  }).catch(err => {
    console.error("Failed to send data to backend:", err);
  });
}

// Listen to tab changes
chrome.tabs.onActivated.addListener(async activeInfo => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  const domain = extractDomain(tab.url);
  if (domain) {
    stopTracking();
    startTracking(activeInfo.tabId, domain);
  }
});

// Listen to tab updates (e.g., URL changes in same tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTabId && changeInfo.url) {
    const domain = extractDomain(changeInfo.url);
    stopTracking();
    if (domain) {
      startTracking(tabId, domain);
    }
  }
});

// When extension starts, track currently active tab
chrome.tabs.query({active: true, currentWindow: true}).then(tabs => {
  if (tabs[0]) {
    const domain = extractDomain(tabs[0].url);
    if (domain) {
      startTracking(tabs[0].id, domain);
    }
  }
});

// Interval to send data to backend every 5 minutes (300000 ms)
setInterval(() => {
  stopTracking();
  sendDataToBackend();
  // Restart tracking current tab after sending
  chrome.tabs.query({active: true, currentWindow: true}).then(tabs => {
    if (tabs[0]) {
      const domain = extractDomain(tabs[0].url);
      if (domain) {
        startTracking(tabs[0].id, domain);
      }
    }
  });
}, 300000);
