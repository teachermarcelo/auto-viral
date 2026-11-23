(() => {
  if (window.__autoViralFirebaseBridgeLoaded) return;
  window.__autoViralFirebaseBridgeLoaded = true;
  const appOrigin = "https://teachermarcelo.github.io";
  window.addEventListener("message", async event => {
    if (event.source !== window || event.origin !== appOrigin || location.origin !== appOrigin) return;
    const data = event.data;
    if (!data || data.source !== "AUTOVIRAL_WEB") return;
    if (data.type === "FIREBASE_AUTH_TOKEN") {
      try {
        const result = await chrome.runtime.sendMessage({type:"AUTOVIRAL_FIREBASE_TOKEN",token:data.token});
        if (!result?.ok) console.warn("[AutoViral] Firebase bridge:",result?.error||"Falha ao compartilhar token.");
      } catch(error) { console.warn("[AutoViral] Extensão indisponível:",error); }
    }
    if (data.type === "FIREBASE_SIGNOUT") {
      try { await chrome.runtime.sendMessage({type:"AUTOVIRAL_FIREBASE_SIGNOUT"}); } catch {}
    }
    if (data.type === "OPEN_GROUP_TASK" && typeof data.requestId === "string") {
      try {
        const result = await chrome.runtime.sendMessage({type:"AUTOVIRAL_OPEN_GROUP_TASK",task:data.task});
        window.postMessage({source:"AUTOVIRAL_EXTENSION",type:"TASK_RESULT",requestId:data.requestId,...(result||{ok:false,error:"Extensão sem resposta."})},appOrigin);
      } catch(error) { window.postMessage({source:"AUTOVIRAL_EXTENSION",type:"TASK_RESULT",requestId:data.requestId,ok:false,error:String(error?.message||"Extensão indisponível.")},appOrigin); }
    }
  });
})();