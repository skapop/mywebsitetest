// Enkel STV/RCV-opptelling for prototypen.
// For flerplassvalg brukes Droop-kvote og overføring av overskuddsstemmer.
// Stemmer lagres som kandidat-ID-er i prioritert rekkefølge.

function stvCount(candidates, ballots, seats) {
  const active = new Set(candidates.map(c => c.id));
  const elected = [];
  const rounds = [];
  const total = ballots.length;
  const quota = Math.floor(total / (seats + 1)) + 1;
  const weights = ballots.map(() => 1);

  function tally() {
    const counts = Object.fromEntries(candidates.map(c => [c.id, 0]));
    ballots.forEach((ballot, i) => {
      const choice = ballot.find(id => active.has(id));
      if (choice) counts[choice] += weights[i];
    });
    return counts;
  }

  while (elected.length < seats && active.size > 0) {
    let counts = tally();
    rounds.push({counts:{...counts}, elected:[...elected]});

    const winners = [...active].filter(id => counts[id] >= quota);
    if (winners.length) {
      winners.sort((a,b) => counts[b]-counts[a]);
      for (const winner of winners) {
        if (elected.length >= seats || !active.has(winner)) break;
        elected.push(winner);
        active.delete(winner);
        const surplus = counts[winner] - quota;
        if (surplus > 0 && counts[winner] > 0) {
          const factor = surplus / counts[winner];
          ballots.forEach((ballot,i) => {
            if (ballot.find(id => id === winner)) weights[i] *= factor;
          });
        }
      }
      continue;
    }

    if (active.size + elected.length <= seats) {
      [...active].forEach(id => elected.push(id));
      break;
    }

    const remaining = [...active].sort((a,b) => counts[a]-counts[b]);
    const eliminated = remaining[0];
    active.delete(eliminated);
  }

  return {elected, quota, rounds};
}