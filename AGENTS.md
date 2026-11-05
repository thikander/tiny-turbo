# Tiny Turbo: handoff for agents

Read this before changing anything. It covers what the project is, how the code is laid out, the systems inside it, how to test, how to ship, and the traps already hit.

- **Live:** https://thikander.github.io/tiny-turbo/
- **Repo:** `thikander/tiny-turbo`, branch `main`. GitHub Pages serves `main` at `/`, so every push to `main` deploys.
- **Owner:** Theerapat Pinkrajan (GitHub `thikander`).
- **Related repo:** `thikander/thikander.github.io` is the owner's profile page. Its collection tile links to `tiny-turbo/`. See [Profile site](#profile-site).

## 1. What it is

A browser toy and small game in **one HTML file** (`index.html`, no build, no dependencies):

- **Cluster:** a low-res instrument cluster drawn on a 320×198 canvas. There are two styles: **digital** (the default) and a 90s **analog** one with a red brushed plate.
- **Road view:** a 320×140 canvas: segment-projected 3D road with hills, biomes, a day clock, weather and three cameras.
- **Mochi:** a pixel mascot that floats over the page and reacts to how you drive.
- **Car simulation:** a realistic 1.3 L turbo engine, a torque converter, a CVT with stepped modes, and vehicle physics.
- **Engine sound:** synthesized live in an AudioWorklet. There are no audio samples.
- **Game:** a few traffic cars, shown only as tail-light silhouettes, to dodge by changing lane. A crash shows a plain screen with the distance driven.
- **Touch:** a handheld-style touch pad on phones.
- **Languages:** Thai (default) and English for all UI outside the cluster (menu, pad, hint, dialog, mochi, crash screen). The cluster canvas stays English.

### Look and feel (keep it)

- **Low-res pixel style:** canvases are scaled up with `image-rendering: pixelated`, and fonts are monospace (Consolas).
- **Clean screen:** every menu control sits behind a single gear button (`#btnSettings`).
- **Polish:** glow (`ctx.shadowBlur`), backlit lamps and soft gradients are welcome, as long as they stay inside the pixel look.
- **Mochi in Thai:** cute and playful, using endings like น้า, จ้า and อ่ะ, and words like งืม, คิกๆ, ว้าย.
- **No real trademarks:** the analog cluster says "TINY TURBO" where a brand logo would be. Don't add brand logos.

## 2. Repo layout

```
index.html        the whole app: HTML, CSS and one IIFE script
README.md         player-facing readme: play link, controls, what is simulated
screenshot.png    image used in the README
tools/sim-check.js  Node check of the simulation and the synth levels (see §5)
AGENTS.md         this file (CLAUDE.md imports it)
```

## 3. Code map (`index.html`)

The script is one IIFE. Sections are marked by banner comments, so search for `/* =====`. They appear in this order, and **the order matters** because later sections use names defined earlier:

| Section (banner) | What it does |
| --- | --- |
| `SYNTH_SRC` between `/*SYNTH-BEGIN*/` and `/*SYNTH-END*/` | Engine sound synth as a **string**. It is loaded into an AudioWorklet through a Blob URL, or a ScriptProcessor if worklets are missing. **No backticks or `${}` inside it.** |
| `createSim` between `/*SIM-BEGIN*/` and `/*SIM-END*/` | The vehicle simulation. It uses no DOM, only a `hooks.event(ev)` callback. `tools/sim-check.js` cuts the file at these markers, so keep them. |
| `AUDIO` | Builds the audio graph, unlocks sound on a gesture, and runs the SOUND button. |
| `SIM` | Creates the sim and the `ui` state object; `S` is the sim state. |
| `ROAD VIEW` | Track generator, camera/projection, sky and day clock, biomes, scenery objects, lighting, lane-change movement. |
| `TRAFFIC GAME` | Traffic cars, collision, the crash screen, restarting a run, and `drawCar()` (3D traffic cars). |
| `MOCHI` | The mascot: `FACES`, `LINES` (TH/EN), base mood with debounce/dwell, reactions, idle actions, `watchWorld()`, drawing, drag and poke. |
| `MENU` | `UI_TXT` + `applyUiLang()` (UI translation), settings panel buttons and volume. |
| `DRAW` | The digital cluster, plus `glow()`, `lamp()`, `fadeLine()`, the gauges and the trip computer (`tripPage()`). |
| `ANALOG CLUSTER` | `drawAnalog()`. `draw()` hands off to it when `ui.cluster==="analog"`. |
| `HELP DIALOG` | RPG-style text box, the pages and tips (TH and EN), and the TH/EN switch. |
| `TOUCH PAD` | Touch controller. Its buttons send fake keyboard events, so touch and keyboard share one input path. |
| `INPUT` | Keyboard handlers and the `keys` set. |
| `LOOP` | `frame()`: input ramps, then sim substeps (≤4 ms), then `updateRoad`, then sending audio params, then drawing (cluster, road, mochi, menu sync, pad sync, dialog). |

### Init-order trap

`MENU` runs **before** `DRAW`/`ANALOG CLUSTER`. Anything the menu reads at startup, such as the saved cluster style, must be set up in the menu code itself or earlier. A bug once saved the literal string `"undefined"` because of this.

## 4. Systems (the concept)

### 4.1 Simulation (`createSim`)

The constants live in `P`. They describe a 1150 kg car with 0.30 m wheels, a final drive of 5.5, and a CVT ratio from 0.40 to 2.60. Virtual steps are `[2.60,1.85,1.38,1.06,0.84,0.66,0.52]`. The engine idles at 760 rpm, hits the limiter at 6500 (resuming at 6330), and makes at most 210 Nm.

- **Engine:** torque comes from a naturally aspirated torque curve × an intake-pressure factor `(map-0.16)/0.84`, minus friction and pumping losses.
- **Idle control:** a PI controller with cold fast-idle, a flare after starting, and extra air when the converter is loaded.
- **Starting:** the starter motor cranks with compression wobble before the engine catches.
- **Turbo:** turbo speed follows exhaust flow (rpm × intake pressure) with lag, and boost caps at 0.9 bar (1.0 in S or manual). A sharp lift-off with boost fires a `bov` event (the blow-off valve).
- **Fuel cut:** fuel is cut at the rev limiter, while coasting (decel cut), and on free-revving in P/N.
- **Torque converter:** modelled with a capacity curve and torque multiplication. It locks above about 18 km/h and unlocks below about 12, or when braking hard at low speed.
- **CVT modes:**
  - **D:** continuous ratio. Pedal above 0.78 switches to **D-step**, which shifts at 6050 rpm.
  - **S:** stepped automatic shifting.
  - **Manual:** the `+`/`-` keys; it holds the gear into the limiter.
  - **L:** holds a low ratio.
  - **Step shift effects:** a torque cut on upshifts, a throttle blip on downshifts, and a `thump` event.
- **Tuning:** `TUNES` (stock, stage1–3) set `P.maxTq`, `P.boost`/`P.boostSport`, `P.limit`, `P.lag` (turbo spool threshold) and `P.flowK` (top-end breathing) via `setTune(i)`. `peakPS()` runs a short virtual dyno on a fresh sim. `P.vmax` (0 or 180) is the optional speed limiter (`S.vcut`). Saved as `mdc-tune` and `mdc-vmax`. Stock values are unchanged, so `tools/sim-check.js` output is the same.
- **Gear rules:** leaving P needs the brake (`S.brake ≥ 0.3`). P and R are blocked above 6 km/h. The engine starts only in P or N. Refused actions call `flash(msg)`, which also emits `{type:"msg"}`; the help dialog shows tips for those.
- **Gauges:** temperatures, oil pressure (depends on oil temperature and level), voltage, fuel use (BSFC model), odometer and trip.
- **Events:** `hooks.event` emits `bov`, `thump{amt}`, `lever` and `msg{msg}`. They go to the audio, mochi and dialog handlers through `onSimEvent`, which is chained (each module wraps the one before it).

### 4.2 Sound (`EngineSynth`)

- **Engine:** firing pulses for a 4-cylinder engine (order 1-3-4-2, slight differences between cylinders) feed header and tailpipe comb filters, then a muffler low-pass and a DC blocker.
- **Other layers:**
  - intake noise
  - turbo whistle and whoosh
  - blow-off valve hiss
  - starter motor
  - CVT belt whine
  - tyre and wind noise
  - drivetrain thump
  - gear-lever and turn-signal relay clicks
  - overrun pops (only in S or manual)
- **Params:** the main thread sends `{p:{rpm,load,thr,turbo,boost,starter,speed,cut,running,pop,vol}}` every frame. Events are sent as `{ev:{type,...}}`.
- **Unlocking audio:** `startAudio()` creates and resumes the AudioContext **synchronously inside a gesture** and plays a silent buffer for iOS. The window capture listeners (`pointerdown`, `pointerup`, `touchend`, `mousedown`, `keydown`, `click`) retry until the context is `running`. Touch `pointerdown` is not an activation event on mobile, which caused the old "sound only works after toggling it off and on" bug.

### 4.3 Road view and lane change

- **Track:** `genSeg()` builds 4 m segments ahead on demand (`segAt(n)`, pruned behind). Each segment stores curvature `k`, grade `g`, heading `th`, centre `X`, height `Y`, its biome `b`, the next biome `nb`, a crossfade `mix`, a tunnel flag and rain. Curvature and grade follow random walks scaled by the biome (`curvy`, `hilly`). Zones last 280–700 segments and blend over the last 60. Forest zones can contain tunnels. The grade under the car goes to the sim as `S.grade`.
- **Camera:** one view only, from the driver's seat (`CAM_H` 1.22 m) with the hood at the bottom. The owner asked for no camera switching.
- **Projection:** `proj(s,x,y)` places a world point (distance along the road, lateral offset, height) relative to the camera's road position, heading and grade, so curves and crests are real. The ground is drawn near to far, one scanline at a time inside each segment (perspective-correct 1/z), and only above the current crest line. Each segment's crest line is kept in `clips[]`, and objects are drawn far to near clipped to it (`CLIP`, `R()`, `quad()`).
- **3D boxes:** `box()` draws the back face plus whichever side and top faces the camera can see. Cars, buildings, tunnels and the portal use it.
- **Environment:** `updateEnv()` interpolates `SKYK` keyframes by `road.hour` (starts at local time, +1 game minute per real second), greys it with rain, and sets ambient light, stars, fog and whether headlights and lamps are on. `lightAt(s,z,sg)` = ambient + headlights + lamp pools (+ tunnel lamps), as RGB. `HEADK` lets the grass take less headlight than the road.
- **Biomes:** `BIOMES` (field, forest, city, coast, paddy, highway) set colours, background layer, lamp spacing and decorations in `decor()`.
- **Lanes:** traffic drives on the left, so the home lane is `camX=-1.8` and the other lane is `+1.8`. Pressing `←`/`→` sets the turn signal. After 0.6 s the lane changes using a critically damped move capped at 2.2 m/s² sideways (about 3.5 s, no overshoot). The signal cancels itself afterwards.

### 4.4 Traffic game

- **Traffic:** `road.cars` holds `{pos, lane, x, v, cruise, type, style, brakeT, braking}`. The density is intentionally **calm, like midnight**:
  - one car at the start, at most 3
  - a new car every 6–16 s
  - random braking is rare
  - spawning always leaves a gap you can get through
- **Look:** 3D cars (`CARDIM`: sedan, hatch, SUV, pickup, van) painted from `PAINTS` and lit by the scene, so at night they read as dark shapes while the tail lights stay bright through the fog. `LIGHTS` defines 6 tail-light styles, and braking adds a high-mounted third brake light.
- **Crash:** if a car is within 2.3 m ahead and within 1.7 m sideways, `crash()` shows `#fail`, which contains only `"<km> km"`. Any key or tap after 0.8 s calls `restartRun()`. While on the crash screen, key events are swallowed by a capture listener.
- **Switch:** `ui.traffic` is the TRAFFIC toggle, saved under `mdc-traffic`. Off means no cars and no crashes.

### 4.5 Mochi

- **Drawing:** a 48×44 canvas, pixel-filled through `ImageData`. It has an outline, shading, blush, several eye and mouth types, and effects (zzz, sweat, sparkles, puff, speed lines).
- **Movement:** jelly squash from forward/backward acceleration, lean from sideways force, bumps, a floating bob and blinking. Its eyes follow the turn signals.
- **Moods:** `baseMood()` maps the car state to a face, with a 0.6 s debounce and a 2.5 s minimum dwell (urgent faces switch faster), so it no longer flickers. `react(face,dur,cat,prio)` overrides it for events: sim events, traffic ahead, near misses, overtakes, biome/tunnel/rain/time-of-day changes, km milestones and pokes. Idle actions (hum, yawn, look around, wiggle, stretch) and small talk fill the calm moments.
- **Speech:** `say(cat,prio)` picks from `LINES[lang][cat]` without repeating the last line, types it out, and moves the mouth while talking. The helper is `pickLine()` because the DRAW section already has a `line()` function (a duplicate function name silently overrides the earlier one).
- **Interaction:** drag it to move it, and tap it to poke it.

### 4.6 UI, i18n and storage

- **Settings buttons:** SOUND, VOL, REFUEL, OIL, TRIP RESET, PAUSE, KEYS, PAD, TRAFFIC, ANALOG/DIGI, HELP, TH/EN, FULL.
- **Help dialog:** `PAGES[lang][pc|touch]`, `TIPS[lang][msg][pc|touch]`, `TITLES[lang]`. It types out the text, and `{k:"X"}` tokens draw key caps.
- **localStorage keys** (always wrapped in try/catch):

  | Key | Values |
  | --- | --- |
  | `mdc-lang` | `th` or `en` (default `th`) |
  | `mdc-help-seen` | `1` once the help has been seen |
  | `mdc-traffic` | `on` or `off` (default on) |
  | `mdc-cluster-style` | `analog` or `digital` (default digital; **only saved when the user clicks**) |
  | `mdc-tune` | `0`–`3` (stock to stage 3) |
  | `mdc-vmax` | `1` when the 180 km/h limiter is on |
  | `mdc-car` | JSON: odometer, trip, tripFuel, fuel, oilLevel (saved every 5 s and on pagehide) |

- **Mobile:**
  - The pad appears automatically with `(hover:none) and (pointer:coarse)` or a mobile user agent.
  - Zoom is blocked by the viewport meta, `* { touch-action:none }` (touch-action does **not** inherit, so it must be on every element), cancelled `gesturestart`/`dblclick` and multi-touch `touchmove`, and blocked fast double `touchend`.
  - Landscape splits the pad to both sides of the screen.

### 4.7 Controls

| Key / pad | Action |
| --- | --- |
| `I` / START | Engine start/stop (P or N only) |
| `↑` / A | Throttle. `Shift`+`↑` is part throttle |
| `↓` / B | Brake |
| `Space` / HAND BRAKE | Handbrake (the pad button toggles it) |
| `P R N D S L` | Gear selector |
| `+`/`-` / ▲▼ | Manual steps (D or S) |
| `←`/`→` / ◀▶ | Turn signal and lane change |
| `Esc` / PAUSE | Pause |

## 5. How to test

1. **Syntax:** pull the `<script>` out and run it through `new Function`:
   ```bash
   node -e "const s=require('fs').readFileSync('index.html','utf8');new Function(s.split('<script>')[1].split('</script>')[0]);console.log('ok')"
   ```
2. **Simulation and sound levels:** `node tools/sim-check.js`. It drives a scripted run and prints rpm, speed, ratio, lock-up, boost and gear at each stage, then the loudness of the synth in each state. Expect:
   - the engine catches at about 350 rpm and flares to about 1600
   - idle in D held on the brake at about 900–1000 rpm
   - D-step shifts at about 6000 rpm
   - a `bov` event on lift-off
   - the N rev limiter bouncing at about 6400–6500 rpm
3. **Browser:** serve the folder (for example `py -m http.server`) and open `index.html`.
   - If the preview pane is **hidden**, `requestAnimationFrame` is throttled and frames barely move. Override it from devtools before testing:
     `window.requestAnimationFrame = cb => { const ch=new MessageChannel(); ch.port1.onmessage=()=>setTimeout(()=>cb(performance.now()),0); ch.port2.postMessage(0); };`
   - Drive with synthetic `KeyboardEvent`s on `window`. Hold `ArrowDown` for **more than about 1 s** before tapping `d`, because the brake ramps up.
   - To look closely at a canvas, copy it into an `<img id="snap">` overlay with `toDataURL`, and **remove it afterwards**. Stale overlays once made it look as if the ignition never turned on.
   - Mobile: use device emulation (it turns the pad on) or the PAD toggle. Check portrait and landscape.
4. Check the console for errors.

## 6. Shipping

```bash
git add -A && git commit -m "..." && git push origin main
gh api repos/thikander/tiny-turbo/pages/builds/latest --jq '.status+" "+.commit'   # wait for "built <sha>"
curl -s https://thikander.github.io/tiny-turbo/ | grep -c '<something new>'
```

- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, or the attribution your harness specifies.
- The owner normally wants changes **committed and pushed straight away**. For the profile site, they asked to **see it before committing**.
- Keep `README.md` in step with player-facing changes: controls, settings, game rules. Keep it plain, with no hype.

## 7. Backlog (not started)

- Score or best distance stored in localStorage on the crash screen. The owner asked for **only** the km on that screen, so ask before adding anything to it.
- More scenery variety (city, rain) and day/night tied to the clock.
- Oncoming traffic in another lane, or overtaking cars from behind (only ahead-of-you traffic exists now).
- A real phone pass: iOS Safari audio and zoom, Android vibration. Everything so far was tested in desktop Chrome and device emulation only.
- `assets/main_profile.png` in the profile repo is unused. The owner hasn't decided whether to delete it.

## Profile site

- **Repo:** `thikander/thikander.github.io`, served at https://thikander.github.io/.
- **Page:** a pixel-style white page: a cover scene canvas, the name "Theerapat Pinkrajan", `@thikander`, a GitHub button, and a "Collection" grid.
- **First tile:** "Tiny Turbo", with a 32×32 cluster icon drawn on canvas and a tiny mochi on top. It links to `tiny-turbo/`.
- **Empty slots:** "?" placeholders for future projects. Add new projects by replacing one.
- **No photo:** the owner's photo or avatar was removed at their request. Don't add it back.
- **Custom domain:** `page.thikander.cyou` expired and was removed (the CNAME file was deleted). Don't add it back unless the owner renews it.
