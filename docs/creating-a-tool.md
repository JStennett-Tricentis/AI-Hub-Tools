# Creating a New Tool

This guide walks through adding a new tool to the AI Hub Tools application.

## Quick Start (3 Steps)

### 1. Create the JavaScript file

Copy `public/js/tools/_template.js` to `public/js/tools/my-tool.js` and update:

```javascript
(function () {
  'use strict';

  class MyTool extends window.BaseTool {
    constructor() {
      super({
        id: 'my-tool',          // lowercase, hyphens only
        name: 'My Tool',        // sidebar display name
        icon: '\u2B50',          // emoji or unicode character
        category: 'Analysis',    // groups tools in sidebar when > 5 tools
      });
    }

    init() {
      super.init();
      // Cache DOM, set up listeners, fetch data
    }

    onActivate() { /* runs each time tool is shown */ }
    onDeactivate() { /* runs when switching away */ }
    onReset() { /* runs when user clicks Reset */ }
  }

  window.ToolRegistry.register(new MyTool());
})();
```

### 2. Add the HTML panel

In `public/index.html`, add a panel div inside `.app-content`:

```html
<div id="tool-my-tool" class="tool-panel" role="tabpanel">
  <!-- Your tool's HTML here -->
  <div class="main">
    <div class="panel-left">
      <!-- Configuration panel -->
    </div>
    <div class="panel-right">
      <!-- Output panel -->
    </div>
  </div>
</div>
```

The `id` must match the pattern `tool-{your-tool-id}`.

### 3. Add the script tag

In `public/index.html`, add a script tag in the "Tool registrations" section (before `main.js`):

```html
<!-- Tool registrations -->
<script src="/js/tools/request-generator.js"></script>
<script src="/js/tools/usage-calculator.js"></script>
<script src="/js/tools/my-tool.js"></script>  <!-- Add here -->

<!-- Boot -->
<script src="/js/main.js"></script>
```

## Tool Lifecycle

```
constructor()  ->  init()  ->  onActivate() <-> onDeactivate()
                                    |
                               onReset()
```

- **constructor**: Set up config (id, name, icon, category). Runs immediately on page load.
- **init()**: Called once, lazily, on first activation. Do DOM caching and event setup here.
- **onActivate()**: Called each time the tool becomes visible.
- **onDeactivate()**: Called when switching to another tool.
- **onReset()**: Called when user clicks the Reset button.

## Scoped DOM Queries

Use `this.$()` and `this.$$()` to query within your tool's panel only:

```javascript
const myBtn = this.$('#my-button');     // querySelector scoped to panel
const allItems = this.$$('.item');       // querySelectorAll scoped to panel
```

## Shared Utilities

Available via `window.HubUtils`:

| Function | Description |
|----------|-------------|
| `formatBytes(n)` | Format bytes to human-readable (KB, MB) |
| `formatNumber(n)` | Add commas to numbers |
| `formatCurrency(n, decimals)` | Format as `$0.000000` |
| `escapeHtml(str)` | Escape HTML entities |
| `generateUUID()` | Generate UUID v4 |
| `copyToClipboard(text)` | Copy text (async, returns Promise) |
| `syntaxHighlight(json)` | JSON syntax highlighting HTML |
| `showToast(message, type)` | Show toast notification (type: success/error/warning/info) |

## Available CSS Components

Use these class names for consistent styling:

- **Layout**: `.main`, `.panel-left`, `.panel-right`, `.two-column-layout`
- **Forms**: `.form-section`, `.form-group`, `.form-row`, `.form-input`, `.form-select`
- **Buttons**: `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-warning`
- **Cards**: `.card`, `.card-title`, `.result-card`
- **Tabs**: `.tab-bar`, `.tab-btn`, `.segmented`, `.segmented-btn`
- **Toggles**: `.toggle-row`, `.toggle`, `.toggle-slider`
- **Tables**: `.data-table`
- **Toast**: `showToast(msg, 'success')` / `'error'` / `'warning'` / `'info'`

## Tool-Specific CSS

If your tool needs custom styles, create `public/css/tools/my-tool.css` and add it to `public/css/main.css`:

```css
@import 'tools/my-tool.css';
```

Scope all rules under your tool panel to avoid conflicts:

```css
#tool-my-tool .my-custom-class {
  /* styles */
}
```

## Manifest Validation

The `ToolManifest` module validates your config on construction. Common errors:

- `Missing required field: id` - Every tool needs an id
- `No panel element found` - Add the HTML panel div
- `id must be lowercase alphanumeric with hyphens` - Use `my-tool` not `MyTool`

## Categories

When there are more than 5 tools, the sidebar groups them by category. Current categories:

- **Generation** - Tools that generate data/requests
- **Analysis** - Tools that calculate or analyze data

Choose an existing category or create a new one.
