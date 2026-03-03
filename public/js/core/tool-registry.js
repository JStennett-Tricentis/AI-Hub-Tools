/* ============================================================
   ToolRegistry - Singleton registry for all tools
   ============================================================ */

window.ToolRegistry = (function () {
  'use strict';

  const tools = [];
  let activeTool = null;

  function register(tool) {
    if (!(tool instanceof window.BaseTool)) {
      console.error('ToolRegistry: tool must be an instance of BaseTool', tool);
      return;
    }
    if (tools.find(t => t.id === tool.id)) {
      console.warn('ToolRegistry: tool already registered:', tool.id);
      return;
    }
    tools.push(tool);
  }

  function activate(toolId) {
    const tool = tools.find(t => t.id === toolId);
    if (!tool) {
      console.error('ToolRegistry: unknown tool:', toolId);
      return;
    }

    // Deactivate current
    if (activeTool && activeTool !== tool) {
      activeTool.onDeactivate();
      const prevPanel = document.getElementById('tool-' + activeTool.id);
      if (prevPanel) prevPanel.classList.remove('active');
    }

    // Lazy init
    if (!tool.initialized) {
      tool.init();
    }

    // Activate
    activeTool = tool;
    const panel = document.getElementById('tool-' + tool.id);
    if (panel) panel.classList.add('active');
    tool.onActivate();

    // Dispatch event for nav updates
    document.dispatchEvent(new CustomEvent('tool:activated', { detail: { toolId } }));

    // Focus management: move focus to first interactive element in the panel
    if (panel) {
      const focusTarget = panel.querySelector('select, input:not([type="hidden"]), button:not(.sidebar-item)');
      if (focusTarget) {
        requestAnimationFrame(() => focusTarget.focus());
      }
    }
  }

  function getActive() {
    return activeTool;
  }

  function getAll() {
    return [...tools];
  }

  function getCategories() {
    const categories = {};
    tools.forEach(tool => {
      if (!categories[tool.category]) {
        categories[tool.category] = [];
      }
      categories[tool.category].push(tool);
    });
    return categories;
  }

  return {
    register,
    activate,
    getActive,
    getAll,
    getCategories,
  };
})();
