import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js';

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x6aa2ff, 200, 1200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 2000);
camera.position.set(0, 2, 5);
renderer.setClearColor(0x6aa2ff, 1);

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(100, 200, 50);
sun.castShadow = true;
sun.shadow.mapSize.set(2048,2048);
scene.add(sun); scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0x99ccff, 0x294025, 0.5);
scene.add(hemi);

const SIZE = 1200;
const groundGeo = new THREE.PlaneGeometry(SIZE, SIZE, 256, 256);
groundGeo.rotateX(-Math.PI/2);
function fbm2(x,z){ let n=0, amp=1, freq=.005; for(let i=0;i<5;i++){ n += Math.sin(x*freq)*Math.cos(z*freq)*amp; x*=2.03; z*=2.03; amp*=.5; freq*=1.85; } return n; }
const pos = groundGeo.attributes.position;
for(let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i); pos.setY(i, fbm2(x,z)*6); }
pos.needsUpdate = true; groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: 0x355e3b, roughness:.95 }));
ground.receiveShadow = true; scene.add(ground);

const water = new THREE.Mesh(new THREE.RingGeometry(SIZE*.55, SIZE*.75, 64), new THREE.MeshBasicMaterial({color:0x1d4e89, transparent:true, opacity:.7, side:THREE.DoubleSide}));
water.rotation.x = -Math.PI/2; water.position.y=.2; scene.add(water);

function heightAt(x,z){
  const half=SIZE/2, u=(x+half)/SIZE, v=(z+half)/SIZE;
  const gridX=256, gridZ=256;
  const ix=Math.max(0,Math.min(gridX,Math.floor(u*gridX)));
  const iz=Math.max(0,Math.min(gridZ,Math.floor(v*gridZ)));
  const idx = iz*(gridX+1) + ix;
  return pos.getY(idx);
}

const treeGroup = new THREE.Group(); scene.add(treeGroup);
function addTree(x,z){
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.3,.5,6,8), new THREE.MeshStandardMaterial({color:0x5b3a29}));
  trunk.castShadow = trunk.receiveShadow = true;
  const foliage = new THREE.Mesh(new THREE.ConeGeometry(2.5,5,12), new THREE.MeshStandardMaterial({color:0x2e7d32, roughness:.9}));
  foliage.position.y=5; foliage.castShadow=true;
  const g = new THREE.Group(); g.add(trunk,foliage); g.position.set(x,heightAt(x,z),z);
  treeGroup.add(g);
}
function addRock(x,z){
  const geo = new THREE.DodecahedronGeometry(1.5,0); geo.scale(1,.6,1);
  const rock = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color:0x7b7b7b, roughness:1.0}));
  rock.castShadow = rock.receiveShadow = true;
  rock.position.set(x,heightAt(x,z),z); rock.rotation.y=Math.random()*Math.PI;
  scene.add(rock);
}
for(let i=0;i<220;i++){
  const x=(Math.random()-.5)*SIZE*.9, z=(Math.random()-.5)*SIZE*.9;
  if(Math.hypot(x,z) > SIZE*.55) continue;
  (Math.random()<.6)?addTree(x,z):addRock(x,z);
}

const player = new THREE.Object3D();
const playerCollider = { position:new THREE.Vector3(0,8,0), radius:.5, height:1.6, vel:new THREE.Vector3() };
scene.add(player);
camera.position.set(0,1.6,0); player.add(camera);

import { PointerLockControls } from 'https://unpkg.com/three@0.161.0/examples/jsm/controls/PointerLockControls.js';
const controls = new PointerLockControls(camera, renderer.domElement);
let pointerLocked=false;
renderer.domElement.addEventListener('click',()=>{ if(!isMobile()) controls.lock(); });
controls.addEventListener('lock',()=>{ pointerLocked=true; document.getElementById('overlay').style.display='none'; });
controls.addEventListener('unlock',()=>{ pointerLocked=false; document.getElementById('overlay').style.display='flex'; });

let forward=0,right=0,onGround=false,sprint=false;
const keys={};
addEventListener('keydown',e=>{ keys[e.code]=true; handleKeys(); if(e.code==='KeyC') tryThrow(); if(e.code==='KeyX') tryBow(); if(e.code==='KeyF') placeCampfire(); if(e.code==='KeyT') toggleTech(); });
addEventListener('keyup',e=>{ delete keys[e.code]; handleKeys(); });
function handleKeys(){
  forward = (keys['KeyW']?1:0)+(keys['ArrowUp']?1:0)-(keys['KeyS']?1:0)-(keys['ArrowDown']?1:0);
  right   = (keys['KeyD']?1:0)+(keys['ArrowRight']?1:0)-(keys['KeyA']?1:0)-(keys['ArrowLeft']?1:0);
  sprint = !!keys['ShiftLeft']||!!keys['ShiftRight'];
  if(keys['Space']) jump();
}

const leftStick = document.getElementById('leftStick');
const stickEl = leftStick?.querySelector('.stick');
const rightLook = document.getElementById('rightLook');
const jumpBtn = document.getElementById('jumpBtn');
const throwBtn = document.getElementById('throwBtn');
const bowBtn = document.getElementById('bowBtn');
const campBtn = document.getElementById('campBtn');
const techBtn = document.getElementById('techBtn');
const openTechBtn = document.getElementById('openTechBtn');

jumpBtn?.addEventListener('click', jump);
throwBtn?.addEventListener('click', tryThrow);
bowBtn?.addEventListener('click', tryBow);
campBtn?.addEventListener('click', placeCampfire);
techBtn?.addEventListener('click', toggleTech);
openTechBtn?.addEventListener('click', toggleTech);

let leftActive=false,leftId=null,leftOrigin={x:0,y:0};
let lookId=null,lastLook={x:0,y:0};
leftStick?.addEventListener('touchstart',e=>{
  e.preventDefault(); const t=e.changedTouches[0];
  leftActive=true; leftId=t.identifier;
  const rect=leftStick.getBoundingClientRect();
  leftOrigin.x=t.clientX-rect.left; leftOrigin.y=t.clientY-rect.top;
  stickEl.style.left=(leftOrigin.x-25)+'px'; stickEl.style.top=(leftOrigin.y-25)+'px';
},{passive:false});
leftStick?.addEventListener('touchmove',e=>{
  const t=[...e.changedTouches].find(tt=>tt.identifier===leftId); if(!t) return;
  const rect=leftStick.getBoundingClientRect();
  const x=t.clientX-rect.left, y=t.clientY-rect.top;
  const dx=x-leftOrigin.x, dy=y-leftOrigin.y;
  const maxR=50; const len=Math.hypot(dx,dy); const cl=len>maxR?maxR/len:1;
  const nx=dx*cl, ny=dy*cl;
  stickEl.style.left=(leftOrigin.x+nx-25)+'px'; stickEl.style.top=(leftOrigin.y+ny-25)+'px';
  forward = -ny/maxR; right = nx/maxR;
},{passive:false});
leftStick?.addEventListener('touchend',e=>{
  const t=[...e.changedTouches].find(tt=>tt.identifier===leftId); if(!t) return;
  leftActive=false; leftId=null; forward=0; right=0;
  stickEl.style.left='45px'; stickEl.style.top='45px';
});
rightLook?.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; lookId=t.identifier; lastLook.x=t.clientX; lastLook.y=t.clientY; },{passive:true});
rightLook?.addEventListener('touchmove',e=>{
  const t=[...e.changedTouches].find(tt=>tt.identifier===lookId); if(!t) return;
  const dx=t.clientX-lastLook.x, dy=t.clientY-lastLook.y; lastLook.x=t.clientX; lastLook.y=t.clientY;
  rotateCamera(-dx*0.0025, -dy*0.0025);
},{passive:true});
rightLook?.addEventListener('touchend',e=>{ const t=[...e.changedTouches].find(tt=>tt.identifier===lookId); if(!t) return; lookId=null; },{passive:true});

function rotateCamera(yaw,pitch){ player.rotation.y += yaw; const e=camera.rotation.x + pitch; camera.rotation.x=Math.max(-Math.PI/2+.1, Math.min(Math.PI/2-.1, e)); }
function isMobile(){ return matchMedia('(pointer:coarse)').matches; }

let stones=0, wood=0, tech=0;
const stoneUI=document.getElementById('stoneCount');
const woodUI=document.getElementById('woodCount');
const techUI=document.getElementById('techCount');
function updateInv(){ stoneUI.textContent=stones; woodUI.textContent=wood; techUI.textContent=tech; }

const unlocks = { spear:false, bow:false, camp:false };
const techMenu = document.getElementById('techMenu');
const unlockSpearBtn = document.getElementById('unlockSpear');
const unlockBowBtn = document.getElementById('unlockBow');
const unlockCampBtn = document.getElementById('unlockCamp');
document.getElementById('closeTech')?.addEventListener('click', toggleTech);
unlockSpearBtn?.addEventListener('click', ()=>tryUnlock('spear', {tech:2, stone:3, wood:2}));
unlockBowBtn?.addEventListener('click', ()=>tryUnlock('bow', {tech:3, stone:2, wood:4}));
unlockCampBtn?.addEventListener('click', ()=>tryUnlock('camp', {tech:1, stone:1, wood:3}));
function toggleTech(){ techMenu.classList.toggle('hidden'); }
function tryUnlock(name, cost){
  if(unlocks[name]) return;
  if(tech>= (cost.tech||0) && stones>=(cost.stone||0) && wood>=(cost.wood||0)){
    tech -= (cost.tech||0); stones -= (cost.stone||0); wood -= (cost.wood||0);
    unlocks[name]=true; updateInv(); updateTechButtons();
  }
}
function updateTechButtons(){
  if(unlocks.spear){ unlockSpearBtn.textContent='Stone Spear ✓'; unlockSpearBtn.disabled=true; }
  if(unlocks.bow){ unlockBowBtn.textContent='Simple Bow ✓'; unlockBowBtn.disabled=true; }
  if(unlocks.camp){ unlockCampBtn.textContent='Campfire ✓'; unlockCampBtn.disabled=true; }
}
updateInv(); updateTechButtons();

function addPickup(type, n=25){
  for(let i=0;i<n;i++){
    const x=(Math.random()-.5)*SIZE*.9, z=(Math.random()-.5)*SIZE*.9;
    if(Math.hypot(x,z) > SIZE*.55) continue;
    const geom = type==='stone' ? new THREE.SphereGeometry(.3,12,12) : new THREE.BoxGeometry(.4,.25,.4);
    const mat  = type==='stone' ? new THREE.MeshStandardMaterial({color:0xc0c0c0}) : new THREE.MeshStandardMaterial({color:0x9b6a3a});
    const m = new THREE.Mesh(geom, mat);
    m.position.set(x, heightAt(x,z)+0.3, z);
    m.userData.type = type;
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
}
addPickup('stone', 30);
addPickup('wood', 30);

const tempVec = new THREE.Vector3();
function checkPickup(){
  scene.traverse(obj=>{
    if(obj.userData && (obj.userData.type==='stone' || obj.userData.type==='wood')){
      tempVec.copy(obj.position).sub(playerCollider.position);
      if(tempVec.length()<1.5){
        if(obj.userData.type==='stone') stones++;
        else wood++;
        updateInv();
        scene.remove(obj);
      }
    }
  });
}

const flyingSpears=[];
function tryThrow(){ if(unlocks.spear) throwSpear(); }
function throwSpear(){
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const spear = new THREE.Mesh(new THREE.CylinderGeometry(.05,.05,1.3,6), new THREE.MeshStandardMaterial({color:0xb08968}));
  spear.position.copy(origin); spear.quaternion.copy(camera.quaternion); spear.castShadow=true; scene.add(spear);
  const vel = dir.multiplyScalar(80);
  const birth = clock.getElapsedTime();
  flyingSpears.push({mesh:spear, vel, birth, dmg:2});
}

const flyingArrows=[];
function tryBow(){ if(unlocks.bow) shootArrow(); }
function shootArrow(){
  const dir = new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const arrow = new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,1.2,6), new THREE.MeshStandardMaterial({color:0xdddddd}));
  arrow.position.copy(origin); arrow.quaternion.copy(camera.quaternion); arrow.castShadow=true; scene.add(arrow);
  const vel = dir.multiplyScalar(110);
  const birth = clock.getElapsedTime();
  flyingArrows.push({mesh:arrow, vel, birth, dmg:1.5});
}

let campPlaced=false;
function placeCampfire(){
  if(!unlocks.camp || campPlaced) return;
  const pos = playerCollider.position.clone();
  const fire = makeCampfire(pos.x, heightAt(pos.x,pos.z), pos.z);
  campPlaced=true;
}
function makeCampfire(x,y,z){
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.6,.08,8,16), new THREE.MeshStandardMaterial({color:0x444444, roughness:1}));
  ring.rotation.x = Math.PI/2; ring.position.set(x,y+.05,z);
  const flame = new THREE.PointLight(0xffaa55, 2.5, 18); flame.position.set(x,y+1.0,z);
  g.add(ring, flame); scene.add(g);
  g.userData.type='campfire'; g.userData.flame=flame;
  return g;
}

const dinos=[];
function makeDino(x,z){
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8,1.0,3.2), new THREE.MeshStandardMaterial({color:0x467a3c}));
  const head = new THREE.Mesh(new THREE.BoxGeometry(.9,.8,1.0), new THREE.MeshStandardMaterial({color:0x3c6e3c}));
  head.position.set(0,.5,-2.0);
  const legGeo = new THREE.CylinderGeometry(.15,.2,.9,6);
  const mat = new THREE.MeshStandardMaterial({color:0x2e5a2e});
  const leg1=new THREE.Mesh(legGeo,mat); leg1.position.set(.5,-.95,1.0);
  const leg2=new THREE.Mesh(legGeo,mat); leg2.position.set(-.5,-.95,1.0);
  const leg3=new THREE.Mesh(legGeo,mat); leg3.position.set(.5,-.95,-.5);
  const leg4=new THREE.Mesh(legGeo,mat); leg4.position.set(-.5,-.95,-.5);
  const g = new THREE.Group(); g.add(body,head,leg1,leg2,leg3,leg4);
  g.position.set(x, heightAt(x,z)+1.1, z);
  g.userData = {hp: 4, mode:'wander', dir:new THREE.Vector3(Math.random()-.5,0,Math.random()-.5).normalize(), timer:Math.random()*5};
  g.traverse(o=>{ o.castShadow=true; o.receiveShadow=true; });
  scene.add(g); dinos.push(g);
}
for(let i=0;i<16;i++){
  const x=(Math.random()-.5)*SIZE*.8, z=(Math.random()-.5)*SIZE*.8;
  if(Math.hypot(x,z) > SIZE*.55) continue;
  makeDino(x,z);
}

let hp=100; const hpBar=document.getElementById('hpBar');
function damage(d){ hp=Math.max(0,hp-d); hpBar.style.width=hp+'%'; if(hp<=0) respawn(); }
function respawn(){ let x=0,z=0; for(let i=0;i<20;i++){ x=(Math.random()-.5)*SIZE*.6; z=(Math.random()-.5)*SIZE*.6; if(Math.hypot(x,z) < SIZE*.55) break; } playerCollider.position.set(x,10,z); hp=100; hpBar.style.width='100%'; }

const clock = new THREE.Clock();
const tip = document.getElementById('tip');

function jump(){ if(onGround){ playerCollider.vel.y=7.5; onGround=false; } }
function getYawFromCamera(){ const v=new THREE.Vector3(); camera.getWorldDirection(v); return Math.atan2(v.x,-v.z); }

addEventListener('mousemove',e=>{ if(!pointerLocked || isMobile()) return; rotateCamera(-e.movementX*0.0025, -e.movementY*0.0025); });
document.getElementById('startBtn').addEventListener('click',()=>{ if(isMobile()){ document.getElementById('overlay').style.display='none'; } else{ controls.lock(); } });
addEventListener('resize',()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });

function update(dt){
  const t = clock.elapsedTime*0.02;
  const sunAngle = Math.sin(t)*Math.PI*0.5 + Math.PI*0.25;
  sun.position.set(Math.cos(t)*200, Math.sin(t)*220+80, Math.sin(t)*200);
  sun.intensity = Math.max(.2, Math.sin(sunAngle)*1.2);
  hemi.intensity = .4 + .3*Math.max(0, Math.sin(sunAngle));

  const speed=(sprint?9:5);
  const dir=new THREE.Vector3();
  const yaw=player.rotation.y;
  const forwardVec=new THREE.Vector3(Math.sin(yaw),0,-Math.cos(yaw));
  const rightVec=new THREE.Vector3(Math.cos(yaw),0,Math.sin(yaw));
  dir.addScaledVector(forwardVec,forward).addScaledVector(rightVec,right);
  if(dir.length()>1) dir.normalize();
  playerCollider.vel.x = THREE.MathUtils.damp(playerCollider.vel.x, dir.x*speed, 10, dt);
  playerCollider.vel.z = THREE.MathUtils.damp(playerCollider.vel.z, dir.z*speed, 10, dt);
  playerCollider.vel.y -= 20*dt;
  playerCollider.position.addScaledVector(playerCollider.vel, dt);

  const yGround = heightAt(playerCollider.position.x, playerCollider.position.z)+1.6;
  if(playerCollider.position.y < yGround){ playerCollider.position.y=yGround; playerCollider.vel.y=0; onGround=true; } else onGround=false;

  player.position.copy(playerCollider.position);
  player.rotation.y=getYawFromCamera();

  dinos.forEach((g,idx)=>{
    const toPlayer = playerCollider.position.clone().sub(g.position); const dist=toPlayer.length();
    const ud=g.userData;
    if(dist<25) ud.mode='chase'; else if(dist>40) ud.mode='wander';
    if(ud.mode==='chase'){
      toPlayer.y=0; toPlayer.normalize(); g.position.addScaledVector(toPlayer, dt*3.2); g.lookAt(g.position.clone().add(toPlayer));
    }else{
      ud.timer -= dt;
      if(ud.timer<=0){ ud.dir.set(Math.random()-.5,0,Math.random()-.5).normalize(); ud.timer=2+Math.random()*3; }
      g.position.addScaledVector(ud.dir, dt*1.4); g.lookAt(g.position.clone().add(ud.dir));
    }
    g.position.y = heightAt(g.position.x, g.position.z)+1.1;
    if(dist<1.5) damage(15*dt);
  });

  function advance(list){
    for(let i=list.length-1;i>=0;i--){
      const s=list[i];
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.rotation.x += dt*10;
      for(let j=dinos.length-1;j>=0;j--){
        const g=dinos[j];
        const d=s.mesh.position.distanceTo(g.position);
        if(d<1.5){
          g.userData.hp -= s.dmg;
          if(g.userData.hp<=0){
            tech += 1; updateInv();
            if(Math.random()<.6){ dropPickup('stone', g.position); }
            if(Math.random()<.6){ dropPickup('wood', g.position); }
            scene.remove(g); dinos.splice(j,1);
          }
          scene.remove(s.mesh); list.splice(i,1); break;
        }
      }
      if(clock.getElapsedTime()-s.birth > 2.5){ scene.remove(s.mesh); list.splice(i,1); }
    }
  }
  advance(flyingSpears); advance(flyingArrows);

  scene.traverse(obj=>{
    if(obj.userData && obj.userData.type==='campfire'){
      const d = obj.position.distanceTo(playerCollider.position);
      if(d<6 && hp<100){ hp = Math.min(100, hp + 5*dt); hpBar.style.width = hp+'%'; }
      const pl = obj.userData.flame; pl.intensity = 2.2 + Math.sin(clock.elapsedTime*8)*0.3;
    }
  });

  checkPickup();
  updateTip();
}
function dropPickup(type, at){
  const geom = type==='stone' ? new THREE.SphereGeometry(.3,12,12) : new THREE.BoxGeometry(.4,.25,.4);
  const mat  = type==='stone' ? new THREE.MeshStandardMaterial({color:0xc0c0c0}) : new THREE.MeshStandardMaterial({color:0x9b6a3a});
  const m = new THREE.Mesh(geom, mat);
  m.position.set(at.x + (Math.random()-.5)*1.5, at.y+.3, at.z + (Math.random()-.5)*1.5);
  m.userData.type=type; m.castShadow=true; m.receiveShadow=true;
  scene.add(m);
}
function updateTip(){
  let lines=[];
  if(!unlocks.spear) lines.push('Open Tech (T/🧠) and unlock Stone Spear');
  if(unlocks.spear && !unlocks.bow) lines.push('Press C / 🗡 to throw spears');
  if(unlocks.bow) lines.push('Press X / 🏹 to shoot arrows');
  if(unlocks.camp && !campPlaced) lines.push('Press F / 🔥 to place a campfire');
  tip.textContent = lines.join(' • ') || 'Explore, hunt dinos for Tech, craft upgrades!';
}

let last=0;
function animate(t){ const dt=Math.min(.033,(t-last)/1000); last=t; update(dt); renderer.render(scene,camera); requestAnimationFrame(animate); }
requestAnimationFrame(animate);
