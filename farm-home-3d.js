/* LOVE RECORD V21 · Three.js fixed-isometric home renderer */
(function(){
'use strict';
const THREE_CDN='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
const roomNames={living:'客厅',bedroom:'卧室',kitchen:'厨房',balcony:'阳台'};
const palette={wall:0xf5eddf,wallSide:0xe9dfce,floor:0xc99e72,wood:0x9b704e,woodLight:0xc69b70,sage:0x9baa88,sageDark:0x71866b,linen:0xf4eadb,cream:0xfff8ec,brass:0xb58b50,glass:0xb9d8d5,leaf:0x718b61,clay:0xc88e70};
let THREE=null,scriptPromise=null,active=null,observer=null,resizeObserver=null;
function loadThree(){if(window.THREE)return Promise.resolve(window.THREE);if(scriptPromise)return scriptPromise;scriptPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=THREE_CDN;s.async=true;s.onload=()=>window.THREE?resolve(window.THREE):reject(Error('Three.js 未加载'));s.onerror=()=>reject(Error('Three.js CDN 无法连接'));document.head.appendChild(s)});return scriptPromise}
function mat(color,roughness=.82,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness})}
function box(w,h,d,material,x=0,y=0,z=0,group=null,r=0){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.rotation.y=r;m.castShadow=true;m.receiveShadow=true;(group||active.scene).add(m);return m}
function roundedBox(w,h,d,r,material,x=0,y=0,z=0,group=null){
 const rr=Math.min(r,w*.22,h*.22,d*.22),shape=new THREE.Shape();
 shape.moveTo(-w/2+rr,-h/2);shape.lineTo(w/2-rr,-h/2);shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+rr);shape.lineTo(w/2,h/2-rr);shape.quadraticCurveTo(w/2,h/2,w/2-rr,h/2);shape.lineTo(-w/2+rr,h/2);shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-rr);shape.lineTo(-w/2,-h/2+rr);shape.quadraticCurveTo(-w/2,-h/2,-w/2+rr,-h/2);
 const geo=new THREE.ExtrudeGeometry(shape,{depth:Math.max(.02,d-rr*2),bevelEnabled:true,bevelSegments:3,steps:1,bevelSize:rr*.42,bevelThickness:rr*.42,curveSegments:8});
 geo.translate(0,0,-(d-rr*2)/2);const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;(group||active.scene).add(m);return m;
}
function woodTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=512;const x=c.getContext('2d');x.fillStyle='#c99f77';x.fillRect(0,0,512,512);
 for(let row=0;row<12;row++){const y=row*43;for(let col=0;col<3;col++){const xx=col*172+(row%2? -86:0);const grad=x.createLinearGradient(xx,y,xx+170,y+43);grad.addColorStop(0,'#d8b58e');grad.addColorStop(.48,'#c99f77');grad.addColorStop(1,'#b98c65');x.fillStyle=grad;x.fillRect(xx+1,y+1,170,41);x.strokeStyle='rgba(104,70,43,.24)';x.lineWidth=2;x.strokeRect(xx+1,y+1,170,41);for(let k=0;k<7;k++){const gy=y+6+k*5.5;x.strokeStyle=`rgba(111,75,48,${.035+Math.random()*.035})`;x.lineWidth=1;x.beginPath();x.moveTo(xx+8,gy);x.bezierCurveTo(xx+48,gy-3,xx+112,gy+3,xx+164,gy);x.stroke()}x.fillStyle='rgba(255,245,224,.35)';x.fillRect(xx+8,y+5,Math.max(20,Math.random()*70),1.5)}}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1.6,1.3);return t;
}
function sphere(radius,material,x,y,z,group=null,scale=null){const m=new THREE.Mesh(new THREE.SphereGeometry(radius,20,14),material);m.position.set(x,y,z);if(scale)m.scale.set(...scale);m.castShadow=true;(group||active.scene).add(m);return m}
function cylinder(rt,rb,h,material,x,y,z,group=null,segments=18){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,segments),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;(group||active.scene).add(m);return m}
function addLine(points,material,group){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Line(g,material);group.add(m);return m}
function makeRoom(room){
 const g=new THREE.Group();active.scene.add(g);
 const floorMat=new THREE.MeshStandardMaterial({color:room==='balcony'?0xe2c7a4:0xffffff,map:woodTexture(),roughness:.88}), wallMat=mat(palette.wall), sideMat=mat(palette.wallSide), trim=mat(0xd8c5a7), plank=mat(0xb98d66);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(8,6),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=.02;floor.receiveShadow=true;g.add(floor);active.floor=floor;
 // parquet seams and a warm border
 for(let z=-2.65;z<=2.7;z+=.42)addLine([[-3.9,.035,z],[3.9,.035,z]],new THREE.LineBasicMaterial({color:0xb78c68,transparent:true,opacity:.22}),g);
 for(let x=-3.7;x<=3.7;x+=1.15)addLine([[x,.036,-2.85],[x,.036,2.85]],new THREE.LineBasicMaterial({color:0xa97d59,transparent:true,opacity:.13}),g);
 // back and left walls, deliberately open toward the viewer
 box(8,5.2,.16,wallMat,0,2.62,-3.02,g);box(.16,5.2,6,sideMat,-4.02,2.62,0,g);
 box(8,.16,.22,trim,0,.12,-2.94,g);box(.22,.16,6,trim,-3.94,.12,0,g);
 // wall panel moulding
 for(let x=-3.35;x<=3.3;x+=1.1){box(.035,2.5,.035,trim,x,1.45,-2.91,g);box(.9,.035,.035,trim,x+.45,2.65,-2.91,g);}
 // window on back wall, panes and sill
 const winX=-2.15, winY=2.05, winZ=-2.89;
 box(1.45,1.65,.09,mat(0x9a7858),winX,winY,winZ,g);box(1.32,1.52,.08,mat(palette.glass,.25),winX,winY,winZ+.055,g);
 box(.075,1.56,.12,mat(0xfff8ec),winX,winY,winZ+.13,g);box(1.35,.075,.12,mat(0xfff8ec),winX,winY,winZ+.13,g);
 box(.07,1.55,.13,mat(0xfff8ec),winX,winY,winZ+.14,g);box(1.35,.07,.13,mat(0xfff8ec),winX,winY,winZ+.14,g);
 box(1.65,.12,.32,mat(0xc69b70),winX,1.2,winZ+.18,g);
 box(.045,1.48,.12,mat(0xfff8ec),winX,winY,winZ+.2,g);box(1.3,.045,.12,mat(0xfff8ec),winX,winY,winZ+.2,g);
 // curtains
 for(const x of [winX-.83,winX+.83]){const c=box(.28,1.85,.12,mat(0xe9dcc9),x,winY,winZ+.22,g);c.rotation.z=x<winX?-.04:.04;active.curtains=active.curtains||[];active.curtains.push({mesh:c,side:x<winX?-1:1});}
 // room-specific fixed architectural features
 if(room==='living'){
  // fireplace on back wall
  box(1.55,1.8,.36,mat(0xe3d2b8),1.9,1.25,-2.72,g);box(1.12,1.12,.12,mat(0x76503b),1.9,1.18,-2.48,g);box(1.7,.16,.5,mat(0xc49a72),1.9,2.2,-2.62,g);
  box(.9,.1,.1,mat(palette.brass),1.9,.64,-2.39,g);
  const fire=new THREE.Group();fire.position.set(1.9,.95,-2.35);g.add(fire);const fm= new THREE.MeshStandardMaterial({color:0xffa84b,emissive:0xf36a20,emissiveIntensity:1.3,roughness:.5});const f1=new THREE.Mesh(new THREE.ConeGeometry(.25,.72,7),fm);f1.position.y=.36;fire.add(f1);const f2=new THREE.Mesh(new THREE.ConeGeometry(.14,.46,7),mat(0xffd27a));f2.position.set(.08,.24,.03);fire.add(f2);active.fire=fire;const glow=new THREE.PointLight(0xff8b38,1.35,4.8);glow.position.set(1.9,1.05,-1.9);g.add(glow);active.fireLight=glow;
 }
 if(room==='balcony'){
  // open-air rail on the far side
  for(let x=-3.3;x<=3.31;x+=1.1)box(.09,.95,.09,mat(0x9b7959),x,.55,-2.85,g);
  box(7,.1,.12,mat(0xe6d5bd),0,1.02,-2.85,g);
 }
 // base skirting and ambient decorations
 const ambient=new THREE.PointLight(0xffe5bd,.45,9);ambient.position.set(-1,3.7,1);g.add(ambient);
 return g;
}
function addLegs(group,x,z,w,d,height,material){for(const dx of [-w/2+.1,w/2-.1])for(const dz of [-d/2+.1,d/2-.1])box(.09,height,.09,material,x+dx,height/2,z+dz,group)}
function createPlant(group){const pot=mat(0xc68d70),leaf=mat(0x718b61);cylinder(.22,.28,.35,pot,0,.2,0,group,8);cylinder(.025,.025,.65,mat(0x66805c),0,.66,0,group,8);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const l=sphere(.2,leaf,Math.cos(a)*.22,.9+Math.sin(i*1.7)*.13,Math.sin(a)*.22,group,[.55,1.65,.35]);l.rotation.z=Math.cos(a)*.55;l.rotation.x=Math.sin(a)*.4}}
function createFurniture(item,placement={}){
 const g=new THREE.Group();g.userData.furniture=true;g.userData.itemId=item.id;
 const finish=(color,role)=>{const m=mat(color);m.userData.finishRole=role;return m};
 const wood=finish(0xb88a60,'wood'),woodDark=finish(0x805a3d,'woodTrim'),linen=finish(0xf0e4d2,'fabric'),sage=finish(0x9baa88,'upholstery'),sageDark=finish(0x71866b,'upholsteryTrim'),brass=mat(0xb58b50),glass=mat(0xd3e5df,.25),clay=finish(0xc68e70,'clay');
 const t=item.type;
 if(['sofa','armchair'].includes(t)){
  const w=t==='sofa'?2.15:1.28,d=t==='sofa'?.92:.88;
  roundedBox(w,.32,d,.12,woodDark,0,.42,0,g);roundedBox(w,.42,d*.8,.16,sage,0,.78,-.03,g);roundedBox(w,.68,.2,.12,sageDark,0,1.05,-d*.38,g);
  roundedBox(.2,.68,d,.09,sageDark,-w/2+.08,.77,0,g);roundedBox(.2,.68,d,.09,sageDark,w/2-.08,.77,0,g);
  const count=t==='sofa'?3:1;for(let i=0;i<count;i++){const x=(i-(count-1)/2)*.58;roundedBox(.52,.2,.55,.08,linen,x,.91,-.03,g);roundedBox(.52,.035,.56,.05,mat(0xd8c9b4),x,1.03,-.03,g);sphere(.018,woodDark,x,.79,-.29,g)}
  // Small embroidered throw pillows and upholstery piping.
  for(const side of (t==='sofa'?[-.72,.72]:[0])){const pillow=roundedBox(.34,.34,.16,.1,mat(side<0?0xe8d8c2:0xd8c7ad),side,.98,-.34,g);pillow.rotation.z=side<0?-.12:.12;for(let k=-1;k<=1;k++)box(.012,.2,.012,mat(0xb89c7b),side+k*.07,.99,-.43,g)}
  for(let i=0;i<2;i++){const x=(i?1:-1)*(w/2-.16);box(.1,.22,.1,woodDark,x,.18,d*.34,g);box(.1,.22,.1,woodDark,x,.18,-d*.34,g)}
 }else if(['coffee','dining','bistro','island'].includes(t)){
  const w=t==='coffee'?1.35:t==='dining'?1.8:t==='bistro'?.9:1.75,d=t==='coffee'?.82:t==='dining'?1.15:t==='bistro'?.9:.95;
  if(t==='bistro'){cylinder(.48,.48,.13,wood,0,.82,0,g,32);cylinder(.09,.13,.7,woodDark,0,.4,0,g,16);cylinder(.42,.5,.1,woodDark,0,.06,0,g,24)}
  else {roundedBox(w,.14,d,.045,wood,0,.83,0,g);roundedBox(w-.08,.035,d-.08,.025,mat(0xe0c39f),0,.92,0,g);addLegs(g,0,0,w,d,.78,woodDark);for(const x of [-w*.34,w*.34])box(.018,.025,d-.12,mat(0x8f6949),x,.94,0,g);}
  // tabletop objects
  if(t!=='island'){cylinder(.11,.12,.055,mat(0xf5eee2),-.25,.96,-.1,g,20);cylinder(.075,.08,.05,mat(0x9bad87),.2,.97,.12,g,20)}
 }else if(['bookcase','shelf','cupboard','sideboard','wardrobe','dresser','vanity'].includes(t)){
  const w=t==='wardrobe'?1.65:t==='bookcase'?1.25:1.45,h=t==='wardrobe'?2.15:t==='bookcase'?1.9:1.1,d=.48;
  box(w,h,d,woodDark,0,h/2,0,g);box(w-.12,h-.12,d-.06,wood,0,h/2,.045,g);
  if(['bookcase','shelf'].includes(t)){for(let y=.45;y<h-.2;y+=.45)box(w-.16,.055,d-.08,mat(0x8b6245),0,y,.09,g);for(let i=0;i<8;i++){const x=-w*.38+(i%4)*.24,y=.7+Math.floor(i/4)*.48;box(.13,.28,.16,[linen,clay,sage][i%3],x,y,.02,g)}}
  else {for(let y=.38;y<h-.18;y+=.48){box(w-.18,.025,.08,woodDark,0,y,.28,g);if(t!=='wardrobe')box(w-.2,.36,.035,mat(0xc99d72),0,y+.19,.28,g)}for(let x of [-.28,.28])sphere(.035,brass,x,.55,.31,g)}
  if(t==='vanity'){box(.78,.85,.07,brass,0,h+.42,-.03,g);box(.68,.74,.035,glass,0,h+.42,.02,g)}
 }else if(['bed'].includes(t)){
  box(2.15,.34,2.65,woodDark,0,.32,0,g);roundedBox(2.05,.25,2.55,.1,linen,0,.62,0,g);box(2.12,1.3,.18,wood,0,.95,-1.25,g);roundedBox(2,.18,2.0,.08,mat(0xe7d9c5),0,.82,.25,g);
  for(let x of [-.55,.55]){roundedBox(.68,.22,.48,.1,mat(0xfff8ee),x,.99,-.72,g);box(.64,.035,.44,mat(0xd9c7b0),x,1.11,-.72,g)}
  box(2.08,.12,.65,sage,0,.8,.83,g);box(2.08,.035,.08,mat(0xf4eadb),0,.88,.55,g);
 }else if(['lamp','lantern'].includes(t)){
  cylinder(.2,.24,.12,woodDark,0,.07,0,g);cylinder(.045,.045,.85,brass,0,.5,0,g);if(t==='lamp'){const sh=new THREE.Mesh(new THREE.CylinderGeometry(.2,.34,.42,24,1,true),linen);sh.position.y=1.08;g.add(sh);sphere(.055,mat(0xffe4a5),0,.85,0,g)}else{box(.36,.42,.36,glass,0,1.0,0,g);for(let x of [-.2,.2])box(.035,.5,.035,brass,x,1,0,g);box(.42,.04,.42,brass,0,.75,0,g);box(.42,.04,.42,brass,0,1.23,0,g)}
 }else if(t==='plant'){createPlant(g)
 }else if(t==='flowers'){
  // A tiered French-country flower stand, not a generic plant icon.
  for(let y of [.48,1.05,1.62]){box(.95,.07,.34,wood,0,y,0,g);for(let x of [-.38,.38])box(.055,.42,.055,woodDark,x,y-.22,-.1,g)}
  for(let i=0;i<3;i++){const x=(i-1)*.32;const potMat=mat([0xc68e70,0xd8c6a9,0x9baa88][i]);cylinder(.11,.14,.18,potMat,x,.63+i*.57,.02,g,10);for(let j=0;j<5;j++){const a=j*Math.PI*2/5;const petal=sphere(.075,mat([0xe7b5a9,0xf0d8a0,0xd7a9bd][i]),x+Math.cos(a)*.12,.83+i*.57+Math.sin(a)*.03,.02+Math.sin(a)*.12,g,[.8,1,.55]);}sphere(.045,mat(0xd7ad62),x,.83+i*.57,.02,g)}
 }
 else if(t==='rug'){
  const rug=new THREE.Mesh(new THREE.BoxGeometry(2.1,.035,1.5),mat(0xe7d7bf));rug.position.y=.045;g.add(rug);const edge=box(2.0,.02,1.4,mat(0xb69b79),0,.07,0,g);edge.position.y=.07;const inner=box(1.82,.025,1.22,mat(0xf2e8d7),0,.085,0,g);
 }else if(['chair','chairbal'].includes(t)){
  box(.82,.15,.78,linen,0,.72,0,g);box(.82,.72,.13,wood,0,1.05,-.34,g);addLegs(g,0,0,.78,.72,.7,woodDark);
 }else if(t==='stove'){
  box(1.25,.9,.75,linen,0,.55,0,g);box(1.3,.12,.8,mat(0xeee6d8),0,1.04,0,g);for(let x of [-.32,.32])for(let z of [-.2,.2])cylinder(.12,.12,.045,woodDark,x,1.13,z,g,20);box(.48,.3,.04,glass,0,.45,.39,g);
 }else if(t==='mirror'){
  box(.12,1.55,.45,wood,0,.8,0,g);const m=new THREE.Mesh(new THREE.CircleGeometry(.31,32),glass);m.position.set(.08,1.05,.25);g.add(m)
 }else if(t==='wallart'){
  box(.09,1.12,.86,woodDark,0,1.05,0,g);box(.055,.98,.72,mat(0xf3e8d6),.055,1.05,0,g);
  const stem= new THREE.Mesh(new THREE.CylinderGeometry(.012,.018,.48,8),mat(0x718b61));stem.position.set(.09,1.05,.08);stem.rotation.z=-.25;g.add(stem);
  for(let i=0;i<5;i++){const leaf=sphere(.065,mat(0x82966e),.09+Math.sin(i*1.3)*.18,.88+i*.09,.1,g,[.55,1.5,.3]);leaf.rotation.z=(i%2?-.55:.55)}
  for(let x of [-.34,.34])box(.025,1.02,.04,brass,x,1.05,.08,g);
 }else if(t==='clock'){
  box(.1,1.05,.78,wood,0,1,0,g);cylinder(.28,.28,.06,mat(0xf8efdf),.08,1.05,.12,g,32);cylinder(.018,.018,.075,brass,.08,1.05,.17,g,12);
  box(.018,.16,.018,woodDark,.08,1.11,.2,g);const hand=box(.13,.018,.018,woodDark,.14,1.04,.2,g);hand.rotation.z=-.6;
 }else if(t==='curtain'){
  box(1.25,.055,.08,woodDark,0,1.9,0,g);for(const x of [-.42,.42]){const panel=roundedBox(.34,1.75,.12,.07,linen,x,1.0,0,g);panel.rotation.z=x<0?-.035:.035;for(let k=-1;k<=1;k++)box(.018,1.55,.015,mat(0xd9c7b0),x+k*.075,1, .075,g)}
 }else if(t==='cushion'){
  const c=sphere(.38,linen,0,.35,0,g,[1.2,.42,.9]);c.rotation.z=.12;
 }else{
  box(.9,.6,.7,wood,0,.35,0,g);addLegs(g,0,0,.8,.6,.4,woodDark)
 }
 // Soft contact shadow keeps furniture grounded in the room.
 const contact=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color:0x66513d,transparent:true,opacity:.105,depthWrite:false}));
 contact.rotation.x=-Math.PI/2;contact.position.set(0,.028,0);contact.scale.set(t==='bed'?1.55:1.05,t==='bed'?1.05:.72,1);contact.renderOrder=1;contact.raycast=()=>{};g.add(contact);
 const overrides=placement.colors||{};
 const roleColors={upholstery:overrides.upholstery,upholsteryTrim:overrides.upholstery,wood:overrides.wood,woodTrim:overrides.wood,fabric:overrides.fabric,clay:overrides.pottery};
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;const role=o.material?.userData?.finishRole,hex=role&&roleColors[role];if(hex){o.material=o.material.clone();const c=new THREE.Color(hex);if(role.endsWith('Trim'))c.multiplyScalar(.76);o.material.color.copy(c)}}});
 return g;
}
function disposeActive(){if(!active)return;try{if(active.raf)cancelAnimationFrame(active.raf);if(resizeObserver){resizeObserver.disconnect();resizeObserver=null}active.renderer.dispose();active.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const a=Array.isArray(o.material)?o.material:[o.material];a.forEach(m=>m.dispose())}})}catch(_){}active=null}
function getBridge(){return window.LoveRecordGames3D}
function stageState(){const b=getBridge();return b&&b.getSceneState?b.getSceneState():null}
function drawFurniture(state){const byId=new Map(state.catalog.map(x=>[x.id,x]));const groups=[];for(const p of state.placed){const item=byId.get(p.id);if(!item)continue;const g=createFurniture(item,p);const x=((Number(p.x??50)-50)/50)*3.45;const z=((50-Number(p.y??55))/50)*2.45;g.position.set(x,0,z);g.rotation.y=(Number(p.rotation)||0)*Math.PI/180;g.userData.uid=p.uid;g.userData.itemName=item.name;active.scene.add(g);groups.push(g)}active.furnitureGroups=groups}
function setSelected(uid){
 active.selectedUid=uid;
 active.furnitureName=active.furnitureGroups?.find(x=>String(x.userData.uid)===String(uid))?.userData.itemName||'已选家具';
 const el=active.host.querySelector('.lr3d-tools');if(el)el.remove();
 if(!uid||!active.state.decorMode)return;
 const placement=active.state.placed.find(x=>String(x.uid)===String(uid))||{};
 const tools=document.createElement('div');tools.className='lr3d-tools lr3d-customizer';
 const palettes={
  upholstery:[['奶油白','#e9dfcf'],['鼠尾草绿','#9baa88'],['雾霾蓝','#8fa8b5'],['豆沙粉','#d5aaa4'],['焦糖棕','#a77c60'],['橄榄绿','#78876b']],
  wood:[['浅橡木','#c69b70'],['蜂蜜木','#a87950'],['胡桃木','#76543f'],['白蜡木','#d7c4a6'],['烟熏木','#665044']],
  fabric:[['亚麻白','#f0e4d2'],['燕麦色','#d8c6ad'],['奶茶色','#c4a98e'],['浅粉','#e4c9c1'],['雾蓝','#c0d0d1']],
  pottery:[['陶土色','#c68e70'],['奶油白','#e6d9c7'],['鼠尾草绿','#9baa88'],['雾蓝','#9bb9c2']]
 };
 const labels={upholstery:'布艺 / 软包',wood:'木质',fabric:'织物',pottery:'陶器 / 装饰'};
 const selectedGroup=active.furnitureGroups?.find(x=>String(x.userData.uid)===String(uid));
 const availableRoles=new Set();
 selectedGroup?.traverse(o=>{const role=o.material?.userData?.finishRole;if(role==='upholstery'||role==='upholsteryTrim')availableRoles.add('upholstery');if(role==='wood'||role==='woodTrim')availableRoles.add('wood');if(role==='fabric')availableRoles.add('fabric');if(role==='clay')availableRoles.add('pottery')});
 if(!availableRoles.size)availableRoles.add('wood');
 const shownPalettes=Object.entries(palettes).filter(([role])=>availableRoles.has(role));
 tools.innerHTML=`<div class="lr3d-customizer-head"><b>家具装修 · ${active.furnitureName}</b><span>选择颜色后实时预览并自动保存</span></div>
  ${shownPalettes.map(([role,items])=>`<div class="lr3d-palette-row"><label>${labels[role]}</label><div class="lr3d-swatches">${items.map(([name,color])=>`<button type="button" class="lr3d-swatch ${placement.colors?.[role]===color?'is-active':''}" data-lr3d-color-role="${role}" data-lr3d-color="${color}" title="${name}" aria-label="${labels[role]}：${name}" style="--swatch:${color}"></button>`).join('')}</div></div>`).join('')}
  <div class="lr3d-rotation-row"><label for="lr3d-rotation">自由旋转</label><input id="lr3d-rotation" type="range" min="0" max="360" step="1" value="${Math.round(Number(placement.rotation)||0)}"><output>${Math.round(Number(placement.rotation)||0)}°</output></div>
  <div class="lr3d-tools-actions"><button type="button" data-lr3d-rotate="-15" aria-label="向左旋转">↶ 旋转</button><button type="button" data-lr3d-rotate="15" aria-label="向右旋转">旋转 ↷</button><button type="button" class="lr3d-remove" data-lr3d-remove>收回家具</button></div>`;
 active.host.appendChild(tools);
 const rotationSlider=tools.querySelector('#lr3d-rotation');
 const rotationOutput=tools.querySelector('output');
 const selectedObject=active.furnitureGroups?.find(x=>String(x.userData.uid)===String(uid));
 rotationSlider?.addEventListener('input',()=>{const degrees=Number(rotationSlider.value)||0;if(selectedObject)selectedObject.rotation.y=degrees*Math.PI/180;if(rotationOutput)rotationOutput.textContent=degrees+'°'});
 rotationSlider?.addEventListener('change',()=>{const p=active.state.placed.find(x=>String(x.uid)===String(uid));if(p)getBridge().updatePlacement(uid,p.x,p.y,Number(rotationSlider.value)||0)});
 tools.addEventListener('click',e=>{
  const color=e.target.closest('[data-lr3d-color-role]');
  if(color){getBridge().updateFurnitureColor(uid,color.dataset.lr3dColorRole,color.dataset.lr3dColor);const host=active.host;refreshHost(host);setSelected(uid);return}
  const r=e.target.closest('[data-lr3d-rotate]');
  if(r){const p=active.state.placed.find(x=>String(x.uid)===String(uid));if(p){const host=active.host;getBridge().updatePlacement(uid,p.x,p.y,(Number(p.rotation)||0)+Number(r.dataset.lr3dRotate));refreshHost(host);setSelected(uid)}return}
  if(e.target.closest('[data-lr3d-remove]'))getBridge().removePlacement(uid)
 });
}
function pickFurniture(ev){const rect=active.renderer.domElement.getBoundingClientRect();const p=new THREE.Vector2((ev.clientX-rect.left)/rect.width*2-1,-((ev.clientY-rect.top)/rect.height)*2+1);active.raycaster.setFromCamera(p,active.camera);const hits=active.raycaster.intersectObjects(active.furnitureGroups,true);for(const h of hits){let o=h.object;while(o&& !o.userData.uid)o=o.parent;if(o&&o.userData.uid)return o}return null}
function floorPoint(ev){const rect=active.renderer.domElement.getBoundingClientRect();const p=new THREE.Vector2((ev.clientX-rect.left)/rect.width*2-1,-((ev.clientY-rect.top)/rect.height)*2+1);active.raycaster.setFromCamera(p,active.camera);const hits=active.raycaster.intersectObject(active.floor);return hits[0]?.point||null}
function cameraOrbitStart(ev){
 const target=new THREE.Vector3(0,1.05,0);
 const offset=active.camera.position.clone().sub(target);
 const spherical=new THREE.Spherical().setFromVector3(offset);
 active.orbit={pointerId:ev.pointerId,lastX:ev.clientX,lastY:ev.clientY,target,spherical};
}
function pointerDown(ev){
 if(!active)return;
 active.pointers=active.pointers||new Map();
 active.pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
 const canvas=active.renderer.domElement;
 try{canvas.setPointerCapture(ev.pointerId)}catch(_){}
 if(active.pointers.size>=2){
  active.drag=null;active.orbit=null;
  const pts=[...active.pointers.values()];
  active.pinchDistance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
  ev.preventDefault();return;
 }
 const state=stageState();
 const obj=state?.decorMode?pickFurniture(ev):null;
 if(obj){
  active.drag={uid:obj.userData.uid,obj,pointerId:ev.pointerId};
  setSelected(obj.userData.uid);
 }else{
  if(state?.decorMode)setSelected(null);
  cameraOrbitStart(ev);
 }
 ev.preventDefault();
}
function pointerMove(ev){
 if(!active)return;
 if(active.pointers?.has(ev.pointerId))active.pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
 if(active.pointers?.size>=2){
  const pts=[...active.pointers.values()];
  const distance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
  if(active.pinchDistance>0){
   active.camera.zoom=Math.max(.72,Math.min(2.2,active.camera.zoom*distance/active.pinchDistance));
   active.camera.updateProjectionMatrix();
  }
  active.pinchDistance=distance;ev.preventDefault();return;
 }
 if(active.drag&&active.drag.pointerId===ev.pointerId){
  const p=floorPoint(ev);if(!p)return;
  const x=Math.max(4,Math.min(88,50+(p.x/3.45)*50));
  const y=Math.max(12,Math.min(84,50-(p.z/2.45)*50));
  active.drag.obj.position.x=p.x;active.drag.obj.position.z=p.z;active.drag.pending={x,y};
  ev.preventDefault();return;
 }
 if(active.orbit&&active.orbit.pointerId===ev.pointerId){
  const o=active.orbit,dx=ev.clientX-o.lastX,dy=ev.clientY-o.lastY;
  o.lastX=ev.clientX;o.lastY=ev.clientY;
  o.spherical.theta-=dx*.010;
  o.spherical.phi=Math.max(.22,Math.min(1.48,o.spherical.phi+dy*.007));
  active.camera.position.copy(o.target).add(new THREE.Vector3().setFromSpherical(o.spherical));
  active.camera.lookAt(o.target);ev.preventDefault();
 }
}
function pointerUp(ev){
 if(!active)return;
 if(active.drag&&active.drag.pointerId===ev.pointerId){
  const d=active.drag;active.drag=null;
  if(d.pending){
   const old=active.state.placed.find(x=>String(x.uid)===String(d.uid));
   getBridge().updatePlacement(d.uid,d.pending.x,d.pending.y,old?.rotation||0);
  }
 }
 active.pointers?.delete(ev.pointerId);
 if(active.pointers?.size<2)active.pinchDistance=0;
 if(active.orbit?.pointerId===ev.pointerId)active.orbit=null;
}
function addRoomDetails(room){/* Empty-room rule: no decorative furniture is pre-installed. Only architectural shell remains. */}

function renderLoop(){if(!active)return;active.raf=requestAnimationFrame(renderLoop);const t=performance.now()*.001;if(active.fire){active.fire.rotation.z=Math.sin(t*2.4)*.05;active.fire.scale.y=.96+Math.sin(t*5)*.07}if(active.fireLight)active.fireLight.intensity=1.15+Math.sin(t*7)*.22;if(active.curtains)active.curtains.forEach(c=>c.mesh.rotation.z=c.side*(.04+Math.sin(t*1.15+c.side)*.018));if(active.dust){for(let i=0;i<active.dust.length;i++){const d=active.dust[i];d.position.y=1.2+((t*.12+i*.53)%2.6);d.position.x=Math.sin(t*.5+i)*2.8}}if(active.lampLight)active.lampLight.intensity=active.state.lampOn?1.0+.07*Math.sin(t*2):.08;active.renderer.render(active.scene,active.camera)}
function initHost(host){if(!THREE||!host.isConnected)return;const state=stageState();if(!state)return;disposeActive();host.innerHTML='';const width=Math.max(300,host.clientWidth||360),height=Math.max(320,host.clientHeight||Math.round(window.innerHeight*.58));const scene=new THREE.Scene();scene.background=new THREE.Color(0xf4eadb);scene.fog=new THREE.Fog(0xf4eadb,15,28);const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,80);
 const cameraTarget=new THREE.Vector3(0,1.05,0);
 camera.position.set(10,11,12);camera.lookAt(cameraTarget);
 function fitCamera(){
  const aspect=Math.max(.45,(host.clientWidth||360)/Math.max(320,host.clientHeight||Math.round(window.innerHeight*.58)));
  const viewHeight=Math.max(10.8,8.8/aspect);
  camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;
  camera.top=viewHeight/2;camera.bottom=-viewHeight/2;
  camera.zoom=1.08;camera.updateProjectionMatrix();
 }
 fitCamera();const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));renderer.setSize(width,height,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.domElement.className='lr3d-canvas';renderer.domElement.setAttribute('aria-label',roomNames[state.room]+' 3D房间');host.appendChild(renderer.domElement);
 active={host,scene,camera,renderer,state,raycaster:new THREE.Raycaster(),floor:null,furnitureGroups:[],selectedUid:null,drag:null,fire:null,fireLight:null,curtains:[],dust:[],lampLight:null};
 scene.add(new THREE.HemisphereLight(0xfff7e9,0x887b68,1.9));const sun=new THREE.DirectionalLight(0xffe6c2,2.1);sun.position.set(-5,10,7);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;scene.add(sun);const fill=new THREE.DirectionalLight(0xe1eddf,.82);fill.position.set(5,6,-4);scene.add(fill);
 // Warm studio-like ground plane and soft ambient bounce.
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xeee3d2,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;scene.add(ground);
 const bounce=new THREE.PointLight(0xffe9c9,.32,14);bounce.position.set(0,1.2,3.5);scene.add(bounce);
 // Build the room shell and use its floor mesh as the drag plane.
 makeRoom(state.room);
 addRoomDetails(state.room);drawFurniture(state);
 active.lampLight=new THREE.PointLight(0xffd99c,state.lampOn?1:.08,7);active.lampLight.position.set(0,2.5,0);scene.add(active.lampLight);
 for(let i=0;i<16;i++){const d=sphere(.018,mat(0xfff6d8),Math.sin(i*12)*2.8,1.2+(i%5)*.42,Math.cos(i*8)*2.2,scene);d.material.transparent=true;d.material.opacity=.38;active.dust.push(d)}
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointercancel',pointerUp);renderer.domElement.addEventListener('lostpointercapture',pointerUp);
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=Math.max(.72,Math.min(2.2,camera.zoom*(e.deltaY>0?.94:1.06)));camera.updateProjectionMatrix()},{passive:false});
 const hint=document.createElement('div');hint.className='lr3d-hint';hint.textContent=state.decorMode?'拖动空白处旋转视角 · 拖动家具自由摆放 · 选中后调色与旋转':'单指拖动旋转视角 · 双指缩放 · 进入装修模式摆放家具';host.appendChild(hint);
 if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(()=>{if(!active||active.host!==host)return;const w=Math.max(300,host.clientWidth),h=Math.max(320,host.clientHeight);renderer.setSize(w,h,false);fitCamera()});resizeObserver.observe(host)}
 renderLoop();
}
function refreshHost(host){const state=stageState();if(!state)return;initHost(host)}
function scan(){const hosts=[...document.querySelectorAll('[data-lr3d-viewport]')];const visible=hosts.find(x=>x.offsetWidth>0&&x.offsetHeight>0);if(!visible)return;if(!THREE){loadThree().then(t=>{THREE=t;scan()}).catch(err=>{visible.innerHTML='<div class="lr3d-error"><b>3D 场景暂时无法载入</b><span>请检查网络连接后刷新页面。农场存档不受影响。</span></div>';console.warn('[LR 3D]',err)});return}if(active?.host===visible){const st=stageState();if(st&&JSON.stringify([st.owner,st.room,st.decorMode,st.placed])!==JSON.stringify([active.state.owner,active.state.room,active.state.decorMode,active.state.placed])){try{initHost(visible)}catch(err){visible.innerHTML='<div class="lr3d-error"><b>3D 场景渲染失败</b><span>请刷新页面重试。农场存档不会受影响。</span></div>';console.warn('[LR 3D render]',err)}}return}try{initHost(visible)}catch(err){visible.innerHTML='<div class="lr3d-error"><b>当前设备暂不支持 3D 场景</b><span>请更新浏览器或检查 WebGL 设置。农场存档不会受影响。</span></div>';console.warn('[LR 3D render]',err)}}
function injectStyles(){if(document.getElementById('lr3d-style'))return;const s=document.createElement('style');s.id='lr3d-style';s.textContent=`.v21-room-stage{width:100%;margin:16px 0 18px;padding:10px;border-radius:28px;background:linear-gradient(145deg,#fffaf0,#e9dfca);box-shadow:0 12px 32px rgba(103,78,51,.10),inset 0 0 0 1px rgba(255,255,255,.8);overflow:hidden}.lr3d-viewport{position:relative;width:100%;aspect-ratio:1.18;min-height:280px;border-radius:21px;overflow:hidden;background:radial-gradient(ellipse at 50% 28%,#fff8e9 0,#e8ddca 100%);touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:inset 0 0 0 1px #fff9ed,0 12px 30px rgba(99,72,45,.10)}.lr3d-canvas{display:block;width:100%;height:100%;touch-action:none;outline:none;filter:saturate(1.04) contrast(1.015)}.lr3d-loading,.lr3d-error{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#76664f;background:linear-gradient(135deg,#f7efdf,#e8e8d8);font-family:inherit}.lr3d-loading-mark{font-size:34px;color:#8d9c78}.lr3d-loading small,.lr3d-error span{font-size:12px;color:#9b8c78}.lr3d-caption{display:flex;justify-content:space-between;padding:9px 5px 1px;color:#9b8c78;font-size:10px;letter-spacing:.12em}.lr3d-hint{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);max-width:90%;white-space:nowrap;padding:7px 12px;border-radius:99px;background:rgba(255,250,240,.88);color:#85745e;font-size:10px;box-shadow:0 2px 12px #77634a20;pointer-events:none}.lr3d-tools{position:absolute;right:12px;top:12px;display:flex;gap:6px;z-index:4}.lr3d-tools button{border:1px solid #d8c9b3;border-radius:18px;background:rgba(255,250,240,.94);color:#6f795e;padding:8px 12px;font:inherit;box-shadow:0 3px 12px #5c4a3218}.lr3d-tools .lr3d-remove{color:#a46d5a}.lr3d-error{padding:24px;text-align:center}.house-page .lr3d-caption{letter-spacing:.08em}
 .house-page{width:100%;max-width:none}
 .house-page .v21-room-stage{width:calc(100% + 28px);margin:18px -14px 22px;padding:8px;border-radius:24px;background:linear-gradient(145deg,#fffaf0,#e9dfca);box-shadow:0 14px 34px rgba(103,78,51,.12),inset 0 0 0 1px rgba(255,255,255,.88)}
 .house-page .lr3d-viewport{width:100%;height:clamp(420px,68svh,720px);min-height:420px;aspect-ratio:auto;border-radius:19px}
 .house-page .lr3d-canvas{width:100%;height:100%}
 .lr3d-customizer{left:12px;right:12px;top:12px;max-width:min(540px,calc(100% - 24px));padding:12px;border-radius:18px;background:rgba(255,250,241,.96);box-shadow:0 8px 30px rgba(74,55,35,.18);display:flex;flex-direction:column;gap:9px;max-height:calc(100% - 24px);overflow:auto}
 .lr3d-customizer-head{display:flex;flex-direction:column;gap:2px;color:#655644;font-size:12px}
 .lr3d-customizer-head span{font-size:10px;color:#998a76}
 .lr3d-palette-row{display:flex;align-items:center;gap:10px}
 .lr3d-palette-row label{width:78px;flex:0 0 78px;color:#897861;font-size:11px}
 .lr3d-swatches{display:flex;gap:7px;flex-wrap:wrap}
 .lr3d-swatch{width:27px;height:27px;border-radius:50%;border:2px solid rgba(255,255,255,.95);background:var(--swatch);box-shadow:0 0 0 1px #d6c8b3;min-width:27px;padding:0}
 .lr3d-swatch.is-active{box-shadow:0 0 0 2px #829171,0 0 0 4px #fff}
 .lr3d-tools-actions{display:flex;gap:6px;flex-wrap:wrap}
 .lr3d-tools-actions button{font-size:11px;padding:7px 10px}
 .lr3d-tools-actions .lr3d-remove{margin-left:auto}
 .lr3d-rotation-row{display:flex;align-items:center;gap:9px;color:#897861;font-size:11px}
 .lr3d-rotation-row label{white-space:nowrap}
 .lr3d-rotation-row input{flex:1;min-width:80px;accent-color:#829171}
 .lr3d-rotation-row output{min-width:36px;text-align:right;font-variant-numeric:tabular-nums}
 .house-decor-panel{padding:22px;border-radius:26px;background:linear-gradient(145deg,#fffdf7,#f8f0e2);border:1px solid #e4d8c5}
 .house-decor-panel .house-section-title{display:flex;align-items:center;justify-content:space-between;gap:12px}
 .house-decor-panel .house-section-title>div{display:flex;flex-direction:column;gap:5px}
 .house-decor-panel .house-section-title small{font-size:11px;color:#9b8c78;font-weight:400}
 .house-decor-summary{display:flex;justify-content:space-between;gap:12px;padding:13px 15px;border-radius:14px;background:#f0eadc;color:#8c806e;font-size:12px}
 .house-page .furniture-mega-shop{margin-top:18px}
 @media(max-width:600px){.house-page .v21-room-stage{width:calc(100% + 20px);margin-left:-10px;margin-right:-10px;padding:6px}.house-page .lr3d-viewport{height:clamp(420px,68svh,620px);min-height:420px}.lr3d-customizer{left:8px;right:8px;top:8px;max-width:calc(100% - 16px);padding:10px}.lr3d-palette-row label{width:68px;flex-basis:68px}}

 /* V25: portrait-first immersive home and bottom-sheet furniture catalogue */
 #lr-games .gscroll:has(.house-page){overflow:hidden!important;padding:0!important;max-width:none!important}
 #lr-games .house-page{height:100%;min-height:0;display:flex;flex-direction:column;gap:8px;overflow:hidden;padding:8px 12px 0;max-width:none}
 #lr-games .house-intro{flex:none;margin:0;padding:0 6px}
 #lr-games .house-intro .house-back{display:none}
 #lr-games .house-intro .house-kicker{font-size:8px;letter-spacing:.18em;margin:0 0 2px}
 #lr-games .house-intro h1{font-size:22px;line-height:1.1;margin:0}
 #lr-games .house-intro p{font-size:10px;margin:2px 0 0}
 #lr-games .room-tabs{flex:none;margin:0;padding:4px;gap:4px;border-radius:18px}
 #lr-games .room-tabs button{padding:8px 4px;font-size:11px}
 #lr-games .house-page .v21-room-stage{position:relative;flex:1 1 auto;min-height:240px;height:auto;width:calc(100% + 24px);margin:0 -12px;padding:6px;border-radius:23px;display:flex;flex-direction:column;overflow:hidden}
 #lr-games .house-page .lr3d-viewport{flex:1 1 auto;width:100%;height:100%;min-height:0;max-height:none;aspect-ratio:auto;border-radius:18px}
 #lr-games .house-page .lr3d-caption{flex:none;padding:6px 4px 2px;font-size:9px}
 #lr-games .house-page .lr3d-hint{bottom:35px;font-size:9px;max-width:94%;white-space:normal;text-align:center}
 #lr-games .lr3d-stage-tools{position:absolute;z-index:5;top:12px;left:12px;right:12px;display:flex;justify-content:space-between;pointer-events:none}
 #lr-games .lr3d-stage-tools button{pointer-events:auto;border:1px solid #e2d5c2;border-radius:99px;padding:8px 13px;background:rgba(255,251,243,.92);box-shadow:0 4px 15px #66503820;font-size:11px}
 #lr-games .house-controls{flex:none;margin:0!important;padding:8px 12px!important;border-radius:16px!important;box-shadow:none!important}
 #lr-games .house-controls .house-section-title{gap:8px}
 #lr-games .house-controls .house-section-title b{font-size:12px}
 #lr-games .house-controls .house-section-title small{font-size:9px}
 #lr-games .house-controls .house-decor-summary{font-size:10px}
 #lr-games .house-memory{display:none}
 #lr-games .furniture-shop-backdrop{position:fixed;inset:62px 0 76px;background:rgba(49,42,34,.28);backdrop-filter:blur(3px);z-index:100105;opacity:0;pointer-events:none;transition:opacity .22s}
 #lr-games .furniture-shop-backdrop.is-open{opacity:1;pointer-events:auto}
 #lr-games .furniture-shop-drawer{position:fixed;z-index:100106;left:0;right:0;bottom:calc(65px + env(safe-area-inset-bottom));height:min(62svh,610px);display:flex;flex-direction:column;padding:8px 14px 12px;background:linear-gradient(180deg,#fffdf8,#f7efe3);border:1px solid #e6dac8;border-bottom:0;border-radius:24px 24px 0 0;box-shadow:0 -12px 35px rgba(73,55,35,.18);transform:translateY(110%);transition:transform .28s cubic-bezier(.2,.8,.2,1);pointer-events:none}
 #lr-games .furniture-shop-drawer.is-open{transform:translateY(0);pointer-events:auto}
 #lr-games .furniture-drawer-grip{width:38px;height:4px;border-radius:99px;background:#d9cbb9;margin:0 auto 8px;flex:none}
 #lr-games .furniture-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex:none;padding:0 2px 8px}
 #lr-games .furniture-drawer-head>div{display:flex;flex-direction:column;gap:2px}
 #lr-games .furniture-drawer-head b{font:600 17px Georgia,'Noto Serif SC',serif;color:#5c4f42}
 #lr-games .furniture-drawer-head small{font-size:10px;color:#9b8c78}
 #lr-games .furniture-drawer-close{width:34px;height:34px;border-radius:50%!important;padding:0!important;font-size:23px!important;line-height:1;background:#f5eee3!important;border:0!important}
 #lr-games .furniture-category-tabs{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none;flex:none;padding:2px 0 10px}
 #lr-games .furniture-category-tabs::-webkit-scrollbar{display:none}
 #lr-games .furniture-category-tabs button{flex:none;padding:7px 13px!important;border-radius:99px!important;font-size:10px!important;background:#f4eee4!important;border:1px solid #e7dccd!important;white-space:nowrap}
 #lr-games .furniture-category-tabs button.active{background:#59604f!important;color:#fffaf0!important;border-color:#59604f!important}
 #lr-games .furniture-drawer-grid{overflow-y:auto;overscroll-behavior:contain;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 0 18px;align-content:start}
 #lr-games .furniture-drawer-grid .furniture-product-card{min-width:0;border-radius:15px;background:#fffaf2;border:1px solid #e9dfd1;overflow:hidden;box-shadow:0 3px 12px #765b3510}
 #lr-games .furniture-drawer-grid .furniture-product-art{height:84px;display:grid;place-items:center;background:linear-gradient(145deg,#f5efdf,#eae5d8);border-bottom:1px solid #e9dfd1}
 #lr-games .furniture-drawer-grid .furniture-product-art svg{width:86%;height:78px}
 #lr-games .furniture-drawer-grid .furniture-product-copy{padding:7px 7px 8px;display:flex;flex-direction:column;gap:5px}
 #lr-games .furniture-drawer-grid .furniture-product-copy>b{font-size:10px;line-height:1.4;min-height:27px}
 #lr-games .furniture-drawer-grid .furniture-product-copy>small{font-size:8px;line-height:1.4;color:#988875;min-height:22px}
 #lr-games .furniture-drawer-grid .furniture-product-buy{display:flex;align-items:center;justify-content:space-between;gap:3px}
 #lr-games .furniture-drawer-grid .furniture-product-buy strong{font-size:9px;color:#7d8a6b;white-space:nowrap}
 #lr-games .furniture-drawer-grid .furniture-product-buy button{font-size:9px!important;padding:5px 8px!important;border-radius:99px!important}
 #lr-games .furniture-drawer-grid .furniture-product-copy em{font-size:8px;color:#a49480;font-style:normal}
 @media(min-width:700px){#lr-games .house-page{max-width:620px;margin:0 auto}#lr-games .furniture-shop-drawer{left:50%;right:auto;width:min(620px,100%);transform:translate(-50%,110%)}#lr-games .furniture-shop-drawer.is-open{transform:translate(-50%,0)}}

 `;document.head.appendChild(s)}
function start(){injectStyles();if(observer)observer.disconnect();observer=new MutationObserver(()=>{if(document.querySelector('[data-lr3d-viewport]'))scan();else if(active)disposeActive()});observer.observe(document.body,{childList:true,subtree:true});scan();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scan()});
})();
