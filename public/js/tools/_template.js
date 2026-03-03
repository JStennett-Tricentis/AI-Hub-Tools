/* ============================================================
   _template.js - Example skeleton for creating a new tool

   Steps to create a new tool:
   1. Copy this file and rename it (e.g., my-tool.js)
   2. Update the class name, id, name, icon, and category
   3. Add a panel div in index.html: <div id="tool-my-tool" class="tool-panel" role="tabpanel">
   4. Add a <script src="/js/tools/my-tool.js"></script> tag in index.html (before main.js)
   5. Implement init(), onActivate(), onDeactivate(), and onReset()
   ============================================================ */

(function () {
  'use strict';

  class TemplateTool extends window.BaseTool {
    constructor() {
      super({
        id: 'template-tool',       // Must match panel div id: tool-{id}
        name: 'Template Tool',      // Display name in sidebar
        icon: '\u2B50',              // Emoji or Unicode icon
        category: 'Examples',        // Sidebar category group
      });
    }

    /**
     * Called once on first activation (lazy init).
     * Set up DOM references, event listeners, and fetch data here.
     */
    init() {
      super.init();

      // Cache DOM references using scoped queries
      // this.dom = {
      //   myButton: this.$('#my-button'),
      //   myOutput: this.$('#my-output'),
      // };

      // Set up event listeners
      // if (this.dom.myButton) {
      //   this.dom.myButton.addEventListener('click', () => this.handleClick());
      // }
    }

    /**
     * Called every time this tool becomes the active tool.
     */
    onActivate() {
      // Refresh data or update UI when tool becomes visible
    }

    /**
     * Called when user switches away from this tool.
     */
    onDeactivate() {
      // Clean up or pause any ongoing work
    }

    /**
     * Called when user clicks the Reset button while this tool is active.
     */
    onReset() {
      // Reset all form fields and state to defaults
    }
  }

  // Register the tool - this makes it appear in the sidebar
  // Uncomment the line below when ready to use:
  // window.ToolRegistry.register(new TemplateTool());
})();
