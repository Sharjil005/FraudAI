/**
 * FraudShield AI — Content Script
 * Displays in-page floating verdicts and scanning indicators.
 */

(() => {
  const HOST_ID = 'fraudshield-overlay-host';

  function getOrCreateHost() {
    let host = document.getElementById(HOST_ID);
    if (!host) {
      host = document.createElement('div');
      host.id = HOST_ID;
      document.body.appendChild(host);
    }
    return host;
  }

  function removeOverlay() {
    const host = document.getElementById(HOST_ID);
    if (host) {
      host.innerHTML = '';
    }
  }

  function renderLoading(target) {
    const host = getOrCreateHost();
    const safeTarget = escapeHtml(target || 'Target');

    host.innerHTML = `
      <div class="fraudshield-card">
        <div class="fraudshield-header">
          <div class="fraudshield-brand">
            <svg viewBox="0 0 24 24"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/></svg>
            <span>FraudShield AI</span>
          </div>
          <button class="fraudshield-close" id="fraudshield-close-btn">&times;</button>
        </div>
        <div class="fraudshield-loading">
          <div class="fraudshield-spinner"></div>
          <div>
            <div style="font-weight: 600; color: #38bdf8;">Running AI Fraud Analysis…</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Inspecting lexical markers & threat database</div>
          </div>
        </div>
        <div class="fraudshield-target-box" style="margin-top: 10px; margin-bottom: 0;">${safeTarget}</div>
      </div>
    `;

    document.getElementById('fraudshield-close-btn')?.addEventListener('click', removeOverlay);
  }

  function renderVerdict(result, target) {
    const host = getOrCreateHost();

    const rawBand = result.risk_level || result.risk_band || 'UNKNOWN';
    const band = String(rawBand).toLowerCase();
    const bandLabel = String(rawBand).toUpperCase();
    const score = result.risk_score !== undefined ? Math.round(result.risk_score) : '—';
    const explanation = result.explanation || result.summary || 'Analysis completed.';
    const indicators = Array.isArray(result.indicators) ? result.indicators.slice(0, 3) : [];
    const scanId = result.scan?.scan_id || result.scan_id || result.id;
    const dashboardLink = scanId 
      ? `http://localhost:3000/dashboard/scans/${scanId}`
      : 'http://localhost:3000/dashboard';

    let riskClass = 'fraudshield-risk-safe';
    if (band === 'critical') riskClass = 'fraudshield-risk-critical';
    else if (band === 'high') riskClass = 'fraudshield-risk-high';
    else if (band === 'medium') riskClass = 'fraudshield-risk-medium';

    const safeTarget = escapeHtml(target || '');
    const indicatorsHtml = indicators.length > 0
      ? `
        <div class="fraudshield-indicators-title">Top Risk Factors</div>
        <ul class="fraudshield-indicators-list">
          ${indicators.map(ind => `<li>${escapeHtml(typeof ind === 'string' ? ind : (ind.label || ind.detail || ind.description || ind.rule_name || ind.name || 'Threat signal detected'))}</li>`).join('')}
        </ul>
      `
      : '';

    host.innerHTML = `
      <div class="fraudshield-card">
        <div class="fraudshield-header">
          <div class="fraudshield-brand">
            <svg viewBox="0 0 24 24"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/></svg>
            <span>FraudShield AI Analysis</span>
          </div>
          <button class="fraudshield-close" id="fraudshield-close-btn">&times;</button>
        </div>

        <div class="fraudshield-verdict-banner ${riskClass}">
          <span class="fraudshield-verdict-title">${bandLabel} RISK</span>
          <span class="fraudshield-score-pill">Score: ${score}/100</span>
        </div>

        ${safeTarget ? `<div class="fraudshield-target-box">${safeTarget}</div>` : ''}

        <div class="fraudshield-explanation">${escapeHtml(explanation)}</div>

        ${indicatorsHtml}

        <div class="fraudshield-actions">
          <a href="${dashboardLink}" target="_blank" rel="noopener noreferrer" class="fraudshield-btn-primary">
            Open in Full Dashboard ↗
          </a>
        </div>
      </div>
    `;

    document.getElementById('fraudshield-close-btn')?.addEventListener('click', removeOverlay);
  }

  function renderError(errorMessage) {
    const host = getOrCreateHost();
    host.innerHTML = `
      <div class="fraudshield-card">
        <div class="fraudshield-header">
          <div class="fraudshield-brand" style="color: #f87171;">
            <svg viewBox="0 0 24 24" style="fill: #f87171;"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/></svg>
            <span>Scan Error</span>
          </div>
          <button class="fraudshield-close" id="fraudshield-close-btn">&times;</button>
        </div>
        <div class="fraudshield-verdict-banner fraudshield-risk-critical">
          <span class="fraudshield-verdict-title">Scan Failed</span>
        </div>
        <div class="fraudshield-explanation" style="color: #fca5a5;">
          ${escapeHtml(errorMessage || 'Could not reach FraudShield AI server. Ensure backend is running at http://localhost:8000.')}
        </div>
      </div>
    `;

    document.getElementById('fraudshield-close-btn')?.addEventListener('click', removeOverlay);
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

  // Runtime listener for actions from background service worker
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'SCAN_STARTED') {
      renderLoading(msg.target);
    } else if (msg.action === 'DISPLAY_SCAN_VERDICT') {
      renderVerdict(msg.data, msg.target);
    } else if (msg.action === 'DISPLAY_SCAN_ERROR') {
      renderError(msg.error);
    }
  });
})();
