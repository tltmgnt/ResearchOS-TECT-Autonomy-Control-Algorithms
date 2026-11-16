# Security, privacy and responsible use

## Threat model

- **Synthetic only:** This project has no connection to robots, drones, external devices, critical infrastructure, or defense systems. The simulation itself cannot control hardware.
- **Untrusted studies:** Import accepts JSON files up to 1 MB. The parser validates exact keys, finite numeric ranges, study version, note counts and lengths, duration/step bounds, and logical constraints. The UI escapes imported text rather than injecting raw markup.
- **Local data:** Browser drafts persist to `localStorage` on the origin. This data is not encrypted or durable. A different browser profile or port may not share drafts. A user can export studies, reports and trajectories.
- **Static server:** The bundled Node.js static server listens on `127.0.0.1` only. It disallows non-GET/HEAD methods, hidden paths, path traversal and unknown file extensions. It does not handle uploads or save remote inputs.
- **No network dependency:** Frontend assets, simulation model and research computations are offline; the CSP forbids remote connections and does not allow inline scripts. The UI uses inline CSS variables for chart legend colors.
- **CSV and report content:** Trajectory columns are numeric/fixed identifiers. Markdown notes are plain, escaped only in the UI; exported content may contain researcher text and should be reviewed before external publication.

## What is *not* assured

- This is not a safety-certified control system, physical failsafe, cyber-physical security platform, real-time supervisor, or validated multi-agent collision-avoidance stack.
- Local browser storage is not suitable for regulated, classified, proprietary or sensitive information.
- Numerical state clamps and simulated spacing projections are modeling conveniences, not proofs of actuator, timing or braking safety.
- Automated unit tests and CI do not replace verification, adversarial security assessment, domain expert review or operational testing.
- There is no account authentication, role separation, transport encryption for hosted services, backend auditing, cloud hosting, API authorization, hardware I/O or external AI integration.

## If extending to real research infrastructure

Separate experimental simulation from hardware by design; add authenticated users and authorization, an explicit permission boundary, secrets management, encrypted storage, rate limiting, observability, provenance records, signed artifacts, dependency scanning, threat modeling, and independently tested safety interlocks. Use isolated, non-production datasets and external expert review before considering any real-system interface.
