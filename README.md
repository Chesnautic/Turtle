# Turtle 🐢🐢🐢

A trio of pond turtles that eat audio files and turn them into music. Drop
sounds on them and they mix together into a loop you can remix and export
to a `.wav` file.

As of v1.2.0, Turtle is actually **three** turtles sharing one window and
one clock. As of v1.3.0, they live in a proper resizable app window with a
pond scene up top and a dedicated, always-visible track for each turtle
underneath — no more tiny floating pet, no more tabs to click through.
v1.3.1 is a bugfix pass: Green now uses the same segmented-bar widget as
Blue and Red (was a separate pad-grid style before), fixed a CSS bug where
segments briefly rendered oversized and overflowed their bar, and fixed
Blue not starting playback when a sample was dropped on him after Green or
Red were already looping.

- 🟢 **Green** — the original. Chops a dropped sample into 16 slices and
  sequences them into a beat.
- 🔵 **Blue** — friendly and cute. Plays dropped samples back **whole, in
  order, uncut**, speed-matched to the shared tempo so they land on-beat
  with Green.
- 🔴 **Red** — an angry snapping turtle. Chops samples like Green, but
  **resynthesizes every slice into sub-bass**, so no matter what instrument
  you feed him, he chomps it into bass.

## What it does

- Opens as a real, resizable app window (custom-styled titlebar with its
  own minimize/maximize/close buttons — drag it by the titlebar). A pond
  scene sits across the top with all three turtles in it; a dedicated,
  always-visible track for each turtle sits below.
- Each turtle has its own drop target in the pond — drop a file directly
  on Green, Blue, or Red and it goes to that turtle specifically. Every
  turtle plays its own chomping eating animation (scaled to how many files
  you dropped at once) while its sounds decode.
- **Green** (`chop me a beat`): drop one or several `.wav`, `.mp3`, `.ogg`,
  `.flac`, `.aiff`, or `.m4a` files — each becomes its own 16-segment bar
  (up to 6 at a time) in Green's track, the same widget Blue and Red use.
  Each sample is sliced into 16 equal chunks, each chunk's loudness is
  analyzed and used to auto-build that bar's pattern (louder/percussive
  slices are more likely to be turned on), and all of Green's bars mix
  together as they loop. Click any segment to toggle that chunk on/off.
- **Blue** (`play me whole`): drop up to 6 samples and they queue up into
  an ordered playlist, playing back-to-back in the order you dropped them
  — no slicing. Each track's tempo is auto-detected and its playback speed
  is adjusted so it locks to the shared BPM slider (so a slow vocal loop
  and a fast drum loop both land in time with Green). Blue never changes
  the shared tempo himself — he always adapts to it. Each track also gets
  its own 16-segment bar underneath the playlist — click a segment to mute
  just that piece of the sample (the rest keeps playing whole and uncut).
- **Red** (`feed me bass`): drop samples and, like Green, they're sliced
  into 16 chunks each — but instead of playing the original audio back,
  Red detects the pitch of every slice and synthesizes a sub-bass hit at
  that note (octave-folded into a low 40–100Hz range), so a chopped-up
  guitar, vocal, or drum loop all get chomped into a bassline. Each sample
  gets its own 16-segment bar — click a segment to mute that chunk.
- While the beat is playing, every turtle sings along: mouths cycle
  through open shapes in sync with active steps, eyebrows lift, bodies
  sway and pick up a soft glow on the beat, and they occasionally pop out
  a little floating music note.
- All three turtles' tracks are visible and editable at the same time —
  no tabs to click through. A shared transport bar at the bottom lets you
  re-shuffle Green & Red's patterns, change the shared tempo (60–180 BPM),
  and play/stop everything at once.
- **Export**: pick how many loops you want (1–32) and hit the export
  (⬇) button — it renders all three turtles' mixes together (including
  Blue's and Red's segment mutes) offline and opens a native "Save As"
  dialog so you can save the result as a `.wav` file anywhere on your PC,
  ready to drop into another DAW or just keep.
- Right-click anywhere for a small menu: toggle click-through (so the
  window stops intercepting mouse clicks meant for windows behind it),
  maximize/restore the window, or quit.

## Running it (development)

You'll need [Node.js](https://nodejs.org) installed (LTS is fine).

```
npm install
npm start
```

This launches the app via Electron directly — good for trying it out or
tweaking the code.

## Building the Windows installer

```
npm install
npm run build
```

This uses `electron-builder` to produce an NSIS installer (`Turtle Setup
1.3.1.exe`) in the `dist/` folder. You'll need an internet connection the
first time you build, since `electron-builder` downloads Electron's
prebuilt binaries for Windows.

Run that installer — it walks through a short setup wizard (you can pick
the install location) and finishes by installing Turtle with a "Turtle"
shortcut on your Desktop and in the Start Menu, added automatically
(`createDesktopShortcut` / `createStartMenuShortcut` are on in
`package.json`'s `build.nsis` config; there are checkboxes in the wizard
if you ever want to skip one). Launch Turtle from either shortcut and it
opens as a normal, resizable, centered window.

To uninstall later, use "Add or Remove Programs" like any other Windows
app — NSIS registers a proper uninstaller.

## Giving Turtle to other people (no coding required on their end)

The installer above is already the "just download and run it" artifact —
anyone you hand `Turtle Setup 1.3.1.exe` to only needs to double-click it,
they don't need Node, npm, or any of this source code. The only catch is
that *someone* has to build it once per version on a machine with real
internet access (this project's cloud dev workspace is sandboxed and can't
reach Electron's download servers, which is why the build has to happen on
your own PC or in CI).

To make that repeatable — so future versions build themselves and you get
a shareable download link without manually running `npm run build` every
time — this project includes a GitHub Actions workflow at
`.github/workflows/build.yml`. Here's how to switch it on:

**1. Create a GitHub repo and push this project to it**

- Install [Git](https://git-scm.com) if you don't have it, and sign up for
  a free account at [github.com](https://github.com) if you don't have
  one.
- On github.com, click **New repository**, name it something like
  `turtle`, and create it (leave it empty — don't add a README/.gitignore
  there, since this project already has them).
- In a terminal, from inside the `turtle-app` folder:
  ```
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  git remote add origin https://github.com/<your-username>/turtle.git
  git push -u origin main
  ```
  (GitHub will prompt you to sign in the first time you push — follow
  whatever prompt it gives you, either a browser popup or a personal
  access token.)

**2. Publish a version**

Every time you want a new downloadable release:
```
git add -A
git commit -m "describe what changed"
git tag v1.3.1
git push origin main --tags
```
Pushing a tag starting with `v` kicks off the workflow automatically on
GitHub's servers. After a few minutes, open your repo's **Releases** page
(`github.com/<your-username>/turtle/releases`) and the built installer
will be attached there as a download. That Release page URL is what you
share with people — they click the `.exe`, download it, run it, done.

Next time, just bump the tag (`v1.0.1`, `v1.1.0`, etc.) and push again.

**Testing the workflow without publishing:** open the **Actions** tab on
your repo, select "Build Windows Installer", and click **Run workflow**.
That builds the installer without creating a public Release — you can
download it from that run's "Artifacts" section to verify everything
works before you tag a real version.

## Project layout

```
main.js       Electron main process — creates the resizable window, the
              minimize/maximize/close IPC handlers for the custom
              titlebar, the right-click context menu, and the native
              "Save As" dialog used for exporting a mix.
preload.js    Small, safe bridge exposed to the renderer (contextIsolation
              is on, nodeIntegration is off).
index.html    Window contents: the custom titlebar, the pond scene with
              three turtle canvases (Green/Blue/Red) and their individual
              drop zones, the three always-visible track panels, and the
              shared transport bar.
renderer.js   Everything else: turtle drawing/animation for all three
              (one shared drawing engine driven by a per-turtle palette),
              per-turtle drag & drop, Web Audio decoding/slicing, pitch
              and BPM detection, the shared step scheduler, the shared
              segmented-bar widget used by all three turtles, Blue's
              playlist, and WAV export/rendering.
style.css     Look & feel — the pond scene (CSS gradients + lily
              pads/ripples/reeds), the custom titlebar, the always-visible
              track panels with per-turtle accent colors, and the shared
              segmented-bar widget (`.segBar` / `.seg`) all three turtles
              use.
assets/       App icon (icon.ico / icon.png) used for the Windows build.
.github/
  workflows/
    build.yml   GitHub Actions workflow that auto-builds the installer
                and publishes it to a GitHub Release on version tags
                (see "Giving Turtle to other people" above).
```

## Customizing

- **Look**: all three turtles share one drawing engine in `drawTurtle()` /
  `roundedBlob()` / `drawMouth()` in `renderer.js` — no image assets to
  swap. Each turtle's colors, face shape, and expression come from its
  entry in the `PALETTES` object near the top of the file (`body`, `ring`,
  `disc`, `face`, `feature`, `glow` colors, plus flags like `cute` for
  Blue's rounder blob/bigger eyes/blush and `angry` for Red's V eyebrows/
  jagged mouth/shell spikes). Add a new personality by adding a palette
  entry and a matching `rigs.<key>` / canvas / drop zone.
- **Slice count**: change `STEP_COUNT` at the top of `renderer.js` (used
  by Green/Red's patterns and Blue's mute segments; keep it a multiple of
  4 so it stays musically sane. `.segBar` just flexes to however many
  `.seg` cells exist, so no CSS changes needed if you change it).
- **Auto-pattern behavior**: see `generatePattern()` in `renderer.js` —
  it ranks slices by RMS loudness and turns on the top N (6–10, randomized)
  plus the downbeat. Shared by Green and Red.
- **Max sounds per turtle**: `MAX_SOUNDS_PER_TURTLE` at the top of
  `renderer.js` (default 6, applies independently to each of the three
  turtles' bars/playlist). Since all three tracks are always visible and
  `#tracks` scrolls as a whole, raising this doesn't need any CSS changes.
- **The segmented bar widget**: `buildSegBarRow()` in `renderer.js` is the
  one shared builder Green, Blue, and Red all use — it renders whatever
  array you pass it (Green's/Red's `layer.pattern`, Blue's `track.mute`)
  as a row of clickable `.seg` cells and mutates that array in place on
  click. Sizing lives entirely on `.seg` in `style.css` (not shared with
  the lighter-weight `.step` class, which only carries cursor/playhead/
  empty concerns) so it can't inherit stray sizing from anywhere else.
- **Blue's segment mute**: each queued track gets a `mute` array (16
  bools, default all `true`) alongside its `buffer`/`bpm`. Playback goes
  through `scheduleBlueBuffer()` in `renderer.js`, which is shared between
  live playback (`scheduleBlueTrack()`) and export (`exportMix()`) — it
  divides the track's actual (tempo-adjusted) playback duration into 16
  segments and schedules gain-automation events so muted segments go
  silent without re-slicing the underlying audio, so the rest of the
  sample still plays whole and uncut.
- **Red's bass sound**: `scheduleBassHit()` in `renderer.js` synthesizes
  each bass note (sine oscillator with a short pitch-drop envelope plus a
  filtered noise click) — tweak the envelope/filter values there for a
  punchier or softer bass. `detectPitch()` (autocorrelation-based) figures
  out each slice's note, and `foldToBassRange()` octave-folds it into
  40–100Hz.
- **Blue's tempo matching**: `detectBpm()` in `renderer.js` estimates each
  dropped track's tempo (onset-detection + median inter-onset-interval,
  folded into 60–200 BPM), and `scheduleBlueTrack()` sets
  `playbackRate = bpm / track.bpm` (clamped 0.5–2x) so it locks to the
  shared tempo slider without Blue ever changing that shared tempo himself.
- **Export length**: the loop-count field is capped at 1–32 in
  `index.html` (`#loopsInput`); the actual rendering happens in
  `exportMix()` in `renderer.js` via an `OfflineAudioContext`, mixing all
  three turtles' engines together (including Blue's and Red's segment
  mutes).
- **Singing behavior**: `triggerMouthPulse(rig, strength)` fires on every
  active step for whichever turtle triggered it — it sets
  `rig.state.singPulse` (drives the brow raise, sway, and glow), picks a
  new `mouthShape` (`'O' | 'A' | 'E'`, see `drawMouth()`), and has a
  chance to spawn a floating note (`spawnNote()`). Tune the decay rates in
  `updateTurtle()` (the `*= 0.88` / `*= 0.82` lines) to make a turtle more
  or less bouncy.
- **Window size**: `WINDOW_WIDTH` / `WINDOW_HEIGHT` (default open size)
  and `WINDOW_MIN_WIDTH` / `WINDOW_MIN_HEIGHT` (resize floor) in
  `main.js`. The window is frameless but resizable, so the custom
  titlebar (`#titleBar` in `index.html` / `style.css`) supplies its own
  drag region and minimize/maximize/close buttons wired up to
  `window-minimize` / `window-toggle-maximize` / `window-close` IPC
  handlers in `main.js`.
- **Pond scene**: the lily pads/ripples/reeds in `#pond` (`index.html` /
  `style.css`) are pure CSS shapes (`.lilyPad`, `.ripple`, `.reeds`), so
  adding, moving, or restyling them is just CSS — no assets involved.

## Notes

- Audio decoding and playback use the standard Web Audio API in the
  renderer — no native audio dependencies to compile.
- Exported files are uncompressed 16-bit PCM `.wav` (encoded by hand in
  `audioBufferToWav()` — no extra audio library needed).
- Turtle is a normal resizable window as of v1.3.0 (frameless for the
  custom look, but no longer always-on-top or pinned to a screen corner
  like the old floating-pet version).
- Pitch detection (Red) and BPM detection (Blue) are both "best guess"
  heuristics tuned and unit-tested against synthetic signals — they're
  built for a musically-close, real-time-friendly result, not
  studio-grade precision. Blue's segment-mute gain automation
  (`scheduleBlueBuffer()`) was also unit-tested standalone against a mock
  `AudioParam` timeline before shipping.
- `detectBpm()` wraps its whole body in a try/catch and returns `null`
  (falling back to no tempo-match, not a failed drop) on any unexpected
  error, and computes its onset-flux max with a manual loop instead of
  `Math.max(...flux)` — spreading a large typed array as call arguments
  can throw a stack-size error on longer tracks (a several-minute drop is
  thousands of ~10ms analysis windows).
- Green, Blue, and Red are driven differently under the hood: Green/Red
  are re-read fresh by the step scheduler every 16th note, so newly
  dropped sounds just show up in the next pass. Blue plays whole samples
  via an `onended` chain that only starts when explicitly kicked off, so
  `handleBlueDrop()` in `renderer.js` explicitly calls `scheduleBlueTrack()`
  if playback is already running and Blue doesn't have anything playing
  yet — otherwise a sample dropped on Blue mid-session would sit queued
  but silent until you manually stopped and restarted.
