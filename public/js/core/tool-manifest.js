/* ============================================================
   Tool Manifest - Validation for tool registration
   ============================================================ */

window.ToolManifest = (function () {
  'use strict';

  const REQUIRED_FIELDS = ['id', 'name', 'icon', 'category'];

  function validate(config) {
    const errors = [];

    REQUIRED_FIELDS.forEach(field => {
      if (!config[field]) {
        errors.push('Missing required field: ' + field);
      }
    });

    if (config.id && !/^[a-z0-9-]+$/.test(config.id)) {
      errors.push('Tool id must be lowercase alphanumeric with hyphens only: ' + config.id);
    }

    if (config.id && !document.getElementById('tool-' + config.id)) {
      errors.push('No panel element found with id="tool-' + config.id + '". Add a <div id="tool-' + config.id + '" class="tool-panel"> to the HTML.');
    }

    if (errors.length > 0) {
      console.error('ToolManifest validation failed for "' + (config.id || 'unknown') + '":', errors);
      return false;
    }

    return true;
  }

  return { validate };
})();
