# Marcos-Workout-Tracker
Custom workout tracking web app with multi-routine tabs, embedded video form guides, and next-day scheduling. A tailored fitness tracking dashboard for custom workout splits, video guides, and progressive overload logging.

## Features
- Ultimate PPL program: 3 phases, 13 weeks, 4 workouts a week, each with the sets, reps, target RPE, rest and form videos from the program PDF.
- RPE picker: tap the RPE box on any set to rate it from 1 to 10 (half points supported). The target RPE for the set is highlighted and the box is colour-coded from cool (easy) to hot (max effort).
- Progress: a live set counter on every workout, and the day, week, phase and program tiles fill up and turn green as you finish sets.
- Rest timer: starts when you tick a work set, using that exercise's rest time (-15s, +15s and skip buttons). Stretch holds have a 30s timer.
- Last time: shows what you lifted last time for the same exercise and pre-fills the weight.
- Continue button on the home page that jumps back to your last workout.
- Design your own program: a separate tile on the home page. Build your own training days from a library of 100+ exercises (all with form videos), start from a Push/Pull/Legs/Upper/Lower/Full body template or a blank day, set sets, reps, target RPE and rest for each exercise, add swap options, and add exercises of your own. Each day is then logged with the same set rows, RPE picker, rest timer and "Last time" hints as the PPL program. Finishing a workout saves it to a short history and starts a fresh run next time. Warm-up rows and per-exercise notes aren't included.
- Everything you log is saved in the browser (localStorage), separately for every week.

## Install as an app
The site is a PWA: it can be added to a phone's home screen and works offline (YouTube form videos still need a connection).
- iPhone/iPad: open the site in Safari, tap Share, then Add to Home Screen.
- Android: open in Chrome, then menu, Install app.
- Heads up: the installed app keeps its own saved data, separate from the browser tab, so workouts logged in the browser won't appear in it.

## Files
- `app.css` and `app.js`: shared styles and behaviour for every page.
- `program.js`: generated list of every workout day, used for the progress tiles.
- `custom.html`, `custom-edit.html`, `custom-day.html` and `custom.js`: the Design your own program pages (your days, the day editor with the exercise picker, and the workout page). Your program is saved in the browser under `custom:*` keys, so it stays on that device.
- `exercises.js`: the exercise library the picker uses (name, muscle group, form video, starting sets/reps/RPE/rest). Add or edit entries to change what people can pick from.
- `manifest.webmanifest`, `sw.js`, `icons/`: what makes it installable and offline-capable. `sw.js` caches every page; if you add a new page, add it to the `PRECACHE` list (it also gets cached the first time it's visited).
