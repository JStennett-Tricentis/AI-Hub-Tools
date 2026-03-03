/* ============================================================
   Tooltip - Lightweight tooltip using data-tooltip attributes
   ============================================================ */

window.Tooltip = (function () {
  'use strict';

  let tooltipEl = null;

  function init() {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip';
    tooltipEl.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltipEl);

    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);
  }

  function handleMouseOver(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;

    const text = target.getAttribute('data-tooltip');
    if (!text) return;

    tooltipEl.textContent = text;
    tooltipEl.classList.add('visible');

    const rect = target.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();

    let top = rect.top - tipRect.height - 6;
    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

    // Keep within viewport
    if (top < 4) top = rect.bottom + 6;
    if (left < 4) left = 4;
    if (left + tipRect.width > window.innerWidth - 4) {
      left = window.innerWidth - tipRect.width - 4;
    }

    tooltipEl.style.top = top + 'px';
    tooltipEl.style.left = left + 'px';
  }

  function handleMouseOut(e) {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    tooltipEl.classList.remove('visible');
  }

  return { init };
})();
