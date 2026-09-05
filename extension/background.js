/**
 * FraudShield AI — Chrome / Edge Background Service Worker (Manifest V3)
 * Handles Context Menus, API orchestration, JWT authentication, and in-tab messaging.
 */

const DEFAULT_SETTINGS = {
  apiBase: 'http://localhost:8000/api',
  dashboardUrl: 'http://localhost:3000',
  authToken: null,
  autoLoginEnabled: true,
  demoEmail: 'demo@fraudshield.local',
  demoPassword: 'Demo@12345'
};

// Initialize settings and Context Menus on installation
chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  const merged = { ...DEFAULT_SETTINGS, ...current };
  await chrome.storage.local.set(merged);

  // Clear existing menus to avoid duplicates on reloads
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'fraudshield-scan-link',
      title: '🛡️ Scan link with FraudShield AI',
      contexts: ['link']
    });

    chrome.contextMenus.create({
      id: 'fraudshield-scan-text',
      title: '🛡️ Analyze selected text for scam / fraud',
      contexts: ['selection']
    });

    chrome.contextMenus.create({
      id: 'fraudshield-scan-page',
      title: '🛡️ Check this page for phishing threats',
      contexts: ['page']
    });
  });

  console.log('[FraudShield] Service worker installed & context menus configured.');
});

/**
 * Retrieve or automatically refresh the JWT bearer token.
 */
async function getValidToken() {
  const storage = await chrome.storage.local.get(['authToken', 'apiBase', 'autoLoginEnabled', 'demoEmail', 'demoPassword']);
  if (storage.authToken) {
    return storage.authToken;
  }

  if (!storage.autoLoginEnabled) {
    return null;
  }

  // Attempt automatic background authentication
  try {
    const apiBase = storage.apiBase || DEFAULT_SETTINGS.apiBase;
    const response = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: storage.demoEmail || DEFAULT_SETTINGS.demoEmail,
        password: storage.demoPassword || DEFAULT_SETTINGS.demoPassword
      })
    });

    if (response.ok) {
      const data = await response.json();
      const token = data.access_token || data.token;
      if (token) {
        await chrome.storage.local.set({ authToken: token, user: data.user });
        console.log('[FraudShield] Background authentication successful.');
        return token;
      }
    }
  } catch (err) {
    console.warn('[FraudShield] Background auto-login failed:', err);
  }

  return null;
}

/**
 * Send scan request to FraudShield backend API.
 */
async function performScan(endpoint, payload) {
  const token = await getValidToken();
  const storage = await chrome.storage.local.get(['apiBase']);
  const apiBase = storage.apiBase || DEFAULT_SETTINGS.apiBase;

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBase}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (response.status === 401) {
    // Invalidate cached token and try auto-login once
    await chrome.storage.local.remove('authToken');
    const freshToken = await getValidToken();
    if (freshToken) {
      headers['Authorization'] = `Bearer ${freshToken}`;
      const retryResponse = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (retryResponse.ok) {
        return await retryResponse.json();
      }
    }
    throw new Error('Authentication required. Please open the FraudShield popup to sign in.');
  }

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.detail || `Analysis failed with status ${response.status}`);
  }

  return await response.json();
}

/**
 * Notify the content script on the active tab or trigger native notification fallback.
 */
async function sendResultToTab(tabId, resultData, target) {
  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        action: 'DISPLAY_SCAN_VERDICT',
        data: resultData,
        target: target
      });
      return;
    } catch (e) {
      // Content script may not run on chrome:// or restricted pages
      console.log('[FraudShield] Could not message tab, falling back to desktop notification:', e);
    }
  }

  // Fallback desktop notification
  const band = (resultData.risk_level || resultData.risk_band || 'UNKNOWN').toUpperCase();
  const score = resultData.risk_score !== undefined ? `${Math.round(resultData.risk_score)}/100` : '';
  const title = `FraudShield AI: ${band} (${score})`;
  const message = resultData.explanation || resultData.summary || `Scan completed for ${target}`;

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message.length > 180 ? message.substring(0, 180) + '…' : message,
    priority: 2
  });
}

// Context menu click listeners
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const tabId = tab ? tab.id : null;

  try {
    if (info.menuItemId === 'fraudshield-scan-link') {
      const link = info.linkUrl;
      if (!link) return;
      
      // Notify content script that scan has started
      if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'SCAN_STARTED', target: link }).catch(() => {});
      }

      const result = await performScan('/scan/url', { url: link });
      await sendResultToTab(tabId, result, link);
    } else if (info.menuItemId === 'fraudshield-scan-text') {
      const text = info.selectionText;
      if (!text) return;

      if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'SCAN_STARTED', target: 'Selected text' }).catch(() => {});
      }

      const result = await performScan('/scan/message', { message: text });
      await sendResultToTab(tabId, result, text);
    } else if (info.menuItemId === 'fraudshield-scan-page') {
      const pageUrl = info.pageUrl || tab?.url;
      if (!pageUrl) return;

      if (tabId) {
        chrome.tabs.sendMessage(tabId, { action: 'SCAN_STARTED', target: pageUrl }).catch(() => {});
      }

      const result = await performScan('/scan/url', { url: pageUrl });
      await sendResultToTab(tabId, result, pageUrl);
    }
  } catch (err) {
    console.error('[FraudShield] Scan error:', err);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        action: 'DISPLAY_SCAN_ERROR',
        error: err.message || 'Scan could not be completed.'
      }).catch(() => {});
    }
  }
});

// Runtime message listener for popup & content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'RUN_URL_SCAN') {
    performScan('/scan/url', { url: request.url })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'RUN_TEXT_SCAN') {
    performScan('/scan/message', { message: request.text })
      .then((data) => sendResponse({ success: true, data }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'TEST_CONNECTION') {
    const storagePromise = chrome.storage.local.get(['apiBase']);
    storagePromise.then(async (storage) => {
      const apiBase = storage.apiBase || DEFAULT_SETTINGS.apiBase;
      try {
        const res = await fetch(`${apiBase}/health`);
        if (res.ok) {
          const body = await res.json();
          sendResponse({ success: true, healthy: true, details: body });
        } else {
          sendResponse({ success: false, healthy: false, status: res.status });
        }
      } catch (e) {
        sendResponse({ success: false, healthy: false, error: e.message });
      }
    });
    return true;
  }
});
