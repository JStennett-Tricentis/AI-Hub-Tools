/* ============================================================
   Shared Utilities - Extracted from both tools
   ============================================================ */

window.HubUtils = (function () {
  'use strict';

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function formatNumber(n) {
    if (n === null || n === undefined) return '0';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatCurrency(n, decimals) {
    if (decimals === undefined) decimals = 6;
    if (n === null || n === undefined) return '$0.000000';
    return '$' + n.toFixed(decimals);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    }
  }

  function syntaxHighlight(json) {
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(?:\\.|[^"\\])*")\s*:/g,
      '<span class="json-key">$1</span>:'
    ).replace(
      /:\s*("(?:\\.|[^"\\])*")/g,
      ': <span class="json-string">$1</span>'
    ).replace(
      /:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
      ': <span class="json-number">$1</span>'
    ).replace(
      /:\s*(true|false)/g,
      ': <span class="json-boolean">$1</span>'
    ).replace(
      /:\s*(null)/g,
      ': <span class="json-null">$1</span>'
    ).replace(
      /(?<=[\[,]\s*\n?\s*)("(?:\\.|[^"\\])*")(?=\s*[,\]])/g,
      '<span class="json-string">$1</span>'
    );
  }

  let toastTimer = null;
  function showToast(message, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message;
    t.className = 'toast show';
    if (type) t.classList.add(type);
    else t.classList.add('success');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
    }, 2500);
  }

  return {
    formatBytes,
    formatNumber,
    formatCurrency,
    escapeHtml,
    generateUUID,
    copyToClipboard,
    syntaxHighlight,
    showToast,
  };
})();
