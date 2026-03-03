/* ============================================================
   BaseTool - Base class for all tool implementations
   Lifecycle: constructor() -> init() (lazy) -> onActivate() / onDeactivate() -> onReset()
   ============================================================ */

window.BaseTool = (function () {
  'use strict';

  class BaseTool {
    constructor(config) {
      // Validate manifest if available
      if (window.ToolManifest) {
        window.ToolManifest.validate(config);
      }
      this.id = config.id;
      this.name = config.name;
      this.icon = config.icon || '';
      this.category = config.category || 'Tools';
      this.initialized = false;
      this.panel = null;
    }

    // Scoped query within this tool's panel
    $(selector) {
      if (!this.panel) this.panel = document.getElementById('tool-' + this.id);
      return this.panel ? this.panel.querySelector(selector) : null;
    }

    $$(selector) {
      if (!this.panel) this.panel = document.getElementById('tool-' + this.id);
      return this.panel ? this.panel.querySelectorAll(selector) : [];
    }

    // Called once on first activation (lazy init)
    init() {
      this.initialized = true;
    }

    // Called every time tool becomes active
    onActivate() {}

    // Called when tool loses focus
    onDeactivate() {}

    // Called when user clicks Reset
    onReset() {}
  }

  return BaseTool;
})();
