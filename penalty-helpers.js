// ════════════════════════════════════════════════════════════════
//  PENALTY HELPERS — pure logic, no DOM, no Firebase writes
//  Shared by the cockpit (penalty-shootout.js) and all widgets.
//
//  Data (see PROJECT_CONTEXT.md → Penalty shootout):
//    /matches/{id}: status 'penalties', penaltyFormat 3|5,
//                   penaltyScore1, penaltyScore2
//    /penaltyAttempts/{matchId}/{attemptId}:
//        team 1|2, setIndex, attemptIndex, result 'goal'|'miss',
//        playerId?, playerNumber?, goalKey?, timestamp
//
//  attemptId is deterministic — 's{set}_t{team}_a{idx}' — so cycling a
//  dot always overwrites / deletes the same node.
// ════════════════════════════════════════════════════════════════

function penAttemptId(setIndex, team, attemptIndex) {
    return 's' + setIndex + '_t' + team + '_a' + attemptIndex;
}

// attempts: { attemptId: attempt } (as stored in Firebase) or null
// format:   3 | 5
// → sets: [ { 1: [result|null, ...], 2: [result|null, ...] }, ... ]
// A new set of the same size is appended automatically whenever the last
// set is complete and tied (sudden death). Sets are derived, never stored.
function penBuildSets(attempts, format) {
    format = format || 5;
    const list = attempts ? Object.values(attempts) : [];
    let maxSet = 0;
    list.forEach(function(a) { if ((a.setIndex || 0) > maxSet) maxSet = a.setIndex || 0; });

    const sets = [];
    function ensure(i) {
        while (sets.length <= i) {
            sets.push({ 1: new Array(format).fill(null), 2: new Array(format).fill(null) });
        }
    }
    ensure(maxSet);
    list.forEach(function(a) {
        const s = a.setIndex || 0, t = a.team, i = a.attemptIndex || 0;
        if ((t === 1 || t === 2) && i < format) sets[s][t][i] = a.result || null;
    });

    // Sudden death: keep appending while the last set is finished and level
    while (penSetDone(sets[sets.length - 1]) && penSetTied(sets[sets.length - 1])) {
        ensure(sets.length);
    }
    return sets;
}

function penSetDone(set) {
    return !!set && set[1].every(Boolean) && set[2].every(Boolean);
}

function penSetGoals(set, team) {
    return set[team].filter(function(v) { return v === 'goal'; }).length;
}

function penSetTied(set) {
    return penSetGoals(set, 1) === penSetGoals(set, 2);
}

// Total goals per team across all sets
function penCountGoals(attempts) {
    const res = { 1: 0, 2: 0 };
    if (!attempts) return res;
    Object.values(attempts).forEach(function(a) {
        if (a.result === 'goal' && (a.team === 1 || a.team === 2)) res[a.team]++;
    });
    return res;
}

// True when the shootout has a winner the ref can safely end on:
// the current (last) set is complete and not tied.
// (A tied complete set never stays last — penBuildSets appends a new one.)
function penIsDecided(sets) {
    if (!sets || !sets.length) return false;
    const last = sets[sets.length - 1];
    return penSetDone(last) && !penSetTied(last);
}

// Flatten all sets into a single row per team (widgets: one row, no set split)
function penFlatRow(sets, team) {
    return sets.reduce(function(acc, s) { return acc.concat(s[team]); }, []);
}

// Did this match go to penalties? (penaltyFormat is kept after 'ended')
function penHasShootout(match) {
    return !!(match && match.penaltyFormat);
}

// Regulation-vs-shootout comparison for W/D/L:
// returns { our, opp } scores to compare for a given side (1|2 = our side)
function penResultScores(match, ourSide) {
    const useP = penHasShootout(match) && match.status === 'ended';
    const s1 = useP ? (match.penaltyScore1 || 0) : (match.score1 || 0);
    const s2 = useP ? (match.penaltyScore2 || 0) : (match.score2 || 0);
    return ourSide === 2 ? { our: s2, opp: s1 } : { our: s1, opp: s2 };
}
