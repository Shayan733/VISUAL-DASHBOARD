/* ============================================
   Attachments — Phase 3
   Handles upload, link, delete, and rendering
   of attachments on nodes and groups.
   ============================================ */

const Attachments = (() => {

  /* ── Icons ── */

  const ICONS = {
    image:    '🖼',
    video:    '🎬',
    audio:    '🎵',
    document: '📄',
    link:     '🔗',
    file:     '📎',
  };

  const PAPERCLIP_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13.5 7.5L7 14a4 4 0 01-5.66-5.66l6.5-6.5a2.5 2.5 0 013.54 3.54L5 11.84a1 1 0 01-1.41-1.41L9.5 4.5"/>
  </svg>`;

  const UPLOAD_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 10V3M5 6l3-3 3 3M3 13h10"/>
  </svg>`;

  const DELETE_SVG = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/>
  </svg>`;

  /* ── Helpers ── */

  const formatBytes = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const getNodeAttachments = (nodeId) => {
    const node = State.getNodeById(nodeId);
    return node ? (node.attachments || []) : [];
  };

  /* ── OG metadata fetch ── */

  const fetchOG = async (url) => {
    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
        || doc.querySelector('title')?.textContent
        || new URL(url).hostname;

      const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || null;

      return { ogTitle: ogTitle.trim(), ogImage };
    } catch {
      try {
        return { ogTitle: new URL(url).hostname, ogImage: null };
      } catch {
        return { ogTitle: url, ogImage: null };
      }
    }
  };

  /* ── Upload ── */

  const upload = async (nodeId, file, entityType = 'node') => {
    if (!State.user) return;

    // 50MB check first
    if (file.size > FileStorage.MAX_FILE_SIZE) {
      showToast('File exceeds 50MB limit', 'error');
      return;
    }

    const progressId = `progress-${Date.now()}`;
    _showProgress(progressId, file.name, 0);

    try {
      const att = await FileStorage.uploadAttachment(
        State.user.id,
        entityType,
        nodeId,
        file,
        (percent) => _updateProgress(progressId, percent)
      );

      _removeProgress(progressId);

      const existing = getNodeAttachments(nodeId);
      State.updateNode(nodeId, { attachments: [...existing, att] });
      NodeRenderer.renderNode(State.getNodeById(nodeId));
      refreshPanel(nodeId);
      Sync.debouncedSave();
      showToast(`"${file.name}" attached`, 'success');
    } catch (err) {
      _removeProgress(progressId);
      if (err.message === 'FILE_TOO_LARGE') {
        showToast('File exceeds 50MB limit', 'error');
      } else {
        console.error('Upload failed:', err);
        showToast('Upload failed — please try again', 'error');
      }
    }
  };

  /* ── Add link ── */

  const addLink = async (nodeId, url) => {
    if (!url) return;

    // Basic URL validation
    try { new URL(url); } catch {
      showToast('Enter a valid URL (include https://)', 'error');
      return;
    }

    const addBtn = document.getElementById('att-link-add-btn');
    if (addBtn) { addBtn.disabled = true; addBtn.textContent = '…'; }

    try {
      const { ogTitle, ogImage } = await fetchOG(url);

      const att = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: ogTitle,
        attachmentType: 'link',
        mimeType: null,
        size: null,
        storagePath: null,
        url,
        ogTitle,
        ogImage,
        uploadedAt: new Date().toISOString(),
      };

      const existing = getNodeAttachments(nodeId);
      State.updateNode(nodeId, { attachments: [...existing, att] });
      NodeRenderer.renderNode(State.getNodeById(nodeId));
      refreshPanel(nodeId);
      Sync.debouncedSave();

      // Clear the input
      const input = document.getElementById('att-link-input');
      if (input) input.value = '';
    } catch (err) {
      console.error('Add link error:', err);
      showToast('Could not add link', 'error');
    } finally {
      if (addBtn) { addBtn.disabled = false; addBtn.textContent = 'Add'; }
    }
  };

  /* ── Delete ── */

  const deleteAttachment = async (nodeId, attId) => {
    const existing = getNodeAttachments(nodeId);
    const att = existing.find(a => a.id === attId);
    if (!att) return;

    // Remove from state immediately (optimistic)
    State.updateNode(nodeId, { attachments: existing.filter(a => a.id !== attId) });
    NodeRenderer.renderNode(State.getNodeById(nodeId));
    refreshPanel(nodeId);
    Sync.debouncedSave();

    // Delete from storage (fire and forget — UI already updated)
    if (att.storagePath) {
      FileStorage.deleteAttachment(att.storagePath).catch(console.error);
    }
  };

  /* ── Handle file drop onto node ── */

  const handleNodeDrop = (nodeId, files) => {
    Array.from(files).forEach(file => upload(nodeId, file));
  };

  /* ── Progress UI (inside attachment panel) ── */

  const _showProgress = (id, name, percent) => {
    const list = document.getElementById('attachment-list');
    if (!list) return;
    const el = document.createElement('div');
    el.className = 'attachment-progress-wrap';
    el.id = id;
    el.innerHTML = `
      <div class="attachment-progress-label">${escapeHtml(name)}</div>
      <div class="attachment-progress-bar-track">
        <div class="attachment-progress-bar-fill" style="width:${percent}%"></div>
      </div>`;
    list.prepend(el);
  };

  const _updateProgress = (id, percent) => {
    const fill = document.querySelector(`#${id} .attachment-progress-bar-fill`);
    if (fill) fill.style.width = percent + '%';
  };

  const _removeProgress = (id) => {
    document.getElementById(id)?.remove();
  };

  /* ── Render attachment list (inside properties panel) ── */

  const renderPanel = (nodeId) => {
    const list = document.getElementById('attachment-list');
    if (!list) return;

    const attachments = getNodeAttachments(nodeId);
    list.innerHTML = '';

    if (attachments.length === 0) {
      list.innerHTML = `<div class="attachment-empty">No attachments yet</div>`;
      return;
    }

    attachments.forEach(att => {
      const item = document.createElement('div');
      item.className = 'attachment-item';

      let previewHTML;
      if (att.attachmentType === 'image') {
        previewHTML = `<img class="attachment-item-thumb" src="${att.url}" alt="${escapeHtml(att.name)}" loading="lazy">`;
      } else if (att.attachmentType === 'link' && att.ogImage) {
        previewHTML = `<img class="attachment-item-og-image" src="${att.ogImage}" alt="" loading="lazy" onerror="this.parentNode.innerHTML='<div class=\\'attachment-item-icon\\'>${ICONS.link}</div>'">`;
      } else {
        previewHTML = `<div class="attachment-item-icon">${ICONS[att.attachmentType] || ICONS.file}</div>`;
      }

      const meta = att.attachmentType === 'link'
        ? (att.url ? new URL(att.url).hostname : '')
        : formatBytes(att.size);

      item.innerHTML = `
        ${previewHTML}
        <div class="attachment-item-info">
          <div class="attachment-item-name">${escapeHtml(att.name)}</div>
          <div class="attachment-item-meta">${meta}</div>
        </div>
        <button class="attachment-item-delete" data-att-id="${att.id}" title="Remove attachment">
          ${DELETE_SVG}
        </button>`;

      // Open/download on click (not on delete btn)
      item.addEventListener('click', (e) => {
        if (e.target.closest('.attachment-item-delete')) return;
        window.open(att.url, '_blank', 'noopener');
      });

      // Delete
      item.querySelector('.attachment-item-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteAttachment(nodeId, att.id);
      });

      list.appendChild(item);
    });
  };

  /* ── Refresh panel if currently open for this node ── */

  const refreshPanel = (nodeId) => {
    const panel = document.getElementById('properties-panel');
    if (!panel || !panel.classList.contains('visible')) return;
    // Only refresh if the panel is showing this node
    const panelNodeId = panel.dataset.nodeId;
    if (panelNodeId !== nodeId) return;
    renderPanel(nodeId);
  };

  /* ── Build the full attachment section HTML ── */

  const buildSectionHTML = () => `
    <div class="props-attachments-section">
      <div class="props-attachments-header">
        <label>Attachments</label>
        <button class="attachment-add-btn" id="att-upload-trigger">
          ${UPLOAD_SVG} Upload
        </button>
      </div>
      <div class="attachment-list" id="attachment-list"></div>
      <div class="attachment-link-row">
        <input
          class="attachment-link-input"
          id="att-link-input"
          type="url"
          placeholder="Paste a link…"
          autocomplete="off"
        />
        <button class="attachment-link-add-btn" id="att-link-add-btn">Add</button>
      </div>
      <input type="file" id="att-file-input" multiple style="display:none" />
    </div>`;

  /* ── Bind events after panel HTML is injected ── */

  const bindPanelEvents = (nodeId) => {
    // File picker trigger
    const uploadTrigger = document.getElementById('att-upload-trigger');
    const fileInput = document.getElementById('att-file-input');

    if (uploadTrigger && fileInput) {
      uploadTrigger.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        Array.from(fileInput.files).forEach(f => upload(nodeId, f));
        fileInput.value = '';
      });
    }

    // Link add
    const linkInput = document.getElementById('att-link-input');
    const linkAddBtn = document.getElementById('att-link-add-btn');

    if (linkAddBtn && linkInput) {
      linkAddBtn.addEventListener('click', () => addLink(nodeId, linkInput.value.trim()));
      linkInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addLink(nodeId, linkInput.value.trim());
      });
    }
  };

  return {
    upload,
    addLink,
    deleteAttachment,
    handleNodeDrop,
    renderPanel,
    refreshPanel,
    buildSectionHTML,
    bindPanelEvents,
    PAPERCLIP_SVG,
  };
})();
