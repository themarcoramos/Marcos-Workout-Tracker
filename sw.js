/* Service worker: lets the app open and work with no connection.
   - Every page of the program is cached on install, so all 13 weeks work offline.
   - Pages are served from the cache first and refreshed in the background, so changes you
     publish show up the next time the app is opened (no need to bump a version for content).
   - Google Fonts are cached the first time they load. YouTube videos still need a connection.
   Bump CACHE_VERSION only if you change this file's strategy or want to force a full reset.
   Workout data is stored in localStorage, which this file never touches. */
var CACHE_VERSION = "v1";
var PAGES = "workouts-" + CACHE_VERSION;
var FONTS = "workouts-fonts-" + CACHE_VERSION;

var PRECACHE = [
    "./",
    "index.html",
    "day1-legs.html",
    "day2-push.html",
    "day3-pull.html",
    "day4-fullbody.html",
    "phase1.html",
    "phase2-day1-legs.html",
    "phase2-day2-push.html",
    "phase2-day3-pull.html",
    "phase2-day4-fullbody.html",
    "phase2-week1.html",
    "phase2-week2-day1-legs.html",
    "phase2-week2-day2-push.html",
    "phase2-week2-day3-pull.html",
    "phase2-week2-day4-fullbody.html",
    "phase2-week2.html",
    "phase2-week3-day1-legs.html",
    "phase2-week3-day2-push.html",
    "phase2-week3-day3-pull.html",
    "phase2-week3-day4-fullbody.html",
    "phase2-week3.html",
    "phase2-week4-day1-legs.html",
    "phase2-week4-day2-push.html",
    "phase2-week4-day3-pull.html",
    "phase2-week4-day4-fullbody.html",
    "phase2-week4.html",
    "phase2.html",
    "phase3-day1-legs.html",
    "phase3-day2-push.html",
    "phase3-day3-pull.html",
    "phase3-day4-fullbody.html",
    "phase3-week1.html",
    "phase3-week2-day1-legs.html",
    "phase3-week2-day2-push.html",
    "phase3-week2-day3-pull.html",
    "phase3-week2-day4-fullbody.html",
    "phase3-week2.html",
    "phase3-week3-day1-legs.html",
    "phase3-week3-day2-push.html",
    "phase3-week3-day3-pull.html",
    "phase3-week3-day4-fullbody.html",
    "phase3-week3.html",
    "phase3.html",
    "ultimate-ppl.html",
    "week1.html",
    "week2-day1-legs.html",
    "week2-day2-push.html",
    "week2-day3-pull.html",
    "week2-day4-fullbody.html",
    "week2.html",
    "week3-day1-legs.html",
    "week3-day2-push.html",
    "week3-day3-pull.html",
    "week3-day4-fullbody.html",
    "week3.html",
    "week4-day1-legs.html",
    "week4-day2-push.html",
    "week4-day3-pull.html",
    "week4-day4-fullbody.html",
    "week4.html",
    "week5-day1-legs.html",
    "week5-day2-push.html",
    "week5-day3-pull.html",
    "week5-day4-fullbody.html",
    "week5.html",
    "week6-day1-legs.html",
    "week6-day2-push.html",
    "week6-day3-pull.html",
    "week6-day4-fullbody.html",
    "week6.html",
    "app.css",
    "app.js",
    "program.js",
    "manifest.webmanifest",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png",
    "icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(PAGES).then(function (cache) {
            // Fetch each file fresh; one missing file shouldn't block the whole install.
            return Promise.all(PRECACHE.map(function (url) {
                return fetch(new Request(url, { cache: "reload" })).then(function (res) {
                    if (res.ok) { return cache.put(url, res); }
                }).catch(function () { /* skip, it will be cached on first visit instead */ });
            }));
        }).then(function () { return self.skipWaiting(); })
    );
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(keys.filter(function (k) {
                return k !== PAGES && k !== FONTS;
            }).map(function (k) { return caches.delete(k); }));
        }).then(function () { return self.clients.claim(); })
    );
});

function staleWhileRevalidate(request, cacheName, matchOptions) {
    return caches.open(cacheName).then(function (cache) {
        return cache.match(request, matchOptions).then(function (cached) {
            var network = fetch(request).then(function (res) {
                if (res && (res.ok || res.type === "opaque")) { cache.put(request, res.clone()); }
                return res;
            });
            if (cached) {
                network.catch(function () { /* offline: the cached copy is what we show */ });
                return cached;
            }
            return network;
        });
    });
}

self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (request.method !== "GET") { return; }
    var url = new URL(request.url);

    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
        event.respondWith(staleWhileRevalidate(request, FONTS));
        return;
    }

    if (url.origin !== self.location.origin) { return; } // YouTube and everything else: leave alone

    var isPage = request.mode === "navigate";
    event.respondWith(
        staleWhileRevalidate(request, PAGES, { ignoreSearch: true }).catch(function () {
            if (isPage) { return caches.match("index.html"); }
            return Response.error();
        })
    );
});
