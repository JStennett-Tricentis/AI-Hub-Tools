/* ============================================================
   Request Generator Tool - Wrapped as BaseTool subclass
   ============================================================ */

(function () {
  'use strict';

  const { formatBytes, escapeHtml, syntaxHighlight, showToast, copyToClipboard: utilCopy } = window.HubUtils;

  class RequestGeneratorTool extends window.BaseTool {
    constructor() {
      super({
        id: 'request-generator',
        name: 'Request Generator',
        icon: '\u2699',
        category: 'Generation',
      });

      this.state = {
        models: { chat: [], completion: [], embedding: [] },
        endpoints: {},
        profiles: [],
        templates: [],
        currentEndpoint: 'chat',
        currentComplexity: 'medium',
        currentEncoding: 'float',
        currentMode: 'custom',
        generatedJson: '',
        batchResults: [],
        activeBatchIndex: 0,
        lastSummary: null,
      };

      this.dom = {};
    }

    // ---- Example Presets ----
    get PRESETS() {
      return {
        'multi-turn-analysis': { endpoint: 'chat', profile: 'security', model: 'gpt-4o-2024-05-13', stream: false },
        'nested-tool-params': { endpoint: 'chat', profile: 'migration', model: 'gpt-4o-2024-05-13', stream: false },
        'large-history': { endpoint: 'chat', profile: 'stress', turns: 30, tools: 5, model: 'gpt-4o-2024-05-13', stream: false },
        'streaming-tools': { endpoint: 'chat', profile: 'security', model: 'gpt-4o-2024-05-13', stream: true },
        'batch-embeddings': { endpoint: 'embeddings', model: 'text-embedding-ada-002-2', textCount: 50, encodingFormat: 'float' },
        'multilingual-embeddings': { endpoint: 'embeddings', model: 'text-embedding-ada-002-2', input: 'Explain the concept of machine learning,Expliquez le concept de apprentissage automatique,Explicar el concepto de aprendizaje automatico,SELECT * FROM users WHERE active = true,console.log("Hello world")', encodingFormat: 'float' },
        'document-clustering': { endpoint: 'embeddings', model: 'text-embedding-ada-002-2', textCount: 20, dimensions: 1536, encodingFormat: 'float' },
        'edge-cases': { endpoint: 'chat', complexity: 'stress', model: 'gpt-4o-2024-05-13', turns: 40, tools: 10, maxTokens: 16000, temperature: 0.9, stream: false },
      };
    }

    init() {
      super.init();
      this.cacheDom();
      this.setupEventListeners();
      this.fetchAll();
    }

    cacheDom() {
      const $ = (sel) => this.$(sel);
      this.dom = {
        selProfile: $('#selProfile'),
        selTemplate: $('#selTemplate'),
        selModel: $('#selModel'),
        selLanguage: $('#selLanguage'),
        selDomain: $('#selDomain'),
        inputTurns: $('#inputTurns'),
        inputTools: $('#inputTools'),
        inputTopic: $('#inputTopic'),
        inputPrompt: $('#inputPrompt'),
        promptGroup: $('#promptGroup'),
        rangeTemp: $('#rangeTemp'),
        tempValue: $('#tempValue'),
        inputMaxTokens: $('#inputMaxTokens'),
        toggleStream: $('#toggleStream'),
        embeddingSection: $('#embeddingSection'),
        inputEmbeddingTexts: $('#inputEmbeddingTexts'),
        inputTextCount: $('#inputTextCount'),
        inputDimensions: $('#inputDimensions'),
        inputScreenshots: $('#inputScreenshots'),
        inputScreenshotSize: $('#inputScreenshotSize'),
        toggleTosca: $('#toggleTosca'),
        toggleToolsOnly: $('#toggleToolsOnly'),
        toggleImagesOnly: $('#toggleImagesOnly'),
        toggleStrict: $('#toggleStrict'),
        toggleHubFormat: $('#toggleHubFormat'),
        toggleCompact: $('#toggleCompact'),
        inputBatchCount: $('#inputBatchCount'),
        sizeEstimateValue: $('#sizeEstimateValue'),
        batchProgress: $('#batchProgress'),
        batchProgressFill: $('#batchProgressFill'),
        batchTabs: $('#batchTabs'),
        btnGenerate: $('#btnGenerate'),
        btnCopy: $('#btnCopy'),
        btnDownload: $('#btnDownload'),
        outputContent: $('#outputContent'),
        emptyState: $('#emptyState'),
        jsonOutput: $('#jsonOutput'),
        outputSize: $('#outputSize'),
        summaryPanel: $('#summaryPanel'),
        summaryBody: $('#summaryBody'),
        summaryWarnings: $('#summaryWarnings'),
        endpointPathDisplay: $('#endpointPathDisplay'),
        modelInfoDisplay: $('#modelInfoDisplay'),
        infoProvider: $('#infoProvider'),
        infoContext: $('#infoContext'),
        infoMaxOutput: $('#infoMaxOutput'),
        modelTags: $('#modelTags'),
      };
    }

    async fetchAll() {
      await Promise.all([
        this.fetchModels(),
        this.fetchProfiles(),
        this.fetchTemplates(),
        this.fetchEndpoints(),
      ]);
      this.populateModelDropdown();
      this.updateModelInfo();
      this.updateSizeEstimate();
      this.applyGenerationMode(this.state.currentMode);
    }

    async fetchModels() {
      try {
        const res = await fetch('/api/models');
        this.state.models = await res.json();
      } catch (e) { console.error('Failed to fetch models:', e); }
    }

    async fetchProfiles() {
      try {
        const res = await fetch('/api/profiles');
        const data = await res.json();
        this.state.profiles = data.profiles || [];
        this.populateSelect(this.dom.selProfile, this.state.profiles.map(p => ({ value: p, label: p })), '-- None --');
      } catch (e) { console.error('Failed to fetch profiles:', e); }
    }

    async fetchTemplates() {
      try {
        const res = await fetch('/api/templates');
        const data = await res.json();
        this.state.templates = data.templates || [];
        this.populateSelect(this.dom.selTemplate, this.state.templates.map(t => ({ value: t, label: t })), '-- None --');
      } catch (e) { console.error('Failed to fetch templates:', e); }
    }

    async fetchEndpoints() {
      try {
        const res = await fetch('/api/endpoints');
        const data = await res.json();
        this.state.endpoints = data.endpoints || {};
      } catch (e) { console.error('Failed to fetch endpoints:', e); }
    }

    async fetchProfileDefaults(name) {
      try {
        const res = await fetch('/api/profiles/' + encodeURIComponent(name));
        if (!res.ok) return null;
        return await res.json();
      } catch { return null; }
    }

    populateSelect(el, items, placeholder) {
      if (!el) return;
      el.textContent = '';
      if (placeholder) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = placeholder;
        el.appendChild(opt);
      }
      items.forEach(item => {
        const opt = document.createElement('option');
        opt.value = item.value;
        opt.textContent = item.label;
        el.appendChild(opt);
      });
    }

    populateModelDropdown() {
      const sel = this.dom.selModel;
      if (!sel) return;
      sel.textContent = '';

      const groups = [
        { label: 'Chat Models (' + this.state.models.chat.length + ')', models: this.state.models.chat },
        { label: 'Completion Models (' + this.state.models.completion.length + ')', models: this.state.models.completion },
        { label: 'Embedding Models (' + this.state.models.embedding.length + ')', models: this.state.models.embedding },
      ];

      groups.forEach(g => {
        if (g.models.length === 0) return;
        const optgroup = document.createElement('optgroup');
        optgroup.label = g.label;
        g.models.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.modelId;
          opt.textContent = m.modelId;
          optgroup.appendChild(opt);
        });
        sel.appendChild(optgroup);
      });

      sel.value = 'gpt-4o-2024-05-13';
    }

    findModelConfig(modelId) {
      const all = [...this.state.models.chat, ...this.state.models.completion, ...this.state.models.embedding];
      return all.find(m => m.modelId === modelId) || null;
    }

    updateModelInfo() {
      const modelId = this.dom.selModel?.value;
      const config = this.findModelConfig(modelId);

      if (!config) {
        this.dom.modelInfoDisplay?.classList.add('hidden');
        return;
      }

      this.dom.modelInfoDisplay?.classList.remove('hidden');
      if (this.dom.infoProvider) this.dom.infoProvider.textContent = config.provider;
      if (this.dom.infoContext) this.dom.infoContext.textContent = config.capabilities.maxContextTokens.toLocaleString();
      if (this.dom.infoMaxOutput) this.dom.infoMaxOutput.textContent = config.capabilities.maxOutputTokens.toLocaleString();

      const caps = config.capabilities;
      const tags = [];
      if (caps.supportsVision) tags.push({ label: 'Vision', cls: 'tag-green' });
      if (caps.supportsTools) tags.push({ label: 'Tools', cls: 'tag-blue' });
      if (caps.supportsStreaming) tags.push({ label: 'Streaming', cls: 'tag-blue' });
      if (caps.supportsParallelToolCalls) tags.push({ label: 'Parallel Tools', cls: 'tag-blue' });
      if (caps.supportsSystemMessage) tags.push({ label: 'System Msg', cls: 'tag-green' });
      if (!caps.supportsTemperature) tags.push({ label: 'No Temperature', cls: 'tag-yellow' });

      if (this.dom.modelTags) {
        this.dom.modelTags.textContent = '';
        tags.forEach(t => {
          const span = document.createElement('span');
          span.className = 'tag ' + t.cls;
          span.textContent = t.label;
          this.dom.modelTags.appendChild(span);
        });
      }
    }

    estimateRequestSize() {
      const ep = this.state.currentEndpoint;
      if (ep === 'embeddings') {
        const textCount = parseInt(this.dom.inputTextCount?.value) || 5;
        return textCount * 80 + 200;
      }
      if (ep === 'completions') return 500;

      const complexity = this.state.currentComplexity;
      const turns = parseInt(this.dom.inputTurns?.value) || { simple: 1, medium: 3, complex: 6, stress: 20 }[complexity] || 3;
      const toolCount = parseInt(this.dom.inputTools?.value) || (complexity === 'complex' ? 3 : complexity === 'stress' ? 5 : 0);
      const hasSystemPrompt = complexity !== 'simple';
      const systemPromptSize = hasSystemPrompt ? (this.dom.selProfile?.value === 'maestro' ? 8000 : 1500) : 0;
      const base = systemPromptSize + (turns * 700) + (toolCount * 1500);
      const screenshotCount = parseInt(this.dom.inputScreenshots?.value) || 0;
      const screenshotSizeKb = parseInt(this.dom.inputScreenshotSize?.value) || 50;
      const screenshots = screenshotCount * screenshotSizeKb * 1.37 * 1024;
      return base + screenshots;
    }

    updateSizeEstimate() {
      const bytes = this.estimateRequestSize();
      if (this.dom.sizeEstimateValue) this.dom.sizeEstimateValue.textContent = '~' + formatBytes(bytes);
    }

    setupEventListeners() {
      // Section toggles with ARIA
      this.$$('[data-toggle-section]').forEach(header => {
        const section = header.parentElement;
        const body = section.querySelector('.form-section-body');
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        if (body) {
          const bodyId = body.id || ('section-body-' + Math.random().toString(36).slice(2, 8));
          body.id = bodyId;
          header.setAttribute('aria-controls', bodyId);
        }
        header.setAttribute('aria-expanded', !section.classList.contains('collapsed'));

        const toggle = () => {
          section.classList.toggle('collapsed');
          header.setAttribute('aria-expanded', !section.classList.contains('collapsed'));
        };

        header.addEventListener('click', toggle);
        header.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
      });

      // Generation mode tabs
      this.$$('#modeTabs .mode-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          this.$$('#modeTabs .mode-tab').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.currentMode = btn.dataset.mode;
          this.applyGenerationMode(this.state.currentMode);
        });
      });

      // Endpoint tabs
      this.$$('#endpointTabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.$$('#endpointTabs .tab-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.currentEndpoint = btn.dataset.endpoint;
          this.updateEndpointVisibility();
          this.updateModelForEndpoint();
          this.updateSizeEstimate();
        });
      });

      // Complexity segmented
      this.$$('#complexityControl .segmented-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.$$('#complexityControl .segmented-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.currentComplexity = btn.dataset.complexity;
          this.updateSizeEstimate();
        });
      });

      // Encoding format segmented
      this.$$('#encodingControl .segmented-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.$$('#encodingControl .segmented-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.state.currentEncoding = btn.dataset.encoding;
        });
      });

      // Temperature slider
      if (this.dom.rangeTemp) {
        this.dom.rangeTemp.addEventListener('input', () => {
          if (this.dom.tempValue) this.dom.tempValue.textContent = parseFloat(this.dom.rangeTemp.value).toFixed(1);
          this.updateAdvancedBadge();
        });
      }

      // Model change
      if (this.dom.selModel) {
        this.dom.selModel.addEventListener('change', () => {
          this.updateModelInfo();
          this.updateSizeEstimate();
        });
      }

      // Profile change
      if (this.dom.selProfile) {
        this.dom.selProfile.addEventListener('change', async () => {
          const name = this.dom.selProfile.value;
          if (!name) return;
          if (this.dom.selTemplate) this.dom.selTemplate.value = '';
          this.setModeTab('profile');
          const profile = await this.fetchProfileDefaults(name);
          if (profile?.defaults) this.applyProfileDefaults(profile.defaults);
          this.updateSizeEstimate();
        });
      }

      // Template change
      if (this.dom.selTemplate) {
        this.dom.selTemplate.addEventListener('change', () => {
          if (this.dom.selTemplate.value) {
            if (this.dom.selProfile) this.dom.selProfile.value = '';
            this.setModeTab('template');
          }
          this.updateSizeEstimate();
        });
      }

      // Preset dropdown
      const selPreset = this.$('#selPreset');
      if (selPreset) {
        selPreset.addEventListener('change', () => {
          if (selPreset.value) {
            this.applyPreset(selPreset.value);
          }
        });
      }

      // Advanced Options toggle
      const advToggleBtn = this.$('#advancedToggleBtn');
      if (advToggleBtn) {
        advToggleBtn.addEventListener('click', () => this.toggleAdvancedOptions());
      }

      // Size-affecting inputs
      ['inputTurns', 'inputTools', 'inputScreenshots', 'inputScreenshotSize', 'inputTextCount'].forEach(id => {
        const el = this.dom[id];
        if (el) el.addEventListener('input', () => this.updateSizeEstimate());
      });

      // Badge-affecting inputs (Tier 3 advanced options)
      ['inputTopic', 'inputMaxTokens', 'inputScreenshots'].forEach(id => {
        const el = this.dom[id];
        if (el) el.addEventListener('input', () => this.updateAdvancedBadge());
      });
      ['selLanguage', 'selDomain'].forEach(id => {
        const el = this.dom[id];
        if (el) el.addEventListener('change', () => this.updateAdvancedBadge());
      });
      ['toggleStream', 'toggleTosca', 'toggleToolsOnly', 'toggleImagesOnly', 'toggleStrict', 'toggleHubFormat', 'toggleCompact'].forEach(id => {
        const el = this.dom[id];
        if (el) el.addEventListener('change', () => this.updateAdvancedBadge());
      });
      if (this.dom.inputBatchCount) {
        this.dom.inputBatchCount.addEventListener('input', () => this.updateAdvancedBadge());
      }

      // Generate
      if (this.dom.btnGenerate) this.dom.btnGenerate.addEventListener('click', () => this.generate());

      // Copy
      if (this.dom.btnCopy) this.dom.btnCopy.addEventListener('click', () => this.copyToClipboard());

      // Download
      if (this.dom.btnDownload) this.dom.btnDownload.addEventListener('click', () => this.downloadJson());

      // Keyboard shortcut
      document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          const active = window.ToolRegistry.getActive();
          if (active && active.id === this.id) {
            e.preventDefault();
            this.generate();
          }
        }
      });
    }

    setModeTab(mode) {
      this.state.currentMode = mode;
      this.$$('#modeTabs .mode-tab').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
      });
      this.applyGenerationMode(mode);
    }

    applyGenerationMode(mode) {
      const sectionIds = {
        quickStart: '#sectionQuickStart', endpoint: '#sectionEndpoint',
        model: '#sectionModel', generation: '#sectionGeneration',
        contentOptions: '#sectionContentOptions',
        params: '#sectionParams', specialModes: '#sectionSpecialModes',
        outputOptions: '#sectionOutputOptions', batch: '#sectionBatch',
      };
      const visibility = {
        template: { quickStart: true, endpoint: false, model: true, generation: false, contentOptions: false, params: false, specialModes: false, outputOptions: true, batch: true },
        profile: { quickStart: true, endpoint: true, model: true, generation: true, contentOptions: true, params: true, specialModes: true, outputOptions: true, batch: true },
        custom: { quickStart: true, endpoint: true, model: true, generation: true, contentOptions: true, params: true, specialModes: true, outputOptions: true, batch: true },
      };
      const vis = visibility[mode] || visibility.custom;
      for (const [key, selector] of Object.entries(sectionIds)) {
        const el = this.$(selector);
        if (el) el.style.display = vis[key] ? '' : 'none';
      }

      // Show/hide advanced toggle based on whether any advanced sections are visible
      const advToggle = this.$('#advancedToggle');
      const hasAdvanced = vis.contentOptions || vis.params || vis.specialModes || vis.outputOptions || vis.batch;
      if (advToggle) advToggle.style.display = hasAdvanced ? '' : 'none';

      const profileGroup = this.dom.selProfile?.closest('.form-group');
      const templateGroup = this.dom.selTemplate?.closest('.form-group');
      const presetGroup = this.$('#presetGroup');
      const selPreset = this.$('#selPreset');

      if (mode === 'template') {
        if (this.dom.selProfile) this.dom.selProfile.value = '';
        if (profileGroup) profileGroup.style.display = 'none';
        if (templateGroup) templateGroup.style.display = '';
        if (presetGroup) presetGroup.style.display = 'none';
        if (selPreset) selPreset.value = '';
      } else if (mode === 'profile') {
        if (this.dom.selTemplate) this.dom.selTemplate.value = '';
        if (profileGroup) profileGroup.style.display = '';
        if (templateGroup) templateGroup.style.display = 'none';
        if (presetGroup) presetGroup.style.display = '';
        if (selPreset) selPreset.value = '';
      } else {
        if (profileGroup) profileGroup.style.display = '';
        if (templateGroup) templateGroup.style.display = '';
        if (presetGroup) presetGroup.style.display = '';
        if (this.dom.selProfile) this.dom.selProfile.value = '';
        if (this.dom.selTemplate) this.dom.selTemplate.value = '';
        if (selPreset) selPreset.value = '';
      }
    }

    applyProfileDefaults(defaults) {
      if (defaults.turns != null && this.dom.inputTurns) this.dom.inputTurns.value = defaults.turns;
      if (defaults.toolCount != null && this.dom.inputTools) this.dom.inputTools.value = defaults.toolCount;
      if (defaults.includeTools === false && this.dom.inputTools) this.dom.inputTools.value = '0';
      if (defaults.temperature != null && this.dom.rangeTemp) {
        this.dom.rangeTemp.value = defaults.temperature;
        if (this.dom.tempValue) this.dom.tempValue.textContent = parseFloat(defaults.temperature).toFixed(1);
      }
      if (defaults.maxTokens != null && this.dom.inputMaxTokens) this.dom.inputMaxTokens.value = defaults.maxTokens;
      if (defaults.topic && this.dom.inputTopic) this.dom.inputTopic.value = defaults.topic;
      if (defaults.stream != null && this.dom.toggleStream) this.dom.toggleStream.checked = defaults.stream;
    }

    applyPreset(presetName) {
      const preset = this.PRESETS[presetName];
      if (!preset) return;

      if (this.dom.selProfile) this.dom.selProfile.value = '';
      if (this.dom.selTemplate) this.dom.selTemplate.value = '';

      if (preset.endpoint) {
        this.state.currentEndpoint = preset.endpoint;
        this.$$('#endpointTabs .tab-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.endpoint === preset.endpoint);
        });
        this.updateEndpointVisibility();
      }

      if (preset.complexity) {
        this.state.currentComplexity = preset.complexity;
        this.$$('#complexityControl .segmented-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.complexity === preset.complexity);
        });
      }

      if (preset.model && this.dom.selModel) {
        this.dom.selModel.value = preset.model;
        this.updateModelInfo();
      }

      if (preset.profile) {
        if (this.dom.selProfile) this.dom.selProfile.value = preset.profile;
        this.setModeTab('profile');
      } else {
        this.setModeTab('custom');
      }

      if (this.dom.inputTurns) this.dom.inputTurns.value = preset.turns ?? '';
      if (this.dom.inputTools) this.dom.inputTools.value = preset.tools ?? '';
      if (this.dom.inputTopic) this.dom.inputTopic.value = preset.topic ?? '';
      if (this.dom.selLanguage) this.dom.selLanguage.value = preset.language ?? '';

      if (preset.temperature != null && this.dom.rangeTemp) {
        this.dom.rangeTemp.value = preset.temperature;
        if (this.dom.tempValue) this.dom.tempValue.textContent = preset.temperature.toFixed(1);
      }

      if (this.dom.inputMaxTokens) this.dom.inputMaxTokens.value = preset.maxTokens ?? '';
      if (this.dom.toggleStream) this.dom.toggleStream.checked = preset.stream ?? false;

      if (preset.textCount != null && this.dom.inputTextCount) this.dom.inputTextCount.value = preset.textCount;
      if (preset.dimensions != null && this.dom.inputDimensions) this.dom.inputDimensions.value = preset.dimensions;
      if (preset.input != null && this.dom.inputEmbeddingTexts) this.dom.inputEmbeddingTexts.value = preset.input;
      if (preset.encodingFormat) {
        this.state.currentEncoding = preset.encodingFormat;
        this.$$('#encodingControl .segmented-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.encoding === preset.encodingFormat);
        });
      }
      if (this.dom.toggleTosca) this.dom.toggleTosca.checked = preset.toscaCompatible ?? false;

      this.updateModelForEndpoint();
      this.updateSizeEstimate();
      this.updateAdvancedBadge();
    }

    updateEndpointVisibility() {
      const ep = this.state.currentEndpoint;
      this.dom.embeddingSection?.classList.toggle('hidden', ep !== 'embeddings');
      this.dom.promptGroup?.classList.toggle('hidden', ep !== 'completions');
    }

    updateModelForEndpoint() {
      const ep = this.state.currentEndpoint;
      const currentModel = this.dom.selModel?.value;
      const config = this.findModelConfig(currentModel);

      if (ep === 'embeddings' && config && config.type !== 'embedding') {
        if (this.state.models.embedding.length > 0 && this.dom.selModel) {
          this.dom.selModel.value = this.state.models.embedding[0].modelId;
          this.updateModelInfo();
        }
      } else if (ep === 'completions' && config && config.type !== 'completion') {
        if (this.state.models.completion.length > 0 && this.dom.selModel) {
          this.dom.selModel.value = this.state.models.completion[0].modelId;
          this.updateModelInfo();
        }
      } else if ((ep === 'chat' || ep === 'invoke' || ep === 'invoke-stream') && config && config.type !== 'chat') {
        if (this.state.models.chat.length > 0 && this.dom.selModel) {
          this.dom.selModel.value = this.state.models.chat[0].modelId;
          this.updateModelInfo();
        }
      }
    }

    async generate() {
      const btn = this.dom.btnGenerate;
      if (!btn || btn.classList.contains('loading')) return;

      const batchCount = parseInt(this.dom.inputBatchCount?.value) || 1;
      btn.classList.add('loading');
      btn.disabled = true;

      try {
        if (batchCount > 1) {
          await this.generateBatch(batchCount);
        } else {
          await this.generateSingle();
        }
      } catch (e) {
        showToast('Network error: ' + e.message, 'error');
      } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
        this.dom.batchProgress?.classList.add('hidden');
      }
    }

    async generateSingle() {
      const body = this.buildRequestBody();
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Generation failed', 'error'); return; }

      this.state.generatedJson = data.json;
      this.state.lastSummary = data.summary;
      this.state.batchResults = [data];
      this.state.activeBatchIndex = 0;

      this.dom.batchTabs?.classList.add('hidden');
      this.displayOutput(data.json);
      this.displaySummary(data.summary, data.endpointType);
      showToast('Request generated successfully');
    }

    async generateBatch(count) {
      const body = this.buildRequestBody();
      this.state.batchResults = [];
      this.state.activeBatchIndex = 0;

      this.dom.batchProgress?.classList.remove('hidden');
      if (this.dom.batchProgressFill) this.dom.batchProgressFill.style.width = '0%';

      for (let i = 0; i < count; i++) {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) { showToast('Request ' + (i + 1) + ' failed: ' + data.error, 'error'); continue; }
        this.state.batchResults.push(data);
        if (this.dom.batchProgressFill) this.dom.batchProgressFill.style.width = ((i + 1) / count * 100) + '%';
      }

      if (this.state.batchResults.length === 0) { showToast('All batch requests failed', 'error'); return; }

      const allParsed = this.state.batchResults.map(r => {
        try { return JSON.parse(r.json); } catch { return r.json; }
      });
      this.state.generatedJson = JSON.stringify(allParsed, null, 2);

      this.renderBatchTabs();
      this.showBatchResult(0);
      showToast('Batch complete: ' + this.state.batchResults.length + '/' + count + ' requests generated');
    }

    renderBatchTabs() {
      if (!this.dom.batchTabs) return;
      if (this.state.batchResults.length <= 1) { this.dom.batchTabs.classList.add('hidden'); return; }

      this.dom.batchTabs.classList.remove('hidden');
      this.dom.batchTabs.textContent = '';

      this.state.batchResults.forEach((_, i) => {
        const tab = document.createElement('button');
        tab.className = 'batch-tab' + (i === 0 ? ' active' : '');
        tab.dataset.batchIndex = i;
        tab.textContent = '#' + (i + 1);
        tab.addEventListener('click', () => this.onBatchTabClick(tab));
        this.dom.batchTabs.appendChild(tab);
      });

      const allTab = document.createElement('button');
      allTab.className = 'batch-tab';
      allTab.dataset.batchIndex = 'all';
      allTab.textContent = 'All (array)';
      allTab.addEventListener('click', () => this.onBatchTabClick(allTab));
      this.dom.batchTabs.appendChild(allTab);
    }

    onBatchTabClick(tab) {
      this.dom.batchTabs.querySelectorAll('.batch-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const idx = tab.dataset.batchIndex;
      if (idx === 'all') {
        this.displayOutput(this.state.generatedJson);
        this.dom.summaryPanel?.classList.add('hidden');
      } else {
        this.showBatchResult(parseInt(idx));
      }
    }

    showBatchResult(index) {
      this.state.activeBatchIndex = index;
      const result = this.state.batchResults[index];
      if (!result) return;
      this.displayOutput(result.json);
      this.displaySummary(result.summary, result.endpointType);
    }

    buildRequestBody() {
      const body = {
        complexity: this.state.currentComplexity,
        model: this.dom.selModel?.value,
        temperature: parseFloat(this.dom.rangeTemp?.value),
        stream: this.dom.toggleStream?.checked,
        compact: this.dom.toggleCompact?.checked,
        toscaCompatible: this.dom.toggleTosca?.checked,
        toolsOnly: this.dom.toggleToolsOnly?.checked,
        imagesOnly: this.dom.toggleImagesOnly?.checked,
        strict: this.dom.toggleStrict?.checked,
        hubFormat: this.dom.toggleHubFormat?.checked,
      };

      const ep = this.state.currentEndpoint;
      if (ep === 'completions') { body.endpoint = 'completions'; body.useCompletions = true; }
      else if (ep === 'embeddings') { body.endpoint = 'embeddings'; body.useEmbeddings = true; }
      else if (ep === 'invoke') { body.endpoint = 'invoke'; }
      else if (ep === 'invoke-stream') { body.endpoint = 'invoke-stream'; }
      else { body.endpoint = 'chat'; }

      if (this.dom.selProfile?.value) body.profile = this.dom.selProfile.value;
      if (this.dom.selTemplate?.value) body.template = this.dom.selTemplate.value;
      if (this.dom.inputTurns?.value) body.turns = parseInt(this.dom.inputTurns.value);
      if (this.dom.inputTools?.value !== '') body.tools = parseInt(this.dom.inputTools.value);
      if (this.dom.inputTopic?.value) body.topic = this.dom.inputTopic.value;
      if (this.dom.selLanguage?.value) body.language = this.dom.selLanguage.value;
      if (this.dom.selDomain?.value) body.domain = this.dom.selDomain.value;
      if (this.dom.inputMaxTokens?.value) body.maxTokens = parseInt(this.dom.inputMaxTokens.value);
      if (this.dom.inputPrompt?.value) body.prompt = this.dom.inputPrompt.value;
      if (this.dom.inputScreenshots?.value) body.screenshots = parseInt(this.dom.inputScreenshots.value);
      if (this.dom.inputScreenshotSize?.value) body.screenshotSizeKb = parseInt(this.dom.inputScreenshotSize.value);

      if (ep === 'embeddings') {
        if (this.dom.inputEmbeddingTexts?.value.trim()) body.input = this.dom.inputEmbeddingTexts.value.trim();
        if (this.dom.inputTextCount?.value) body.textCount = parseInt(this.dom.inputTextCount.value);
        if (this.dom.inputDimensions?.value) body.dimensions = parseInt(this.dom.inputDimensions.value);
        body.encodingFormat = this.state.currentEncoding;
      }
      return body;
    }

    displayOutput(json) {
      this.dom.emptyState?.classList.add('hidden');
      this.dom.jsonOutput?.classList.remove('hidden');

      let displayJson;
      try {
        const parsed = JSON.parse(json);
        displayJson = JSON.stringify(parsed, null, 2);
      } catch { displayJson = json; }

      if (this.dom.jsonOutput) {
        this.dom.jsonOutput.textContent = '';
        // Use innerHTML only for syntax-highlighted JSON (trusted generated content)
        this.dom.jsonOutput.insertAdjacentHTML('beforeend', syntaxHighlight(displayJson));
      }
      if (this.dom.outputSize) this.dom.outputSize.textContent = formatBytes(json.length);
    }

    displaySummary(summary, endpointType) {
      if (!summary) { this.dom.summaryPanel?.classList.add('hidden'); return; }
      this.dom.summaryPanel?.classList.remove('hidden');

      const rc = summary.requestConfig || {};
      const mi = summary.modelInfo || {};
      const val = summary.validation || {};

      const modelId = this.dom.selModel?.value;
      const endpointPath = this.state.endpoints[modelId];
      if (endpointPath && this.dom.endpointPathDisplay) {
        this.dom.endpointPathDisplay.classList.remove('hidden');
        this.dom.endpointPathDisplay.textContent = '';
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = 'API Path:';
        this.dom.endpointPathDisplay.appendChild(label);
        this.dom.endpointPathDisplay.appendChild(document.createTextNode(endpointPath));
      } else {
        this.dom.endpointPathDisplay?.classList.add('hidden');
      }

      if (this.dom.summaryBody) {
        this.dom.summaryBody.textContent = '';
        const col1 = document.createElement('div');
        col1.className = 'summary-col';
        col1.appendChild(this.createSummaryRow('Endpoint', rc.endpoint || endpointType));
        col1.appendChild(this.createSummaryRow('Model', rc.model));
        if (rc.profile) col1.appendChild(this.createSummaryRow('Profile', rc.profile));
        if (rc.template) col1.appendChild(this.createSummaryRow('Template', rc.template));
        col1.appendChild(this.createSummaryRow('Complexity', rc.complexity));

        const col2 = document.createElement('div');
        col2.className = 'summary-col';
        if (rc.turns != null) col2.appendChild(this.createSummaryRow('Turns', rc.turns));
        if (rc.tools != null) col2.appendChild(this.createSummaryRow('Tools', rc.tools));
        col2.appendChild(this.createSummaryRow('Stream', rc.stream ? 'Yes' : 'No'));
        if (mi.provider) col2.appendChild(this.createSummaryRow('Provider', mi.provider));
        if (mi.maxContextTokens) col2.appendChild(this.createSummaryRow('Context', mi.maxContextTokens.toLocaleString()));

        this.dom.summaryBody.appendChild(col1);
        this.dom.summaryBody.appendChild(col2);
      }

      if (this.dom.summaryWarnings) {
        this.dom.summaryWarnings.textContent = '';
        let hasContent = false;
        if (val.warnings?.length > 0) {
          val.warnings.forEach(w => {
            const div = document.createElement('div');
            div.className = 'warning-item';
            div.textContent = w;
            this.dom.summaryWarnings.appendChild(div);
          });
          hasContent = true;
        }
        if (val.predictions?.length > 0) {
          val.predictions.forEach(p => {
            const div = document.createElement('div');
            div.className = 'prediction-item';
            div.textContent = p;
            this.dom.summaryWarnings.appendChild(div);
          });
          hasContent = true;
        }
        this.dom.summaryWarnings.style.display = hasContent ? 'block' : 'none';
      }
    }

    createSummaryRow(label, value) {
      const div = document.createElement('div');
      div.className = 'summary-item';
      const labelSpan = document.createElement('span');
      labelSpan.className = 'label';
      labelSpan.textContent = label;
      const valueSpan = document.createElement('span');
      valueSpan.className = 'value';
      valueSpan.textContent = String(value ?? '--');
      div.appendChild(labelSpan);
      div.appendChild(valueSpan);
      return div;
    }

    async copyToClipboard() {
      if (!this.state.generatedJson) { showToast('Nothing to copy', 'error'); return; }
      await utilCopy(this.state.generatedJson);
      showToast('Copied to clipboard');
    }

    downloadJson() {
      if (!this.state.generatedJson) { showToast('Nothing to download', 'error'); return; }
      const blob = new Blob([this.state.generatedJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const model = (this.dom.selModel?.value || 'model').replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const batchSuffix = this.state.batchResults.length > 1 ? '_batch' + this.state.batchResults.length : '';
      a.download = model + batchSuffix + '_' + timestamp + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Download started');
    }

    onReset() {
      const d = this.dom;
      if (d.selProfile) d.selProfile.value = '';
      if (d.selTemplate) d.selTemplate.value = '';
      if (d.selModel) d.selModel.value = 'gpt-4o-2024-05-13';
      if (d.inputTurns) d.inputTurns.value = '';
      if (d.inputTools) d.inputTools.value = '';
      if (d.inputTopic) d.inputTopic.value = '';
      if (d.selLanguage) d.selLanguage.value = '';
      if (d.selDomain) d.selDomain.value = '';
      if (d.inputPrompt) d.inputPrompt.value = '';
      if (d.rangeTemp) d.rangeTemp.value = 0.7;
      if (d.tempValue) d.tempValue.textContent = '0.7';
      if (d.inputMaxTokens) d.inputMaxTokens.value = '';
      if (d.toggleStream) d.toggleStream.checked = false;
      if (d.inputEmbeddingTexts) d.inputEmbeddingTexts.value = '';
      if (d.inputTextCount) d.inputTextCount.value = '';
      if (d.inputDimensions) d.inputDimensions.value = '';
      if (d.inputScreenshots) d.inputScreenshots.value = '';
      if (d.inputScreenshotSize) d.inputScreenshotSize.value = '';
      if (d.toggleTosca) d.toggleTosca.checked = false;
      if (d.toggleToolsOnly) d.toggleToolsOnly.checked = false;
      if (d.toggleImagesOnly) d.toggleImagesOnly.checked = false;
      if (d.toggleStrict) d.toggleStrict.checked = false;
      if (d.toggleHubFormat) d.toggleHubFormat.checked = false;
      if (d.toggleCompact) d.toggleCompact.checked = false;
      if (d.inputBatchCount) d.inputBatchCount.value = '1';

      this.state.currentEndpoint = 'chat';
      this.state.currentComplexity = 'medium';
      this.state.currentEncoding = 'float';
      this.state.currentMode = 'custom';
      this.state.batchResults = [];

      this.$$('#endpointTabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.endpoint === 'chat'));
      this.$$('#complexityControl .segmented-btn').forEach(b => b.classList.toggle('active', b.dataset.complexity === 'medium'));
      this.$$('#encodingControl .segmented-btn').forEach(b => b.classList.toggle('active', b.dataset.encoding === 'float'));
      this.$$('#modeTabs .mode-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === 'custom'));
      const selPreset = this.$('#selPreset');
      if (selPreset) selPreset.value = '';

      if (d.batchTabs) { d.batchTabs.classList.add('hidden'); d.batchTabs.textContent = ''; }

      this.updateEndpointVisibility();
      this.updateModelInfo();
      this.updateSizeEstimate();

      // Collapse advanced options and reset badge
      const advContainer = this.$('#advancedOptions');
      const advToggle = this.$('#advancedToggle');
      if (advContainer) advContainer.classList.add('hidden');
      if (advToggle) advToggle.classList.remove('expanded');
      this.updateAdvancedBadge();
    }

    toggleAdvancedOptions() {
      const container = this.$('#advancedOptions');
      const toggle = this.$('#advancedToggle');
      if (!container || !toggle) return;

      const isHidden = container.classList.contains('hidden');
      container.classList.toggle('hidden', !isHidden);
      toggle.classList.toggle('expanded', isHidden);
    }

    updateAdvancedBadge() {
      const badge = this.$('#advancedBadge');
      if (!badge) return;

      let count = 0;
      // Content Options
      if (this.dom.inputTopic?.value?.trim()) count++;
      if (this.dom.selLanguage?.value) count++;
      if (this.dom.selDomain?.value) count++;
      // Model Parameters
      if (parseFloat(this.dom.rangeTemp?.value) !== 0.7) count++;
      if (this.dom.inputMaxTokens?.value) count++;
      if (this.dom.toggleStream?.checked) count++;
      // Special Modes
      if (this.dom.toggleTosca?.checked) count++;
      if (this.dom.toggleToolsOnly?.checked) count++;
      if (this.dom.toggleImagesOnly?.checked) count++;
      if (this.dom.toggleStrict?.checked) count++;
      if (this.dom.toggleHubFormat?.checked) count++;
      if (parseInt(this.dom.inputScreenshots?.value) > 0) count++;
      // Output Options
      if (this.dom.toggleCompact?.checked) count++;
      // Batch
      if (parseInt(this.dom.inputBatchCount?.value) > 1) count++;

      if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  // Register the tool
  window.ToolRegistry.register(new RequestGeneratorTool());
})();
