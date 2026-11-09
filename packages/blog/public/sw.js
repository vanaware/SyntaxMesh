/// <reference lib="webworker" />

/**
 * =========================================================================
 * sw.js - mdBlog default Service Worker
 * =========================================================================
 *
 * This file shows how the Service Worker uses the packaged library
 * (./mdblog.js) to provide:
 *
 * 1. 📦 Static asset cache (offline PWA):
 *    Stores index.html, the BeerCSS stylesheet and the library bundle.
 *
 * 2. ⚡ Smart documentation interception:
 *    Picks up article requests (/articles/*.md) and turns the raw Markdown
 *    into a Wire Format AST right in the background.
 *
 * 3. 🛡️ Network-first resilience:
 *    Looks for updates on the network and falls back to the local cache when offline.
 */

import mdTranspiler from "./mdblog.min.js";

// The build stamp is part of the name on purpose. A worker is replaced by URL
// (see registerServiceWorker), and every replacement re-runs the install below;
// naming the cache after the build it was filled by means the superseded build's
// entries are deleted by the activate step instead of piling up, and the shell
// stops being whatever the first visit happened to cache.
const CACHE_NAME = `mdblog-pwa-${mdTranspiler.version || "dev"}`;

// A request that neither resolves nor fails — the signature of a worker whose
// caches were deleted underneath an open tab — would otherwise spin the tab
// past the shell's own mount deadline, because the deadline script only runs
// once the navigation itself arrives. The network therefore has to answer
// within this window for the deadline to exist at all.
const NETWORK_DEADLINE_MS = 6000;

// List of assets essential to offline operation
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./mdblog.min.js",
  "./islands/Counter.js",
];

// In-memory and Service Worker cache I/O layer
const io = mdTranspiler.createBrowserIO({
  cacheName: "md-wire-v1",
  useIndexedDB: false,
},);

// Starts the article request interceptor using the packaged library
const handleDocFetch = mdTranspiler.createSWFetchHandler(io, {
  basePath: "./articles",
  cacheTTLSeconds: 60,
  bundlePath: "./mdblog.min.js",
},);

// Install: pre-loads the assets into the cache
self.addEventListener("install", (event,) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME,)
      .then((cache,) => cache.addAll(STATIC_ASSETS,))
      .then(() => self.skipWaiting()),
  );
},);

// Activation: clears outdated cache versions
self.addEventListener("activate", (event,) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys,) =>
        Promise.all(
          keys.map((key,) => {
            if (key !== CACHE_NAME && !key.startsWith("md-wire-",)) {
              return caches.delete(key,);
            }
          },),
        )
      )
      .then(() => self.clients.claim()),
  );
},);

// Request interception
self.addEventListener("fetch", (event,) => {
  if (event.request.method !== "GET") return;

  // 1. Try to intercept the article route with the mdBlog library
  if (handleDocFetch(event,)) {
    return;
  }

  // 2. Network-first with cache fallback for static assets and navigation
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await Promise.race([
          fetch(event.request,),
          new Promise((resolve,) =>
            setTimeout(() => resolve(null,), NETWORK_DEADLINE_MS,)
          ),
        ],);
        if (!networkResponse) throw new Error("network deadline passed",);
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME,);
          cache.put(event.request, networkResponse.clone(),).catch(() => {},);
        }
        return networkResponse;
      } catch (_err) {
        // Offline fallback from the local cache
        const cached = await caches.match(event.request,);
        if (cached) return cached;

        // For browser navigations, serve the index.html stored in the cache
        if (event.request.mode === "navigate") {
          const fallback = (await caches.match("./index.html",)) ||
            (await caches.match("./",));
          if (fallback) return fallback;
        }

        return new Response("Offline", { status: 503, },);
      }
    })(),
  );
},);
