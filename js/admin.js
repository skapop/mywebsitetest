const LOCAL_KEY = "gfPrototypeLocal";
let state = null;
let selected = "leder";
let logoData = localStorage.getItem("gfLogo") || "";

function localState() {
  const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
  if (saved) return saved;
  const s = makeLocalState();
  localStorage.setItem(LOCAL_KEY, JSON.stringify(s));
  return s;
}

async function load() {
  try {
    if (SUPABASE_CONFIGURED) {
      await dbEnsurePositions();
      state = await dbLoadState();
      setBackend("Supabase tilkoblet", true);
    } else {
      state = localState();
      setBackend("Lokal demo – Supabase ikke konfigurert", false);
    }
  } catch (e) {
    console.error(e);
    state = localState();
    setBackend("Supabase-feil – bruker lokal demo", false);
    document.getElementById("systemMessage").textContent = e.message;
  }
  renderLogo();
  renderList();
  renderEditor();
}

function setBackend(text, ok) {
  document.getElementById("backendStatus").textContent = text;
  document.getElementById("systemMessage").textContent = text;
  document.getElementById("backendStatus").className = ok ? "success" : "muted";
}

function saveLocal() { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); }

async function persistPosition(p) {
  saveLocal();
  if (SUPABASE_CONFIGURED) {
    await dbSetPosition(p, p.status);
    for (const c of p.candidates) await dbSaveCandidate(p, c);
  }
}

function renderList() {
  const el = document.getElementById("positionList"); el.innerHTML = "";
  state.positions.forEach(p => {
    const b = document.createElement("button");
    b.className = "position " + (p.id === selected ? "active " : "") + (p.status === "done" ? "done" : "");
    b.innerHTML = `${escapeHtml(p.name)} <span class="muted">(${p.seats} plass${p.seats > 1 ? "er" : ""})</span><br><small>${p.status === "done" ? "✓ Ferdig" : p.status === "active" ? "● Pågår" : "○ Ikke startet"}</small>`;
    b.onclick = () => { selected = p.id; renderList(); renderEditor(); };
    el.appendChild(b);
  });
}

function renderEditor() {
  const p = state.positions.find(x => x.id === selected); if (!p) return;
  document.getElementById("editorTitle").textContent = p.name;
  const ed = document.getElementById("editor"); ed.innerHTML = "";

  const cand = document.createElement("div");
  cand.innerHTML = `<h3>Kandidater</h3><div id="candidateList"></div><button class="secondary" id="add">+ Legg til kandidat</button>`;
  ed.appendChild(cand);
  const list = cand.querySelector("#candidateList");

  p.candidates.forEach(c => {
    const row = document.createElement("div"); row.className = "candidate-row";
    row.innerHTML = `<input value="${escapeHtml(c.name)}"><input value="${escapeHtml(c.group || "")}" placeholder="Kandidatgruppe (valgfritt)"><button class="danger">Slett</button>`;
    const ins = row.querySelectorAll("input");
    ins[0].onchange = async e => { c.name = e.target.value; await persistPosition(p); };
    ins[1].onchange = async e => { c.group = e.target.value; await persistPosition(p); };
    row.querySelector("button").onclick = async () => {
      p.candidates = p.candidates.filter(x => x.id !== c.id);
      if (SUPABASE_CONFIGURED && !String(c.id).startsWith("local-")) await dbDeleteCandidate(c.id);
      await persistPosition(p); renderEditor();
    };
    list.appendChild(row);
  });

  cand.querySelector("#add").onclick = async () => {
    const c = { id: crypto.randomUUID(), name: "Ny kandidat", group: "" };
    p.candidates.push(c); await persistPosition(p); renderEditor();
  };

  if (p.id === "styre") {
    const box = document.createElement("div");
    box.className = "rule-box";
    box.innerHTML = `<h3>Representasjonskrav</h3>
      <label class="switch"><input type="checkbox" id="rule"> Aktiver representasjonskrav</label>
      <p>Hvis aktivert skal gruppen ha minimum 2 plasser totalt i styret, inkludert personer som allerede er valgt i de åtte foregående vervene.</p>
      <input id="group" placeholder="Gruppenavn" value="${escapeHtml(p.groupRule.group)}">`;
    ed.appendChild(box);
    box.querySelector("#rule").checked = p.groupRule.enabled;
    box.querySelector("#rule").onchange = async e => { p.groupRule.enabled = e.target.checked; await persistPosition(p); };
    box.querySelector("#group").onchange = async e => { p.groupRule.group = e.target.value; await persistPosition(p); };
  }

  const controls = document.createElement("div"); controls.className = "controls";
  if (p.status === "not_started") controls.innerHTML = `<button class="primary" id="start">START AVSTEMNING</button>`;
  else if (p.status === "active") controls.innerHTML = `<button class="danger" id="stop">STOPP AVSTEMNING</button>`;
  else controls.innerHTML = `<button class="secondary" id="next">Vis resultat</button>`;
  ed.appendChild(controls);

  if (controls.querySelector("#start")) controls.querySelector("#start").onclick = async () => {
    if (!p.candidates.length || p.candidates.some(c => !c.name.trim())) return alert("Legg inn alle kandidater først.");
    state.positions.forEach(x => { if (x.id !== p.id && x.status === "active") x.status = "done"; });
    p.status = "active"; p.resultVisible = false; state.active = p.id; saveLocal();
    try { await persistPosition(p); if (SUPABASE_CONFIGURED) await dbSetResultVisible(p, false); } catch (e) { alert(e.message); }
    renderList(); renderEditor();
  };
  if (controls.querySelector("#stop")) controls.querySelector("#stop").onclick = () => stopElection(p);
  if (controls.querySelector("#next")) controls.querySelector("#next").onclick = async () => {
    try {
      if (SUPABASE_CONFIGURED) await dbSetResultVisible(p, true);
      else {
        p.resultVisible = true;
        saveLocal();
      }
      renderResult(p, state.results[p.id] || null);
    } catch (e) {
      console.error(e);
      alert("Kunne ikke vise resultatet: " + e.message);
    }
  };
}

async function stopElection(p) {
  try {
    const votes = SUPABASE_CONFIGURED ? await dbGetVotes(p) : JSON.parse(localStorage.getItem("votes_" + p.id) || "[]");
    if (!votes.length && !confirm("Ingen stemmer er registrert. Fortsette?")) return;
    const res = stvCount(p.candidates, votes, p.seats);
    state.results[p.id] = res; p.status = "done"; p.resultVisible = false; state.active = null; saveLocal();
    if (SUPABASE_CONFIGURED) { await dbSetPosition(p, "done"); await dbSaveWinners(p, res); await dbSetResultVisible(p, false); }
    renderList(); renderEditor(); renderResult(p, res);
  } catch (e) { console.error(e); alert("Kunne ikke stoppe valget: " + e.message); }
}

function renderResult(p, res) {
  const card = document.getElementById("resultsCard"); card.hidden = false;
  if (!res) { document.getElementById("adminResults").innerHTML = "<p>Ingen lagret opptelling i denne nettleseren ennå.</p>"; return; }
  document.getElementById("adminResults").innerHTML = `<div class="result-winner">Valgte: ${res.elected.map(id => p.candidates.find(c => c.id === id)?.name || id).join(", ") || "Ingen"}</div><p>Kvote: ${Number(res.quota).toFixed(2)}</p>`;
}

function renderLogo() {
  const frame = document.getElementById("logoFrame");
  frame.innerHTML = logoData ? `<img src="${logoData}" alt="Valgt logo">` : `<span>Ingen logo<br><small>Last opp senere</small></span>`;
}

document.getElementById("logoButton").onclick = () => document.getElementById("logoInput").click();
document.getElementById("logoInput").onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 2 * 1024 * 1024) return alert("Logoen må være mindre enn 2 MB.");
  const reader = new FileReader(); reader.onload = () => { logoData = reader.result; localStorage.setItem("gfLogo", logoData); renderLogo(); }; reader.readAsDataURL(file);
};
document.getElementById("removeLogo").onclick = () => { logoData = ""; localStorage.removeItem("gfLogo"); renderLogo(); };
document.getElementById("clearData").onclick = () => { if (confirm("Nullstille lokal demo? Supabase-data slettes ikke.")) { localStorage.clear(); location.reload(); } };
function escapeHtml(s = "") { return String(s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m])); }
load();
