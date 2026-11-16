/** ResearchOS TECT: deterministic, bounded, synthetic 1D control research. No hardware integration. */
export const VERSION = 1;
export const CONTROLLERS = ['PID', 'LQR', 'MPC'];
export const DEFAULT_STUDY = {
  version: VERSION,
  title: 'Precision motion under disturbance',
  description: 'Synthetic point-mass position tracking with a limited actuator.',
  model: { mass: 1.2, drag: 0.22, maxAcceleration: 3.2, maxVelocity: 4.5, minPosition: -2, maxPosition: 14 },
  experiment: { seconds: 18, dt: 0.1, startPosition: 0, startVelocity: 0, targetPosition: 9, targetAt: 1, disturbanceStart: 6, disturbanceEnd: 10, disturbanceAccel: -0.95, sensorNoise: 0, seed: 37 },
  controllers: {
    PID: { kp: 3.1, ki: 0.17, kd: 2.5, integralLimit: 8 },
    LQR: { positionWeight: 6.4, velocityWeight: 1.2, effortWeight: 0.42 },
    MPC: { positionWeight: 6.4, velocityWeight: 1.3, effortWeight: 0.5, horizon: 16, iterations: 35 }
  },
  coordination: { seconds: 20, dt: 0.1, leaderTargetSpeed: 2.8, desiredGap: 3.2, minGap: 1.35, followerKp: 2.4, followerKd: 2.6, leaderBrakeAt: 10, leaderBrakeSeconds: 3, leaderMaxAcceleration: 2, followerMaxAcceleration: 2.8 },
  notes: []
};
const clone = x => JSON.parse(JSON.stringify(x));
const isPlain = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const finite = (x, field, lo, hi) => { if (typeof x !== 'number' || !Number.isFinite(x) || x < lo || x > hi) throw new Error(`${field} must be a finite number from ${lo} to ${hi}`); return x; };
const text = (x, field, max = 180) => { if (typeof x !== 'string' || x.length > max || !x.trim()) throw new Error(`${field} must be 1-${max} characters`); return x.trim(); };
const exact = (x, name, keys) => {
  if (!isPlain(x)) throw new Error(`${name} must be an object`);
  for (const key of Object.keys(x)) if (!keys.includes(key)) throw new Error(`Unexpected ${name}.${key}`);
  for (const key of keys) if (!(key in x)) throw new Error(`Missing ${name}.${key}`);
};
function numbers(x, label, limits) { exact(x, label, Object.keys(limits)); for (const [key, [lo, hi]] of Object.entries(limits)) finite(x[key], `${label}.${key}`, lo, hi); }
export function validateStudy(input) {
  exact(input, 'study', ['version','title','description','model','experiment','controllers','coordination','notes']);
  if (input.version !== VERSION) throw new Error(`Only study version ${VERSION} is supported`);
  text(input.title,'title',120);
  if (typeof input.description !== 'string' || input.description.length > 600) throw new Error('description must be text under 600 characters');
  numbers(input.model,'model',{ mass:[0.1,200], drag:[0,5], maxAcceleration:[0.1,20], maxVelocity:[0.2,50], minPosition:[-1000,1000], maxPosition:[-1000,1000] });
  const m=input.model; if(m.maxPosition-m.minPosition<1) throw new Error('Position range must be at least 1 unit');
  numbers(input.experiment,'experiment',{ seconds:[2,60],dt:[0.02,0.25],startPosition:[-1000,1000],startVelocity:[-50,50],targetPosition:[-1000,1000],targetAt:[0,60],disturbanceStart:[0,60],disturbanceEnd:[0,60],disturbanceAccel:[-10,10],sensorNoise:[0,2],seed:[0,2147483647] });
  const e=input.experiment;
  if(e.startPosition<m.minPosition||e.startPosition>m.maxPosition||e.targetPosition<m.minPosition||e.targetPosition>m.maxPosition) throw new Error('Starting and target positions must be within model bounds');
  if(Math.abs(e.startVelocity)>m.maxVelocity) throw new Error('Starting velocity exceeds maxVelocity');
  if(e.targetAt>e.seconds||e.disturbanceStart>e.disturbanceEnd||e.disturbanceEnd>e.seconds) throw new Error('Experiment time windows must be inside duration');
  if(e.seconds/e.dt>3000) throw new Error('Maximum 3000 tracking steps');
  if(!Number.isInteger(e.seed)) throw new Error('Experiment seed must be an integer');
  exact(input.controllers,'controllers',CONTROLLERS);
  numbers(input.controllers.PID,'controllers.PID',{kp:[0,30],ki:[0,20],kd:[0,30],integralLimit:[0,300]});
  numbers(input.controllers.LQR,'controllers.LQR',{positionWeight:[0.01,100],velocityWeight:[0,100],effortWeight:[0.01,100]});
  numbers(input.controllers.MPC,'controllers.MPC',{positionWeight:[0.01,100],velocityWeight:[0,100],effortWeight:[0.01,100],horizon:[2,30],iterations:[1,90]});
  if(!Number.isInteger(input.controllers.MPC.horizon)||!Number.isInteger(input.controllers.MPC.iterations)) throw new Error('MPC horizon and iterations must be integers');
  numbers(input.coordination,'coordination',{seconds:[2,60],dt:[0.02,0.25],leaderTargetSpeed:[0,10],desiredGap:[0.5,20],minGap:[0.2,20],followerKp:[0,20],followerKd:[0,20],leaderBrakeAt:[0,60],leaderBrakeSeconds:[0,20],leaderMaxAcceleration:[0.1,12],followerMaxAcceleration:[0.1,12]});
  const c=input.coordination;
  if(c.minGap>=c.desiredGap) throw new Error('Minimum gap must be less than desired gap');
  if(c.leaderBrakeAt+c.leaderBrakeSeconds>c.seconds) throw new Error('Leader braking window exceeds duration');
  if(c.seconds/c.dt>3000) throw new Error('Maximum 3000 coordination steps');
  if(!Array.isArray(input.notes)||input.notes.length>100) throw new Error('notes must be an array of up to 100 entries');
  for(let i=0;i<input.notes.length;i++){const n=input.notes[i];exact(n,`notes[${i}]`,['id','at','body']);text(n.id,`notes[${i}].id`,80);text(n.at,`notes[${i}].at`,60);text(n.body,`notes[${i}].body`,2000);}
  return clone(input);
}
export const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
function random(seed){let s=(seed>>>0)||0x6D2B79F5;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
function dynamics(m,dt){const a11=1-m.drag*dt,a01=dt*a11,b1=dt/m.mass,b0=dt*b1;return{a11,a01,b1,b0};}
export function lqrGains(model,dt,w){
  const{a11,a01,b0,b1}=dynamics(model,dt);let p00=w.positionWeight,p01=0,p11=w.velocityWeight,k0=0,k1=0;
  for(let i=0;i<1200;i++){
    const pb0=p00*b0+p01*b1,pb1=p01*b0+p11*b1,g0=pb0,g1=a01*pb0+a11*pb1,den=w.effortWeight+b0*pb0+b1*pb1;
    k0=g0/den;k1=g1/den;
    const n00=w.positionWeight+p00-g0*g0/den,n01=a01*p00+a11*p01-g0*g1/den,n11=w.velocityWeight+a01*a01*p00+2*a01*a11*p01+a11*a11*p11-g1*g1/den;
    const d=Math.max(Math.abs(n00-p00),Math.abs(n01-p01),Math.abs(n11-p11));p00=n00;p01=n01;p11=n11;if(d<1e-9)break;
  }
  return {kp:k0,kd:k1};
}
function mpc(model,dt,w){
  const{a01,a11,b0,b1}=dynamics(model,dt),n=w.horizon;
  let plan=Array(n).fill(0);
  return({x,v},target)=>{
    plan=plan.slice(1).concat(0);
    const uMax=model.maxAcceleration,q=w.positionWeight,qv=w.velocityWeight,r=w.effortWeight;
    const xs=new Float64Array(n+1),vs=new Float64Array(n+1),g=new Float64Array(n);
    const penalty=p=>p<model.minPosition?p-model.minPosition:p>model.maxPosition?p-model.maxPosition:0;
    for(let iter=0;iter<w.iterations;iter++){
      xs[0]=x;vs[0]=v;
      for(let k=0;k<n;k++){vs[k+1]=a11*vs[k]+b1*plan[k];xs[k+1]=xs[k]+a01*vs[k]+b0*plan[k];}
      let lx=2*q*3*(xs[n]-target)+60*penalty(xs[n]),lv=2*qv*3*vs[n];
      for(let k=n-1;k>=0;k--){
        g[k]=2*r*plan[k]+b0*lx+b1*lv;
        const nx=2*q*(xs[k]-target)+60*penalty(xs[k])+lx;
        const nv=2*qv*vs[k]+a01*lx+a11*lv;
        lx=nx;lv=nv;
      }
      const alpha=Math.min(0.055,0.40/(2*r+0.15*q*n*dt*dt+0.03));
      for(let k=0;k<n;k++)plan[k]=clamp(plan[k]-alpha*g[k],-uMax,uMax);
    }
    return plan[0];
  };
}
function controller(name,study){
  const{model:m,experiment:e}=study;
  if(name==='PID'){
    const p=study.controllers.PID;let integral=0;
    return(s,target)=>{
      const error=target-s.x,potential=clamp(integral+error*e.dt,-p.integralLimit,p.integralLimit);
      const request=p.kp*error+p.ki*potential-p.kd*s.v;
      if(Math.abs(request)<=m.maxAcceleration||Math.sign(request)!==Math.sign(error))integral=potential;
      return p.kp*error+p.ki*integral-p.kd*s.v;
    };
  }
  if(name==='LQR'){
    const g=lqrGains(m,e.dt,study.controllers.LQR);
    return(s,target)=>-g.kp*(s.x-target)-g.kd*s.v;
  }
  if(name==='MPC')return mpc(m,e.dt,study.controllers.MPC);
  throw new Error(`Unknown controller ${name}`);
}
function plant(state,effort,disturbance,dt,m){
  const u=clamp(effort,-m.maxAcceleration,m.maxAcceleration);
  let v=clamp(state.v+(u/m.mass-m.drag*state.v+disturbance)*dt,-m.maxVelocity,m.maxVelocity);
  let x=state.x+v*dt,boundaryIntervention=false;
  if(x<m.minPosition||x>m.maxPosition){x=clamp(x,m.minPosition,m.maxPosition);v=0;boundaryIntervention=true;}
  return{x,v,u,saturated:effort!==u,boundaryIntervention};
}
const r6=x=>Math.round(x*1e6)/1e6;
export function simulate(studyInput,name){
  const s=validateStudy(studyInput);
  if(!CONTROLLERS.includes(name))throw new Error(`Unsupported controller ${name}`);
  const{model:m,experiment:e}=s,choose=controller(name,s),rng=random(e.seed),steps=Math.round(e.seconds/e.dt);
  let state={x:e.startPosition,v:e.startVelocity};
  let integratedError=0,effortIntegral=0,maxError=0,saturations=0,boundaryInterventions=0,settledAt=null,withinSince=null;
  const points=[];
  for(let k=0;k<=steps;k++){
    const t=k*e.dt,target=t+1e-9>=e.targetAt?e.targetPosition:e.startPosition;
    const disturbance=t>=e.disturbanceStart&&t<e.disturbanceEnd?e.disturbanceAccel:0;
    const error=Math.abs(target-state.x);
    maxError=Math.max(maxError,error);
    if(t>=e.targetAt){
      if(error<=Math.max(0.08,0.02*Math.abs(e.targetPosition-e.startPosition))&&Math.abs(state.v)<0.25){if(withinSince===null)withinSince=t;}
      else withinSince=null;
    }
    if(k===steps){if(withinSince!==null)settledAt=withinSince;points.push({time:r6(t),target:r6(target),position:r6(state.x),velocity:r6(state.v),control:0,disturbance});break;}
    const observed={x:state.x+(rng()*2-1)*e.sensorNoise,v:state.v+(rng()*2-1)*e.sensorNoise*0.3};
    const next=plant(state,choose(observed,target),disturbance,e.dt,m);
    integratedError+=error*e.dt;effortIntegral+=next.u*next.u*e.dt;
    if(next.saturated)saturations++;if(next.boundaryIntervention)boundaryInterventions++;
    points.push({time:r6(t),target:r6(target),position:r6(state.x),velocity:r6(state.v),control:r6(next.u),disturbance});
    state={x:next.x,v:next.v};
  }
  const last=points.at(-1);
  return{controller:name,metrics:{integratedAbsoluteError:r6(integratedError),rmsEffort:r6(Math.sqrt(effortIntegral/(steps*e.dt))),finalError:r6(Math.abs(last.target-last.position)),maxAbsoluteError:r6(maxError),settlingTime:settledAt===null?null:r6(settledAt-e.targetAt),actuatorSaturations:saturations,boundaryInterventions,samples:points.length},points};
}
export function compareControllers(input){const s=validateStudy(input);return{version:VERSION,study:{title:s.title,experiment:s.experiment,model:s.model},runs:CONTROLLERS.map(name=>simulate(s,name))};}

/** Idealized one-lane, two-agent relative-spacing simulation with geometric safety projection. */
export function simulateCoordination(input){
  const s=validateStudy(input),c=s.coordination,steps=Math.round(c.seconds/c.dt),dt=c.dt;
  let leader={x:c.desiredGap,v:0},follower={x:0,v:0};
  let corrections=0,minGap=Infinity,gapError=0;
  const points=[];
  for(let k=0;k<=steps;k++){
    const t=k*dt,gap=leader.x-follower.x;
    minGap=Math.min(minGap,gap);gapError+=Math.abs(gap-c.desiredGap)*(k===steps?0:dt);
    points.push({time:r6(t),leaderPosition:r6(leader.x),followerPosition:r6(follower.x),leaderVelocity:r6(leader.v),followerVelocity:r6(follower.v),gap:r6(gap),desiredGap:c.desiredGap});
    if(k===steps)break;
    const braking=t>=c.leaderBrakeAt&&t<c.leaderBrakeAt+c.leaderBrakeSeconds;
    const speed=braking?0:c.leaderTargetSpeed;
    const la=clamp(2*(speed-leader.v),-c.leaderMaxAcceleration,c.leaderMaxAcceleration);
    const lv=clamp(leader.v+la*dt,0,c.leaderTargetSpeed);
    const nextLead={v:lv,x:leader.x+lv*dt};
    const fa=clamp(c.followerKp*(gap-c.desiredGap)+c.followerKd*(leader.v-follower.v),-c.followerMaxAcceleration,c.followerMaxAcceleration);
    const fv=clamp(follower.v+fa*dt,0,c.leaderTargetSpeed*1.6+1);
    let nextFollow={v:fv,x:follower.x+fv*dt};
    if(nextLead.x-nextFollow.x<c.minGap){nextFollow={v:Math.min(nextLead.v,nextFollow.v),x:nextLead.x-c.minGap};corrections++;}
    leader=nextLead;follower=nextFollow;
  }
  return{metrics:{minGap:r6(minGap),meanGapError:r6(gapError/c.seconds),safetyCorrections:corrections,samples:points.length},points};
}
export function analyzeStudy(input){const s=validateStudy(input);return{schemaVersion:VERSION,createdBy:'ResearchOS TECT deterministic simulator',comparison:compareControllers(s),coordination:simulateCoordination(s)};}
const cell=v=>{const x=v===null||v===undefined?'':String(v);return /[",\r\n]/.test(x)?`"${x.replaceAll('"','""')}"`:x;};
export function resultsCSV(a){
  const lines=[['experiment','controller','time_seconds','target','position','velocity','control','disturbance','gap']];
  for(const run of a.comparison.runs)for(const p of run.points)lines.push(['tracking',run.controller,p.time,p.target,p.position,p.velocity,p.control,p.disturbance,'']);
  for(const p of a.coordination.points)lines.push(['coordination','FOLLOWER',p.time,'',p.followerPosition,p.followerVelocity,'','',p.gap]);
  return lines.map(x=>x.map(cell).join(',')).join('\n')+'\n';
}
export function markdownReport(input,analysis=analyzeStudy(input)){
  const s=validateStudy(input),m=s.model,e=s.experiment;
  const lines=['# ResearchOS TECT — autonomy and control study','',`**Study:** ${s.title.replaceAll(/[\r\n]/g,' ')}`,'','**Status:** Synthetic local-only simulation. Not validated for physical systems.','','## Method','',
    'Bounded 1D point mass, semi-implicit Euler integration. PID (anti-windup), LQR (iterative discrete Riccati), MPC (approximate projected gradient). Simulated actuator and position clamping do not establish real-world safety.','',
    `Mass ${m.mass}; drag ${m.drag}; acceleration ±${m.maxAcceleration}; position bounds [${m.minPosition}, ${m.maxPosition}].`,'',
    `Tracking ${e.seconds}s at ${e.dt}s; target ${e.targetPosition} at ${e.targetAt}s; disturbance ${e.disturbanceAccel} from ${e.disturbanceStart}s to ${e.disturbanceEnd}s.`,'',
    '## Controller comparison','','| Controller | IAE | RMS effort | Final error | Settling time (s) | Saturations | Boundary interventions |','|---|---:|---:|---:|---:|---:|---:|'];
  for(const run of analysis.comparison.runs){const x=run.metrics;lines.push(`| ${run.controller} | ${x.integratedAbsoluteError} | ${x.rmsEffort} | ${x.finalError} | ${x.settlingTime??'N/A'} | ${x.actuatorSaturations} | ${x.boundaryInterventions} |`);}
  lines.push('','## Coordination','',`Mean gap error ${analysis.coordination.metrics.meanGapError}; minimum gap ${analysis.coordination.metrics.minGap}; geometric interventions ${analysis.coordination.metrics.safetyCorrections}.`,'','## Research notes','');
  if(s.notes.length)for(const n of s.notes)lines.push(`- ${n.at}: ${n.body.replaceAll(/[\r\n]/g,' ')}`);else lines.push('_No notes recorded._');
  lines.push('','## Limitations','','Deterministic synthetic experiments only. Approximate MPC has no formal stability/feasibility proof. Simulated boundary clamp is not a hardware safety mechanism. No robotics integration, real actuators, certified control, physical validation, real sensor streams, stochastic guarantees, or multi-dimensional vehicle dynamics.','');
  return lines.join('\n');
}
