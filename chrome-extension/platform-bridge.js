(() => {
  if (window.__autoViralSessionBridgeLoaded) return;
  window.__autoViralSessionBridgeLoaded = true;
  const PROJECT_REF = "nuyzvpkvawixidotuuio";
  const STORAGE_KEY = `sb-${PROJECT_REF}-auth-token`;
  let lastAccessToken = "";
  let timer = null;

  function extractSession(raw) {
    try {
      const parsed = JSON.parse(raw);
      const session = parsed?.currentSession || parsed?.session || parsed;
      if (!session?.access_token || !session?.refresh_token) return null;
      return session;
    } catch { return null; }
  }

  async function publishSession() {
    try {
      const session = extractSession(localStorage.getItem(STORAGE_KEY) || "");
      if (!session || session.access_token === lastAccessToken) return;
      const result = await chrome.runtime.sendMessage({
        type: "AUTOVIRAL_SHARE_SESSION",
        session
      });
      if (result?.ok) lastAccessToken = session.access_token;
      else console.warn("[AutoViral] Não foi possível compartilhar a sessão:", result?.error || "erro desconhecido");
    } catch (error) {
      console.warn("[AutoViral] Falha ao sincronizar a sessão da plataforma:", error);
    }
  }

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; void publishSession(); }, 700);
  }

  window.addEventListener("storage", event => {
    if (!event.key || event.key === STORAGE_KEY) schedule();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") schedule();
  });
  void publishSession();
  setInterval(schedule, 8000);

  window.addEventListener("message", async event => {
    if (event.source !== window || event.origin !== location.origin || location.origin !== "https://teachermarcelo.github.io") return;
    const data = event.data;
    if (!data || data.source !== "AUTOVIRAL_WEB" || data.type !== "OPEN_GROUP_TASK" || typeof data.requestId !== "string") return;
    try {
      const result = await chrome.runtime.sendMessage({ type: "AUTOVIRAL_OPEN_GROUP_TASK", task: data.task });
      window.postMessage({ source: "AUTOVIRAL_EXTENSION", type: "TASK_RESULT", requestId: data.requestId, ...(result || { ok: false, error: "Extensão sem resposta." }) }, location.origin);
    } catch (error) {
      window.postMessage({ source: "AUTOVIRAL_EXTENSION", type: "TASK_RESULT", requestId: data.requestId, ok: false, error: String(error?.message || "Extensão indisponível.") }, location.origin);
    }
  });
})();
