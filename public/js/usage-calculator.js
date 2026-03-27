/* ============================================================
   TAIS Usage Credits Calculator - Merged & Scoped JS
   All globals wrapped in IIFE. Exposes only window.UsageCalculator.init()
   ============================================================ */
(function () {
  'use strict';

  // Guard: only init once
  let initialized = false;

  // =============================================
  // data.js globals (scoped inside IIFE)
  // =============================================
  let DEFAULTS = {};
  let PROVIDER_DEFAULTS = {};
  let MODEL_PRICING_OVERRIDES = {};
  let METRIC_FORMULAS = {};
  let MODULES = [];
  let REGIONS = {};
  let MODELS = {};

  const Config = {
    loaded: false,

    async load() {
      const [pricingRes, modelsRes] = await Promise.all([
        fetch('/data/usage-calculator/pricing.json'),
        fetch('/data/usage-calculator/current_models.json')
      ]);

      if (!pricingRes.ok) throw new Error('Failed to load /data/usage-calculator/pricing.json');
      if (!modelsRes.ok) throw new Error('Failed to load /data/usage-calculator/current_models.json');

      const pricing = await pricingRes.json();
      const modelsData = await modelsRes.json();

      DEFAULTS = pricing.defaults;
      PROVIDER_DEFAULTS = pricing.providerDefaults;
      MODEL_PRICING_OVERRIDES = pricing.modelOverrides;
      METRIC_FORMULAS = pricing.metricFormulas;
      MODULES = pricing.modules;

      this.processModels(modelsData, pricing.providerMapping);
      this.loaded = true;
    },

    processModels(data, providerMap) {
      const regions = {};
      const models = {};

      data.items.filter(m => m.enabled).forEach(item => {
        const key = `${item.provider}|${item.platformProvider}`;
        const appProvider = providerMap[key];
        if (!appProvider) return;

        if (!regions[appProvider]) regions[appProvider] = [];
        if (!regions[appProvider].includes(item.location)) {
          regions[appProvider].push(item.location);
        }

        if (!models[appProvider]) models[appProvider] = {};
        if (!models[appProvider][item.location]) models[appProvider][item.location] = [];
        if (!models[appProvider][item.location].includes(item.id)) {
          models[appProvider][item.location].push(item.id);
        }
      });

      REGIONS = regions;
      MODELS = models;
    }
  };

  // =============================================
  // Utility functions (single copy)
  // =============================================
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function formatNumber(n) {
    if (n === null || n === undefined) return '0';
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatCurrency(n, decimals) {
    if (decimals === undefined) decimals = 6;
    if (n === null || n === undefined) return '$0.000000';
    return '$' + n.toFixed(decimals);
  }

  function ucCopyToClipboard(text) {
    return navigator.clipboard.writeText(text);
  }

  // =============================================
  // pricing.js - Pricing module
  // =============================================
  const Pricing = {
    stripModelDateSuffix(model) {
      if (!model) return model;
      let stripped = model;
      if (stripped.match(/^(eu|us)\./)) {
        stripped = stripped.replace(/^(eu|us)\./, '');
      }
      if (stripped.includes('anthropic.')) {
        return null;
      }
      stripped = stripped.replace(/-v\d+:\d+$/, '').replace(/:\d+$/, '');
      stripped = stripped.replace(/-\d{4}-\d{2}-\d{2}$/, '');
      stripped = stripped.replace(/-\d{8}$/, '');
      stripped = stripped.replace(/-autonomous-testing$/, '');
      return stripped;
    },

    resolve(provider, region, model) {
      const baseModelName = this.stripModelDateSuffix(model);

      if (baseModelName && MODEL_PRICING_OVERRIDES[baseModelName]) {
        const override = MODEL_PRICING_OVERRIDES[baseModelName];
        const providerDefaults = PROVIDER_DEFAULTS[provider] || {};
        return {
          input: override.input,
          output: override.output,
          cacheRead: override.cacheRead !== null ? override.cacheRead : (providerDefaults.CacheReadInputTokens || null),
          cacheCreation: override.cacheCreation !== null && override.cacheCreation !== undefined ? override.cacheCreation : (providerDefaults.CacheCreationInputTokens || null),
          tier: 'Model Override'
        };
      }

      if (PROVIDER_DEFAULTS[provider]) {
        const defaults = PROVIDER_DEFAULTS[provider];
        return {
          input: defaults.InputTokens,
          output: defaults.OutputTokens,
          cacheRead: defaults.CacheReadInputTokens || null,
          cacheCreation: defaults.CacheCreationInputTokens || null,
          tier: 'Provider Default'
        };
      }

      return { input: 0, output: 0, cacheRead: null, cacheCreation: null, tier: 'Unknown' };
    },

    calculateTokenCost(tokens, prices) {
      let totalCost = 0;
      if (tokens.input && prices.input) totalCost += (tokens.input / 1000) * prices.input;
      if (tokens.output && prices.output) totalCost += (tokens.output / 1000) * prices.output;
      if (tokens.cacheRead && prices.cacheRead) totalCost += (tokens.cacheRead / 1000) * prices.cacheRead;
      if (tokens.cacheCreation && prices.cacheCreation) totalCost += (tokens.cacheCreation / 1000) * prices.cacheCreation;
      return totalCost;
    },

    calculateCredits(tokenCost, markup, creditPrice) {
      if (markup === undefined) markup = DEFAULTS.markup;
      if (creditPrice === undefined) creditPrice = DEFAULTS.creditPrice;
      return (tokenCost * markup) / creditPrice;
    },

    calculate(params) {
      const { provider, region, model, tokens } = params;
      const markup = params.markup ?? DEFAULTS.markup;
      const creditPrice = params.creditPrice ?? DEFAULTS.creditPrice;
      const prices = this.resolve(provider, region, model);
      const breakdown = [];
      let tokenCost = 0;

      if (tokens.input && prices.input) {
        const cost = (tokens.input / 1000) * prices.input;
        breakdown.push({ type: 'Input Tokens', count: tokens.input, pricePerK: prices.input, cost });
        tokenCost += cost;
      }
      if (tokens.output && prices.output) {
        const cost = (tokens.output / 1000) * prices.output;
        breakdown.push({ type: 'Output Tokens', count: tokens.output, pricePerK: prices.output, cost });
        tokenCost += cost;
      }
      if (tokens.cacheRead && prices.cacheRead) {
        const cost = (tokens.cacheRead / 1000) * prices.cacheRead;
        breakdown.push({ type: 'Cache Read Tokens', count: tokens.cacheRead, pricePerK: prices.cacheRead, cost });
        tokenCost += cost;
      }
      if (tokens.cacheCreation && prices.cacheCreation) {
        const cost = (tokens.cacheCreation / 1000) * prices.cacheCreation;
        breakdown.push({ type: 'Cache Creation Tokens', count: tokens.cacheCreation, pricePerK: prices.cacheCreation, cost });
        tokenCost += cost;
      }

      const withMarkup = tokenCost * markup;
      const credits = withMarkup / creditPrice;

      return { tokenCost, breakdown, withMarkup, credits, tier: prices.tier };
    },

    calculateMetrics(module, testSteps, testCases) {
      const formula = METRIC_FORMULAS[module];
      if (!formula) return { credits: 0, breakdown: [] };

      const breakdown = [];
      let totalCredits = formula.base;

      if (formula.base > 0) {
        breakdown.push({ type: 'Base', value: 1, multiplier: formula.base, credits: formula.base });
      }
      if (testSteps && formula.multipliers.TestSteps) {
        const stepCredits = testSteps * formula.multipliers.TestSteps;
        breakdown.push({ type: 'Test Steps', value: testSteps, multiplier: formula.multipliers.TestSteps, credits: stepCredits });
        totalCredits += stepCredits;
      }
      if (testCases && formula.multipliers.TestCases) {
        const caseCredits = testCases * formula.multipliers.TestCases;
        breakdown.push({ type: 'Test Cases', value: testCases, multiplier: formula.multipliers.TestCases, credits: caseCredits });
        totalCredits += caseCredits;
      }

      return { credits: totalCredits, breakdown };
    }
  };

  // =============================================
  // calculator.js - Calculator module
  // =============================================
  const Calculator = {
    tokenFieldConfigs: {
      'AzureOpenAI': [
        { id: 'input-tokens', label: 'Input Tokens', key: 'input' },
        { id: 'output-tokens', label: 'Output Tokens', key: 'output' },
        { id: 'cached-tokens', label: 'Cached Input Tokens', key: 'cacheRead' }
      ],
      'Bedrock': [
        { id: 'input-tokens', label: 'Input Tokens', key: 'input' },
        { id: 'output-tokens', label: 'Output Tokens', key: 'output' },
        { id: 'cache-read-tokens', label: 'Cache Read Input Tokens', key: 'cacheRead' },
        { id: 'cache-creation-tokens', label: 'Cache Creation Input Tokens', key: 'cacheCreation' }
      ]
    },

    init() {
      this.setupSubtabNavigation();
      this.setupJsonParsing();
      this.setupProviderDropdown();
      this.setupRegionDropdown();
      this.setupTokenCalculation();
      this.setupMetricsCalculation();
      this.setupCollapsibleSections();
      this.initializeMetricsDefaults();
    },

    setupSubtabNavigation() {
      const container = document.querySelector('.usage-calc');
      const subtabBtns = container.querySelectorAll('.subtab-btn');
      subtabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          // Sync all subtab button active states (left + right panels)
          subtabBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.subtab === btn.dataset.subtab);
          });
          container.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
          const subtabId = btn.dataset.subtab + '-subtab';
          const subtabContent = document.getElementById(subtabId);
          if (subtabContent) subtabContent.classList.add('active');

          // Also toggle left-panel paired subtab content
          container.querySelectorAll('.uc-subtab-left').forEach(c => c.classList.remove('active'));
          const leftContent = document.getElementById(subtabId + '-left');
          if (leftContent) leftContent.classList.add('active');
        });
      });
    },

    setupJsonParsing() {
      const parseBtn = document.getElementById('parse-json-btn');
      const jsonInput = document.getElementById('json-input');
      if (parseBtn && jsonInput) {
        parseBtn.addEventListener('click', () => this.parseJsonInput());
        jsonInput.addEventListener('paste', () => {
          setTimeout(() => this.parseJsonInput(), 100);
        });
      }
    },

    parseJsonInput() {
      const jsonInput = document.getElementById('json-input');
      const jsonText = jsonInput.value.trim();
      if (!jsonText) { this.showError('Please paste JSON data first'); return; }
      try {
        const data = JSON.parse(jsonText);
        this.populateFromJson(data);
      } catch (e) {
        this.showError('Invalid JSON format: ' + e.message);
      }
    },

    populateFromJson(data) {
      if (data.model) {
        const modelSelect = document.getElementById('model-select');
        if (modelSelect) {
          const modelValue = data.model;
          let optionFound = false;
          for (const option of modelSelect.options) {
            if (option.value === modelValue) { modelSelect.value = modelValue; optionFound = true; break; }
          }
          if (!optionFound && modelValue) {
            const newOption = document.createElement('option');
            newOption.value = modelValue;
            newOption.textContent = modelValue;
            modelSelect.appendChild(newOption);
            modelSelect.value = modelValue;
          }
        }
      }
      if (data.usage) {
        const usage = data.usage;
        if (usage.prompt_tokens !== undefined) {
          const inputField = document.getElementById('input-tokens');
          if (inputField) inputField.value = usage.prompt_tokens;
        }
        if (usage.completion_tokens !== undefined) {
          const outputField = document.getElementById('output-tokens');
          if (outputField) outputField.value = usage.completion_tokens;
        }
        if (usage.prompt_tokens_details && usage.prompt_tokens_details.cached_tokens !== undefined) {
          const cachedField = document.getElementById('cached-tokens');
          if (cachedField) cachedField.value = usage.prompt_tokens_details.cached_tokens;
          const cacheReadField = document.getElementById('cache-read-tokens');
          if (cacheReadField) cacheReadField.value = usage.prompt_tokens_details.cached_tokens;
        }
        if (usage.total_tokens !== undefined) this.showTotalTokensInfo(usage.total_tokens);
      }
      this.showSuccess('JSON parsed successfully');
    },

    showTotalTokensInfo(totalTokens) {
      const resultsDiv = document.getElementById('token-results');
      if (resultsDiv) {
        resultsDiv.innerHTML = `<div class="info-message"><strong>Total Tokens from JSON:</strong> ${formatNumber(totalTokens)}</div>`;
      }
    },

    setupProviderDropdown() {
      const providerSelect = document.getElementById('provider-select');
      if (providerSelect) {
        providerSelect.innerHTML = '<option value="">Select Provider</option>';
        Object.keys(REGIONS).forEach(provider => {
          const option = document.createElement('option');
          option.value = provider;
          option.textContent = provider;
          providerSelect.appendChild(option);
        });
        providerSelect.addEventListener('change', () => this.onProviderChange(providerSelect.value));
      }
    },

    onProviderChange(provider) {
      this.populateRegions(provider);
      this.updateTokenFields(provider);
      const modelSelect = document.getElementById('model-select');
      if (modelSelect) modelSelect.innerHTML = '<option value="">Select Model</option>';
    },

    populateRegions(provider) {
      const regionSelect = document.getElementById('region-select');
      if (!regionSelect) return;
      regionSelect.innerHTML = '<option value="">Select Region</option>';
      if (provider && REGIONS[provider]) {
        REGIONS[provider].forEach(region => {
          const option = document.createElement('option');
          option.value = region;
          option.textContent = region;
          regionSelect.appendChild(option);
        });
      }
    },

    setupRegionDropdown() {
      const regionSelect = document.getElementById('region-select');
      if (regionSelect) {
        regionSelect.addEventListener('change', () => {
          const provider = document.getElementById('provider-select')?.value;
          const region = regionSelect.value;
          this.populateModels(provider, region);
        });
      }
    },

    populateModels(provider, region) {
      const modelSelect = document.getElementById('model-select');
      if (!modelSelect) return;
      modelSelect.innerHTML = '<option value="">Select Model</option>';
      if (provider && region && MODELS[provider] && MODELS[provider][region]) {
        MODELS[provider][region].forEach(model => {
          const option = document.createElement('option');
          option.value = model;
          option.textContent = model;
          modelSelect.appendChild(option);
        });
      }
    },

    updateTokenFields(provider) {
      const container = document.getElementById('token-fields-container');
      if (!container) return;
      const config = this.tokenFieldConfigs[provider];
      if (!config) {
        container.innerHTML = `
          <div class="form-group"><label for="input-tokens">Input Tokens</label><input type="number" id="input-tokens" class="form-input" placeholder="0" min="0"></div>
          <div class="form-group"><label for="output-tokens">Output Tokens</label><input type="number" id="output-tokens" class="form-input" placeholder="0" min="0"></div>`;
        return;
      }
      let fieldsHtml = '';
      config.forEach(field => {
        fieldsHtml += `<div class="form-group"><label for="${field.id}">${field.label}</label><input type="number" id="${field.id}" class="form-input" placeholder="0" min="0"></div>`;
      });
      container.innerHTML = fieldsHtml;
    },

    setupTokenCalculation() {
      const calcBtn = document.getElementById('calculate-tokens-btn');
      if (calcBtn) calcBtn.addEventListener('click', () => this.calculateTokenCredits());
    },

    calculateTokenCredits() {
      const provider = document.getElementById('provider-select')?.value;
      const region = document.getElementById('region-select')?.value;
      const model = document.getElementById('model-select')?.value;
      if (!provider) { this.showError('Please select a provider'); return; }
      const tokens = this.gatherTokenValues(provider);
      if (tokens.input === 0 && tokens.output === 0) { this.showError('Please enter at least some token values'); return; }
      const result = Pricing.calculate({ provider, region, model, tokens });
      this.displayTokenResults(result, tokens, provider, model);
      this.updateStickyResult(result.credits);
    },

    updateStickyResult(credits) {
      const stickyBar = document.getElementById('stickyResult');
      const stickyValue = document.getElementById('stickyResultValue');
      if (stickyBar && stickyValue) {
        stickyValue.textContent = credits.toFixed(4);
        stickyBar.classList.remove('hidden');
      }
    },

    gatherTokenValues(provider) {
      const tokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
      const config = this.tokenFieldConfigs[provider];
      if (config) {
        config.forEach(field => {
          const input = document.getElementById(field.id);
          if (input && input.value) tokens[field.key] = parseInt(input.value, 10) || 0;
        });
      } else {
        tokens.input = parseInt(document.getElementById('input-tokens')?.value, 10) || 0;
        tokens.output = parseInt(document.getElementById('output-tokens')?.value, 10) || 0;
      }
      return tokens;
    },

    displayTokenResults(result, tokens, provider, model) {
      const resultsDiv = document.getElementById('token-results');
      const breakdownDiv = document.getElementById('pricing-breakdown');
      if (!resultsDiv || !breakdownDiv) return;

      resultsDiv.innerHTML = `
        <div class="result-highlight"><span class="result-label">Total Credits:</span><span class="result-value credits-value">${result.credits.toFixed(4)}</span></div>
        <div class="result-row"><span class="result-label">Pricing Tier:</span><span class="result-value tier-badge ${result.tier === 'Model Override' ? 'tier-override' : 'tier-default'}">${result.tier}</span></div>`;

      let bHtml = `<h4>Token Breakdown</h4><table class="data-table"><thead><tr><th>Token Type</th><th>Count</th><th>Price/1K</th><th>Cost (USD)</th></tr></thead><tbody>`;
      result.breakdown.forEach(item => {
        bHtml += `<tr><td>${item.type}</td><td>${formatNumber(item.count)}</td><td>${formatCurrency(item.pricePerK, 6)}</td><td>${formatCurrency(item.cost, 6)}</td></tr>`;
      });
      bHtml += `</tbody><tfoot><tr><td colspan="3"><strong>Token Cost Total</strong></td><td><strong>${formatCurrency(result.tokenCost, 6)}</strong></td></tr></tfoot></table>`;
      bHtml += `<h4>Credit Calculation Formula</h4><div class="formula-breakdown">
        <div class="formula-step"><span class="step-label">1. Token Cost:</span><span class="step-value">${formatCurrency(result.tokenCost, 6)}</span></div>
        <div class="formula-step"><span class="step-label">2. Apply Markup (x${DEFAULTS.markup}):</span><span class="step-value">${formatCurrency(result.tokenCost, 6)} x ${DEFAULTS.markup} = ${formatCurrency(result.withMarkup, 6)}</span></div>
        <div class="formula-step"><span class="step-label">3. Convert to Credits (/${DEFAULTS.creditPrice}):</span><span class="step-value">${formatCurrency(result.withMarkup, 6)} / ${DEFAULTS.creditPrice} = ${result.credits.toFixed(4)} credits</span></div>
      </div>`;
      breakdownDiv.innerHTML = bHtml;
    },

    initializeMetricsDefaults() {
      const moduleSelect = document.getElementById('module-select');
      if (moduleSelect) {
        moduleSelect.addEventListener('change', () => {
          const module = moduleSelect.value;
          if (module && METRIC_FORMULAS[module]) {
            const formula = METRIC_FORMULAS[module];
            const sm = document.getElementById('test-steps-multiplier');
            const cm = document.getElementById('test-cases-multiplier');
            if (sm) sm.value = formula.multipliers.TestSteps;
            if (cm) cm.value = formula.multipliers.TestCases;
          }
        });
      }
      const sm = document.getElementById('test-steps-multiplier');
      const cm = document.getElementById('test-cases-multiplier');
      if (sm) sm.value = 2.0;
      if (cm) cm.value = 5.0;
    },

    setupMetricsCalculation() {
      const calcBtn = document.getElementById('calculate-metrics-btn');
      if (calcBtn) calcBtn.addEventListener('click', () => this.calculateMetricsCredits());
    },

    calculateMetricsCredits() {
      const module = document.getElementById('module-select')?.value;
      const testSteps = parseInt(document.getElementById('test-steps-count')?.value, 10) || 0;
      const testCases = parseInt(document.getElementById('test-cases-count')?.value, 10) || 0;
      if (!module) { this.showMetricsError('Please select a module'); return; }
      if (testSteps === 0 && testCases === 0) { this.showMetricsError('Please enter at least one count value'); return; }
      const result = Pricing.calculateMetrics(module, testSteps, testCases);
      this.displayMetricsResults(result, module, testSteps, testCases);
    },

    displayMetricsResults(result, module, testSteps, testCases) {
      const resultsDiv = document.getElementById('metrics-results');
      if (!resultsDiv) return;
      const formula = METRIC_FORMULAS[module];
      const stepsMultiplier = formula?.multipliers?.TestSteps || 2.0;
      const casesMultiplier = formula?.multipliers?.TestCases || 5.0;

      let html = `<div class="result-highlight"><span class="result-label">Total Credits:</span><span class="result-value credits-value">${result.credits.toFixed(2)}</span></div>
        <h4>Formula</h4><div class="formula-display">Credits = (TestSteps x ${stepsMultiplier}) + (TestCases x ${casesMultiplier})</div>
        <h4>Breakdown</h4><table class="data-table"><thead><tr><th>Metric</th><th>Count</th><th>Multiplier</th><th>Credits</th></tr></thead><tbody>`;
      result.breakdown.forEach(item => {
        html += `<tr><td>${item.type}</td><td>${formatNumber(item.value)}</td><td>x ${item.multiplier}</td><td>${item.credits.toFixed(2)}</td></tr>`;
      });
      html += `</tbody><tfoot><tr><td colspan="3"><strong>Total</strong></td><td><strong>${result.credits.toFixed(2)}</strong></td></tr></tfoot></table>
        <h4>Calculation</h4><div class="formula-breakdown">
        <div class="formula-step"><span class="step-value">(${testSteps} x ${stepsMultiplier}) + (${testCases} x ${casesMultiplier})</span></div>
        <div class="formula-step"><span class="step-value">= ${(testSteps * stepsMultiplier).toFixed(2)} + ${(testCases * casesMultiplier).toFixed(2)}</span></div>
        <div class="formula-step"><span class="step-value">= <strong>${result.credits.toFixed(2)} credits</strong></span></div></div>`;
      resultsDiv.innerHTML = html;
    },

    setupCollapsibleSections() {
      const container = document.querySelector('.usage-calc');
      container.querySelectorAll('.collapsible-header').forEach(header => {
        const section = header.parentElement;
        const content = section.querySelector('.collapsible-content');
        // ARIA setup
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        if (content) {
          const contentId = content.id || ('collapsible-' + Math.random().toString(36).slice(2, 8));
          content.id = contentId;
          header.setAttribute('aria-controls', contentId);
          header.setAttribute('aria-expanded', content.style.display === 'block' ? 'true' : 'false');
        }

        const toggle = () => {
          const icon = header.querySelector('.collapsible-icon');
          if (content.style.display === 'block') {
            content.style.display = 'none';
            icon.textContent = '+';
            header.setAttribute('aria-expanded', 'false');
          } else {
            content.style.display = 'block';
            icon.textContent = '-';
            header.setAttribute('aria-expanded', 'true');
          }
        };

        header.addEventListener('click', toggle);
        header.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
      });
    },

    showError(message) {
      const resultsDiv = document.getElementById('token-results');
      if (resultsDiv) resultsDiv.innerHTML = `<div class="error-message">${message}</div>`;
    },

    showMetricsError(message) {
      const resultsDiv = document.getElementById('metrics-results');
      if (resultsDiv) resultsDiv.innerHTML = `<div class="error-message">${message}</div>`;
    },

    showSuccess(message) {
      const resultsDiv = document.getElementById('token-results');
      if (resultsDiv) {
        const existingContent = resultsDiv.innerHTML;
        resultsDiv.innerHTML = `<div class="success-message">${message}</div>` + existingContent;
      }
    }
  };

  // =============================================
  // session.js - Session Tracker module
  // =============================================
  const SessionState = {
    sessionId: null,
    tokenCache: {},
    metricEvents: [],
    events: [],
    ended: false
  };

  const Session = {
    init() {
      this.resetState();
      this.setupEventListeners();
      this.updateUI();
    },

    resetState() {
      SessionState.sessionId = null;
      SessionState.tokenCache = {};
      SessionState.metricEvents = [];
      SessionState.events = [];
      SessionState.ended = false;
      const sessionIdEl = document.getElementById('session-id');
      if (sessionIdEl) sessionIdEl.textContent = 'Waiting for first event...';
    },

    setupEventListeners() {
      const addEventBtn = document.getElementById('add-event-btn');
      if (addEventBtn) addEventBtn.addEventListener('click', () => this.addEvent());

      const endSessionBtn = document.getElementById('end-session-btn');
      if (endSessionBtn) endSessionBtn.addEventListener('click', () => this.endSession());

      const resetSessionBtn = document.getElementById('reset-session-btn');
      if (resetSessionBtn) resetSessionBtn.addEventListener('click', () => this.resetSession());

      const balanceBefore = document.getElementById('session-balance-before');
      const balanceAfter = document.getElementById('session-balance-after');
      if (balanceBefore) balanceBefore.addEventListener('input', () => this.updateExpectedResults());
      if (balanceAfter) balanceAfter.addEventListener('input', () => this.updateExpectedResults());
    },

    parseEventJSON() {
      const textarea = document.getElementById('session-json-input');
      if (!textarea) return null;
      const raw = textarea.value.trim();
      if (!raw) { this.showError('Please paste a JSON request body'); return null; }

      let json;
      try { json = JSON.parse(raw); } catch (e) { this.showError(`Invalid JSON: ${e.message}`); return null; }

      const usageType = json.UsageType;
      if (!usageType || (usageType !== 'TokenBased' && usageType !== 'MetricBased')) {
        this.showError('Missing or invalid "UsageType" -- must be "TokenBased" or "MetricBased"'); return null;
      }

      const jsonSessionId = json.sessionId;
      if (SessionState.sessionId === null) {
        if (jsonSessionId) {
          SessionState.sessionId = jsonSessionId;
          const el = document.getElementById('session-id');
          if (el) el.textContent = SessionState.sessionId;
        }
      } else if (jsonSessionId && jsonSessionId !== SessionState.sessionId) {
        this.showError(`Session ID mismatch: expected "${SessionState.sessionId}", got "${jsonSessionId}"`); return null;
      }

      const eventData = {
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        sessionId: SessionState.sessionId,
        module: json.module || 'Default',
        skillId: json.skillId || 'workflows',
        usageType,
        sessionEnded: json.SessionEnded === true,
        rawJSON: json
      };

      if (usageType === 'TokenBased') {
        const provider = json.Provider;
        const region = json.Region;
        const model = json.Model;
        const metrics = json.MetricFields || {};
        if (!provider) { this.showError('TokenBased event requires "Provider"'); return null; }
        if (!region) { this.showError('TokenBased event requires "Region"'); return null; }
        if (!model) { this.showError('TokenBased event requires "Model"'); return null; }
        const inputTokens = parseInt(metrics.InputTokens) || 0;
        const outputTokens = parseInt(metrics.OutputTokens) || 0;
        if (!inputTokens && !outputTokens) { this.showError('TokenBased event requires MetricFields.InputTokens and/or MetricFields.OutputTokens'); return null; }
        eventData.provider = provider;
        eventData.region = region;
        eventData.model = model;
        eventData.tokens = {
          input: inputTokens,
          output: outputTokens,
          cacheRead: parseInt(metrics.CacheReadInputTokens || metrics.CachedInputTokens) || 0,
          cacheCreation: parseInt(metrics.CacheCreationInputTokens) || 0
        };
      } else if (usageType === 'MetricBased') {
        const metrics = json.MetricFields || {};
        const testSteps = parseInt(metrics.TestSteps) || 0;
        const testCases = parseInt(metrics.TestCases) || 0;
        if (!testSteps && !testCases) { this.showError('MetricBased event requires MetricFields.TestSteps and/or MetricFields.TestCases'); return null; }
        eventData.metrics = { testSteps, testCases };
      }

      this.clearError();
      return eventData;
    },

    showError(message) {
      const errorEl = document.getElementById('session-json-error');
      const textarea = document.getElementById('session-json-input');
      if (errorEl) { errorEl.textContent = message; errorEl.style.display = 'block'; }
      if (textarea) textarea.classList.add('error');
    },

    clearError() {
      const errorEl = document.getElementById('session-json-error');
      const textarea = document.getElementById('session-json-input');
      if (errorEl) { errorEl.textContent = ''; errorEl.style.display = 'none'; }
      if (textarea) textarea.classList.remove('error');
    },

    parseBalanceJSON(raw) {
      if (!raw || !raw.trim()) return null;
      const trimmed = raw.trim();
      const asNumber = parseFloat(trimmed);
      if (!isNaN(asNumber) && String(asNumber) === trimmed) return asNumber;
      try {
        const json = JSON.parse(trimmed);
        if (typeof json.balance === 'number') return json.balance;
      } catch (e) { /* Not valid JSON */ }
      return null;
    },

    addEvent() {
      if (SessionState.ended) { this.showError('Session has ended. Please reset to start a new session.'); return; }
      const eventData = this.parseEventJSON();
      if (!eventData) return;

      SessionState.events.push(eventData);

      if (eventData.usageType === 'TokenBased') {
        const cacheKey = `${eventData.provider}|${eventData.region}|${eventData.model}`;
        if (!SessionState.tokenCache[cacheKey]) {
          SessionState.tokenCache[cacheKey] = {
            provider: eventData.provider, region: eventData.region, model: eventData.model,
            tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
          };
        }
        SessionState.tokenCache[cacheKey].tokens.input += eventData.tokens.input || 0;
        SessionState.tokenCache[cacheKey].tokens.output += eventData.tokens.output || 0;
        SessionState.tokenCache[cacheKey].tokens.cacheRead += eventData.tokens.cacheRead || 0;
        SessionState.tokenCache[cacheKey].tokens.cacheCreation += eventData.tokens.cacheCreation || 0;
      } else if (eventData.usageType === 'MetricBased') {
        const metricResult = Pricing.calculateMetrics(eventData.module, eventData.metrics.testSteps, eventData.metrics.testCases);
        eventData.calculatedCredits = metricResult.credits;
        SessionState.metricEvents.push(eventData);
      }

      if (eventData.sessionEnded) this.handleSessionEnd();
      this.updateUI();
      this.clearInput();
    },

    handleSessionEnd() {
      SessionState.ended = true;
      Object.keys(SessionState.tokenCache).forEach(cacheKey => {
        const cached = SessionState.tokenCache[cacheKey];
        const result = Pricing.calculate({ provider: cached.provider, region: cached.region, model: cached.model, tokens: cached.tokens });
        cached.calculatedCredits = result.credits;
        cached.tokenCost = result.tokenCost;
        cached.breakdown = result.breakdown;
        cached.tier = result.tier;
      });
    },

    endSession() {
      if (SessionState.ended) { this.showError('Session has already ended.'); return; }
      if (SessionState.events.length === 0) { this.showError('No events to end. Add at least one event first.'); return; }
      SessionState.events.push({ id: generateUUID(), timestamp: new Date().toISOString(), sessionId: SessionState.sessionId, type: 'SessionEnd', sessionEnded: true });
      this.handleSessionEnd();
      this.updateUI();
    },

    resetSession() {
      this.resetState();
      this.updateUI();
      this.clearInput();
    },

    clearInput() {
      const textarea = document.getElementById('session-json-input');
      if (textarea) textarea.value = '';
      this.clearError();
    },

    updateUI() {
      this.updateAccumulationTable();
      this.updateMetricsTable();
      this.updateExpectedResults();
      this.updateEventTimeline();
    },

    updateAccumulationTable() {
      const tbody = document.getElementById('accumulation-tbody');
      if (!tbody) return;
      const cacheKeys = Object.keys(SessionState.tokenCache);
      if (cacheKeys.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="placeholder-text">No events recorded yet</td></tr>'; return; }
      let html = '';
      cacheKeys.forEach(key => {
        const cached = SessionState.tokenCache[key];
        const status = cached.calculatedCredits !== undefined ? 'Reported' : 'Cached';
        html += `<tr><td>${cached.provider}</td><td>${cached.region}</td><td title="${cached.model}">${this.truncateModel(cached.model)}</td><td>${formatNumber(cached.tokens.input)}</td><td>${formatNumber(cached.tokens.output)}</td><td>${formatNumber(cached.tokens.cacheRead || 0)}</td><td>${formatNumber(cached.tokens.cacheCreation || 0)}</td><td><span class="badge ${status === 'Reported' ? 'badge-ended' : 'badge-token'}">${status}</span></td></tr>`;
      });
      tbody.innerHTML = html;
    },

    updateMetricsTable() {
      const container = document.getElementById('metrics-table');
      if (!container) return;
      if (SessionState.metricEvents.length === 0) { container.innerHTML = '<p class="placeholder-text">No metric events reported yet</p>'; return; }
      let html = `<table class="data-table"><thead><tr><th>Module</th><th>Test Steps</th><th>Test Cases</th><th>Credits</th><th>Timestamp</th></tr></thead><tbody>`;
      SessionState.metricEvents.forEach(event => {
        html += `<tr><td>${event.module}</td><td>${event.metrics.testSteps || 0}</td><td>${event.metrics.testCases || 0}</td><td>${event.calculatedCredits?.toFixed(4) || '0.0000'}</td><td>${new Date(event.timestamp).toLocaleTimeString()}</td></tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    },

    updateExpectedResults() {
      const totalCreditsEl = document.getElementById('total-credits');
      const eventsCountEl = document.getElementById('events-count');
      const sessionStatusEl = document.getElementById('session-status');
      const breakdownContainer = document.getElementById('expected-breakdown');
      const verificationCard = document.getElementById('verification-card');
      const verificationResults = document.getElementById('verification-results');

      if (eventsCountEl) eventsCountEl.textContent = SessionState.events.length;
      if (sessionStatusEl) {
        sessionStatusEl.innerHTML = SessionState.ended
          ? '<span class="badge badge-ended">Ended</span>'
          : '<span class="badge badge-token">Active</span>';
      }

      let totalCredits = 0;
      SessionState.metricEvents.forEach(event => { totalCredits += event.calculatedCredits || 0; });
      if (SessionState.ended) {
        Object.keys(SessionState.tokenCache).forEach(key => { totalCredits += SessionState.tokenCache[key].calculatedCredits || 0; });
      }
      if (totalCreditsEl) totalCreditsEl.textContent = totalCredits.toFixed(6);

      // Balance verification
      const balanceBefore = this.parseBalanceJSON(document.getElementById('session-balance-before')?.value);
      const balanceAfter = this.parseBalanceJSON(document.getElementById('session-balance-after')?.value);
      const hasBefore = balanceBefore !== null;
      const hasAfter = balanceAfter !== null;

      if (verificationCard && verificationResults) {
        if (hasBefore || hasAfter) {
          verificationCard.style.display = '';
          const actualUsed = (hasBefore && hasAfter) ? (balanceBefore - balanceAfter) : null;
          const delta = (actualUsed !== null && SessionState.ended) ? (actualUsed - totalCredits) : null;
          let deltaClass = '';
          let deltaLabel = '';
          if (delta !== null) {
            const absDelta = Math.abs(delta);
            if (absDelta < 0.0001) { deltaClass = 'text-success'; deltaLabel = 'Match'; }
            else if (absDelta < 0.01) { deltaClass = 'text-warning'; deltaLabel = 'Close'; }
            else { deltaClass = 'text-error'; deltaLabel = 'Mismatch'; }
          }
          let html = `<div class="result-row"><span class="result-label">Balance Before:</span><span class="result-value">${hasBefore ? balanceBefore.toFixed(6) : '--'}</span></div>
            <div class="result-row"><span class="result-label">Balance After:</span><span class="result-value">${hasAfter ? balanceAfter.toFixed(6) : '--'}</span></div>
            <div class="result-row"><span class="result-label">Actual Credits Used:</span><span class="result-value">${actualUsed !== null ? actualUsed.toFixed(6) : '--'}</span></div>
            <div class="result-row"><span class="result-label">Expected Credits Used:</span><span class="result-value">${totalCredits.toFixed(6)}</span></div>`;
          if (delta !== null) {
            html += `<div class="result-row"><span class="result-label">Delta (Actual - Expected):</span><span class="result-value ${deltaClass}">${delta >= 0 ? '+' : ''}${delta.toFixed(6)} <span class="badge ${deltaClass === 'text-success' ? 'badge-metric' : deltaClass === 'text-warning' ? 'badge-ended' : 'badge-error'}">${deltaLabel}</span></span></div>`;
          }
          verificationResults.innerHTML = html;
        } else {
          verificationCard.style.display = 'none';
        }
      }

      if (breakdownContainer) {
        if (SessionState.ended) {
          let html = '<hr><h4>Token Calculation Breakdown</h4>';
          Object.keys(SessionState.tokenCache).forEach(key => {
            const cached = SessionState.tokenCache[key];
            html += `<div class="breakdown-section"><h5>${cached.provider} / ${cached.region}</h5><p class="model-name">${cached.model}</p><ul class="breakdown-list">
              <li>Input Tokens: ${formatNumber(cached.tokens.input)}</li><li>Output Tokens: ${formatNumber(cached.tokens.output)}</li>
              ${cached.tokens.cacheRead ? `<li>Cache Read: ${formatNumber(cached.tokens.cacheRead)}</li>` : ''}
              ${cached.tokens.cacheCreation ? `<li>Cache Creation: ${formatNumber(cached.tokens.cacheCreation)}</li>` : ''}
              <li>Token Cost: ${formatCurrency(cached.tokenCost)}</li><li>Credits: ${cached.calculatedCredits?.toFixed(6)}</li><li>Tier: ${cached.tier}</li></ul></div>`;
          });
          if (SessionState.metricEvents.length > 0) {
            html += '<h4>Metric Calculation Breakdown</h4>';
            SessionState.metricEvents.forEach(event => {
              html += `<div class="breakdown-section"><h5>${event.module}</h5><ul class="breakdown-list">
                <li>Test Steps: ${event.metrics.testSteps || 0} x ${METRIC_FORMULAS[event.module]?.multipliers?.TestSteps || 0}</li>
                <li>Test Cases: ${event.metrics.testCases || 0} x ${METRIC_FORMULAS[event.module]?.multipliers?.TestCases || 0}</li>
                <li>Credits: ${event.calculatedCredits?.toFixed(6)}</li></ul></div>`;
            });
          }
          breakdownContainer.innerHTML = html;
        } else {
          breakdownContainer.innerHTML = '';
        }
      }
    },

    updateEventTimeline() {
      const container = document.getElementById('event-timeline');
      if (!container) return;
      if (SessionState.events.length === 0) { container.innerHTML = '<p class="placeholder-text">Events will appear here as they are added</p>'; return; }
      let html = '';
      SessionState.events.forEach((event) => {
        const time = new Date(event.timestamp).toLocaleTimeString();
        const isSessionEnd = event.type === 'SessionEnd' || event.sessionEnded;
        let badgeClass = 'badge-token';
        let badgeText = event.usageType || 'Event';
        if (event.type === 'SessionEnd') { badgeClass = 'badge-ended'; badgeText = 'Session End'; }
        else if (event.usageType === 'MetricBased') { badgeClass = 'badge-metric'; }
        html += `<div class="timeline-event ${isSessionEnd ? 'session-end' : ''}">
          <div class="timeline-header"><span class="timeline-time">${time}</span><span class="badge ${badgeClass}">${badgeText}</span>${event.module ? `<span class="timeline-module">${event.module}</span>` : ''}</div>
          <div class="timeline-summary">${this.getEventSummary(event)}</div>
          <details class="timeline-details"><summary>View JSON</summary><pre class="code-block">${JSON.stringify(event.rawJSON || event, null, 2)}</pre></details></div>`;
      });
      container.innerHTML = html;
    },

    getEventSummary(event) {
      if (event.type === 'SessionEnd') return 'Session ended - flushing token cache and calculating credits';
      if (event.usageType === 'TokenBased') {
        const totalTokens = (event.tokens.input || 0) + (event.tokens.output || 0) + (event.tokens.cacheRead || 0) + (event.tokens.cacheCreation || 0);
        return `${event.provider} / ${this.truncateModel(event.model)}: ${formatNumber(totalTokens)} tokens`;
      }
      if (event.usageType === 'MetricBased') return `${event.module}: ${event.metrics.testSteps || 0} test steps, ${event.metrics.testCases || 0} test cases`;
      return 'Unknown event type';
    },

    truncateModel(model) {
      if (!model) return '';
      if (model.length <= 30) return model;
      return model.substring(0, 27) + '...';
    }
  };

  // =============================================
  // generator.js - Test Generator module
  // =============================================
  const Generator = {
    currentScenario: null,
    tokenModules: ['Default', 'AI-HUB', 'ai-workspace'],

    randomInRange(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

    getFormValues() {
      return {
        scenarioType: document.getElementById('scenario-type')?.value || 'single-token',
        inputMin: parseInt(document.getElementById('gen-input-min')?.value) || 100,
        inputMax: parseInt(document.getElementById('gen-input-max')?.value) || 100000,
        outputMin: parseInt(document.getElementById('gen-output-min')?.value) || 50,
        outputMax: parseInt(document.getElementById('gen-output-max')?.value) || 50000,
        cacheProbability: parseInt(document.getElementById('gen-cache-prob')?.value) || 30,
        cacheCreationProbability: parseInt(document.getElementById('gen-cache-creation-prob')?.value) || 20,
        testStepsMin: parseInt(document.getElementById('gen-steps-min')?.value) || 1,
        testStepsMax: parseInt(document.getElementById('gen-steps-max')?.value) || 500,
        testCasesMin: parseInt(document.getElementById('gen-cases-min')?.value) || 1,
        testCasesMax: parseInt(document.getElementById('gen-cases-max')?.value) || 50,
        eventCountMin: parseInt(document.getElementById('gen-event-min')?.value) || 2,
        eventCountMax: parseInt(document.getElementById('gen-event-max')?.value) || 5,
        sessionId: document.getElementById('gen-session-id')?.value?.trim() || '',
        sessionPrefix: document.getElementById('gen-session-prefix')?.value || 'test-session-',
        tenant: document.getElementById('gen-tenant')?.value || '{{X_TENANT_NAME}}',
        product: document.getElementById('gen-product')?.value || '{{X_PRODUCT_NAME}}',
        useAzure: document.getElementById('gen-azure')?.checked !== false,
        useBedrock: document.getElementById('gen-bedrock')?.checked !== false
      };
    },

    getAvailableProviders(formValues) {
      const providers = [];
      if (formValues.useAzure) providers.push('AzureOpenAI');
      if (formValues.useBedrock) providers.push('Bedrock');
      if (providers.length === 0) providers.push('AzureOpenAI');
      return providers;
    },

    getRandomRegion(provider) { return this.randomChoice(REGIONS[provider] || ['eastus']); },

    getRandomModel(provider, region) {
      const models = MODELS[provider]?.[region] || [];
      if (models.length === 0) {
        const allModels = Object.values(MODELS[provider] || {}).flat();
        return allModels.length > 0 ? this.randomChoice(allModels) : 'gpt-4o-2024-08-06';
      }
      return this.randomChoice(models);
    },

    generateSessionId(formValues) {
      if (formValues.sessionId) return formValues.sessionId;
      return `${formValues.sessionPrefix}${generateUUID().substring(0, 8)}`;
    },

    generateTokenEvent(options) {
      const metricFields = { InputTokens: options.inputTokens, OutputTokens: options.outputTokens };
      if (options.cacheReadTokens && options.cacheReadTokens > 0) metricFields.CacheReadInputTokens = options.cacheReadTokens;
      if (options.cacheCreationTokens && options.cacheCreationTokens > 0) metricFields.CacheCreationInputTokens = options.cacheCreationTokens;
      return {
        module: options.module || 'Default', skillId: 'workflows', sessionId: options.sessionId,
        UsageType: 'TokenBased', Provider: options.provider, Region: options.region, Model: options.model,
        MetricFields: metricFields,
        additionalData: { tenant: options.tenant, product: options.product },
        SessionEnded: options.sessionEnded
      };
    },

    generateMetricEvent(options) {
      const metricFields = {};
      if (options.testSteps && options.testSteps > 0) metricFields.TestSteps = options.testSteps;
      if (options.testCases && options.testCases > 0) metricFields.TestCases = options.testCases;
      return {
        module: options.module, skillId: 'workflows', sessionId: options.sessionId,
        UsageType: 'MetricBased', MetricFields: metricFields,
        additionalData: { tenant: options.tenant, product: options.product },
        SessionEnded: options.sessionEnded
      };
    },

    generateSingleToken(fv) {
      const sid = this.generateSessionId(fv);
      const providers = this.getAvailableProviders(fv);
      const provider = this.randomChoice(providers);
      const region = this.getRandomRegion(provider);
      const model = this.getRandomModel(provider, region);
      const inputTokens = this.randomInRange(fv.inputMin, fv.inputMax);
      const outputTokens = this.randomInRange(fv.outputMin, fv.outputMax);
      let cacheReadTokens = 0, cacheCreationTokens = 0;
      if (Math.random() * 100 < fv.cacheProbability) cacheReadTokens = this.randomInRange(100, inputTokens);
      if (provider === 'Bedrock' && Math.random() * 100 < fv.cacheCreationProbability) cacheCreationTokens = this.randomInRange(100, inputTokens);
      const module = this.randomChoice(this.tokenModules);
      const event = this.generateTokenEvent({ sessionId: sid, module, provider, region, model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, sessionEnded: true, tenant: fv.tenant, product: fv.product });
      const calc = Pricing.calculate({ provider, region, model, tokens: { input: inputTokens, output: outputTokens, cacheRead: cacheReadTokens, cacheCreation: cacheCreationTokens } });
      return { type: 'single-token', sessionId: sid, events: [event], expected: { totalInputTokens: inputTokens, totalOutputTokens: outputTokens, totalCacheReadTokens: cacheReadTokens, totalCacheCreationTokens: cacheCreationTokens, tokenCost: calc.tokenCost, withMarkup: calc.withMarkup, credits: calc.credits, breakdown: calc.breakdown, tier: calc.tier } };
    },

    generateMultiToken(fv) {
      const sid = this.generateSessionId(fv);
      const providers = this.getAvailableProviders(fv);
      const provider = this.randomChoice(providers);
      const region = this.getRandomRegion(provider);
      const model = this.getRandomModel(provider, region);
      const module = this.randomChoice(this.tokenModules);
      const eventCount = this.randomInRange(fv.eventCountMin, fv.eventCountMax);
      const events = [];
      let tI = 0, tO = 0, tCR = 0, tCC = 0;
      for (let i = 0; i < eventCount; i++) {
        const isLast = i === eventCount - 1;
        const iT = this.randomInRange(fv.inputMin, fv.inputMax);
        const oT = this.randomInRange(fv.outputMin, fv.outputMax);
        let cr = 0, cc = 0;
        if (Math.random() * 100 < fv.cacheProbability) cr = this.randomInRange(100, iT);
        if (provider === 'Bedrock' && Math.random() * 100 < fv.cacheCreationProbability) cc = this.randomInRange(100, iT);
        tI += iT; tO += oT; tCR += cr; tCC += cc;
        events.push(this.generateTokenEvent({ sessionId: sid, module, provider, region, model, inputTokens: iT, outputTokens: oT, cacheReadTokens: cr, cacheCreationTokens: cc, sessionEnded: isLast, tenant: fv.tenant, product: fv.product }));
      }
      const calc = Pricing.calculate({ provider, region, model, tokens: { input: tI, output: tO, cacheRead: tCR, cacheCreation: tCC } });
      return { type: 'multi-token', sessionId: sid, events, expected: { totalInputTokens: tI, totalOutputTokens: tO, totalCacheReadTokens: tCR, totalCacheCreationTokens: tCC, tokenCost: calc.tokenCost, withMarkup: calc.withMarkup, credits: calc.credits, breakdown: calc.breakdown, tier: calc.tier } };
    },

    generateMetricOnly(fv) {
      const sid = this.generateSessionId(fv);
      const module = this.randomChoice(['ATA', 'ATC']);
      const testSteps = this.randomInRange(fv.testStepsMin, fv.testStepsMax);
      const testCases = this.randomInRange(fv.testCasesMin, fv.testCasesMax);
      const event = this.generateMetricEvent({ sessionId: sid, module, testSteps, testCases, sessionEnded: true, tenant: fv.tenant, product: fv.product });
      const calc = Pricing.calculateMetrics(module, testSteps, testCases);
      return { type: 'metric-only', sessionId: sid, events: [event], expected: { module, testSteps, testCases, credits: calc.credits, breakdown: calc.breakdown } };
    },

    generateMixed(fv) {
      const sid = this.generateSessionId(fv);
      const providers = this.getAvailableProviders(fv);
      const provider = this.randomChoice(providers);
      const region = this.getRandomRegion(provider);
      const model = this.getRandomModel(provider, region);
      const tokenModule = this.randomChoice(this.tokenModules);
      const metricModule = this.randomChoice(['ATA', 'ATC']);
      const events = [];
      const iT = this.randomInRange(fv.inputMin, fv.inputMax);
      const oT = this.randomInRange(fv.outputMin, fv.outputMax);
      let cr = 0, cc = 0;
      if (Math.random() * 100 < fv.cacheProbability) cr = this.randomInRange(100, iT);
      if (provider === 'Bedrock' && Math.random() * 100 < fv.cacheCreationProbability) cc = this.randomInRange(100, iT);
      events.push(this.generateTokenEvent({ sessionId: sid, module: tokenModule, provider, region, model, inputTokens: iT, outputTokens: oT, cacheReadTokens: cr, cacheCreationTokens: cc, sessionEnded: false, tenant: fv.tenant, product: fv.product }));
      const testSteps = this.randomInRange(fv.testStepsMin, fv.testStepsMax);
      const testCases = this.randomInRange(fv.testCasesMin, fv.testCasesMax);
      events.push(this.generateMetricEvent({ sessionId: sid, module: metricModule, testSteps, testCases, sessionEnded: true, tenant: fv.tenant, product: fv.product }));
      const tCalc = Pricing.calculate({ provider, region, model, tokens: { input: iT, output: oT, cacheRead: cr, cacheCreation: cc } });
      const mCalc = Pricing.calculateMetrics(metricModule, testSteps, testCases);
      return { type: 'mixed', sessionId: sid, events, expected: { tokenBased: { totalInputTokens: iT, totalOutputTokens: oT, totalCacheReadTokens: cr, totalCacheCreationTokens: cc, tokenCost: tCalc.tokenCost, withMarkup: tCalc.withMarkup, credits: tCalc.credits, breakdown: tCalc.breakdown, tier: tCalc.tier }, metricBased: { module: metricModule, testSteps, testCases, credits: mCalc.credits, breakdown: mCalc.breakdown }, totalCredits: tCalc.credits + mCalc.credits } };
    },

    generateMultiProvider(fv) {
      const sid = this.generateSessionId(fv);
      const module = this.randomChoice(this.tokenModules);
      const events = [];
      const providers = ['AzureOpenAI', 'Bedrock'];
      const providerResults = [];
      let totalTokenCredits = 0;
      for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        const isLast = i === providers.length - 1;
        const region = this.getRandomRegion(provider);
        const model = this.getRandomModel(provider, region);
        const iT = this.randomInRange(fv.inputMin, fv.inputMax);
        const oT = this.randomInRange(fv.outputMin, fv.outputMax);
        let cr = 0, cc = 0;
        if (Math.random() * 100 < fv.cacheProbability) cr = this.randomInRange(100, iT);
        if (provider === 'Bedrock' && Math.random() * 100 < fv.cacheCreationProbability) cc = this.randomInRange(100, iT);
        events.push(this.generateTokenEvent({ sessionId: sid, module, provider, region, model, inputTokens: iT, outputTokens: oT, cacheReadTokens: cr, cacheCreationTokens: cc, sessionEnded: isLast, tenant: fv.tenant, product: fv.product }));
        const calc = Pricing.calculate({ provider, region, model, tokens: { input: iT, output: oT, cacheRead: cr, cacheCreation: cc } });
        providerResults.push({ provider, region, model, inputTokens: iT, outputTokens: oT, cacheReadTokens: cr, cacheCreationTokens: cc, tokenCost: calc.tokenCost, withMarkup: calc.withMarkup, credits: calc.credits, tier: calc.tier });
        totalTokenCredits += calc.credits;
      }
      return { type: 'multi-provider', sessionId: sid, events, expected: { providerResults, totalCredits: totalTokenCredits } };
    },

    generateMultiModel(fv) {
      const sid = this.generateSessionId(fv);
      const module = this.randomChoice(this.tokenModules);
      const providers = this.getAvailableProviders(fv);
      const provider = this.randomChoice(providers);
      const region = this.getRandomRegion(provider);
      const events = [];
      const modelResults = [];
      const availableModels = (MODELS[provider]?.[region] || []).slice();
      const modelCount = Math.min(this.randomInRange(2, 4), availableModels.length);
      const selectedModels = [];
      for (let i = 0; i < modelCount && availableModels.length > 0; i++) {
        const idx = Math.floor(Math.random() * availableModels.length);
        selectedModels.push(availableModels[idx]);
        availableModels.splice(idx, 1);
      }
      let totalTokenCredits = 0;
      for (let i = 0; i < selectedModels.length; i++) {
        const model = selectedModels[i];
        const isLast = i === selectedModels.length - 1;
        const iT = this.randomInRange(fv.inputMin, fv.inputMax);
        const oT = this.randomInRange(fv.outputMin, fv.outputMax);
        let cr = 0, cc = 0;
        if (Math.random() * 100 < fv.cacheProbability) cr = this.randomInRange(100, iT);
        if (provider === 'Bedrock' && Math.random() * 100 < fv.cacheCreationProbability) cc = this.randomInRange(100, iT);
        events.push(this.generateTokenEvent({ sessionId: sid, module, provider, region, model, inputTokens: iT, outputTokens: oT, cacheReadTokens: cr, cacheCreationTokens: cc, sessionEnded: isLast, tenant: fv.tenant, product: fv.product }));
        const calc = Pricing.calculate({ provider, region, model, tokens: { input: iT, output: oT, cacheRead: cr, cacheCreation: cc } });
        modelResults.push({ model, inputTokens: iT, outputTokens: oT, cacheReadTokens: cr, cacheCreationTokens: cc, tokenCost: calc.tokenCost, withMarkup: calc.withMarkup, credits: calc.credits, tier: calc.tier });
        totalTokenCredits += calc.credits;
      }
      return { type: 'multi-model', sessionId: sid, provider, region, events, expected: { modelResults, totalCredits: totalTokenCredits } };
    },

    generateBedrockCache(fv) {
      const sid = this.generateSessionId(fv);
      const module = this.randomChoice(this.tokenModules);
      const provider = 'Bedrock';
      const region = this.getRandomRegion(provider);
      const model = this.getRandomModel(provider, region);
      const iT = this.randomInRange(fv.inputMin, fv.inputMax);
      const oT = this.randomInRange(fv.outputMin, fv.outputMax);
      const cr = this.randomInRange(100, iT);
      const cc = this.randomInRange(100, iT);
      const event = this.generateTokenEvent({ sessionId: sid, module, provider, region, model, inputTokens: iT, outputTokens: oT, cacheReadTokens: cr, cacheCreationTokens: cc, sessionEnded: true, tenant: fv.tenant, product: fv.product });
      const calc = Pricing.calculate({ provider, region, model, tokens: { input: iT, output: oT, cacheRead: cr, cacheCreation: cc } });
      return { type: 'bedrock-cache', sessionId: sid, events: [event], expected: { totalInputTokens: iT, totalOutputTokens: oT, totalCacheReadTokens: cr, totalCacheCreationTokens: cc, tokenCost: calc.tokenCost, withMarkup: calc.withMarkup, credits: calc.credits, breakdown: calc.breakdown, tier: calc.tier } };
    },

    generateScenario(type, formValues) {
      switch (type) {
        case 'single-token': return this.generateSingleToken(formValues);
        case 'multi-token': return this.generateMultiToken(formValues);
        case 'metric-only': return this.generateMetricOnly(formValues);
        case 'mixed': return this.generateMixed(formValues);
        case 'multi-provider': return this.generateMultiProvider(formValues);
        case 'multi-model': return this.generateMultiModel(formValues);
        case 'bedrock-cache': return this.generateBedrockCache(formValues);
        default: return this.generateSingleToken(formValues);
      }
    },

    syntaxHighlight(json) {
      json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function (match) {
          let cls = 'json-number';
          if (/^"/.test(match)) { cls = /:$/.test(match) ? 'json-key' : 'json-string'; }
          else if (/true|false/.test(match)) { cls = 'json-boolean'; }
          else if (/null/.test(match)) { cls = 'json-null'; }
          return '<span class="' + cls + '">' + match + '</span>';
        }
      );
    },

    renderPayloads(events) {
      const html = [];
      events.forEach((event, index) => {
        let comment = `Event ${index + 1} of ${events.length} -- ${event.UsageType}`;
        if (event.MetricFields?.CacheReadInputTokens) comment += ' (tokens will be cached)';
        if (event.MetricFields?.CacheCreationInputTokens) comment += ' (cache creation)';
        if (event.SessionEnded) comment += ' [SESSION END]';
        html.push(`<div class="event-block"><div class="event-comment">// ${comment}</div><pre class="event-json">${this.syntaxHighlight(JSON.stringify(event, null, 4))}</pre><button class="copy-event-btn" data-index="${index}">Copy</button></div>`);
      });
      return html.join('\n');
    },

    renderExpectedResults(scenario) {
      const html = [];
      html.push(`<div class="expected-card"><div class="expected-header"><span class="expected-session">Session: ${scenario.sessionId}</span><span class="expected-type">Type: ${scenario.type}</span></div>`);
      const expected = scenario.expected;

      if (scenario.type === 'metric-only') {
        html.push(`<div class="expected-section"><h4>Metric-Based Calculation</h4><div class="expected-row"><span>Module:</span><span>${expected.module}</span></div><div class="expected-row"><span>Test Steps:</span><span>${formatNumber(expected.testSteps)}</span></div><div class="expected-row"><span>Test Cases:</span><span>${formatNumber(expected.testCases)}</span></div><div class="expected-row total"><span>Credits:</span><span>${expected.credits.toFixed(4)}</span></div></div>`);
      } else if (scenario.type === 'mixed') {
        html.push(`<div class="expected-section"><h4>Token-Based Calculation</h4><div class="expected-row"><span>Input Tokens:</span><span>${formatNumber(expected.tokenBased.totalInputTokens)}</span></div><div class="expected-row"><span>Output Tokens:</span><span>${formatNumber(expected.tokenBased.totalOutputTokens)}</span></div>`);
        if (expected.tokenBased.totalCacheReadTokens > 0) html.push(`<div class="expected-row"><span>Cache Read Tokens:</span><span>${formatNumber(expected.tokenBased.totalCacheReadTokens)}</span></div>`);
        if (expected.tokenBased.totalCacheCreationTokens > 0) html.push(`<div class="expected-row"><span>Cache Creation Tokens:</span><span>${formatNumber(expected.tokenBased.totalCacheCreationTokens)}</span></div>`);
        html.push(`<div class="expected-row"><span>Token Cost:</span><span>${formatCurrency(expected.tokenBased.tokenCost)}</span></div><div class="expected-row"><span>Token Credits:</span><span>${expected.tokenBased.credits.toFixed(4)}</span></div></div>`);
        html.push(`<div class="expected-section"><h4>Metric-Based Calculation</h4><div class="expected-row"><span>Module:</span><span>${expected.metricBased.module}</span></div><div class="expected-row"><span>Test Steps:</span><span>${formatNumber(expected.metricBased.testSteps)}</span></div><div class="expected-row"><span>Test Cases:</span><span>${formatNumber(expected.metricBased.testCases)}</span></div><div class="expected-row"><span>Metric Credits:</span><span>${expected.metricBased.credits.toFixed(4)}</span></div></div>`);
        html.push(`<div class="expected-total"><span>Total Credits:</span><span>${expected.totalCredits.toFixed(4)}</span></div>`);
      } else if (scenario.type === 'multi-provider') {
        expected.providerResults.forEach(result => {
          html.push(`<div class="expected-section"><h4>${result.provider} (${result.region})</h4><div class="expected-row"><span>Model:</span><span>${result.model}</span></div><div class="expected-row"><span>Input Tokens:</span><span>${formatNumber(result.inputTokens)}</span></div><div class="expected-row"><span>Output Tokens:</span><span>${formatNumber(result.outputTokens)}</span></div>`);
          if (result.cacheReadTokens > 0) html.push(`<div class="expected-row"><span>Cache Read Tokens:</span><span>${formatNumber(result.cacheReadTokens)}</span></div>`);
          if (result.cacheCreationTokens > 0) html.push(`<div class="expected-row"><span>Cache Creation Tokens:</span><span>${formatNumber(result.cacheCreationTokens)}</span></div>`);
          html.push(`<div class="expected-row"><span>Token Cost:</span><span>${formatCurrency(result.tokenCost)}</span></div><div class="expected-row"><span>Credits:</span><span>${result.credits.toFixed(4)}</span></div></div>`);
        });
        html.push(`<div class="expected-total"><span>Total Credits:</span><span>${expected.totalCredits.toFixed(4)}</span></div>`);
      } else if (scenario.type === 'multi-model') {
        html.push(`<div class="expected-section"><h4>Provider: ${scenario.provider} (${scenario.region})</h4></div>`);
        expected.modelResults.forEach(result => {
          html.push(`<div class="expected-section"><h4>Model: ${result.model}</h4><div class="expected-row"><span>Input Tokens:</span><span>${formatNumber(result.inputTokens)}</span></div><div class="expected-row"><span>Output Tokens:</span><span>${formatNumber(result.outputTokens)}</span></div>`);
          if (result.cacheReadTokens > 0) html.push(`<div class="expected-row"><span>Cache Read Tokens:</span><span>${formatNumber(result.cacheReadTokens)}</span></div>`);
          if (result.cacheCreationTokens > 0) html.push(`<div class="expected-row"><span>Cache Creation Tokens:</span><span>${formatNumber(result.cacheCreationTokens)}</span></div>`);
          html.push(`<div class="expected-row"><span>Token Cost:</span><span>${formatCurrency(result.tokenCost)}</span></div><div class="expected-row"><span>Credits:</span><span>${result.credits.toFixed(4)}</span></div></div>`);
        });
        html.push(`<div class="expected-total"><span>Total Credits:</span><span>${expected.totalCredits.toFixed(4)}</span></div>`);
      } else {
        html.push(`<div class="expected-section"><h4>Token Accumulation</h4><div class="expected-row"><span>Total Input Tokens:</span><span>${formatNumber(expected.totalInputTokens)}</span></div><div class="expected-row"><span>Total Output Tokens:</span><span>${formatNumber(expected.totalOutputTokens)}</span></div>`);
        if (expected.totalCacheReadTokens > 0) html.push(`<div class="expected-row"><span>Total Cache Read Tokens:</span><span>${formatNumber(expected.totalCacheReadTokens)}</span></div>`);
        if (expected.totalCacheCreationTokens > 0) html.push(`<div class="expected-row"><span>Total Cache Creation Tokens:</span><span>${formatNumber(expected.totalCacheCreationTokens)}</span></div>`);
        html.push(`</div><div class="expected-section"><h4>Cost Breakdown</h4>`);
        if (expected.breakdown) {
          expected.breakdown.forEach(item => {
            html.push(`<div class="expected-row"><span>${item.type}:</span><span>${formatNumber(item.count)} @ ${formatCurrency(item.pricePerK, 6)}/K = ${formatCurrency(item.cost)}</span></div>`);
          });
        }
        html.push(`<div class="expected-row"><span>Raw Token Cost:</span><span>${formatCurrency(expected.tokenCost)}</span></div><div class="expected-row"><span>With Markup (1.5x):</span><span>${formatCurrency(expected.withMarkup)}</span></div><div class="expected-row"><span>Pricing Tier:</span><span>${expected.tier}</span></div></div>`);
        html.push(`<div class="expected-total"><span>Expected Credits:</span><span>${expected.credits.toFixed(4)}</span></div>`);
      }
      html.push(`</div>`);
      return html.join('\n');
    },

    handleGenerate() {
      const formValues = this.getFormValues();
      this.currentScenario = this.generateScenario(formValues.scenarioType || 'single-token', formValues);
      const payloadsContainer = document.getElementById('generated-payloads');
      const expectedContainer = document.getElementById('generated-expected');
      if (payloadsContainer) { payloadsContainer.innerHTML = this.renderPayloads(this.currentScenario.events); this.attachCopyEventListeners(); }
      if (expectedContainer) { expectedContainer.innerHTML = this.renderExpectedResults(this.currentScenario); }
    },

    handleGenerateBatch() {
      const formValues = this.getFormValues();
      const scenarioTypes = ['single-token', 'multi-token', 'metric-only', 'mixed', 'multi-provider', 'multi-model', 'bedrock-cache'];
      const batchCount = this.randomInRange(5, 10);
      const scenarios = [];
      for (let i = 0; i < batchCount; i++) scenarios.push(this.generateScenario(this.randomChoice(scenarioTypes), formValues));
      const payloadsContainer = document.getElementById('generated-payloads');
      const expectedContainer = document.getElementById('generated-expected');
      if (payloadsContainer) {
        let html = '';
        scenarios.forEach((scenario, idx) => { html += `<div class="batch-scenario"><div class="batch-header">Scenario ${idx + 1} of ${batchCount} (${scenario.type})</div>${this.renderPayloads(scenario.events)}</div>`; });
        payloadsContainer.innerHTML = html;
        this.attachCopyEventListeners();
      }
      if (expectedContainer) {
        let html = '';
        scenarios.forEach((scenario, idx) => { html += `<div class="batch-expected"><div class="batch-header">Scenario ${idx + 1} Expected Results</div>${this.renderExpectedResults(scenario)}</div>`; });
        expectedContainer.innerHTML = html;
      }
      this.currentScenario = { batch: scenarios };
    },

    handleCopyAll() {
      if (!this.currentScenario) return;
      let content = '';
      if (this.currentScenario.batch) {
        this.currentScenario.batch.forEach((scenario, idx) => {
          content += `// Scenario ${idx + 1}: ${scenario.type}\n// Session: ${scenario.sessionId}\n\n// Events:\n`;
          scenario.events.forEach((event, eIdx) => { content += `// Event ${eIdx + 1}\n${JSON.stringify(event, null, 4)}\n\n`; });
          content += `// Expected Results:\n${JSON.stringify(scenario.expected, null, 4)}\n\n// ---\n\n`;
        });
      } else {
        content += `// Scenario: ${this.currentScenario.type}\n// Session: ${this.currentScenario.sessionId}\n\n// Events:\n`;
        this.currentScenario.events.forEach((event, idx) => { content += `// Event ${idx + 1}\n${JSON.stringify(event, null, 4)}\n\n`; });
        content += `// Expected Results:\n${JSON.stringify(this.currentScenario.expected, null, 4)}`;
      }
      ucCopyToClipboard(content).then(() => {
        const btn = document.getElementById('copy-all-btn');
        if (btn) { const orig = btn.textContent; btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = orig; }, 2000); }
      });
    },

    attachCopyEventListeners() {
      const container = document.querySelector('.usage-calc');
      container.querySelectorAll('.copy-event-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          if (this.currentScenario && this.currentScenario.events && this.currentScenario.events[index]) {
            ucCopyToClipboard(JSON.stringify(this.currentScenario.events[index], null, 4)).then(() => {
              e.target.textContent = 'Copied!';
              setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
            });
          }
        });
      });
    },

    init() {
      const generateBtn = document.getElementById('generate-btn');
      if (generateBtn) generateBtn.addEventListener('click', () => this.handleGenerate());
      const generateBatchBtn = document.getElementById('generate-batch-btn');
      if (generateBatchBtn) generateBatchBtn.addEventListener('click', () => this.handleGenerateBatch());
      const copyAllBtn = document.getElementById('copy-all-btn');
      if (copyAllBtn) copyAllBtn.addEventListener('click', () => this.handleCopyAll());
      const clearGenBtn = document.getElementById('clear-generator-btn');
      if (clearGenBtn) {
        clearGenBtn.addEventListener('click', () => {
          this.currentScenario = null;
          const pc = document.getElementById('generated-payloads');
          const ec = document.getElementById('generated-expected');
          if (pc) pc.innerHTML = '<p class="placeholder-text">Generated payloads will appear here...</p>';
          if (ec) ec.innerHTML = '<p class="placeholder-text">Expected calculation results will appear here...</p>';
        });
      }
    }
  };

  // =============================================
  // Tab navigation setup (scoped to .usage-calc)
  // =============================================
  function setupTabNavigation() {
    const container = document.querySelector('.usage-calc');
    if (!container) return;

    const tabBtns = container.querySelectorAll('.tab-navigation .tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabId = btn.dataset.tab + '-tab';
        const tabContent = document.getElementById(tabId);
        if (tabContent) tabContent.classList.add('active');

        // Also toggle left-panel paired tab content
        container.querySelectorAll('.uc-tab-left').forEach(c => c.classList.remove('active'));
        const leftContent = document.getElementById(tabId + '-left');
        if (leftContent) leftContent.classList.add('active');
      });
    });
  }

  // =============================================
  // Public API
  // =============================================
  window.UsageCalculator = {
    async init() {
      if (initialized) return;
      initialized = true;

      try {
        await Config.load();
      } catch (err) {
        console.error('UsageCalculator config load failed:', err);
        const container = document.querySelector('.usage-calc');
        if (container) {
          container.innerHTML = `<div style="color:#f85149;padding:2rem;font-family:sans-serif;">
            <h2>Configuration Error</h2>
            <p>${err.message}</p>
            <p>Make sure /data/usage-calculator/pricing.json and /data/usage-calculator/current_models.json exist.</p>
          </div>`;
        }
        return;
      }

      setupTabNavigation();
      Calculator.init();
      Session.init();
      Generator.init();
    }
  };
})();
