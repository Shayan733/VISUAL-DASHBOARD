/* ============================================
   FirebaseStorage — File attachment handling
   Uploads/downloads/deletes files for nodes.
   Files live at: users/{uid}/nodes/{nodeId}/{filename}
   ============================================ */

const FileStorage = (() => {
  const MAX_IMAGE_DIMENSION = 1920; // px — resize larger images before upload
  const IMAGE_QUALITY = 0.82;       // JPEG quality (0–1)
  const VIDEO_SIZE_WARN_MB = 50;    // warn user before uploading large videos

  const getStorage = () => firebase.storage();

  /* ── Compression ── */

  /**
   * Compress an image File using an offscreen canvas.
   * Returns a Blob. Skips compression for non-images.
   */
  const compressImage = (file) => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let { width, height } = img;

        // Downscale if larger than max dimension
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => resolve(blob || file),
          'image/jpeg',
          IMAGE_QUALITY
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file); // fallback: upload original
      };

      img.src = objectUrl;
    });
  };

  /* ── Upload ── */

  /**
   * Upload a file attachment for a node.
   *
   * @param {string} userId    - Firebase UID of the owner
   * @param {string} nodeId    - ID of the node this attachment belongs to
   * @param {File}   file      - The file to upload
   * @param {Function} [onProgress] - Called with (percent 0–100) during upload
   * @returns {Promise<{id, name, type, size, storagePath, url, uploadedAt}>}
   */
  const uploadAttachment = async (userId, nodeId, file, onProgress) => {
    if (!userId || !nodeId || !file) throw new Error('userId, nodeId and file are required');

    // Warn for large videos — don't block, just inform
    if (file.type.startsWith('video/') && file.size > VIDEO_SIZE_WARN_MB * 1024 * 1024) {
      if (window.showToast) {
        showToast(`Large video (${(file.size / 1024 / 1024).toFixed(0)} MB) — upload may take a while`, 'info');
      }
    }

    // Compress images before upload
    const uploadable = await compressImage(file);

    const storagePath = `users/${userId}/nodes/${nodeId}/${file.name}`;
    const storageRef = getStorage().ref(storagePath);

    return new Promise((resolve, reject) => {
      const uploadTask = storageRef.put(uploadable, { contentType: file.type });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(percent);
        },
        (error) => {
          console.error('Upload error:', error);
          reject(error);
        },
        async () => {
          try {
            const url = await uploadTask.snapshot.ref.getDownloadURL();
            resolve({
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name,
              type: file.type,
              size: uploadable.size || file.size,
              storagePath,
              url,
              uploadedAt: new Date().toISOString(),
            });
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  };

  /* ── Delete ── */

  /**
   * Delete a single attachment from storage.
   * @param {string} storagePath - e.g. "users/uid/nodes/node-xxx/photo.jpg"
   */
  const deleteAttachment = async (storagePath) => {
    if (!storagePath) return;
    try {
      await getStorage().ref(storagePath).delete();
    } catch (err) {
      // File may already be gone — not a fatal error
      if (err.code !== 'storage/object-not-found') {
        console.error('Delete attachment error:', err);
      }
    }
  };

  /**
   * Delete ALL attachments for a node (call when deleting a node).
   * @param {string} userId
   * @param {string} nodeId
   * @param {Array}  attachments - the node's attachments array from state
   */
  const deleteNodeAttachments = async (userId, nodeId, attachments = []) => {
    if (!attachments.length) return;
    await Promise.all(attachments.map(att => deleteAttachment(att.storagePath)));
  };

  /* ── Refresh URL ── */

  /**
   * Get a fresh download URL for an attachment (URLs don't expire but
   * this is useful if a URL ever becomes stale).
   * @param {string} storagePath
   * @returns {Promise<string>}
   */
  const getDownloadUrl = async (storagePath) => {
    return getStorage().ref(storagePath).getDownloadURL();
  };

  return {
    uploadAttachment,
    deleteAttachment,
    deleteNodeAttachments,
    getDownloadUrl,
  };
})();
