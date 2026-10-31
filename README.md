# Marco's Workout Tracker

An installable, offline-capable workout logger for your phone. Log weight and effort (RPE) for every set, get an automatic rest timer, and see what you lifted last time. It runs a 13-week push/pull/legs program and includes a builder for designing your own training days.

**Live app:** https://themarcoramos.github.io/Marcos-Workout-Tracker/

## Why I built it

I used to log my workouts in my notes. Notes can store numbers, but they can't time my rest between sets or show me what I lifted last time. So I built a tracker that does both and keeps everything on my own device.

## Features

- **Ultimate PPL program:** 3 phases, 13 weeks, 4 workouts a week, each with the sets, reps, target RPE, rest and form videos from the program PDF.
- **RPE picker:** tap the RPE box on any set to rate it from 1 to 10 (half points supported). The target RPE for the set is highlighted, and the box is colour-coded from cool (easy) to hot (max effort).
- **Rest timer:** starts when you tick a work set, using that exercise's rest time (-15s, +15s and skip buttons). Stretch holds have a 30s timer.
- **Last time:** shows what you lifted last time for the same exercise and pre-fills the weight.
- **Progress:** a live set counter on every workout, and the day, week, phase and program tiles fill up and turn green as you finish sets.
- **Continue button** on the home page that jumps back to your last workout.
- **Design your own program:** a separate tile on the home page. Build your own training days from a library of 126 exercises (all with form videos), start from a Push/Pull/Legs/Upper/Lower/Full body template or a blank day, set sets, reps, target RPE and rest for each exercise, add swap options, and add exercises of your own. Each day is logged with the same set rows, RPE picker, rest timer and "Last time" hints as the PPL program. Finishing a workout saves it to a short history and starts a fresh run next time. Warm-up rows and per-exercise notes aren't included.
- **Private by design:** everything you log is saved in your browser (localStorage), separately for every week. There are no accounts and no backend, and the app sends your workout data nowhere.

## Install as an app

The site is a PWA: it can be added to a phone's home screen and works offline. YouTube form videos and Google Fonts load from their own sites, so those need a connection.

- iPhone/iPad: open the site in Safari, tap Share, then Add to Home Screen.
- Android: open in Chrome, then menu, Install app.
- Heads up: the installed app keeps its own saved data, separate from the browser tab, so workouts logged in the browser won't appear in it.

## How it's built

- Plain HTML, CSS and JavaScript. No framework, no build step, no backend.
- Each week and day of the program is its own static page. `app.js` holds the shared behaviour (set logging, RPE picker, rest timer, progress, "last time" hints), and `custom.js` powers the day builder.
- A service worker caches every page so the whole program works offline.
- Built with AI-assisted development.

## Program credit

The 13-week program in this app follows Jeff Nippard's [The Ultimate Push Pull Legs System](https://www.jeffnippard.com/products/the-ultimate-push-pull-legs-system). This is an unofficial personal tracker and is not affiliated with or endorsed by him. If you want the full program, get it from him.

## Files

- `app.css` and `app.js`: shared styles and behaviour for every page.
- `program.js`: generated list of every workout day, used for the progress tiles.
- `custom.html`, `custom-edit.html`, `custom-day.html` and `custom.js`: the Design your own program pages (your days, the day editor with the exercise picker, and the workout page). Your program is saved in the browser under `custom:*` keys, so it stays on that device.
- `exercises.js`: the exercise library the picker uses (name, muscle group, form video, starting sets/reps/RPE/rest). Add or edit entries to change what people can pick from.
- `manifest.webmanifest`, `sw.js`, `icons/`: what makes it installable and offline-capable. `sw.js` caches every page; if you add a new page, add it to the `PRECACHE` list (it also gets cached the first time it's visited).
