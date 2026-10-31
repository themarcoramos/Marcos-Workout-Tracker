/* Marco's Workout Plans: shared behaviour for every page.
   Everything you log is saved in this browser (localStorage), keyed by each field's id. */
(function () {
    "use strict";

    // ---------- storage (never throws, e.g. private mode) ----------
    var store = {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
    };
    function readJSON(k) { try { return JSON.parse(store.get(k)); } catch (e) { return null; } }

    var PAGE = (document.body && document.body.dataset.page) || location.pathname.split("/").pop();

    // ---------- RPE helpers ----------
    var RPE_TEXT = {
        10: "Max effort, nothing left",
        9: "1 rep left in the tank",
        8: "2 reps left",
        7: "3 reps left, bar still moves fast",
        6: "4 reps left",
        5: "5 or more reps left",
        4: "Easy, warm-up pace",
        3: "Very easy",
        2: "Barely working",
        1: "Almost no effort"
    };
    function hue(v) { return Math.max(0, Math.min(210, 210 - (v - 1) * (210 / 9))); }
    function parseGoal(s) {
        var m = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/.exec((s || "").trim());
        if (!m) { return null; }
        var lo = parseFloat(m[1]), hi = m[2] ? parseFloat(m[2]) : lo;
        return [lo, hi];
    }
    function renderRpe(el) {
        el.classList.remove("is-set", "is-invalid");
        el.removeAttribute("aria-invalid");
        if (el.value === "") { return; }
        var v = parseFloat(el.value);
        if (isNaN(v) || v < 1 || v > 10) {
            el.classList.add("is-invalid");
            el.setAttribute("aria-invalid", "true");
            return;
        }
        el.style.setProperty("--h", hue(v));
        el.classList.add("is-set");
    }

    // ---------- public hooks used by the page markup ----------
    window.updateLink = function (select) {
        var link = document.getElementById(select.getAttribute("data-link-target"));
        var opt = select.options[select.selectedIndex];
        var url = opt && opt.getAttribute("data-url");
        if (link && url) { link.href = url; }
    };

    window.saveData = function (el) {
        if (el.type === "checkbox") {
            store.set(el.id, el.checked);
            if (el.checked && el.classList.contains("work-checkbox")) { onSetDone(el); }
            var set = el.closest(".set");
            if (set && el.checked) { recordHistory(set); }
        } else {
            store.set(el.id, el.value);
            if (el.tagName === "SELECT") {
                window.updateLink(el);
                var lift = el.closest(".lift");
                if (lift) { renderLast(lift); refreshHints(lift); }
            } else {
                if (el.classList.contains("rpe-field")) { renderRpe(el); }
                var s = el.closest(".set");
                var box = s && s.querySelector("input[type=checkbox]");
                if (s && box && box.checked) { recordHistory(s); }
                var l = el.closest(".lift");
                if (l && el.classList.contains("weight-input")) { refreshHints(l); }
            }
        }
        updateProgress();
    };

    // ---------- history ("last time" per exercise) ----------
    function exerciseName(lift) {
        var sel = lift.querySelector("select.swap-dropdown");
        return sel ? sel.value : "";
    }
    function recordHistory(setEl) {
        if (!setEl.classList.contains("work")) { return; }
        var lift = setEl.closest(".lift");
        var w = setEl.querySelector(".weight-input");
        var r = setEl.querySelector(".rpe-field");
        if (!lift || !w || w.value === "") { return; }
        store.set("hist:" + exerciseName(lift), JSON.stringify({ w: w.value, r: r ? r.value : "", t: Date.now(), p: PAGE }));
    }
    function renderLast(lift) {
        var chip = lift.querySelector(".chip.last");
        if (!chip) { return; }
        var h = readJSON("hist:" + exerciseName(lift));
        if (h && h.p !== PAGE && h.w) {
            chip.textContent = "Last time: " + h.w + " lb" + (h.r ? " at RPE " + h.r : "");
            chip.hidden = false;
        } else {
            chip.hidden = true;
        }
    }
    function refreshHints(lift) {
        var h = readJSON("hist:" + exerciseName(lift));
        var carry = h && h.p !== PAGE && h.w ? h.w : "";
        lift.querySelectorAll(".set.work .weight-input").forEach(function (inp) {
            inp.placeholder = carry || "lbs";
            if (inp.value !== "") { carry = inp.value; }
        });
    }
    function onSetDone(box) {
        var set = box.closest(".set");
        var w = set && set.querySelector(".weight-input");
        if (w && w.value === "" && /^\d+(\.\d+)?$/.test(w.placeholder)) {
            w.value = w.placeholder;
            store.set(w.id, w.value);
        }
        var lift = box.closest(".lift");
        var secs = lift ? parseInt(lift.dataset.rest || "0", 10) : 0;
        if (secs > 0) { startRest(secs, "Rest"); }
    }

    // ---------- progress ----------
    function updateProgress() {
        var boxes = document.querySelectorAll(".work-checkbox");
        if (!boxes.length) { return; }
        var done = 0;
        boxes.forEach(function (b) { if (b.checked) { done++; } });
        var total = boxes.length;
        var text = document.querySelector("[data-progress-text]");
        if (text) { text.innerHTML = "<strong>" + done + "</strong> of " + total + " sets"; }
        var bar = document.querySelector("[data-progress-bar]");
        if (bar) { bar.style.width = (total ? (done / total) * 100 : 0) + "%"; }
        document.body.classList.toggle("is-complete-day", done === total);
        document.querySelectorAll(".lift").forEach(function (lift) {
            var bs = lift.querySelectorAll(".work-checkbox");
            var all = bs.length > 0;
            bs.forEach(function (b) { if (!b.checked) { all = false; } });
            lift.classList.toggle("is-complete", all);
        });
    }

    // ---------- rest timer ----------
    var timer = { end: 0, total: 0, id: null, el: null, hide: null };
    function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
    function ensureTimer() {
        if (timer.el) { return timer.el; }
        var el = document.createElement("div");
        el.className = "rest-timer";
        el.setAttribute("role", "timer");
        el.innerHTML =
            '<div><div class="rest-label" data-rest-label>Rest</div><div class="rest-time" data-rest-time aria-live="off">0:00</div></div>' +
            '<div class="rest-btns"><button type="button" data-rest="-15" aria-label="Subtract 15 seconds">-15s</button>' +
            '<button type="button" data-rest="15" aria-label="Add 15 seconds">+15s</button>' +
            '<button type="button" data-rest="skip">Skip</button></div>' +
            '<div class="rest-bar"><span></span></div>';
        el.addEventListener("click", function (e) {
            var b = e.target.closest("button[data-rest]");
            if (!b) { return; }
            var v = b.getAttribute("data-rest");
            if (v === "skip") { stopRest(); return; }
            timer.end += parseInt(v, 10) * 1000;
            timer.total = Math.max(timer.total, (timer.end - Date.now()) / 1000);
            tick();
        });
        document.body.appendChild(el);
        timer.el = el;
        return el;
    }
    function startRest(seconds, label) {
        var el = ensureTimer();
        clearTimeout(timer.hide);
        clearInterval(timer.id);
        timer.total = seconds;
        timer.end = Date.now() + seconds * 1000;
        el.classList.remove("is-over");
        el.querySelector("[data-rest-label]").textContent = label || "Rest";
        el.classList.add("is-on");
        tick();
        timer.id = setInterval(tick, 250);
    }
    function tick() {
        var left = (timer.end - Date.now()) / 1000;
        var el = timer.el;
        el.querySelector("[data-rest-time]").textContent = fmt(left);
        var frac = timer.total ? Math.max(0, Math.min(1, left / timer.total)) : 0;
        el.querySelector(".rest-bar span").style.transform = "scaleX(" + frac + ")";
        if (left <= 0) {
            clearInterval(timer.id);
            el.classList.add("is-over");
            el.querySelector("[data-rest-label]").textContent = "Next set";
            el.querySelector("[data-rest-time]").textContent = "Go";
            if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ } }
            timer.hide = setTimeout(stopRest, 10000);
        } else {
            el.classList.remove("is-over");
        }
    }
    function stopRest() {
        clearInterval(timer.id);
        clearTimeout(timer.hide);
        if (timer.el) { timer.el.classList.remove("is-on"); }
    }

    // ---------- RPE sheet ----------
    var sheet = null, sheetTarget = null;
    function buildSheet() {
        if (sheet) { return sheet; }
        var d = document.createElement("dialog");
        d.className = "sheet";
        d.id = "rpe-sheet";
        d.setAttribute("aria-labelledby", "rpe-title");
        var rows = "";
        for (var v = 10; v >= 1; v--) {
            rows += '<button type="button" class="rpe-row" data-v="' + v + '" style="--h:' + hue(v) + '" aria-pressed="false">' +
                '<span class="rpe-num">' + v + '</span><span class="rpe-text">' + RPE_TEXT[v] + '</span><span class="rpe-tag">Target</span></button>';
        }
        d.innerHTML =
            '<div class="sheet-inner"><div class="sheet-grab"></div>' +
            '<h2 id="rpe-title">How hard was that set?</h2>' +
            '<p class="sheet-sub" data-goal-text>RPE runs from 1 to 10.</p>' +
            '<label class="half"><input type="checkbox" data-half> Add a half point (8 becomes 8.5)</label>' +
            '<div class="ladder">' + rows + '</div>' +
            '<div class="sheet-actions"><button type="button" data-clear>Clear</button><button type="button" data-close>Close</button></div></div>';
        d.addEventListener("click", function (e) {
            if (e.target === d) { closeSheet(); return; }
            var row = e.target.closest(".rpe-row");
            if (row && sheetTarget) {
                var v = parseInt(row.getAttribute("data-v"), 10);
                if (d.querySelector("[data-half]").checked && v < 10) { v += 0.5; }
                sheetTarget.value = String(v);
                window.saveData(sheetTarget);
                closeSheet();
                return;
            }
            if (e.target.closest("[data-clear]") && sheetTarget) {
                sheetTarget.value = "";
                window.saveData(sheetTarget);
                closeSheet();
                return;
            }
            if (e.target.closest("[data-close]")) { closeSheet(); }
        });
        d.addEventListener("close", function () {
            if (sheetTarget) { sheetTarget.focus({ preventScroll: true }); }
            sheetTarget = null;
        });
        document.body.appendChild(d);
        sheet = d;
        return d;
    }
    function closeSheet() {
        if (!sheet) { return; }
        if (typeof sheet.close === "function") { sheet.close(); } else { sheet.removeAttribute("open"); }
    }
    function openRpe(input) {
        var d = buildSheet();
        sheetTarget = input;
        var cur = parseFloat(input.value);
        var valid = !isNaN(cur) && cur >= 1 && cur <= 10;
        d.querySelector("[data-half]").checked = valid && cur % 1 !== 0;
        var goal = parseGoal(input.getAttribute("data-goal"));
        var gt = d.querySelector("[data-goal-text]");
        gt.textContent = goal
            ? "Target for this set: RPE " + (goal[0] === goal[1] ? goal[0] : goal[0] + " to " + goal[1]) + "."
            : "RPE runs from 1 to 10. Check the exercise note for this set's target.";
        d.querySelectorAll(".rpe-row").forEach(function (row) {
            var v = parseInt(row.getAttribute("data-v"), 10);
            row.setAttribute("aria-pressed", valid && Math.floor(cur) === v ? "true" : "false");
            row.classList.toggle("in-target", !!goal && v >= Math.floor(goal[0]) && v <= Math.ceil(goal[1]));
        });
        if (typeof d.showModal === "function") { d.showModal(); } else { d.setAttribute("open", ""); }
    }

    // ---------- day page ----------
    function initDay() {
        var els = document.querySelectorAll(".lift select, .lift input[id]");
        els.forEach(function (el) {
            var saved = store.get(el.id);
            if (saved !== null) {
                if (el.type === "checkbox") { el.checked = saved === "true"; } else { el.value = saved; }
            }
            if (el.tagName === "SELECT") { window.updateLink(el); }
            if (el.classList && el.classList.contains("rpe-field")) {
                renderRpe(el);
                el.addEventListener("click", function () { openRpe(el); });
                el.addEventListener("keydown", function (e) {
                    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openRpe(el); }
                });
            }
        });
        document.querySelectorAll(".lift").forEach(function (lift) {
            renderLast(lift);
            refreshHints(lift);
        });
        document.querySelectorAll(".lift-note").forEach(function (note) {
            if (note.textContent.length > 110) {
                note.classList.add("is-long");
                var more = document.createElement("button");
                more.type = "button"; more.className = "note-more"; more.textContent = "More";
                more.setAttribute("aria-expanded", "false");
                more.addEventListener("click", function () {
                    var open = note.classList.toggle("is-open");
                    more.textContent = open ? "Less" : "More";
                    more.setAttribute("aria-expanded", String(open));
                });
                note.parentNode.insertBefore(more, note.nextSibling);
            }
        });
        document.querySelectorAll(".hold-btn").forEach(function (b) {
            b.addEventListener("click", function () { startRest(parseInt(b.getAttribute("data-hold"), 10) || 30, "Hold"); });
        });
        updateProgress();
        store.set("lastDay", JSON.stringify({ href: PAGE, label: document.body.dataset.label || "", t: Date.now() }));
    }

    // ---------- menu pages: progress on tiles ----------
    function daysDone(day) {
        var done = 0;
        for (var i = 0; i < day.ids.length; i++) { if (store.get(day.ids[i]) === "true") { done++; } }
        return { done: done, total: day.ids.length };
    }
    function weekStats(week) {
        var s = { done: 0, total: 0, daysDone: 0, days: week.days.length };
        week.days.forEach(function (d) {
            var r = daysDone(d);
            s.done += r.done; s.total += r.total;
            if (r.total && r.done === r.total) { s.daysDone++; }
        });
        return s;
    }
    function setTile(tile, done, total, sub) {
        var sp = tile.querySelector(".tile-sub[data-sub]");
        if (sp) { sp.textContent = sub; }
        var bar = tile.querySelector(".tile-bar span");
        if (bar) { bar.style.width = (total ? (done / total) * 100 : 0) + "%"; }
        tile.classList.toggle("is-done", total > 0 && done === total);
    }
    function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }
    function initMenu() {
        var P = window.PROGRAM;
        if (!P) { return; }
        var byFile = {}, byWeek = {}, byPhase = {};
        P.phases.forEach(function (ph) {
            byPhase[ph.n] = ph;
            ph.weeks.forEach(function (w) {
                byWeek[w.id] = w;
                w.days.forEach(function (d) { byFile[d.file] = d; });
            });
        });
        document.querySelectorAll(".tile[data-scope]").forEach(function (tile) {
            var scope = tile.getAttribute("data-scope");
            if (scope === "day") {
                var r = daysDone(byFile[tile.getAttribute("data-file")]);
                var sub = r.done === 0 ? plural(r.total, "set") : r.done === r.total ? "Complete" : r.done + " of " + plural(r.total, "set");
                setTile(tile, r.done, r.total, sub);
            } else if (scope === "week") {
                var s = weekStats(byWeek[tile.getAttribute("data-ref")]);
                setTile(tile, s.done, s.total, s.daysDone === s.days ? "Complete" : s.daysDone + " of " + s.days + " days done");
            } else if (scope === "phase") {
                var ph = byPhase[tile.getAttribute("data-ref")], wd = 0;
                var sets = 0, setsDone = 0;
                ph.weeks.forEach(function (w) {
                    var st = weekStats(w); sets += st.total; setsDone += st.done;
                    if (st.total && st.done === st.total) { wd++; }
                });
                setTile(tile, setsDone, sets, wd === ph.weeks.length ? "Complete" : wd + " of " + ph.weeks.length + " weeks done");
            } else if (scope === "program") {
                var wk = 0, nw = 0, st2 = 0, dn2 = 0;
                P.phases.forEach(function (p) { p.weeks.forEach(function (w) {
                    var st = weekStats(w); nw++; st2 += st.total; dn2 += st.done;
                    if (st.total && st.done === st.total) { wk++; }
                }); });
                setTile(tile, dn2, st2, wk === nw ? "Complete" : wk + " of " + nw + " weeks done");
            }
        });
        var resume = document.getElementById("resume");
        if (resume) {
            var last = readJSON("lastDay");
            if (last && last.href && byFile[last.href]) {
                resume.href = last.href;
                var lab = resume.querySelector("[data-resume-label]");
                if (lab) { lab.textContent = last.label; }
                resume.hidden = false;
            }
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        if (document.querySelector(".lift")) { initDay(); } else { initMenu(); }
    });

    // ---------- installable app: offline support ----------
    // Pages all live in one folder, so "sw.js" resolves next to them wherever the site is hosted.
    if ("serviceWorker" in navigator && window.isSecureContext) {
        window.addEventListener("load", function () {
            navigator.serviceWorker.register("sw.js").catch(function () { /* offline support is optional */ });
        });
    }
    // When opened from the home screen, ask the browser not to clear saved workouts to free space.
    var installed = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    if (installed && navigator.storage && navigator.storage.persist) {
        try { navigator.storage.persist(); } catch (e) { /* ignore */ }
    }
})();
