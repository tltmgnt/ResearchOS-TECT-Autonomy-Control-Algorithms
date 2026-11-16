# ResearchOS TECT model contract — v1

## 1. Domain and purpose

This code is an **offline educational/research benchmark**, not a general autonomous agent. A single synthesized one-dimensional point mass tracks a step position target. Three control laws run independently on the identical model with the same disturbance and seeded sensor noise. The follower coordination experiment is separate from tracking.

Inputs must match the strict `version: 1` JSON schema in `examples/study.json`. Values are validated with numeric ranges and a cap of 3,000 simulation steps.

## 2. Discrete-time plant

State is position `x` and velocity `v`. With step `dt`, mass `m`, drag `d`, bounded applied acceleration command `u`, and exogenous acceleration `w`:

```
u_clamped = clip(u, -maxAcceleration, +maxAcceleration)
v_next = clip(v + dt * (u_clamped/m - d*v + w), -maxVelocity, +maxVelocity)
x_next = x + dt * v_next
```

Position is finally clipped to `[minPosition, maxPosition]` and velocity set to zero if a boundary is crossed. The model records those interventions. In the controller design prediction, no physical collision or full rigid-body contact dynamics exist. `u` is a generalized force-like input divided by mass; the UI labels this a control effort. Units are abstract and must be declared by the researcher before external interpretation.

A target step changes from `startPosition` to `targetPosition` at `targetAt`. External disturbance is a constant acceleration on `[disturbanceStart, disturbanceEnd)`. Sensor noise is bounded uniform pseudo-random perturbation from a seeded xorshift32 generator. The noise source is deterministic **not** a statistically validated sensor error model.

## 3. Controllers

**PID:** `u = kp * (target - observed_x) + ki * integral - kd * observed_v`. Integral accumulates error with a limit and conditional anti-windup when requests saturate in the direction of error. Velocity uses derivative-on-measurement to avoid setpoint derivative kick.

**Discrete LQR:** With `A=[[1,dt*(1-d*dt)],[0,1-d*dt]]`, `B=[[dt*dt/m],[dt/m]]`, design uses `Q=diag(positionWeight,velocityWeight)` and `R=effortWeight`. Iterative discrete Riccati updates compute state-feedback `K`. Input saturates after the unconstrained LQR calculation. No assertion of stability under saturation or disturbances is made.

**MPC:** A receding-horizon, input-constrained quadratic tracking objective is approximately solved by warm-started projected-gradient descent. The objective includes errors in position and velocity, effort regularization, a terminal penalty, and a **soft** predicted position-bound penalty. Only the first command is applied per time step. Limited horizon and iteration budget mean this is not an exact optimal control solution. The optimizer does **not** enforce hard state bounds or guarantee feasibility.

## 4. Metrics and settlement definition

- **IAE**: sum of absolute position tracking errors times `dt` over all simulation steps.
- **RMS control effort**: sqrt(sum of squared applied command times `dt` divided by simulated duration).
- **Final position error**: absolute difference between final position and the active target.
- **Max absolute error**: largest absolute tracking error in the sampled trajectory.
- **Settling time**: final contiguous interval during which error stays within `max(0.08, 2% of target move magnitude)` and absolute velocity is below `0.25`. Reported relative to `targetAt`, else N/A. A disturbance can invalidate prior settling.
- **Actuator saturations**: count of time steps when requested effort differs from clamped effort.
- **Boundary interventions**: count of numerical position clamps.

Metrics compare algorithms on this **single modeled scenario**. No generalization, reliability interval or statistical significance can be inferred.

## 5. Two-agent experiment

Two 1-D agents start with a desired positive gap. The leader uses proportional speed control and an idealized brake-to-stop event. The follower uses gap P feedback plus relative-velocity D feedback. Nonnegative velocity and acceleration clamps apply. When the numerically predicted follower would violate `minGap`, position is projected to `leader_x - minGap` and velocity reduced. This is a **simulation correction**, not a real collision avoidance mechanism and not a guarantee about braking distance, sensing or latency.

Coordination metrics are minimum sampled gap, time-averaged absolute gap error, and number of geometric corrections.

## 6. Reproducibility and validation plan

Versioned JSON is the canonical input, with fixed step count `round(seconds/dt)`. Note the final simulated duration may differ slightly when `seconds/dt` is not an integer. No wall-clock integration or network calls exist. To extend this work for research: compare against trusted analytical or numerical references; test smaller time steps and convergence; validate controllers under model uncertainty; document runtime, accuracy, and constraint violations; and have a qualified independent reviewer assess safety implications. Never connect the demonstration output to physical systems without separate safety engineering.
