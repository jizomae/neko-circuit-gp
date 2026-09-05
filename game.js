import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';

const canvas=document.querySelector('#game'), loading=document.querySelector('#loading'), menu=document.querySelector('#menu');
const hud=document.querySelector('#hud'), countdownEl=document.querySelector('#countdown'), finish=document.querySelector('#finish');
const ui={pos:document.querySelector('#position'),lap:document.querySelector('#lap'),time:document.querySelector('#time'),speed:document.querySelector('#speed'),speedbar:document.querySelector('#speedbar'),boost:document.querySelector('#boost'),wrong:document.querySelector('#wrong-way')};
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75)); renderer.setSize(innerWidth,innerHeight); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x9cb5c5); scene.fog=new THREE.FogExp2(0xb6c4cb,.0021);
const camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.1,1500);
const hemi=new THREE.HemisphereLight(0xe8f4ff,0x3b4935,1.7); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffefd6,3.2); sun.position.set(-90,130,-70); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-180; sun.shadow.camera.right=180; sun.shadow.camera.top=180; sun.shadow.camera.bottom=-180; scene.add(sun);

const trackA=125,trackB=78,trackWidth=19,TAU=Math.PI*2;
const racers=[],keys={gas:false,brake:false,left:false,right:false,drift:false};
let selectedCat=0,state='menu',raceTime=0,countdown=0,last=performance.now(),audioOn=true,finishTimer=0;
const cats=[
 {name:'ソラ',fur:0xe9e8df,patch:0x313945,kart:0x2d76ff,max:48,accel:24,steer:2.0},
 {name:'ムギ',fur:0xd99839,patch:0xa95c20,kart:0xff382e,max:51,accel:22,steer:1.85},
 {name:'クロ',fur:0x15171b,patch:0x15171b,kart:0xbbff29,max:46.5,accel:25,steer:2.2},
 {name:'ミケ',fur:0xf1e8d5,patch:0x493831,kart:0xffbe25,max:47,accel:23,steer:2.02},
 {name:'ルナ',fur:0xbcc0c7,patch:0x737985,kart:0xb44cff,max:49,accel:22.5,steer:1.95},
 {name:'ハク',fur:0xf4f4f2,patch:0xd7d6d2,kart:0x16cdb0,max:47.8,accel:23.5,steer:2.08}
];

function mat(color,rough=.65,metal=.05){return new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal})}
function mesh(geo,material,shadow=true){const o=new THREE.Mesh(geo,material);o.castShadow=shadow;o.receiveShadow=shadow;return o}
function addWorld(){
 const ground=mesh(new THREE.PlaneGeometry(1100,1100),mat(0x507046,.95),false); ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;scene.add(ground);
 const roadShape=new THREE.Shape();
 for(let i=0;i<=160;i++){let a=i/160*TAU;roadShape.lineTo(Math.cos(a)*(trackA+trackWidth/2),Math.sin(a)*(trackB+trackWidth/2))}
 const hole=new THREE.Path();for(let i=160;i>=0;i--){let a=i/160*TAU;hole.lineTo(Math.cos(a)*(trackA-trackWidth/2),Math.sin(a)*(trackB-trackWidth/2))}roadShape.holes.push(hole);
 const road=mesh(new THREE.ShapeGeometry(roadShape,160),mat(0x25292d,.82),false);road.rotation.x=-Math.PI/2;road.position.y=.015;road.receiveShadow=true;scene.add(road);
 const lineMat=new THREE.MeshBasicMaterial({color:0xf0f0e8});
 for(let i=0;i<64;i+=2){const a=i/64*TAU,p=pointOnTrack(a,0),dash=mesh(new THREE.BoxGeometry(5,.025,.22),lineMat,false);dash.position.set(p.x,.05,p.z);dash.rotation.y=-a;scene.add(dash)}
 for(const off of [-trackWidth/2+.45,trackWidth/2-.45]){const pts=[];for(let i=0;i<=128;i++){let p=pointOnTrack(i/128*TAU,off);pts.push(new THREE.Vector3(p.x,.06,p.z))}const line=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),256,.16,4,true),new THREE.MeshBasicMaterial({color:0xffffff}));scene.add(line)}
 const curbMat=[mat(0xffffff,.8),mat(0xe52e2e,.75)];
 for(let i=0;i<100;i++){let a=i/100*TAU;for(const off of [-trackWidth/2-.2,trackWidth/2+.2]){let p=pointOnTrack(a,off),c=mesh(new THREE.BoxGeometry(4.1,.24,.75),curbMat[i%2]);c.position.set(p.x,.08,p.z);c.rotation.y=-a;scene.add(c)}}
 const start=mesh(new THREE.BoxGeometry(trackWidth,.03,3),new THREE.MeshBasicMaterial({map:checkerTexture()}),false);start.position.set(trackA,.07,0);start.rotation.y=Math.PI/2;scene.add(start);
 addScenery();
}
function checkerTexture(){const c=document.createElement('canvas');c.width=c.height=128;let x=c.getContext('2d');for(let y=0;y<8;y++)for(let i=0;i<8;i++){x.fillStyle=(i+y)%2?'#111':'#eee';x.fillRect(i*16,y*16,16,16)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,1);return t}
function addScenery(){
 const trunk=mat(0x4d3828,.95),leafM=[mat(0x315a38,.92),mat(0x426d3b,.95),mat(0x254833,.9)];
 for(let i=0;i<75;i++){let a=Math.random()*TAU,r=155+Math.random()*260,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<170&&Math.abs(z)<115)continue;let g=new THREE.Group(),tr=mesh(new THREE.CylinderGeometry(.7,1,7,7),trunk);tr.position.y=3.5;g.add(tr);let crown=mesh(new THREE.ConeGeometry(4+Math.random()*2,10+Math.random()*6,8),leafM[i%3]);crown.position.y=10;g.add(crown);g.position.set(x,0,z);g.scale.setScalar(.75+Math.random()*.65);scene.add(g)}
 const mountain=mat(0x778682,1);for(let i=0;i<22;i++){let a=i/22*TAU,r=390+Math.random()*80,m=mesh(new THREE.ConeGeometry(50+Math.random()*45,100+Math.random()*120,5),mountain,false);m.position.set(Math.cos(a)*r,35,Math.sin(a)*r);m.rotation.y=Math.random();scene.add(m)}
 const stand=mesh(new THREE.BoxGeometry(65,11,16),mat(0x555d65,.8,.2));stand.position.set(-20,5.5,-112);scene.add(stand);for(let j=0;j<5;j++)for(let i=0;i<18;i++){let fan=mesh(new THREE.SphereGeometry(.32,5,4),mat([0xf05b4f,0xf1ce55,0x4e9de8,0xffffff][(i+j)%4]),false);fan.position.set(-49+i*5.5,7+j*1.5,-103);scene.add(fan)}
 const boostP=pointOnTrack(Math.PI,0),boostPad=mesh(new THREE.BoxGeometry(4,.07,11),new THREE.MeshBasicMaterial({color:0x48eaff}),false);boostPad.position.set(boostP.x,.08,boostP.z);boostPad.rotation.y=Math.PI/2;scene.add(boostPad);
 const gantry=mat(0x1d2228,.55,.6);for(const z of [-trackWidth/2-2,trackWidth/2+2]){let p=mesh(new THREE.BoxGeometry(1,10,1),gantry);p.position.set(trackA,5,z);scene.add(p)}let top=mesh(new THREE.BoxGeometry(1,1,trackWidth+5),gantry);top.position.set(trackA,10,0);scene.add(top);let sign=mesh(new THREE.BoxGeometry(.7,3.8,16),mat(0x101318,.45,.35));sign.position.set(trackA-1,9.4,0);scene.add(sign);
 const signCanvas=document.createElement('canvas');signCanvas.width=1024;signCanvas.height=192;let s=signCanvas.getContext('2d');s.fillStyle='#101318';s.fillRect(0,0,1024,192);s.fillStyle='#d7ff37';s.font='900 86px sans-serif';s.textAlign='center';s.fillText('NEKO CIRCUIT',512,125);let tex=new THREE.CanvasTexture(signCanvas);let panel=mesh(new THREE.PlaneGeometry(16,3),new THREE.MeshBasicMaterial({map:tex}),false);panel.position.set(trackA-.62,9.4,0);panel.rotation.y=-Math.PI/2;scene.add(panel);
}
function pointOnTrack(a,offset=0){const x=Math.cos(a)*trackA,z=Math.sin(a)*trackB;const nx=Math.cos(a)/trackA,nz=Math.sin(a)/trackB,l=Math.hypot(nx,nz);return{x:x+nx/l*offset,z:z+nz/l*offset}}
function tangentAngle(a){return Math.atan2(trackB*Math.cos(a),-trackA*Math.sin(a))}

function createKart(cat,index){
 const g=new THREE.Group(),body=mesh(new THREE.BoxGeometry(3.5,.9,5.1),mat(cat.kart,.32,.35));body.position.y=1;g.add(body);const nose=mesh(new THREE.BoxGeometry(3.1,.5,1.25),mat(cat.kart,.35,.28));nose.position.set(0,1.1,-3);g.add(nose);
 const seat=mesh(new THREE.BoxGeometry(2.4,1.7,1.3),mat(0x17191e,.65));seat.position.set(0,2.05,.75);g.add(seat);
 const wheelMat=mat(0x111216,.86),rim=mat(0xaeb6bc,.25,.8);for(const x of [-2,2])for(const z of [-1.65,1.65]){let w=mesh(new THREE.CylinderGeometry(.72,.72,.62,14),wheelMat);w.rotation.z=Math.PI/2;w.position.set(x,.72,z);g.add(w);let hub=mesh(new THREE.CylinderGeometry(.3,.3,.66,12),rim);hub.rotation.z=Math.PI/2;hub.position.copy(w.position);g.add(hub)}
 const catG=new THREE.Group();let head=mesh(new THREE.SphereGeometry(1.03,18,14),mat(cat.fur,.85));head.scale.y=.88;catG.add(head);for(const x of [-.58,.58]){let ear=mesh(new THREE.ConeGeometry(.48,1.05,4),mat(cat.patch,.82));ear.position.set(x,.83,0);ear.rotation.y=Math.PI/4;catG.add(ear)}for(const x of [-.36,.36]){let eye=mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshBasicMaterial({color:0xbcecff}),false);eye.position.set(x,.13,-.94);catG.add(eye)}let muzzle=mesh(new THREE.SphereGeometry(.18,8,6),mat(0xe8b3a3,.9),false);muzzle.position.set(0,-.18,-1);catG.add(muzzle);catG.position.set(0,3.45,.45);catG.rotation.y=Math.PI;g.add(catG);
 const tail=mesh(new THREE.TorusGeometry(.72,.16,8,18,Math.PI*1.25),mat(cat.fur,.9));tail.position.set(1.15,3.1,1.25);tail.rotation.set(Math.PI/2,.4,0);g.add(tail);
 g.userData={cat,index,angle:-.12-index*.025,progress:0,lap:1,started:false,speed:0,lateral:(index%2?1:-1)*(2+Math.floor(index/2)*2.2),heading:0,finished:false,finishTime:0,boost:0};scene.add(g);racers.push(g);return g;
}
function resetRace(){racers.forEach((r,i)=>{let d=r.userData;d.angle=-.13-i*.022;d.progress=d.angle;d.lap=1;d.started=false;d.speed=0;d.lateral=(i%2?1:-1)*(2+Math.floor(i/2)*2.2);d.finished=false;d.boost=0;placeRacer(r)});raceTime=0;finishTimer=0;ui.lap.textContent='1';finish.classList.remove('active')}
function placeRacer(r){let d=r.userData,p=pointOnTrack(d.angle,d.lateral);r.position.set(p.x,.05,p.z);r.rotation.y=tangentAngle(d.angle)+Math.PI/2;d.heading=r.rotation.y}

addWorld();cats.forEach(createKart);const player=racers[0];resetRace();
function setPlayerCat(i){selectedCat=i;let old=racers[0],tempCat=cats[i];scene.remove(old);racers.shift();let fresh=createKart(tempCat,0);racers.pop();racers.unshift(fresh);resetRace()}

let audioCtx,engineOsc,engineGain;
function initAudio(){if(audioCtx)return;audioCtx=new AudioContext();engineOsc=audioCtx.createOscillator();engineGain=audioCtx.createGain();engineOsc.type='sawtooth';engineOsc.frequency.value=55;engineGain.gain.value=0;engineOsc.connect(engineGain).connect(audioCtx.destination);engineOsc.start()}
function beep(freq,dur=.12){if(!audioOn)return;initAudio();let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type='square';g.gain.setValueAtTime(.08,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+dur);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+dur)}

function beginRace(){initAudio();if(audioCtx.state==='suspended')audioCtx.resume();resetRace();snapCameraToKart();menu.classList.remove('active');hud.classList.remove('hidden');document.querySelector('#touch-controls').classList.remove('hidden');state='countdown';countdown=3.8}
function formatTime(t){let m=Math.floor(t/60),s=Math.floor(t%60),ms=Math.floor((t%1)*1000);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`}
function updatePlayer(dt){const r=racers[0],d=r.userData;if(d.finished)return;let accel=keys.gas?d.cat.accel:0;if(keys.brake)accel-=32;d.speed+=accel*dt;d.speed-=Math.sign(d.speed)*Math.min(Math.abs(d.speed),7.5*dt);d.speed=THREE.MathUtils.clamp(d.speed,-10,d.cat.max+(d.boost>0?13:0));if(d.boost>0){d.boost-=dt;d.speed+=28*dt}
 let turn=(keys.left?1:0)-(keys.right?1:0),speedFactor=THREE.MathUtils.clamp(Math.abs(d.speed)/20,0,1);d.lateral+=turn*d.cat.steer*dt*(keys.drift?8.5:5.3)*speedFactor*(d.speed>=0?1:-1);d.lateral=THREE.MathUtils.clamp(d.lateral,-trackWidth*.68,trackWidth*.68);
 let off=Math.max(0,Math.abs(d.lateral)-trackWidth*.48);if(off>0)d.speed*=Math.pow(.35,dt*(1+off*.2));d.angle+=d.speed*dt/(Math.sqrt(trackA*trackB));advance(r);placeRacer(r);r.rotation.z=THREE.MathUtils.lerp(r.rotation.z,-turn*.1,.12);r.children[3]?.rotateX(d.speed*dt*.4);
 const boostZone=Math.abs(normalizeAngle(d.angle)-Math.PI)<.055;if(boostZone&&d.speed>18&&d.boost<=0){d.boost=1.15;ui.boost.classList.remove('on');void ui.boost.offsetWidth;ui.boost.classList.add('on');beep(720,.18)}
 ui.speed.textContent=Math.round(Math.max(0,d.speed*4.25));ui.speedbar.style.width=Math.min(100,Math.max(0,d.speed/(d.cat.max+10)*100))+'%';ui.wrong.style.display=d.speed<-.5?'block':'none';
}
function updateAI(dt){for(let i=1;i<racers.length;i++){let r=racers[i],d=r.userData;if(d.finished)continue;let personality=.91+(i%3)*.025,target=d.cat.max*personality+(Math.sin(raceTime*.7+i)*1.4);d.speed=THREE.MathUtils.lerp(d.speed,target,dt*.45);d.angle+=d.speed*dt/Math.sqrt(trackA*trackB);let weave=Math.sin(raceTime*.45+i*2.1)*2.2;d.lateral=THREE.MathUtils.lerp(d.lateral,weave,dt*.22);advance(r);placeRacer(r)}}
function normalizeAngle(a){return((a%TAU)+TAU)%TAU}
function advance(r){let d=r.userData,n=normalizeAngle(d.angle),prev=normalizeAngle(d.progress);if(prev>5.7&&n<.5&&d.speed>0){if(!d.started){d.started=true}else{d.lap++;if(r===racers[0]){ui.lap.textContent=Math.min(3,d.lap);beep(d.lap>3?880:540,.25)}if(d.lap>3){d.finished=true;d.finishTime=raceTime;if(r===racers[0])endRace()}}}d.progress=d.angle}
function ranking(){return [...racers].sort((a,b)=>b.userData.angle-a.userData.angle)}
function endRace(){state='finished';finishTimer=1.4;let rank=ranking().indexOf(racers[0])+1,ord=['1st','2nd','3rd','4th','5th','6th'][rank-1];document.querySelector('#finish-place').textContent=ord;document.querySelector('#finish-line').textContent=rank===1?'猫界最速の走り。':rank<=3?'表彰台を肉球でつかんだ。':'次はもっと速く走れる。';document.querySelector('#result-time').textContent=formatTime(raceTime);engineGain.gain.value=0;beep(rank===1?1046:659,.5)}
function chasePose(){let r=racers[0],forward=new THREE.Vector3(-Math.sin(r.rotation.y),0,-Math.cos(r.rotation.y)),target=r.position.clone().add(new THREE.Vector3(0,2.8,0));return{target,forward,desired:target.clone().addScaledVector(forward,-10.5).add(new THREE.Vector3(0,5.5,0))}}
function snapCameraToKart(){let pose=chasePose();camera.position.copy(pose.desired);camera.lookAt(pose.target.clone().addScaledVector(pose.forward,8))}
function updateCamera(dt){let pose=chasePose();camera.position.lerp(pose.desired,1-Math.pow(.001,dt));camera.lookAt(pose.target.clone().addScaledVector(pose.forward,8))}
function animate(now){requestAnimationFrame(animate);let dt=Math.min(.033,(now-last)/1000);last=now;
 if(state==='countdown'){countdown-=dt;let n=Math.ceil(countdown);countdownEl.textContent=n>0?n:'GO!';if(Math.floor(countdown+dt)!==Math.floor(countdown)&&n>0)beep(420+n*80);if(countdown<=0){state='racing';countdownEl.textContent='GO!';beep(880,.3);setTimeout(()=>countdownEl.textContent='',650)}}
 if(state==='racing'){raceTime+=dt;updatePlayer(dt);updateAI(dt);let rank=ranking().indexOf(racers[0])+1;ui.pos.textContent=rank;ui.time.textContent=formatTime(raceTime)}
 if(state==='finished'){updateAI(dt);finishTimer-=dt;if(finishTimer<=0&&!finish.classList.contains('active'))finish.classList.add('active')}
 updateCamera(dt);if(engineGain){let s=Math.abs(racers[0].userData.speed);engineGain.gain.setTargetAtTime(audioOn&&state==='racing'?.025:0,audioCtx.currentTime,.05);engineOsc.frequency.setTargetAtTime(48+s*2.4,audioCtx.currentTime,.04)}renderer.render(scene,camera)}

function keySet(code,on){if(['ArrowUp','KeyW'].includes(code))keys.gas=on;if(['ArrowDown','KeyS'].includes(code))keys.brake=on;if(['ArrowLeft','KeyA'].includes(code))keys.left=on;if(['ArrowRight','KeyD'].includes(code))keys.right=on;if(code==='Space')keys.drift=on;if(code==='KeyR'&&on&&state==='racing'){racers[0].userData.lateral=0;racers[0].userData.speed=10;placeRacer(racers[0])}}
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keySet(e.code,true)});addEventListener('keyup',e=>keySet(e.code,false));
document.querySelectorAll('[data-key]').forEach(b=>{let k=b.dataset.key,map={gas:'gas',brake:'brake',left:'left',right:'right'};for(const ev of ['pointerdown','pointerenter'])b.addEventListener(ev,e=>{if(e.buttons||ev==='pointerdown'){e.preventDefault();keys[map[k]]=true}});for(const ev of ['pointerup','pointercancel','pointerleave'])b.addEventListener(ev,e=>{e.preventDefault();keys[map[k]]=false})});
document.querySelectorAll('.cat-choice').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.cat-choice').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');setPlayerCat(Number(b.dataset.cat))}));
document.querySelector('#start').addEventListener('click',beginRace);document.querySelector('#restart').addEventListener('click',()=>{finish.classList.remove('active');beginRace()});document.querySelector('#sound').addEventListener('click',e=>{audioOn=!audioOn;e.currentTarget.textContent=audioOn?'♪':'×';if(audioCtx&&audioOn)audioCtx.resume()});
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()});
camera.position.set(trackA+11,7,-13);camera.lookAt(trackA,2,0);renderer.render(scene,camera);loading.classList.remove('active');menu.classList.add('active');requestAnimationFrame(animate);
