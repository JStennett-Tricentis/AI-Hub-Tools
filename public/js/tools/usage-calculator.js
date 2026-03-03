/* ============================================================
   Usage Calculator Tool - Wrapped as BaseTool subclass
   Preserves internal module structure (Calculator, Session, Generator, Pricing)
   ============================================================ */

(function () {
  'use strict';

  class UsageCalculatorTool extends window.BaseTool {
    constructor() {
      super({
        id: 'usage-calculator',
        name: 'Usage Calculator',
        icon: '\u{1F4CA}',
        category: 'Analysis',
      });
    }

    init() {
      super.init();
      // Delegate to existing UsageCalculator module
      if (window.UsageCalculator && typeof window.UsageCalculator.init === 'function') {
        window.UsageCalculator.init();
      }
    }

    onActivate() {
      // Nothing special needed - the module handles its own state
    }

    onDeactivate() {
      // Nothing special needed
    }

    onReset() {
      // Reset is handled per-tab within the calculator
      // For now, just reload the session tracker state
    }
  }

  // Register the tool
  window.ToolRegistry.register(new UsageCalculatorTool());
})();
