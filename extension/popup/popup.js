/**
 * FraudShield AI — Extension Popup Controller
 * Manages UI tabs, active tab query, scans, and server health checks.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const statusIndicator = document.getElementById('status-indicator');
  const statusDot = statusIndicator.querySelector('.status-dot');
  const statusLabel = document.getElementById('status-label');

  const currentUrlDisplay = document.getElementById('current-url');
  const btnScanCurrent = document.getElementById('btn-scan-current');

  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  const inputUrl = document.getElementById('input-url');
  const btnClearUrl = document.getElementById('btn-clear-url');
  const btnRunUrl = document.getElementById('btn-run-url');
  const presetUrlPhish = document.getElementById('preset-url-phish');
  const presetUrlSafe = document.getElementById('preset-url-safe');

  const inputMessage = document.getElementById('input-message');
  const btnRunMessage = document.getElementById('btn-run-message');
  const presetMsgOtp = document.getElementById('preset-msg-otp');
  const presetMsgKyc = document.getElementById('preset-msg-kyc');

  const settingApiBase = document.getElementById('setting-api-base');
  const settingDashboardUrl = document.getElementById('setting-dashboard-url');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnQuickAuth = document.getElementById('btn-quick-auth');
  const settingsFeedback = document.getElementById('settings-feedback');

  const resultsContainer = document.getElementById('results-container');
  const verdictBanner = document.getElementById('verdict-banner');
  const verdictTag = document.getElementById('verdict-tag');
  const verdictTitle = document.getElementById('verdict-title');
  const scoreNumber = document.getElementById('score-number');
  const resultExplanation = document.getElementById('result-explanation');
  const resultIndicatorsBox = document.getElementById('result-indicators-box');
  const indicatorsList = document.getElementById('indicators-list');
  const linkDashboardDetail = document.getElementById('link-dashboard-detail');

  const errorBanner = document.getElementById('error-banner');
  const errorText = document.getElementById('error-text');

  let activeTabUrl = '';

  // 1. Initialize Active Tab URL
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && tabs[0].url) {
      activeTabUrl = tabs[0].url;
      currentUrlDisplay.textContent = activeTabUrl;
      currentUrlDisplay.title = activeTabUrl;

      // Don't auto-fill internal chrome:// pages into scanner
      if (activeTabUrl.startsWith('http://') || activeTabUrl.startsWith('https://')) {
        inputUrl.value = activeTabUrl;
      }
    } else {
      currentUrlDisplay.textContent = 'No active page';
    }
  } catch (e) {
    currentUrlDisplay.textContent = 'Unable to query tab';
  }

  // 2. Load Stored Configuration
  const settings = await chrome.storage.local.get(['apiBase', 'dashboardUrl']);
  if (settings.apiBase) settingApiBase.value = settings.apiBase;
  if (settings.dashboardUrl) settingDashboardUrl.value = settings.dashboardUrl;

  // 3. Check Backend Connection Health
  checkServerHealth();

  function checkServerHealth() {
    chrome.runtime.sendMessage({ action: 'TEST_CONNECTION' }, (response) => {
      if (chrome.runtime.lastError || !response || !response.healthy) {
        statusDot.className = 'status-dot offline';
        statusLabel.textContent = 'Backend Offline';
        statusIndicator.title = 'Cannot connect to FraudShield AI backend. Ensure docker/backend is running at http://localhost:8000.';
      } else {
        statusDot.className = 'status-dot online';
        statusLabel.textContent = 'Backend Online';
        statusIndicator.title = 'Connected to FraudShield AI engine';
      }
    });
  }

  // 4. Tab Switching
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetId)?.classList.add('active');
    });
  });

  // 5. Presets
  presetUrlPhish?.addEventListener('click', () => {
    inputUrl.value = 'http://secure-login-verify-account.example.com/login?account=12345';
  });

  presetUrlSafe?.addEventListener('click', () => {
    inputUrl.value = 'https://www.google.com';
  });

  presetMsgOtp?.addEventListener('click', () => {
    inputMessage.value = 'URGENT: Your bank account has been blocked due to suspicious activity. Verify your identity immediately by clicking http://sbi-verify-kyc.co/login and share the OTP sent to your phone.';
  });

  presetMsgKyc?.addEventListener('click', () => {
    inputMessage.value = 'Dear customer, your PAN KYC is expired. Services will be halted in 24 hours. Update now at http://192.168.14.22/kyc-update.php.';
  });

  btnClearUrl?.addEventListener('click', () => {
    inputUrl.value = '';
    inputUrl.focus();
  });

  // 6. Action: Scan Current Active Tab
  btnScanCurrent?.addEventListener('click', () => {
    if (!activeTabUrl || (!activeTabUrl.startsWith('http://') && !activeTabUrl.startsWith('https://'))) {
      showError('Please open a standard website (http/https) to scan.');
      return;
    }

    // Switch to URL tab and execute
    tabButtons[0].click();
    inputUrl.value = activeTabUrl;
    btnRunUrl.click();
  });

  // 7. Action: Run URL Scan
  btnRunUrl?.addEventListener('click', async () => {
    const url = inputUrl.value.trim();
    if (!url) {
      showError('Please enter a URL to inspect.');
      return;
    }

    hideError();
    setLoading(btnRunUrl, true);
    hideResults();

    chrome.runtime.sendMessage({ action: 'RUN_URL_SCAN', url }, (response) => {
      setLoading(btnRunUrl, false);
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
        return;
      }

      if (!response.success) {
        showError(response.error || 'URL scan failed.');
        return;
      }

      displayResults(response.data);
    });
  });

  // 8. Action: Run Message Scan
  btnRunMessage?.addEventListener('click', async () => {
    const text = inputMessage.value.trim();
    if (!text) {
      showError('Please paste message content to scan.');
      return;
    }

    hideError();
    setLoading(btnRunMessage, true);
    hideResults();

    chrome.runtime.sendMessage({ action: 'RUN_TEXT_SCAN', text }, (response) => {
      setLoading(btnRunMessage, false);
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
        return;
      }

      if (!response.success) {
        showError(response.error || 'Message scan failed.');
        return;
      }

      displayResults(response.data);
    });
  });

  // 9. Display Scan Verdicts
  function displayResults(data) {
    resultsContainer.style.display = 'flex';

    const rawBand = data.risk_level || data.risk_band || 'UNKNOWN';
    const band = String(rawBand).toLowerCase();
    const bandLabel = String(rawBand).toUpperCase();
    const score = data.risk_score !== undefined ? Math.round(data.risk_score) : 0;
    const explanation = data.explanation || data.summary || 'Scan completed successfully.';
    const indicators = Array.isArray(data.indicators) ? data.indicators : [];

    // Configure class and badges
    verdictBanner.className = 'verdict-banner';
    if (band === 'critical') verdictBanner.classList.add('verdict-critical');
    else if (band === 'high') verdictBanner.classList.add('verdict-high');
    else if (band === 'medium') verdictBanner.classList.add('verdict-medium');
    else verdictBanner.classList.add('verdict-safe');

    verdictTag.textContent = `${bandLabel} RISK`;
    verdictTitle.textContent = band === 'safe' || band === 'low' ? 'Verified Safe' : 'Threat Detected';
    scoreNumber.textContent = score;

    resultExplanation.textContent = explanation;

    // Render Indicators
    if (indicators.length > 0) {
      resultIndicatorsBox.style.display = 'block';
      indicatorsList.innerHTML = indicators
        .slice(0, 4)
        .map(ind => {
          const text = typeof ind === 'string' ? ind : (ind.label || ind.detail || ind.description || ind.rule_name || ind.name || 'Risk indicator');
          return `<li>${escapeHtml(text)}</li>`;
        })
        .join('');
    } else {
      resultIndicatorsBox.style.display = 'none';
      indicatorsList.innerHTML = '';
    }

    // Dashboard Detail Link
    const dashboardBase = settingDashboardUrl.value.trim() || 'http://localhost:3000';
    const scanId = data.scan?.scan_id || data.scan_id || data.id;
    if (scanId) {
      linkDashboardDetail.href = `${dashboardBase}/dashboard/scans/${scanId}`;
      linkDashboardDetail.textContent = 'View Full Scan Report In Dashboard ↗';
    } else {
      linkDashboardDetail.href = `${dashboardBase}/dashboard`;
      linkDashboardDetail.textContent = 'Open Dashboard ↗';
    }
  }

  function hideResults() {
    resultsContainer.style.display = 'none';
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorBanner.style.display = 'block';
  }

  function hideError() {
    errorBanner.style.display = 'none';
  }

  function setLoading(btn, isLoading) {
    const textSpan = btn.querySelector('.btn-text');
    const spinnerSpan = btn.querySelector('.btn-spinner');
    if (isLoading) {
      btn.disabled = true;
      if (textSpan) textSpan.style.opacity = '0.5';
      if (spinnerSpan) spinnerSpan.style.display = 'inline-block';
    } else {
      btn.disabled = false;
      if (textSpan) textSpan.style.opacity = '1';
      if (spinnerSpan) spinnerSpan.style.display = 'none';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 10. Settings actions
  btnSaveSettings?.addEventListener('click', async () => {
    const apiBase = settingApiBase.value.trim();
    const dashboardUrl = settingDashboardUrl.value.trim();

    await chrome.storage.local.set({ apiBase, dashboardUrl });
    settingsFeedback.style.color = '#34d399';
    settingsFeedback.textContent = 'Settings saved.';
    setTimeout(() => { settingsFeedback.textContent = ''; }, 3000);
    checkServerHealth();
  });

  btnQuickAuth?.addEventListener('click', async () => {
    settingsFeedback.style.color = '#38bdf8';
    settingsFeedback.textContent = 'Authenticating demo user…';

    try {
      const apiBase = settingApiBase.value.trim() || 'http://localhost:8000/api';
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'demo@fraudshield.local', password: 'Demo@12345' })
      });

      if (res.ok) {
        const body = await res.json();
        const token = body.access_token || body.token;
        await chrome.storage.local.set({ authToken: token, user: body.user });
        settingsFeedback.style.color = '#34d399';
        settingsFeedback.textContent = 'Authenticated as demo@fraudshield.local!';
      } else {
        settingsFeedback.style.color = '#f87171';
        settingsFeedback.textContent = `Auth failed: HTTP ${res.status}`;
      }
    } catch (e) {
      settingsFeedback.style.color = '#f87171';
      settingsFeedback.textContent = `Connection error: ${e.message}`;
    }

    setTimeout(() => { settingsFeedback.textContent = ''; }, 4000);
  });
});
