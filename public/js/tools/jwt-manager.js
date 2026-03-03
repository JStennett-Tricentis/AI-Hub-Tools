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
    wrapper.className = 'jwt-empty-state';

    const icon = document.createElement('div');
    icon.className = 'jwt-empty-state-icon';
    icon.textContent = iconChar;
    wrapper.appendChild(icon);

    const msg = document.createElement('div');
    msg.className = 'jwt-empty-state-text';
    msg.textContent = text;
    wrapper.appendChild(msg);

    if (hint) {
      const h = document.createElement('div');
      h.className = 'jwt-empty-state-hint';
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
        tenants: [],
        passphraseStatus: {},
        tokens: new Map(),      // tenantIndex -> { token, payload }
        bulkResults: null,
        activeTab: 'tokens',
        decodeResult: null,
      };

      this.dom = {};
      this._pendingAction = null;
      this._decodeTimer = null;
    }

    init() {
      super.init();
      this.cacheDom();
      this.setupEventListeners();
      this.fetchEnvironments();
    }

    onActivate() {
      this.refreshPassphraseStatus();
    }

    onReset() {
      this.state.tokens.clear();
      this.state.bulkResults = null;
      this.state.decodeResult = null;

      if (this.dom.bulkResults) this.dom.bulkResults.classList.add('hidden');
      if (this.dom.bulkResultsBody) this.dom.bulkResultsBody.textContent = '';
      if (this.dom.decodeInput) this.dom.decodeInput.value = '';
      if (this.dom.decodeOverlay) this.dom.decodeOverlay.textContent = '';
      if (this.dom.decodeBadges) this.dom.decodeBadges.textContent = '';

      this.renderDecodeEmpty();
      this.renderTenantGrid();
    }

    cacheDom() {
      const $ = (sel) => this.$(sel);
      this.dom = {
        envButtons: $('#jwtEnvButtons'),
        passphraseDot: $('#jwtPassphraseDot'),
        passphraseLabel: $('#jwtPassphraseLabel'),
        bulkGenerateBtn: $('#jwtBulkGenerate'),
        bulkResults: $('#jwtBulkResults'),
        bulkResultsBody: $('#jwtBulkResultsBody'),
        copyAllBulkBtn: $('#jwtCopyAllBulk'),
        tenantGrid: $('#jwtTenantGrid'),
        tenantsEmpty: $('#jwtTenantsEmpty'),
        tabTokens: $('#jwtTabTokens'),
        tabDecode: $('#jwtTabDecode'),
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
    }

    updateTabVisibility() {
      if (this.dom.tabTokens) {
        this.dom.tabTokens.classList.toggle('active', this.state.activeTab === 'tokens');
      }
      if (this.dom.tabDecode) {
        this.dom.tabDecode.classList.toggle('active', this.state.activeTab === 'decode');
      }
    }

    // ---- API Calls ----

    async fetchEnvironments() {
      try {
        const res = await fetch('/api/jwt/environments');
        const data = await res.json();
        this.state.environments = data.environments || [];
        this.renderEnvButtons();
        if (this.state.environments.length > 0) {
          this.selectEnv(this.state.environments[0]);
        }
      } catch (e) {
        console.error('Failed to fetch JWT environments:', e);
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
      this.renderEnvButtons();
      await Promise.all([
        this.fetchTenants(env),
        this.refreshPassphraseStatus(),
      ]);
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
          body: JSON.stringify({ environment: env, tenantIndex }),
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
          body: JSON.stringify({ environment: env }),
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

      if (this.state.tenants.length === 0) {
        this.dom.tenantGrid.appendChild(
          buildEmptyState('\u{1F511}', 'No tenants found for this environment')
        );
        return;
      }

      this.state.tenants.forEach((_, i) => {
        this.dom.tenantGrid.appendChild(this.createTenantCard(i));
      });
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
      badge.className = 'jwt-badge jwt-badge-env';
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
          badge.className = 'jwt-badge ' + (expired ? 'jwt-badge-expired' : 'jwt-badge-valid');
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
            badge.className = 'jwt-badge jwt-badge-expired';
            badge.textContent = 'Expired';
          } else {
            badge.className = 'jwt-badge jwt-badge-valid';
            badge.textContent = 'Valid \u2014 ' + data.expiryStatus.remaining + ' remaining';
          }
          this.dom.decodeBadges.appendChild(badge);
        }

        // Signature note
        const sigBadge = document.createElement('span');
        sigBadge.className = 'jwt-badge jwt-badge-warning';
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
  }

  // Register the tool
  window.ToolRegistry.register(new JwtManagerTool());
})();
