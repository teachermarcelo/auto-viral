const GROUPS = "autoViralDiscoveredGroups";
const $ = selector => document.querySelector(selector);
const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
async function getState() {
  const [local, session] = await Promise.all([
    chrome.storage.local.get({[GROUPS]:[],autoViralSentUrls:[],autoViralMapperPaused:false,autoViralLastSync:null,autoViralMapperMeta:{}}),
    chrome.storage.session.get({autoViralAuthSession:null})
  ]);
  return {...local,...session};
}
function status(message, kind = "") {
  const node = $("#status");
  node.textContent = message;
  node.className = "status " + kind;
}
async function render() {
  const state = await getState();
  const groups = state[GROUPS] || [];
  const sent = new Set(state.autoViralSentUrls || []);
  const pending = groups.filter(group => !sent.has(group.url));
  const session = state.autoViralAuthSession;
  const meta = state.autoViralMapperMeta || {};
  $("#total").textContent = groups.length;
  $("#pending").textContent = pending.length;
  $("#sent").textContent = groups.length - pending.length;
  $("#visible-count").textContent = groups.length;
  $("#live").classList.toggle("paused", !!state.autoViralMapperPaused);
  $("#live").innerHTML = state.autoViralMapperPaused ? "<i></i> PAUSADO" : "<i></i> ATIVO";
  $("#pause").textContent = state.autoViralMapperPaused ? "Retomar mapeamento" : "Pausar mapeamento";
  $("#connection").textContent = session ? "Sessão reconhecida" : "Aguardando login no site";
  $("#connection").className = "pill " + (session ? "on" : "off");
  $("#account").textContent = session?.user?.email || "Sessão do AutoViral conectada";
  $("#send").disabled = !session || pending.length === 0;
  $("#send").textContent = !session ? "Conecte sua conta para sincronizar" : pending.length ? "Enviar " + pending.length + " grupo(s) para a plataforma" : "Todos os grupos já foram enviados";
  $("#scan-info").textContent = meta.lastScanAt ? "Última leitura: " + new Date(meta.lastScanAt).toLocaleString("pt-BR") + " · " + (meta.lastAdded || 0) + " novo(s) · " + (meta.matchingLinks || 0) + " link(s) de grupo na página" : "Aguardando primeira leitura do Facebook.";
  $("#login-box").classList.toggle("hidden", !!session);
  $("#connected-box").classList.toggle("hidden", !session);
  const last = state.autoViralLastSync;
  if (last) {
    const message = last.status === "success"
      ? last.count + " grupo(s) sincronizado(s) nesta execução."
      : last.message || (last.status === "session" ? "Sessão reconhecida. A sincronização ocorrerá automaticamente." : "Aguardando sincronização.");
    status(message, last.status === "success" ? "success" : last.status === "error" ? "error" : "");
  } else status("Entre no AutoViral em outra aba para autorizar a sincronização.");
  $("#items").innerHTML = groups.length
    ? groups.slice(-20).reverse().map(group => '<article class="group"><div class="group-icon">f</div><div class="group-info"><b>' + safe(group.name) + '</b><small>' + safe(group.url) + '</small></div><span class="tag ' + (sent.has(group.url) ? "done" : "new") + '">' + (sent.has(group.url) ? "ENVIADO" : "NOVO") + '</span></article>').join("")
    : '<p class="empty">Abra uma busca de grupos públicos no Facebook e role a página.</p>';
}
$("#pause").addEventListener("click", async () => {
  const state = await getState();
  await chrome.storage.local.set({autoViralMapperPaused: !state.autoViralMapperPaused});
  await render();
});
$("#scan").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({target:{tabId:tab.id},func:() => window.dispatchEvent(new Event("scroll"))});
    status("Leitura solicitada. Role os resultados para carregar mais grupos.");
  } catch { status("Abra uma página do Facebook com resultados de grupos.", "error"); }
});
$("#connect").addEventListener("click", async () => {
  await chrome.tabs.create({url:"https://teachermarcelo.github.io/auto-viral/"});
  status("Entre na plataforma. A extensão reconhecerá a sessão automaticamente.");
});
$("#send").addEventListener("click", async () => {
  $("#send").disabled = true;
  status("Enviando grupos mapeados para Grupos e oportunidades…");
  try {
    const result = await chrome.runtime.sendMessage({type:"AUTOVIRAL_SYNC_NOW"});
    if (!result?.ok) status(result?.error || "Falha ao sincronizar.", "error");
    else status(result.last?.status === "success" ? (result.last.count || 0) + " grupo(s) enviados ou já atualizados na plataforma." : result.last?.message || "Sincronização concluída.", result.last?.status === "success" ? "success" : "");
  } catch (error) { status(String(error?.message || error), "error"); }
  await render();
});
$("#disconnect").addEventListener("click", async () => {
  await chrome.storage.session.remove("autoViralAuthSession");
  await render();
});
$("#export").addEventListener("click", async () => {
  const state = await getState();
  const blob = new Blob([JSON.stringify(state[GROUPS] || [], null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "autoviral-grupos-mapeados.json"; anchor.click();
  URL.revokeObjectURL(url);
});
$("#clear").addEventListener("click", async () => {
  if (!confirm("Limpar a fila local? Os grupos já enviados continuam na plataforma.")) return;
  await chrome.storage.local.set({[GROUPS]:[],autoViralSentUrls:[]});
  await render();
});
(async () => {
  await render();
  chrome.storage.onChanged.addListener((changes, area) => { if (area === "local" || area === "session") void render(); });
})();
