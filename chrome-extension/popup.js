const APP_URL = "https://teachermarcelo.github.io/auto-viral/";
const $ = (selector) => document.querySelector(selector);
let draft = null;
let discoveredGroups = [];

async function getCaptures() {
  const result = await chrome.storage.local.get({ autoViralCaptures: [] });
  return Array.isArray(result.autoViralCaptures) ? result.autoViralCaptures : [];
}
async function setCaptures(rows) { await chrome.storage.local.set({ autoViralCaptures: rows }); }
function setStatus(message) { $("#status").textContent = message; }
function safeText(value) {
  return String(value ?? "").replace(/[&<>"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
  })[char]);
}
function normalizeGroupUrl(value) {
  try {
    const url = new URL(value);
    if (!/(^|\.)facebook\.com$|(^|\.)fb\.com$/i.test(url.hostname)) return null;
    const match = url.pathname.match(/^\/groups\/([^/?#]+)/i);
    if (!match) return null;
    const slug = match[1].toLowerCase();
    if (["feed", "create", "discover", "joins", "your_groups"].includes(slug)) return null;
    return `https://www.facebook.com/groups/${match[1]}/`;
  } catch { return null; }
}
async function runOnActiveTab(func) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Não encontrei uma aba ativa.");
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func });
  if (!result?.result) throw new Error("Não foi possível ler esta página. Tente em uma página pública já carregada.");
  return result.result;
}
async function captureCurrentTab() {
  setStatus("Lendo a aba atual…");
  const data = await runOnActiveTab(() => ({
    title: document.title || "Página sem título",
    url: location.href,
    description: document.querySelector('meta[name="description"]')?.content || "",
    selected_text: window.getSelection()?.toString()?.trim() || "",
    captured_at: new Date().toISOString(),
    domain: location.hostname
  }));
  draft = { ...data, description: data.description.slice(0, 600), selected_text: data.selected_text.slice(0, 5000) };
  $("#editor").classList.remove("hidden");
  setStatus(draft.selected_text ? "Texto selecionado incluído na captura." : "Página capturada. Adicione uma observação antes de salvar.");
}
async function mapVisibleGroups() {
  setStatus("Procurando links de grupos visíveis na página…");
  const found = await runOnActiveTab(() => {
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const seen = new Set();
    const rows = [];
    for (const anchor of document.querySelectorAll('a[href*="facebook.com/groups/"],a[href*="fb.com/groups/"]')) {
      if (!visible(anchor)) continue;
      let url;
      try {
        const parsed = new URL(anchor.href);
        const match = parsed.pathname.match(/^\/groups\/([^/?#]+)/i);
        if (!match || ["feed","create","discover","joins","your_groups"].includes(match[1].toLowerCase())) continue;
        url = `https://www.facebook.com/groups/${match[1]}/`;
      } catch { continue; }
      if (seen.has(url)) continue;
      seen.add(url);
      const card = anchor.closest('[role="article"],article') || anchor.parentElement;
      const title = (anchor.innerText || anchor.getAttribute("aria-label") || card?.innerText || "").trim().replace(/\s+/g, " ").slice(0, 180);
      rows.push({ url, title: title || "Grupo do Facebook", context: (card?.innerText || "").trim().replace(/\s+/g, " ").slice(0, 500) });
    }
    return { title: document.title, url: location.href, groups: rows.slice(0, 100) };
  });
  discoveredGroups = found.groups.map(group => ({
    ...group,
    id: crypto.randomUUID(),
    domain: "facebook.com",
    signal: "Grupo encontrado na página",
    captured_at: new Date().toISOString(),
    source_url: found.url,
    selected: true
  }));
  renderDiscovered();
  setStatus(discoveredGroups.length
    ? `${discoveredGroups.length} link(s) de grupo encontrado(s) entre os resultados visíveis/carregados.`
    : "Nenhum link de grupo foi encontrado nos resultados atualmente carregados. Role a página para carregar mais resultados e tente novamente.");
}
function renderDiscovered() {
  const box = $("#discovered");
  if (!discoveredGroups.length) { box.classList.add("hidden"); box.innerHTML = ""; return; }
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="section-title"><strong>Grupos encontrados</strong><span>${discoveredGroups.length}</span></div>
    <div class="scan-actions"><button id="select-all" class="text-button">Selecionar todos</button><button id="select-none" class="text-button">Limpar seleção</button></div>
    <div class="discovered-list">${discoveredGroups.map(group => `
      <label class="discovered-item">
        <input type="checkbox" data-group-id="${safeText(group.id)}" ${group.selected ? "checked" : ""}>
        <span><b>${safeText(group.title)}</b><small>${safeText(group.url)}</small></span>
      </label>`).join("")}</div>
    <button id="save-groups" class="primary">Salvar grupos selecionados</button>`;
}
function render(rows) {
  $("#count").textContent = String(rows.length);
  if (!rows.length) { $("#items").innerHTML = '<p class="empty">Nenhuma captura salva.</p>'; return; }
  $("#items").innerHTML = rows.slice(0, 30).map(row => `
    <article class="item">
      <b title="${safeText(row.title)}">${safeText(row.title)}</b>
      <small>${safeText(row.domain)} · ${safeText(row.signal || "Captura manual")}</small>
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
$("#map-groups").addEventListener("click", async () => {
  try { await mapVisibleGroups(); }
  catch (error) { setStatus(error.message || "Falha ao mapear grupos."); }
});
$("#discovered").addEventListener("change", event => {
  const input = event.target.closest("input[data-group-id]");
  if (!input) return;
  const row = discoveredGroups.find(group => group.id === input.dataset.groupId);
  if (row) row.selected = input.checked;
});
$("#discovered").addEventListener("click", async event => {
  if (event.target.id === "select-all" || event.target.id === "select-none") {
    discoveredGroups.forEach(group => group.selected = event.target.id === "select-all");
    renderDiscovered();
  }
  if (event.target.id === "save-groups") {
    const selected = discoveredGroups.filter(group => group.selected);
    if (!selected.length) { setStatus("Selecione pelo menos um grupo."); return; }
    const rows = await getCaptures();
    const existing = new Set(rows.map(row => row.url));
    const fresh = selected.filter(group => !existing.has(group.url)).map(({selected: _selected, ...group}) => ({
      ...group,
      description: group.context,
      selected_text: "",
      notes: "Mapeado manualmente a partir dos links visíveis na página."
    }));
    await setCaptures([...fresh, ...rows]);
    setStatus(`${fresh.length} grupo(s) salvo(s). ${selected.length - fresh.length} duplicado(s) ignorado(s).`);
    discoveredGroups = [];
    renderDiscovered();
    await refresh();
  }
});
$("#save").addEventListener("click", async () => {
  if (!draft) return;
  const row = { id: crypto.randomUUID(), ...draft, signal: $("#signal").value, notes: $("#notes").value.trim() };
  const rows = await getCaptures();
  if (rows.some(item => item.url === row.url)) { setStatus("Esta página já está salva."); return; }
  await setCaptures([row, ...rows]);
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
  const id = button.dataset.copy || button.dataset.open || button.dataset.delete;
  const row = rows.find(item => item.id === id);
  if (button.dataset.copy && row) {
    await navigator.clipboard.writeText(JSON.stringify(row, null, 2));
    setStatus("Dados da captura copiados.");
  } else if (button.dataset.open && row) {
    await chrome.tabs.create({ url: row.url });
  } else if (button.dataset.delete) {
    await setCaptures(rows.filter(item => item.id !== id));
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
