// ========================================
// GOALKEEPER SAVES — cockpit tracking (default team only)
// ========================================
// Section «🧤 Вратари» between the score / penalty controls and «📍 Отметить момент».
// Not shown on any widget during the match — data is for post-match statistics.
//
// UI:
//   radio list of keepers (roster isGoalkeeper, not absent/deleted) + save count each
//   − [count of the selected keeper] +
//   + → push a save for the selected keeper
//   − → remove the selected keeper's latest save (no confirm — low stakes)
//
// Visibility: every cockpit status (like goals) PLUS 'penalties'.
//   scheduled / waiting  → keeper can be selected, +/− disabled
//   playing / halfN_ended → half + matchTime recorded (same logic as goals)
//   penalties            → isPenalty: true  (shootout saves are tracked manually —
//                          a miss in /penaltyAttempts isn't necessarily a save)
//   ended                → retroactive: true, no half / matchTime
//
// Writes:
//   /saves/{saveId}                         matchId, playerId, playerNumber, half?,
//                                           matchTime?, isPenalty?, retroactive?, timestamp
//   /matches/{id}/activeGoalkeeperId        current keeper (survives reload / 2nd device)
//
// Depends on: goal-tracking.js (goalTracking.playersCache, _matchCache,
//   getMatchTimeString), match-management.js (matchId, _matchDataCache, showToast)

const _gk = {
    matchId: null,   // match the listener is bound to
    query:   null,   // /saves query (orderByChild matchId)
    saves:   {}      // live copy: saveId → save
};

function _gkMatch() {
    return (typeof _matchDataCache !== 'undefined' && matchId) ? (_matchDataCache[matchId] || null) : null;
}

function _gkEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _gkKeepers() {
    const cache = (typeof goalTracking !== 'undefined' && goalTracking.playersCache) || [];
    return cache.filter(function(p) { return p.isGoalkeeper; });
}

// ----------------------------------------
// SECTION VISIBILITY — called from _applyStatusSections (match-management.js)
// ----------------------------------------
function gkApplyStatus(match) {
    const section = document.getElementById('gkSection');
    if (!section) return;
    const visible = !!match;
    section.style.display = visible ? 'block' : 'none';
    if (visible) { _gkAttach(); gkRender(); }
    else gkDetach();
}

function _gkAttach() {
    if (_gk.query && _gk.matchId === matchId) return; // already listening
    gkDetach();
    _gk.matchId = matchId;
    _gk.saves   = {};
    _gk.query   = database.ref('saves').orderByChild('matchId').equalTo(matchId);
    _gk.query.on('value', function(snap) {
        _gk.saves = snap.val() || {};
        gkRender();
    });
}

// Also called from _detachCockpitListeners when leaving the cockpit
function gkDetach() {
    if (_gk.query) _gk.query.off('value');
    _gk.query   = null;
    _gk.matchId = null;
    _gk.saves   = {};
}

// ----------------------------------------
// RENDER
// ----------------------------------------
function _gkCounts() {
    const counts = {};
    Object.keys(_gk.saves).forEach(function(k) {
        const s = _gk.saves[k];
        if (s && s.playerId) counts[s.playerId] = (counts[s.playerId] || 0) + 1;
    });
    return counts;
}

function gkRender() {
    const body  = document.getElementById('gkBody');
    const match = _gkMatch();
    if (!body || !match) return;

    const st      = match.status || 'waiting';
    const started = !(st === 'scheduled' || st === 'waiting');
    const keepers = _gkKeepers().slice();
    const counts  = _gkCounts();

    // Keepers with saves in this match but no longer in the active list
    // (e.g. marked absent later) — still shown so their saves stay visible / removable
    Object.keys(counts).forEach(function(pid) {
        if (keepers.some(function(p) { return p.id === pid; })) return;
        let num = '?';
        Object.keys(_gk.saves).some(function(k) {
            const s = _gk.saves[k];
            if (s.playerId === pid && s.playerNumber != null) { num = s.playerNumber; return true; }
            return false;
        });
        keepers.push({ id: pid, number: num, firstName: '', lastName: '', _gone: true });
    });

    if (keepers.length === 0) {
        body.innerHTML = '<div class="gk-empty">Нет вратарей в составе.<br>' +
            '<small>Отметьте вратаря (или полевого игрока на эту игру) в разделе «Состав».</small></div>';
        return;
    }

    // Exactly one keeper and nobody selected → select him (not for finished matches)
    let activeId = match.activeGoalkeeperId || null;
    if (!activeId && keepers.length === 1 && st !== 'ended') {
        activeId = keepers[0].id;
        gkSelect(activeId);
        return; // gkSelect re-renders
    }

    let html = '<div class="gk-list">';
    keepers.forEach(function(p) {
        const isActive = p.id === activeId;
        const name = (_gkEsc(p.lastName) + ' ' + _gkEsc(p.firstName)).trim() || 'Игрок';
        html += '<label class="gk-row' + (isActive ? ' active' : '') + '">' +
                    '<input type="radio" name="gkActive" value="' + _gkEsc(p.id) + '"' +
                        (isActive ? ' checked' : '') + ' onchange="gkSelect(this.value)">' +
                    '<span class="gk-num">#' + _gkEsc(p.number) + '</span>' +
                    '<span class="gk-name">' + name + '</span>' +
                    '<span class="gk-count">' + (counts[p.id] || 0) + '</span>' +
                '</label>';
    });
    html += '</div>';

    const activeCount = activeId ? (counts[activeId] || 0) : 0;
    const plusOff  = !started || !activeId;
    const minusOff = !started || !activeId || activeCount === 0;
    html += '<div class="score-buttons gk-buttons">' +
                '<button class="button" onclick="gkRemoveSave()"' + (minusOff ? ' disabled' : '') + '>−</button>' +
                '<span class="score-display">' + activeCount + '</span>' +
                '<button class="button" onclick="gkAddSave()"' + (plusOff ? ' disabled' : '') + '>+</button>' +
            '</div>';

    let hint;
    if (!started)                 hint = 'Выберите вратаря. Кнопки станут активны после начала матча.';
    else if (!activeId)           hint = 'Выберите вратаря, чтобы отмечать сейвы.';
    else if (st === 'penalties')  hint = 'Серия пенальти — сейвы отмечаются как пенальти.';
    else if (st === 'ended')      hint = 'Матч окончен — сейвы добавляются без времени.';
    else                          hint = 'Сейвы не показываются в трансляции.';
    html += '<div class="gk-hint">' + hint + '</div>';

    body.innerHTML = html;
}

// ----------------------------------------
// ACTIONS
// ----------------------------------------
function gkSelect(playerId) {
    const match = _gkMatch();
    if (!match || !playerId) return;
    match.activeGoalkeeperId = playerId;
    gkRender();
    database.ref('matches/' + matchId).update({ activeGoalkeeperId: playerId })
        .catch(function(err) { console.error('activeGoalkeeperId save error:', err); showToast('❌ Ошибка сохранения'); });
}

function gkAddSave() {
    const match = _gkMatch();
    if (!match) return;
    const st = match.status || 'waiting';
    if (st === 'scheduled' || st === 'waiting') { showToast('Матч ещё не начался'); return; }
    const pid = match.activeGoalkeeperId;
    if (!pid) { showToast('Выберите вратаря'); return; }

    const player = (goalTracking.playersCache || []).find(function(p) { return p.id === pid; });
    const save = { matchId: matchId, playerId: pid, timestamp: Date.now() };
    if (player && typeof player.number === 'number') save.playerNumber = player.number;

    let ready;
    if (st === 'ended') {
        save.retroactive = true;
        ready = Promise.resolve();
    } else if (st === 'penalties') {
        save.isPenalty = true;
        ready = Promise.resolve();
    } else {
        save.half = match.currentHalf || 0;
        ready = getMatchTimeString().then(function(t) { save.matchTime = t; });
    }

    ready.then(function() {
        return database.ref('saves').push(save);
    }).then(function() {
        showToast('🧤 Сейв!');
    }).catch(function(err) {
        console.error('Save error:', err);
        showToast('❌ Ошибка сохранения сейва');
    });
}

// Removes the selected keeper's most recent save in this match
function gkRemoveSave() {
    const match = _gkMatch();
    if (!match || !match.activeGoalkeeperId) return;
    const pid = match.activeGoalkeeperId;
    let lastKey = null, lastTs = -1;
    Object.keys(_gk.saves).forEach(function(k) {
        const s = _gk.saves[k];
        if (s && s.playerId === pid && (s.timestamp || 0) >= lastTs) { lastTs = s.timestamp || 0; lastKey = k; }
    });
    if (!lastKey) return;
    database.ref('saves/' + lastKey).remove()
        .catch(function(err) { console.error('Save remove error:', err); showToast('❌ Ошибка удаления'); });
}
