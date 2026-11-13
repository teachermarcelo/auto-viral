(() => {
  if (window.__autoViralMapperLoaded) return;
  window.__autoViralMapperLoaded = true;
  const KEY = "autoViralDiscoveredGroups";
  const META = "autoViralMapperMeta";
  let timer = null, busy = false, paused = false;

  const clean = value => String(value || "").replace(/\\s+/g, " ").trim();
  function normalize(value) {
    try {
      const u = new URL(value, location.href);
      if (!/(^|\\.)facebook\\.com$/i.test(u.hostname)) return null;
      const match = u.pathname.match(/^\\/groups\\/([^/?#]+)/i);
      if (!match || ["feed", "create", "discover", "joins", "your_groups"].includes(match[1].toLowerCase())) return null;
      return "https://www.facebook.com/groups/" + match[1] + "/";
    } catch { return null; }
  }
  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden";
  }
  function findCard(link) {
    let node = link;
    for (let i = 0; node && i < 8 && node !== document.body; i++, node = node.parentElement) {
      const text = clean(node.innerText);
      if ((node.matches?.('[role="article"],article,[role="listitem"]') || text.length > 35) && text.length < 5000) return node;
    }
    return link.parentElement || link;
  }
  function bestName(link, card, url) {
    const linkText = clean(link.innerText || link.getAttribute("aria-label"));
    const lines = (card.innerText || "").split(/\\n+/).map(clean).filter(Boolean);
    const reject = /^(join|entrar|participar|solicitar para participar|ver mais|see more|public group|grupo público|private group|grupo privado|facebook)$/i;
    const candidate = [linkText, ...lines].find(x => x.length >= 4 && x.length <= 180 && !reject.test(x) && !/^https?:/i.test(x));
    return candidate || decodeURIComponent(url.split("/groups/")[1].replace(/\\/$/, "")).replace(/[-_]/g, " ").slice(0,180) || "Grupo do Facebook";
  }
  async function scan() {
    if (busy || paused) return;
    busy = true;
    try {
      const links = [...document.querySelectorAll('a[href], [role="link"][href]')].filter(visible);
      const found = new Map();
      for (const link of links) {
        const url = normalize(link.href || link.getAttribute("href"));
        if (!url || found.has(url)) continue;
        const card = findCard(link);
        const text = clean(card.innerText || "");
        const name = bestName(link, card, url);
        const query = new URL(location.href).searchParams.get("q") || new URL(location.href).searchParams.get("query") || "";
        const hints = [];
        if (/\\b(private|privado|privada)\\b/i.test(text)) hints.push("Privacidade indicada na página: privado");
        if (/\\b(public|público|publico)\\b/i.test(text)) hints.push("Privacidade indicada na página: público");
        if (/\\b(admin approval|aprovação do administrador|aprovação para participar)\\b/i.test(text)) hints.push("Possível aprovação de administrador");
        found.set(url, {
          url, name, topic: query ? query.slice(0,120) : "Facebook",
          notes: [hints.join("; "), text].filter(Boolean).join(" | ").slice(0,1600),
          source_url: location.href, search_query: query.slice(0,180),
          captured_at: new Date().toISOString()
        });
      }
      const state = await chrome.storage.local.get({[KEY]:[],[META]:{}});
      const rows = Array.isArray(state[KEY]) ? state[KEY] : [];
      const map = new Map(rows.map(row => [row.url, row]));
      let added = 0, updated = 0;
      for (const [url, row] of found) {
        if (!map.has(url)) { map.set(url,row); added++; }
        else {
          const old=map.get(url);
          if ((!old.name || old.name==="Grupo do Facebook") && row.name) { map.set(url,{...old,...row}); updated++; }
        }
      }
      await chrome.storage.local.set({
        [KEY]:Array.from(map.values()).slice(-2000),
        [META]:{lastScanAt:new Date().toISOString(),pageUrl:location.href,total:map.size,lastAdded:added,lastUpdated:updated,matchingLinks:found.size,inspectedLinks:links.length,paused:false,searchQuery:new URL(location.href).searchParams.get("q")||""}
      });
    } catch(error) {
      console.warn("[AutoViral Mapper]",error);
      await chrome.storage.local.set({[META]:{lastScanAt:new Date().toISOString(),pageUrl:location.href,error:String(error?.message||error)}});
    } finally { busy=false; }
  }
  function schedule(){if(timer)return;timer=setTimeout(()=>{timer=null;void scan();},900);}
  chrome.storage.onChanged.addListener((changes,area)=>{
    if(area==="local"&&changes.autoViralMapperPaused){paused=Boolean(changes.autoViralMapperPaused.newValue);if(!paused)schedule();}
  });
  chrome.storage.local.get({autoViralMapperPaused:false}).then(s=>{paused=Boolean(s.autoViralMapperPaused);if(!paused)schedule();});
  addEventListener("scroll",schedule,{passive:true});
  addEventListener("popstate",schedule);
  addEventListener("pageshow",schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>{if(!paused)schedule();},12000);
})();