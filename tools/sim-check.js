const fs=require('fs');
const html=fs.readFileSync(process.argv[2]||require("path").join(__dirname,"..","index.html"),"utf8");
const simSrc=html.split('/*SIM-BEGIN*/')[1].split('/*SIM-END*/')[0];
const synSrc=html.split('/*SYNTH-BEGIN*/')[1].split('/*SYNTH-END*/')[0];
const createSim=new Function(simSrc+'\nreturn createSim;')();
const SYN=new Function(synSrc+'\nreturn SYNTH_SRC;')();
const EngineSynth=new Function(SYN+'\nreturn EngineSynth;')();
const events=[];
const sim=createSim({event:e=>events.push(e)});
const S=sim.S; let T=0;
function run(sec, f){ const h=1/240; for(let i=0;i<sec*240;i++){ f&&f(); sim.step(h); T+=h; } }
const log=(l)=>console.log(`${l.padEnd(26)} t=${T.toFixed(1).padStart(5)} rpm=${S.rpm.toFixed(0).padStart(5)} kmh=${(S.v*3.6).toFixed(1).padStart(6)} ratio=${S.ratio.toFixed(2)} lock=${S.lock?1:0} map=${S.map.toFixed(2)} turbo=${S.turbo.toFixed(2)} comb=${S.comb.toFixed(0)} eng=${S.engine} g=${S.gear}${S.manual?'M':''}${S.dstep?'step':''}${S.vgear+1} msg=${S.msgT>0?S.msg:''}`);
sim.ignitionPress(); run(0.4); log('crank pending');
run(0.5); log('cranking'); run(0.6); log('caught'); run(1.0); log('flare'); run(3); log('cold idle');
S.brake=1; sim.selectGear('D'); run(0.3); log('engage 0.3s'); run(1); log('D held brake');
S.brake=0; run(4); log('creep 4s');
// WOT launch
S.pedal=1; for(let k=0;k<12;k++){ run(0.5); log('WOT'); }
// lift -> bov
S.pedal=0; run(0.05); log('lift'); console.log('events', JSON.stringify(events.slice(-3)));
run(3); log('coast');
S.pedal=0.25; run(8); log('cruise 25%');
S.pedal=0.5; run(4); log('50%');
S.pedal=0; S.brake=0.6; run(3); log('braking'); run(3); log('braking');
S.brake=0; sim.selectGear('S'); S.pedal=1; for(let k=0;k<8;k++){run(0.5);log('S WOT');}
S.pedal=0; run(2); log('S coast');
sim.manualShift(-1); run(0.5); log('M down');
S.brake=1; run(6); log('stop'); S.brake=1; sim.selectGear('N'); S.pedal=1; run(1.5); log('N rev limiter');
S.pedal=0; run(2); log('N idle');
const ev={}; events.forEach(e=>ev[e.type]=(ev[e.type]||0)+1); console.log(ev);

// synth levels
function level(p,label,ev){ const s=new EngineSynth(48000); Object.assign(s.t,p,{vol:1}); s.vol=1;s.rpm=p.rpm;s.load=p.load;s.turbo=p.turbo||0;s.thr=p.thr||0;s.speed=p.speed||0;s.starter=p.starter||0;s.boost=p.boost||0;
 const b=new Float32Array(48000); s.render(b.subarray(0,4800),4800); if(ev) s.event(ev); s.render(b,48000);
 let r=0,pk=0; for(const x of b){r+=x*x;pk=Math.max(pk,Math.abs(x));} console.log(label.padEnd(18),'rms',Math.sqrt(r/b.length).toFixed(3),'peak',pk.toFixed(3)); }
level({rpm:0,load:0,starter:1,running:0,cut:1},'crank 0');
level({rpm:250,load:0,starter:1,running:0,cut:1},'cranking');
level({rpm:800,load:0.12,thr:0.1,running:1,cut:0},'idle');
level({rpm:1600,load:0.3,thr:0.25,running:1,cut:0,speed:60},'cruise');
level({rpm:3500,load:0.8,thr:1,running:1,cut:0,turbo:0.7,boost:0.5,speed:60},'mid WOT');
level({rpm:6200,load:1,thr:1,running:1,cut:0,turbo:1,boost:0.9,speed:120},'redline WOT');
level({rpm:3000,load:0,thr:0,running:1,cut:1,speed:80},'overrun');
level({rpm:2500,load:0,thr:0,running:1,cut:1,speed:80,turbo:0.8},'bov',{type:'bov',amt:1});
