/* LOVE RECORD V24 · IndexedDB-first contact metadata storage
   Keeps contact settings, CSS metadata and image references out of localStorage quota. */
(function(){
 'use strict';
 const META_KEY='love-record-chat-meta-v2',OLD_KEY='love-record-chat-meta-v1';
 const DB_NAME='love-record-chat-files-v1',STORE='attachments',META_STORE='contactMeta';
 let fileDbPromise,metaDbPromise,readyPromise;
 const cache=Object.create(null),urlCache=Object.create(null);
 const isDataImage=v=>typeof v==='string'&&/^data:image\//i.test(v);
 const isRef=v=>typeof v==='string'&&/^lrdb:\d+$/.test(v);
 function openFileDB(){if(fileDbPromise)return fileDbPromise;fileDbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id',autoIncrement:true})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('图片数据库打开失败'))});return fileDbPromise}
 function openMetaDB(){if(metaDbPromise)return metaDbPromise;metaDbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('love-record-chat-meta-db-v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(META_STORE))r.result.createObjectStore(META_STORE,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('联系人资料数据库打开失败'))});return metaDbPromise}
 async function addBlob(blob,name,id){const d=await openFileDB();return new Promise((resolve,reject)=>{const tx=d.transaction(STORE,'readwrite'),r=tx.objectStore(STORE).add({blob,name:name||'chat-image',type:blob.type||'image/*',contactId:id||'',createdAt:Date.now()});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('图片保存失败'))})}
 async function getBlob(id){const d=await openFileDB();return new Promise((resolve,reject)=>{const r=d.transaction(STORE,'readonly').objectStore(STORE).get(Number(id));r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}
 function legacy(){try{return JSON.parse(localStorage.getItem(META_KEY)||localStorage.getItem(OLD_KEY)||'{}')||{}}catch(_){return {}}}
 async function externalize(item,id){const out={...(item||{})};for(const field of ['avatar','backgroundImage','myAvatar']){if(isDataImage(out[field])){const blob=await(await fetch(out[field])).blob();out[field]='lrdb:'+await addBlob(blob,'chat-meta-'+field,id)}}return out}
 async function hydrateImageRefs(id,item){const out={...item};for(const field of ['avatar','backgroundImage','myAvatar']){const ref=out[field];if(isRef(ref)){const key=id+':'+field+':'+ref;let url=urlCache[key];if(!url){const rec=await getBlob(ref.slice(5));if(rec?.blob){url=URL.createObjectURL(rec.blob);urlCache[key]=url}}out[field]=url||''}}return out}
 function readMeta(){return cache}
 function readContactMeta(id){return {...(cache[id]||{})}}
 async function putRecord(id,item){const d=await openMetaDB();return new Promise((resolve,reject)=>{const tx=d.transaction(META_STORE,'readwrite');tx.objectStore(META_STORE).put({id,data:item,updatedAt:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('联系人资料写入失败'));tx.onabort=()=>reject(tx.error||new Error('联系人资料写入中断'))})}
 async function saveSafely(id,source){await readyPromise;if(!id)throw new Error('没有选择联系人');const old=cache[id]||{},next={...old,...(source||{})};for(const field of ['avatar','backgroundImage','myAvatar']){const v=next[field];if(!v){delete next[field];continue}if(isDataImage(v)){const blob=await(await fetch(v)).blob();next[field]='lrdb:'+await addBlob(blob,'chat-meta-'+field,id)}}await putRecord(id,next);cache[id]=next;return await hydrateImageRefs(id,next)}
 function writeMeta(id,data){const next={...(cache[id]||{}),...(data||{})};cache[id]=next;saveSafely(id,next).catch(e=>console.error('[LOVE RECORD] async contact metadata save failed',e));return next}
 // Keep the synchronous legacy API readable immediately while IndexedDB hydrates.
 Object.assign(cache, legacy());
 readyPromise=(async()=>{const md=await openMetaDB();const stored=await new Promise((resolve,reject)=>{const r=md.transaction(META_STORE,'readonly').objectStore(META_STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)});for(const row of stored)cache[row.id]=row.data||{};const old=legacy();for(const id of Object.keys(old)){if(!cache[id]){const clean=await externalize(old[id],id);await putRecord(id,clean);cache[id]=clean}else{const legacyItem=old[id]||{};const merged={...legacyItem,...cache[id]};const clean=await externalize(merged,id);await putRecord(id,clean);cache[id]=clean}}try{localStorage.removeItem(META_KEY);localStorage.removeItem(OLD_KEY)}catch(_){}window.dispatchEvent(new CustomEvent('lr-contact-meta-ready'));return true})().catch(e=>{console.error('[LOVE RECORD] contact metadata migration failed',e);throw e});
 window.readChatMeta=readMeta;window.writeChatMeta=writeMeta;window.chatMeta=readContactMeta;window.saveChatMetaSafely=saveSafely;window.__lrChatStorageReady=readyPromise;
})();
