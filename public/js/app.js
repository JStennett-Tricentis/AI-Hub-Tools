/* ============================================================
   AI Hub Tools -- Web UI Application
   ============================================================ */

(function () {
  'use strict';

  // ---- State ----
  const state = {
    models: { chat: [], completion: [], embedding: [] },
    endpoints: {},
    profiles: [],
    templates: [],
    currentEndpoint: 'chat',
    currentComplexity: 'medium',
    currentEncoding: 'float',
    currentMode: 'custom', // template | profile | custom
    generatedJson: '',
    batchResults: [],   // array of { json, endpointType, summary } for batch
    activeBatchIndex: 0,
    lastSummary: null,
  };

  // ---- DOM refs ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
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
    btnReset: $('#btnReset'),
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
    toast: $('#toast'),
  };

  // ---- Example Presets (Section 12.3 mappings) ----
  const PRESETS = {
    'multi-turn-analysis': {
      // Scenario 01: profile="security", endpoint="chat"
      endpoint: 'chat',
      profile: 'security',
      model: 'gpt-4o-2024-05-13',
      stream: false,
    },
    'nested-tool-params': {
      // Scenario 02: profile="migration", endpoint="chat" (or template="data-migration")
      endpoint: 'chat',
      profile: 'migration',
      model: 'gpt-4o-2024-05-13',
      stream: false,
    },
    'large-history': {
      // Scenario 03: profile="stress", turns=30, tools=5, endpoint="chat"
      endpoint: 'chat',
      profile: 'stress',
      turns: 30,
      tools: 5,
      model: 'gpt-4o-2024-05-13',
      stream: false,
    },
    'streaming-tools': {
      // Scenario 04: profile="security", stream=true, endpoint="chat"
      endpoint: 'chat',
      profile: 'security',
      model: 'gpt-4o-2024-05-13',
      stream: true,
    },
    'batch-embeddings': {
      // Scenario 05: endpoint="embeddings", textCount=50, model="text-embedding-ada-002-2"
      endpoint: 'embeddings',
      model: 'text-embedding-ada-002-2',
      textCount: 50,
      encodingFormat: 'float',
    },
    'multilingual-embeddings': {
      // Scenario 06: endpoint="embeddings", input="multilingual texts...", model="text-embedding-ada-002-2"
      endpoint: 'embeddings',
      model: 'text-embedding-ada-002-2',
      input: 'Explain the concept of machine learning,Expliquez le concept de apprentissage automatique,Explicar el concepto de aprendizaje automatico,SELECT * FROM users WHERE active = true,console.log("Hello world")',
      encodingFormat: 'float',
    },
    'document-clustering': {
      // Scenario 07: endpoint="embeddings", textCount=20, dimensions=1536, model="text-embedding-ada-002-2"
      endpoint: 'embeddings',
      model: 'text-embedding-ada-002-2',
      textCount: 20,
      dimensions: 1536,
      encodingFormat: 'float',
    },
    'edge-cases': {
      // Scenario 08: complexity="stress", turns=40, tools=10, maxTokens=16000, endpoint="chat"
      endpoint: 'chat',
      complexity: 'stress',
      model: 'gpt-4o-2024-05-13',
      turns: 40,
      tools: 10,
      maxTokens: 16000,
      temperature: 0.9,
      stream: false,
    },
  };

  // ---- Top-level tool nav ----
  let usageCalculatorInitialized = false;

  function setupTopNav() {
    const navBtns = document.querySelectorAll('#topNav .top-nav-btn');
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const toolName = btn.dataset.tool;

        // Hide all tool panels
        document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));

        // Show selected
        const panel = document.getElementById('tool-' + toolName);
        if (panel) panel.classList.add('active');

        // Lazy init Usage Calculator
        if (toolName === 'usage-calculator' && !usageCalculatorInitialized) {
          usageCalculatorInitialized = true;
          if (window.UsageCalculator && typeof window.UsageCalculator.init === 'function') {
            window.UsageCalculator.init();
          }
        }
      });
    });
  }

  // ---- Init ----
  async function init() {
    setupTopNav();
    setupEventListeners();
    await Promise.all([
      fetchModels(),
      fetchProfiles(),
      fetchTemplates(),
      fetchEndpoints(),
    ]);
    populateModelDropdown();
    updateModelInfo();
    updateSizeEstimate();
    applyGenerationMode(state.currentMode);
  }

  // ---- API calls ----
  async function fetchModels() {
    try {
      const res = await fetch('/api/models');
      state.models = await res.json();
    } catch (e) {
      console.error('Failed to fetch models:', e);
    }
  }

  async function fetchProfiles() {
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      state.profiles = data.profiles || [];
      populateSelect(dom.selProfile, state.profiles.map(p => ({ value: p, label: p })), '-- None --');
    } catch (e) {
      console.error('Failed to fetch profiles:', e);
    }
  }

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      state.templates = data.templates || [];
      populateSelect(dom.selTemplate, state.templates.map(t => ({ value: t, label: t })), '-- None --');
    } catch (e) {
      console.error('Failed to fetch templates:', e);
    }
  }

  async function fetchEndpoints() {
    try {
      const res = await fetch('/api/endpoints');
      const data = await res.json();
      state.endpoints = data.endpoints || {};
    } catch (e) {
      console.error('Failed to fetch endpoints:', e);
    }
  }

  async function fetchProfileDefaults(name) {
    try {
      const res = await fetch(`/api/profiles/${encodeURIComponent(name)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // ---- Populate helpers ----
  function populateSelect(el, items, placeholder) {
    el.innerHTML = '';
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

  function populateModelDropdown() {
    const sel = dom.selModel;
    sel.innerHTML = '';

    const groups = [
      { label: `Chat Models (${state.models.chat.length})`, models: state.models.chat },
      { label: `Completion Models (${state.models.completion.length})`, models: state.models.completion },
      { label: `Embedding Models (${state.models.embedding.length})`, models: state.models.embedding },
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

    // Default model
    sel.value = 'gpt-4o-2024-05-13';
  }

  // ---- Model info display ----
  function findModelConfig(modelId) {
    const all = [...state.models.chat, ...state.models.completion, ...state.models.embedding];
    return all.find(m => m.modelId === modelId) || null;
  }

  function updateModelInfo() {
    const modelId = dom.selModel.value;
    const config = findModelConfig(modelId);

    if (!config) {
      dom.modelInfoDisplay.classList.add('hidden');
      return;
    }

    dom.modelInfoDisplay.classList.remove('hidden');
    dom.infoProvider.textContent = config.provider;
    dom.infoContext.textContent = config.capabilities.maxContextTokens.toLocaleString();
    dom.infoMaxOutput.textContent = config.capabilities.maxOutputTokens.toLocaleString();

    // Tags
    const caps = config.capabilities;
    const tags = [];
    if (caps.supportsVision) tags.push({ label: 'Vision', cls: 'tag-green' });
    if (caps.supportsTools) tags.push({ label: 'Tools', cls: 'tag-blue' });
    if (caps.supportsStreaming) tags.push({ label: 'Streaming', cls: 'tag-blue' });
    if (caps.supportsParallelToolCalls) tags.push({ label: 'Parallel Tools', cls: 'tag-blue' });
    if (caps.supportsSystemMessage) tags.push({ label: 'System Msg', cls: 'tag-green' });
    if (!caps.supportsTemperature) tags.push({ label: 'No Temperature', cls: 'tag-yellow' });

    dom.modelTags.innerHTML = tags.map(t => `<span class="tag ${t.cls}">${t.label}</span>`).join('');
  }

  // ---- Size Estimation (Section 15.4) ----
  function estimateRequestSize() {
    const ep = state.currentEndpoint;

    if (ep === 'embeddings') {
      const textCount = parseInt(dom.inputTextCount.value) || 5;
      // avg ~80 bytes per generated text template
      return textCount * 80 + 200;
    }

    if (ep === 'completions') {
      return 500; // legacy completions are small
    }

    // Chat / Invoke
    const complexity = state.currentComplexity;
    const turns = parseInt(dom.inputTurns.value) || { simple: 1, medium: 3, complex: 6, stress: 20 }[complexity] || 3;
    const toolCount = parseInt(dom.inputTools.value) || (complexity === 'complex' ? 3 : complexity === 'stress' ? 5 : 0);

    // System prompt size: simple=0, medium=500B, complex/stress=2KB, maestro=8KB
    const hasSystemPrompt = complexity !== 'simple';
    const systemPromptSize = hasSystemPrompt ? (dom.selProfile.value === 'maestro' ? 8000 : 1500) : 0;

    // Avg message size: ~700 bytes per turn (user+assistant pair)
    const avgMessageSize = 700;

    // Tool definitions: ~1500 bytes each
    const avgToolSize = 1500;

    const base = systemPromptSize + (turns * avgMessageSize) + (toolCount * avgToolSize);

    // Screenshots: count * sizeKb * 1.37 (base64 overhead) * 1024
    const screenshotCount = parseInt(dom.inputScreenshots.value) || 0;
    const screenshotSizeKb = parseInt(dom.inputScreenshotSize.value) || 50;
    const screenshots = screenshotCount * screenshotSizeKb * 1.37 * 1024;

    return base + screenshots;
  }

  function updateSizeEstimate() {
    const bytes = estimateRequestSize();
    dom.sizeEstimateValue.textContent = '~' + formatBytes(bytes);
  }

  // ---- Event listeners ----
  function setupEventListeners() {
    // Section toggles
    $$('[data-toggle-section]').forEach(header => {
      header.addEventListener('click', () => {
        header.parentElement.classList.toggle('collapsed');
      });
    });

    // Generation mode tabs
    $$('#modeTabs .mode-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#modeTabs .mode-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentMode = btn.dataset.mode;
        applyGenerationMode(state.currentMode);
      });
    });

    // Endpoint tabs
    $$('#endpointTabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#endpointTabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentEndpoint = btn.dataset.endpoint;
        updateEndpointVisibility();
        updateModelForEndpoint();
        updateSizeEstimate();
      });
    });

    // Complexity segmented
    $$('#complexityControl .segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#complexityControl .segmented-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentComplexity = btn.dataset.complexity;
        updateSizeEstimate();
      });
    });

    // Encoding format segmented
    $$('#encodingControl .segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#encodingControl .segmented-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentEncoding = btn.dataset.encoding;
      });
    });

    // Temperature slider
    dom.rangeTemp.addEventListener('input', () => {
      dom.tempValue.textContent = parseFloat(dom.rangeTemp.value).toFixed(1);
    });

    // Model change
    dom.selModel.addEventListener('change', () => {
      updateModelInfo();
      updateSizeEstimate();
    });

    // Profile change
    dom.selProfile.addEventListener('change', async () => {
      const name = dom.selProfile.value;
      if (!name) return;

      // Clear template, switch mode
      dom.selTemplate.value = '';
      setModeTab('profile');

      const profile = await fetchProfileDefaults(name);
      if (!profile || !profile.defaults) return;
      applyProfileDefaults(profile.defaults);
      updateSizeEstimate();
    });

    // Template change
    dom.selTemplate.addEventListener('change', () => {
      if (dom.selTemplate.value) {
        dom.selProfile.value = '';
        setModeTab('template');
      }
      updateSizeEstimate();
    });

    // Preset buttons
    $$('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyPreset(btn.dataset.preset);
      });
    });

    // Size-affecting inputs
    ['inputTurns', 'inputTools', 'inputScreenshots', 'inputScreenshotSize', 'inputTextCount'].forEach(id => {
      const el = dom[id];
      if (el) el.addEventListener('input', updateSizeEstimate);
    });

    // Generate
    dom.btnGenerate.addEventListener('click', generate);

    // Copy
    dom.btnCopy.addEventListener('click', copyToClipboard);

    // Download
    dom.btnDownload.addEventListener('click', downloadJson);

    // Reset
    dom.btnReset.addEventListener('click', resetForm);

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        generate();
      }
    });
  }

  // ---- Generation mode ----
  function setModeTab(mode) {
    state.currentMode = mode;
    $$('#modeTabs .mode-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    applyGenerationMode(mode);
  }

  function applyGenerationMode(mode) {
    // Section visibility per mode:
    //   Template: Quick Start (template dropdown only), Model, Output Options, Batch
    //   Profile:  Quick Start (profile dropdown only), Endpoint, Model, Generation, Params, Special, Output, Batch
    //   Custom:   All sections visible
    const sectionIds = {
      quickStart:    '#sectionQuickStart',
      endpoint:      '#sectionEndpoint',
      model:         '#sectionModel',
      generation:    '#sectionGeneration',
      params:        '#sectionParams',
      specialModes:  '#sectionSpecialModes',
      outputOptions: '#sectionOutputOptions',
      batch:         '#sectionBatch',
    };

    const visibility = {
      template: {
        quickStart: true, endpoint: false, model: true, generation: false,
        params: false, specialModes: false, outputOptions: true, batch: true,
      },
      profile: {
        quickStart: true, endpoint: true, model: true, generation: true,
        params: true, specialModes: true, outputOptions: true, batch: true,
      },
      custom: {
        quickStart: true, endpoint: true, model: true, generation: true,
        params: true, specialModes: true, outputOptions: true, batch: true,
      },
    };

    const vis = visibility[mode] || visibility.custom;
    for (const [key, selector] of Object.entries(sectionIds)) {
      const el = document.querySelector(selector);
      if (el) {
        el.style.display = vis[key] ? '' : 'none';
      }
    }

    // Toggle which dropdown is prominent in Quick Start
    const profileGroup = dom.selProfile?.closest('.form-group');
    const templateGroup = dom.selTemplate?.closest('.form-group');
    const presetGrid = document.querySelector('.preset-grid');
    const presetLabel = document.querySelector('#presetLabel');

    if (mode === 'template') {
      dom.selProfile.value = '';
      if (profileGroup) profileGroup.style.display = 'none';
      if (templateGroup) templateGroup.style.display = '';
      if (presetGrid) presetGrid.style.display = 'none';
      if (presetLabel) presetLabel.style.display = 'none';
      $$('.preset-btn').forEach(b => b.classList.remove('active'));
    } else if (mode === 'profile') {
      dom.selTemplate.value = '';
      if (profileGroup) profileGroup.style.display = '';
      if (templateGroup) templateGroup.style.display = 'none';
      if (presetGrid) presetGrid.style.display = '';
      if (presetLabel) presetLabel.style.display = '';
      $$('.preset-btn').forEach(b => b.classList.remove('active'));
    } else {
      // Custom: show both dropdowns and presets
      if (profileGroup) profileGroup.style.display = '';
      if (templateGroup) templateGroup.style.display = '';
      if (presetGrid) presetGrid.style.display = '';
      if (presetLabel) presetLabel.style.display = '';
      dom.selProfile.value = '';
      dom.selTemplate.value = '';
      $$('.preset-btn').forEach(b => b.classList.remove('active'));
    }
  }

  // ---- Apply profile defaults to form ----
  function applyProfileDefaults(defaults) {
    if (defaults.turns != null) dom.inputTurns.value = defaults.turns;
    if (defaults.toolCount != null) dom.inputTools.value = defaults.toolCount;
    if (defaults.includeTools === false) dom.inputTools.value = '0';
    if (defaults.temperature != null) {
      dom.rangeTemp.value = defaults.temperature;
      dom.tempValue.textContent = parseFloat(defaults.temperature).toFixed(1);
    }
    if (defaults.maxTokens != null) dom.inputMaxTokens.value = defaults.maxTokens;
    if (defaults.topic) dom.inputTopic.value = defaults.topic;
    if (defaults.stream != null) dom.toggleStream.checked = defaults.stream;
  }

  // ---- Apply preset to form ----
  function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return;

    // Clear profile/template first
    dom.selProfile.value = '';
    dom.selTemplate.value = '';

    // Endpoint
    if (preset.endpoint) {
      state.currentEndpoint = preset.endpoint;
      $$('#endpointTabs .tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.endpoint === preset.endpoint);
      });
      updateEndpointVisibility();
    }

    // Complexity
    if (preset.complexity) {
      state.currentComplexity = preset.complexity;
      $$('#complexityControl .segmented-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.complexity === preset.complexity);
      });
    }

    // Model
    if (preset.model) {
      dom.selModel.value = preset.model;
      updateModelInfo();
    }

    // Profile-based presets: set profile and let server resolve defaults
    if (preset.profile) {
      dom.selProfile.value = preset.profile;
      setModeTab('profile');
    } else {
      setModeTab('custom');
    }

    // Fields (only set if explicitly provided in preset)
    dom.inputTurns.value = preset.turns ?? '';
    dom.inputTools.value = preset.tools ?? '';
    dom.inputTopic.value = preset.topic ?? '';
    dom.selLanguage.value = preset.language ?? '';

    if (preset.temperature != null) {
      dom.rangeTemp.value = preset.temperature;
      dom.tempValue.textContent = preset.temperature.toFixed(1);
    }

    if (preset.maxTokens != null) {
      dom.inputMaxTokens.value = preset.maxTokens;
    } else {
      dom.inputMaxTokens.value = '';
    }

    dom.toggleStream.checked = preset.stream ?? false;

    // Embedding fields
    if (preset.textCount != null) dom.inputTextCount.value = preset.textCount;
    if (preset.dimensions != null) dom.inputDimensions.value = preset.dimensions;
    if (preset.input != null) dom.inputEmbeddingTexts.value = preset.input;
    if (preset.encodingFormat) {
      state.currentEncoding = preset.encodingFormat;
      $$('#encodingControl .segmented-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.encoding === preset.encodingFormat);
      });
    }

    // Special modes
    dom.toggleTosca.checked = preset.toscaCompatible ?? false;

    updateModelForEndpoint();
    updateSizeEstimate();
  }

  // ---- Endpoint visibility ----
  function updateEndpointVisibility() {
    const ep = state.currentEndpoint;
    const isEmbedding = ep === 'embeddings';
    const isCompletions = ep === 'completions';

    dom.embeddingSection.classList.toggle('hidden', !isEmbedding);
    dom.promptGroup.classList.toggle('hidden', !isCompletions);
  }

  function updateModelForEndpoint() {
    const ep = state.currentEndpoint;
    const currentModel = dom.selModel.value;
    const config = findModelConfig(currentModel);

    // Auto-switch model if current is incompatible
    if (ep === 'embeddings' && config && config.type !== 'embedding') {
      if (state.models.embedding.length > 0) {
        dom.selModel.value = state.models.embedding[0].modelId;
        updateModelInfo();
      }
    } else if (ep === 'completions' && config && config.type !== 'completion') {
      if (state.models.completion.length > 0) {
        dom.selModel.value = state.models.completion[0].modelId;
        updateModelInfo();
      }
    } else if ((ep === 'chat' || ep === 'invoke' || ep === 'invoke-stream') && config && config.type !== 'chat') {
      if (state.models.chat.length > 0) {
        dom.selModel.value = state.models.chat[0].modelId;
        updateModelInfo();
      }
    }
  }

  // ---- Generate request ----
  async function generate() {
    const btn = dom.btnGenerate;
    if (btn.classList.contains('loading')) return;

    const batchCount = parseInt(dom.inputBatchCount.value) || 1;

    btn.classList.add('loading');
    btn.disabled = true;

    try {
      if (batchCount > 1) {
        await generateBatch(batchCount);
      } else {
        await generateSingle();
      }
    } catch (e) {
      showToast('Network error: ' + e.message, 'error');
    } finally {
      btn.classList.remove('loading');
      btn.disabled = false;
      dom.batchProgress.classList.add('hidden');
    }
  }

  async function generateSingle() {
    const body = buildRequestBody();
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Generation failed', 'error');
      return;
    }

    state.generatedJson = data.json;
    state.lastSummary = data.summary;
    state.batchResults = [data];
    state.activeBatchIndex = 0;

    dom.batchTabs.classList.add('hidden');
    displayOutput(data.json);
    displaySummary(data.summary, data.endpointType);
    showToast('Request generated successfully');
  }

  async function generateBatch(count) {
    const body = buildRequestBody();
    state.batchResults = [];
    state.activeBatchIndex = 0;

    dom.batchProgress.classList.remove('hidden');
    dom.batchProgressFill.style.width = '0%';

    for (let i = 0; i < count; i++) {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(`Request ${i + 1} failed: ${data.error}`, 'error');
        continue;
      }

      state.batchResults.push(data);
      dom.batchProgressFill.style.width = ((i + 1) / count * 100) + '%';
    }

    if (state.batchResults.length === 0) {
      showToast('All batch requests failed', 'error');
      return;
    }

    // Build combined JSON array for download/copy
    const allParsed = state.batchResults.map(r => {
      try { return JSON.parse(r.json); } catch { return r.json; }
    });
    state.generatedJson = JSON.stringify(allParsed, null, 2);

    // Show batch tabs
    renderBatchTabs();
    showBatchResult(0);

    showToast(`Batch complete: ${state.batchResults.length}/${count} requests generated`);
  }

  function renderBatchTabs() {
    if (state.batchResults.length <= 1) {
      dom.batchTabs.classList.add('hidden');
      return;
    }

    dom.batchTabs.classList.remove('hidden');
    dom.batchTabs.innerHTML = state.batchResults.map((_, i) =>
      `<button class="batch-tab${i === 0 ? ' active' : ''}" data-batch-index="${i}">#${i + 1}</button>`
    ).join('') + `<button class="batch-tab" data-batch-index="all">All (array)</button>`;

    dom.batchTabs.querySelectorAll('.batch-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        dom.batchTabs.querySelectorAll('.batch-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const idx = tab.dataset.batchIndex;
        if (idx === 'all') {
          displayOutput(state.generatedJson);
          dom.summaryPanel.classList.add('hidden');
        } else {
          showBatchResult(parseInt(idx));
        }
      });
    });
  }

  function showBatchResult(index) {
    state.activeBatchIndex = index;
    const result = state.batchResults[index];
    if (!result) return;
    displayOutput(result.json);
    displaySummary(result.summary, result.endpointType);
  }

  function buildRequestBody() {
    const body = {
      complexity: state.currentComplexity,
      model: dom.selModel.value,
      temperature: parseFloat(dom.rangeTemp.value),
      stream: dom.toggleStream.checked,
      compact: dom.toggleCompact.checked,
      toscaCompatible: dom.toggleTosca.checked,
      toolsOnly: dom.toggleToolsOnly.checked,
      imagesOnly: dom.toggleImagesOnly.checked,
      strict: dom.toggleStrict.checked,
      hubFormat: dom.toggleHubFormat.checked,
    };

    // Endpoint
    const ep = state.currentEndpoint;
    if (ep === 'completions') {
      body.endpoint = 'completions';
      body.useCompletions = true;
    } else if (ep === 'embeddings') {
      body.endpoint = 'embeddings';
      body.useEmbeddings = true;
    } else if (ep === 'invoke') {
      body.endpoint = 'invoke';
    } else if (ep === 'invoke-stream') {
      body.endpoint = 'invoke-stream';
    } else {
      body.endpoint = 'chat';
    }

    // Optional fields
    if (dom.selProfile.value) body.profile = dom.selProfile.value;
    if (dom.selTemplate.value) body.template = dom.selTemplate.value;
    if (dom.inputTurns.value) body.turns = parseInt(dom.inputTurns.value);
    if (dom.inputTools.value !== '') body.tools = parseInt(dom.inputTools.value);
    if (dom.inputTopic.value) body.topic = dom.inputTopic.value;
    if (dom.selLanguage.value) body.language = dom.selLanguage.value;
    if (dom.selDomain.value) body.domain = dom.selDomain.value;
    if (dom.inputMaxTokens.value) body.maxTokens = parseInt(dom.inputMaxTokens.value);
    if (dom.inputPrompt.value) body.prompt = dom.inputPrompt.value;

    // Screenshots
    if (dom.inputScreenshots.value) body.screenshots = parseInt(dom.inputScreenshots.value);
    if (dom.inputScreenshotSize.value) body.screenshotSizeKb = parseInt(dom.inputScreenshotSize.value);

    // Embedding-specific
    if (ep === 'embeddings') {
      if (dom.inputEmbeddingTexts.value.trim()) {
        body.input = dom.inputEmbeddingTexts.value.trim();
      }
      if (dom.inputTextCount.value) body.textCount = parseInt(dom.inputTextCount.value);
      if (dom.inputDimensions.value) body.dimensions = parseInt(dom.inputDimensions.value);
      body.encodingFormat = state.currentEncoding;
    }

    return body;
  }

  // ---- Display output ----
  function displayOutput(json) {
    dom.emptyState.classList.add('hidden');
    dom.jsonOutput.classList.remove('hidden');

    // Pretty-print if it's compact
    let displayJson;
    try {
      const parsed = JSON.parse(json);
      displayJson = JSON.stringify(parsed, null, 2);
    } catch {
      displayJson = json;
    }

    dom.jsonOutput.innerHTML = syntaxHighlight(displayJson);
    dom.outputSize.textContent = formatBytes(json.length);
  }

  function syntaxHighlight(json) {
    // Escape HTML entities
    const escaped = json
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(
      /("(?:\\.|[^"\\])*")\s*:/g,
      '<span class="json-key">$1</span>:'
    ).replace(
      /:\s*("(?:\\.|[^"\\])*")/g,
      ': <span class="json-string">$1</span>'
    ).replace(
      /:\s*(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
      ': <span class="json-number">$1</span>'
    ).replace(
      /:\s*(true|false)/g,
      ': <span class="json-boolean">$1</span>'
    ).replace(
      /:\s*(null)/g,
      ': <span class="json-null">$1</span>'
    ).replace(
      // Standalone strings in arrays
      /(?<=[\[,]\s*\n?\s*)("(?:\\.|[^"\\])*")(?=\s*[,\]])/g,
      '<span class="json-string">$1</span>'
    );
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ---- Display summary ----
  function displaySummary(summary, endpointType) {
    if (!summary) {
      dom.summaryPanel.classList.add('hidden');
      return;
    }

    dom.summaryPanel.classList.remove('hidden');

    const rc = summary.requestConfig || {};
    const mi = summary.modelInfo || {};
    const val = summary.validation || {};

    // Endpoint path
    const modelId = dom.selModel.value;
    const endpointPath = state.endpoints[modelId];
    if (endpointPath) {
      dom.endpointPathDisplay.classList.remove('hidden');
      dom.endpointPathDisplay.innerHTML =
        '<span class="label">API Path:</span>' + escapeHtml(endpointPath);
    } else {
      dom.endpointPathDisplay.classList.add('hidden');
    }

    // Summary body
    let html = '<div class="summary-col">';
    html += summaryRow('Endpoint', rc.endpoint || endpointType);
    html += summaryRow('Model', rc.model);
    if (rc.profile) html += summaryRow('Profile', rc.profile);
    if (rc.template) html += summaryRow('Template', rc.template);
    html += summaryRow('Complexity', rc.complexity);
    html += '</div><div class="summary-col">';
    if (rc.turns != null) html += summaryRow('Turns', rc.turns);
    if (rc.tools != null) html += summaryRow('Tools', rc.tools);
    html += summaryRow('Stream', rc.stream ? 'Yes' : 'No');
    if (mi.provider) html += summaryRow('Provider', mi.provider);
    if (mi.maxContextTokens) html += summaryRow('Context', mi.maxContextTokens.toLocaleString());
    html += '</div>';

    dom.summaryBody.innerHTML = html;

    // Warnings
    let warningsHtml = '';
    if (val.warnings && val.warnings.length > 0) {
      warningsHtml += val.warnings
        .map(w => `<div class="warning-item">${escapeHtml(w)}</div>`)
        .join('');
    }
    if (val.predictions && val.predictions.length > 0) {
      warningsHtml += val.predictions
        .map(p => `<div class="prediction-item">${escapeHtml(p)}</div>`)
        .join('');
    }
    dom.summaryWarnings.innerHTML = warningsHtml;
    dom.summaryWarnings.style.display = warningsHtml ? 'block' : 'none';
  }

  function summaryRow(label, value) {
    return `<div class="summary-item"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(String(value ?? '--'))}</span></div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Copy to clipboard ----
  async function copyToClipboard() {
    if (!state.generatedJson) {
      showToast('Nothing to copy', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(state.generatedJson);
      showToast('Copied to clipboard');
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = state.generatedJson;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copied to clipboard');
    }
  }

  // ---- Download JSON ----
  function downloadJson() {
    if (!state.generatedJson) {
      showToast('Nothing to download', 'error');
      return;
    }

    const blob = new Blob([state.generatedJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const model = dom.selModel.value.replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const batchSuffix = state.batchResults.length > 1 ? `_batch${state.batchResults.length}` : '';
    a.download = `${model}${batchSuffix}_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Download started');
  }

  // ---- Reset form ----
  function resetForm() {
    dom.selProfile.value = '';
    dom.selTemplate.value = '';
    dom.selModel.value = 'gpt-4o-2024-05-13';
    dom.inputTurns.value = '';
    dom.inputTools.value = '';
    dom.inputTopic.value = '';
    dom.selLanguage.value = '';
    dom.selDomain.value = '';
    dom.inputPrompt.value = '';
    dom.rangeTemp.value = 0.7;
    dom.tempValue.textContent = '0.7';
    dom.inputMaxTokens.value = '';
    dom.toggleStream.checked = false;
    dom.inputEmbeddingTexts.value = '';
    dom.inputTextCount.value = '';
    dom.inputDimensions.value = '';
    dom.inputScreenshots.value = '';
    dom.inputScreenshotSize.value = '';
    dom.toggleTosca.checked = false;
    dom.toggleToolsOnly.checked = false;
    dom.toggleImagesOnly.checked = false;
    dom.toggleStrict.checked = false;
    dom.toggleHubFormat.checked = false;
    dom.toggleCompact.checked = false;
    dom.inputBatchCount.value = '1';

    state.currentEndpoint = 'chat';
    state.currentComplexity = 'medium';
    state.currentEncoding = 'float';
    state.currentMode = 'custom';
    state.batchResults = [];

    $$('#endpointTabs .tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.endpoint === 'chat');
    });
    $$('#complexityControl .segmented-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.complexity === 'medium');
    });
    $$('#encodingControl .segmented-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.encoding === 'float');
    });
    $$('#modeTabs .mode-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === 'custom');
    });
    $$('.preset-btn').forEach(b => b.classList.remove('active'));

    dom.batchTabs.classList.add('hidden');
    dom.batchTabs.innerHTML = '';

    updateEndpointVisibility();
    updateModelInfo();
    updateSizeEstimate();
  }

  // ---- Toast ----
  function showToast(message, type) {
    const t = dom.toast;
    t.textContent = message;
    t.className = 'toast show' + (type === 'error' ? '' : ' success');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.classList.remove('show');
    }, 2500);
  }

  // ---- Boot ----
  init();
})();
