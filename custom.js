/* Design your own program: build your own training days from the exercise library, then log them.
   One script runs three pages, picked by <body data-view="...">:
     home  (custom.html)       your days, templates, recent workouts
     edit  (custom-edit.html)  rename a day, add / reorder / remove exercises, set sets, reps, RPE, rest
     day   (custom-day.html)   the workout itself; same set rows, RPE picker and rest timer as the PPL pages
   Everything is saved in this browser (localStorage):
     custom:program      { v, days: [ { id, name, ex: [ { id, n, g, u, s, r, p, t, subs: [ { n, u } ] } ] } ] }
     custom:exercises    exercises you added yourself
     custom:sess:<day>   how many times you've finished that day (each run starts with empty sets)
     custom:log          one line per finished workout
     cu-<day>-<run>-...  the weights, RPE and ticks of the run in progress (same field ids scheme as the PPL pages) */
(function () {
    "use strict";

    var VIEW = document.body && document.body.getAttribute("data-view");
    if (!VIEW) { return; }

    var K_PROGRAM = "custom:program", K_EXTRA = "custom:exercises", K_LOG = "custom:log";
    var BRAND = " | Marco's Workout Plans";
    var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    var ARROW_UP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
    var ARROW_DOWN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

    // ---------- storage (never throws, e.g. private mode) ----------
    function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function put(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function drop(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
    function readJSON(k) { try { return JSON.parse(get(k)); } catch (e) { return null; } }
    function dropPrefix(prefix) {
        try {
            for (var i = localStorage.length - 1; i >= 0; i--) {
                var k = localStorage.key(i);
                if (k && k.indexOf(prefix) === 0) { localStorage.removeItem(k); }
            }
        } catch (e) { /* ignore */ }
    }
    function writeJSON(k, v) {
        var ok = put(k, JSON.stringify(v));
        if (!ok) { var n = document.getElementById("save-error"); if (n) { n.hidden = false; } }
        return ok;
    }

    // ---------- small helpers ----------
    function $(id) { return document.getElementById(id); }
    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }
    function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
    function param(name) {
        var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(location.search);
        try { return m ? decodeURIComponent(m[1]) : ""; } catch (e) { return ""; }
    }
    function isId(s) { return typeof s === "string" && /^[A-Za-z0-9]{1,32}$/.test(s); }
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    function clampInt(v, lo, hi, d) { v = parseInt(v, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); }
    function dash(s) { return String(s).replace(/(\d)\s*-\s*(\d)/g, "$1–$2"); }
    // Only web links are ever put in a link; anything else (javascript:, data:, ...) is dropped.
    function safeUrl(u) {
        u = String(u == null ? "" : u).trim();
        if (!u) { return ""; }
        if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) { u = "https://" + u; }
        try {
            var x = new URL(u);
            return (x.protocol === "https:" || x.protocol === "http:") && x.hostname.indexOf(".") > 0 ? x.href : "";
        } catch (e) { return ""; }
    }
    function searchUrl(name) { return "https://www.youtube.com/results?search_query=" + encodeURIComponent(name + " form"); }
    function ago(t) {
        var a = new Date(); a.setHours(0, 0, 0, 0);
        var b = new Date(t); b.setHours(0, 0, 0, 0);
        var d = Math.round((a - b) / 864e5);
        if (d <= 0) { return "today"; }
        if (d === 1) { return "yesterday"; }
        if (d < 14) { return d + " days ago"; }
        if (d < 60) { return Math.floor(d / 7) + " weeks ago"; }
        return b.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    }
    // Two-tap confirmation without a pop-up: the first tap changes the button, the second one does it.
    function armed(btn, text) {
        if (btn._armed) {
            clearTimeout(btn._armT); btn._armed = false;
            btn.classList.remove("is-armed"); btn.textContent = btn._label;
            return true;
        }
        btn._label = btn.textContent; btn._armed = true;
        btn.classList.add("is-armed"); btn.textContent = text;
        btn._armT = setTimeout(function () {
            btn._armed = false; btn.classList.remove("is-armed"); btn.textContent = btn._label;
        }, 4500);
        return false;
    }

    // ---------- data ----------
    var RPE_RX = /^\d+(\.\d+)?(-\d+(\.\d+)?)?$/;
    function cleanRpe(p) {
        p = String(p == null ? "" : p).replace(/[–—]/g, "-").replace(/\s+/g, "");
        if (!RPE_RX.test(p)) { return ""; }
        return p.split("-").every(function (n) { n = parseFloat(n); return n >= 1 && n <= 10; }) ? p : "";
    }
    function cleanReps(r, d) {
        r = String(r == null ? "" : r).trim().replace(/\s+/g, " ").slice(0, 14);
        return r || d;
    }
    function cleanSub(s) {
        if (!s || typeof s.n !== "string" || !s.n.trim()) { return null; }
        return { n: s.n.trim().slice(0, 60), u: safeUrl(s.u) };
    }
    function normEx(e) {
        if (!e || typeof e.n !== "string" || !e.n.trim()) { return null; }
        return {
            id: isId(e.id) ? e.id : "x" + uid(),
            n: e.n.trim().slice(0, 60),
            g: typeof e.g === "string" ? e.g.slice(0, 20) : "",
            u: safeUrl(e.u),
            s: clampInt(e.s, 1, 10, 3),
            r: cleanReps(e.r, "8-12"),
            p: cleanRpe(e.p),
            t: clampInt(e.t, 0, 600, 90),
            subs: (Array.isArray(e.subs) ? e.subs : []).map(cleanSub).filter(Boolean).slice(0, 8)
        };
    }
    function loadProgram() {
        var p = readJSON(K_PROGRAM);
        var days = p && Array.isArray(p.days) ? p.days : [];
        return {
            v: 1,
            days: days.filter(function (d) { return d && isId(d.id); }).map(function (d) {
                return {
                    id: d.id,
                    name: (typeof d.name === "string" && d.name.trim() ? d.name.trim() : "Untitled day").slice(0, 40),
                    ex: (Array.isArray(d.ex) ? d.ex : []).map(normEx).filter(Boolean).slice(0, 40)
                };
            })
        };
    }
    function saveProgram(p) { return writeJSON(K_PROGRAM, p); }
    function findDay(p, id) {
        for (var i = 0; i < p.days.length; i++) { if (p.days[i].id === id) { return p.days[i]; } }
        return null;
    }
    function setCount(day) { return day.ex.reduce(function (n, e) { return n + e.s; }, 0); }
    function daySummary(day) {
        return day.ex.length ? plural(day.ex.length, "exercise") + " · " + plural(setCount(day), "set") : "No exercises yet";
    }
    function session(dayId) { return parseInt(get("custom:sess:" + dayId), 10) || 0; }
    function setPrefix(dayId, sess) { return "cu-" + dayId + "-" + sess + "-"; }
    function fieldId(dayId, sess, exId, k, kind) { return setPrefix(dayId, sess) + exId + "-w" + k + "-" + kind; }
    function runProgress(day) {
        var sess = session(day.id), done = 0, total = 0;
        day.ex.forEach(function (e) {
            for (var k = 1; k <= e.s; k++) {
                total++;
                if (get(fieldId(day.id, sess, e.id, k, "done")) === "true") { done++; }
            }
        });
        return { done: done, total: total };
    }
    function clearLastDay(dayId) {
        var last = readJSON("lastDay");
        if (last && typeof last.href === "string" && last.href.indexOf("custom-day.html?d=" + dayId) === 0) { drop("lastDay"); }
    }

    // ---------- exercise library (built in + your own) ----------
    var BASE = window.EXERCISE_LIBRARY || [];
    var BASE_GROUPS = window.EXERCISE_GROUPS || [];
    function ownExercises() {
        var x = readJSON(K_EXTRA);
        return (Array.isArray(x) ? x : []).filter(function (e) { return e && isId(e.id) && typeof e.n === "string" && e.n.trim(); })
            .map(function (e) {
                var n = normEx(e); n.id = e.id; n.mine = true; return n;
            });
    }
    function allExercises() { return BASE.concat(ownExercises()); }
    function byName(name) {
        name = String(name).toLowerCase();
        var all = allExercises();
        for (var i = 0; i < all.length; i++) { if (all[i].n.toLowerCase() === name) { return all[i]; } }
        return null;
    }
    function fromLibrary(item) {
        return { id: "x" + uid(), n: item.n, g: item.g || "", u: item.u || "", s: item.s, r: item.r, p: item.p || "", t: item.t, subs: [] };
    }
    function groupDefaults(g) {
        return g === "Core" || g === "Calves" ? { s: 3, r: "10-15", p: "9-10", t: 60 } : { s: 3, r: "8-12", p: "8-9", t: 120 };
    }
    function rpeLabel(p) { return p ? "RPE " + p : "no RPE target"; }
    function libMeta(e) {
        return (e.g || "Other") + " · " + e.s + "×" + dash(e.r) + (e.p ? " @ " + dash(e.p) : "");
    }

    // ---------- templates ----------
    var PRESETS = {
        "Push": ["Bench Press", "Incline DB Press", "Machine Shoulder Press", "DB Lateral Raise", "Triceps Pressdown", "Overhead Cable Triceps Extension"],
        "Pull": ["Lat Pulldown", "Cable Seated Row", "Single-Arm DB Row", "Reverse Cable Flye", "EZ-Bar Curl", "DB Shrug"],
        "Legs": ["Squat", "Leg Press", "DB RDL", "Seated Leg Curl", "Leg Extension", "Standing Calf Raise"],
        "Upper": ["Bench Press", "Lat Pulldown", "Machine Shoulder Press", "Cable Seated Row", "EZ-Bar Curl", "Triceps Pressdown"],
        "Lower": ["Squat", "DB RDL", "Leg Press", "Lying Leg Curl", "Standing Calf Raise", "Cable Crunch"],
        "Full body": ["Squat", "Bench Press", "Lat Pulldown", "DB RDL", "Machine Shoulder Press", "Plank"]
    };
    var PRESET_NAMES = { "Upper": "Upper body", "Lower": "Lower body", "Blank": "New day" };
    function uniqueName(base, days) {
        var taken = {}; days.forEach(function (d) { taken[d.name.toLowerCase()] = true; });
        if (!taken[base.toLowerCase()]) { return base; }
        for (var i = 2; i < 100; i++) { if (!taken[(base + " " + i).toLowerCase()]) { return base + " " + i; } }
        return base + " " + uid();
    }

    // =====================================================================
    // HOME: your days
    // =====================================================================
    function initHome() {
        var prog = loadProgram();
        var box = $("days");

        function render() {
            if (!prog.days.length) {
                box.innerHTML = '<div class="empty"><strong>No days yet</strong>Pick a template below to start from, or add a blank day and choose every exercise yourself.</div>';
                return;
            }
            var log = readJSON(K_LOG) || [];
            box.innerHTML = prog.days.map(function (day) {
                var href = day.ex.length ? "custom-day.html?d=" + day.id : "custom-edit.html?d=" + day.id;
                var run = runProgress(day), started = run.done > 0;
                var last = null;
                log.forEach(function (l) { if (l && l.d === day.id && (!last || l.t > last.t)) { last = l; } });
                var status = !day.ex.length ? "Tap to add exercises"
                    : started ? (run.done === run.total ? "All sets done. Finish the workout to save it" : "In progress: " + run.done + " of " + plural(run.total, "set"))
                    : last ? "Last done " + ago(last.t) : "Not started yet";
                var pct = started && run.total ? Math.round(run.done / run.total * 100) : 0;
                return '<div class="mine">' +
                    '<a class="tile' + (started && run.done === run.total ? " is-done" : "") + '" href="' + href + '">' +
                    '<span class="tile-check">' + CHECK + '</span>' +
                    '<span class="tile-title">' + esc(day.name) + '</span>' +
                    '<span class="tile-sub">' + esc(daySummary(day)) + '</span>' +
                    '<span class="tile-sub">' + esc(status) + '</span>' +
                    '<span class="tile-bar"><span style="width:' + pct + '%"></span></span></a>' +
                    '<div class="mine-actions">' +
                    '<a class="mini-btn" href="custom-edit.html?d=' + day.id + '">Edit</a>' +
                    '<button type="button" class="mini-btn" data-act="dup" data-d="' + day.id + '">Duplicate</button>' +
                    '<button type="button" class="mini-btn danger" data-act="del" data-d="' + day.id + '">Delete</button>' +
                    '</div></div>';
            }).join("");
        }

        function renderRecent() {
            var host = $("recent");
            var log = (readJSON(K_LOG) || []).filter(function (l) { return l && typeof l.n === "string" && l.t; });
            if (!host || !log.length) { if (host) { host.innerHTML = ""; } return; }
            host.innerHTML = '<h2 class="section-title">Recent workouts</h2><ul class="log-list">' +
                log.slice(-6).reverse().map(function (l) {
                    return '<li><span class="log-name">' + esc(l.n) + '</span><span class="log-meta">' +
                        esc((l.done || 0) + " of " + plural(l.total || 0, "set") + " · " + ago(l.t)) + '</span></li>';
                }).join("") + '</ul>';
        }

        box.addEventListener("click", function (e) {
            var b = e.target.closest("button[data-act]");
            if (!b) { return; }
            var day = findDay(prog, b.getAttribute("data-d"));
            if (!day) { return; }
            if (b.getAttribute("data-act") === "dup") {
                var copy = JSON.parse(JSON.stringify(day));
                copy.id = "d" + uid();
                copy.name = uniqueName(day.name + " copy", prog.days).slice(0, 40);
                copy.ex.forEach(function (x) { x.id = "x" + uid(); });
                prog.days.splice(prog.days.indexOf(day) + 1, 0, copy);
                saveProgram(prog); render();
            } else if (b.getAttribute("data-act") === "del") {
                if (!armed(b, "Tap to delete")) { return; }
                prog.days.splice(prog.days.indexOf(day), 1);
                dropPrefix("cu-" + day.id + "-"); drop("custom:sess:" + day.id); clearLastDay(day.id);
                saveProgram(prog); render();
            }
        });

        $("presets").addEventListener("click", function (e) {
            var b = e.target.closest("button[data-preset]");
            if (!b) { return; }
            var key = b.getAttribute("data-preset");
            var names = PRESETS[key] || [];
            var day = {
                id: "d" + uid(),
                name: uniqueName(PRESET_NAMES[key] || key, prog.days),
                ex: names.map(byName).filter(Boolean).map(fromLibrary)
            };
            prog.days.push(day);
            if (saveProgram(prog)) { location.href = "custom-edit.html?d=" + day.id; } else { render(); }
        });

        render();
        renderRecent();
        // Coming back with the back button: show the latest progress.
        window.addEventListener("pageshow", function (e) { if (e.persisted) { prog = loadProgram(); render(); renderRecent(); } });
    }

    // =====================================================================
    // EDIT: build one day
    // =====================================================================
    function initEdit() {
        var prog = loadProgram();
        var day = findDay(prog, param("d"));
        if (!day) {
            $("missing").hidden = false;
            $("edit-hero").hidden = true; $("exlist").hidden = true; $("edit-actions").hidden = true;
            return;
        }
        var list = $("exlist"), nameInput = $("day-name"), summary = document.querySelector("[data-summary]");
        var picker = $("picker"), pickerMode = "add", pickerEx = null, pickerGroup = "All";
        nameInput.value = day.name;
        document.title = "Edit " + day.name + BRAND;
        $("start-link").href = "custom-day.html?d=" + day.id;

        function save() { saveProgram(prog); }
        function findEx(id) {
            for (var i = 0; i < day.ex.length; i++) { if (day.ex[i].id === id) { return day.ex[i]; } }
            return null;
        }

        function card(e, i) {
            var last = i === day.ex.length - 1;
            return '<section class="ex-card" data-ex="' + e.id + '" aria-label="' + esc(e.n) + '">' +
                '<div class="ex-top">' +
                '<div class="ex-name"><span>' + esc(e.n) + '</span>' + (e.g ? '<small>' + esc(e.g) + '</small>' : '') + '</div>' +
                '<div class="ex-move">' +
                '<button type="button" class="icon-btn" data-act="up" aria-label="Move ' + esc(e.n) + ' up"' + (i === 0 ? " disabled" : "") + '>' + ARROW_UP + '</button>' +
                '<button type="button" class="icon-btn" data-act="down" aria-label="Move ' + esc(e.n) + ' down"' + (last ? " disabled" : "") + '>' + ARROW_DOWN + '</button>' +
                '<button type="button" class="mini-btn danger" data-act="rm" aria-label="Remove ' + esc(e.n) + '">Remove</button>' +
                '</div></div>' +
                '<div class="ex-fields">' +
                '<label><span>Sets</span><input class="in" data-f="s" type="number" inputmode="numeric" min="1" max="10" value="' + e.s + '"></label>' +
                '<label><span>Reps</span><input class="in" data-f="r" type="text" maxlength="14" autocomplete="off" value="' + esc(e.r) + '"></label>' +
                '<label><span>RPE</span><input class="in" data-f="p" type="text" inputmode="decimal" maxlength="7" autocomplete="off" placeholder="none" value="' + esc(e.p) + '"></label>' +
                '<label><span>Rest (sec)</span><input class="in" data-f="t" type="number" inputmode="numeric" min="0" max="600" step="15" value="' + e.t + '"></label>' +
                '</div>' +
                '<div class="ex-subs"><span class="ex-subs-label">Swaps</span>' +
                e.subs.map(function (s, k) {
                    return '<span class="sub-chip">' + esc(s.n) + '<button type="button" data-act="rmsub" data-i="' + k + '" aria-label="Remove swap ' + esc(s.n) + '">×</button></span>';
                }).join("") +
                (e.subs.length < 8 ? '<button type="button" class="sub-add" data-act="sub">+ Add swap</button>' : '') +
                '</div></section>';
        }

        function renderList() {
            if (!day.ex.length) {
                list.innerHTML = '<div class="empty"><strong>No exercises yet</strong>Tap Add exercise to pick from the library.</div>';
            } else {
                list.innerHTML = day.ex.map(card).join("");
            }
            summary.textContent = daySummary(day);
            $("start-link").hidden = !day.ex.length;
        }

        // --- day name ---
        nameInput.addEventListener("input", function () {
            day.name = nameInput.value.trim().slice(0, 40) || "Untitled day";
            document.title = "Edit " + day.name + BRAND;
            save();
        });
        nameInput.addEventListener("change", function () { nameInput.value = day.name; });
        nameInput.addEventListener("keydown", function (e) { if (e.key === "Enter") { nameInput.blur(); } });

        // --- exercise cards ---
        list.addEventListener("input", function (ev) {
            var inp = ev.target.closest("input[data-f]");
            var host = inp && inp.closest(".ex-card");
            var ex = host && findEx(host.getAttribute("data-ex"));
            if (!ex) { return; }
            var f = inp.getAttribute("data-f");
            if (f === "s") { ex.s = clampInt(inp.value, 1, 10, ex.s); }
            else if (f === "r") { ex.r = cleanReps(inp.value, "8-12"); }
            else if (f === "p") { ex.p = cleanRpe(inp.value); }
            else if (f === "t") { ex.t = clampInt(inp.value, 0, 600, ex.t); }
            summary.textContent = daySummary(day);
            save();
        });
        list.addEventListener("change", function (ev) {
            var inp = ev.target.closest("input[data-f]");
            var host = inp && inp.closest(".ex-card");
            var ex = host && findEx(host.getAttribute("data-ex"));
            if (!ex) { return; }
            inp.value = ex[inp.getAttribute("data-f")];   // show what was actually saved
        });
        list.addEventListener("click", function (ev) {
            var b = ev.target.closest("[data-act]");
            var host = b && b.closest(".ex-card");
            var ex = host && findEx(host.getAttribute("data-ex"));
            if (!ex) { return; }
            var act = b.getAttribute("data-act"), i = day.ex.indexOf(ex);
            if (act === "up" || act === "down") {
                var j = act === "up" ? i - 1 : i + 1;
                if (j < 0 || j >= day.ex.length) { return; }
                day.ex[i] = day.ex[j]; day.ex[j] = ex;
                save(); renderList();
                var moved = list.querySelector('[data-ex="' + ex.id + '"]');
                var again = moved && (moved.querySelector('[data-act="' + act + '"]:not([disabled])') || moved.querySelector('[data-act="' + (act === "up" ? "down" : "up") + '"]:not([disabled])'));
                if (again) { again.focus(); }
            } else if (act === "rm") {
                if (!armed(b, "Tap to remove")) { return; }
                day.ex.splice(i, 1);
                save(); renderList();
            } else if (act === "rmsub") {
                ex.subs.splice(parseInt(b.getAttribute("data-i"), 10), 1);
                save(); renderList();
            } else if (act === "sub") {
                openPicker("sub", ex.id);
            }
        });
        $("add-ex").addEventListener("click", function () { openPicker("add", null); });

        // --- exercise picker ---
        var searchBox = $("picker-search"), pickList = $("picker-list"), groupsBox = $("picker-groups");
        var status = $("picker-status");
        function groupNames() {
            var names = BASE_GROUPS.slice();
            allExercises().forEach(function (e) { if (e.g && names.indexOf(e.g) < 0) { names.push(e.g); } });
            return names;
        }
        function renderGroups() {
            var all = ["All"].concat(groupNames());
            if (ownExercises().length) { all.push("Mine"); }
            if (all.indexOf(pickerGroup) < 0) { pickerGroup = "All"; }
            groupsBox.innerHTML = all.map(function (g) {
                return '<button type="button" class="pick-chip" data-g="' + esc(g) + '" aria-pressed="' + (g === pickerGroup) + '">' + esc(g) + '</button>';
            }).join("");
        }
        function isAdded(item) {
            var n = item.n.toLowerCase();
            if (pickerMode === "sub") {
                var ex = findEx(pickerEx);
                return !ex || ex.n.toLowerCase() === n || ex.subs.some(function (s) { return s.n.toLowerCase() === n; });
            }
            return day.ex.some(function (e) { return e.n.toLowerCase() === n; });
        }
        function renderPicker() {
            var q = searchBox.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
            var items = allExercises().filter(function (e) {
                if (pickerGroup === "Mine" ? !e.mine : pickerGroup !== "All" && e.g !== pickerGroup) { return false; }
                var hay = (e.n + " " + (e.a || []).join(" ") + " " + (e.g || "")).toLowerCase();
                return q.every(function (t) { return hay.indexOf(t) >= 0; });
            });
            var top = pickList.parentNode.scrollTop;
            pickList.innerHTML = items.length ? items.map(function (e) {
                var added = isAdded(e);
                return '<div class="picker-row">' +
                    '<button type="button" class="picker-item' + (added ? " is-added" : "") + '" data-id="' + esc(e.id) + '"' + (added ? ' aria-disabled="true"' : "") + '>' +
                    '<span class="picker-name">' + esc(e.n) + (e.mine ? ' <em>Yours</em>' : '') + '</span>' +
                    '<span class="picker-meta">' + esc(libMeta(e)) + '</span>' +
                    '<span class="picker-add">' + (added ? CHECK + " Added" : "+ Add") + '</span></button>' +
                    (e.mine ? '<button type="button" class="picker-del" data-del="' + esc(e.id) + '" aria-label="Delete your exercise ' + esc(e.n) + '">Delete</button>' : '') +
                    '</div>';
            }).join("") : '<p class="picker-none">No exercises match. Try another search, or add your own below.</p>';
            pickList.parentNode.scrollTop = top;
        }
        function openPicker(mode, exId) {
            pickerMode = mode; pickerEx = exId;
            var ex = exId && findEx(exId);
            $("picker-title").textContent = mode === "sub" && ex ? "Add a swap for " + ex.n : "Add exercise";
            searchBox.value = ""; pickerGroup = "All"; status.textContent = "";
            renderGroups(); renderPicker();
            pickList.parentNode.scrollTop = 0;
            if (typeof picker.showModal === "function") { picker.showModal(); } else { picker.setAttribute("open", ""); }
        }
        function closePicker() {
            if (typeof picker.close === "function") { picker.close(); } else { picker.removeAttribute("open"); }
        }
        function addFromLibrary(item) {
            if (isAdded(item)) { return; }
            if (pickerMode === "sub") {
                var ex = findEx(pickerEx);
                if (!ex) { return; }
                ex.subs.push({ n: item.n, u: safeUrl(item.u) });
                status.textContent = "Added " + item.n + " as a swap";
            } else {
                day.ex.push(fromLibrary(item));
                status.textContent = "Added " + item.n;
            }
            save(); renderList(); renderPicker();
        }
        searchBox.addEventListener("input", renderPicker);
        groupsBox.addEventListener("click", function (e) {
            var b = e.target.closest("button[data-g]");
            if (!b) { return; }
            pickerGroup = b.getAttribute("data-g");
            renderGroups(); renderPicker();
        });
        pickList.addEventListener("click", function (e) {
            var del = e.target.closest("button[data-del]");
            if (del) {
                if (!armed(del, "Tap to delete")) { return; }
                var id = del.getAttribute("data-del");
                put(K_EXTRA, JSON.stringify(ownExercises().filter(function (x) { return x.id !== id; })));
                renderGroups(); renderPicker();
                return;
            }
            var b = e.target.closest("button[data-id]");
            if (!b) { return; }
            var id2 = b.getAttribute("data-id");
            var item = allExercises().filter(function (x) { return x.id === id2; })[0];
            if (item) { addFromLibrary(item); }
        });
        picker.addEventListener("click", function (e) { if (e.target === picker) { closePicker(); } });
        picker.querySelector("[data-picker-close]").addEventListener("click", closePicker);

        // --- add your own exercise ---
        var own = $("own-form"), ownGroup = $("own-group"), ownError = $("own-error");
        ownGroup.innerHTML = BASE_GROUPS.concat(["Other"]).map(function (g) { return '<option value="' + esc(g) + '">' + esc(g) + '</option>'; }).join("");
        own.addEventListener("submit", function (e) {
            e.preventDefault();
            var name = own.elements.n.value.trim().replace(/\s+/g, " ");
            var rawUrl = own.elements.u.value.trim();
            var url = safeUrl(rawUrl);
            ownError.textContent = "";
            if (name.length < 2) { ownError.textContent = "Give the exercise a name."; own.elements.n.focus(); return; }
            if (rawUrl && !url) { ownError.textContent = "That video link doesn't look right. Paste a full link, or leave it blank."; own.elements.u.focus(); return; }
            if (byName(name)) { ownError.textContent = "That exercise is already in the library. Search for it above."; own.elements.n.focus(); return; }
            var g = own.elements.g.value || "Other", d = groupDefaults(g);
            var entry = { id: "my" + uid(), n: name.slice(0, 60), g: g, u: url, s: d.s, r: d.r, p: d.p, t: d.t };
            var extra = ownExercises();
            extra.push(entry);
            if (!put(K_EXTRA, JSON.stringify(extra))) { ownError.textContent = "Your browser isn't letting this page save."; return; }
            own.reset(); ownGroup.value = g;
            own.closest("details").open = false;
            pickerGroup = "All"; searchBox.value = "";
            renderGroups();
            entry.mine = true;
            addFromLibrary(entry);
        });

        renderList();
    }

    // =====================================================================
    // DAY: the workout itself
    // =====================================================================
    function setRow(dayId, sess, ex, k) {
        var idp = setPrefix(dayId, sess) + ex.id + "-w" + k;
        var reps = /^\d+(\s*[-–]\s*\d+)?$/.test(ex.r) ? dash(ex.r) + (ex.r.trim() === "1" ? " rep" : " reps") : dash(ex.r);
        return '<div class="set work"><span class="set-num">' + k + '</span>' +
            '<div class="target"><span class="reps">' + esc(reps) + '</span><span class="goal">' + esc(ex.p ? "RPE " + dash(ex.p) : "Work set") + '</span></div>' +
            '<input type="number" class="field weight-input" id="' + idp + '-w" inputmode="decimal" step="any" min="0" placeholder="lbs" oninput="saveData(this)" aria-label="Set ' + k + ' weight in pounds">' +
            '<input type="number" class="field rpe-field" id="' + idp + '-rpe" inputmode="none" readonly min="1" max="10" step="0.5" placeholder="RPE" data-goal="' + esc(ex.p) + '" oninput="saveData(this)" aria-label="Set ' + k + ' RPE, 1 to 10">' +
            '<label class="done"><input type="checkbox" class="work-checkbox" id="' + idp + '-done" onchange="saveData(this)" aria-label="Set ' + k + ' done"><span class="done-box">' + CHECK + '</span></label></div>';
    }
    function restLabel(t) {
        if (t <= 0) { return ""; }
        if (t < 60) { return "Rest ~" + t + " sec"; }
        return "Rest ~" + Math.floor(t / 60) + " min" + (t % 60 ? " " + (t % 60) + " sec" : "");
    }
    function liftHtml(dayId, sess, ex) {
        var base = setPrefix(dayId, sess) + ex.id;
        var opts = [{ n: ex.n, u: ex.u }].concat(ex.subs);
        var multi = opts.length > 1;
        var sets = "";
        for (var k = 1; k <= ex.s; k++) { sets += setRow(dayId, sess, ex, k); }
        return '<article class="lift" data-rest="' + ex.t + '">' +
            '<div class="lift-head"><div class="swap' + (multi ? "" : " single") + '">' +
            '<select class="swap-dropdown" id="' + base + '-sub" data-link-target="' + base + '-link" onchange="saveData(this)"' + (multi ? ' aria-label="Exercise (swap for a substitution)"' : ' tabindex="-1" aria-label="Exercise"') + '>' +
            opts.map(function (o) {
                return '<option value="' + esc(o.n) + '" data-url="' + esc(o.u || searchUrl(o.n)) + '">' + esc(o.n) + '</option>';
            }).join("") + '</select></div></div>' +
            '<div class="lift-meta">' + (ex.t > 0 ? '<span class="chip">' + esc(restLabel(ex.t)) + '</span>' : "") + '<span class="chip last" hidden></span>' +
            '<a href="#" target="_blank" rel="noopener" class="yt-btn" id="' + base + '-link"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>Form</a></div>' +
            '<div class="sets" role="group" aria-label="Sets">' +
            '<div class="set head" aria-hidden="true"><span>Set</span><span>Target</span><span>Weight</span><span>RPE</span><span></span></div>' +
            sets + '</div></article>';
    }

    function initDay() {
        var prog = loadProgram();
        var id = param("d");
        var day = findDay(prog, id);
        var note = $("day-missing");
        if (!day) {
            note.innerHTML = 'That day couldn’t be found. It may have been deleted. <a href="custom.html">Back to your days</a>';
            note.hidden = false;
            document.querySelector("[data-day-title]").textContent = "Not found";
            return;
        }
        var sess = session(day.id);
        // Set before app.js runs: one page name per day and run, so "last time" hints only come from earlier runs.
        document.body.setAttribute("data-page", "custom-day.html?d=" + day.id + "&s=" + sess);
        document.body.setAttribute("data-resume", "custom-day.html?d=" + day.id);
        document.body.setAttribute("data-label", "Your program, " + day.name);
        document.title = day.name + BRAND;
        document.querySelector("[data-day-title]").textContent = day.name;
        $("edit-link").href = "custom-edit.html?d=" + day.id;

        if (!day.ex.length) {
            note.innerHTML = 'This day has no exercises yet. <a href="custom-edit.html?d=' + day.id + '">Add some</a>';
            note.hidden = false;
            return;
        }
        // A swap you picked earlier may have been removed since; fall back to the first option.
        day.ex.forEach(function (ex) {
            var key = setPrefix(day.id, sess) + ex.id + "-sub", saved = get(key);
            if (saved !== null && saved !== ex.n && !ex.subs.some(function (s) { return s.n === saved; })) { drop(key); }
        });
        $("lifts").innerHTML = day.ex.map(function (ex) { return liftHtml(day.id, sess, ex); }).join("");
        $("day-actions").hidden = false;

        var fin = $("finish-btn");
        fin.addEventListener("click", function () {
            var boxes = document.querySelectorAll(".work-checkbox"), done = 0;
            for (var i = 0; i < boxes.length; i++) { if (boxes[i].checked) { done++; } }
            var total = boxes.length;
            if (done < total && !armed(fin, "Only " + done + " of " + total + " sets done. Tap to finish anyway")) { return; }
            var log = readJSON(K_LOG);
            log = (Array.isArray(log) ? log : []).slice(-199);
            log.push({ d: day.id, n: day.name, t: Date.now(), done: done, total: total, sess: sess });
            writeJSON(K_LOG, log);
            put("custom:sess:" + day.id, String(sess + 1));
            dropPrefix(setPrefix(day.id, sess));
            clearLastDay(day.id);
            location.href = "custom.html";
        });
    }

    if (VIEW === "home") { initHome(); }
    else if (VIEW === "edit") { initEdit(); }
    else if (VIEW === "day") { initDay(); }
})();
