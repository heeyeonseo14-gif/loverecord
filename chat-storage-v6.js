/* LOVE RECORD V24 · IndexedDB chat asset migration
   Moves chat avatar/background data URLs out of localStorage without clearing user data. */
(function () {
  'use strict';
  const OLD_KEY = 'love-record-chat-meta-v1';
  const NEW_KEY = 'love-record-chat-meta-v2';
  const IMAGE_FIELDS = ['avatar', 'backgroundImage', 'myAvatar'];
  const urlCache = Object.create(null);
  let readyPromise;

  function rawMeta() {
    try {
      return JSON.parse(localStorage.getItem(NEW_KEY) || localStorage.getItem(OLD_KEY) || '{}') || {};
    } catch (_) { return {}; }
  }
  function isDataImage(value) {
    return typeof value === 'string' && /^data:image\//i.test(value);
  }
  function isAssetRef(value) {
    return typeof value === 'string' && /^lrdb:\d+$/.test(value);
  }
  function blobFromValue(value) {
    return fetch(value).then(r => {
      if (!r.ok) throw new Error('无法读取图片数据');
      return r.blob();
    });
  }
  function loadRecord(id) {
    return new Promise((resolve, reject) => {
      try {
        const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(Number(id));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error || new Error('读取图片失败'));
      } catch (error) { reject(error); }
    });
  }
  async function resolveAsset(contactId, field, ref) {
    if (!isAssetRef(ref)) return ref || '';
    const cacheKey = contactId + ':' + field + ':' + ref;
    if (urlCache[cacheKey]) return urlCache[cacheKey];
    const record = await loadRecord(ref.slice(5));
    if (!record || !record.blob) return '';
    const url = URL.createObjectURL(record.blob);
    urlCache[cacheKey] = url;
    return url;
  }
  async function migrate() {
    await openDB();
    const hasOld = localStorage.getItem(OLD_KEY) !== null;
    const hasNew = localStorage.getItem(NEW_KEY) !== null;
    const meta = rawMeta();
    const migrated = {};
    let movedAnyImage = false;
    for (const contactId of Object.keys(meta)) {
      const item = Object.assign({}, meta[contactId] || {});
      for (const field of IMAGE_FIELDS) {
        const value = item[field];
        if (isDataImage(value)) {
          const blob = await blobFromValue(value);
          const id = await addImage('chat-meta-' + field, blob, contactId);
          item[field] = 'lrdb:' + id;
          movedAnyImage = true;
        }
      }
      migrated[contactId] = item;
    }
    // Do not create a new backup on every page load. Back up only during migration.
    if (!hasNew || hasOld || movedAnyImage) {
      const compactJson = JSON.stringify(migrated);
      if (hasOld || movedAnyImage) {
        await addImage('chat-meta-backup', new Blob([compactJson], {type:'application/json'}), 'chat metadata migration backup');
      }
      // Free the oversized v1 localStorage slot before writing the compact replacement.
      try { localStorage.removeItem(OLD_KEY); } catch (_) {}
      try {
        localStorage.setItem(NEW_KEY, compactJson);
      } catch (error) {
        try { localStorage.setItem(OLD_KEY, compactJson); } catch (_) {}
        throw error;
      }
    }
    const finalMeta = rawMeta();
    for (const contactId of Object.keys(finalMeta)) {
      const item = finalMeta[contactId] || {};
      for (const field of IMAGE_FIELDS) {
        if (isAssetRef(item[field])) await resolveAsset(contactId, field, item[field]);
      }
    }
    return true;
  }

  function readMeta() { return rawMeta(); }
  function writeMeta(contactId, data) {
    const all = readMeta();
    const previous = Object.assign({}, all[contactId] || {});
    const next = Object.assign({}, previous, data || {});
    // Rendering may pass an object URL back while toggling a non-image setting.
    // Keep the durable IndexedDB reference instead of writing that temporary URL.
    for (const field of IMAGE_FIELDS) {
      const value = next[field];
      if (typeof value === 'string' && (/^blob:/.test(value) || isDataImage(value))) {
        const old = previous[field];
        if (isAssetRef(old)) next[field] = old;
      }
    }
    all[contactId] = next;
    localStorage.setItem(NEW_KEY, JSON.stringify(all));
  }
  function readContactMeta(contactId) {
    const raw = readMeta()[contactId] || {};
    const result = Object.assign({}, raw);
    for (const field of IMAGE_FIELDS) {
      const value = raw[field] || '';
      const key = contactId + ':' + field + ':' + value;
      result[field] = isAssetRef(value) ? (urlCache[key] || '') : value;
    }
    return result;
  }

  async function saveSafely(contactId, source) {
    await readyPromise;
    if (!contactId) throw new Error('没有选择联系人');
    const all = readMeta();
    const previous = Object.assign({}, all[contactId] || {});
    const next = Object.assign({}, previous, source || {});
    for (const field of IMAGE_FIELDS) {
      const value = next[field];
      if (!value) {
        delete next[field];
        continue;
      }
      if (isAssetRef(value)) continue;
      const oldRef = previous[field];
      const oldUrl = isAssetRef(oldRef) ? urlCache[contactId + ':' + field + ':' + oldRef] : '';
      if (oldUrl && value === oldUrl) {
        next[field] = oldRef;
        continue;
      }
      const blob = await blobFromValue(value);
      const id = await addImage('chat-meta-' + field, blob, contactId);
      next[field] = 'lrdb:' + id;
      const ref = next[field];
      const record = await loadRecord(id);
      if (record && record.blob) {
        const cacheKey = contactId + ':' + field + ':' + ref;
        if (urlCache[cacheKey]) URL.revokeObjectURL(urlCache[cacheKey]);
        urlCache[cacheKey] = URL.createObjectURL(record.blob);
      }
    }
    all[contactId] = next;
    localStorage.setItem(NEW_KEY, JSON.stringify(all));
    return readContactMeta(contactId);
  }

  window.readChatMeta = readMeta;
  window.writeChatMeta = writeMeta;
  window.chatMeta = readContactMeta;
  window.saveChatMetaSafely = saveSafely;
  readyPromise = migrate().then(() => {
    console.info('[LOVE RECORD] chat assets migrated to IndexedDB');
    return true;
  }).catch(error => {
    console.error('[LOVE RECORD] chat asset migration failed:', error);
    throw error;
  });
  window.__lrChatStorageReady = readyPromise;
})();
