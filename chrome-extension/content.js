(() => {
  if (window.__autoViralMapperLoaded) return;
  window.__autoViralMapperLoaded = true;
  const KEY = "autoViralDiscoveredGroups";
  const META = "autoViralMapperMeta";
  let timer = null, busy = false, paused = false;

  function normalize(value) {
    try {
      const u = new URL(value, location.href);
      if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return null;
      const match = u.pathname.match(/^\/groups\/([^/?#]+)/i);
      if (!match || ["feed", "create", "discover", "joins", "your_groups"].includes(match[1].toLowerCase())) return null;
      return "https://www.facebook.com/groups/" + match[1] + "/";
    } catch { return null; }
  }

  function isVisible(el) {
    let node = el;
    while (node && node !== document.body) {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden") return true;
      node = node.parentElement;
    }
    return false;
  }

  async function scan() {
    if (busy || paused) return;
    busy = true;
    try {
      const candidates = new Set();
      document.querySelectorAll('a[href], [role="link"][href], [data-href], [data-url]').forEach(el => {
        if (!isVisible(el)) return;
        for (const value of [el.href, el.getAttribute("href"), el.getAttribute("data-href"), el.getAttribute("data-url")]) {
          if (value) candidates.add(value);
        }
      });

      const found = new Map();
      let matchingLinks = 0;
      for (const value of candidates) {
        const url = normalize(value);
        if (!url || found.has(url)) continue;
        matchingLinks++;
        const link = [...document.querySelectorAll('a[href], [role="link"][href]')].find(el => normalize(el.href || el.getAttribute("href")) === url);
        const card = link?.closest('[role="article"], article, [role="listitem"]') || link?.parentElement;
        const rawName = link?.innerText || link?.getAttribute("aria-label") || card?.innerText || "";
        const name = rawName.trim().replace(/\s+/g, " ").slice(0, 180) || "Grupo do Facebook";
        found.set(url, {
          url, name, topic: "Facebook",
          notes: (card?.innerText || "").trim().replace(/\s+/g, " ").slice(0, 700),
          source_url: location.href, captured_at: new Date().toISOString()
        });
      }

      const state = await chrome.storage.local.get({ [KEY]: [] });
      const rows = Array.isArray(state[KEY]) ? state[KEY] : [];
      const map = new Map(rows.map(row => [row.url, row]));
      let added = 0;
      for (const [url, row] of found) {
        if (!map.has(url)) { map.set(url, row); added++; }
      }
      await chrome.storage.local.set({
        [KEY]: Array.from(map.values()).slice(-1500),
        [META]: {
          lastScanAt: new Date().toISOString(), pageUrl: location.href,
          total: map.size, lastAdded: added, matchingLinks,
          inspectedLinks: candidates.size, paused: false
        }
      });
    } catch (error) {
      console.warn("[AutoViral Mapper]", error);
      await chrome.storage.local.set({ [META]: { lastScanAt: new Date().toISOString(), pageUrl: location.href, error: String(error?.message || error) } });
    } finally { busy = false; }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; void scan(); }, 700);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.autoViralMapperPaused) {
      paused = Boolean(changes.autoViralMapperPaused.newValue);
      if (!paused) schedule();
    }
  });
  chrome.storage.local.get({ autoViralMapperPaused: false }).then(state => {
    paused = Boolean(state.autoViralMapperPaused);
    if (!paused) schedule();
  });
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("popstate", schedule);
  addEventListener("pageshow", schedule);
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  setInterval(() => { if (!paused) schedule(); }, 10000);
})();