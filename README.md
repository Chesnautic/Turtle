# Turtle 🐢

A tiny desktop pet that lives on top of your other windows. Drag an audio
file onto him and he eats it, chops it into 16 slices, and auto-arranges
them into a looping beat you can remix on a mini step sequencer.

## What it does

- Sits on your desktop as a small, transparent, always-on-top, frameless
  window (drag him around by clicking his body or the panel header).
- Drop a `.wav`, `.mp3`, `.ogg`, `.flac`, `.aiff`, or `.m4a` file on him and
  he plays a chomping eating animation while the sample is decoded.
- The sample is sliced into 16 equal chunks. Each chunk's loudness is
  analyzed and used to auto-build a step pattern (louder/percussive slices
  are more likely to be turned on), which then loops as a beat.
- While the beat is playing he sings along: his mouth cycles through a
  few different open shapes (rounded "oh", tall "ah", wide "ee") in sync
  with each active step instead of just chomping, his eyebrows lift, his
  body sways side to side and picks up a soft glow on the beat, and he
  occasionally pops out a little floating music note.
- A small collapsible panel lets you: toggle individual steps on/off,
  re-shuffle the auto-generated pattern, change the tempo (60–180 BPM),
  and play/stop the loop.
- Right-click him for a small menu: toggle click-through (so he stops
  intercepting mouse clicks meant for windows behind him), reset his
  position to the bottom-right corner, or quit.

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
1.0.0.exe`) in the `dist/` folder. You'll need an internet connection the
first time you build, since `electron-builder` downloads Electron's
prebuilt binaries for Windows.

Run that installer — it walks through a short setup wizard (you can pick
the install location) and finishes by installing Turtle with a "Turtle"
shortcut on your Desktop and in the Start Menu, added automatically
(`createDesktopShortcut` / `createStartMenuShortcut` are on in
`package.json`'s `build.nsis` config; there are checkboxes in the wizard
if you ever want to skip one). Launch Turtle from either shortcut and
he'll appear in the bottom-right corner of your screen.

To uninstall later, use "Add or Remove Programs" like any other Windows
app — NSIS registers a proper uninstaller.

## Giving Turtle to other people (no coding required on their end)

The installer above is already the "just download and run it" artifact —
anyone you hand `Turtle Setup 1.0.0.exe` to only needs to double-click it,
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
git tag v1.0.0
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
main.js       Electron main process — creates the transparent window,
              the right-click context menu.
preload.js    Small, safe bridge exposed to the renderer (contextIsolation
              is on, nodeIntegration is off).
index.html    Window contents: the turtle's canvas + the sequencer panel.
renderer.js   Everything else: turtle drawing/animation, drag & drop,
              Web Audio decoding/slicing, the step scheduler.
style.css     Look & feel — matches the green palette from the reference
              art, dark rounded panel, pixelated canvas scaling.
assets/       App icon (icon.ico / icon.png) used for the Windows build.
.github/
  workflows/
    build.yml   GitHub Actions workflow that auto-builds the installer
                and publishes it to a GitHub Release on version tags
                (see "Giving Turtle to other people" above).
```

## Customizing

- **Look**: `renderer.js` draws the turtle entirely with canvas shapes in
  `draw()` / `roundedBlob()` / `drawMouth()` — no image assets to swap, just
  tweak colors/proportions there.
- **Slice count**: change `STEP_COUNT` at the top of `renderer.js` (keep it
  a multiple of 4 so it stays musically sane; the step grid CSS in
  `style.css` assumes 16 columns, so update `grid-template-columns` too if
  you change it).
- **Auto-pattern behavior**: see `generatePattern()` in `renderer.js` —
  it ranks slices by RMS loudness and turns on the top N (6–10, randomized)
  plus the downbeat.
- **Singing behavior**: `triggerMouthPulse()` fires on every active step —
  it sets `turtle.singPulse` (drives the brow raise, sway, and glow),
  picks a new `mouthShape` (`'O' | 'A' | 'E'`, see `drawMouth()`), and has
  a chance to spawn a floating note (`spawnNote()`). Tune the decay rates
  in `updateTurtle()` (the `*= 0.88` / `*= 0.82` lines) to make him more
  or less bouncy.
- **Window size / start position**: `WINDOW_WIDTH` / `WINDOW_HEIGHT` in
  `main.js`.

## Notes

- Audio decoding and playback use the standard Web Audio API in the
  renderer — no native audio dependencies to compile.
- The window is transparent and frameless, so on Windows you may see a
  faint shadow depending on your display scaling; `hasShadow: false` is
  already set to minimize that.
