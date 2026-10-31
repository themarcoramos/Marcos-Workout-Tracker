# Marcos-Workout-Tracker
Custom workout tracking web app with multi-routine tabs, embedded video form guides, and next-day scheduling. A tailored fitness tracking dashboard for custom workout splits, video guides, and progressive overload logging.

## Features
- Ultimate PPL program: 3 phases, 13 weeks, 4 workouts a week, each with the sets, reps, target RPE, rest and form videos from the program PDF.
- RPE picker: tap the RPE box on any set to rate it from 1 to 10 (half points supported). The target RPE for the set is highlighted and the box is colour-coded from cool (easy) to hot (max effort).
- Progress: a live set counter on every workout, and the day, week, phase and program tiles fill up and turn green as you finish sets.
- Rest timer: starts when you tick a work set, using that exercise's rest time (-15s, +15s and skip buttons). Stretch holds have a 30s timer.
- Last time: shows what you lifted last time for the same exercise and pre-fills the weight.
- Continue button on the home page that jumps back to your last workout.
- Everything you log is saved in the browser (localStorage), separately for every week.

## Files
- `app.css` and `app.js`: shared styles and behaviour for every page.
- `program.js`: generated list of every workout day, used for the progress tiles.
