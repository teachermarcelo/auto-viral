const APP_URL = "https://teachermarcelo.github.io/auto-viral/";
const $ = (selector) => document.querySelector(selector);
let draft = null;

async function getCaptures() {
  const result = await chrome.storage.local.get({ autoViralCaptures: [] });
  return Array.isArray(result.autoViralCaptures) ? result.autoViralCaptures : [];
}
async function setCaptures(rows) {
  await chrome.storage.local.set({ autoViralCaptures: rows });
}
function setStatus(message) { $("#status").textContent = message; }
function safeText(value) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  })[char]);
}
async function captureCurrentTab() {
  setStatus("Lendo a aba atual…");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Não encontrei uma aba ativa.");
  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const description = document.querySelector('meta[name="description"]')?.content || "";
      const selection = window.getSelection()?.toString()?.trim() || "";
      return {
        title: document.title || "Página sem título",
        url: location.href,
        description: description.slice(0, 600),
        selected_text: selection.slice(0, 5000),
        captured_at: new Date().toISOString(),
        domain: location.hostname
      };
    }
  });
  if (!result?.result) throw new Error("Não foi possível ler esta página. Algumas páginas internas do Chrome bloqueiam a captura.");
  draft = result.result;
  $("#editor").classList.remove("hidden");
  setStatus(draft.selected_text
    ? "Texto selecionado incluído na captura."
    : "Página capturada. Selecione um trecho na página para registrar mais contexto.");
}
function render(rows) {
  $("#count").textContent = String(rows.length);
  if (!rows.length) {
    $("#items").innerHTML = '<p class="empty">Nenhuma captura salva.</p>';
    return;
  }
  $("#items").innerHTML = rows.slice(0, 20).map(row => `
    <article class="item">
      <b title="${safeText(row.title)}">${safeText(row.title)}</b>
      <small>${safeText(row.domain)} · ${safeText(row.signal)}</small>
      <div class="item-actions">
        <button data-copy="${safeText(row.id)}">Copiar</button>
        <button data-open="${safeText(row.id)}">Abrir página</button>
        <button data-delete="${safeText(row.id)}">Excluir</button>
      </div>
    </article>`).join("");
}
async function refresh() { render(await getCaptures()); }
$("#capture").addEventListener("click", async () => {
  try { await captureCurrentTab(); }
  catch (error) { setStatus(error.message || "Falha ao capturar."); }
});
$("#save").addEventListener("click", async () => {
  if (!draft) return;
  const row = {
    id: crypto.randomUUID(),
    ...draft,
    signal: $("#signal").value,
    notes: $("#notes").value.trim()
  };
  const rows = await getCaptures();
  rows.unshift(row);
  await setCaptures(rows);
  draft = null;
  $("#editor").classList.add("hidden");
  $("#notes").value = "";
  setStatus("Captura salva localmente no Chrome.");
  await refresh();
});
$("#items").addEventListener("click", async event => {
  const button = event.target.closest("button[data-copy],button[data-open],button[data-delete]");
  if (!button) return;
  const rows = await getCaptures();
  const row = rows.find(item => item.id === (button.dataset.copy || button.dataset.open || button.dataset.delete));
  if (button.dataset.copy && row) {
    await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setStatus("Dados da captura copiados.");
  } else if (button.dataset.open && row) {
    await chrome.tabs.create({ url: row.url });
  } else if (button.dataset.delete) {
    await setCaptures(rows.filter(item => item.id !== button.dataset.delete));
    await refresh();
    setStatus("Captura excluída.");
  }
});
$("#export").addEventListener("click", async () => {
  const rows = await getCaptures();
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "autoviral-capturas.json";
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Arquivo JSON exportado.");
});
$("#open-app").addEventListener("click", () => chrome.tabs.create({ url: APP_URL }));
refresh();
