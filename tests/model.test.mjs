import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STUDY, VERSION, CONTROLLERS, validateStudy, clamp, lqrGains, simulate, compareControllers, simulateCoordination, analyzeStudy, resultsCSV, markdownReport } from '../src/model.mjs';
const clone=()=>structuredClone(DEFAULT_STUDY);

test('example is valid and validation returns a defensive copy',()=>{
  const s=clone(),v=validateStudy(s);assert.equal(v.version,VERSION);v.title='mutated';assert.notEqual(v.title,s.title);
});
test('rejects unknown schema fields and ambiguous input types',()=>{
  const s=clone();s.prototype='bad';assert.throws(()=>validateStudy(s),/Unexpected/);
  const t=clone();t.experiment.dt='0.1';assert.throws(()=>validateStudy(t),/finite/);
  const n=clone();n.experiment.dt=NaN;assert.throws(()=>validateStudy(n),/finite/);
});
test('rejects unsafe or contradictory experiment settings',()=>{
  const a=clone();a.experiment.targetPosition=100;assert.throws(()=>validateStudy(a),/bounds/);
  const b=clone();b.coordination.minGap=b.coordination.desiredGap;assert.throws(()=>validateStudy(b),/Minimum gap/);
  const c=clone();c.experiment.disturbanceStart=12;c.experiment.disturbanceEnd=6;assert.throws(()=>validateStudy(c),/windows/);
  const d=clone();d.experiment.seconds=60;d.experiment.dt=.02;assert.doesNotThrow(()=>validateStudy(d));
});
test('bounded strict note schema and maximum limits',()=>{
  const a=clone();a.notes=[{id:'1',at:'2026-11-16',body:'x'}];assert.equal(validateStudy(a).notes.length,1);
  a.notes[0].body='x'.repeat(2001);assert.throws(()=>validateStudy(a),/characters/);
});
test('stable deterministic tracking trajectories for each controller',()=>{
  for(const name of CONTROLLERS){const a=simulate(clone(),name),b=simulate(clone(),name);assert.deepEqual(a,b);assert.equal(a.controller,name);assert.equal(a.points.length,181);}
});
test('tracking time series enforces numerical actuator, speed and position bounds',()=>{
  const study=clone();for(const name of CONTROLLERS){const a=simulate(study,name);for(const p of a.points){assert.ok(Math.abs(p.control)<=study.model.maxAcceleration+1e-6);assert.ok(Math.abs(p.velocity)<=study.model.maxVelocity+1e-6);assert.ok(p.position>=study.model.minPosition-1e-6);assert.ok(p.position<=study.model.maxPosition+1e-6);}}
});
test('reference step changes at declared time and settled controller ends near target',()=>{
  const a=simulate(clone(),'LQR');assert.equal(a.points[0].target,0);assert.equal(a.points[10].target,9);assert.ok(a.metrics.finalError<.05);assert.ok(a.metrics.actuatorSaturations>0);
});
test('LQR gains are positive for default positive weights',()=>{
  const s=clone(),g=lqrGains(s.model,s.experiment.dt,s.controllers.LQR);assert.ok(g.kp>0&&g.kd>0);assert.ok(Number.isFinite(g.kp));
});
test('MPC optimizer runs without NaN under extreme valid gains',()=>{
  const s=clone();s.controllers.MPC.positionWeight=100;s.controllers.MPC.velocityWeight=100;s.controllers.MPC.effortWeight=.01;s.controllers.MPC.horizon=30;s.controllers.MPC.iterations=25;
  const a=simulate(s,'MPC');assert.ok(a.points.every(p=>Number.isFinite(p.position)&&Number.isFinite(p.control)));assert.ok(a.metrics.finalError>=0);
});
test('seeded sensor perturbations change trajectory but remain repeatable',()=>{
  const s=clone();s.experiment.sensorNoise=.2;
  const one=simulate(s,'PID');assert.deepEqual(one,simulate(s,'PID'));
  s.experiment.seed=24;assert.notDeepEqual(one.points,simulate(s,'PID').points);
});
test('external disturbance modifies outcomes',()=>{
  const a=clone(),b=clone();b.experiment.disturbanceAccel=0;
  assert.notDeepEqual(simulate(a,'LQR').points,simulate(b,'LQR').points);
});
test('coordination synthetic spacing guard prevents discrete overlap',()=>{
  const s=clone(),a=simulateCoordination(s);
  assert.equal(a.points.length,201);assert.ok(a.points.every(p=>p.gap>=s.coordination.minGap-1e-5));
});
test('aggressive coordination causes modeled safety corrections',()=>{
  const s=clone();s.coordination.leaderBrakeAt=2;s.coordination.leaderBrakeSeconds=8;s.coordination.desiredGap=1.6;s.coordination.minGap=1.5;s.coordination.followerKp=10;s.coordination.followerKd=0;
  const a=simulateCoordination(s);assert.ok(a.metrics.safetyCorrections>0);assert.ok(a.metrics.minGap>=1.5-1e-6);
});
test('comparison produces exactly PID, LQR and MPC under a shared scenario',()=>{
  const x=compareControllers(clone());assert.deepEqual(x.runs.map(r=>r.controller),CONTROLLERS);assert.equal(x.runs[0].points[10].time,x.runs[1].points[10].time);
});
test('JSON, CSV and Markdown produce usable reproducible outputs',()=>{
  const s=clone(),a=analyzeStudy(s),csv=resultsCSV(a),md=markdownReport(s,a);
  assert.equal(a.comparison.runs.length,3);assert.ok(csv.startsWith('experiment,controller,time_seconds'));assert.ok(csv.includes('coordination,FOLLOWER'));
  assert.ok(md.includes('| PID |'));assert.ok(md.includes('Simulated')||md.includes('synthetic'));assert.equal(clamp(12,-2,10),10);
});
