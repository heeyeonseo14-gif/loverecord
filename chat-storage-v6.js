/* LOVE RECORD V24 · reliable chat storage
   Uses the same IndexedDB database as chat-interaction-v11.js for image blobs.
   Keeps compact metadata in localStorage and moves large image data out of quota-limited storage. */
(function(){
 'use strict';
 const META_KEY='love-record-chat-meta-v2', OLD_KEY='love-record-chat-meta-v1';
 const DB_NAME='love-record-chat-files-v1', STORE='attachments';
 let dbPromise, readyPromise;
 const urlCache=Object.create(null);
 function openDB(){
  if(dbPromise)return dbPromise;
  dbPromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open(DB_NAME,1);
   req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id',autoIncrement:true});};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('聊天图片数据库打开失败'));
  });return dbPromise;
 }
 async function addBlob(blob,name,contactId){
  const d=await openDB();return new Promise((resolve,reject)=>{
   const tx=d.transaction(STORE,'readwrite'),r=tx.objectStore(STORE).add({blob,name:name||'chat-image',type:blob.type||'image/*',contactId:contactId||'',createdAt:Date.now()});
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||new Error('图片保存失败'));
  });
 }
 async function getBlob(id){
  const d=await openDB();return new Promise((resolve,reject)=>{
   const r=d.transaction(STORE,'readonly').objectStore(STORE).get(Number(id));
   r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);
  });
 }
 function rawMeta(){try{return JSON.parse(localStorage.getItem(META_KEY)||localStorage.getItem(OLD_KEY)||'{}')||{}}catch(_){return {}}}
 function isDataImage(v){return typeof v==='string'&&/^data:image\//i.test(v)}
 function isRef(v){return typeof v==='string'&&/^lrdb:\d+$/.test(v)}
 async function migrate(){
  await openDB();const all=rawMeta(),compact={};let changed=false;
  for(const id of Object.keys(all)){
   const item={...(all[id]||{})};
   for(const field of ['avatar','backgroundImage','myAvatar']){
    if(isDataImage(item[field])){
     try{const blob=await (await fetch(item[field])).blob();item[field]='lrdb:'+await addBlob(blob,'chat-meta-'+field,id);changed=true;}
     catch(e){console.warn('[LOVE RECORD] image migration skipped',field,e);}
    }
   }
   compact[id]=item;
  }
  if(changed||localStorage.getItem(META_KEY)===null){
   try{localStorage.setItem(META_KEY,JSON.stringify(compact));}
   catch(e){throw new Error('聊天资料储存空间不足；图片迁移未能完成：'+e.message);}
  }
  try{localStorage.removeItem(OLD_KEY);}catch(_){}
  for(const id of Object.keys(compact))for(const field of ['avatar','backgroundImage','myAvatar']){
   const ref=compact[id][field];if(isRef(ref)){const rec=await getBlob(ref.slice(5));if(rec?.blob){const key=id+':'+field+':'+ref;if(!urlCache[key])urlCache[key]=URL.createObjectURL(rec.blob);}}
  }
 }
 function readMeta(){return rawMeta()}
 function readContactMeta(id){
  const raw=readMeta()[id]||{},out={...raw};
  for(const field of ['avatar','backgroundImage','myAvatar']){const v=raw[field]||'';out[field]=isRef(v)?(urlCache[id+':'+field+':'+v]||''):v;}
  return out;
 }
 async function saveSafely(id,source){
  await readyPromise;if(!id)throw new Error('没有选择联系人');
  const all=readMeta(),old={...(all[id]||{})},next={...old,...(source||{})};
  for(const field of ['avatar','backgroundImage','myAvatar']){
   const v=next[field];if(!v){delete next[field];continue;}if(isRef(v))continue;
   const oldRef=old[field],oldUrl=isRef(oldRef)?urlCache[id+':'+field+':'+oldRef]:'';
   if(oldUrl&&v===oldUrl){next[field]=oldRef;continue;}
   if(isDataImage(v)){
    const blob=await (await fetch(v)).blob(),ref='lrdb:'+await addBlob(blob,'chat-meta-'+field,id);next[field]=ref;
    const rec=await getBlob(ref.slice(5));if(rec?.blob)urlCache[id+':'+field+':'+ref]=URL.createObjectURL(rec.blob);
   }
  }
  all[id]=next;
  try{localStorage.setItem(META_KEY,JSON.stringify(all));}
  catch(e){throw new Error('资料仍超过浏览器储存额度。请先缩小头像/背景图片后再保存。');}
  return readContactMeta(id);
 }
 window.readChatMeta=readMeta;window.writeChatMeta=(id,data)=>{const all=readMeta();all[id]={...(all[id]||{}),...(data||{})};localStorage.setItem(META_KEY,JSON.stringify(all));};
 window.chatMeta=readContactMeta;window.saveChatMetaSafely=saveSafely;
 window.__lrChatStorageReady=readyPromise=migrate().catch(e=>{console.error('[LOVE RECORD] chat storage init failed',e);throw e;});
})();