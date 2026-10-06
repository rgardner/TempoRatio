# TempoRatio

TempoRatio is a hands-free practice and rest timer for musicians. It measures a playing interval and recommends a proportional rest period, so you can focus on practicing instead of operating a timer.

In automatic mode, TempoRatio listens through the device microphone and detects playing and silence locally. Audio is not recorded or uploaded. Manual mode is available when you prefer to control each interval yourself or cannot use microphone access.

## How it works

1. Start a session and begin playing.
2. TempoRatio measures the interval, either through sound detection or manual controls.
3. When playing stops, it recommends a rest based on your selected play-to-rest ratio. The default is 1:1.
4. Start playing again whenever you are ready, including before the recommended rest ends.

The app also supports microphone calibration, adjustable detection sensitivity, session summaries, and installable Progressive Web App behavior.

## Run locally

Requirements: Node.js and npm.

```sh
cd web
npm ci
npm run dev
```

Vite prints the local address to open in a browser. Microphone access requires a secure context, such as `localhost` or an HTTPS deployment.

To create a production build:

```sh
npm run build
```

The generated site is written to `web/dist`.

## Deploy

The web app uses relative asset paths, which supports hosting from a GitHub Pages project site. Build the app with `npm run build` from `web` and publish the contents of `web/dist` as the Pages site.

## Repository layout

- `web/` contains the React, TypeScript, and Vite web app and PWA assets.
- `TempoRatio/` contains the SwiftUI app project.
- `PRODUCT_REQUIREMENTS_DOC.md` describes the product requirements.
