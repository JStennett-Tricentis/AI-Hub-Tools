/* ============================================================
   JWT Manager Tool - BaseTool subclass
   Generate, manage, and decode Tricentis JWT tokens
   ============================================================ */

(function () {
  'use strict';

  const { showToast, copyToClipboard: utilCopy, escapeHtml } = window.HubUtils;

  // Helper: build an empty-state DOM node safely
  function buildEmptyState(iconChar, text, hint) {
    const wrapper = document.createElement('div');
    wrapper.className = 'empty-state';

    const icon = document.createElement('div');
    icon.className = 'empty-state-icon';
    icon.textContent = iconChar;
    wrapper.appendChild(icon);

    const msg = document.createElement('div');
    msg.className = 'empty-state-text';
    msg.textContent = text;
    wrapper.appendChild(msg);

    if (hint) {
      const h = document.createElement('div');
      h.className = 'empty-state-hint';
      h.textContent = hint;
      wrapper.appendChild(h);
    }
    return wrapper;
  }

  class JwtManagerTool extends window.BaseTool {
    constructor() {
      super({
        id: 'jwt-manager',
        name: 'JWT Manager',
        icon: '\u{1F511}',
        category: 'Security',
      });

      this.state = {
        environments: [],
        selectedEnv: '',
        products: {},
        selectedProduct: '',
        profiles: {},
        profileToken: null,
        tenants: [],
        passphraseStatus: {},
        tokens: new Map(),      // tenantIndex -> { token, payload }
        bulkResults: null,
        activeTab: 'tokens',
        decodeResult: null,
        manageAddEnv: '',
      };

      this.dom = {};
      this._pendingAction = null;
      this._decodeTimer = null;
      this._manageError = null;
      this._adHoc = { sub: '', aid: '', l2cid: '', token: null, payload: null };
    }

    init() {
      super.init();
      this.cacheDom();
      this.setupEventListeners();
      this.fetchEnvironments();
      this.fetchProducts();
      this.fetchProfiles();
    }

    onActivate() {
      this.refreshPassphraseStatus();
    }

    onReset() {
      this.state.tokens.clear();
      this.state.bulkResults = null;
      this.state.decodeResult = null;
      this.state.profileToken = null;

      if (this.dom.bulkResults) this.dom.bulkResults.classList.add('hidden');
      if (this.dom.bulkResultsBody) this.dom.bulkResultsBody.textContent = '';
      if (this.dom.decodeInput) this.dom.decodeInput.value = '';
      if (this.dom.decodeOverlay) this.dom.decodeOverlay.textContent = '';
      if (this.dom.decodeBadges) this.dom.decodeBadges.textContent = '';
      if (this.dom.profileResult) {
        this.dom.profileResult.classList.add('hidden');
        this.dom.profileResult.textContent = '';
      }

      this._adHoc = { sub: '', aid: '', l2cid: '', token: null, payload: null };
      this.renderDecodeEmpty();
      this.renderTenantGrid();
    }

    cacheDom() {
      const $ = (sel) => this.$(sel);
      this.dom = {
        envButtons: $('#jwtEnvButtons'),
        productButtons: $('#jwtProductButtons'),
        passphraseDot: $('#jwtPassphraseDot'),
        passphraseLabel: $('#jwtPassphraseLabel'),
        bulkGenerateBtn: $('#jwtBulkGenerate'),
        bulkResults: $('#jwtBulkResults'),
        bulkResultsBody: $('#jwtBulkResultsBody'),
        copyAllBulkBtn: $('#jwtCopyAllBulk'),
        profileSelect: $('#jwtProfileSelect'),
        profileGenerateBtn: $('#jwtProfileGenerate'),
        profileResult: $('#jwtProfileResult'),
        tenantGrid: $('#jwtTenantGrid'),
        tenantsEmpty: $('#jwtTenantsEmpty'),
        tabTokens: $('#jwtTabTokens'),
        tabTokensLeft: $('#jwtTabTokensLeft'),
        tabDecode: $('#jwtTabDecode'),
        tabDecodeLeft: $('#jwtTabDecodeLeft'),
        decodeInput: $('#jwtDecodeInput'),
        decodeOverlay: $('#jwtDecodeOverlay'),
        decodeBadges: $('#jwtDecodeBadges'),
        decodeResults: $('#jwtDecodeResults'),
        modal: $('#jwtPassphraseModal'),
        modalEnvLabel: $('#jwtModalEnvLabel'),
        modalError: $('#jwtModalError'),
        modalInput: $('#jwtPassphraseInput'),
        modalSubmitBtn: $('#jwtModalSubmit'),
        modalCancelBtn: $('#jwtModalCancel'),
        // Manage tab
        tabManage: $('#jwtTabManage'),
        tabManageLeft: $('#jwtTabManageLeft'),
        addTenantEnvBtns: $('#jwtAddTenantEnvBtns'),
        addTenantName: $('#jwtAddTenantName'),
        addTenantSub: $('#jwtAddTenantSub'),
        addTenantAid: $('#jwtAddTenantAid'),
        addTenantL2cid: $('#jwtAddTenantL2cid'),
        addTenantRoles: $('#jwtAddTenantRoles'),
        addTenantBtn: $('#jwtAddTenantBtn'),
        addProductName: $('#jwtAddProductName'),
        addProductIss: $('#jwtAddProductIss'),
        addProductBtn: $('#jwtAddProductBtn'),
        addProfileKey: $('#jwtAddProfileKey'),
        addProfileDesc: $('#jwtAddProfileDesc'),
        addProfileSub: $('#jwtAddProfileSub'),
        addProfileAid: $('#jwtAddProfileAid'),
        addProfileUid: $('#jwtAddProfileUid'),
        addProfileEmail: $('#jwtAddProfileEmail'),
        addProfileRoles: $('#jwtAddProfileRoles'),
        addProfileBtn: $('#jwtAddProfileBtn'),
        manageTenantList: $('#jwtManageTenantList'),
        manageTenantEnvLabel: $('#jwtManageTenantEnvLabel'),
        manageProductList: $('#jwtManageProductList'),
        manageProfileList: $('#jwtManageProfileList'),
      };
    }

    setupEventListeners() {
      // Tab switching
      this.$$('[data-jwt-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.$$('[data-jwt-tab]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.activeTab = btn.dataset.jwtTab;
          this.updateTabVisibility();
        });
      });

      // Bulk generate
      if (this.dom.bulkGenerateBtn) {
        this.dom.bulkGenerateBtn.addEventListener('click', () => {
          this.withPassphrase(() => this.bulkGenerate());
        });
      }

      // Copy all bulk
      if (this.dom.copyAllBulkBtn) {
        this.dom.copyAllBulkBtn.addEventListener('click', () => this.copyAllBulk());
      }

      // Profile generate
      if (this.dom.profileGenerateBtn) {
        this.dom.profileGenerateBtn.addEventListener('click', () => {
          this.withPassphrase(() => this.generateProfileToken());
        });
      }

      // Decode input with debounce
      if (this.dom.decodeInput) {
        this.dom.decodeInput.addEventListener('input', () => {
          this.updateDecodeOverlay();
          clearTimeout(this._decodeTimer);
          this._decodeTimer = setTimeout(() => this.decodeToken(), 300);
        });

        // Sync scroll between textarea and overlay
        this.dom.decodeInput.addEventListener('scroll', () => {
          if (this.dom.decodeOverlay) {
            this.dom.decodeOverlay.scrollTop = this.dom.decodeInput.scrollTop;
          }
        });
      }

      // Modal submit
      if (this.dom.modalSubmitBtn) {
        this.dom.modalSubmitBtn.addEventListener('click', () => this.submitPassphrase());
      }

      // Modal cancel
      if (this.dom.modalCancelBtn) {
        this.dom.modalCancelBtn.addEventListener('click', () => this.hideModal());
      }

      // Modal backdrop click
      if (this.dom.modal) {
        this.dom.modal.addEventListener('click', (e) => {
          if (e.target === this.dom.modal) this.hideModal();
        });
      }

      // Modal enter key
      if (this.dom.modalInput) {
        this.dom.modalInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this.submitPassphrase();
        });
      }

      // Manage: Add Tenant
      if (this.dom.addTenantBtn) {
        this.dom.addTenantBtn.addEventListener('click', () => this.addTenant());
      }

      // Manage: Add Product
      if (this.dom.addProductBtn) {
        this.dom.addProductBtn.addEventListener('click', () => this.addProduct());
      }

      // Manage: Add Profile
      if (this.dom.addProfileBtn) {
        this.dom.addProfileBtn.addEventListener('click', () => this.addProfile());
      }
    }

    updateTabVisibility() {
      const isTokens = this.state.activeTab === 'tokens';
      const isDecode = this.state.activeTab === 'decode';
      const isManage = this.state.activeTab === 'manage';

      if (this.dom.tabTokens) this.dom.tabTokens.classList.toggle('active', isTokens);
      if (this.dom.tabTokensLeft) this.dom.tabTokensLeft.classList.toggle('active', isTokens);
      if (this.dom.tabDecode) this.dom.tabDecode.classList.toggle('active', isDecode);
      if (this.dom.tabDecodeLeft) this.dom.tabDecodeLeft.classList.toggle('active', isDecode);
      if (this.dom.tabManage) this.dom.tabManage.classList.toggle('active', isManage);
      if (this.dom.tabManageLeft) this.dom.tabManageLeft.classList.toggle('active', isManage);

      if (isManage) this.renderManageTab();
    }

    // ---- API Calls ----

    async fetchEnvironments() {
      try {
        const res = await fetch('/api/jwt/environments');
        const data = await res.json();
        this.state.environments = data.environments || [];
        if (this.state.environments.length > 0 && !this.state.manageAddEnv) {
          this.state.manageAddEnv = this.state.environments[0];
        }
        this.renderEnvButtons();
        if (this.state.environments.length > 0) {
          this.selectEnv(this.state.environments[0]);
        }
      } catch (e) {
        console.error('Failed to fetch JWT environments:', e);
      }
    }

    async fetchProducts() {
      try {
        const res = await fetch('/api/jwt/products');
        const data = await res.json();
        this.state.products = data.products || {};
        this.state.selectedProduct = data.default || Object.keys(this.state.products)[0] || '';
        this.renderProductButtons();
      } catch (e) {
        console.error('Failed to fetch JWT products:', e);
      }
    }

    async fetchProfiles() {
      try {
        const res = await fetch('/api/jwt/profiles');
        const data = await res.json();
        this.state.profiles = data.profiles || {};
        this.renderProfileDropdown();
      } catch (e) {
        console.error('Failed to fetch JWT profiles:', e);
      }
    }

    async fetchTenants(env) {
      try {
        const res = await fetch('/api/jwt/tenants?env=' + encodeURIComponent(env));
        const data = await res.json();
        this.state.tenants = data.tenants || [];
        this.state.tokens.clear();
        this.state.bulkResults = null;
        if (this.dom.bulkResults) this.dom.bulkResults.classList.add('hidden');
        this.renderTenantGrid();
      } catch (e) {
        console.error('Failed to fetch tenants:', e);
      }
    }

    async refreshPassphraseStatus() {
      try {
        const res = await fetch('/api/jwt/passphrase/status');
        const data = await res.json();
        this.state.passphraseStatus = data.cached || {};
        this.updatePassphraseIndicator();
      } catch (e) {
        console.error('Failed to fetch passphrase status:', e);
      }
    }

    async selectEnv(env) {
      this.state.selectedEnv = env;
      if (!this.state.manageAddEnv) this.state.manageAddEnv = env;
      this.renderEnvButtons();
      await Promise.all([
        this.fetchTenants(env),
        this.refreshPassphraseStatus(),
      ]);
      if (this.state.activeTab === 'manage') this.renderManageTab();
    }

    selectProduct(product) {
      this.state.selectedProduct = product;
      this.renderProductButtons();
    }

    // ---- Passphrase Flow ----

    withPassphrase(action) {
      const env = this.state.selectedEnv;
      if (!env) {
        showToast('Select an environment first', 'error');
        return;
      }

      if (this.state.passphraseStatus[env]) {
        action();
      } else {
        this._pendingAction = action;
        this.showModal(env);
      }
    }

    showModal(env) {
      if (this.dom.modalEnvLabel) this.dom.modalEnvLabel.textContent = env;
      if (this.dom.modalInput) this.dom.modalInput.value = '';
      if (this.dom.modalError) {
        this.dom.modalError.classList.add('hidden');
        this.dom.modalError.textContent = '';
      }
      if (this.dom.modal) this.dom.modal.classList.remove('hidden');
      setTimeout(() => {
        if (this.dom.modalInput) this.dom.modalInput.focus();
      }, 100);
    }

    hideModal() {
      if (this.dom.modal) this.dom.modal.classList.add('hidden');
      this._pendingAction = null;
    }

    async submitPassphrase() {
      const passphrase = this.dom.modalInput?.value;
      if (!passphrase) return;

      const env = this.state.selectedEnv;
      try {
        const res = await fetch('/api/jwt/passphrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ environment: env, passphrase }),
        });
        const data = await res.json();

        if (data.success) {
          await this.refreshPassphraseStatus();
          if (this.dom.modal) this.dom.modal.classList.add('hidden');
          showToast('Passphrase accepted for ' + env);

          if (this._pendingAction) {
            const action = this._pendingAction;
            this._pendingAction = null;
            action();
          }
        } else {
          if (this.dom.modalError) {
            this.dom.modalError.textContent = data.error || 'Wrong passphrase';
            this.dom.modalError.classList.remove('hidden');
          }
          if (this.dom.modalInput) {
            this.dom.modalInput.value = '';
            this.dom.modalInput.focus();
          }
        }
      } catch (e) {
        if (this.dom.modalError) {
          this.dom.modalError.textContent = 'Network error';
          this.dom.modalError.classList.remove('hidden');
        }
      }
    }

    // ---- Token Generation ----

    async generateToken(tenantIndex) {
      const env = this.state.selectedEnv;
      try {
        const res = await fetch('/api/jwt/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: env,
            tenantIndex,
            product: this.state.selectedProduct,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Generation failed', 'error');
          return;
        }
        this.state.tokens.set(tenantIndex, { token: data.token, payload: data.payload });
        this.renderTenantCard(tenantIndex);
        showToast('Token generated');
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      }
    }

    async bulkGenerate() {
      const env = this.state.selectedEnv;
      const btn = this.dom.bulkGenerateBtn;
      if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

      try {
        const res = await fetch('/api/jwt/bulk-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: env,
            product: this.state.selectedProduct,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Bulk generation failed', 'error');
          return;
        }

        this.state.bulkResults = data.results;

        // Also populate the tokens map
        data.results.forEach((r, i) => {
          if (r.token) {
            this.state.tokens.set(i, { token: r.token, payload: null });
          }
        });

        this.renderBulkResults();
        this.renderTenantGrid();
        showToast('Bulk generation complete: ' + data.results.filter(r => r.token).length + '/' + data.results.length);
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Bulk Generate All'; }
      }
    }

    async generateProfileToken() {
      const env = this.state.selectedEnv;
      const profile = this.dom.profileSelect?.value;
      if (!profile) {
        showToast('Select a profile first', 'error');
        return;
      }

      try {
        const res = await fetch('/api/jwt/generate-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: env,
            product: this.state.selectedProduct,
            profile,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Profile generation failed', 'error');
          return;
        }

        this.state.profileToken = { token: data.token, payload: data.payload, profile };
        this.renderProfileResult();
        showToast('Profile token generated');
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      }
    }

    // ---- Decode ----

    updateDecodeOverlay() {
      const raw = this.dom.decodeInput?.value || '';
      if (!this.dom.decodeOverlay) return;

      if (!raw.trim()) {
        this.dom.decodeOverlay.textContent = '';
        return;
      }

      const parts = raw.split('.');
      if (parts.length !== 3) {
        this.dom.decodeOverlay.textContent = raw;
        return;
      }

      this.dom.decodeOverlay.textContent = '';
      const span = (text, cls) => {
        const el = document.createElement('span');
        el.className = cls;
        el.textContent = text;
        return el;
      };

      this.dom.decodeOverlay.appendChild(span(parts[0], 'jwt-part-header'));
      this.dom.decodeOverlay.appendChild(span('.', 'jwt-part-dot'));
      this.dom.decodeOverlay.appendChild(span(parts[1], 'jwt-part-payload'));
      this.dom.decodeOverlay.appendChild(span('.', 'jwt-part-dot'));
      this.dom.decodeOverlay.appendChild(span(parts[2], 'jwt-part-signature'));
    }

    async decodeToken() {
      const raw = (this.dom.decodeInput?.value || '').trim();
      if (!raw) {
        this.state.decodeResult = null;
        this.renderDecodeEmpty();
        if (this.dom.decodeBadges) this.dom.decodeBadges.textContent = '';
        return;
      }

      // Quick format check
      const parts = raw.split('.');
      if (parts.length !== 3) {
        this.renderDecodeError('Invalid JWT format \u2014 expected three dot-separated segments');
        if (this.dom.decodeBadges) this.dom.decodeBadges.textContent = '';
        return;
      }

      try {
        const res = await fetch('/api/jwt/decode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: raw }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.renderDecodeError(data.error || 'Decode failed');
          return;
        }

        this.state.decodeResult = data;
        this.renderDecodeResults(data);
      } catch (e) {
        this.renderDecodeError('Network error');
      }
    }

    // ---- Rendering ----

    renderEnvButtons() {
      if (!this.dom.envButtons) return;
      this.dom.envButtons.textContent = '';

      this.state.environments.forEach(env => {
        const btn = document.createElement('button');
        btn.className = 'jwt-env-btn' + (env === this.state.selectedEnv ? ' active' : '');
        btn.textContent = env;
        btn.addEventListener('click', () => this.selectEnv(env));
        this.dom.envButtons.appendChild(btn);
      });
    }

    renderProductButtons() {
      if (!this.dom.productButtons) return;
      this.dom.productButtons.textContent = '';

      Object.keys(this.state.products).forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'jwt-product-btn' + (key === this.state.selectedProduct ? ' active' : '');
        btn.textContent = key;
        btn.addEventListener('click', () => this.selectProduct(key));
        this.dom.productButtons.appendChild(btn);
      });
    }

    renderProfileDropdown() {
      if (!this.dom.profileSelect) return;
      // Clear existing options except the placeholder
      this.dom.profileSelect.textContent = '';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select profile...';
      this.dom.profileSelect.appendChild(placeholder);

      Object.entries(this.state.profiles).forEach(([key, profile]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = key + (profile.description ? ' \u2014 ' + profile.description : '');
        this.dom.profileSelect.appendChild(opt);
      });
    }

    renderProfileResult() {
      if (!this.dom.profileResult || !this.state.profileToken) return;

      this.dom.profileResult.classList.remove('hidden');
      this.dom.profileResult.textContent = '';

      const { token, payload, profile } = this.state.profileToken;

      // Header
      const header = document.createElement('div');
      header.className = 'jwt-profile-result-header';

      const title = document.createElement('span');
      title.textContent = 'Profile: ' + profile;
      header.appendChild(title);

      const badges = document.createElement('span');
      const issBadge = document.createElement('span');
      issBadge.className = 'badge badge-metric';
      issBadge.textContent = 'iss: ' + (payload.iss || '');
      badges.appendChild(issBadge);
      header.appendChild(badges);

      this.dom.profileResult.appendChild(header);

      // Body with token display
      const body = document.createElement('div');
      body.className = 'jwt-profile-result-body';
      body.appendChild(this.createTokenDisplay({ token, payload }));
      this.dom.profileResult.appendChild(body);
    }

    updatePassphraseIndicator() {
      const env = this.state.selectedEnv;
      const cached = this.state.passphraseStatus[env];

      if (this.dom.passphraseDot) {
        this.dom.passphraseDot.classList.toggle('cached', !!cached);
      }
      if (this.dom.passphraseLabel) {
        this.dom.passphraseLabel.textContent = cached
          ? 'Passphrase cached'
          : 'No passphrase';
      }
    }

    renderTenantGrid() {
      if (!this.dom.tenantGrid) return;
      this.dom.tenantGrid.textContent = '';

      // Ad-hoc card always first (full width)
      this.dom.tenantGrid.appendChild(this.createAdHocCard());

      if (this.state.tenants.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'jwt-tenant-section-divider';
        empty.textContent = 'No tenants for this environment';
        this.dom.tenantGrid.appendChild(empty);
        return;
      }

      const autoIndices = [];
      const manualIndices = [];
      this.state.tenants.forEach((t, i) => {
        if (t.name.startsWith('Auto:')) autoIndices.push(i);
        else manualIndices.push(i);
      });

      if (autoIndices.length > 0) {
        this.dom.tenantGrid.appendChild(this.createSectionDivider('Automated'));
        autoIndices.forEach(i => this.dom.tenantGrid.appendChild(this.createTenantCard(i)));
      }

      if (manualIndices.length > 0) {
        this.dom.tenantGrid.appendChild(this.createSectionDivider('Manual'));
        manualIndices.forEach(i => this.dom.tenantGrid.appendChild(this.createTenantCard(i)));
      }
    }

    createSectionDivider(label) {
      const div = document.createElement('div');
      div.className = 'jwt-tenant-section-divider';
      div.textContent = label;
      return div;
    }

    createAdHocCard() {
      const s = this._adHoc;
      const card = document.createElement('div');
      card.className = 'jwt-adhoc-card';

      // Header
      const header = document.createElement('div');
      header.className = 'jwt-adhoc-header';
      const title = document.createElement('span');
      title.className = 'jwt-adhoc-title';
      title.textContent = 'Ad-hoc';
      const hint = document.createElement('span');
      hint.className = 'jwt-adhoc-hint';
      hint.textContent = 'Generate a one-off token without saving';
      header.appendChild(title);
      header.appendChild(hint);
      card.appendChild(header);

      // Form row
      const form = document.createElement('div');
      form.className = 'jwt-adhoc-form';

      const mkInput = (placeholder, key, wide) => {
        const inp = document.createElement('input');
        inp.className = 'form-input jwt-adhoc-input' + (wide ? ' jwt-adhoc-input-wide' : '');
        inp.placeholder = placeholder;
        inp.value = s[key] || '';
        inp.autocomplete = 'off';
        inp.addEventListener('input', () => { s[key] = inp.value; });
        return inp;
      };

      form.appendChild(mkInput('sub (email)', 'sub', false));
      form.appendChild(mkInput('aid', 'aid', false));
      form.appendChild(mkInput('l2cid', 'l2cid', true));

      const genBtn = document.createElement('button');
      genBtn.className = 'btn btn-primary btn-sm';
      genBtn.textContent = 'Generate';
      genBtn.addEventListener('click', () => {
        this.withPassphrase(() => this.generateAdHocToken());
      });
      form.appendChild(genBtn);
      card.appendChild(form);

      // Token result
      if (s.token) {
        card.appendChild(this.createTokenDisplay({ token: s.token, payload: s.payload }));
      }

      return card;
    }

    async generateAdHocToken() {
      const { sub, aid, l2cid } = this._adHoc;
      if (!sub || !aid || !l2cid) {
        showToast('sub, aid, and l2cid are required', 'error');
        return;
      }
      const env = this.state.selectedEnv;
      try {
        const res = await fetch('/api/jwt/generate-adhoc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ environment: env, sub, aid, l2cid, product: this.state.selectedProduct }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Ad-hoc generation failed', 'error');
          return;
        }
        this._adHoc.token = data.token;
        this._adHoc.payload = data.payload;
        // Re-render just the ad-hoc card
        const existing = this.dom.tenantGrid?.querySelector('.jwt-adhoc-card');
        if (existing) existing.replaceWith(this.createAdHocCard());
        showToast('Ad-hoc token generated');
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      }
    }

    createTenantCard(index) {
      const tenant = this.state.tenants[index];
      const tokenData = this.state.tokens.get(index);

      const card = document.createElement('div');
      card.className = 'jwt-tenant-card';
      card.dataset.tenantIndex = index;

      // Header
      const header = document.createElement('div');
      header.className = 'jwt-tenant-card-header';

      const name = document.createElement('span');
      name.className = 'jwt-tenant-name';
      name.textContent = tenant.name;
      name.title = tenant.name;
      header.appendChild(name);

      const badge = document.createElement('span');
      badge.className = 'badge badge-token';
      badge.textContent = tenant.environment;
      header.appendChild(badge);

      card.appendChild(header);

      // Body
      const body = document.createElement('div');
      body.className = 'jwt-tenant-card-body';

      // Meta
      const meta = document.createElement('div');
      meta.className = 'jwt-tenant-meta';

      const aidRow = this.createMetaRow('aid', tenant.aid);
      const subRow = this.createMetaRow('sub', tenant.sub);
      meta.appendChild(aidRow);
      meta.appendChild(subRow);
      body.appendChild(meta);

      // Actions
      const actions = document.createElement('div');
      actions.className = 'jwt-tenant-actions';

      const genBtn = document.createElement('button');
      genBtn.className = 'btn btn-primary btn-sm';
      genBtn.textContent = 'Generate';
      genBtn.addEventListener('click', () => {
        this.withPassphrase(() => this.generateToken(index));
      });
      actions.appendChild(genBtn);

      body.appendChild(actions);

      // Token display (if generated)
      if (tokenData) {
        body.appendChild(this.createTokenDisplay(tokenData));
      }

      card.appendChild(body);
      return card;
    }

    renderTenantCard(index) {
      if (!this.dom.tenantGrid) return;
      const existing = this.dom.tenantGrid.querySelector('[data-tenant-index="' + index + '"]');
      const newCard = this.createTenantCard(index);
      if (existing) {
        existing.replaceWith(newCard);
      }
    }

    createMetaRow(label, value) {
      const row = document.createElement('div');
      row.className = 'jwt-tenant-meta-row';

      const l = document.createElement('span');
      l.className = 'jwt-tenant-meta-label';
      l.textContent = label;

      const v = document.createElement('span');
      v.className = 'jwt-tenant-meta-value';
      v.textContent = value;
      v.title = value;

      row.appendChild(l);
      row.appendChild(v);
      return row;
    }

    createTokenDisplay(tokenData) {
      const container = document.createElement('div');
      container.className = 'jwt-token-display';

      const box = document.createElement('div');
      box.className = 'jwt-token-box';

      const text = document.createElement('div');
      text.className = 'jwt-token-text';
      text.textContent = tokenData.token;
      box.appendChild(text);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-secondary btn-sm jwt-token-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', async () => {
        await utilCopy(tokenData.token);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
      });
      box.appendChild(copyBtn);

      container.appendChild(box);

      // Expiry badge
      if (tokenData.payload) {
        const footer = document.createElement('div');
        footer.className = 'jwt-token-footer';

        const exp = tokenData.payload.exp;
        if (exp != null) {
          const now = Math.floor(Date.now() / 1000);
          const expired = exp < now;
          const badge = document.createElement('span');
          badge.className = 'badge ' + (expired ? 'badge-error' : 'badge-metric');
          badge.textContent = expired ? 'Expired' : 'Valid';
          footer.appendChild(badge);
        }

        container.appendChild(footer);
      }

      return container;
    }

    renderBulkResults() {
      if (!this.state.bulkResults || !this.dom.bulkResultsBody) return;

      this.dom.bulkResults.classList.remove('hidden');
      this.dom.bulkResultsBody.textContent = '';

      this.state.bulkResults.forEach((r, i) => {
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.textContent = r.name;
        tr.appendChild(tdName);

        const tdStatus = document.createElement('td');
        if (r.token) {
          tdStatus.className = 'jwt-bulk-status-ok';
          tdStatus.textContent = 'OK';
        } else {
          tdStatus.className = 'jwt-bulk-status-error';
          tdStatus.textContent = r.error || 'Failed';
        }
        tr.appendChild(tdStatus);

        const tdActions = document.createElement('td');
        if (r.token) {
          const copyBtn = document.createElement('button');
          copyBtn.className = 'btn btn-secondary btn-sm';
          copyBtn.textContent = 'Copy';
          copyBtn.addEventListener('click', async () => {
            await utilCopy(r.token);
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
          });
          tdActions.appendChild(copyBtn);
        }
        tr.appendChild(tdActions);

        this.dom.bulkResultsBody.appendChild(tr);
      });
    }

    async copyAllBulk() {
      if (!this.state.bulkResults) return;

      const env = this.state.selectedEnv;
      const lines = this.state.bulkResults
        .filter(r => r.token)
        .map(r => '### ' + r.name + ' [' + env + ']\n' + r.token)
        .join('\n\n');

      await utilCopy(lines);
      showToast('All tokens copied');
    }

    renderDecodeEmpty() {
      if (!this.dom.decodeResults) return;
      this.dom.decodeResults.textContent = '';
      this.dom.decodeResults.appendChild(
        buildEmptyState('\u{1F50D}', 'Paste a JWT to see decoded output')
      );
    }

    renderDecodeError(message) {
      if (!this.dom.decodeResults) return;
      this.dom.decodeResults.textContent = '';
      this.dom.decodeResults.appendChild(
        buildEmptyState('\u26A0', message)
      );
    }

    renderDecodeResults(data) {
      if (!this.dom.decodeResults) return;
      this.dom.decodeResults.textContent = '';

      // Badges
      if (this.dom.decodeBadges) {
        this.dom.decodeBadges.textContent = '';

        // Expiry badge
        if (data.expiryStatus) {
          const badge = document.createElement('span');
          if (data.expiryStatus.expired) {
            badge.className = 'badge badge-error';
            badge.textContent = 'Expired';
          } else {
            badge.className = 'badge badge-metric';
            badge.textContent = 'Valid \u2014 ' + data.expiryStatus.remaining + ' remaining';
          }
          this.dom.decodeBadges.appendChild(badge);
        }

        // Signature note
        const sigBadge = document.createElement('span');
        sigBadge.className = 'badge badge-ended';
        sigBadge.textContent = 'Signature not verified';
        this.dom.decodeBadges.appendChild(sigBadge);
      }

      // Header section
      this.dom.decodeResults.appendChild(
        this.createDecodeSection('Header', data.header, 'header-color')
      );

      // Payload section
      this.dom.decodeResults.appendChild(
        this.createDecodeSection('Payload', data.payload, 'payload-color')
      );

      // Signature section
      const raw = (this.dom.decodeInput?.value || '').trim();
      const sigPart = raw.split('.')[2] || '';
      this.dom.decodeResults.appendChild(
        this.createDecodeSection('Signature', sigPart, 'signature-color', true)
      );
    }

    createDecodeSection(title, content, colorClass, isRaw) {
      const section = document.createElement('div');
      section.className = 'jwt-decode-section';

      const header = document.createElement('div');
      header.className = 'jwt-decode-section-header ' + colorClass;
      header.textContent = title;
      section.appendChild(header);

      const body = document.createElement('div');
      body.className = 'jwt-decode-section-body';

      const pre = document.createElement('pre');
      if (isRaw) {
        pre.textContent = content;
      } else {
        pre.textContent = JSON.stringify(content, null, 2);
      }
      body.appendChild(pre);
      section.appendChild(body);

      return section;
    }

    // ---- Manage Tab ----

    selectManageAddEnv(env) {
      this.state.manageAddEnv = env;
      this.renderManageAddTenantEnvButtons();
    }

    renderManageAddTenantEnvButtons() {
      if (!this.dom.addTenantEnvBtns) return;
      this.dom.addTenantEnvBtns.textContent = '';
      this.state.environments.forEach(env => {
        const btn = document.createElement('button');
        btn.className = 'jwt-env-btn' + (env === this.state.manageAddEnv ? ' active' : '');
        btn.textContent = env;
        btn.addEventListener('click', () => this.selectManageAddEnv(env));
        this.dom.addTenantEnvBtns.appendChild(btn);
      });
    }

    async addTenant() {
      const name = this.dom.addTenantName?.value.trim();
      const sub = this.dom.addTenantSub?.value.trim();
      const aid = this.dom.addTenantAid?.value.trim();
      const l2cid = this.dom.addTenantL2cid?.value.trim();
      const roles = this.dom.addTenantRoles?.value.trim();
      const environment = this.state.manageAddEnv;

      if (!name || !sub || !aid || !l2cid || !environment) {
        showToast('Name, environment, sub, aid, and l2cid are required', 'error');
        return;
      }

      try {
        const res = await fetch('/api/jwt/tenants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, environment, sub, aid, l2cid, roles: roles || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Failed to add tenant', 'error');
          return;
        }
        showToast('Tenant added: ' + name);
        // Clear form
        ['addTenantName', 'addTenantSub', 'addTenantAid', 'addTenantL2cid', 'addTenantRoles'].forEach(k => {
          if (this.dom[k]) this.dom[k].value = '';
        });
        // Refresh tenant list if we're on the affected env
        if (environment === this.state.selectedEnv) {
          await this.fetchTenants(environment);
        }
        this.renderManageTab();
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      }
    }

    async removeTenant(name, environment) {
      try {
        const res = await fetch('/api/jwt/tenants', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, environment }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Failed to remove tenant', 'error');
          return;
        }
        showToast('Tenant removed: ' + name);
        if (environment === this.state.selectedEnv) {
          await this.fetchTenants(environment);
        }
        this.renderManageTab();
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      }
    }

    async addProduct() {
      const name = this.dom.addProductName?.value.trim();
      const iss = this.dom.addProductIss?.value.trim();

      if (!name) {
        showToast('Product name is required', 'error');
        return;
      }

      try {
        const res = await fetch('/api/jwt/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, iss: iss || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Failed to add product', 'error');
          return;
        }
        showToast('Product added: ' + name);
        if (this.dom.addProductName) this.dom.addProductName.value = '';
        if (this.dom.addProductIss) this.dom.addProductIss.value = '';
        // Refresh products state and buttons
        await this.fetchProducts();
        this.renderManageTab();
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      }
    }

    async removeProduct(name) {
      try {
        const res = await fetch('/api/jwt/products/' + encodeURIComponent(name), {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Failed to remove product', 'error');
          return;
        }
        showToast('Product removed: ' + name);
        await this.fetchProducts();
        this.renderManageTab();
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      }
    }

    async addProfile() {
      const name = this.dom.addProfileKey?.value.trim();
      const description = this.dom.addProfileDesc?.value.trim();
      const sub = this.dom.addProfileSub?.value.trim();
      const aid = this.dom.addProfileAid?.value.trim();
      const uid = this.dom.addProfileUid?.value.trim();
      const email = this.dom.addProfileEmail?.value.trim();
      const roles = this.dom.addProfileRoles?.value.trim();

      if (!name || !sub || !aid) {
        showToast('Key, sub, and aid are required', 'error');
        return;
      }

      try {
        const res = await fetch('/api/jwt/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name, description: description || undefined,
            sub, aid,
            uid: uid || undefined,
            email: email || undefined,
            roles: roles || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Failed to add profile', 'error');
          return;
        }
        showToast('Profile added: ' + name);
        ['addProfileKey', 'addProfileDesc', 'addProfileSub', 'addProfileAid',
          'addProfileUid', 'addProfileEmail', 'addProfileRoles'].forEach(k => {
          if (this.dom[k]) this.dom[k].value = '';
        });
        await this.fetchProfiles();
        this.renderManageTab();
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      }
    }

    async removeProfile(name) {
      try {
        const res = await fetch('/api/jwt/profiles/' + encodeURIComponent(name), {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Failed to remove profile', 'error');
          return;
        }
        showToast('Profile removed: ' + name);
        await this.fetchProfiles();
        this.renderManageTab();
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      }
    }

    renderManageTab() {
      this.renderManageAddTenantEnvButtons();
      this.renderManageTenantList();
      this.renderManageProductList();
      this.renderManageProfileList();
    }

    renderManageTenantList() {
      if (!this.dom.manageTenantList) return;
      this.dom.manageTenantList.textContent = '';

      if (this.dom.manageTenantEnvLabel) {
        this.dom.manageTenantEnvLabel.textContent = this.state.selectedEnv
          ? this.state.selectedEnv.toUpperCase()
          : '';
      }

      const tenants = this.state.tenants;
      if (tenants.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'jwt-manage-empty';
        empty.textContent = 'No tenants in this environment';
        this.dom.manageTenantList.appendChild(empty);
        return;
      }

      tenants.forEach(t => {
        const item = document.createElement('div');
        item.className = 'jwt-manage-list-item';

        const info = document.createElement('div');
        info.className = 'jwt-manage-item-info';

        const label = document.createElement('span');
        label.className = 'jwt-manage-item-label';
        label.textContent = t.name;

        const meta = document.createElement('span');
        meta.className = 'jwt-manage-item-meta';
        meta.textContent = t.aid;

        info.appendChild(label);
        info.appendChild(meta);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm jwt-manage-remove-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => this.removeTenant(t.name, t.environment));

        item.appendChild(info);
        item.appendChild(removeBtn);
        this.dom.manageTenantList.appendChild(item);
      });
    }

    renderManageProductList() {
      if (!this.dom.manageProductList) return;
      this.dom.manageProductList.textContent = '';

      const products = this.state.products;
      const keys = Object.keys(products);

      if (keys.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'jwt-manage-empty';
        empty.textContent = 'No products configured';
        this.dom.manageProductList.appendChild(empty);
        return;
      }

      keys.forEach(key => {
        const item = document.createElement('div');
        item.className = 'jwt-manage-list-item';

        const info = document.createElement('div');
        info.className = 'jwt-manage-item-info';

        const label = document.createElement('span');
        label.className = 'jwt-manage-item-label';
        label.textContent = key;

        const meta = document.createElement('span');
        meta.className = 'jwt-manage-item-meta';
        meta.textContent = 'iss: ' + products[key].iss;

        info.appendChild(label);
        info.appendChild(meta);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm jwt-manage-remove-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => this.removeProduct(key));

        item.appendChild(info);
        item.appendChild(removeBtn);
        this.dom.manageProductList.appendChild(item);
      });
    }

    renderManageProfileList() {
      if (!this.dom.manageProfileList) return;
      this.dom.manageProfileList.textContent = '';

      const profiles = this.state.profiles;
      const keys = Object.keys(profiles);

      if (keys.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'jwt-manage-empty';
        empty.textContent = 'No profiles configured';
        this.dom.manageProfileList.appendChild(empty);
        return;
      }

      keys.forEach(key => {
        const profile = profiles[key];
        const item = document.createElement('div');
        item.className = 'jwt-manage-list-item';

        const info = document.createElement('div');
        info.className = 'jwt-manage-item-info';

        const label = document.createElement('span');
        label.className = 'jwt-manage-item-label';
        label.textContent = key;

        const meta = document.createElement('span');
        meta.className = 'jwt-manage-item-meta';
        meta.textContent = profile.description || profile.sub;

        info.appendChild(label);
        info.appendChild(meta);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn btn-sm jwt-manage-remove-btn';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => this.removeProfile(key));

        item.appendChild(info);
        item.appendChild(removeBtn);
        this.dom.manageProfileList.appendChild(item);
      });
    }
  }

  // Register the tool
  window.ToolRegistry.register(new JwtManagerTool());
})();
