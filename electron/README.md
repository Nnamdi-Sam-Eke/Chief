# Chief desktop shell

A thin Electron wrapper — no UI logic of its own. It loads the real Chief web
app (your dev server or your deployed URL) into two places:

- an always-on-top, frameless, transparent **orb window** (loads `/orb`)
- a normal **main window** (loads `/`), opened on demand

and adds what a browser tab can't: a tray icon, staying alive after you close
the window, a global keyboard shortcut, and mic/notification permissions
granted without a prompt UI (there's no "Allow" button to click on a window
you didn't summon).

## Run it

```
cd electron
npm install
npm start   # starts the local `npm run dev` server automatically when needed
# or, against your deployed app:
CHIEF_APP_URL=https://your-deployed-url.vercel.app npm start
```

Defaults to `http://localhost:8080` if `CHIEF_APP_URL` isn't set. In an
unpackaged development run, Electron checks that URL and starts the main
project's `npm run dev` command if it is unavailable. The tray and orb windows
are created only after the app responds. If another server is already serving
that URL, Electron reuses it and does not start or stop it. A packaged app
should use a deployed `CHIEF_APP_URL`; it does not start the development server.

## What you get

- A small glowing orb sits in the bottom-right corner of your screen, always
  on top. It's alive: it reflects Chief's real presence state (idle /
  listening / thinking / speaking) — the same state your voice interactions
  already drive elsewhere in the app.
- Say "Hey Chief" and talk — the wake-word listener runs on the orb page
  itself, so it works without the main window open.
- Click the orb, or press **Cmd/Ctrl+Shift+C**, or click the tray icon, to
  open the full app.
- Closing the main window does NOT quit the app — it stays in the tray. Quit
  from the tray menu.

## Before shipping a real build

- **Icon**: `nativeImage.createEmpty()` is a placeholder in `main.js`. Add a
  real `icon.png` (and reference it in `main.js` + `package.json`'s `build`
  config) before running `npm run dist`.
- **Packaging**: `npm run dist` (electron-builder) produces a real installer
  per-platform. Untested in this pass — verify on your actual machine.
- **CHIEF_APP_URL**: hardcode your production URL somewhere durable (a
  `.env` electron-builder can read, or bake it into `main.js` before
  packaging) rather than relying on someone remembering to set the env var
  each launch.

## Known limitations (by design, for now)

- **Mobile isn't touched by this.** iOS doesn't allow any app to draw a
  floating overlay over other apps — that's a sandbox rule, not something
  fixable in code. Android would need a native wrapper (e.g. Capacitor)
  with a "draw over other apps" permission — a separate, later effort.
- Login launch is registered through Electron's OS login-item API. The
  packaged Windows installer still needs a real sign-in/restart check.
- In development, the shell starts `npm run dev` when the local server is
  unavailable and waits before creating its tray/orb windows. Packaged builds
  must be configured with a reachable `CHIEF_APP_URL`.
