// ════════════════════════════════════════════════════════════════
//  ROSTER — 📊 АНАЛИТИКА tab (S20)
//  Team statistics for a date period: W/D/L, goals for/against,
//  ⚽ Голы · 👟 Пасы · 🧤 Сейвы per player. The whole squad is listed —
//  players without the current stat appear greyed below the ranked ones
//  (saves tab: goalkeepers only).
//
//  Period: «С» / «По» date inputs + quick buttons, current month by default.
//  A match counts when status === 'ended' and its date (matchDate, else the
//  day of scheduledTime) is inside the period. All championships + friendlies.
//
//  Depends on: team-stats.js (tsLoadMatchData, tsAggregate, tsRender,
//    tsIsLoaded, tsPlayerCache), penalty-helpers.js,
//    roster.js (currentDefaultTeam, currentDefaultTeamData, _playersPageCache, allPlayers)
// ════════════════════════════════════════════════════════════════

let _raMatches = null;     // all matches — loaded once per page load
let _raFrom = null, _raTo = null;   // 'YYYY-MM-DD' inclusive

function _raPad(n) { return String(n).padStart(2, '0'); }
function _raYmd(d) { return d.getFullYear() + '-' + _raPad(d.getMonth() + 1) + '-' + _raPad(d.getDate()); }

function _raPresetRange(preset) {
    const now = new Date();
    if (preset === 'prevMonth') {
        return [_raYmd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
                _raYmd(new Date(now.getFullYear(), now.getMonth(), 0))];
    }
    if (preset === 'year') {
        return [now.getFullYear() + '-01-01', now.getFullYear() + '-12-31'];
    }
    // 'month' (default)
    return [_raYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
            _raYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
}

// Match day as 'YYYY-MM-DD' — matchDate first, else the local day of scheduledTime
function _raMatchDay(m) {
    if (m.matchDate) return m.matchDate;
    if (m.scheduledTime) return _raYmd(new Date(m.scheduledTime));
    return null;
}

// Called by switchRosterTab('analytics')
function raOpen() {
    if (!_raFrom) {
        const r = _raPresetRange('month');
        _raFrom = r[0]; _raTo = r[1];
    }
    document.getElementById('raFrom').value = _raFrom;
    document.getElementById('raTo').value   = _raTo;
    _raHighlightPreset();

    if (_raMatches) { raRefresh(); return; }
    document.getElementById('raStatsBody').innerHTML = _raMsg('Загрузка...');
    firebase.database().ref('matches').once('value').then(function(snap) {
        _raMatches = [];
        snap.forEach(function(child) { const m = child.val(); m.id = child.key; _raMatches.push(m); });
        raRefresh();
    }).catch(function(err) {
        document.getElementById('raStatsBody').innerHTML = _raMsg('Ошибка загрузки: ' + err.message, true);
    });
}

function raPreset(preset) {
    const r = _raPresetRange(preset);
    _raFrom = r[0]; _raTo = r[1];
    document.getElementById('raFrom').value = _raFrom;
    document.getElementById('raTo').value   = _raTo;
    _raHighlightPreset();
    raRefresh();
}

// Date inputs changed
function raDatesChanged() {
    const f = document.getElementById('raFrom').value;
    const t = document.getElementById('raTo').value;
    if (!f || !t) return;
    // Swapped dates → swap back, so the period is never empty by mistake
    if (f > t) { _raFrom = t; _raTo = f; document.getElementById('raFrom').value = t; document.getElementById('raTo').value = f; }
    else       { _raFrom = f; _raTo = t; }
    _raHighlightPreset();
    raRefresh();
}

function _raHighlightPreset() {
    ['month', 'prevMonth', 'year'].forEach(function(p) {
        const b = document.getElementById('raPreset_' + p);
        if (!b) return;
        const r = _raPresetRange(p);
        b.classList.toggle('active', r[0] === _raFrom && r[1] === _raTo);
    });
}

function _raMsg(text, isError) {
    return '<div style="text-align:center;color:' + (isError ? '#ef4444' : '#94a3b8') + ';padding:32px 0;font-size:14px;">' + text + '</div>';
}

function raRefresh() {
    const body = document.getElementById('raStatsBody');
    const sub  = document.getElementById('raSubtitle');
    if (!_raMatches) return;
    if (!currentDefaultTeam) {
        body.innerHTML = _raMsg('Выберите команду по умолчанию во вкладке «Состав».');
        if (sub) sub.textContent = '';
        return;
    }

    const from = _raFrom, to = _raTo;
    const matches = _raMatches.filter(function(m) {
        const d = _raMatchDay(m);
        return m.status === 'ended' && d && d >= from && d <= to;
    });
    if (sub) sub.textContent = 'Сыграно матчей: ' + matches.length;

    // Squad = current roster (non-deleted). Prefill the shared name cache from it —
    // fresh names/numbers after roster edits, and no extra reads for these players.
    const squad = (_playersPageCache[currentDefaultTeam] || allPlayers || []).filter(function(p) { return !p.isDeleted; });
    squad.forEach(function(p) {
        tsPlayerCache[p.id] = { firstName: p.firstName || '', lastName: p.lastName || '',
                                number: p.number, isGoalkeeper: !!p.isGoalkeeper, isDeleted: false };
    });

    if (!tsIsLoaded(matches)) body.innerHTML = _raMsg('Загрузка...');
    const teamName = (currentDefaultTeamData && currentDefaultTeamData.name) || 'Наша команда';
    const token = from + '|' + to;   // ignore results of an outdated period
    tsLoadMatchData(matches).then(function(d) {
        if (token !== _raFrom + '|' + _raTo) return;
        const agg = tsAggregate(matches, d.goals, d.saves, currentDefaultTeam, teamName);
        return tsRender('raStatsBody', agg, { teamName: teamName, squad: squad, keepMode: true });
    }).catch(function(err) {
        body.innerHTML = _raMsg('Ошибка: ' + err.message, true);
    });
}
