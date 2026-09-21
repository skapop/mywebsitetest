let state = { positions: [], active: null, results: {} };
let currentPosition = null;

async function loadState() {
  try {
    if (SUPABASE_CONFIGURED) state = await dbLoadState();
    else state = JSON.parse(localStorage.getItem("gfPrototypeLocal") || "null") || makeLocalState();
    render();
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
  area.innerHTML = ""; submit.hidden = true; codeBox.hidden = true;

  if (!state.active) { badge.textContent = "Ikke startet"; title.textContent = "Ingen aktiv avstemning"; instruction.textContent = "Vent på at admin starter neste avstemning."; return; }
  const p = state.positions.find(x => x.id === state.active); if (!p) return;
  currentPosition = p;
  badge.textContent = "Pågår"; title.textContent = p.name;
  instruction.textContent = "Dra kandidatene i ønsket rekkefølge. Kandidater du utelater blir ikke rangert.";
  codeBox.hidden = false;

  const selected = document.createElement("div"); selected.className = "dropzone"; selected.id = "ranked";
  const unselected = document.createElement("div"); unselected.className = "dropzone muted-box"; unselected.id = "unranked";
  p.candidates.forEach((c, i) => {
    const el = makeItem(c, i + 1); selected.appendChild(el);
  });
  area.innerHTML = `<h3>Prioritert rekkefølge</h3>`; area.appendChild(selected);
  area.insertAdjacentHTML("beforeend", `<h3>Ikke valgt</h3>`); area.appendChild(unselected);
  p.candidates.forEach(c => addDragToZone(c, unselected));
  selected.querySelectorAll(".rank-item").forEach(addDrag);
  renumber(); submit.hidden = false;
}

function makeItem(c, rank) {
  const el = document.createElement("div"); el.className = "rank-item"; el.draggable = true; el.dataset.id = c.id;
  el.innerHTML = `<span class="rank-number">${rank}</span><span>${escapeHtml(c.name)}</span><button class="tiny secondary" type="button">×</button>`;
  el.querySelector("button").onclick = () => { document.getElementById("unranked").appendChild(el); renumber(); };
  return el;
}
function addDragToZone(c, zone) {
  const el = makeUnrankedItem(c); zone.appendChild(el); addDrag(el);
}
function makeUnrankedItem(c) {
  const el = document.createElement("div"); el.className = "rank-item unranked-item"; el.draggable = true; el.dataset.id = c.id;
  el.innerHTML = `<span class="rank-number">–</span><span>${escapeHtml(c.name)}</span>`;
  return el;
}
function addDrag(el) {
  el.addEventListener("dragstart", e => e.dataTransfer.setData("text/plain", el.dataset.id));
  el.addEventListener("dragover", e => e.preventDefault());
  el.addEventListener("drop", e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); const x = listById(id); if (x && x !== el) { el.parentNode.insertBefore(x, el); renumber(); } });
}
function listById(id) { return [...document.querySelectorAll(".rank-item")].find(x => x.dataset.id === id); }
function renumber() { document.querySelectorAll("#ranked .rank-item").forEach((x, i) => x.querySelector(".rank-number").textContent = i + 1); }
function escapeHtml(s = "") { return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])); }

async function submit() {
  const code = document.getElementById("voterCode").value.trim();
  if (SUPABASE_CONFIGURED && !code) return alert("Skriv inn stemmekoden din.");
  const ids = [...document.querySelectorAll("#ranked .rank-item")].map(x => x.dataset.id);
  if (!ids.length) return alert("Velg minst én kandidat.");
  try {
    if (SUPABASE_CONFIGURED) await dbInsertVote(currentPosition, code, ids);
    else {
      const key = "votes_" + currentPosition.id; const votes = JSON.parse(localStorage.getItem(key) || "[]"); votes.push(ids); localStorage.setItem(key, JSON.stringify(votes));
    }
    document.getElementById("submitVote").hidden = true;
    document.getElementById("instruction").textContent = "Stemmen er registrert. Vent på neste avstemning.";
  } catch (e) {
    if (String(e.message).includes("duplicate") || String(e.message).includes("unique")) alert("Denne stemmekoden har allerede stemt.");
    else alert("Kunne ikke registrere stemmen: " + e.message);
  }
}

document.getElementById("submitVote").onclick = submit;

function renderLogo() {
  const data = localStorage.getItem("gfLogo");
  const el = document.getElementById("headerLogo");
  if (data) el.innerHTML = `<img src="${data}" alt="Logo">`;
}
renderLogo();
loadState();
setInterval(async () => { if (SUPABASE_CONFIGURED) { try { state = await dbLoadState(); render(); } catch (_) {} } }, 2000);
