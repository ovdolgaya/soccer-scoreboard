// ════════════════════════════════════════════════════════════════
//  TEAM STATS — shared statistics logic (S20)
//  Used by: championships.html (championship stats modal, match stats modal)
//           roster.html (📊 Аналитика tab — stats for a date period)
//
//  Players are aggregated by playerId, never by number: a player who wore
//  different numbers in different matches stays one row. The number shown is
//  the CURRENT roster number; the number stored on a goal/save is a fallback
//  for players whose record can't be read.
//
//  Depends on: firebase (compat SDK), penResultScores() (penalty-helpers.js)
// ════════════════════════════════════════════════════════════════

// firebase.database() rather than the global `database` — works on every page
function _tsDb() { return firebase.database(); }

const tsGoalsCache  = {};   // matchId → { goalKey: goal }
const tsSavesCache  = {};   // matchId → { saveKey: save }
const tsPlayerCache = {};   // playerId → { firstName, lastName, number, isGoalkeeper, isDeleted } (no photo)
const _tsState      = {};   // containerId → { agg, opts, mode }

function tsClearCaches() {
    [tsGoalsCache, tsSavesCache].forEach(function(c) {
        Object.keys(c).forEach(function(k) { delete c[k]; });
    });
}

function _tsEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Fetch-once loaders ───────────────────────────────────────────────────
function tsFetchMatchGoals(mid) {
    if (tsGoalsCache[mid] !== undefined) return Promise.resolve(tsGoalsCache[mid]);
    return _tsDb().ref('goals').orderByChild('matchId').equalTo(mid).once('value').then(function(snap) {
        const data = {};
        snap.forEach(function(child) { const g = child.val(); g._key = child.key; data[child.key] = g; });
        tsGoalsCache[mid] = data;
        return data;
    });
}

function tsFetchMatchSaves(mid) {
    if (tsSavesCache[mid] !== undefined) return Promise.resolve(tsSavesCache[mid]);
    return _tsDb().ref('saves').orderByChild('matchId').equalTo(mid).once('value').then(function(snap) {
        tsSavesCache[mid] = snap.val() || {};
        return tsSavesCache[mid];
    }).catch(function(err) {
        // Saves are optional — never block goal stats (e.g. rules not deployed yet)
        console.warn('saves load failed:', err);
        tsSavesCache[mid] = {};
        return {};
    });
}

function tsFetchPlayer(pid) {
    if (tsPlayerCache[pid]) return Promise.resolve(tsPlayerCache[pid]);
    return _tsDb().ref('players/' + pid).once('value').then(function(snap) {
        const p = snap.val();
        tsPlayerCache[pid] = p ? {
            firstName:    p.firstName || '',
            lastName:     p.lastName  || '',
            number:       p.number,
            isGoalkeeper: !!p.isGoalkeeper,
            isDeleted:    !!p.isDeleted
            // photo intentionally omitted
        } : { missing: true };
        return tsPlayerCache[pid];
    }).catch(function() { tsPlayerCache[pid] = { missing: true }; return tsPlayerCache[pid]; });
}

// Goals + saves for a list of matches → { goals: [...], saves: [...] }
function tsLoadMatchData(matches) {
    const ids = matches.map(function(m) { return m.id; });
    return Promise.all(ids.map(function(mid) {
        return Promise.all([tsFetchMatchGoals(mid), tsFetchMatchSaves(mid)]);
    })).then(function() {
        const goals = [], saves = [];
        ids.forEach(function(mid) {
            Object.values(tsGoalsCache[mid] || {}).forEach(function(g) { goals.push(g); });
            Object.values(tsSavesCache[mid] || {}).forEach(function(sv) { saves.push(sv); });
        });
        return { goals: goals, saves: saves };
    });
}

function tsIsLoaded(matches) {
    return matches.every(function(m) { return tsGoalsCache[m.id] !== undefined && tsSavesCache[m.id] !== undefined; });
}

// ── Aggregation ──────────────────────────────────────────────────────────
// Our side: team id first, then team name, then team 1
function tsOurSide(m, teamId, teamName) {
    if (teamId) {
        if (m.team1Id === teamId) return 1;
        if (m.team2Id === teamId) return 2;
    }
    const def = (teamName || '').trim().toLowerCase();
    const t1  = (m.team1Name || '').trim().toLowerCase();
    const t2  = (m.team2Name || '').trim().toLowerCase();
    return (def && t2 === def && t1 !== def) ? 2 : 1;
}

// matches: all matches in scope (W/D/L uses only 'ended' ones)
// goals / saves: records for those matches
function tsAggregate(matches, goals, saves, teamId, teamName) {
    const agg = { total: matches.length, played: 0, won: 0, draw: 0, lost: 0,
                  goalsFor: 0, goalsAgainst: 0, ownGoals: 0, players: {} };

    matches.filter(function(m) { return m.status === 'ended'; }).forEach(function(m) {
        const side = tsOurSide(m, teamId, teamName);
        const our = side === 1 ? (m.score1 || 0) : (m.score2 || 0);
        const opp = side === 1 ? (m.score2 || 0) : (m.score1 || 0);
        // Goals for/against — regulation score only (shootout goals aren't match goals)
        agg.goalsFor += our; agg.goalsAgainst += opp; agg.played++;
        // W/D/L — shootout-decided matches compare penalty scores
        const res = penResultScores(m, side);
        if (res.our > res.opp) agg.won++; else if (res.our < res.opp) agg.lost++; else agg.draw++;
    });

    function row(pid, num) {
        if (!agg.players[pid]) agg.players[pid] = { playerId: pid, number: num != null ? num : '?', goals: 0, assists: 0, saves: 0 };
        return agg.players[pid];
    }
    goals.forEach(function(g) {
        if (g.isOwnGoal) { agg.ownGoals++; return; }
        if (!g.playerId) return;               // opponent goals have no player
        row(g.playerId, g.playerNumber).goals++;
        (g.assists || []).forEach(function(a) { if (a.playerId) row(a.playerId, a.playerNumber).assists++; });
    });
    saves.forEach(function(sv) { if (sv.playerId) row(sv.playerId, sv.playerNumber).saves++; });
    return agg;
}

// ── Rendering ────────────────────────────────────────────────────────────
// opts: {
//   teamName: string            — label under «Забито»
//   squad:   [{ id, number, firstName, lastName, isGoalkeeper, isAbsent }] | null
//            — when given, squad members without the current stat are listed
//              below the ranked players (saves tab: goalkeepers only)
//   keepMode: bool              — keep the selected ⚽/👟/🧤 tab on re-render
// }
function tsRender(containerId, agg, opts) {
    opts = opts || {};
    const pids = Object.keys(agg.players);
    return Promise.all(pids.map(tsFetchPlayer)).then(function() {
        pids.forEach(function(pid) {
            const p = tsPlayerCache[pid], s = agg.players[pid];
            if (p && !p.missing) {
                s.firstName = p.firstName; s.lastName = p.lastName;
                if (p.number != null) s.number = p.number;      // current roster number
                s.isDeleted = p.isDeleted;
            }
        });
        // keepMode: stay on the same tab when the data is re-rendered (roster period change)
        const prev = _tsState[containerId];
        _tsState[containerId] = { agg: agg, opts: opts, mode: (opts.keepMode && prev) ? prev.mode : 'goals' };
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = _tsSummaryHTML(agg, opts) + _tsToggleHTML(containerId) +
                               '<div id="' + containerId + '_table"></div>';
        _tsRenderTable(containerId);
    });
}

function tsSetMode(containerId, mode) {
    if (!_tsState[containerId]) return;
    _tsState[containerId].mode = mode;
    _tsRenderTable(containerId);
}

function _tsSummaryHTML(agg, opts) {
    const played = agg.played;
    const pct = played > 0 ? Math.round(agg.won / played * 100) : 0;
    let html = `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Результаты матчей</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
        <div style="background:#f0fdf4;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#16a34a;">${agg.won}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Победы</div>
        </div>
        <div style="background:#fefce8;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#ca8a04;">${agg.draw}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Ничьи</div>
        </div>
        <div style="background:#fef2f2;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#dc2626;">${agg.lost}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Поражения</div>
        </div>
      </div>`;
    if (played > 0) {
        const wonW  = Math.round(agg.won  / played * 100);
        const drawW = Math.round(agg.draw / played * 100);
        const lostW = 100 - wonW - drawW;
        html += `
      <div style="border-radius:8px;overflow:hidden;height:8px;display:flex;margin-bottom:4px;">
        <div style="background:#16a34a;width:${wonW}%;"></div>
        <div style="background:#ca8a04;width:${drawW}%;"></div>
        <div style="background:#dc2626;width:${lostW}%;"></div>
      </div>
      <div style="font-size:11px;color:#94a3b8;text-align:right;">${pct}% побед</div>`;
    }
    html += `</div>
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;">Голы</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="background:#eff6ff;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#1d4ed8;">${agg.goalsFor}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Забито</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">${_tsEsc(opts.teamName || 'Наша команда')}</div>
        </div>
        <div style="background:#fef2f2;border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:28px;font-weight:900;color:#dc2626;">${agg.goalsAgainst}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px;">Пропущено</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Соперники</div>
        </div>
      </div>
    </div>`;
    return html;
}

function _tsToggleHTML(cid) {
    return '<div style="display:flex;gap:6px;margin-bottom:12px;">' +
        [['goals', '⚽ Голы'], ['assists', '👟 Пасы'], ['saves', '🧤 Сейвы']].map(function(b) {
            return '<button id="' + cid + '_btn_' + b[0] + '" onclick="tsSetMode(\'' + cid + '\',\'' + b[0] + '\')">' + b[1] + '</button>';
        }).join('') + '</div>';
}

function _tsName(s) {
    return s.lastName
        ? ((s.firstName ? s.firstName + ' ' : '') + s.lastName.toUpperCase())
        : ('Игрок #' + s.number);
}

function _tsRenderTable(cid) {
    const st = _tsState[cid];
    if (!st) return;
    const agg = st.agg, mode = st.mode, squad = st.opts.squad || null;
    const players = Object.values(agg.players);

    // Toggle buttons — three equal buttons, primary color for the active one
    const btnBase = 'flex:1;border:none;border-radius:8px;padding:8px 6px;font-size:13px;cursor:pointer;';
    ['goals', 'assists', 'saves'].forEach(function(m) {
        const b = document.getElementById(cid + '_btn_' + m);
        if (b) b.style.cssText = btnBase + (m === mode
            ? 'background:#08399A;color:#fff;font-weight:700;'
            : 'background:#f1f5f9;color:#64748b;font-weight:600;');
    });
    const box = document.getElementById(cid + '_table');
    if (!box) return;

    // «not linked to a player» warning — goals tab only
    let html = '';
    const tracked = players.reduce(function(sum, s) { return sum + s.goals; }, 0) + agg.ownGoals;
    if (mode === 'goals' && tracked > 0 && tracked < agg.goalsFor) {
        const missing = agg.goalsFor - tracked;
        html += '<div style="display:flex;align-items:center;gap:10px;background:#fefce8;border:1px solid #fde68a;' +
                'border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#92400e;">' +
                '<span style="font-size:16px;flex-shrink:0;">⚠️</span><span>Зафиксировано ' + tracked + ' из ' + agg.goalsFor +
                ' голов. ' + missing + ' ' + (missing === 1 ? 'гол не привязан' : missing < 5 ? 'гола не привязаны' : 'голов не привязаны') +
                ' к игроку.</span></div>';
    }

    const ranked = players.filter(function(s) { return s[mode] > 0; })
                          .sort(function(a, b) { return b[mode] - a[mode]; });

    // Squad members with 0 in this stat (saves tab → goalkeepers only)
    const rankedIds = {};
    ranked.forEach(function(s) { rankedIds[s.playerId] = true; });
    const zeros = !squad ? [] : squad
        .filter(function(p) { return !rankedIds[p.id] && (mode !== 'saves' || p.isGoalkeeper); })
        .slice().sort(function(a, b) { return (a.number || 0) - (b.number || 0); });

    if (!ranked.length && !zeros.length && !(mode === 'goals' && agg.ownGoals > 0)) {
        const empty = { goals: 'Голов не зафиксировано', assists: 'Ассистов не зафиксировано', saves: 'Сейвов не зафиксировано' };
        box.innerHTML = html + '<div style="text-align:center;color:#94a3b8;padding:16px 0;font-size:14px;">' + empty[mode] + '</div>';
        return;
    }

    // Dense ranks — tied players share rank and medal
    const maxVal = ranked.length ? ranked[0][mode] : 0;
    let rank = 0, prev = null;
    ranked.forEach(function(s, i) {
        const val = s[mode];
        if (val !== prev) { rank = i + 1; prev = val; }
        const barW  = maxVal > 0 ? Math.round(val / maxVal * 100) : 0;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        html += _tsRow(medal || ('<span style="font-size:12px;color:#94a3b8;">' + rank + '</span>'),
                       s.number, _tsEsc(_tsName(s)) + (s.isDeleted ? ' <span style="font-size:11px;color:#94a3b8;font-weight:500;">удалён</span>' : ''),
                       barW, val, false);
    });

    if (mode === 'goals' && agg.ownGoals > 0) {
        html += `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">
          <div style="width:20px;"></div>
          <div style="background:#e2e8f0;color:#64748b;border-radius:6px;padding:3px 8px;font-size:13px;font-weight:700;flex-shrink:0;width:44px;text-align:center;box-sizing:border-box;">АГ</div>
          <div style="flex:1;font-size:14px;">Автоголы</div>
          <div style="font-size:20px;font-weight:900;">${agg.ownGoals}</div>
        </div>`;
    }

    if (zeros.length) {
        if (ranked.length || agg.ownGoals) {
            html += '<div style="display:flex;align-items:center;gap:10px;margin:14px 0 2px;font-size:11px;font-weight:800;' +
                    'color:#cbd5e1;text-transform:uppercase;letter-spacing:.08em;"><span style="flex:1;height:1px;background:#e2e8f0;"></span></div>';
        }
        zeros.forEach(function(p) { html += _tsRow('', p.number, _tsName(p), 0, 0, true); });
    }
    box.innerHTML = html;
}

function _tsRow(rankHtml, number, nameHtml, barW, val, muted) {
    const c = muted ? '#cbd5e1' : '#08399A';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;${muted ? 'opacity:.75;' : ''}">
      <div style="font-size:16px;width:20px;text-align:center;flex-shrink:0;">${rankHtml}</div>
      <div style="background:${c};color:#fff;border-radius:6px;padding:3px 8px;font-size:13px;font-weight:700;flex-shrink:0;width:44px;text-align:center;box-sizing:border-box;">#${_tsEsc(number)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:600;color:${muted ? '#94a3b8' : '#1e293b'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${muted ? _tsEsc(nameHtml) : nameHtml}</div>
        ${muted ? '' : `<div style="background:#e2e8f0;border-radius:4px;height:4px;margin-top:4px;overflow:hidden;">
          <div style="background:#08399A;width:${barW}%;height:100%;transition:width .4s;"></div></div>`}
      </div>
      <div style="font-size:20px;font-weight:900;color:${c};flex-shrink:0;">${val}</div>
    </div>`;
}
