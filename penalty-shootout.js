// ========================================
// PENALTY SHOOTOUT — cockpit management
// ========================================
// Shown instead of the score controls while match.status === 'penalties'.
// Flow:
//   endMatch() on a level score → «Нужна серия пенальти?» (match-control.js)
//   Да → status 'penalties' → this section: format picker (3 / 5) → attempt dots
//   «⏹ Закончить матч» stays in the time-controls section (not here) —
//   second endMatch() call → penRequestEnd() → confirm if undecided → 'ended'
//
// Dots: single click cycles empty → miss → goal → empty. No turn order.
// Miss comes first so a missed penalty is one click; a goal is the second
// click, which (home team) opens the player picker (retroGoalModal in
// 'penalty' mode). Closing the picker without a choice leaves the dot as miss.
//
// Writes (one atomic multi-path update per click):
//   /penaltyAttempts/{matchId}/{s#_t#_a#}
//   /goals/{key}     — isPenalty: true (home: playerId; opponent: isOpponent)
//   /matches/{id}/penaltyScore1|2
//
// Depends on: penalty-helpers.js, goal-tracking.js (goalTracking,
//   resolveDefaultTeamSide, openRetroGoalModal), match-management.js
//   (_matchDataCache, showToast), match-control.js (_finalizeEndMatch)

const _pen = {
    matchId:  null,   // match the section is bound to
    ref:      null,   // /penaltyAttempts/{matchId} listener ref
    attempts: {},     // live copy of /penaltyAttempts/{matchId}
    homeSide: 1,      // side of the default team (player picker side)
    pending:  null    // {s, t, i} while the player picker is open
};

function _penMatch() {
    return (typeof _matchDataCache !== 'undefined' && matchId) ? (_matchDataCache[matchId] || null) : null;
}

function _penEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ----------------------------------------
// SECTION VISIBILITY — called from _applyStatusSections (match-management.js)
// ----------------------------------------
function penApplyStatus(match) {
    const section = document.getElementById('penaltySection');
    if (!section) return;
    const active = !!match && match.status === 'penalties';
    section.style.display = active ? 'block' : 'none';

    if (active) {
        _penAttach();
        resolveDefaultTeamSide(match).then(function(side) {
            _pen.homeSide = side || 1;
            penRender();
        });
        penRender();
    } else {
        penDetach();
    }
}

function _penAttach() {
    if (_pen.ref && _pen.matchId === matchId) return; // already listening
    penDetach();
    _pen.matchId  = matchId;
    _pen.attempts = {};
    _pen.ref = database.ref('penaltyAttempts/' + matchId);
    _pen.ref.on('value', function(snap) {
        _pen.attempts = snap.val() || {};
        penRender();
    });
}

// Also called from _detachCockpitListeners when leaving the cockpit
function penDetach() {
    if (_pen.ref) _pen.ref.off('value');
    _pen.ref      = null;
    _pen.matchId  = null;
    _pen.attempts = {};
    _pen.pending  = null;
}

// ----------------------------------------
// RENDER
// ----------------------------------------
function penRender() {
    const body = document.getElementById('penaltyBody');
    const match = _penMatch();
    if (!body || !match || match.status !== 'penalties') return;

    const t1 = _penEsc(match.team1Name || 'Команда 1');
    const t2 = _penEsc(match.team2Name || 'Команда 2');
    const format = match.penaltyFormat;

    // ── Format picker (once, at the start) ──
    if (!format) {
        body.innerHTML =
            '<div class="pen-intro">Счёт ' + (match.score1 || 0) + ' : ' + (match.score2 || 0) +
            ' — выберите формат серии</div>' +
            '<div class="pen-format-btns">' +
                '<button class="pen-format-btn" onclick="penChooseFormat(3)">3 попытки</button>' +
                '<button class="pen-format-btn" onclick="penChooseFormat(5)">5 попыток</button>' +
            '</div>';
        return;
    }

    const sets  = penBuildSets(_pen.attempts, format);
    const score = penCountGoals(_pen.attempts);
    const hasAttempts = Object.keys(_pen.attempts).length > 0;

    let html =
        '<div class="pen-head">' +
            '<span class="pen-head-team">' + t1 + '</span>' +
            '<span class="pen-head-score">' + score[1] + ' : ' + score[2] + '</span>' +
            '<span class="pen-head-team right">' + t2 + '</span>' +
        '</div>';

    sets.forEach(function(set, s) {
        html += '<div class="pen-set">' +
                '<div class="pen-set-title">' + (s === 0 ? 'Основная серия' : 'Доп. серия ' + s) + '</div>';
        [1, 2].forEach(function(t) {
            html += '<div class="pen-row"><div class="pen-row-team">' + (t === 1 ? t1 : t2) + '</div><div class="pen-dots">';
            set[t].forEach(function(v, i) {
                const a   = _pen.attempts[penAttemptId(s, t, i)];
                const cls = v === 'goal' ? ' goal' : v === 'miss' ? ' miss' : '';
                let label = v === 'goal' ? '✓' : v === 'miss' ? '✕' : (i + 1);
                if (v === 'goal' && a && a.playerNumber != null) label = '#' + a.playerNumber;
                html += '<button class="pen-dot' + cls + '" onclick="penCycle(' + s + ',' + t + ',' + i + ')">' + label + '</button>';
            });
            html += '</div></div>';
        });
        html += '</div>';
    });

    // Status line
    let status;
    if (penIsDecided(sets)) {
        const winner = score[1] > score[2] ? t1 : t2;
        status = '<div class="pen-status done">✅ Победа: ' + winner + ' (' + score[1] + ':' + score[2] +
                 '). Нажмите «Закончить матч» выше.</div>';
    } else if (sets.length >= 2) {
        status = '<div class="pen-status">Ничья в основной серии — идёт доп. серия. ' +
                 'Матч можно закончить в любой момент.</div>';
    } else {
        status = '<div class="pen-status">Нажмите на кружок: промах → гол → пусто</div>';
    }
    html += status;

    // Format can still be changed while nothing is recorded
    if (!hasAttempts) {
        html += '<div class="pen-format-change">Формат: ' + format + ' попыток · ' +
                '<a href="#" onclick="penChooseFormat(null); return false;">изменить</a></div>';
    }

    body.innerHTML = html;
}

// ----------------------------------------
// FORMAT
// ----------------------------------------
function penChooseFormat(f) {
    const match = _penMatch();
    if (!match) return;
    if (f === null && Object.keys(_pen.attempts).length > 0) return; // locked once attempts exist
    match.penaltyFormat = f;
    penRender();
    database.ref('matches/' + matchId).update({ penaltyFormat: f })
        .catch(function(err) { console.error('penaltyFormat save error:', err); showToast('❌ Ошибка сохранения'); });
}

// ----------------------------------------
// DOT CYCLING
// ----------------------------------------
function penCycle(s, t, i) {
    const match = _penMatch();
    if (!match || match.status !== 'penalties') return;
    const id  = penAttemptId(s, t, i);
    const cur = _pen.attempts[id] || null;

    const updates = {};
    const next = Object.assign({}, _pen.attempts);

    if (!cur) {
        // empty → miss (single click)
        next[id] = { team: t, setIndex: s, attemptIndex: i, result: 'miss', timestamp: Date.now() };
    } else if (cur.result === 'miss') {
        // miss → goal
        if (t === _pen.homeSide) {
            // Home team → pick the scorer first; cancelling keeps the miss
            _pen.pending = { s: s, t: t, i: i };
            openRetroGoalModal('penalty');
            return;
        }
        _penSetGoal(s, t, i, null);
        return;
    } else {
        // goal → empty: drop the attempt and its linked /goals record
        if (cur.goalKey) updates['goals/' + cur.goalKey] = null;
        delete next[id];
    }
    updates['penaltyAttempts/' + matchId + '/' + id] = next[id] || null;
    _penCommit(next, updates);
}

// Called from the player grid (retroGoalModal in 'penalty' mode)
function penPickScorer(playerId) {
    const p = _pen.pending;
    _pen.pending = null;          // consumed — closing the modal won't cancel it
    closeRetroGoalModal();
    if (!p) return;
    _penSetGoal(p.s, p.t, p.i, playerId);
}

// Called from closeRetroGoalModal — picker dismissed without a choice → dot stays «miss»
function penCancelPick() {
    _pen.pending = null;
}

function _penSetGoal(s, t, i, playerId) {
    const match = _penMatch();
    if (!match) return;
    const id      = penAttemptId(s, t, i);
    const goalKey = database.ref('goals').push().key;
    const now     = Date.now();
    const isHome  = (t === _pen.homeSide);

    const attempt = { team: t, setIndex: s, attemptIndex: i, result: 'goal', goalKey: goalKey, timestamp: now };
    const goal = {
        matchId:          matchId,
        isOwnGoal:        false,
        isPenalty:        true,
        penaltyAttemptId: id,
        timestamp:        now
    };

    if (isHome) {
        goal.teamId   = goalTracking.defaultTeamId || null;
        goal.playerId = playerId || null;
        const player = playerId
            ? goalTracking.playersCache.find(function(pl) { return pl.id === playerId; })
            : null;
        if (player) {
            goal.playerNumber    = player.number;
            goal.isGoalkeeper    = player.isGoalkeeper || false;
            attempt.playerId     = playerId;
            attempt.playerNumber = player.number;
        }
    } else {
        // Same shape as regular opponent goals: no team, no player
        goal.isOpponent = true;
    }

    const next = Object.assign({}, _pen.attempts);
    next[id] = attempt;

    const updates = {};
    updates['penaltyAttempts/' + matchId + '/' + id] = attempt;
    updates['goals/' + goalKey] = goal;
    _penCommit(next, updates);
}

// Optimistic local update + one atomic multi-path write (attempt + goal + scores)
function _penCommit(nextAttempts, updates) {
    const score = penCountGoals(nextAttempts);
    updates['matches/' + matchId + '/penaltyScore1'] = score[1];
    updates['matches/' + matchId + '/penaltyScore2'] = score[2];

    _pen.attempts = nextAttempts;
    const match = _penMatch();
    if (match) { match.penaltyScore1 = score[1]; match.penaltyScore2 = score[2]; }
    penRender();

    database.ref().update(updates).catch(function(err) {
        console.error('Penalty save error:', err);
        showToast('❌ Ошибка сохранения пенальти');
    });
}

// ----------------------------------------
// END MATCH — second endMatch() call while status === 'penalties'
// ----------------------------------------
function penRequestEnd() {
    const match = _penMatch();
    if (!match) return;
    const attempts = _pen.attempts || {};
    const count    = Object.keys(attempts).length;

    // Nothing recorded → treat «Да» as a mistake: end as a normal draw, no shootout on record
    if (count === 0) {
        if (!confirm('Не записано ни одной попытки.\nЗакончить матч без серии пенальти? Он будет сохранён как ничья.')) return;
        const cleanup = {};
        cleanup['penaltyAttempts/' + matchId] = null;
        database.ref().update(cleanup);
        _finalizeEndMatch({ penaltyFormat: null, penaltyScore1: null, penaltyScore2: null });
        return;
    }

    const sets  = penBuildSets(attempts, match.penaltyFormat);
    const score = penCountGoals(attempts);
    if (!penIsDecided(sets)) {
        const msg = score[1] === score[2]
            ? 'Серия пенальти не завершена, счёт равный (' + score[1] + ':' + score[2] + ').\nМатч будет засчитан как ничья. Закончить матч?'
            : 'Серия пенальти не завершена (счёт ' + score[1] + ':' + score[2] + ').\nЗакончить матч с этим счётом?';
        if (!confirm(msg)) return;
    }
    _finalizeEndMatch({ penaltyScore1: score[1], penaltyScore2: score[2] });
}
