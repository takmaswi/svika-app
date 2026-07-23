// Svika map cache (M0). One job: make the map fast on a cheap Android on
// 3G and keep it rendering offline after the first visit. It touches map
// traffic only:
//
//   - self hosted map assets (glyphs, sprites, mock fixture): precached on
//     install, stale while revalidate afterwards
//   - PMTiles range requests: each viewed byte range is cached and served
//     stale while revalidate, so a repeat visit paints from disk and a
//     visited area keeps rendering in airplane mode
//   - MapTiler (fallback provider only): cache first, as before
//   - the shell a map screen stands on: visited page documents are network
//     first with a cache fallback (never stale while online), and Next's
//     immutable hashed /_next/static chunks are cached on use, so a map
//     screen seen once still renders in airplane mode
//
// The style JSON itself ships inside the app bundle (lib/map/style.ts), so
// there is nothing to precache for it. Supabase calls, API routes and every
// other request are left entirely to the network, matching the conductor
// PWA's rule that offline behaviour is explicit app logic, never a stale
// HTTP cache of the API.

const STATIC_CACHE = "svika-map-static-v2";
const TILE_CACHE = "svika-map-tiles-v2";
const PAGE_CACHE = "svika-map-pages-v2";
const KEEP = [STATIC_CACHE, TILE_CACHE, PAGE_CACHE];

// The corridor is a small bbox; caps are safety rails, not budgets.
const MAX_TILE_ENTRIES = 800;
const MAX_PAGE_ENTRIES = 30;

// Latin glyph ranges cover every label the Harare map draws day to day;
// other ranges cache at runtime if ever requested.
const PRECACHE = [
  // the marker and brand marks a map screen draws (broken images offline
  // otherwise; runtime caching alone is timing dependent for these)
  "/map/kombi-marker.svg",
  "/map/kombi-marker-active.svg",
  "/logo.svg",
  "/wordmark.svg",
  "/map/sprite/sprite.json",
  "/map/sprite/sprite.png",
  "/map/sprite/sprite@2x.json",
  "/map/sprite/sprite@2x.png",
  "/map/fonts/IBM Plex Mono SemiBold/0-255.pbf",
  "/map/fonts/IBM Plex Mono SemiBold/256-511.pbf",
  "/map/fonts/IBM Plex Sans Regular/0-255.pbf",
  "/map/fonts/IBM Plex Sans Regular/256-511.pbf",
].map((p) => encodeURI(p));

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // best effort: a missing asset must not block the worker install
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => (n.startsWith("svika-map") || n.startsWith("svika-maptiler")) && !KEEP.includes(n))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

async function trim(cache, max = MAX_TILE_ENTRIES) {
  const keys = await cache.keys();
  if (keys.length <= max) return;
  // simple FIFO: drop the oldest overflow so the cache stays bounded
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

// Page shells: the network always wins when it answers, so a shell is never
// stale while online; the cached copy exists purely so a visited map screen
// still opens in airplane mode.
function networkFirstPage(event, req) {
  return (async () => {
    const cache = await caches.open(PAGE_CACHE);
    try {
      const res = await fetch(req);
      // never cache a redirected document: browsers refuse to serve one
      // back to a navigation, and redirects mean auth flows anyway
      if (res && res.ok && res.status === 200 && !res.redirected) {
        cache
          .put(req, res.clone())
          .then(() => trim(cache, MAX_PAGE_ENTRIES))
          .catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })();
}

// Cache-first with network fallback and offline retry; the MapTiler path.
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.status === 200) {
    cache.put(req, res.clone()).then(() => trim(cache)).catch(() => {});
  }
  return res;
}

// Stale while revalidate for small static assets (glyphs, sprites).
function staleWhileRevalidate(event, req) {
  return (async () => {
    const cache = await caches.open(STATIC_CACHE);
    const hit = await cache.match(req);
    const refresh = fetch(req)
      .then((res) => {
        if (res && res.ok && res.status === 200) {
          return cache.put(req, res.clone());
        }
        return undefined;
      })
      .catch(() => {});
    if (hit) {
      event.waitUntil(refresh);
      return hit;
    }
    await refresh;
    const fresh = await cache.match(req);
    if (fresh) return fresh;
    return fetch(req);
  })();
}

// PMTiles range requests. Cache.put rejects 206 responses, so each byte
// range is stored as a synthetic 200 under a range-keyed URL and rebuilt as
// a 206 (headers preserved, Content-Range included) when served. Stale
// while revalidate: a cached range answers instantly and refreshes in the
// background, so regenerated tiles arrive on the next view.
function rangeKey(req, range) {
  const url = new URL(req.url);
  url.searchParams.set("sw-range", range);
  return new Request(url.toString());
}

async function storeRange(cache, key, res) {
  if (!res || (res.status !== 206 && res.status !== 200)) return;
  const body = await res.clone().arrayBuffer();
  await cache.put(key, new Response(body, { status: 200, headers: res.headers }));
  await trim(cache);
}

function serveRange(event, req) {
  const range = req.headers.get("range");
  if (!range) return fetch(req);
  return (async () => {
    const cache = await caches.open(TILE_CACHE);
    const key = rangeKey(req, range);
    const hit = await cache.match(key);
    const refresh = fetch(req.clone())
      .then((res) => storeRange(cache, key, res).then(() => res))
      .catch(() => null);
    if (hit) {
      event.waitUntil(refresh.then(() => {}));
      return new Response(await hit.arrayBuffer(), { status: 206, headers: hit.headers });
    }
    const res = await refresh;
    if (res) return res;
    // offline and never fetched: nothing to serve for this range
    return new Response(null, { status: 504 });
  })();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // MapTiler: fallback provider traffic only.
  if (url.hostname === "api.maptiler.com") {
    event.respondWith(
      (async () => {
        try {
          return await cacheFirst(req, TILE_CACHE);
        } catch (err) {
          const cache = await caches.open(TILE_CACHE);
          const fallback = await cache.match(req);
          if (fallback) return fallback;
          throw err;
        }
      })(),
    );
    return;
  }

  // Everything else this worker touches is same origin.
  if (url.origin !== self.location.origin) return;

  // A map screen's own document: network first, cache fallback offline.
  if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(event, req));
    return;
  }
  // Next's hashed immutable chunks and CSS: cache on use.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        try {
          return await cacheFirst(req, STATIC_CACHE);
        } catch (err) {
          const cache = await caches.open(STATIC_CACHE);
          const hit = await cache.match(req);
          if (hit) return hit;
          throw err;
        }
      })(),
    );
    return;
  }

  if (url.pathname.startsWith("/map/tiles/") && url.pathname.endsWith(".pmtiles")) {
    event.respondWith(serveRange(event, req));
    return;
  }
  if (
    url.pathname.startsWith("/map/") ||
    url.pathname === "/logo.svg" ||
    url.pathname === "/wordmark.svg"
  ) {
    event.respondWith(staleWhileRevalidate(event, req));
  }
});
