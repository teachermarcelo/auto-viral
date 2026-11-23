(() => {
  if (window.top !== window || window.__autoViralTaskPanelLoaded) return;
  window.__autoViralTaskPanelLoaded = true;
  const ROOT_ID = "autoviral-queue-task-panel";
  const normalize = value => { try { const u=new URL(value); const host=u.hostname.startsWith("www.")?u.hostname.slice(4):u.hostname; const path=u.pathname.endsWith("/")?u.pathname.slice(0,-1):u.pathname; return host+path; } catch { return ""; } };
  async function render() {
    const { activeTask } = await chrome.storage.local.get("activeTask");
    const current = normalize(location.href);
    if (!activeTask || normalize(activeTask.url) !== current) { document.getElementById(ROOT_ID)?.remove(); return; }
    if (document.getElementById(ROOT_ID)) return;
    const host=document.createElement("div"); host.id=ROOT_ID;
    const shadow=host.attachShadow({mode:"closed"});
    const style=document.createElement("style");
    style.textContent=`
      :host{all:initial;position:fixed;z-index:2147483647;right:18px;bottom:18px;font-family:Arial,sans-serif;color:#f7f5ff}
      .panel{width:310px;max-width:calc(100vw - 40px);background:#171626;border:1px solid #7657e8;border-radius:14px;box-shadow:0 12px 40px #0009;padding:14px}
      .eyebrow{font:800 10px Arial;letter-spacing:1px;color:#b9a5ff;margin-bottom:8px}
      .title{font:700 14px/1.35 Arial;color:#fff;margin-bottom:7px}
      .copy{font:12px/1.5 Arial;color:#d4d1e3;max-height:90px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;margin-bottom:9px}.media{display:block;width:100%;max-height:150px;object-fit:contain;border-radius:8px;margin:8px 0}.track{display:block;color:#b9a5ff;font:11px/1.4 Arial;overflow-wrap:anywhere;margin:7px 0}
      .note{font:11px/1.45 Arial;color:#aaa6c0;margin-top:8px}
      button{width:100%;border:0;border-radius:8px;padding:10px;margin-top:7px;background:#7958ee;color:#fff;font:700 12px Arial;cursor:pointer}
      button.alt{background:#2b293e;border:1px solid #45415e}
      .status{font:11px Arial;color:#8ce0b2;margin-top:8px;min-height:13px}
    `;
    const panel=document.createElement("section");panel.className="panel";
    const eyebrow=document.createElement("div");eyebrow.className="eyebrow";eyebrow.textContent="AUTOVIRAL AI · TAREFA DA FILA";
    const title=document.createElement("div");title.className="title";title.textContent=activeTask.title||"Campanha";
    const copy=document.createElement("div");copy.className="copy";copy.textContent=activeTask.copy||"";
    const media=activeTask.mediaUrl?document.createElement("img"):null;if(media){media.className="media";media.src=activeTask.mediaUrl;media.alt="Imagem da campanha";media.referrerPolicy="no-referrer";}
    const tracking=activeTask.trackingUrl?document.createElement("a"):null;if(tracking){tracking.className="track";tracking.href=activeTask.trackingUrl;tracking.target="_blank";tracking.rel="noopener noreferrer";tracking.textContent="Abrir link rastreável da campanha";}
    const copyButton=document.createElement("button");copyButton.textContent="Copiar texto + link rastreável";
    const reviewedButton=document.createElement("button");reviewedButton.className="alt";reviewedButton.textContent="Marcar revisão feita";
    const note=document.createElement("div");note.className="note";note.textContent="Revise as regras do grupo. A solicitação de entrada e a publicação devem ser feitas manualmente, com autorização.";
    const status=document.createElement("div");status.className="status";
    copyButton.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(activeTask.copy||"");status.textContent="Texto copiado. Revise antes de publicar.";}catch{status.textContent="Não foi possível copiar. Selecione o texto manualmente."; }});
    reviewedButton.addEventListener("click",async()=>{await chrome.storage.local.set({activeTask:{...activeTask,state:"reviewed",reviewed_at:new Date().toISOString()}});status.textContent="Revisão registrada neste navegador.";});
    panel.append(eyebrow,title,copy);if(media)panel.append(media);if(tracking)panel.append(tracking);panel.append(copyButton,reviewedButton,note,status);shadow.append(style,panel);document.documentElement.append(host);
  }
  void render();
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&changes.activeTask){document.getElementById(ROOT_ID)?.remove();void render();}});
})();
