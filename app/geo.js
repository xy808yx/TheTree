// Offline place -> coordinates. Lazy-loads the vendored gazetteer (only when a
// lookup is first needed — keeps the app shell small) and resolves typed place
// text like "Taishan, China" or "Hamilton, Ontario" to lat/lng with no network.

let INDEX = null;        // normalized city name -> [{admin, country, lat, lng, display}, ...] (pop order)
let loadingIndex = null;

function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

async function ensureIndex() {
  if (INDEX) return INDEX;
  if (!loadingIndex) {
    loadingIndex = (async () => {
      const { CITIES, ADMINS, COUNTRIES } = await import('./vendor/cities.js');
      const idx = new Map();
      for (const c of CITIES) {
        const key = norm(c[0]);
        let arr = idx.get(key);
        if (!arr) idx.set(key, (arr = []));
        arr.push({ admin: ADMINS[c[1]] || '', country: COUNTRIES[c[2]] || '', lat: c[3], lng: c[4], display: c[5] || c[0] });
      }
      INDEX = idx;
      return idx;
    })();
  }
  return loadingIndex;
}

// Resolve "City", "City, Country", or "City, Region, Country" to a best match.
// Returns { lat, lng, admin, country, label } or null. When trailing tokens name
// a country/region, the matching candidate wins; otherwise the most-populous one.
export async function lookupPlace(text) {
  const raw = String(text == null ? '' : text).trim();
  if (!raw) return null;
  const idx = await ensureIndex();
  const parts = raw.split(',').map(norm).filter(Boolean);
  if (!parts.length) return null;
  const candidates = idx.get(parts[0]);
  if (!candidates || !candidates.length) return null;

  const hints = parts.slice(1);
  let best = null;
  if (hints.length) {
    best = candidates.find((c) => hints.some((h) => norm(c.country) === h || norm(c.admin) === h))
      || candidates.find((c) => hints.some((h) => { const co = norm(c.country), ad = norm(c.admin); return co.includes(h) || ad.includes(h) || h.includes(co); }));
  }
  best = best || candidates[0];
  return { lat: best.lat, lng: best.lng, admin: best.admin, country: best.country, label: best.display };
}

// Accept hand-entered coordinates: "6.45, 3.39", "6.45 3.39", "-24.6; 25.9".
export function parseLatLng(text) {
  const m = String(text == null ? '' : text).match(/(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}
