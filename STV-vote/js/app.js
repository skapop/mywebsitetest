let state = { positions: [], active: null, results: {} };
let currentPosition = null;
let selectedIds = [];
let submitted = false;

async function loadState() {
  try {
    state = SUPABASE_CONFIGURED ? await dbLoadState() : JSON.parse(localStorage.getItem("gfPrototypeLocal") || "null") || makeLocalState();
    render();
    await loadVisibleResult();
  } catch (e) {
    console.error(e);
    document.getElementById("instruction").textContent = "Kunne ikke hente avstemningen. Sjekk Supabase-oppsettet.";
  }
}

function render() {
  const badge = document.getElementById("statusBadge");
  const title = document.getElementById("electionTitle");
  const instruction = document.getElementById("instruction");
  const area = document.getElementById("voteArea");
  const submit = document.getElementById("submitVote");
  const codeBox = document.getElementById("voterCodeBox");
  const submittedMessage = document.getElementById("submittedMessage");
  if (!area) return;

  area.innerHTML = "";
  submit.hidden = true;
  codeBox.hidden = true;
  if (submittedMessage) submittedMessage.hidden = true;

  if (!state.active) {
    badge.textContent = "Ikke startet";
    title.textContent = "Ingen aktiv avstemning";
    instruction.textContent = "Vent på at admin starter neste avstemning.";
    currentPosition = null;
    selectedIds = [];
    submitted = false;
    return;
  }

  const p = state.positions.find(x => x.id === state.active);
  if (!p) return;
  if (!currentPosition || currentPosition.id !== p.id) { selectedIds = []; submitted = false; }
  currentPosition = p;

  badge.textContent = "Pågår";
  title.textContent = p.name;
  instruction.textContent = "Trykk på kandidatene i den rekkefølgen du ønsker å stemme.";
  codeBox.hidden = false;
  if (submitted) {
    if (submittedMessage) submittedMessage.hidden = false;
    instruction.textContent = "Stemmen er registrert. Vent på neste avstemning.";
    return;
  }

  const selected = document.createElement("div");
  selected.className = "dropzone";
  selected.id = "ranked";
  selected.innerHTML = selectedIds.length ? "" : '<div class="empty-ranking">Ingen kandidater valgt ennå.</div>';
  selectedIds.forEach((id, i) => {
    const c = p.candidates.find(x => String(x.id) === String(id));
    if (c) selected.appendChild(makeRankItem(c, i + 1));
  });

  const candidates = document.createElement("div");
  candidates.className = "candidate-list";
  p.candidates.forEach(c => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "candidate-button";
    const chosen = selectedIds.includes(String(c.id));
    button.disabled = chosen;
    button.innerHTML = `<span><strong>${escapeHtml(c.name)}</strong>${c.group ? `<small>${escapeHtml(c.group)}</small>` : ""}</span><b>${chosen ? "Valgt" : "Velg"}</b>`;
    button.onclick = () => addCandidate(c.id);
    candidates.appendChild(button);
  });

  area.innerHTML = `<h3>Velg kandidater</h3><p>Trykk på kandidatene i ønsket rekkefølge. Du kan utelate kandidater.</p>`;
  area.appendChild(candidates);
  area.insertAdjacentHTML("beforeend", "<h3>Din stemmerekkefølge</h3>");
  area.appendChild(selected);
  submit.hidden = false;
}

function makeRankItem(c, rank) {
  const el = document.createElement("div");
  el.className = "rank-item";
  el.innerHTML = `<span class="rank-number">${rank}</span><span class="rank-info"><strong>${escapeHtml(c.name)}</strong>${c.group ? `<small>${escapeHtml(c.group)}</small>` : ""}</span><button type="button" class="remove-button" aria-label="Fjern kandidat">×</button>`;
  el.querySelector(".remove-button").onclick = () => removeCandidate(c.id);
  return el;
}

function addCandidate(id) {
  id = String(id);
  if (!selectedIds.includes(id)) { selectedIds.push(id); render(); }
}

function removeCandidate(id) {
  selectedIds = selectedIds.filter(x => String(x) !== String(id));
  render();
}

async function submit() {
  if (!currentPosition || submitted) return;
  const code = document.getElementById("voterCode").value.trim();
  if (SUPABASE_CONFIGURED && !code) return alert("Skriv inn stemmekoden din.");
  if (!selectedIds.length) return alert("Velg minst én kandidat.");
  const button = document.getElementById("submitVote");
  button.disabled = true;
  try {
    if (SUPABASE_CONFIGURED) await dbInsertVote(currentPosition, code, selectedIds);
    else {
      const key = "votes_" + currentPosition.id;
      const votes = JSON.parse(localStorage.getItem(key) || "[]");
      votes.push(selectedIds); localStorage.setItem(key, JSON.stringify(votes));
    }
    submitted = true;
    render();
  } catch (e) {
    button.disabled = false;
    if (/duplicate|unique/i.test(String(e.message))) alert("Denne stemmekoden har allerede stemt.");
    else alert("Kunne ikke registrere stemmen: " + e.message);
  }
}

document.getElementById("submitVote").onclick = submit;

async function loadVisibleResult() {
  const resultView = document.getElementById("resultView");
  const resultContent = document.getElementById("resultContent");
  if (!resultView || !resultContent) return;

  if (!SUPABASE_CONFIGURED) {
    const local = JSON.parse(localStorage.getItem("gfResultVisible") || "null");
    if (!local?.visible) { resultView.hidden = true; return; }
    const p = state.positions.find(x => x.id === local.positionId);
    const result = state.results?.[local.positionId];
    if (!p || !result) { resultView.hidden = true; return; }
    resultView.hidden = false;
    resultContent.innerHTML = `<div class="result-winner">${result.elected.map(id => escapeHtml(p.candidates.find(c => String(c.id) === String(id))?.name || id)).join("<br>")}</div>`;
    return;
  }

  const result = await dbGetVisibleResult();
  if (!result) { resultView.hidden = true; return; }
  resultView.hidden = false;
  resultContent.innerHTML = `<div class="result-position">${escapeHtml(result.positionName)}</div><div class="result-winner">${result.winners.map(w => escapeHtml(w.name)).join("<br>")}</div>`;
}

function renderLogo() {
  const data = localStorage.getItem("gfLogo");
  const el = document.getElementById("headerLogo");
  if (el && data) el.innerHTML = `<img src="${data}" alt="Logo">`;
}
function escapeHtml(s = "") { return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])); }

renderLogo();
loadState();
setInterval(async () => {
  if (!SUPABASE_CONFIGURED) return;
  try {
    const newState = await dbLoadState();
    if (newState.active !== state.active) { state = newState; render(); }
    await loadVisibleResult();
  } catch (_) {}
}, 2000);
