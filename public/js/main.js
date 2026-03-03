/* ============================================================
   AI Hub Tools - Boot Sequence
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // Initialize the app shell (sidebar, reset button, event listeners)
  window.AppShell.init();

  // Initialize tooltips
  if (window.Tooltip) window.Tooltip.init();

  // Activate the default tool
  window.ToolRegistry.activate('request-generator');
});
