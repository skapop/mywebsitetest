/**
 * Beregner vinnere ved hjelp av STV (Single Transferable Vote / Enkel overførbar stemme)
 * med valgfri kvoteringsregel for en gitt gruppe kandidater.
 * 
 * @param {Array} candidates Array med objekter: { id, name, group_name }
 * @param {Array} votes Array med objekter: { ranking: [candidate_id1, candidate_id2, ...] }
 * @param {number} seats Antall seter som skal fylles
 * @param {boolean} repEnabled Om kvotering skal være aktiv
 * @param {string} repGroup Navnet på gruppen som skal ha reserverte seter
 * @param {number} repRequired Hvor mange fra denne gruppen som MÅ inn i styret totalt
 * @param {number} repAlreadyFilled Hvor mange fra denne gruppen som allerede er valgt i tidligere roller
 */
export function calculateSTV(candidates, votes, seats, repEnabled = false, repGroup = '', repRequired = 0, repAlreadyFilled = 0) {
  const candidateMap = new Map(candidates.map(c => [c.id, c]));
  let activeCandidates = new Set(candidates.map(c => c.id));
  const elected = [];
  const eliminated = new Set();

  // Beregn gjenstående behov for kvotering i dette valget
  const remainingNeeded = Math.max(0, repRequired - repAlreadyFilled);

  // Hver stemme har opprinnelig vekt 1.0
  let ballots = votes.map(v => ({
    weight: 1.0,
    ranking: (v.ranking || []).filter(id => activeCandidates.has(id))
  })).filter(b => b.ranking.length > 0);

  const totalVotes = ballots.reduce((sum, b) => sum + b.weight, 0);
  if (totalVotes === 0 || candidates.length === 0) return [];

  // Droop quota: floor(stemmer / (seter + 1)) + 1
  const quota = Math.floor(totalVotes / (seats + 1)) + 1;
  const candidateWeights = new Map(candidates.map(c => [c.id, 1.0]));

  function countFirstPreferences() {
    const counts = new Map(candidates.map(c => [c.id, 0]));
    for (const b of ballots) {
      // Finn første aktive kandidat på seddelen
      const first = b.ranking.find(id => activeCandidates.has(id));
      if (first) {
        counts.set(first, counts.get(first) + b.weight);
      }
    }
    return counts;
  }

  function getGroupCount(list) {
    if (!repEnabled || !repGroup) return 0;
    return list.filter(id => candidateMap.get(id)?.group_name?.trim().toLowerCase() === repGroup.trim().toLowerCase()).length;
  }

  while (elected.length < seats && activeCandidates.size > 0) {
    const remainingSeats = seats - elected.length;
    const groupElectedSoFar = getGroupCount(elected);
    const groupStillNeeded = Math.max(0, remainingNeeded - groupElectedSoFar);

    // Kvoteringssjekk: Dersom antall gjenstående seter må reserveres til kvotegruppen
    if (repEnabled && groupStillNeeded > 0) {
      const activeGroupCandidates = Array.from(activeCandidates).filter(
        id => candidateMap.get(id)?.group_name?.trim().toLowerCase() === repGroup.trim().toLowerCase()
      );

      // Hvis alle gjenværende seter MÅ fylles av kvotegruppen, eliminer alle andre kandidater
      if (activeGroupCandidates.length > 0 && remainingSeats <= groupStillNeeded) {
        for (const id of Array.from(activeCandidates)) {
          if (!activeGroupCandidates.includes(id)) {
            activeCandidates.delete(id);
            eliminated.add(id);
          }
        }
      }
    }

    if (activeCandidates.size === 0) break;

    const counts = countFirstPreferences();

    // Sjekk om noen har nådd kvoten
    let newlyElected = null;
    let maxVotes = -1;

    for (const id of activeCandidates) {
      const voteCount = counts.get(id) || 0;
      if (voteCount >= quota && voteCount > maxVotes) {
        maxVotes = voteCount;
        newlyElected = id;
      }
    }

    if (newlyElected) {
      elected.push(newlyElected);
      activeCandidates.delete(newlyElected);

      // Overfør overskuddsstemmer
      const surplus = maxVotes - quota;
      if (surplus > 0 && maxVotes > 0) {
        const transferFactor = surplus / maxVotes;
        for (const b of ballots) {
          const first = b.ranking.find(id => activeCandidates.has(id) || id === newlyElected);
          if (first === newlyElected) {
            b.weight *= transferFactor;
          }
        }
      }
      continue;
    }

    // Hvis ingen nådde kvoten, fyll opp om vi har like mange kandidater som seter igjen
    if (activeCandidates.size <= (seats - elected.length)) {
      for (const id of Array.from(activeCandidates)) {
        elected.push(id);
        activeCandidates.delete(id);
      }
      break;
    }

    // Hvis ingen har nådd kvoten, eliminer kandidaten med færrest stemmer
    let minVotes = Infinity;
    let candidateToEliminate = null;

    for (const id of activeCandidates) {
      const voteCount = counts.get(id) || 0;
      if (voteCount < minVotes) {
        minVotes = voteCount;
        candidateToEliminate = id;
      }
    }

    if (candidateToEliminate) {
      activeCandidates.delete(candidateToEliminate);
      eliminated.add(candidateToEliminate);
    } else {
      break;
    }
  }

  return elected.map(id => candidateMap.get(id));
}