/* ============================================================
   AppShell - Renders sidebar navigation from ToolRegistry
   ============================================================ */

window.AppShell = (function () {
  'use strict';

  const STORAGE_KEY = 'aihub-sidebar-collapsed';
  let sidebarEl = null;
  let bottomNavEl = null;

  function init() {
    renderSidebar();
    renderBottomNav();
    setupResetButton();
    listenForToolActivation();

    // Restore sidebar state
    const collapsed = localStorage.getItem(STORAGE_KEY) === 'true';
    if (collapsed && sidebarEl) {
      sidebarEl.classList.add('collapsed');
    }
    updateToggleIcon();
  }

  function createSidebarItemEl(tool) {
    const btn = document.createElement('button');
    btn.className = 'sidebar-item';
    btn.dataset.toolId = tool.id;
    btn.title = tool.name;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'sidebar-item-icon';
    iconSpan.textContent = tool.icon;
    btn.appendChild(iconSpan);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'sidebar-item-label';
    labelSpan.textContent = tool.name;
    btn.appendChild(labelSpan);

    btn.addEventListener('click', () => {
      window.ToolRegistry.activate(tool.id);
    });

    return btn;
  }

  function renderSidebar() {
    sidebarEl = document.querySelector('.sidebar');
    if (!sidebarEl) return;

    const nav = sidebarEl.querySelector('.sidebar-nav');
    if (!nav) return;

    const tools = window.ToolRegistry.getAll();
    const categories = window.ToolRegistry.getCategories();
    const categoryKeys = Object.keys(categories);
    const useCategories = tools.length > 5;

    // Clear existing nav
    nav.textContent = '';

    if (useCategories) {
      categoryKeys.forEach(cat => {
        const catDiv = document.createElement('div');
        catDiv.className = 'sidebar-category';

        const catLabel = document.createElement('div');
        catLabel.className = 'sidebar-category-label';
        catLabel.textContent = cat;
        catDiv.appendChild(catLabel);

        categories[cat].forEach(tool => {
          catDiv.appendChild(createSidebarItemEl(tool));
        });

        nav.appendChild(catDiv);
      });
    } else {
      tools.forEach(tool => {
        nav.appendChild(createSidebarItemEl(tool));
      });
    }

    // Setup toggle button
    const toggleBtn = sidebarEl.querySelector('.sidebar-toggle-btn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleSidebar);
    }
  }

  function renderBottomNav() {
    bottomNavEl = document.querySelector('.app-bottom-nav');
    if (!bottomNavEl) return;

    const tools = window.ToolRegistry.getAll();
    bottomNavEl.textContent = '';

    tools.forEach(tool => {
      const btn = document.createElement('button');
      btn.className = 'sidebar-item';
      btn.dataset.toolId = tool.id;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'sidebar-item-icon';
      iconSpan.textContent = tool.icon;
      btn.appendChild(iconSpan);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'sidebar-item-label';
      labelSpan.textContent = tool.name;
      btn.appendChild(labelSpan);

      btn.addEventListener('click', () => {
        window.ToolRegistry.activate(tool.id);
      });

      bottomNavEl.appendChild(btn);
    });
  }

  function toggleSidebar() {
    if (!sidebarEl) return;
    sidebarEl.classList.toggle('collapsed');
    const collapsed = sidebarEl.classList.contains('collapsed');
    localStorage.setItem(STORAGE_KEY, collapsed);
    updateToggleIcon();
  }

  function updateToggleIcon() {
    const toggleBtn = sidebarEl?.querySelector('.sidebar-toggle-btn');
    if (!toggleBtn) return;
    const collapsed = sidebarEl.classList.contains('collapsed');
    toggleBtn.textContent = collapsed ? '\u25B6' : '\u25C0';
  }

  function setupResetButton() {
    const btnReset = document.getElementById('btnReset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        const active = window.ToolRegistry.getActive();
        if (active) active.onReset();
      });
    }
  }

  function listenForToolActivation() {
    document.addEventListener('tool:activated', (e) => {
      const toolId = e.detail.toolId;

      // Update sidebar active states and ARIA
      const allItems = document.querySelectorAll('.sidebar-item');
      allItems.forEach(item => {
        const isActive = item.dataset.toolId === toolId;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    });
  }

  return { init };
})();
