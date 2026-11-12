(() => {
  if (window.__autoViralMapperLoaded) return;
  window.__autoViralMapperLoaded = true;
  const KEY="autoViralDiscoveredGroups", META="autoViralMapperMeta";
  let timer=null,busy=false,paused=false;
  const normalize=value=>{try{const u=new URL(value,location.href);if(!/(^|\\.)facebook\\.com$/i.test(u.hostname))return null;const m=u.pathname.match(/^\\/groups\\/([^/?#]+)/i);if(!m||["feed","create","discover","joins","your_groups"].includes(m[1].toLowerCase()))return null;return `https://www.facebook.com/groups/${m[1]}/`;}catch{return null;}};
  const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden";};
  async function scan(){if(busy||paused)return;busy=true;try{const found=[],seen=new Set();for(const a of document.querySelectorAll('a[href*="/groups/"]')){if(!visible(a))continue;const url=normalize(a.href);if(!url||seen.has(url))continue;seen.add(url);const card=a.closest('[role="article"],article,[role="listitem"]')||a.parentElement;found.push({url,name:(a.innerText||a.getAttribute("aria-label")||card?.innerText||"Grupo do Facebook").trim().replace(/\\s+/g," ").slice(0,180),topic:"Facebook",notes:(card?.innerText||"").trim().replace(/\\s+/g," ").slice(0,700),source_url:location.href,captured_at:new Date().toISOString()});}
  const state=await chrome.storage.local.get({[KEY]:[]}),rows=Array.isArray(state[KEY])?state[KEY]:[],map=new Map(rows.map(x=>[x.url,x]));let added=0;for(const row of found)if(!map.has(row.url)){map.set(row.url,row);added++;}
  await chrome.storage.local.set({[KEY]:Array.from(map.values()).slice(-1500),[META]:{lastScanAt:new Date().toISOString(),pageUrl:location.href,total:map.size,lastAdded:added,paused:false}});
  }catch(e){console.warn("[AutoViral Mapper]",e);}finally{busy=false;}}
  function schedule(){if(timer)clearTimeout(timer);timer=setTimeout(scan,650);}
  chrome.storage.onChanged.addListener((c,a)=>{if(a==="local"&&c.autoViralMapperPaused){paused=Boolean(c.autoViralMapperPaused.newValue);if(!paused)schedule();}});
  chrome.storage.local.get({autoViralMapperPaused:false}).then(s=>{paused=Boolean(s.autoViralMapperPaused);if(!paused)schedule();});
  addEventListener("scroll",schedule,{passive:true});addEventListener("popstate",schedule);addEventListener("pageshow",schedule);
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(()=>{if(!paused)schedule();},12000);
})();