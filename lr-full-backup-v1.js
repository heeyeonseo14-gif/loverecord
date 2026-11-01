/* LOVE RECORD · 全量备份中心 v2
   同源浏览器数据备份：local/sessionStorage、全部可枚举 IndexedDB、CacheStorage。
   不会自动上传任何数据。导入前先下载当前现场备份。 */
(function(){
'use strict';
if(window.__lrFullBackupV2Installed)return;window.__lrFullBackupV2Installed=true;
const FORMAT='LOVE_RECORD_FULL_BACKUP',VERSION=3,$=id=>document.getElementById(id);
const KNOWN_DBS=['love-record-long-chat-v1','love-record-chat-meta-db-v1','love-record-chat-index-v1','love-record-contact-db-v1','love-record-extra-v1','love-record-kv-v1','love-record-chat-files-v1','yanyan-love-v5','love-record-community-db','love-record-appearance-assets-v2','love-record-home-widgets-db','love-record-space-history-v1','love-record-space-cities-v1','love-record-life-apps-v1','love-record-music-v1','love-record-scrapbook-v1','LIVE_LOCAL_DB','lr-farm-save-db-v5','lr-farm-save-db'];
const toast=m=>{if(typeof window.toast==='function')window.toast(m);else alert(m)};
const b64=b=>{const u=new Uint8Array(b);let s='';for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode(...u.subarray(i,Math.min(i+32768,u.length)));return btoa(s)};
const unb64=s=>{const x=atob(s),u=new Uint8Array(x.length);for(let i=0;i<x.length;i++)u[i]=x.charCodeAt(i);return u.buffer};
async function pack(v,seen=new WeakSet()){
 if(v===undefined)return {$lrType:'Undefined'};if(typeof v==='bigint')return {$lrType:'BigInt',value:String(v)};
 if(v===null||typeof v!=='object')return v;if(seen.has(v))throw Error('数据包含循环引用，已停止备份，原数据未修改。');seen.add(v);
 try{
  if(v instanceof Date)return {$lrType:'Date',value:v.toISOString()};
  if(v instanceof Blob)return {$lrType:v instanceof File?'File':'Blob',mime:v.type||'',name:v.name||'',lastModified:v.lastModified||0,data:b64(await v.arrayBuffer())};
  if(v instanceof ArrayBuffer)return {$lrType:'ArrayBuffer',data:b64(v)};
  if(ArrayBuffer.isView(v))return {$lrType:'TypedArray',name:v.constructor.name,data:b64(v.buffer.slice(v.byteOffset,v.byteOffset+v.byteLength))};
  if(v instanceof Map){let a=[];for(const [k,x] of v)a.push([await pack(k,seen),await pack(x,seen)]);return {$lrType:'Map',entries:a}}
  if(v instanceof Set){let a=[];for(const x of v)a.push(await pack(x,seen));return {$lrType:'Set',values:a}}
  if(Array.isArray(v)){let a=[];for(const x of v)a.push(await pack(x,seen));return a}
  let o={};for(const k of Object.keys(v))o[k]=await pack(v[k],seen);return o;
 }finally{seen.delete(v)}
}
async function unpack(v){
 if(!v||typeof v!=='object')return v;if(Array.isArray(v)){let a=[];for(const x of v)a.push(await unpack(x));return a}
 switch(v.$lrType){
 case'Undefined':return undefined;case'BigInt':return BigInt(v.value);case'Date':return new Date(v.value);
 case'Blob':case'File':{let b=new Blob([unb64(v.data)],{type:v.mime||''});return v.$lrType==='File'?new File([b],v.name||'backup-file',{type:v.mime||'',lastModified:v.lastModified||Date.now()}):b}
 case'ArrayBuffer':return unb64(v.data);case'TypedArray':{let C=globalThis[v.name];if(typeof C!=='function')throw Error('不支持的数据类型：'+v.name);return new C(unb64(v.data))}
 case'Map':{let m=new Map();for(const [k,x] of v.entries)m.set(await unpack(k),await unpack(x));return m}
 case'Set':{let s=new Set();for(const x of v.values)s.add(await unpack(x));return s}
 default:{let o={};for(const k of Object.keys(v))o[k]=await unpack(v[k]);return o}
 }
}
async function readBackupFile(file){
 if(file&&typeof file.text==='function')return file.text();
 return new Promise((resolve,reject)=>{
  if(typeof FileReader==='undefined')return reject(Error('当前浏览器不支持读取备份文件'));
  const reader=new FileReader();
  reader.onload=()=>resolve(String(reader.result||''));
  reader.onerror=()=>reject(reader.error||Error('备份文件读取失败'));
  reader.readAsText(file,'UTF-8');
 });
}
const reqP=r=>new Promise((ok,no)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error||Error('IndexedDB 读取失败'))});
function openDB(n){return new Promise((ok,no)=>{let r=indexedDB.open(n);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error||Error('无法打开数据库 '+n));r.onblocked=()=>no(Error('数据库被其他 LOVE RECORD 页面占用：'+n))})}
async function dbNames(){
 if(typeof indexedDB.databases==='function'){
  const names=[];for(const x of await indexedDB.databases())if(x.name)names.push(x.name);
  if(names.length)return [...new Set(names)];
 }
 const found=[];
 for(const name of KNOWN_DBS){
  let db;
  try{db=await openDB(name);const stores=[...db.objectStoreNames];db.close();db=null;
   if(stores.length)found.push(name);
   else await new Promise(resolve=>{const r=indexedDB.deleteDatabase(name);r.onsuccess=r.onerror=r.onblocked=()=>resolve()});
  }catch(e){if(db)try{db.close()}catch(_){}}
 }
 return found;
}
async function exportDB(name){
 const db=await openDB(name),stores=[];
 try{for(const sn of [...db.objectStoreNames]){
  const tx=db.transaction(sn,'readonly'),st=tx.objectStore(sn),[keys,vals]=await Promise.all([reqP(st.getAllKeys()),reqP(st.getAll())]);
  const indexes=[...st.indexNames].map(n=>{let x=st.index(n);return {name:n,keyPath:x.keyPath,unique:x.unique,multiEntry:x.multiEntry}});
  let records=[];for(let i=0;i<vals.length;i++)records.push({key:await pack(keys[i]),value:await pack(vals[i])});
  stores.push({name:sn,keyPath:st.keyPath,autoIncrement:st.autoIncrement,indexes,records});
 }}finally{db.close()}
 return {name:db.name,version:db.version,stores};
}
async function exportCaches(){
 if(!('caches'in window))return [];
 let out=[];for(const name of await caches.keys()){const c=await caches.open(name),items=[];
  for(const req of await c.keys()){const res=await c.match(req);if(!res)continue;items.push({url:req.url,method:req.method,headers:[...res.headers.entries()],status:res.status,statusText:res.statusText,body:b64(await res.arrayBuffer())})}
  out.push({name,items});
 }return out;
}
function storageDump(s){let o={};for(let i=0;i<s.length;i++){let k=s.key(i);o[k]=s.getItem(k)}return o}
async function makeBackup(){
 const local=storageDump(localStorage),session=storageDump(sessionStorage),databases=[],warnings=[];
 const names=await dbNames();if(!names.length)warnings.push('没有发现可读取的 IndexedDB 数据库。请检查浏览器是否允许网站使用 IndexedDB。');
 for(const n of (names||[])){try{const d=await exportDB(n);if(d.stores.length)databases.push(d)}catch(e){warnings.push(n+': '+e.message)}}
 const cacheStorage=await exportCaches();
 const dbRecordCount=name=>databases.filter(d=>d.name===name).reduce((a,d)=>a+d.stores.reduce((x,s)=>x+s.records.length,0),0);
 const localKeys=Object.keys(local);
 const moduleCoverage={
  chat:{localStorageKeys:localKeys.filter(k=>/chat|thread|sticker|message/i.test(k)).length,databaseRecords:databases.filter(d=>/chat|thread|contact/i.test(d.name)).reduce((a,d)=>a+d.stores.reduce((x,s)=>x+s.records.length,0),0)},
  space:{localStorageKeys:localKeys.filter(k=>/space/i.test(k)).length,databaseRecords:databases.filter(d=>/space/i.test(d.name)).reduce((a,d)=>a+d.stores.reduce((x,s)=>x+s.records.length,0),0)},
  farm:{localStorageKeys:localKeys.filter(k=>/farm/i.test(k)).length,databaseRecords:databases.filter(d=>/farm/i.test(d.name)).reduce((a,d)=>a+d.stores.reduce((x,s)=>x+s.records.length,0),0)}
 };
 const payload={format:FORMAT,version:VERSION,createdAt:new Date().toISOString(),origin:location.origin,app:'LOVE RECORD',coverage:{localStorageKeys:localKeys.length,sessionStorageKeys:Object.keys(session).length,indexedDBs:databases.length,objectStores:databases.reduce((n,d)=>n+d.stores.length,0),indexedDBRecords:databases.reduce((n,d)=>n+d.stores.reduce((a,s)=>a+s.records.length,0),0),cacheBuckets:cacheStorage.length,cacheEntries:cacheStorage.reduce((n,c)=>n+c.items.length,0)},moduleCoverage,localStorage:local,sessionStorage:session,databases,cacheStorage,warnings};
 payload.integrity={algorithm:'SHA-256',sha256:await digest(JSON.stringify(payload))};return payload;
}
async function digest(s){if(!crypto?.subtle)return 'unavailable';let h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function download(blob,name){let u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
function dateName(){return new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}
async function exportAll(){
 const b=$('lrBackupExport');if(b)b.disabled=true;
 try{toast('正在逐项读取 LOVE RECORD 数据，请保持页面打开……');const d=await makeBackup(),json=JSON.stringify(d),blob=new Blob([json],{type:'application/json'});
 download(blob,'LOVE_RECORD_FULL_BACKUP_'+dateName()+'.json');
 let c=d.coverage,m=d.moduleCoverage||{};let msg=`备份已导出：${c.indexedDBs} 个数据库、${c.objectStores} 个数据表、${c.indexedDBRecords} 条数据库记录、${c.localStorageKeys} 项本机设置。\\n聊天：${m.chat?.databaseRecords||0} 条数据库记录 / ${m.chat?.localStorageKeys||0} 项本机键；SPACE：${m.space?.databaseRecords||0} 条 / ${m.space?.localStorageKeys||0} 项；农场：${m.farm?.databaseRecords||0} 条 / ${m.farm?.localStorageKeys||0} 项。`;
 if(d.warnings.length)msg+=' 有 '+d.warnings.length+' 个数据库读取失败，请查看备份报告。';toast(msg);
 $('lrBackupReport').textContent=msg+(d.warnings.length?'\n未能读取：\n'+d.warnings.join('\n'):'')+'\n请确认文件已出现在下载目录，并定期复制到云盘或电脑。';
 }catch(e){console.error('[LR backup]',e);toast('备份失败：'+e.message);$('lrBackupReport').textContent='备份未完成：'+e.message}
 finally{if(b)b.disabled=false}
}
async function verifyFile(d){
 if(d.format!==FORMAT||![1,2,3].includes(d.version)||!d.localStorage||typeof d.localStorage!=='object'||!Array.isArray(d.databases))throw Error('文件格式不正确或不是 LOVE RECORD 完整备份。');
 if(d.origin&&d.origin!==location.origin&&!confirm('这份备份来自另一个网址：'+d.origin+'。当前网址是：'+location.origin+'。不同网址的浏览器数据彼此独立，仍要尝试恢复吗？'))throw Error('已取消跨网址恢复。');
 if(d.version>=2&&d.integrity?.sha256&&d.integrity.sha256!=='unavailable'){
  const copy={...d};delete copy.integrity;const actual=await digest(JSON.stringify(copy));if(actual!==d.integrity.sha256)throw Error('备份完整性校验失败，文件可能损坏或被修改。');
 }
 for(const db of d.databases){if(!db.name||!Array.isArray(db.stores))throw Error('数据库清单不完整。');for(const st of db.stores)if(!st.name||!Array.isArray(st.records))throw Error('数据表清单不完整。')}
}
async function createStores(meta){
 let db=await openDB(meta.name);
 const missing=meta.stores.filter(s=>!db.objectStoreNames.contains(s.name));
 const missingIndexes=[];
 for(const s of meta.stores){
  if(!db.objectStoreNames.contains(s.name))continue;
  const st=db.transaction(s.name,'readonly').objectStore(s.name);
  for(const ix of s.indexes||[])if(!st.indexNames.contains(ix.name))missingIndexes.push({store:s.name,index:ix});
 }
 if(!missing.length&&!missingIndexes.length){db.close();return}
 const ver=db.version+1;db.close();
 await new Promise((ok,no)=>{
  const r=indexedDB.open(meta.name,ver);
  r.onupgradeneeded=()=>{
   const d=r.result,tx=r.transaction;
   for(const s of missing){
    const st=d.createObjectStore(s.name,{keyPath:s.keyPath===null?undefined:s.keyPath,autoIncrement:!!s.autoIncrement});
    for(const ix of s.indexes||[])st.createIndex(ix.name,ix.keyPath,{unique:!!ix.unique,multiEntry:!!ix.multiEntry});
   }
   for(const item of missingIndexes){
    const st=tx.objectStore(item.store),ix=item.index;
    if(!st.indexNames.contains(ix.name))st.createIndex(ix.name,ix.keyPath,{unique:!!ix.unique,multiEntry:!!ix.multiEntry});
   }
  };
  r.onsuccess=()=>{r.result.close();ok()};
  r.onerror=()=>no(r.error||Error('数据库结构升级失败：'+meta.name));
  r.onblocked=()=>no(Error('升级数据库被其他 LOVE RECORD 页面占用：'+meta.name));
 });
}
async function restoreDB(meta){
 await createStores(meta);const db=await openDB(meta.name);
 try{for(const s of meta.stores){if(!db.objectStoreNames.contains(s.name))throw Error('缺少数据表：'+s.name);
  const prepared=[];for(const r of s.records)prepared.push({key:await unpack(r.key),value:await unpack(r.value)});
  await new Promise((ok,no)=>{let tx=db.transaction(s.name,'readwrite'),st=tx.objectStore(s.name);st.clear();for(const r of prepared){if(st.keyPath===null)st.put(r.value,r.key);else st.put(r.value)}tx.oncomplete=ok;tx.onerror=()=>no(tx.error||Error('恢复失败 '+meta.name+'/'+s.name));tx.onabort=()=>no(tx.error||Error('恢复中断 '+meta.name+'/'+s.name))})
 }}finally{db.close()}
}
async function restoreCaches(list){
 if(!('caches'in window)||!Array.isArray(list))return;
 for(const item of list){const c=await caches.open(item.name);for(const x of item.items||[]){const res=new Response(unb64(x.body),{status:x.status||200,statusText:x.statusText||'',headers:x.headers||[]});await c.put(new Request(x.url,{method:'GET'}),res)}}
}
async function importAll(file){
 const b=$('lrBackupImport');if(b)b.disabled=true;
 try{
  toast('正在检查备份文件……');const d=JSON.parse(await readBackupFile(file));await verifyFile(d);
  const c=d.coverage||{},summary=`备份日期：${d.createdAt||'未知'}\n数据库：${d.databases.length} 个\n数据表：${d.databases.reduce((n,x)=>n+x.stores.length,0)} 个\n数据库记录：${c.indexedDBRecords??'旧版备份'} 条\n本机设置：${Object.keys(d.localStorage).length} 项\n来源：${d.origin||'未知'}`;
  $('lrBackupReport').textContent='已通过文件结构检查。\n'+summary+'\n\n恢复会覆盖备份中同名的数据表和本机同名设置。其他未包含的设置会保留。';
  if(!confirm(summary+'\n\n恢复前会先自动下载当前浏览器的现场备份。请确认下载成功后再继续。\n确定恢复吗？'))return;
  toast('先备份当前浏览器现场……');const safety=await makeBackup();download(new Blob([JSON.stringify(safety)],{type:'application/json'}),'LOVE_RECORD_PRE_RESTORE_SAFETY_'+dateName()+'.json');
  if(!confirm('请确认刚刚的 PRE_RESTORE_SAFETY 文件已成功下载。若没有下载，请取消恢复。'))return;
  toast('正在恢复数据库，请不要关闭页面……');
  const restoredStats=[];
  for(const meta of d.databases){
   await restoreDB(meta);
   const check=await exportDB(meta.name);
   for(const expected of meta.stores){
    const actual=check.stores.find(x=>x.name===expected.name);
    if(!actual||actual.records.length!==expected.records.length)throw Error('恢复后校验失败：'+meta.name+'/'+expected.name+'（记录数量不一致）');
   }
   restoredStats.push(meta.name+'：'+meta.stores.reduce((a,s)=>a+s.records.length,0)+' 条');
  }
  const restoreWarnings=[];for(const [k,v] of Object.entries(d.localStorage)){try{localStorage.setItem(k,String(v))}catch(e){restoreWarnings.push('本机设置未能写入 '+k+'：'+e.name)}}
  // sessionStorage 是临时会话数据，不清空当前未包含的键
  for(const [k,v] of Object.entries(d.sessionStorage||{}))sessionStorage.setItem(k,String(v));
  await restoreCaches(d.cacheStorage||[]);
  toast(restoreWarnings.length?'数据库已恢复，但有 '+restoreWarnings.length+' 项 localStorage 设置受浏览器容量限制，详情见报告。':'恢复完成，即将重新加载。');$('lrBackupReport').textContent+='\\n数据库恢复完成。\\n'+restoredStats.join('\\n')+(restoreWarnings.length?'\\n未能写入的设置：\\n'+restoreWarnings.join('\\n'):'');setTimeout(()=>location.reload(),1500);
 }catch(e){console.error('[LR backup] import failed',e);toast('恢复未完成：'+e.message);$('lrBackupReport').textContent='恢复中止：'+e.message+'\n请保留现场安全备份文件。'}
 finally{if(b)b.disabled=false;const f=$('lrBackupFile');if(f)f.value=''}
}
function addPanel(){
 const app=$('settingsApp');if(!app||$('lrBackupCard'))return;
 const card=document.createElement('section');card.id='lrBackupCard';card.className='lr-storage-card';
 card.style.cssText='margin-top:14px;padding:16px;border:1px solid var(--line,rgba(120,100,150,.18));border-radius:18px;background:var(--card,rgba(255,255,255,.55))';
 card.innerHTML=`<div class="eyebrow">BACKUP &amp; RESTORE · SAFETY CENTER</div><h3 style="margin:6px 0">LOVE RECORD 全量备份中心</h3><p class="sub">把聊天、联系人、自设、世界书、日记、动态、空间、农场、音乐、外观、应用资料及浏览器内可读取的数据保存成一个备份文件。建议每天备份，并把文件复制到手机以外的位置。</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:14px"><button class="btn primary" id="lrBackupExport" type="button">导出全量备份</button><button class="btn" id="lrBackupImport" type="button">从备份恢复</button></div><input id="lrBackupFile" type="file" accept=".json,application/json" hidden><div id="lrBackupReport" class="sub" style="white-space:pre-wrap;overflow-wrap:anywhere;margin-top:12px;padding:11px;border-radius:12px;background:rgba(120,100,150,.07)">尚未执行备份。每次导出后，请确认文件确实出现在下载目录。</div><p class="sub" style="margin-top:10px">重要：备份文件可能包含 API Key、聊天内容、角色资料和私人照片，请勿发给他人。浏览器不允许网页读取 HttpOnly Cookie、其他网址的数据或手机文件系统中的任意文件；外部 API 服务端数据也不在本地备份范围内。导入前会先下载当前现场备份。</p>`;
 app.append(card);$('lrBackupExport').addEventListener('click',exportAll);$('lrBackupImport').addEventListener('click',()=>$('lrBackupFile').click());$('lrBackupFile').addEventListener('change',e=>{if(e.target.files?.[0])importAll(e.target.files[0])});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addPanel);else addPanel();
})();
