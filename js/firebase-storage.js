/* ============================================
   FirebaseStorage — File attachment handling
   Bible Phase 3 path convention:
   attachments/{userId}/{entityType}/{entityId}/{filename}
   ============================================ */

const FileStorage = (() => {
  const MAX_IMAGE_DIMENSION = 1920;
  const IMAGE_QUALITY = 0.82;
  const MAX_FILE_SIZE = 52428800; // 50MB in bytes

  const getStorage = () => firebase.storage();

  /* ── File type detection (by MIME) ── */

  const getTypeFromMime = (mimeType) => {
    if (!mimeType) return 'file';
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (
      mimeType === 'application/pdf' ||
      mimeType.startsWith('text/') ||
      mimeType.includes('word') ||
      mimeType.includes('document') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('presentation') ||
      mimeType.includes('powerpoint') ||
      mimeType.includes('excel')
    ) return 'document';
    return 'file';
  };

  /* ── Image compression ── */

  const compressImage = (file) => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) { resolve(file); return; }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let { width, height } = img;

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

      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });
  };

  /* ── Upload ── */

  /**
   * Upload a file attachment.
   * @param {string} userId
   * @param {string} entityType  — 'node' | 'group'
   * @param {string} entityId    — node or group ID
   * @param {File}   file
   * @param {Function} [onProgress] — called with percent 0-100
   * @returns {Promise<attachment object>}
   */
  const uploadAttachment = async (userId, entityType, entityId, file, onProgress) => {
    if (!userId || !entityType || !entityId || !file) {
      throw new Error('userId, entityType, entityId and file are required');
    }

    // 50MB limit — enforce before any async work
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }

    const attachmentType = getTypeFromMime(file.type);

    // Video warning (non-blocking)
    if (attachmentType === 'video' && file.size > 20 * 1024 * 1024) {
      if (window.showToast) showToast(`Large video (${(file.size / 1024 / 1024).toFixed(0)} MB) — upload may take a while`, 'info');
    }

    const uploadable = await compressImage(file);
    const storagePath = `attachments/${userId}/${entityType}/${entityId}/${file.name}`;
    const storageRef = getStorage().ref(storagePath);

    return new Promise((resolve, reject) => {
      const uploadTask = storageRef.put(uploadable, { contentType: file.type });

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (onProgress) onProgress(percent);
        },
        (error) => { console.error('Upload error:', error); reject(error); },
        async () => {
          try {
            const url = await uploadTask.snapshot.ref.getDownloadURL();
            resolve({
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: file.name,
              attachmentType,
              mimeType: file.type,
              size: uploadable.size || file.size,
              storagePath,
              url,
              ogTitle: null,
              ogImage: null,
              uploadedAt: new Date().toISOString(),
            });
          } catch (err) { reject(err); }
        }
      );
    });
  };

  /* ── Delete ── */

  const deleteAttachment = async (storagePath) => {
    if (!storagePath) return;
    try {
      await getStorage().ref(storagePath).delete();
    } catch (err) {
      if (err.code !== 'storage/object-not-found') {
        console.error('Delete attachment error:', err);
      }
    }
  };

  const deleteEntityAttachments = async (attachments = []) => {
    if (!attachments.length) return;
    await Promise.all(attachments.map(att => deleteAttachment(att.storagePath)));
  };

  /* ── Refresh URL ── */

  const getDownloadUrl = async (storagePath) => {
    return getStorage().ref(storagePath).getDownloadURL();
  };

  return {
    uploadAttachment,
    deleteAttachment,
    deleteEntityAttachments,
    getTypeFromMime,
    MAX_FILE_SIZE,
  };
})();
