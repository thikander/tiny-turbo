# Mini Digital Cluster

**Play:** https://thikander.github.io/mini-digital-cluster/

A low-res digital instrument cluster for a small turbo car with a CVT, running in one HTML file. The car is simulated, the engine sound is synthesized live in the browser, and there is a road view and a small mochi that reacts to how you drive.

![Cluster and road view](screenshot.png)

## Controls

| Key | Action |
| --- | --- |
| `I` | Start / stop the engine (gear must be in P or N) |
| `↑` | Throttle. Hold `Shift` for part throttle |
| `↓` | Brake |
| `Space` | Handbrake |
| `P` `R` `N` `D` `S` `L` | Gear selector. Leaving P needs the brake held |
| `+` / `-` | Manual steps (M1 to M7) in D or S |
| `←` / `→` | Turn signal. Above 25 km/h it also changes lane |
| `Esc` | Pause |

On phones and tablets a handheld-style touch pad appears instead (toggle it with **PAD** in the menu):

| Button | Action |
| --- | --- |
| `START` | Start / stop the engine |
| `A` / `B` | Gas / brake (hold) |
| `P` `R` `N` `D` `S` `L` | Gear selector. Hold `B` to leave P |
| `▲` / `▼` | Manual steps |
| `◀` / `▶` | Turn signal / lane change |
| `HAND BRAKE` | Toggle handbrake |
| `PAUSE` | Pause |

A short how-to dialog shows on the first visit; **HELP** in the menu brings it back.

Sound starts on the first key press or click. Use headphones or decent speakers; most of the engine note is low frequency.

To drive off: press `I`, wait for idle, hold `↓` and press `D`, then hold `↑`.

## What is simulated

- **Engine:** 1.3 L turbo four-cylinder with a torque curve, friction and pumping losses, idle control with cold fast idle, a rev limiter at 6,500 rpm, and fuel cut on overrun.
- **Turbo:** spool depends on exhaust flow, so boost comes in with lag. A sharp lift with boost in the manifold opens the blow-off valve.
- **Transmission:** torque converter that slips at low speed and locks up above about 18 km/h, feeding a belt CVT.
  - `D`: continuous ratio, changing to stepped "D-step" shifts under heavy throttle.
  - `S`: 7-step sport mode.
  - `+` / `-`: manual mode.
  - `L`: holds a low ratio for engine braking.
- **Vehicle:** mass, rolling resistance, aero drag, brakes, and creep in gear.
- **Gauges:** coolant and oil temperatures warm up over time. Oil pressure follows rpm and oil temperature. Fuel use is based on engine power. Battery voltage drops while cranking.

## Sound

There are no audio samples; everything is generated in an AudioWorklet:

- Firing pulses from each cylinder pass through modeled exhaust pipe resonances and a muffler.
- Intake noise, turbo whistle, the blow-off valve, the starter motor, CVT belt whine, tyre and wind noise.
- Gear lever clicks, drivetrain clunks, and the turn-signal relay.

## Run locally

Open `index.html` in a browser. No build step, no dependencies.
