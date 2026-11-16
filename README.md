# ResearchOS TECT — Autonomy & Control Algorithms

**A local-first research workbench for reproducible control experiments, constrained motion simulation, and synthetic multi-agent coordination.**

[![CI](https://github.com/tltmgnt/ResearchOS-TECT-Autonomy-Control-Algorithms/actions/workflows/ci.yml/badge.svg)](https://github.com/tltmgnt/ResearchOS-TECT-Autonomy-Control-Algorithms/actions/workflows/ci.yml)

> **Status:** implemented and testable **research MVP**, not a robotics runtime, fielded autonomy system, safety-certified controller, or defense-grade platform. Independent project; not affiliated with DARPA or any government agency. All states and signals are **synthetic**. No sensors, hardware actuators, online data or external AI services.

## What works today

- **Control benchmark** — deterministic one-dimensional bounded point-mass simulation with **PID**, discrete **LQR**, and approximate constrained **MPC**.
- **Scenario laboratory** — configure plant mass, drag, limits, target steps, external disturbances, seeded sensor perturbation, step size, and duration.
- **Controller tuning** — edit PID gains and anti-windup bound; LQR objective weights; MPC weights, horizon, and optimization iterations.
- **Charts & metrics** — trajectories, control input, tracking error, RMS effort, settling time, saturation and numerical boundary interventions.
- **Two-agent coordination** — idealized leader/follower spacing control, leader braking events, geometric separation guard and gap-error metrics.
- **Evidence & reports** — reviewer notes, validated JSON import/export, structured result JSON, trajectory CSV, Markdown study memo, and browser-local save.
- **CLI & automated tests** — repeatable headless experiment runs, built-in `node:test` tests and GitHub Actions CI.
- **No third-party runtime or build dependencies** — Node 22+ for the server/CLI; browser ES modules in a standards-compliant browser.

## Start the app

Requires **Node.js 22 or later**. No `npm install` is necessary.

```bash
git clone https://github.com/tltmgnt/ResearchOS-TECT-Autonomy-Control-Algorithms.git
cd ResearchOS-TECT-Autonomy-Control-Algorithms
npm start
```

Open **http://127.0.0.1:8000/**. The static development server binds to loopback only. Opening `index.html` with `file://` is unsupported because this app uses ES modules. You may serve the repository root with another local static server.

```bash
npm test                         # deterministic simulation tests
npm run build                    # generates dist/ (no external deps)
npm run check                    # tests and static bundle
PORT=8030 npm start              # alternate local port
SERVE_DIST=1 npm start           # serve the built app
```

## Headless research workflow

```bash
node cli.mjs examples/study.json
node cli.mjs examples/study.json results.json
node cli.mjs examples/study.json trajectories.csv
node cli.mjs examples/study.json report.md
```

CLI writes only to **new** output files; it will not overwrite an existing artifact. Browser exports are download-only and remain local.

## Research protocol

1. Open **Scenario lab**. Define synthetic plant dynamics, bounded workspace and disturbance timing. Apply parameters.
2. Select **Control algorithms**. Tune PID, LQR or MPC and compare tracking, effort and constraint interventions.
3. Open **Multi-agent coordination** to vary a two-agent leader–follower spacing experiment.
4. Record assumptions, evidence references and reviewer rationale under **Evidence & exports**.
5. Download study JSON, results JSON/CSV and a Markdown research memo. Save study JSON outside browser storage as a backup.

## Model & evaluation boundaries

The fixed-step simulator integrates a 1-D point mass with viscous drag. PID uses conditional integral anti-windup; LQR uses iterative discrete Riccati gains; finite-horizon MPC uses an approximate projected-gradient solver with bounded commands and **soft** predicted workspace penalties. Command, velocity and position clipping in the simulator are **not physical safety guarantees**. The two-agent gap guard is a geometric projection, **not verified collision avoidance**.

Same inputs produce the same numeric outputs for the same version. Results have **no confidence intervals, probabilistic claims, operational validation, or proven stability/feasibility guarantee**. See [model contract](docs/MODEL.md) and [security & limitations](docs/SECURITY.md).

**Not implemented:** real robotics integrations, telemetry, external APIs, reinforcement learning, multi-dimensional flight/vehicle dynamics, formal verification, institutional identities, distributed collaboration, encrypted persistence or production hosting. These are potential future research directions, not existing capabilities.

## Architecture

```text
Browser UI (HTML / CSS / ES modules)
        |                 \
  local study JSON     charts / reports
        |                 /
  src/model.mjs — deterministic simulation core
    PID | LQR | MPC | two-agent gap controller
        |
        +---- browser localStorage (local drafts only)
        +---- CLI input/output (files)

Node server.mjs -> loopback static assets only, no data collection
```

Imported study JSON must pass versioned, strict validation. Repeated runs have bounded steps. User-entered text is escaped before it appears in the UI; exports contain the original study notes. No secrets or real system information should be entered into this research demo. Browser storage is not encrypted; export backups regularly.

## License and authorship

Apache-2.0. Contributions, method reviews, and reproducibility feedback are welcome.
