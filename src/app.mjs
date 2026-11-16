import { DEFAULT_STUDY, CONTROLLERS, validateStudy, compareControllers, simulateCoordination, analyzeStudy, resultsCSV, markdownReport, lqrGains } from './model.mjs';

const STORAGE_KEY = 'researchos-tect-autonomy-v1';
const NAV = [
  ['overview','◫','Overview'], ['controllers','⊞','Control algorithms'], ['experiment','◈','Scenario lab'],
  ['coordination','≋','Multi-agent coordination'], ['reports','▤','Evidence & exports'], ['about','ⓘ','Methods & safety']
];
const PALETTE = {PID:'#6bb8ff',LQR:'#a99aff',MPC:'#69d5c7',TARGET:'#e8b77f',LEADER:'#6bb8ff',FOLLOWER:'#69d5c7',GAP:'#a99aff'};
const $ = (selector,base=document) => base.querySelector(selector);
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const fmt = (n,places=2) => n === null || n === undefined ? 'N/A' : Number(n).toLocaleString('en-US',{maximumFractionDigits:places,minimumFractionDigits:places});
const cloned = v => JSON.parse(JSON.stringify(v));
let study = cloned(DEFAULT_STUDY);
try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) study = validateStudy(JSON.parse(saved)); } catch { /* Storage may be disabled */ }
let active = 'overview', selectedController = 'PID', chartMetric = 'position', analysis = null, updated = false;

function run() {
  try {
    study = validateStudy(study);
    analysis = { comparison: compareControllers(study), coordination: simulateCoordination(study) };
    updated = true;
    persist();
    return true;
  } catch (err) { notice(err.message,'error'); return false; }
}
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(study));}catch{/* unavailable */}}
function notice(message,type='success') {
  const el=$('#notice');el.textContent=message;el.className=`notice ${type==='error'?'error':''}`;el.hidden=false;
}
function clearNotice(){$('#notice').hidden=true;}
function download(filename,text,mime){
  const url=URL.createObjectURL(new Blob([text],{type:mime}));const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportData(kind){
  try {
    const data=analyzeStudy(study);
    if(kind==='study') download('researchos-tect-study.json',JSON.stringify(study,null,2)+'\n','application/json');
    if(kind==='results') download('researchos-tect-results.json',JSON.stringify(data,null,2)+'\n','application/json');
    if(kind==='csv') download('researchos-tect-trajectories.csv',resultsCSV(data),'text/csv');
    if(kind==='markdown') download('researchos-tect-report.md',markdownReport(study,data),'text/markdown');
    notice(`Exported ${kind} to a local file.`);
  } catch(err){notice(err.message,'error');}
}
function pageTitle(){return ({overview:'Autonomy Overview',controllers:'Control Algorithms',experiment:'Scenario Laboratory',coordination:'Multi-Agent Coordination',reports:'Evidence & Exports',about:'Methods & Safety'})[active];}
function nav(){
  $('#nav').innerHTML=NAV.map(([id,icon,name],i)=>`<button type="button" class="nav-link ${active===id?'active':''}" data-page="${id}" ${active===id?'aria-current="page"':''}><span class="nav-icon" aria-hidden="true">${icon}</span>${name}<span class="nav-number">0${i+1}</span></button>`).join('');
}
function header(){const page=pageTitle();$('#page-title').textContent=page;$('#breadcrumb').textContent=page.toUpperCase();nav();}
function intro(kicker,title,description,action=''){
  return `<div class="section-intro"><div><div class="eyebrow">${escapeHTML(kicker)}</div><h2>${escapeHTML(title)}</h2><p>${escapeHTML(description)}</p></div>${action}</div>`;
}
function card(title,subtitle,body,extra='') {return `<section class="card"><div class="card-header"><div><h3>${escapeHTML(title)}</h3>${subtitle?`<p>${escapeHTML(subtitle)}</p>`:''}</div>${extra}</div><div class="card-body">${body}</div></section>`;}
function kpi(label,value,hint,color='var(--blue)'){return `<div class="kpi" style="--tone:${color}"><div class="label">${escapeHTML(label.toUpperCase())}</div><div class="value">${escapeHTML(value)}</div><div class="hint">${escapeHTML(hint)}</div></div>`;}
function legend(items){return `<div class="chart-legend">${items.map(([label,color])=>`<span style="--tone:${color}">${escapeHTML(label)}</span>`).join('')}</div>`;}

/** Pure string SVG line chart. Domain scaled from all data, without external libraries. */
function chart(series,options={}){
  const W=850,H=300,left=56,right=18,top=18,bottom=38,w=W-left-right,h=H-top-bottom;
  const all=series.flatMap(s=>s.points.map(p=>p[1]));
  const values=all.filter(Number.isFinite);
  let lo=options.minY??Math.min(...values),hi=options.maxY??Math.max(...values);
  if(!Number.isFinite(lo)||!Number.isFinite(hi)){lo=0;hi=1;}
  if(lo===hi){lo-=1;hi+=1;}
  if(options.minY===undefined||options.maxY===undefined){const pad=(hi-lo)*.11;lo-=pad;hi+=pad;}
  const maxTime=Math.max(1,...series.flatMap(s=>s.points.map(p=>p[0])));
  const X=t=>left+t/maxTime*w,Y=v=>top+(hi-v)/(hi-lo)*h;
  const grid=Array.from({length:5},(_,i)=>{const val=lo+i*(hi-lo)/4,y=Y(val);return `<line class="gridline" x1="${left}" y1="${y}" x2="${left+w}" y2="${y}"/><text x="${left-10}" y="${y+4}" text-anchor="end">${fmt(val,1)}</text>`;}).join('');
  const xticks=Array.from({length:6},(_,i)=>{const t=i*maxTime/5,x=X(t);return `<line class="gridline" x1="${x}" y1="${top}" x2="${x}" y2="${top+h}"/><text text-anchor="middle" x="${x}" y="${H-14}">${fmt(t,0)}s</text>`;}).join('');
  const paths=series.map(s=>{
    const d=s.points.filter(p=>Number.isFinite(p[1])).map((p,i)=>`${i?'L':'M'}${X(p[0]).toFixed(2)},${Y(p[1]).toFixed(2)}`).join(' ');
    return `<path class="trace ${s.dashed?'trace-dashed':''}" stroke="${s.color}" d="${d}"/>`;
  }).join('');
  return `<div class="chart-frame"><svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHTML(options.label||'Time series chart')}"><rect x="${left}" y="${top}" width="${w}" height="${h}" rx="4" fill="#111d2e"/>${grid}${xticks}<line class="axis" x1="${left}" y1="${top+h}" x2="${left+w}" y2="${top+h}"/>${paths}</svg></div>`;
}
function trackingSeries(metric=chartMetric){
  const runs=analysis.comparison.runs;
  const out=runs.map(run=>({name:run.controller,color:PALETTE[run.controller],points:run.points.map(p=>[p.time,p[metric]])}));
  if(metric==='position')out.push({name:'Target',color:PALETTE.TARGET,dashed:true,points:runs[0].points.map(p=>[p.time,p.target])});
  return out;
}
function allMetrics(){return analysis.comparison.runs.map(r=>({name:r.controller,...r.metrics}));}
function bestController(){return [...allMetrics()].sort((a,b)=>a.integratedAbsoluteError-b.integratedAbsoluteError)[0];}
function metricButtons(){return `<div class="tab-row" role="group" aria-label="Chart variable">${[['position','Position'],['velocity','Velocity'],['control','Control effort']].map(([v,n])=>`<button type="button" class="tab ${chartMetric===v?'active':''}" data-chart="${v}" aria-pressed="${chartMetric===v}">${n}</button>`).join('')}</div>`;}
function compareTable(){return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Controller</th><th>IAE ↓</th><th>RMS effort ↓</th><th>Final error ↓</th><th>Settling (s)</th><th>Saturation count</th><th>Boundary hits</th></tr></thead><tbody>${analysis.comparison.runs.map(r=>{const m=r.metrics;return `<tr><td><span class="controller-chip"><span class="swatch" style="background:${PALETTE[r.controller]}"></span>${r.controller}</span></td><td>${fmt(m.integratedAbsoluteError)}</td><td>${fmt(m.rmsEffort)}</td><td>${fmt(m.finalError,3)}</td><td>${m.settlingTime===null?'N/A':fmt(m.settlingTime,1)}</td><td>${m.actuatorSaturations}</td><td>${m.boundaryInterventions}</td></tr>`;}).join('')}</tbody></table></div>`;}
function comparisonChart(){return `${metricButtons()}${chart(trackingSeries(),{label:'Tracking trajectories for PID, LQR, MPC and target'})}${legend(trackingSeries().map(s=>[s.name,s.color]))}<p class="chart-caption">Deterministic synthetic run. Time in seconds. ${chartMetric==='position'?'Position in abstract units.':chartMetric==='velocity'?'Velocity in units/second.':'Acceleration command in units/second².'} Changes to parameters require Apply & run.</p>`;}
function overview(){
  const b=bestController(),c=analysis.coordination.metrics,e=study.experiment;
  const metrics=analysis.comparison.runs;
  const summary=metrics.map(r=>`<div class="controller-item"><div class="controller-top"><span class="controller-name"><span class="swatch" style="background:${PALETTE[r.controller]}"></span>${r.controller}</span><strong>${fmt(r.metrics.integratedAbsoluteError)} <small>IAE</small></strong></div><div class="meta"><span>RMS effort ${fmt(r.metrics.rmsEffort)}</span><span>Final error ${fmt(r.metrics.finalError,3)}</span></div></div>`).join('');
  return `${intro('Systems research / overview','Controller performance at a glance','A fully local, reproducible comparison of PID, LQR and finite-horizon MPC on a bounded synthetic point-mass system.','<span class="status-pill">● EXPERIMENT READY</span>')}
  <div class="grid kpis">${kpi('Lowest tracking error',b.name,`${fmt(b.integratedAbsoluteError)} integrated absolute error`,PALETTE[b.name])}${kpi('Experiment duration',`${fmt(e.seconds,1)}s`,`${fmt(e.dt,2)}s fixed simulation step`,'var(--blue)')}${kpi('Active algorithms','03','PID · LQR · MPC','var(--purple)')}${kpi('Coordination min gap',fmt(c.minGap),`${c.safetyCorrections} idealized safety projections`,'var(--green)')}</div>
  <div class="split"><div class="stack">${card('Position tracking & control','Compare algorithm trajectories over the same scenario',comparisonChart())}${card('Performance benchmark','Lower integrated absolute error is better; trade-offs matter',compareTable())}</div><div class="stack">${card('Algorithm scorecard','Identical plant and experiment parameters',`<div class="controller-list">${summary}</div><p class="best-note">The lowest error in this synthetic experiment does not indicate universal controller superiority. Review effort, saturation and stability assumptions.</p>`)}${card('Scenario configuration','Current synthetic research conditions',`<div class="info-line"><small>Target position</small><strong>${fmt(e.targetPosition)}</strong></div><div class="info-line"><small>Disturbance window</small><strong>${fmt(e.disturbanceStart,1)}–${fmt(e.disturbanceEnd,1)}s</strong></div><div class="info-line"><small>Disturbance acceleration</small><strong>${fmt(e.disturbanceAccel)}</strong></div><div class="info-line"><small>Measurement noise</small><strong>${fmt(e.sensorNoise)}</strong></div><div class="form-footer"><button class="btn btn-outline" data-page="experiment">Edit scenario →</button></div>`)}<div class="callout"><strong>Research scope:</strong> Offline, 1D simulations with synthetic state and disturbances. No real sensors, vehicles, infrastructure, external APIs or actuators are connected.</div></div></div>`;
}
function numberField(path,label,hint,min,max,step){
  const value=path.split('.').reduce((a,k)=>a[k],study);
  return `<div class="field"><label for="${path}">${escapeHTML(label)}</label><input required id="${path}" name="${path}" type="number" step="${step}" min="${min}" max="${max}" value="${value}"><small>${escapeHTML(hint)}</small></div>`;
}
function textField(path,label,hint){
  const value=path.split('.').reduce((a,k)=>a[k],study);
  return `<div class="field field-full"><label for="${path}">${escapeHTML(label)}</label><input required id="${path}" name="${path}" type="text" maxlength="120" value="${escapeHTML(value)}"><small>${escapeHTML(hint)}</small></div>`;
}
function formSubmit(label='Apply & run experiment'){return `<div class="form-footer"><button class="btn btn-accent" type="submit">▶ ${escapeHTML(label)}</button><span class="form-help">Validates parameters, recalculates and saves locally.</span></div>`;}
function configForm(fields,label){return `<form class="config-form" novalidate><div class="form-grid">${fields.join('')}</div>${formSubmit(label)}</form>`;}
const ALGOS = {
  PID: {
    fullname:'Proportional–Integral–Derivative',
    summary:'Error feedback with an integral term for steady-state correction and derivative damping. A simple reference baseline with integral clamping and conditional anti-windup.',
    equation:'u = Kp·(target − x) + Ki·∫error dt − Kd·velocity',
    assumptions:'Error-only feedback. Derivative uses measured velocity. No formal robust stability certificate.',
    fields:[['kp','Proportional gain (Kp)','Position error response',0,30,.01],['ki','Integral gain (Ki)','Accumulated offset correction',0,20,.01],['kd','Derivative gain (Kd)','Velocity damping',0,30,.01],['integralLimit','Integral clamp','Magnitude bound on accumulated error',0,300,.1]]
  },
  LQR: {
    fullname:'Discrete Linear–Quadratic Regulator',
    summary:'Full-state feedback computed from an iterative discrete Riccati equation for a linearized double integrator with viscous drag. Command limits are applied after solving.',
    equation:'u = −K · [position − target, velocity]ᵀ',
    assumptions:'Linear state-space approximation; weights express a trade-off, not operational guarantees. Saturation can violate unconstrained optimality.',
    fields:[['positionWeight','Position error weight (Qx)','Higher values prioritize tracking',.01,100,.01],['velocityWeight','Velocity weight (Qv)','Higher values damp velocity',0,100,.01],['effortWeight','Effort weight (R)','Higher values penalize actuation',.01,100,.01]]
  },
  MPC: {
    fullname:'Finite-Horizon Predictive Control',
    summary:'A receding-horizon quadratic tracker using bounded control inputs, warm-started projected-gradient optimization and soft penalties on predicted position bounds.',
    equation:'min Σ (Qx·error² + Qv·velocity² + R·control²) + terminal penalties',
    assumptions:'Approximate solver, soft position constraints, finite iterations. No feasibility certificate or hard-state constraint guarantee.',
    fields:[['positionWeight','Position error weight','Cost for tracking deviation',.01,100,.01],['velocityWeight','Velocity weight','Cost for higher speed',0,100,.01],['effortWeight','Control weight','Cost for acceleration',.01,100,.01],['horizon','Planning horizon','Number of predicted time steps (integer)',2,30,1],['iterations','Solver iterations','Projected-gradient iterations per step (integer)',1,90,1]]
  }
};
function controllers(){
  const algorithm=ALGOS[selectedController],g=lqrGains(study.model,study.experiment.dt,study.controllers.LQR);
  return `${intro('Algorithm laboratory','Design, tune and evaluate controllers','Run reproducible experiments with three distinct feedback approaches on the same synthetic plant.')}
  <div class="split"><div class="stack">${card('Algorithm workbench','Choose a controller and tune its design parameters',`<div class="tab-row" role="group" aria-label="Select controller">${CONTROLLERS.map(name=>`<button type="button" class="tab ${selectedController===name?'active':''}" data-controller="${name}" aria-pressed="${selectedController===name}">${name}</button>`).join('')}</div><div class="algo-detail grid-gap-top"><h2>${algorithm.fullname}</h2><p>${algorithm.summary}</p><div class="callout"><strong>Control law</strong><div class="code-inline">${escapeHTML(algorithm.equation)}</div></div><p>${algorithm.assumptions}</p>${selectedController==='LQR'?`<div class="pill-row"><span class="pill">K-position: ${fmt(g.kp,3)}</span><span class="pill">K-velocity: ${fmt(g.kd,3)}</span></div>`:''}</div><div class="grid-gap-top">${configForm(algorithm.fields.map(([key,...rest])=>numberField(`controllers.${selectedController}.${key}`,...rest)))}</div>`)}${card('Comparison results','Same initial state, target and disturbance',compareTable())}</div><div class="stack">${card('Trajectory preview','Position, speed and control input for all algorithms',comparisonChart())}${card('Control engineering notes','Interpreting the synthetic model',`<div class="bullet-cards"><div class="bullet-card"><h3>Plant dynamics</h3><p>One-dimensional mass + viscous drag, integrated at a fixed step. Simulation clamps acceleration, velocity and workspace bounds.</p></div><div class="bullet-card"><h3>Reproducible inputs</h3><p>All runs share the same scenario and seeded sensor perturbations. Save the study JSON to reproduce results.</p></div><div class="bullet-card"><h3>Safety caveat</h3><p>Boundary clipping is a numerical model guard. It does not demonstrate safe stopping, constraint satisfaction or certified control on physical equipment.</p></div></div>`)}</div></div>`;
}
function experiment(){
  const m=study.model,e=study.experiment;
  const fields=[
    numberField('experiment.seconds','Simulation horizon','Seconds of synthetic execution',2,60,.1),numberField('experiment.dt','Integration step','Fixed time step in seconds',.02,.25,.01),
    numberField('experiment.startPosition','Initial position','Within the declared position bounds',-1000,1000,.1),numberField('experiment.startVelocity','Initial velocity','Within maximum velocity',-50,50,.1),
    numberField('experiment.targetPosition','Target position','Position setpoint after target time',-1000,1000,.1),numberField('experiment.targetAt','Target applied at','Seconds from start',0,60,.1),
    numberField('experiment.disturbanceStart','Disturbance starts','Seconds from start',0,60,.1),numberField('experiment.disturbanceEnd','Disturbance ends','Seconds from start',0,60,.1),
    numberField('experiment.disturbanceAccel','External disturbance','Signed acceleration in model units',-10,10,.05),numberField('experiment.sensorNoise','Sensor perturbation','Bounded deterministic uniform noise amplitude',0,2,.01),
    numberField('experiment.seed','Random seed','Integer for deterministic pseudo-random input',0,2147483647,1)];
  const modelFields=[numberField('model.mass','Plant mass','Synthetic inertial parameter',.1,200,.1),numberField('model.drag','Viscous drag','Velocity-proportional resistance',0,5,.01),numberField('model.maxAcceleration','Acceleration limit','Symmetric actuation bound',.1,20,.1),numberField('model.maxVelocity','Velocity limit','Symmetric speed bound',.2,50,.1),numberField('model.minPosition','Lower position bound','Numerical workspace boundary',-1000,1000,.1),numberField('model.maxPosition','Upper position bound','Numerical workspace boundary',-1000,1000,.1)];
  return `${intro('Experiments / scenario builder','Configure the dynamical system','Define controlled plant characteristics, setpoints, external disturbances, noise and fixed-step simulation timing.')}
  <div class="split"><div class="stack">${card('Motion scenario','Experiment design and deterministic perturbations',configForm(fields))}${card('Plant model','Bounded point-mass parameters',configForm(modelFields,'Apply plant changes'))}</div>
  <div class="stack">${card('Live experiment summary','Inputs currently used in latest applied run',`<div class="info-line"><small>Position range</small><strong>[${fmt(m.minPosition)}, ${fmt(m.maxPosition)}]</strong></div><div class="info-line"><small>Model mass</small><strong>${fmt(m.mass)}</strong></div><div class="info-line"><small>Target shift</small><strong>${fmt(e.startPosition)} → ${fmt(e.targetPosition)}</strong></div><div class="info-line"><small>Disturbance</small><strong>${fmt(e.disturbanceAccel)} (${fmt(e.disturbanceStart)}–${fmt(e.disturbanceEnd)}s)</strong></div><div class="info-line"><small>Data transport</small><span class="status-pill">LOCAL ONLY</span></div><p class="footer-note">No live data, model API, or control output connection.</p>`)}${card('Scenario response','Controller positions under the configured scenario',`${chart(trackingSeries('position'),{label:'Position response under synthetic disturbance'})}${legend([['PID',PALETTE.PID],['LQR',PALETTE.LQR],['MPC',PALETTE.MPC],['Target',PALETTE.TARGET]])}`)}<div class="callout warning"><strong>Bounded simulation ≠ safety certification.</strong> Setting position and velocity limits only constrains this numerical prototype. Real systems need independent verification and tested safety mechanisms.</div></div></div>`;
}
function coordination(){
  const c=study.coordination,a=analysis.coordination;
  const fields=[numberField('coordination.seconds','Run duration','Simulation horizon',2,60,.1),numberField('coordination.dt','Time step','Fixed seconds per step',.02,.25,.01),
    numberField('coordination.leaderTargetSpeed','Leader cruise speed','Leader desired velocity',0,10,.1),numberField('coordination.desiredGap','Desired spacing','Follower target gap',.5,20,.1),
    numberField('coordination.minGap','Minimum modeled spacing','Geometric lower bound in simulation',.2,20,.05),numberField('coordination.followerKp','Gap controller Kp','Relative distance feedback',0,20,.1),
    numberField('coordination.followerKd','Gap controller Kd','Relative velocity damping',0,20,.1),numberField('coordination.leaderBrakeAt','Leader braking event','When the leader begins a stop',0,60,.1),
    numberField('coordination.leaderBrakeSeconds','Braking duration','Seconds of commanded stop',0,20,.1),numberField('coordination.leaderMaxAcceleration','Leader acceleration limit','Symmetric actuation bound',.1,12,.1),
    numberField('coordination.followerMaxAcceleration','Follower acceleration limit','Symmetric actuation bound',.1,12,.1)];
  const gapSeries=[{color:PALETTE.GAP,name:'Actual separation',points:a.points.map(p=>[p.time,p.gap])},{color:PALETTE.TARGET,name:'Desired separation',dashed:true,points:a.points.map(p=>[p.time,p.desiredGap])}];
  const posSeries=[{color:PALETTE.LEADER,name:'Leader',points:a.points.map(p=>[p.time,p.leaderPosition])},{color:PALETTE.FOLLOWER,name:'Follower',points:a.points.map(p=>[p.time,p.followerPosition])}];
  return `${intro('Coordination / two-agent lab','Cooperative motion & spacing','Study leader–follower feedback and a declared synthetic braking event. Two point masses share a simple one-dimensional route.')}
  <div class="grid kpis">${kpi('Minimum separation',fmt(a.metrics.minGap),'Abstract distance units','var(--green)')}${kpi('Mean spacing error',fmt(a.metrics.meanGapError),'Absolute tracking gap','var(--blue)')}${kpi('Safety projections',String(a.metrics.safetyCorrections),'Numerical corrections, not hardware braking','var(--orange)')}${kpi('Simulated samples',String(a.metrics.samples),`${fmt(c.dt,2)}s time step`,'var(--purple)')}</div>
  <div class="split"><div class="stack">${card('Relative spacing trajectory','Separation compared with the desired follower gap',`${chart(gapSeries,{label:'Leader follower gap'})}${legend([['Measured gap',PALETTE.GAP],['Desired gap',PALETTE.TARGET]])}`)}${card('Agent trajectories','Simulated leader and follower positions',`${chart(posSeries,{label:'Leader and follower position trajectories'})}${legend([['Leader',PALETTE.LEADER],['Follower',PALETTE.FOLLOWER]])}`)}</div><div class="stack">${card('Coordination parameters','Tune the following dynamics',configForm(fields,'Apply coordination study'))}<div class="callout warning"><strong>Safety qualification:</strong> The gap guard projects the follower to a safe simulated coordinate if the discrete model crosses the minimum. This is not a validated braking controller, collision-avoidance system or multi-agent robotics stack.</div></div></div>`;
}
function reports(){
  const n=study.notes.length;
  return `${intro('Research workflow / exports','Study evidence & reproducibility','Record assumptions and findings, export deterministic trajectories, and share a reproducible study configuration.')}
  <div class="split"><div class="stack">${card('Study identity','Local research metadata',`<form id="metadata-form"><div class="form-grid">${textField('title','Study title','120-character maximum')}<div class="field field-full"><label for="description">Research description</label><textarea id="description" name="description" maxlength="600" rows="4">${escapeHTML(study.description)}</textarea></div></div><div class="form-footer"><button type="submit" class="btn btn-accent">Save metadata</button></div></form>`)}
  ${card('Research notes',`${n} recorded finding${n===1?'':'s'} · saved in study JSON`,`<form id="note-form"><div class="field"><label for="note-body">Evidence, assumptions, or reviewer comments</label><textarea maxlength="2000" required id="note-body" name="body" placeholder="Document model assumptions, references, evaluation findings, or limitations…"></textarea></div><div class="form-footer"><button type="submit" class="btn btn-muted">+ Add research note</button></div></form><div class="grid-gap-top">${n?study.notes.slice().reverse().map(note=>`<div class="note"><div class="note-top"><time>${escapeHTML(note.at)}</time><button type="button" class="btn btn-danger btn-small" data-delete-note="${escapeHTML(note.id)}" aria-label="Remove research note">Remove</button></div><p>${escapeHTML(note.body)}</p></div>`).join(''):'<div class="empty">No notes yet. Add an assumption or evidence reference above.</div>'}</div>`)}</div>
  <div class="stack">${card('Export experiment artifacts','Files are generated in your browser and are not uploaded',`<div class="bullet-cards"><div class="bullet-card"><h3>Study configuration</h3><p>Canonical versioned JSON containing model, control gains, scenarios and notes.</p><div class="form-footer"><button class="btn btn-muted btn-small" data-export="study">↧ Export study JSON</button></div></div><div class="bullet-card"><h3>Simulation results</h3><p>Reproduce tracking and two-agent trajectories with metrics in structured JSON.</p><div class="form-footer"><button class="btn btn-muted btn-small" data-export="results">↧ Export results JSON</button></div></div><div class="bullet-card"><h3>Timeseries data</h3><p>Export normalized per-step controller and follower trajectories for downstream analytics.</p><div class="form-footer"><button class="btn btn-muted btn-small" data-export="csv">↧ Export CSV</button></div></div><div class="bullet-card"><h3>Technical study memo</h3><p>Reproducible Markdown summary of inputs, results, caveats and notes.</p><div class="form-footer"><button class="btn btn-muted btn-small" data-export="markdown">↧ Export research memo</button></div></div></div>`)}
  ${card('Import or restore a study','Validated JSON files up to 1 MB',`<div class="field"><label for="study-file">Choose local study JSON</label><input id="study-file" type="file" accept=".json,application/json" aria-label="Import a study JSON"></div><p class="footer-note grid-gap-top">Import replaces your current study after validation. Export a backup first. Results files are not study configurations.</p><div class="form-footer"><button class="btn btn-outline" data-action="reset" type="button">Reset to example study</button></div>`)}<div class="callout"><strong>Data handling:</strong> Results and notes persist in this browser only. Clearing website storage removes local drafts. Export JSON for durable backups. Local browser data is not encrypted or signed.</div></div></div>`;
}
function about(){return `${intro('Methodology / research integrity','Scope, architecture & safety','A practical end-to-end research workspace for local experiments; it is not a production autonomy stack.')}
  <div class="split-equal">${card('Scientific methods','Algorithm contract and assumptions',`<div class="bullet-cards"><div class="bullet-card"><h3>Discrete plant</h3><p>Velocity evolves under bounded acceleration and viscous drag; position integrates the new velocity at a fixed step. Commands are saturated at configurable limits.</p></div><div class="bullet-card"><h3>PID</h3><p>Proportional–integral–derivative position tracking with integral clamping and conditional anti-windup.</p></div><div class="bullet-card"><h3>LQR</h3><p>State-feedback gains computed from the discrete algebraic Riccati equation for a linear, unconstrained approximate model.</p></div><div class="bullet-card"><h3>MPC</h3><p>Finite-horizon receding optimization with actuator projection and soft predicted position penalties. Solver is approximate.</p></div><div class="bullet-card"><h3>Two-agent coordination</h3><p>Leader speed control and follower relative-gap PD control. Idealized geometric safety projection prevents overlap numerically.</p></div></div>`)}
  ${card('Security & responsible operation','Boundaries and controls',`<div class="bullet-cards"><div class="bullet-card"><h3>No direct hardware access</h3><p>No actuator commands, ROS topics, control interfaces, remote device APIs, or operational endpoints.</p></div><div class="bullet-card"><h3>Local computation</h3><p>No dependencies, cookies, analytics, external model calls or backend data store. The development server listens on loopback by default.</p></div><div class="bullet-card"><h3>Input controls</h3><p>Strict versioned study schema, numeric bounds, capped simulation length, validated imports and escaped user-visible text.</p></div><div class="bullet-card"><h3>Research limitations</h3><p>Not a formal stability proof, reliability assessment, safety certificate or independently validated robotics benchmark.</p></div></div>`)}</div>
  <div class="grid-gap-top">${card('Reproducibility protocol','A repeatable approach to research comparison',`<div class="pill-row"><span class="pill">01 / Define synthetic plant</span><span class="pill">02 / Configure controller gains</span><span class="pill">03 / Run common disturbance</span><span class="pill">04 / Review quantitative metrics</span><span class="pill">05 / Document assumptions</span><span class="pill">06 / Export immutable artifact copies</span></div><p class="muted-paragraph" style="margin-top:15px">The same study JSON yields the same numerical results under the documented simulator version. Actual control systems require separately verified dynamics, sensors, latency handling, actuator safety, fail-safe engineering, cybersecurity testing and independent physical validation.</p><p class="footer-note">Independent ResearchOS TECT project. No affiliation with DARPA or any government agency is claimed.</p>`)}</div>`;}
function render(){
  header();
  const pages={overview,controllers,experiment,coordination,reports,about};
  $('#content').innerHTML=pages[active]();
  document.title=`${pageTitle()} | ResearchOS TECT`;
  $('#sidebar').classList.remove('open');
}
function setPage(page){if(!NAV.some(x=>x[0]===page))return;active=page;clearNotice();render();window.scrollTo({top:0,behavior:'instant'});}
function applyConfig(form){
  const copy=cloned(study),formData=new FormData(form);
  for(const [path,raw] of formData.entries()){
    const parts=path.split('.');if(parts.length<2||parts.length>3)throw new Error('Invalid parameter path');
    let target=copy;for(let i=0;i<parts.length-1;i++){if(!Object.hasOwn(target,parts[i]))throw new Error('Unknown parameter');target=target[parts[i]];}
    const key=parts.at(-1);if(!Object.hasOwn(target,key))throw new Error('Unknown parameter');
    if(typeof target[key]!=='number')throw new Error('Only numeric parameters are editable here');
    if(raw.trim()==='')throw new Error(`${key} cannot be empty`);
    const value=Number(raw);if(!Number.isFinite(value))throw new Error(`${key} requires a finite number`);target[key]=value;
  }
  study=validateStudy(copy);run();render();notice('Validated, simulated and saved locally.');
}
function handleSubmit(event){
  if(event.target.matches('.config-form')){
    event.preventDefault();try{applyConfig(event.target);}catch(err){notice(err.message,'error');}return;
  }
  if(event.target.id==='metadata-form'){
    event.preventDefault();try{
      const newStudy=cloned(study),data=new FormData(event.target);newStudy.title=String(data.get('title'));newStudy.description=String(data.get('description'));
      study=validateStudy(newStudy);persist();render();notice('Study metadata saved locally.');
    }catch(err){notice(err.message,'error');}return;
  }
  if(event.target.id==='note-form'){
    event.preventDefault();try{
      const body=String(new FormData(event.target).get('body')||'').trim();if(!body)throw new Error('Enter a note first');
      const n=cloned(study);n.notes.push({id:`note-${Date.now()}-${n.notes.length}`,at:new Date().toISOString(),body});
      study=validateStudy(n);persist();render();notice('Research note saved.');
    }catch(err){notice(err.message,'error');}
  }
}
function handleClick(event){
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.page){setPage(button.dataset.page);return;}
  if(button.dataset.controller){selectedController=button.dataset.controller;render();return;}
  if(button.dataset.chart){chartMetric=button.dataset.chart;render();return;}
  if(button.dataset.export){exportData(button.dataset.export);return;}
  if(button.dataset.deleteNote){const removed=study.notes.filter(n=>n.id!==button.dataset.deleteNote);if(removed.length===study.notes.length)return;study.notes=removed;persist();render();notice('Note removed.');return;}
  if(button.dataset.action==='reset'){
    if(!window.confirm('Replace the current locally saved study with the example? Export your study first if needed.'))return;
    study=cloned(DEFAULT_STUDY);run();render();notice('Example study restored.');return;
  }
  if(button.id==='menu-toggle'){$('#sidebar').classList.toggle('open');return;}
  if(button.id==='run-top'){if(run()){render();notice('All controller and coordination experiments completed.');}return;}
  if(button.id==='export-top'){exportData('study');}
}
async function handleImport(event){
  if(event.target.id!=='study-file')return;
  const file=event.target.files?.[0];if(!file)return;
  try{
    if(file.size>1_000_000)throw new Error('The study file exceeds the 1 MB limit');
    const parsed=JSON.parse(await file.text());const validated=validateStudy(parsed);
    study=validated;run();render();notice(`Imported and validated “${study.title}”.`);
  }catch(err){notice(`Import failed: ${err.message}`,'error');event.target.value='';}
}

document.addEventListener('click',handleClick);
document.addEventListener('submit',handleSubmit);
document.addEventListener('change',handleImport);
run();render();
