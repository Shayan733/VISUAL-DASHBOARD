/* ============================================
   Sync — Cloud persistence (Supabase)
   ============================================ */

const Sync = (() => {
  let saveTimeout = null;
  const DEBOUNCE_MS = 500;

  const saveCanvas = async () => {
    if (!State.currentCanvasId || !State.user || !window.SupabaseClient) return;

    try {
      const state = State.toJSON();
      const { error } = await SupabaseClient
        .from('canvases')
        .update({
          state_json: state,
          updated_at: new Date().toISOString()
        })
        .eq('id', State.currentCanvasId)
        .eq('user_id', State.user.id);

      if (error) {
        console.error('Save failed:', error);
      }
    } catch (e) {
      console.error('Save error:', e);
    }
  };

  const debouncedSave = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveCanvas(), DEBOUNCE_MS);
  };

  const loadCanvas = async (canvasId) => {
    if (!State.user || !window.SupabaseClient) return;

    try {
      // Save current canvas first
      if (State.currentCanvasId) await saveCanvas();

      // Load new canvas
      const { data, error } = await SupabaseClient
        .from('canvases')
        .select('*')
        .eq('id', canvasId)
        .eq('user_id', State.user.id)
        .single();

      if (error) {
        showToast('Failed to load canvas', 'error');
        return;
      }

      State.currentCanvasId = canvasId;
      State.loadFromJSON(data.state_json || { nodes: [], connections: [] });
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
      Sidebar.updateActive(canvasId);
    } catch (e) {
      console.error('Load canvas error:', e);
      showToast('Failed to load canvas', 'error');
    }
  };

  const loadMostRecentCanvas = async () => {
    if (!State.user || !window.SupabaseClient) return;

    try {
      const { data, error } = await SupabaseClient
        .from('canvases')
        .select('*')
        .eq('user_id', State.user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        // No canvases yet, create blank
        await createCanvas('Untitled');
        return;
      }

      State.currentCanvasId = data.id;
      State.loadFromJSON(data.state_json || { nodes: [], connections: [] });
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
    } catch (e) {
      console.error('Load most recent error:', e);
      await createCanvas('Untitled');
    }
  };

  const listCanvases = async () => {
    if (!State.user || !window.SupabaseClient) return [];

    try {
      const { data, error } = await SupabaseClient
        .from('canvases')
        .select('id, name, color, updated_at')
        .eq('user_id', State.user.id)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('List canvases error:', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('List canvases error:', e);
      return [];
    }
  };

  const createCanvas = async (name = 'Untitled', type = 'freeform') => {
    if (!State.user || !window.SupabaseClient) return null;

    try {
      const { data, error } = await SupabaseClient
        .from('canvases')
        .insert([{
          user_id: State.user.id,
          name: name,
          type: type,
          state_json: { nodes: [], connections: [] }
        }])
        .select()
        .single();

      if (error) {
        showToast('Failed to create canvas', 'error');
        return null;
      }

      State.currentCanvasId = data.id;
      State.clear();
      State.loadFromJSON(data.state_json || { nodes: [], connections: [] });
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
      Sidebar.refresh();
      return data;
    } catch (e) {
      console.error('Create canvas error:', e);
      showToast('Failed to create canvas', 'error');
      return null;
    }
  };

  const deleteCanvas = async (canvasId) => {
    if (!State.user || !window.SupabaseClient) return;

    try {
      const { error } = await SupabaseClient
        .from('canvases')
        .delete()
        .eq('id', canvasId)
        .eq('user_id', State.user.id);

      if (error) {
        showToast('Failed to delete canvas', 'error');
        return;
      }

      if (State.currentCanvasId === canvasId) {
        await loadMostRecentCanvas();
      }
      Sidebar.refresh();
      showToast('Canvas deleted', 'success');
    } catch (e) {
      console.error('Delete canvas error:', e);
      showToast('Failed to delete canvas', 'error');
    }
  };

  const duplicateCanvas = async (canvasId) => {
    if (!State.user || !window.SupabaseClient) return;

    try {
      const { data: original, error: fetchError } = await SupabaseClient
        .from('canvases')
        .select('*')
        .eq('id', canvasId)
        .eq('user_id', State.user.id)
        .single();

      if (fetchError) {
        showToast('Failed to duplicate canvas', 'error');
        return;
      }

      const { data, error } = await SupabaseClient
        .from('canvases')
        .insert([{
          user_id: State.user.id,
          name: original.name + ' (copy)',
          color: original.color,
          type: original.type,
          state_json: original.state_json
        }])
        .select()
        .single();

      if (error) {
        showToast('Failed to duplicate canvas', 'error');
        return;
      }

      Sidebar.refresh();
      showToast('Canvas duplicated', 'success');
    } catch (e) {
      console.error('Duplicate canvas error:', e);
      showToast('Failed to duplicate canvas', 'error');
    }
  };

  const saveSnapshot = async (name) => {
    if (!State.currentCanvasId || !State.user || !window.SupabaseClient) return;

    try {
      const { error } = await SupabaseClient
        .from('canvas_snapshots')
        .insert([{
          canvas_id: State.currentCanvasId,
          name: name,
          state_json: State.toJSON(),
          created_by: State.user.id
        }]);

      if (error) {
        showToast('Failed to save snapshot', 'error');
        return;
      }

      showToast(`Snapshot "${name}" saved`, 'success');
    } catch (e) {
      console.error('Save snapshot error:', e);
      showToast('Failed to save snapshot', 'error');
    }
  };

  const listSnapshots = async (canvasId) => {
    if (!window.SupabaseClient) return [];

    try {
      const { data, error } = await SupabaseClient
        .from('canvas_snapshots')
        .select('*')
        .eq('canvas_id', canvasId)
        .order('created_at', { ascending: false });

      if (error) return [];
      return data || [];
    } catch (e) {
      console.error('List snapshots error:', e);
      return [];
    }
  };

  const restoreSnapshot = async (snapshotId) => {
    if (!window.SupabaseClient) return;

    try {
      const { data, error } = await SupabaseClient
        .from('canvas_snapshots')
        .select('state_json')
        .eq('id', snapshotId)
        .single();

      if (error) {
        showToast('Failed to restore snapshot', 'error');
        return;
      }

      State.loadFromJSON(data.state_json);
      NodeRenderer.renderAll();
      ConnectionRenderer.renderAll();
      await saveCanvas();
      showToast('Snapshot restored', 'success');
    } catch (e) {
      console.error('Restore snapshot error:', e);
      showToast('Failed to restore snapshot', 'error');
    }
  };

  // Hook state changes to auto-save
  const enableAutoSave = () => {
    // Subscribe to state changes
    State.on((event) => {
      // Auto-save on most events except loaded/cleared
      if (event && !['loaded', 'cleared', 'saved'].includes(event)) {
        debouncedSave();
      }
    });
  };

  return {
    loadCanvas,
    saveCanvas,
    loadMostRecentCanvas,
    listCanvases,
    createCanvas,
    deleteCanvas,
    duplicateCanvas,
    saveSnapshot,
    listSnapshots,
    restoreSnapshot,
    enableAutoSave,
    debouncedSave
  };
})();
