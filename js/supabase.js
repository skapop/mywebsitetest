/*
 * Supabase connection
 *
 * Fyll inn URL og publishable key fra Supabase-prosjektet ditt.
 * Ikke legg inn service_role/secret key her.
 */
const SUPABASE_URL = "https://qtsfzbqkgjifcfceihre.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4IZSLlq7DM_vyw_V0tUj9w_TlZ7Zswu";

const SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("DIN_SUPABASE") &&
  SUPABASE_PUBLISHABLE_KEY.length > 20 &&
  !SUPABASE_PUBLISHABLE_KEY.includes("DIN_SUPABASE");

const sb = SUPABASE_CONFIGURED
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const positionsTemplate = [
  ["leder", "Leder", 1],
  ["nestleder", "Nestleder", 1],
  ["okonomi", "Økonomiansvarlig", 1],
  ["pr", "PR-ansvarlig", 1],
  ["bedrift", "Bedriftsansvarlig", 1],
  ["hbar", "HBAR-ansvarlig", 1],
  ["arrangement", "Arrangementsansvarlig", 1],
  ["internasjonalt", "Internasjonalt ansvarlig", 1],
  ["styre", "Styremedlemmer", 4]
];

function makeLocalState() {
  return {
    positions: positionsTemplate.map(([id, name, seats], i) => ({
      id, name, seats, positionNumber: i + 1, candidates: [],
      groupRule: { enabled: false, group: "", required: 2 }, status: "not_started"
    })),
    active: null,
    results: {}
  };
}

async function dbLoadState() {
  const { data: elections, error } = await sb
    .from("elections")
    .select("*")
    .order("position_number");
  if (error) throw error;

  const ids = elections.map(e => e.id);
  let candidates = [];
  if (ids.length) {
    const result = await sb.from("candidates").select("*").in("election_id", ids);
    if (result.error) throw result.error;
    candidates = result.data || [];
  }

  const positions = elections.map(e => ({
    id: e.position_key,
    dbId: e.id,
    name: e.position_name,
    seats: e.seats,
    positionNumber: e.position_number,
    status: e.status === "active" ? "active" : e.status === "finished" ? "done" : "not_started",
    groupRule: {
      enabled: !!e.representation_enabled,
      group: e.representation_group || "",
      required: e.representation_required || 2
    },
    candidates: candidates.filter(c => c.election_id === e.id).map(c => ({
      id: c.id, name: c.name, group: c.group_name || ""
    }))
  }));

  const active = positions.find(p => p.status === "active")?.id || null;
  return { positions, active, results: {} };
}

async function dbEnsurePositions() {
  const { data, error } = await sb.from("elections").select("id,position_key");
  if (error) throw error;
  const existing = new Set((data || []).map(x => x.position_key));
  const missing = positionsTemplate
    .map(([id, name, seats], i) => ({
      position_key: id, position_name: name, position_number: i + 1, seats,
      status: "waiting", representation_enabled: id === "styre" ? false : false,
      representation_group: null, representation_required: id === "styre" ? 2 : 0
    }))
    .filter(x => !existing.has(x.position_key));
  if (missing.length) {
    const result = await sb.from("elections").insert(missing);
    if (result.error) throw result.error;
  }
}

async function dbSetPosition(position, status) {
  if (position.dbId == null) {
    const { data, error } = await sb.from("elections")
      .select("id").eq("position_key", position.id).single();
    if (error) throw error;
    position.dbId = data.id;
  }
  const payload = {
    status: status === "active" ? "active" : status === "done" ? "finished" : "waiting",
    representation_enabled: !!position.groupRule.enabled,
    representation_group: position.groupRule.group || null,
    representation_required: position.groupRule.enabled ? position.groupRule.required : 0
  };
  const { error } = await sb.from("elections").update(payload).eq("id", position.dbId);
  if (error) throw error;
}

async function dbSaveCandidate(position, candidate) {
  if (position.dbId == null) await dbLoadState();
  const { error } = await sb.from("candidates").upsert({
    id: candidate.id,
    election_id: position.dbId,
    name: candidate.name,
    group_name: candidate.group || null
  });
  if (error) throw error;
}

async function dbDeleteCandidate(candidateId) {
  const { error } = await sb.from("candidates").delete().eq("id", candidateId);
  if (error) throw error;
}

async function dbInsertVote(position, voterCode, ranking) {
  const { error } = await sb.from("votes").insert({
    election_id: position.dbId,
    voter_code: voterCode,
    ranking
  });
  if (error) throw error;
}

async function dbGetVotes(position) {
  const { data, error } = await sb.from("votes").select("ranking").eq("election_id", position.dbId);
  if (error) throw error;
  return (data || []).map(v => v.ranking);
}

async function dbSaveWinners(position, result) {
  const rows = result.elected.map(id => ({ election_id: position.dbId, candidate_id: id, vote_count: result.counts?.[id] ?? null }));
  if (rows.length) {
    const { error } = await sb.from("winners").insert(rows);
    if (error) throw error;
  }
}
