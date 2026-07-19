// settings.js - Manages Palladium Mac Settings

document.addEventListener('DOMContentLoaded', () => {
  initSettings();
});

async function initSettings() {
  await loadSettings();
  bindSettingsEvents();
}

// ===========================
// Load & Render Settings
// ===========================
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const settings = await res.json();
    applySettingsToUI(settings);
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

function applySettingsToUI(s) {
  // Download Destination
  setVal('download-dir-input', s.downloadDir || '');
  updateSidebarTarget(s.downloadDir || '');

  // Download Quality
  setSelect('video-quality-select', s.videoQuality || 'best');
  setSelect('video-container-select', s.videoContainer || 'mp4');
  setSelect('video-codec-select', s.videoCodec || 'photosCompatible');
  setSelect('audio-format-select', s.audioFormat || 'mp3');
  setSelect('audio-preset-select', s.audioPreset || 'bestCompatible');

  // Download Options (Defaults)
  setToggle('default-playlist', s.defaultDownloadPlaylist ?? false);
  setToggle('default-subtitles', s.defaultDownloadSubtitles ?? false);
  setToggle('default-embed-thumbnail', s.defaultEmbedThumbnail ?? false);
  setToggle('restore-download-defaults', s.restoreDownloadDefaults ?? false);

  // Download Behavior
  setToggle('auto-retry-toggle', s.autoRetryFailedDownloads ?? true);
  setToggle('detailed-progress-toggle', s.detailedProgressEnabled ?? false);

  // After Download
  setSelect('after-download-select', s.afterDownloadBehavior || 'doNothing');

  // History
  setToggle('link-history-enabled', s.linkHistoryEnabled ?? true);
  setToggle('hide-history-count', s.hideHistoryCount ?? false);
  setVal('history-limit-input', s.linkHistoryLimit ?? 10);

  // Notifications
  setToggle('notifications-enabled', s.notificationsEnabled ?? true);


  // Custom Args
  setVal('extra-args-input', s.extraArgs || '');
}

function updateSidebarTarget(path) {
  const el = document.getElementById('sidebar-target-path');
  if (el) el.textContent = (path || '~/Downloads').replace(/^\/Users\/[^/]+/, '~');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

// Select helpers
function setSelect(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setToggle(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
}

// ===========================
// Save Settings
// ===========================
async function saveSettings() {
  const settings = gatherSettings();
  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (res.ok) {
      updateSidebarTarget(settings.downloadDir);
      showSettingsToast('Settings saved!', 'success');
    } else {
      const err = await res.json();
      showSettingsToast(err.error || 'Failed to save.', 'error');
    }
  } catch (e) {
    showSettingsToast('Failed to save settings.', 'error');
  }
}

function gatherSettings() {
  return {
    downloadDir: getVal('download-dir-input'),
    videoQuality: getSelect('video-quality-select'),
    videoContainer: getSelect('video-container-select'),
    videoCodec: getSelect('video-codec-select'),
    audioFormat: getSelect('audio-format-select'),
    audioPreset: getSelect('audio-preset-select'),
    defaultDownloadPlaylist: getToggle('default-playlist'),
    defaultDownloadSubtitles: getToggle('default-subtitles'),
    defaultEmbedThumbnail: getToggle('default-embed-thumbnail'),
    restoreDownloadDefaults: getToggle('restore-download-defaults'),
    autoRetryFailedDownloads: getToggle('auto-retry-toggle'),
    detailedProgressEnabled: getToggle('detailed-progress-toggle'),
    afterDownloadBehavior: getSelect('after-download-select'),
    linkHistoryEnabled: getToggle('link-history-enabled'),
    hideHistoryCount: getToggle('hide-history-count'),
    linkHistoryLimit: parseInt(getVal('history-limit-input')) || 10,
    enableUrlAllowlist: true,
    notificationsEnabled: getToggle('notifications-enabled'),
    extraArgs: getVal('extra-args-input'),

  };
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function getSelect(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}
function getToggle(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

// ===========================
// Browse Folder
// ===========================
async function browseFolder() {
  const btn = document.getElementById('browse-btn');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/settings/browse', { method: 'POST' });
    if (res.ok) {
      const s = await res.json();
      setVal('download-dir-input', s.downloadDir);
      updateSidebarTarget(s.downloadDir);
      showSettingsToast('Download folder updated!', 'success');
    } else {
      const err = await res.json();
      showSettingsToast(err.error || 'Folder selection failed.', 'error');
    }
  } catch (e) {
    showSettingsToast('Failed to open folder picker.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ===========================
// Clear yt-dlp Cache
// ===========================
async function clearYtdlpCache() {
  try {
    const res = await fetch('/api/storage/clear-cache', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showSettingsToast(`Cleared cached files.`, 'success');
    } else {
      showSettingsToast(data.error || 'Failed to clear cache.', 'error');
    }
  } catch (e) {
    showSettingsToast('Failed to clear yt-dlp cache.', 'error');
  }
}

// ===========================
// Clear Link History
// ===========================
async function clearLinkHistory() {
  if (!confirm('Are you sure you want to clear all download history?')) return;
  try {
    const res = await fetch('/api/history', { method: 'DELETE' });
    if (res.ok) showSettingsToast('History cleared.', 'success');
    else showSettingsToast('Failed to clear history.', 'error');
  } catch (e) {
    showSettingsToast('Failed to clear history.', 'error');
  }
}

// ===========================
// URL Allowlists Management
// ===========================
async function loadAllowlists() {
  try {
    const res = await fetch('/api/allowlists');
    if (!res.ok) return;
    const lists = await res.json();
    renderAllowlists(lists);
  } catch (e) {
    console.error('Failed to load allowlists:', e);
  }
}

function renderAllowlists(lists) {
  const container = document.getElementById('allowlist-sources-list');
  if (!container) return;
  container.innerHTML = '';

  lists.forEach(list => {
    const item = document.createElement('div');
    item.className = 'source-item';
    
    // Build entries rows if loaded
    let entriesHTML = '';
    if (list.entries && list.entries.length > 0) {
      entriesHTML = `<div class="settings-divider" style="margin: 8px 0;"></div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${list.entries.map(e => `
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
            <span style="color:var(--text-main); font-weight:500;">${e.name}</span>
            <span style="font-family:monospace; color:var(--text-dim); margin-left:8px; font-size:11px;">${e.pattern}</span>
            <label class="toggle-switch" style="transform: scale(0.7); margin-right:-8px;">
              <input type="checkbox" class="entry-toggle" data-list-id="${list.id}" data-pattern="${e.pattern}" ${e.enabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        `).join('')}
      </div>`;
    }

    item.innerHTML = `
      <div class="source-header">
        <div class="source-header-left">
          <div class="source-title">${list.name}</div>
          <div class="source-url">${list.urlString || 'Local pasted JSON'}</div>
        </div>
        <div class="source-actions">
          ${!list.isDefault ? `
            <button class="danger-btn delete-allowlist-btn" data-id="${list.id}" style="padding: 4px 8px; font-size: 11px;">
              Delete
            </button>
          ` : '<span style="font-size:11px; color:var(--text-dim);">🛡️ default</span>'}
        </div>
      </div>
      <div class="source-details">
        <span>${list.statusMessage || 'No status'}</span>
        <span>Refreshed: ${list.lastRefreshDate ? new Date(list.lastRefreshDate).toLocaleTimeString() : 'never'}</span>
      </div>
      ${entriesHTML}
    `;
    container.appendChild(item);
  });

  // Bind inline toggles
  container.querySelectorAll('.entry-toggle').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const listId = e.target.getAttribute('data-list-id');
      const pattern = e.target.getAttribute('data-pattern');
      const enabled = e.target.checked;
      await fetch('/api/allowlists/toggle-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId, pattern, enabled })
      });
    });
  });

  // Bind inline delete
  container.querySelectorAll('.delete-allowlist-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      if (confirm('Delete this allowlist source?')) {
        const res = await fetch(`/api/allowlists/${id}`, { method: 'DELETE' });
        if (res.ok) {
          showSettingsToast('Allowlist removed.', 'success');
          loadAllowlists();
        }
      }
    });
  });
}

async function addAllowlistSource() {
  const input = document.getElementById('allowlist-url-input');
  const url = input.value.trim();
  if (!url) return;

  try {
    const res = await fetch('/api/allowlists/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urlString: url })
    });
    if (res.ok) {
      showSettingsToast('Source added! Refresh to load entries.', 'success');
      input.value = '';
      document.getElementById('add-allowlist-row').classList.add('hidden');
      loadAllowlists();
    } else {
      const err = await res.json();
      showSettingsToast(err.error || 'Failed to add allowlist source.', 'error');
    }
  } catch (e) {
    showSettingsToast('Failed to add source.', 'error');
  }
}

async function pasteAllowlistJSON() {
  const textarea = document.getElementById('allowlist-json-textarea');
  const jsonStr = textarea.value.trim();
  if (!jsonStr) return;

  try {
    const res = await fetch('/api/allowlists/paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: jsonStr })
    });
    if (res.ok) {
      showSettingsToast('Allowlist JSON imported!', 'success');
      textarea.value = '';
      document.getElementById('paste-allowlist-row').classList.add('hidden');
      loadAllowlists();
    } else {
      const err = await res.json();
      showSettingsToast(err.error || 'Failed to import JSON.', 'error');
    }
  } catch (e) {
    showSettingsToast('Failed to import JSON.', 'error');
  }
}

async function importLocalAllowlist(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    try {
      JSON.parse(content);
      const res = await fetch('/api/allowlists/paste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: content,
          name: file.name
        })
      });
      if (res.ok) {
        showSettingsToast(`Imported ${file.name} successfully!`, 'success');
        loadAllowlists();
      } else {
        const err = await res.json();
        showSettingsToast(err.error || 'Failed to import JSON.', 'error');
      }
    } catch (err) {
      showSettingsToast('Invalid JSON file.', 'error');
    }
  };
  reader.readAsText(file);
}

async function refreshAllowlists() {
  const btn = document.getElementById('modal-refresh-allowlists-btn');
  btn.disabled = true;
  showSettingsToast('Refreshing allowlists...', 'success');
  try {
    const res = await fetch('/api/allowlists/refresh', { method: 'POST' });
    if (res.ok) {
      showSettingsToast('Allowlists refreshed!', 'success');
      loadAllowlists();
    } else {
      showSettingsToast('Failed to refresh allowlists.', 'error');
    }
  } catch (e) {
    showSettingsToast('Failed to refresh.', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ===========================
// Package Manager Management
// ===========================
async function loadPackageManagerStatus() {
  const box = document.getElementById('pm-versions-box');
  if (box) box.textContent = 'Loading installed versions...';
  
  try {
    const res = await fetch('/api/packages/status');
    if (!res.ok) return;
    const data = await res.json();
    
    // Format versions cleanly
    let versionsStr = '';
    for (const [name, ver] of Object.entries(data.versions)) {
      versionsStr += `${name}: ${ver}\n`;
    }
    if (box) box.textContent = versionsStr.trim();
    
    const summary = document.getElementById('pm-summary-box');
    if (summary) summary.textContent = data.updateSummary || 'All packages are up to date.';
  } catch (e) {
    if (box) box.textContent = 'Failed to load package versions.';
  }
}

async function checkPackageUpdates() {
  const btn = document.getElementById('pm-check-btn');
  btn.disabled = true;
  const summary = document.getElementById('pm-summary-box');
  if (summary) summary.textContent = 'Checking for updates...';
  
  try {
    const res = await fetch('/api/packages/check', { method: 'POST' });
    const data = await res.json();
    if (summary) summary.textContent = data.summary || 'All packages are up to date.';
  } catch (e) {
    if (summary) summary.textContent = 'Failed to check updates.';
  } finally {
    btn.disabled = false;
  }
}

async function updatePackages() {
  const btn = document.getElementById('pm-update-btn');
  btn.disabled = true;
  showSettingsToast('Updating packages...', 'success');
  try {
    const res = await fetch('/api/packages/update', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showSettingsToast(data.message || 'Packages updated successfully.', 'success');
      loadPackageManagerStatus();
    } else {
      showSettingsToast(data.message || 'Failed to update.', 'error');
    }
  } catch (e) {
    showSettingsToast('Failed to update packages.', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function restorePackages() {
  if (!confirm('Reinstall yt-dlp with pip? This will restore dependencies.')) return;
  const btn = document.getElementById('pm-restore-btn');
  btn.disabled = true;
  showSettingsToast('Restoring/reinstalling packages...', 'success');
  try {
    const res = await fetch('/api/packages/restore', { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      showSettingsToast(data.message || 'Packages restored successfully.', 'success');
      loadPackageManagerStatus();
    } else {
      showSettingsToast(data.message || 'Failed to restore.', 'error');
    }
  } catch (e) {
    showSettingsToast('Failed to restore packages.', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ===========================
// Toast Message
// ===========================
function showSettingsToast(msg, type) {
  let toast = document.getElementById('settings-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'settings-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'settings-toast show ' + (type || '');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===========================
// Bind Events
// ===========================
function bindSettingsEvents() {
  const browseBtn = document.getElementById('browse-btn');
  if (browseBtn) browseBtn.addEventListener('click', browseFolder);

  const saveBtn = document.getElementById('save-settings-btn');
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);

  const clearCacheBtn = document.getElementById('clear-cache-btn');
  if (clearCacheBtn) clearCacheBtn.addEventListener('click', clearYtdlpCache);

  const clearHistoryBtn = document.getElementById('clear-history-btn');
  if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', clearLinkHistory);

  // Modal URL Allowlists
  const openAllowlistBtn = document.getElementById('open-allowlist-btn');
  const allowlistModal = document.getElementById('allowlist-modal');
  const closeAllowlistModal = document.getElementById('close-allowlist-modal');
  
  if (openAllowlistBtn && allowlistModal) {
    openAllowlistBtn.addEventListener('click', () => {
      allowlistModal.classList.remove('hidden');
      loadAllowlists();
    });
  }
  if (closeAllowlistModal && allowlistModal) {
    closeAllowlistModal.addEventListener('click', () => {
      allowlistModal.classList.add('hidden');
    });
  }

  // Allowlist modal operations
  const modalAddBtn = document.getElementById('modal-add-allowlist-btn');
  const addRow = document.getElementById('add-allowlist-row');
  if (modalAddBtn && addRow) {
    modalAddBtn.addEventListener('click', () => {
      addRow.classList.toggle('hidden');
      document.getElementById('paste-allowlist-row').classList.add('hidden');
    });
  }

  const confirmAddBtn = document.getElementById('confirm-add-allowlist');
  if (confirmAddBtn) confirmAddBtn.addEventListener('click', addAllowlistSource);

  const modalPasteBtn = document.getElementById('modal-paste-allowlist-btn');
  const pasteRow = document.getElementById('paste-allowlist-row');
  if (modalPasteBtn && pasteRow) {
    modalPasteBtn.addEventListener('click', () => {
      pasteRow.classList.toggle('hidden');
      document.getElementById('add-allowlist-row').classList.add('hidden');
    });
  }

  const confirmPasteBtn = document.getElementById('confirm-paste-allowlist');
  if (confirmPasteBtn) confirmPasteBtn.addEventListener('click', pasteAllowlistJSON);

  // Local File Import bindings
  const modalImportBtn = document.getElementById('modal-import-allowlist-btn');
  const fileInput = document.getElementById('allowlist-file-input');
  if (modalImportBtn && fileInput) {
    modalImportBtn.addEventListener('click', () => {
      fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        importLocalAllowlist(e.target.files[0]);
        e.target.value = ''; // clear input
      }
    });
  }

  const modalRefreshBtn = document.getElementById('modal-refresh-allowlists-btn');
  if (modalRefreshBtn) modalRefreshBtn.addEventListener('click', refreshAllowlists);

  // Modal Package Manager
  const openPMBtn = document.getElementById('open-package-manager-btn');
  const pmModal = document.getElementById('package-manager-modal');
  const closePMModal = document.getElementById('close-package-manager-modal');

  if (openPMBtn && pmModal) {
    openPMBtn.addEventListener('click', () => {
      pmModal.classList.remove('hidden');
      loadPackageManagerStatus();
    });
  }
  if (closePMModal && pmModal) {
    closePMModal.addEventListener('click', () => {
      pmModal.classList.add('hidden');
    });
  }

  // PM actions
  const pmCheckBtn = document.getElementById('pm-check-btn');
  if (pmCheckBtn) pmCheckBtn.addEventListener('click', checkPackageUpdates);

  const pmUpdateBtn = document.getElementById('pm-update-btn');
  if (pmUpdateBtn) pmUpdateBtn.addEventListener('click', updatePackages);

  const pmRestoreBtn = document.getElementById('pm-restore-btn');
  if (pmRestoreBtn) pmRestoreBtn.addEventListener('click', restorePackages);

  // Reload settings when switching to Settings tab
  document.querySelectorAll('.nav-item[data-tab="settings"]').forEach(btn => {
    btn.addEventListener('click', loadSettings);
  });
}
