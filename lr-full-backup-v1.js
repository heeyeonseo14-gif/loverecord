/* LOVE RECORD · Full Backup & Restore
   Exports/restores same-origin LOVE RECORD localStorage + IndexedDB data. */
(function(){
 'use strict';
 if(window.__lrFullBackupInstalled)return;
 window.__lrFullBackupInstalled=true;
 const KNOWN_DBS=[
  'love-record-long-chat-v1','love-record-chat-meta-db-v1','love-record-chat-index-v1',
  'love-record-contact-db-v1','love-record-extra-v1','love-record-kv-v1',
  'love-record-chat-files-v1','yanyan-love-v5','love-record-community-db',
  'love-record-appearance-assets-v2','love-record-home-widgets-db','love-record-space-history-v1',
  'love-record-life-apps-v1','love-record-music-v1','love-record-scrapbook-v1','LIVE_LOCAL_DB'
 ];
 const FORMAT='LOVE_RECORD_FULL_BACKUP', VERSION=1;
 const $=id=>document.getElementById(id);
 const toast=msg=>{if(typeof window.toast==='function')window.toast(msg);else alert(msg)};
 const b64=buffer=>{const bytes=new Uint8Array(buffer);let out='';const chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)out+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));return btoa(out)};
 const unb64=value=>{const bin=atob(value),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out.buffer};
 async function packValue(value,seen=new WeakSet()){
  if(value===undefined)return {$lrType:'Undefined'};
  if(typeof value==='bigint')return {$lrType:'BigInt',value:String(value)};
  if(value===null||typeof value!=='object')return value;
  if(seen.has(value))throw new Error('检测到循环引用数据，无法安全打包；原数据没有被修改。');
  seen.add(value);
  try{
   if(value instanceof Date)return {$lrType:'Date',value:value.toISOString()};
   if(value instanceof Blob)return {$lrType:value instanceof File?'File':'Blob',mime:value.type||'',name:value instanceof File?value.name:undefined,lastModified:value instanceof File?value.lastModified:undefined,data:b64(await value.arrayBuffer())};
   if(value instanceof ArrayBuffer)return {$lrType:'ArrayBuffer',data:b64(value)};
   if(ArrayBuffer.isView(value))return {$lrType:'TypedArray',name:value.constructor.name,data:b64(value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength))};
   if(value instanceof Map){const entries=[];for(const [k,v] of value)entries.push([await packValue(k,seen),await packValue(v,seen)]);return {$lrType:'Map',entries};}
   if(value instanceof Set){const values=[];for(const v of value)values.push(await packValue(v,seen));return {$lrType:'Set',values};}
   if(Array.isArray(value)){const out=[];for(const v of value)out.push(await packValue(v,seen));return out;}
   const out={};for(const k of Object.keys(value))out[k]=await packValue(value[k],seen);return out;
  }finally{seen.delete(value)}
 }
 async function unpackValue(value){
  if(!value||typeof value!=='object')return value;
  if(Array.isArray(value)){const a=[];for(const v of value)a.push(await unpackValue(v));return a;}
  switch(value.$lrType){
   case 'Undefined':return undefined;
   case 'BigInt':return BigInt(value.value);
   case 'Date':return new Date(value.value);
   case 'Blob':case 'File':{const blob=new Blob([unb64(value.data)],{type:value.mime||''});return value.$lrType==='File'?new File([blob],value.name||'backup-file',{type:value.mime||'',lastModified:value.lastModified||Date.now()}):blob;}
   case 'ArrayBuffer':return unb64(value.data);
   case 'TypedArray':{const buf=unb64(value.data),Ctor=globalThis[value.name];if(typeof Ctor!=='function')throw new Error('不支持恢复的数据类型：'+value.name);return new Ctor(buf);}
   case 'Map':{const m=new Map();for(const [k,v] of value.entries)m.set(await unpackValue(k),await unpackValue(v));return m;}
   case 'Set':{const s=new Set();for(const v of value.values)s.add(await unpackValue(v));return s;}
   default:{const o={};for(const k of Object.keys(value))o[k]=await unpackValue(value[k]);return o;}
  }
 }
 function openDb(name,version){return new Promise((resolve,reject)=>{const req=version?indexedDB.open(name,version):indexedDB.open(name);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('无法读取数据库 '+name));req.onblocked=()=>reject(new Error('数据库 '+name+' 正被其他页面使用，请关闭其他 LOVE RECORD 页面后重试。'));});}
 function reqResult(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('数据库读取失败'));});}
 async function exportDb(name){
  const db=await openDb(name), stores=[];
  for(const storeName of Array.from(db.objectStoreNames)){
   const tx=db.transaction(storeName,'readonly'),store=tx.objectStore(storeName);
   const keysReq=store.getAllKeys(),valuesReq=store.getAll();
   const [keys,values]=await Promise.all([reqResult(keysReq),reqResult(valuesReq)]);
   const indexes=Array.from(store.indexNames).map(indexName=>{const ix=store.index(indexName);return {name:indexName,keyPath:ix.keyPath,unique:ix.unique,multiEntry:ix.multiEntry}});
   const records=[];
   for(let i=0;i<values.length;i++)records.push({key:await packValue(keys[i]),value:await packValue(values[i])});
   stores.push({name:storeName,keyPath:store.keyPath,autoIncrement:store.autoIncrement,indexes,records});
  }
  const meta={name:db.name,version:db.version,stores};db.close();return meta;
 }
 async function listDbNames(){
  if(indexedDB.databases){const list=await indexedDB.databases();return Array.from(new Set([...list.map(x=>x.name).filter(Boolean),...KNOWN_DBS]));}
  return KNOWN_DBS.slice();
 }
 async function makeBackup(){
  const local={},session={};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);local[k]=localStorage.getItem(k)}
  try{for(let i=0;i<sessionStorage.length;i++){const k=sessionStorage.key(i);session[k]=sessionStorage.getItem(k)}}catch(_){}
  const names=await listDbNames(),databases=[];
  for(const name of names){try{const db=await openDb(name);const hasStores=db.objectStoreNames.length>0;db.close();if(hasStores)databases.push(await exportDb(name));}catch(e){console.warn('[LR backup] skip DB',name,e)}}
  return {format:FORMAT,version:VERSION,createdAt:new Date().toISOString(),origin:location.origin,localStorage:local,sessionStorage:session,databases};
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 async function exportAll(){
  const btn=$('lrBackupExport');if(btn)btn.disabled=true;
  try{
   toast('正在整理 LOVE RECORD 的全部数据，请稍候……');
   const data=await makeBackup(),json=JSON.stringify(data);
   const blob=new Blob([json],{type:'application/json'});
   const date=new Date().toISOString().slice(0,10);
   download(blob,'LOVE_RECORD_FULL_BACKUP_'+date+'.json');
   toast('完整备份已导出：'+(data.databases.length)+' 个数据库。请妥善保存文件。');
  }catch(e){console.error('[LR backup] export failed',e);toast('备份失败：'+e.message)}
  finally{if(btn)btn.disabled=false}
 }
 function createOrUpgradeDb(meta){
  return new Promise((resolve,reject)=>{
   const req=indexedDB.open(meta.name);
   req.onsuccess=()=>{const db=req.result;const missing=meta.stores.some(s=>!db.objectStoreNames.contains(s.name));if(!missing){db.close();resolve();return}const next=db.version+1;db.close();const up=indexedDB.open(meta.name,next);up.onupgradeneeded=()=>{const d=up.result;for(const s of meta.stores){if(d.objectStoreNames.contains(s.name))continue;const store=d.createObjectStore(s.name,{keyPath:s.keyPath===null?undefined:s.keyPath,autoIncrement:!!s.autoIncrement});for(const ix of s.indexes||[])store.createIndex(ix.name,ix.keyPath,{unique:!!ix.unique,multiEntry:!!ix.multiEntry});}};up.onsuccess=()=>{up.result.close();resolve()};up.onerror=()=>reject(up.error);up.onblocked=()=>reject(new Error('数据库升级被其他页面阻止：'+meta.name));};
   req.onerror=()=>{if(req.error?.name==='NotFoundError'){const fresh=indexedDB.open(meta.name,Math.max(1,meta.version||1));fresh.onupgradeneeded=()=>{const db=fresh.result;for(const s of meta.stores){const store=db.createObjectStore(s.name,{keyPath:s.keyPath===null?undefined:s.keyPath,autoIncrement:!!s.autoIncrement});for(const ix of s.indexes||[])store.createIndex(ix.name,ix.keyPath,{unique:!!ix.unique,multiEntry:!!ix.multiEntry});}};fresh.onsuccess=()=>{fresh.result.close();resolve()};fresh.onerror=()=>reject(fresh.error)}else reject(req.error)};
  });
 }
 async function importDb(meta){
  await createOrUpgradeDb(meta);
  const db=await openDb(meta.name);
  for(const s of meta.stores){
   if(!db.objectStoreNames.contains(s.name))continue;
   const prepared=[];
   for(const rec of s.records||[])prepared.push({key:await unpackValue(rec.key),value:await unpackValue(rec.value)});
   const tx=db.transaction(s.name,'readwrite'),store=tx.objectStore(s.name);
   store.clear();
   for(const rec of prepared){if(store.keyPath===null)store.put(rec.value,rec.key);else store.put(rec.value);}
   await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('恢复数据库失败：'+meta.name+'/'+s.name));tx.onabort=()=>reject(tx.error||new Error('恢复事务中断：'+meta.name+'/'+s.name));});
  }
  db.close();
 }
 async function importAll(file){
  const btn=$('lrBackupImport');if(btn)btn.disabled=true;
  try{
   const raw=await file.text(),data=JSON.parse(raw);
   if(data.format!==FORMAT||data.version!==VERSION||!Array.isArray(data.databases)||!data.localStorage)throw new Error('这不是有效的 LOVE RECORD 完整备份文件。');
   if(!confirm('即将从备份恢复 LOVE RECORD 数据。\n当前浏览器中的同名数据库和本机设置会被备份内容覆盖。建议先导出当前数据作为保险。\n确定继续吗？'))return;
   toast('正在恢复数据，请不要关闭页面……');
   for(const meta of data.databases)await importDb(meta);
   localStorage.clear();for(const [k,v] of Object.entries(data.localStorage))localStorage.setItem(k,String(v));
   try{sessionStorage.clear();for(const [k,v] of Object.entries(data.sessionStorage||{}))sessionStorage.setItem(k,String(v))}catch(_){}
   toast('恢复完成，即将重新加载 LOVE RECORD。');
   setTimeout(()=>location.reload(),900);
  }catch(e){console.error('[LR backup] import failed',e);toast('恢复失败：'+e.message)}
  finally{if(btn)btn.disabled=false;const input=$('lrBackupFile');if(input)input.value=''}
 }
 function addPanel(){
  const app=$('settingsApp');if(!app||$('lrBackupCard'))return;
  const card=document.createElement('section');card.id='lrBackupCard';card.className='lr-storage-card';
  card.innerHTML='<div class="eyebrow">BACKUP &amp; RESTORE</div><h3 style="margin:6px 0 5px">完整备份与恢复</h3><div class="sub">导出 LOVE RECORD 当前浏览器中的个人资料、聊天记录、人物、自设、照片、空间、主题与其他 IndexedDB / 本机设置数据。换设备时可导入备份恢复。</div><div class="lr-storage-actions" style="margin-top:14px"><button class="btn primary" id="lrBackupExport" type="button">导出完整备份</button><button class="btn" id="lrBackupImport" type="button">导入备份文件</button></div><input id="lrBackupFile" type="file" accept=".json,application/json" hidden><div class="sub" style="margin-top:10px">备份文件保存在你选择的下载位置。导入会覆盖备份中包含的同名数据，建议先导出当前版本。API Key 等本机设置也可能包含在备份中，请勿分享备份文件。</div>';
  app.append(card);
  $('lrBackupExport').addEventListener('click',exportAll);
  $('lrBackupImport').addEventListener('click',()=>$('lrBackupFile').click());
  $('lrBackupFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importAll(f)});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addPanel);else addPanel();
})();
