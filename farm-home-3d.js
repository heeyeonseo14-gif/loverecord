/* LOVE RECORD V27 · Three.js portrait 3D home with full 360° orbit */
(function(){
'use strict';
const THREE_CDN='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
const roomNames={living:'客厅',bedroom:'卧室',kitchen:'厨房',balcony:'阳台'};
const palette={wall:0xf0e4d1,wallSide:0xe2d5c1,floor:0xc99e72,wood:0x9b704e,woodLight:0xc69b70,sage:0x9baa88,sageDark:0x71866b,linen:0xf4eadb,cream:0xfff8ec,brass:0xb58b50,glass:0xb9d8d5,leaf:0x718b61,clay:0xc88e70};
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
 const backWall=new THREE.Group(),leftWall=new THREE.Group();g.add(backWall,leftWall);active.roomWalls={back:backWall,left:leftWall};
 const floorMat=new THREE.MeshStandardMaterial({color:room==='balcony'?0xf0dfc5:0xffffff,map:woodTexture(),roughness:.78}), wallMat=mat(palette.wall,.96), sideMat=mat(palette.wallSide,.96), trim=mat(0xcdb797,.78), plank=mat(0xb98d66,.8);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(8,6),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=.02;floor.receiveShadow=true;g.add(floor);active.floor=floor;
 // parquet seams and a warm border
 for(let z=-2.65;z<=2.7;z+=.42)addLine([[-3.9,.035,z],[3.9,.035,z]],new THREE.LineBasicMaterial({color:0xb78c68,transparent:true,opacity:.22}),g);
 for(let x=-3.7;x<=3.7;x+=1.15)addLine([[x,.036,-2.85],[x,.036,2.85]],new THREE.LineBasicMaterial({color:0xa97d59,transparent:true,opacity:.13}),g);
 // back and left walls, deliberately open toward the viewer
 box(8,5.2,.16,wallMat,0,2.62,-3.02,backWall);box(.16,5.2,6,sideMat,-4.02,2.62,0,leftWall);
 box(8,.16,.22,trim,0,.12,-2.94,backWall);box(.22,.16,6,trim,-3.94,.12,0,leftWall);
 // wall panel moulding
 for(let x=-3.35;x<=3.3;x+=1.1){box(.035,2.5,.035,trim,x,1.45,-2.91,backWall);box(.9,.035,.035,trim,x+.45,2.65,-2.91,backWall);}
 // window on back wall, panes and sill
 const winX=-2.15, winY=2.05, winZ=-2.89;
 box(1.45,1.65,.09,mat(0x9a7858),winX,winY,winZ,backWall);box(1.32,1.52,.08,new THREE.MeshPhysicalMaterial({color:palette.glass,roughness:.16,metalness:.04,transmission:.08,transparent:true,opacity:.94}),winX,winY,winZ+.055,backWall);
 box(.075,1.56,.12,mat(0xfff8ec),winX,winY,winZ+.13,backWall);box(1.35,.075,.12,mat(0xfff8ec),winX,winY,winZ+.13,backWall);
 box(.07,1.55,.13,mat(0xfff8ec),winX,winY,winZ+.14,backWall);box(1.35,.07,.13,mat(0xfff8ec),winX,winY,winZ+.14,backWall);
 box(1.65,.12,.32,mat(0xc69b70),winX,1.2,winZ+.18,backWall);
 box(.045,1.48,.12,mat(0xfff8ec),winX,winY,winZ+.2,backWall);box(1.3,.045,.12,mat(0xfff8ec),winX,winY,winZ+.2,backWall);
 // curtains
 for(const x of [winX-.83,winX+.83]){const c=box(.28,1.85,.12,mat(0xe9dcc9),x,winY,winZ+.22,backWall);c.rotation.z=x<winX?-.04:.04;active.curtains=active.curtains||[];active.curtains.push({mesh:c,side:x<winX?-1:1});}
 // Fine architectural trim: a proper skirting board, inset wall panels and window hardware.
 box(8,.24,.24,mat(0xd5c1a4),0,.22,-2.88,backWall);
 box(.24,.24,6,mat(0xd5c1a4),-3.88,.22,0,leftWall);
 for(let x=-3.35;x<=3.3;x+=1.1){
  box(.82,.025,.025,mat(0xe8d9c1),x+.45,1.02,-2.91,backWall);
  box(.82,.025,.025,mat(0xe8d9c1),x+.45,2.52,-2.91,backWall);
 }
 // Small brass curtain rail and finials.
 cylinder(.035,.035,1.95,mat(0xb58b50,.35,.55),winX,2.98,winZ+.3,backWall,12).rotation.z=Math.PI/2;
 for(const x of [winX-.98,winX+.98])sphere(.055,mat(0xb58b50,.35,.55),x,2.98,winZ+.3,backWall);
 // Window sill detail and a subtle outside view, kept crisp rather than hazy.
 box(1.18,.025,.035,mat(0xfff8ec),winX,1.32,winZ+.24,backWall);
 // room-specific fixed architectural features
 if(room==='living'){
  // fireplace on back wall
  box(1.55,1.8,.36,mat(0xe3d2b8),1.9,1.25,-2.72,backWall);box(1.12,1.12,.12,mat(0x76503b),1.9,1.18,-2.48,backWall);box(1.7,.16,.5,mat(0xc49a72),1.9,2.2,-2.62,backWall);
  box(.9,.1,.1,mat(palette.brass),1.9,.64,-2.39,backWall);
  const fire=new THREE.Group();fire.position.set(1.9,.95,-2.35);backWall.add(fire);const fm= new THREE.MeshStandardMaterial({color:0xffa84b,emissive:0xf36a20,emissiveIntensity:1.3,roughness:.5});const f1=new THREE.Mesh(new THREE.ConeGeometry(.25,.72,7),fm);f1.position.y=.36;fire.add(f1);const f2=new THREE.Mesh(new THREE.ConeGeometry(.14,.46,7),mat(0xffd27a));f2.position.set(.08,.24,.03);fire.add(f2);active.fire=fire;const glow=new THREE.PointLight(0xff8b38,1.35,4.8);glow.position.set(1.9,1.05,-1.9);g.add(glow);active.fireLight=glow;
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
 const finish=(color,role,roughness=.82)=>{const m=mat(color,roughness);m.userData.finishRole=role;return m};
 const wood=finish(0xb88a60,'wood',.72),woodDark=finish(0x805a3d,'woodTrim',.78),
  linen=finish(0xf0e4d2,'fabric',.96),sage=finish(0x9baa88,'upholstery',.9),
  sageDark=finish(0x71866b,'upholsteryTrim',.88),brass=mat(0xb58b50,.32,.62),
  glass=new THREE.MeshPhysicalMaterial({color:0xd3e5df,roughness:.18,metalness:.04,transmission:.12,transparent:true,opacity:.9}),
  clay=finish(0xc68e70,'clay',.8),cream=finish(0xf8efdf,'fabric',.95),
  blush=finish(0xd9aaa0,'upholstery',.9),dark=mat(0x574538,.8);
 const detail=(w,h,d,...args)=>{let radius,material,x,y,z,rx=0,ry=0,rz=0;if(typeof args[0]==='number'){[radius,material,x,y,z,rx=0,ry=0,rz=0]=args}else{[material,x,y,z,rx=0,ry=0,rz=0]=args;radius=Math.min(.055,w*.16,h*.18,d*.18)}const o=roundedBox(w,h,d,Math.min(radius,w*.22,h*.22,d*.22),material,x,y,z,g);o.rotation.set(rx,ry,rz);return o};
 const leg=(x,z,h=.34,material=woodDark)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,h,10),material);m.position.set(x,h/2,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m};
 const knob=(x,y,z)=>{sphere(.035,brass,x,y,z,g,[1,1,.65]);};
 const book=(x,y,z,color=0x9baa88,angle=0)=>{const b=detail(.16,.27,.2,mat(color,.9),x,y,z,0,0,angle);detail(.012,.22,.205,mat(0xf3e8d6),x-.065,y,z+.004,0,0,angle);return b};
 const flowerPot=(x,y,z,scale=1)=>{const pot=cylinder(.16*scale,.21*scale,.25*scale,clay,x,y+.125*scale,z,g,16);cylinder(.17*scale,.17*scale,.045*scale,mat(0xe0bda0),x,y+.25*scale,z,g,16);cylinder(.13*scale,.13*scale,.025*scale,mat(0x594936),x,y+.27*scale,z,g,14);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const leaf=sphere(.13*scale,sageDark,x+Math.cos(a)*.13*scale,y+.42*scale+Math.sin(i*2)*.035*scale,z+Math.sin(a)*.13*scale,g,[.55,1.5,.32]);leaf.rotation.z=Math.cos(a)*.55;leaf.rotation.x=Math.sin(a)*.45}return pot};
 const t=item.type;
 if(['sofa','armchair'].includes(t)){
  const w=t==='sofa'?2.22:1.34,d=t==='sofa'?1.02:.94,seatW=t==='sofa'?.62:.88;
  const upholstery=item.id==='armchair'?cream:sage;
  const trim=item.id==='armchair'?woodDark:sageDark;
  detail(w,.32,d,woodDark,0,.42,0);
  detail(w-.12,.16,d-.13,upholstery,0,.59,.02);
  // Separate plump seat cushions, each with rounded piping.
  const count=t==='sofa'?3:1;
  for(let i=0;i<count;i++){
   const x=(i-(count-1)/2)*seatW;
   detail(seatW-.045,.22,.69,upholstery,x,.76,.09);
   detail(seatW-.11,.025,.58,linen,x,.885,.08);
   for(let k of [-1,1])sphere(.018,woodDark,x+k*(seatW*.36),.72,-.24,g);
  }
  // Soft, segmented back cushions and rolled arms.
  for(let i=0;i<count;i++){const x=(i-(count-1)/2)*seatW;detail(seatW-.035,.58,.2,trim,x,.98,-.36, -.08,0,0);detail(seatW-.12,.43,.13,upholstery,x,.99,-.47,-.08,0,0)}
  for(const side of [-1,1]){
   const x=side*(w/2-.12);
   detail(.25,.64,d,.12,trim,x,.78,0);
   detail(.18,.48,.74,.09,upholstery,x,.82,-.05,0,0);
   // Piping along arm top.
   const pipe=cylinder(.025,.025,d*.72,linen,x,1.13,0,g,10);pipe.rotation.x=Math.PI/2;
   const legX=side*(w/2-.2);for(const z of [-d*.34,d*.34])leg(legX,z,.28,woodDark);
  }
  // Decorative embroidered cushions with tiny floral tufts.
  const pillowXs=t==='sofa'?[-.72,.72]:[0];
  for(let i=0;i<pillowXs.length;i++){const x=pillowXs[i],p=detail(.34,.34,.17,i?blush:cream,x,.99,-.28,0,0,(i?-.12:.12));for(const dx of [-.08,0,.08])sphere(.018,brass,x+dx,1.0,-.38,g)}
  // Upholstery seam and lower wooden plinth.
  detail(w-.16,.045,.055,wood,0,.48,d*.48);
 }else if(['coffee','dining','bistro','island'].includes(t)){
  const w=t==='coffee'?1.45:t==='dining'?1.95:t==='bistro'?.98:1.82,d=t==='coffee'?.9:t==='dining'?1.2:t==='bistro'?.98:1.0;
  if(t==='bistro'){
   const top=cylinder(.52,.52,.13,wood,0,.91,0,g,40);cylinder(.43,.43,.025,mat(0xd8b68d),0,.99,0,g,40);
   cylinder(.11,.15,.72,woodDark,0,.48,0,g,18);cylinder(.43,.48,.09,woodDark,0,.07,0,g,28);
   for(let i=0;i<8;i++){const a=i*Math.PI/4;const rod=cylinder(.012,.012,.42,brass,Math.cos(a)*.23,.52,Math.sin(a)*.23,g,8);rod.rotation.z=Math.cos(a)*.12}
  }else{
   detail(w,.16,d,.055,wood,0,.91,0);
   detail(w-.08,.025,d-.08,.015,mat(0xe2c49d),0,1.0,0);
   for(const x of [-w*.34,w*.34])for(const z of [-d*.34,d*.34])leg(x,z,.78,woodDark);
   // apron and drawer fronts
   detail(w-.18,.2,.08,woodDark,0,.75,-d*.38);
   detail(w*.42,.12,.035,wood,0,.75,-d*.43);
   knob(0,.76,-d*.47);
   if(t==='island'){detail(w-.12,.24,.1,mat(0xeee4d3),0,.62,-d*.42);for(let x of [-.52,.52])knob(x,.62,-d*.48)}
  }
  // Tea service, a little book and a flower vase make the table feel lived in.
  if(t!=='island'){
   const cup=cylinder(.075,.09,.12,cream,-.28,1.08,-.1,g,20);cylinder(.06,.06,.018,mat(0x9baa88),-.28,1.15,-.1,g,18);
   const handle=new THREE.Mesh(new THREE.TorusGeometry(.045,.012,8,16),cream);handle.position.set(-.19,1.1,-.1);g.add(handle);
   book(.28,1.12,.13,0xb68b69,-.08);
   if(t==='dining')flowerPot(.58,1.0,.22,.7);
  }
 }else if(['bookcase','shelf','cupboard','sideboard','wardrobe','dresser','vanity'].includes(t)){
  const w=t==='wardrobe'?1.72:t==='bookcase'?1.35:t==='shelf'?1.2:1.48,h=t==='wardrobe'?2.25:t==='bookcase'?2.0:t==='shelf'?1.65:1.18,d=t==='wardrobe'?.62:.52;
  detail(w,h,d,.08,woodDark,0,h/2,0);detail(w-.1,h-.1,d-.05,.05,wood,0,h/2,.035);
  if(['bookcase','shelf'].includes(t)){
   for(let y=.42;y<h-.16;y+=.46){detail(w-.16,.055,d-.08,.02,woodDark,0,y,.09);for(let i=0;i<3;i++){const x=-w*.34+i*.29;book(x,y+.18,.03,[0xa96f5c,0x87966f,0xd3b28c,0x8b9dad,0xceb49a][(i+Math.round(y*10))%5],(i%2?-.08:.05))}}
   flowerPot(.35,h-.42,.06,.48);
  }else if(t==='wardrobe'){
   for(const x of [-.42,.42]){detail(.72,h-.22,.035,mat(0xcba77e),x,h/2,-d*.52);detail(.64,h-.36,.025,wood,x,h/2,-d*.55);for(let y=.65;y<h-.2;y+=.38)detail(.58,.018,.018,mat(0xe0c5a1),x,y,-d*.58);knob(x+(x<0?.23:-.23),h*.52,-d*.62)}
   detail(w+.05,.08,d+.04,mat(0xd6b48b),0,h+.02,0);
  }else{
   const drawers=t==='dresser'?3:2;
   for(let i=0;i<drawers;i++){const y=.34+i*.32;detail(w-.18,.26,.045,mat(i%2?0xd6b48c:0xc89c70),0,y,-d*.55);detail(.24,.018,.018,brass,0,y,-d*.59);knob(0,y,-d*.62)}
   if(t==='vanity'){const frame=new THREE.Mesh(new THREE.TorusGeometry(.42,.065,10,40),woodDark);frame.position.set(0,h+.52,-.02);g.add(frame);const mirror=new THREE.Mesh(new THREE.CircleGeometry(.38,40),glass);mirror.position.set(0,h+.52,.02);g.add(mirror);detail(.12,.06,.05,brass,0,h+.08,-d*.5)}
   for(const x of [-w*.36,w*.36])leg(x,.12,.18,woodDark);
  }
  if(t==='sideboard'||t==='cupboard'){for(const x of [-.48,.48]){detail(.42,.62,.04,mat(0xd1a77c),x,.64,-d*.55);knob(x,.65,-d*.6)}}
 }else if(t==='bed'){
  detail(2.22,.32,2.72,.12,woodDark,0,.31,0);
  detail(2.16,.22,2.62,.1,wood,0,.55,0);
  // Upholstered headboard with framed inset panels.
  detail(2.28,1.35,.2,.1,woodDark,0,1.02,-1.28);
  detail(2.12,1.2,.12,.08,cream,0,1.03,-1.39);
  for(let x of [-.68,.68])detail(.95,.84,.035,.05,mat(0xe6d7c3),x,1.08,-1.47);
  // Layered mattress, duvet, folded throw and pillows.
  detail(2.05,.28,2.5,.12,cream,0,.78,0);
  detail(2.02,.19,1.78,.1,linen,0,.96,.3);
  detail(2.04,.12,.55,.08,sage,0,.91,1.15);
  for(let x of [-.56,.56]){detail(.78,.2,.48,.12,cream,x,1.1,-.77);detail(.68,.045,.38,.06,mat(0xfaf4e9),x,1.22,-.78);for(let dx of [-.16,0,.16])sphere(.014,wood,x+dx,1.2,-.98,g)}
  // Quilted seams and little tassels.
  for(let x of [-.65,-.32,0,.32,.65]){const seam=box(.012,.012,1.5,mat(0xd7c8b5),x,1.065,.35,g);seam.rotation.y=.02}
  for(let x of [-.9,.9])for(let z of [-1.12,1.12])leg(x,z,.22,woodDark);
 }else if(['lamp','lantern'].includes(t)){
  cylinder(.22,.27,.14,woodDark,0,.08,0,g,28);cylinder(.055,.055,.78,brass,0,.5,0,g,16);
  if(t==='lamp'){
   const shade=new THREE.Mesh(new THREE.CylinderGeometry(.18,.36,.48,32,1,true),linen);shade.position.y=1.1;shade.castShadow=true;g.add(shade);
   cylinder(.18,.18,.035,cream,0,.86,0,g,28);
   for(let i=0;i<18;i++){const a=i*Math.PI*2/18;const rib=box(.012,.43,.012,mat(0xd8c8b5),Math.cos(a)*.27,1.1,Math.sin(a)*.27,g);rib.rotation.y=-a}
   sphere(.07,mat(0xffe3a4),0,.83,0,g);
  }else{
   roundedBox(.42,.48,.42,.06,glass,0,1.0,0,g);
   for(let x of [-.22,.22])box(.035,.56,.035,brass,x,1,0,g);
   for(let z of [-.22,.22])box(.035,.56,.035,brass,0,1,z,g);
   box(.46,.045,.46,brass,0,.74,0,g);box(.46,.045,.46,brass,0,1.25,0,g);
   const flame=new THREE.Mesh(new THREE.ConeGeometry(.09,.24,9),mat(0xffc56e));flame.position.set(0,.98,0);g.add(flame);
  }
 }else if(t==='plant'){flowerPot(0,0,0,1.2)
 }else if(t==='flowers'){
  for(let y of [.48,1.05,1.62]){detail(1.0,.075,.38,.035,wood,0,y,0);for(let x of [-.4,.4])leg(x,0,.4,woodDark)}
  for(let i=0;i<3;i++){const x=(i-1)*.34;flowerPot(x,.1,.02,.55);for(let j=0;j<5;j++){const a=j*Math.PI*2/5;const petal=sphere(.075,mat([0xe7b5a9,0xf0d8a0,0xd7a9bd][i]),x+Math.cos(a)*.12,.83+i*.57+Math.sin(j)*.025,.02+Math.sin(a)*.12,g,[.8,1,.55]);}sphere(.04,mat(0xd7ad62),x,.83+i*.57,.02,g)}
 }else if(t==='rug'){
  detail(2.15,.06,1.58,.07,mat(0xc9b393),0,.045,0);
  detail(2.03,.025,1.46,.045,mat(0xeadcc7),0,.085,0);
  // Woven central medallion and stitched border.
  detail(1.28,.018,.82,.025,mat(0xd6c4a9),0,.104,0);
  for(let x of [-.93,.93])detail(.035,.018,1.22,.012,mat(0xa98b6c),x,.12,0);
  for(let z of [-.66,.66])detail(1.9,.018,.035,.012,mat(0xa98b6c),0,.12,z);
  for(let x of [-.55,-.28,0,.28,.55]){const d=detail(.035,.018,.035,.015,mat(0x9baa88),x,.13,0);d.rotation.y=Math.PI/4}
  for(let x of [-.9,-.6,-.3,0,.3,.6,.9])for(let z of [-.82,.82]){const tassel=box(.045,.025,.16,linen,x,.05,z,g);tassel.rotation.y=.12}
 }else if(['chair','chairbal'].includes(t)){
  const woven=t==='chairbal';
  detail(.82,.16,.78,.07,woven?wood:cream,0,.72,0);
  detail(.82,.78,.14,.08,wood,0,1.08,-.34);
  if(woven){for(let y=.82;y<1.42;y+=.11){const r=box(.78,.025,.035,mat(0xb58a61),0,y,-.42,g);for(let x of [-.34,-.17,0,.17,.34]){const v=box(.025,.58,.035,mat(0xd1ad82),x,1.1,-.42,g);v.rotation.z=(x||.01)*.15}}}
  else{detail(.68,.08,.57,.04,sage,0,.84,0);for(let x of [-.29,.29])detail(.045,.45,.045,.02,woodDark,x,1.12,-.32)}
  for(let x of [-.34,.34])for(let z of [-.3,.3])leg(x,z,.7,woodDark);
 }else if(t==='stove'){
  detail(1.32,.98,.82,.1,cream,0,.58,0);
  detail(1.38,.12,.88,.05,mat(0xf9f2e7),0,1.12,0);
  detail(.82,.56,.06,.05,mat(0x8d6d56),0,.62,-.44);
  detail(.72,.44,.025,.035,glass,0,.62,-.48);
  detail(.64,.06,.04,.02,brass,0,.35,-.51);
  for(let x of [-.4,.4])for(let z of [-.25,.22]){cylinder(.14,.14,.045,dark,x,1.21,z,g,24);cylinder(.085,.085,.025,brass,x,1.245,z,g,20)}
  for(let x of [-.42,-.14,.14,.42]){cylinder(.045,.045,.05,brass,x,.98,-.47,g,16);sphere(.018,cream,x,.98,-.5,g)}
  for(let x of [-.5,.5])leg(x,-.27,.16,woodDark);
 }else if(t==='mirror'){
  const frame=new THREE.Mesh(new THREE.TorusGeometry(.48,.075,12,48),woodDark);frame.position.set(0,1.0,0);g.add(frame);
  const glassMesh=new THREE.Mesh(new THREE.CircleGeometry(.43,48),glass);glassMesh.position.set(0,1.0,.025);g.add(glassMesh);
  cylinder(.11,.14,.12,woodDark,0,.08,0,g,18);box(.06,.65,.06,woodDark,0,.4,0,g);
  const glint=box(.018,.45,.01,mat(0xffffff),-.14,1.05,.045,g);glint.rotation.z=.3;
 }else if(t==='wallart'){
  detail(.09,1.18,.92,.04,woodDark,0,1.12,0);
  detail(.045,1.02,.76,.025,mat(0xf5ead8),0,1.12,.06);
  detail(.018,.9,.64,.01,mat(0xe7d7c0),0,1.12,.09);
  // Botanical illustration with branching stems and leaves.
  const stem=new THREE.Mesh(new THREE.CylinderGeometry(.014,.02,.58,8),mat(0x718b61));stem.position.set(0,1.12,.12);stem.rotation.z=-.25;g.add(stem);
  for(let i=0;i<6;i++){const leaf=sphere(.075,mat(i%2?0x82966e:0xa5b58a),Math.sin(i*1.1)*.22,.84+i*.1,.13,g,[.5,1.5,.28]);leaf.rotation.z=i%2?-.6:.6}
  for(let x of [-.42,.42])detail(.025,1.08,.035,.01,brass,x,1.12,.1);
 }else if(t==='clock'){
  const frame=new THREE.Mesh(new THREE.TorusGeometry(.34,.055,10,40),woodDark);frame.position.set(0,1.05,.04);g.add(frame);
  const face=new THREE.Mesh(new THREE.CircleGeometry(.31,40),cream);face.position.set(0,1.05,.07);g.add(face);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const dot=sphere(.018,brass,Math.sin(a)*.25,1.05+Math.cos(a)*.25,.1,g)}
  box(.018,.16,.018,woodDark,.0,1.11,.11,g);const hand=box(.13,.018,.018,woodDark,.07,1.0,.11,g);hand.rotation.z=-.6;
  detail(.16,.1,.08,.03,woodDark,0,.61,0);
 }else if(t==='curtain'){
  const rod=cylinder(.035,.035,1.55,brass,0,1.94,0,g,12);rod.rotation.z=Math.PI/2;
  for(const x of [-.45,.45]){
   const panel=roundedBox(.38,1.78,.16,.08,linen,x,1.02,0,g);panel.rotation.z=x<0?-.04:.04;
   for(let k=-2;k<=2;k++){const fold=box(.018,1.58,.018,mat(0xd7c8b6),x+k*.065,1.02,.09,g);fold.rotation.z=x<0?-.035:.035}
   for(let k=-2;k<=2;k++)sphere(.022,brass,x+k*.065,1.91,.02,g);
  }
 }else if(t==='cushion'){
  detail(.72,.3,.68,.13,blush,0,.32,0,.08,0);
  for(let x of [-.2,0,.2])sphere(.025,brass,x,.34,-.33,g);
  const stitch=box(.015,.02,.5,mat(0xf5e5d4),0,.49,0,g);stitch.rotation.y=.15;
 }else{
  detail(.9,.65,.7,.08,wood,0,.36,0);for(let x of [-.3,.3])leg(x,0,.35,woodDark)
 }
 // Small floor shadow is separate from the furniture material, preserving crisp edges.
 const contact=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:0x5a4937,transparent:true,opacity:.13,depthWrite:false}));
 contact.rotation.x=-Math.PI/2;contact.position.set(0,.025,0);contact.scale.set(t==='bed'?1.55:1.12,t==='bed'?1.12:.78,1);contact.renderOrder=1;contact.raycast=()=>{};g.add(contact);
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
 tools.innerHTML=`<div class="lr3d-customizer-head"><b>家具装修 · ${active.furnitureName}</b><button type="button" data-lr3d-close aria-label="收起调色面板">收起 ×</button><span>可在房间上方区域继续拖动家具</span></div>
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
  if(e.target.closest('[data-lr3d-close]')){setSelected(null);return}
  const color=e.target.closest('[data-lr3d-color-role]');
  if(color){getBridge().updateFurnitureColor(uid,color.dataset.lr3dColorRole,color.dataset.lr3dColor);const host=active.host;refreshHost(host);setSelected(uid);return}
  const r=e.target.closest('[data-lr3d-rotate]');
  if(r){const p=active.state.placed.find(x=>String(x.uid)===String(uid));if(p){const host=active.host;getBridge().updatePlacement(uid,p.x,p.y,(Number(p.rotation)||0)+Number(r.dataset.lr3dRotate));refreshHost(host);setSelected(uid)}return}
  if(e.target.closest('[data-lr3d-remove]'))getBridge().removePlacement(uid)
 });
}
function pickFurniture(ev){const rect=active.renderer.domElement.getBoundingClientRect();const p=new THREE.Vector2((ev.clientX-rect.left)/rect.width*2-1,-((ev.clientY-rect.top)/rect.height)*2+1);active.raycaster.setFromCamera(p,active.camera);const hits=active.raycaster.intersectObjects(active.furnitureGroups,true);for(const h of hits){let o=h.object;while(o&& !o.userData.uid)o=o.parent;if(o&&o.userData.uid)return o}return null}
function floorPoint(ev){const rect=active.renderer.domElement.getBoundingClientRect();const p=new THREE.Vector2((ev.clientX-rect.left)/rect.width*2-1,-((ev.clientY-rect.top)/rect.height)*2+1);active.raycaster.setFromCamera(p,active.camera);const hits=active.raycaster.intersectObject(active.floor);return hits[0]?.point||null}
function updateRoomWallVisibility(){if(!active?.roomWalls)return;const p=active.camera.position;active.roomWalls.back.visible=p.z>=-0.15;active.roomWalls.left.visible=p.x>=-0.15;}
function cameraState(){if(!active)return null;const target=active.cameraTarget||new THREE.Vector3(0,1.05,0);const spherical=new THREE.Spherical().setFromVector3(active.camera.position.clone().sub(target));return {version:2,theta:spherical.theta,phi:spherical.phi,radius:spherical.radius,zoom:active.camera.zoom,target:{x:target.x,y:target.y,z:target.z}}}
function persistCamera(){const st=cameraState();if(st)getBridge()?.updateCameraState?.(active.state.room,st);}
function resetCamera(){if(!active)return;const target=new THREE.Vector3(0,1.22,0),spherical=new THREE.Spherical(19.2,.91,.70);active.cameraTarget.copy(target);active.camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical));active.camera.zoom=1.12;active.camera.lookAt(target);active.camera.updateProjectionMatrix();updateRoomWallVisibility();persistCamera();}
function cameraOrbitStart(ev){
 const target=active.cameraTarget||new THREE.Vector3(0,1.35,0);
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
  const center={x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2};
  if(active.pinchDistance>0){
   active.camera.zoom=Math.max(.72,Math.min(2.65,active.camera.zoom*distance/active.pinchDistance));
   active.camera.updateProjectionMatrix();
   const dx=center.x-(active.pinchCenter?.x??center.x),dy=center.y-(active.pinchCenter?.y??center.y);
   if(Math.abs(dx)+Math.abs(dy)>0){active.camera.updateMatrixWorld();const rect=active.renderer.domElement.getBoundingClientRect();const units=(active.camera.top-active.camera.bottom)/(Math.max(1,rect.height)*active.camera.zoom);const right=new THREE.Vector3().setFromMatrixColumn(active.camera.matrix,0);const up=new THREE.Vector3().setFromMatrixColumn(active.camera.matrix,1);const shift=right.multiplyScalar(-dx*units).add(up.multiplyScalar(dy*units));active.cameraTarget.add(shift);active.camera.position.add(shift);active.camera.lookAt(active.cameraTarget);updateRoomWallVisibility()}
  }
  active.pinchDistance=distance;active.pinchCenter=center;ev.preventDefault();return;
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
  o.spherical.theta-=dx*.012;
  o.spherical.phi=Math.max(.18,Math.min(1.52,o.spherical.phi+dy*.006));
  active.camera.position.copy(o.target).add(new THREE.Vector3().setFromSpherical(o.spherical));
  active.camera.lookAt(o.target);updateRoomWallVisibility();ev.preventDefault();
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
 if(active.pointers?.size<2){active.pinchDistance=0;active.pinchCenter=null;if(active.pointers?.size===1){const [id,pt]=[...active.pointers.entries()][0];cameraOrbitStart({pointerId:id,clientX:pt.x,clientY:pt.y})}else{active.orbit=null;persistCamera()}}
 if(active.orbit?.pointerId===ev.pointerId)active.orbit=null;
}
function addRoomDetails(room){/* Empty-room rule: no decorative furniture is pre-installed. Only architectural shell remains. */}

function renderLoop(){if(!active)return;active.raf=requestAnimationFrame(renderLoop);const t=performance.now()*.001;if(active.fire){active.fire.rotation.z=Math.sin(t*2.4)*.05;active.fire.scale.y=.96+Math.sin(t*5)*.07}if(active.fireLight)active.fireLight.intensity=1.15+Math.sin(t*7)*.22;if(active.curtains)active.curtains.forEach(c=>c.mesh.rotation.z=c.side*(.04+Math.sin(t*1.15+c.side)*.018));if(active.lampLight)active.lampLight.intensity=active.state.lampOn?1.0+.07*Math.sin(t*2):.08;active.renderer.render(active.scene,active.camera)}
function initHost(host){if(!THREE||!host.isConnected)return;const state=stageState();if(!state)return;disposeActive();host.innerHTML='';const width=Math.max(300,host.clientWidth||360),height=Math.max(320,host.clientHeight||Math.round(window.innerHeight*.58));const scene=new THREE.Scene();scene.background=new THREE.Color(0xf5ecdf);const camera=new THREE.OrthographicCamera(-5,5,5,-5,.1,100);
 const savedCamera=state.camera?.version===2?state.camera:null;
 const cameraTarget=new THREE.Vector3(savedCamera?.target?.x??0,savedCamera?.target?.y??1.22,savedCamera?.target?.z??0);
 const initialSpherical=new THREE.Spherical(savedCamera?.radius||19.2,savedCamera?.phi||.91,savedCamera?.theta??.70);
 camera.position.copy(cameraTarget).add(new THREE.Vector3().setFromSpherical(initialSpherical));camera.lookAt(cameraTarget);
 function fitCamera(){
  const aspect=Math.max(.45,(host.clientWidth||360)/Math.max(320,host.clientHeight||Math.round(window.innerHeight*.68)));
  const viewHeight=Math.max(11.8,8.8/aspect);
  camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;
  camera.top=viewHeight/2;camera.bottom=-viewHeight/2;
  camera.zoom=Math.max(.72,Math.min(2.65,savedCamera?.zoom||1.12));camera.updateProjectionMatrix();
 }
 fitCamera();const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));renderer.setSize(width,height,false);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.domElement.className='lr3d-canvas';renderer.domElement.setAttribute('aria-label',roomNames[state.room]+' 3D房间');host.appendChild(renderer.domElement);
 active={host,scene,camera,cameraTarget,renderer,state,raycaster:new THREE.Raycaster(),floor:null,furnitureGroups:[],selectedUid:null,drag:null,fire:null,fireLight:null,curtains:[],dust:[],lampLight:null,roomWalls:null};
 scene.add(new THREE.HemisphereLight(0xfff7e9,0x887b68,1.12));const sun=new THREE.DirectionalLight(0xffe4bd,2.45);sun.position.set(-5,10,7);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;scene.add(sun);const fill=new THREE.DirectionalLight(0xe1eddf,.48);fill.position.set(5,6,-4);scene.add(fill);
 // Warm studio-like ground plane and soft ambient bounce.
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xe7ddcd,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;scene.add(ground);
 const bounce=new THREE.PointLight(0xffe9c9,.16,14);bounce.position.set(0,1.2,3.5);scene.add(bounce);
 // Build the room shell and use its floor mesh as the drag plane.
 makeRoom(state.room);
 updateRoomWallVisibility();
 addRoomDetails(state.room);drawFurniture(state);
 active.lampLight=new THREE.PointLight(0xffd99c,state.lampOn?1:.08,7);active.lampLight.position.set(0,2.5,0);scene.add(active.lampLight);

 renderer.domElement.addEventListener('dblclick',ev=>{const hit=pickFurniture(ev);if(!hit)return;const obj=hit;const target=new THREE.Vector3(obj.position.x,.75,obj.position.z);const offset=active.camera.position.clone().sub(active.cameraTarget);active.cameraTarget.copy(target);active.camera.position.copy(target).add(offset);active.camera.zoom=Math.min(2.35,Math.max(active.camera.zoom,1.75));active.camera.lookAt(target);active.camera.updateProjectionMatrix();updateRoomWallVisibility();persistCamera()});
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointercancel',pointerUp);renderer.domElement.addEventListener('lostpointercapture',pointerUp);
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();camera.zoom=Math.max(.72,Math.min(2.65,camera.zoom*(e.deltaY>0?.94:1.06)));camera.updateProjectionMatrix();persistCamera()},{passive:false});
 const resetButton=host.closest('.v21-room-stage')?.querySelector('[data-lr3d-reset-view]');if(resetButton&&!resetButton.dataset.lr3dBound){resetButton.dataset.lr3dBound='1';resetButton.addEventListener('click',resetCamera)}
 const hint=document.createElement('div');hint.className='lr3d-hint';hint.textContent=state.decorMode?'拖动画面旋转 · 拖动家具自由摆放 · 双指缩放与平移 · 双击家具聚焦':'单指环绕观察 · 双指缩放与平移 · 双击家具近看';host.appendChild(hint);
 if(typeof ResizeObserver!=='undefined'){resizeObserver=new ResizeObserver(()=>{if(!active||active.host!==host)return;const w=Math.max(300,host.clientWidth),h=Math.max(320,host.clientHeight);renderer.setSize(w,h,false);fitCamera()});resizeObserver.observe(host)}
 renderLoop();
}
function refreshHost(host){const state=stageState();if(!state)return;initHost(host)}
function scan(){const hosts=[...document.querySelectorAll('[data-lr3d-viewport]')];const visible=hosts.find(x=>x.offsetWidth>0&&x.offsetHeight>0);if(!visible)return;if(!THREE){loadThree().then(t=>{THREE=t;scan()}).catch(err=>{visible.innerHTML='<div class="lr3d-error"><b>3D 场景暂时无法载入</b><span>请检查网络连接后刷新页面。农场存档不受影响。</span></div>';console.warn('[LR 3D]',err)});return}if(active?.host===visible){const st=stageState();if(st&&JSON.stringify([st.owner,st.room,st.decorMode,st.placed])!==JSON.stringify([active.state.owner,active.state.room,active.state.decorMode,active.state.placed])){try{initHost(visible)}catch(err){visible.innerHTML='<div class="lr3d-error"><b>3D 场景渲染失败</b><span>请刷新页面重试。农场存档不会受影响。</span></div>';console.warn('[LR 3D render]',err)}}return}try{initHost(visible)}catch(err){visible.innerHTML='<div class="lr3d-error"><b>当前设备暂不支持 3D 场景</b><span>请更新浏览器或检查 WebGL 设置。农场存档不会受影响。</span></div>';console.warn('[LR 3D render]',err)}}
function injectStyles(){if(document.getElementById('lr3d-style'))return;const s=document.createElement('style');s.id='lr3d-style';s.textContent=`.v21-room-stage{width:100%;margin:16px 0 18px;padding:10px;border-radius:28px;background:linear-gradient(145deg,#fffaf0,#e9dfca);box-shadow:0 12px 32px rgba(103,78,51,.10),inset 0 0 0 1px rgba(255,255,255,.8);overflow:hidden}.lr3d-viewport{position:relative;width:100%;aspect-ratio:1.18;min-height:280px;border-radius:21px;overflow:hidden;background:radial-gradient(ellipse at 50% 28%,#fff8e9 0,#e8ddca 100%);touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:inset 0 0 0 1px #fff9ed,0 12px 30px rgba(99,72,45,.10)}.lr3d-canvas{display:block;width:100%;height:100%;touch-action:none;outline:none;filter:saturate(1.08) contrast(1.06)}.lr3d-loading,.lr3d-error{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#76664f;background:linear-gradient(135deg,#f7efdf,#e8e8d8);font-family:inherit}.lr3d-loading-mark{font-size:34px;color:#8d9c78}.lr3d-loading small,.lr3d-error span{font-size:12px;color:#9b8c78}.lr3d-caption{display:flex;justify-content:space-between;padding:9px 5px 1px;color:#9b8c78;font-size:10px;letter-spacing:.12em}.lr3d-hint{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);max-width:90%;white-space:nowrap;padding:7px 12px;border-radius:99px;background:rgba(255,250,240,.88);color:#85745e;font-size:10px;box-shadow:0 2px 12px #77634a20;pointer-events:none}.lr3d-tools{position:absolute;right:12px;top:12px;display:flex;gap:6px;z-index:4}.lr3d-tools button{border:1px solid #d8c9b3;border-radius:18px;background:rgba(255,250,240,.94);color:#6f795e;padding:8px 12px;font:inherit;box-shadow:0 3px 12px #5c4a3218}.lr3d-tools .lr3d-remove{color:#a46d5a}.lr3d-error{padding:24px;text-align:center}.house-page .lr3d-caption{letter-spacing:.08em}
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


 /* V26: real portrait home viewport + restored inline furniture shop */
 #lr-games .gscroll:has(.house-page){overflow-y:auto!important;overflow-x:hidden!important;padding-bottom:24px!important;}
 #lr-games .house-page{height:auto!important;min-height:0!important;max-width:none!important;margin:0!important;padding:8px 12px 24px!important;display:block!important;overflow:visible!important;}
 #lr-games .house-intro{padding:2px 4px 10px!important;margin:0!important;}
 #lr-games .house-intro .house-back{display:none!important;}
 #lr-games .house-intro .house-kicker{font-size:9px!important;margin:0 0 3px!important;}
 #lr-games .house-intro h1{font-size:25px!important;line-height:1.2!important;margin:2px 0 4px!important;}
 #lr-games .house-intro p{font-size:11px!important;margin:0!important;}
 #lr-games .room-tabs{margin:8px 0 12px!important;padding:5px!important;gap:4px!important;}
 #lr-games .room-tabs button{padding:9px 4px!important;font-size:11px!important;}
 #lr-games .house-page .v21-room-stage{position:relative!important;width:calc(100% + 24px)!important;margin:0 -12px 12px!important;padding:7px!important;height:68svh!important;min-height:470px!important;max-height:740px!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;border-radius:24px!important;}
 #lr-games .house-page .lr3d-viewport{position:relative!important;flex:1 1 auto!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important;border-radius:18px!important;}
 #lr-games .house-page .lr3d-caption{flex:none!important;padding:6px 4px 1px!important;font-size:9px!important;}
 #lr-games .lr3d-stage-tools{position:absolute!important;z-index:5!important;top:14px!important;left:14px!important;right:14px!important;display:flex!important;justify-content:space-between!important;pointer-events:none!important;}
 #lr-games .lr3d-stage-tools button{pointer-events:auto!important;border:1px solid #e2d5c2!important;border-radius:99px!important;padding:8px 13px!important;background:rgba(255,251,243,.94)!important;box-shadow:0 4px 15px #66503820!important;font-size:11px!important;}
 #lr-games .house-controls{margin:10px 0!important;padding:12px 14px!important;border-radius:18px!important;}
 #lr-games .house-controls .house-section-title{margin:0!important;}
 #lr-games .house-controls .house-section-title b{font-size:13px!important;}
 #lr-games .house-controls .house-section-title small{font-size:10px!important;}
 #lr-games .house-controls .house-decor-summary{font-size:10px!important;}
 #lr-games .house-memory{display:none!important;}
 #lr-games .house-page .furniture-mega-shop{margin:12px 0 0!important;border-radius:22px!important;}
 #lr-games .house-page .furniture-mega-shop>summary{padding:16px!important;font-size:14px!important;}
 #lr-games .house-page .furniture-mega-shop>.shop-accordion-body{padding:0 10px 12px!important;}
 #lr-games .furniture-shop-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
 @media(max-width:600px){
  #lr-games .house-page .v21-room-stage{width:calc(100% + 24px)!important;margin-left:-12px!important;margin-right:-12px!important;height:66svh!important;min-height:450px!important;max-height:680px!important;}
 }


 .lr3d-customizer{left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;max-width:none!important;width:auto!important;padding:8px 10px!important;border-radius:16px!important;background:rgba(255,250,241,.97)!important;display:flex!important;flex-direction:column!important;gap:5px!important;max-height:42%!important;overflow:auto!important;z-index:8!important;touch-action:pan-y!important;}
 .lr3d-customizer-head{display:grid!important;grid-template-columns:1fr auto;align-items:center;gap:2px 8px!important;font-size:11px!important;}
 .lr3d-customizer-head b{font-size:11px!important;}
 .lr3d-customizer-head span{grid-column:1/-1!important;font-size:9px!important;}
 .lr3d-customizer-head button{border:1px solid #e0d3c0!important;border-radius:99px!important;background:#f7f0e5!important;padding:4px 9px!important;font-size:9px!important;color:#756651!important;}
 .lr3d-palette-row{gap:6px!important;min-height:26px!important;}
 .lr3d-palette-row label{width:62px!important;flex:0 0 62px!important;font-size:9px!important;}
 .lr3d-swatches{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;gap:6px!important;scrollbar-width:none!important;}
 .lr3d-swatches::-webkit-scrollbar{display:none!important;}
 .lr3d-swatch{width:22px!important;height:22px!important;min-width:22px!important;}
 .lr3d-rotation-row{gap:6px!important;font-size:9px!important;}
 .lr3d-tools-actions{gap:5px!important;}
 .lr3d-tools-actions button{font-size:9px!important;padding:5px 8px!important;}


 /* V26: real portrait home viewport + restored inline furniture shop */
 #lr-games .gscroll:has(.house-page){overflow-y:auto!important;overflow-x:hidden!important;padding-bottom:24px!important;}
 #lr-games .house-page{height:auto!important;min-height:0!important;max-width:none!important;margin:0!important;padding:8px 12px 24px!important;display:block!important;overflow:visible!important;}
 #lr-games .house-intro{padding:2px 4px 10px!important;margin:0!important;}
 #lr-games .house-intro .house-back{display:none!important;}
 #lr-games .house-intro .house-kicker{font-size:9px!important;margin:0 0 3px!important;}
 #lr-games .house-intro h1{font-size:25px!important;line-height:1.2!important;margin:2px 0 4px!important;}
 #lr-games .house-intro p{font-size:11px!important;margin:0!important;}
 #lr-games .room-tabs{margin:8px 0 12px!important;padding:5px!important;gap:4px!important;}
 #lr-games .room-tabs button{padding:9px 4px!important;font-size:11px!important;}
 #lr-games .house-page .v21-room-stage{position:relative!important;width:calc(100% + 24px)!important;margin:0 -12px 12px!important;padding:7px!important;height:68svh!important;min-height:470px!important;max-height:740px!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;border-radius:24px!important;}
 #lr-games .house-page .lr3d-viewport{position:relative!important;flex:1 1 auto!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;aspect-ratio:auto!important;border-radius:18px!important;}
 #lr-games .house-page .lr3d-caption{flex:none!important;padding:6px 4px 1px!important;font-size:9px!important;}
 #lr-games .lr3d-stage-tools{position:absolute!important;z-index:5!important;top:14px!important;left:14px!important;right:14px!important;display:flex!important;justify-content:space-between!important;pointer-events:none!important;}
 #lr-games .lr3d-stage-tools button{pointer-events:auto!important;border:1px solid #e2d5c2!important;border-radius:99px!important;padding:8px 13px!important;background:rgba(255,251,243,.94)!important;box-shadow:0 4px 15px #66503820!important;font-size:11px!important;}
 #lr-games .house-controls{margin:10px 0!important;padding:12px 14px!important;border-radius:18px!important;}
 #lr-games .house-controls .house-section-title{margin:0!important;}
 #lr-games .house-controls .house-section-title b{font-size:13px!important;}
 #lr-games .house-controls .house-section-title small{font-size:10px!important;}
 #lr-games .house-controls .house-decor-summary{font-size:10px!important;}
 #lr-games .house-memory{display:none!important;}
 #lr-games .house-page .furniture-mega-shop{margin:12px 0 0!important;border-radius:22px!important;}
 #lr-games .house-page .furniture-mega-shop>summary{padding:16px!important;font-size:14px!important;}
 #lr-games .house-page .furniture-mega-shop>.shop-accordion-body{padding:0 10px 12px!important;}
 #lr-games .furniture-shop-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}
 @media(max-width:600px){
  #lr-games .house-page .v21-room-stage{width:calc(100% + 24px)!important;margin-left:-12px!important;margin-right:-12px!important;height:66svh!important;min-height:450px!important;max-height:680px!important;}
 }


 .lr3d-customizer{left:8px!important;right:8px!important;top:auto!important;bottom:8px!important;max-width:none!important;width:auto!important;padding:8px 10px!important;border-radius:16px!important;background:rgba(255,250,241,.97)!important;display:flex!important;flex-direction:column!important;gap:5px!important;max-height:42%!important;overflow:auto!important;z-index:8!important;touch-action:pan-y!important;}
 .lr3d-customizer-head{display:grid!important;grid-template-columns:1fr auto;align-items:center;gap:2px 8px!important;font-size:11px!important;}
 .lr3d-customizer-head b{font-size:11px!important;}
 .lr3d-customizer-head span{grid-column:1/-1!important;font-size:9px!important;}
 .lr3d-customizer-head button{border:1px solid #e0d3c0!important;border-radius:99px!important;background:#f7f0e5!important;padding:4px 9px!important;font-size:9px!important;color:#756651!important;}
 .lr3d-palette-row{gap:6px!important;min-height:26px!important;}
 .lr3d-palette-row label{width:62px!important;flex:0 0 62px!important;font-size:9px!important;}
 .lr3d-swatches{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;gap:6px!important;scrollbar-width:none!important;}
 .lr3d-swatches::-webkit-scrollbar{display:none!important;}
 .lr3d-swatch{width:22px!important;height:22px!important;min-width:22px!important;}
 .lr3d-rotation-row{gap:6px!important;font-size:9px!important;}
 .lr3d-tools-actions{gap:5px!important;}
 .lr3d-tools-actions button{font-size:9px!important;padding:5px 8px!important;}
 /* V27: larger portrait 3D viewport, full horizontal orbit and usable room controls */
 #lr-games .house-page .v21-room-stage{height:76svh!important;min-height:580px!important;max-height:860px!important;margin-bottom:14px!important;padding:8px!important;background:linear-gradient(150deg,#fffaf0 0%,#e9dfca 100%)!important;}
 #lr-games .house-page .lr3d-viewport{min-height:0!important;background:radial-gradient(ellipse at 50% 36%,#fff8eb 0%,#e8ddca 78%)!important;}
 #lr-games .house-page .lr3d-caption{font-size:10px!important;letter-spacing:.06em!important;}
 #lr-games .lr3d-stage-tools{top:16px!important;left:16px!important;right:16px!important;gap:7px!important;}
 #lr-games .lr3d-stage-tools button{padding:9px 13px!important;font-size:11px!important;backdrop-filter:blur(10px)!important;}
 #lr-games .lr3d-stage-tools [data-lr3d-reset-view]{margin-left:auto!important;}
 #lr-games .house-controls{padding:13px 15px!important;background:linear-gradient(145deg,#fffdf8,#f7f0e5)!important;}
 @media(max-width:600px){#lr-games .house-page .v21-room-stage{height:76svh!important;min-height:570px!important;max-height:820px!important;width:calc(100% + 24px)!important;margin-left:-12px!important;margin-right:-12px!important;}#lr-games .lr3d-stage-tools{top:12px!important;left:12px!important;right:12px!important;}#lr-games .lr3d-stage-tools button{padding:8px 11px!important;font-size:10px!important;}}
 /* V28 · Animal Crossing-inspired crisp home art direction */
 #lr-games .house-page{animation:lrHomeArrive .42s cubic-bezier(.2,.75,.25,1) both}
 #lr-games .house-page .v21-room-stage{background:linear-gradient(155deg,#f6eddf 0%,#e7ddca 100%)!important;box-shadow:0 12px 28px rgba(93,69,43,.10),inset 0 0 0 1px rgba(255,255,255,.9)!important}
 #lr-games .house-page .lr3d-viewport{background:linear-gradient(155deg,#f4ead9 0%,#e8decd 100%)!important;box-shadow:inset 0 0 0 1px rgba(255,255,255,.82),inset 0 -18px 30px rgba(133,105,70,.035)!important}
 #lr-games .house-page .lr3d-canvas{filter:saturate(1.08) contrast(1.055)!important}
 #lr-games .house-page .lr3d-hint{background:rgba(255,251,242,.96)!important;color:#75634e!important;box-shadow:0 4px 14px rgba(80,59,35,.12)!important}
 @keyframes lrHomeArrive{from{opacity:0;transform:translateY(12px) scale(.992)}to{opacity:1;transform:translateY(0) scale(1)}}
 @media(prefers-reduced-motion:reduce){#lr-games .house-page{animation:none!important}}

 `;document.head.appendChild(s)}
function start(){injectStyles();if(observer)observer.disconnect();observer=new MutationObserver(()=>{if(document.querySelector('[data-lr3d-viewport]'))scan();else if(active)disposeActive()});observer.observe(document.body,{childList:true,subtree:true});scan();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scan()});
})();
