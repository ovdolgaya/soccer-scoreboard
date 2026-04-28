// ════════════════════════════════════════════════════════════════
//  BROADCAST WIDGET — SCOREBOARD, TIMER, STATS, GOAL CARDS
//  Depends on: widget-shared.js, widget-goal-listener.js,
//              broadcast-widget.html (bwPlayersCache, bwTeamsCache,
//              bwFetchTeamData, bwScoreboard, bwGoalNotif, bwMatchData)
// ════════════════════════════════════════════════════════════════

// Aliases для shared функций (broadcast сохраняет bw* именование)
function _fmtMinute(goal)            { return wsFmtMinute(goal); }
function buildHomeGoalCard(opts)     { return wsBuildHomeGoalCard(opts); }
function buildOwnGoalCard(opts)      { return wsBuildOwnGoalCard(opts); }
function buildOppGoalCard(opts)      { return wsBuildOppGoalCard(opts); }
function getMatchStatus(matchData)   { return wsGetMatchStatus(matchData); }
function getTimerContent(matchData)  { return wsGetTimerContent(matchData); }

// Timer interval holder для wsStartTimer
const _bwTimerRef = { id: null };

function bwRenderScoreboard(matchData) {
    if (!matchData) return;
    // Fetch teams (uses bwFetchTeamData from HTML which populates bwTeamsCache)
    Promise.all([bwFetchTeamData(matchData.team1Id), bwFetchTeamData(matchData.team2Id)])
    .then(function(teams) {
        const t1 = teams[0] || {}, t2 = teams[1] || {};
        matchData._t1Logo  = t1.logo  || '';
        matchData._t2Logo  = t2.logo  || '';
        matchData._t1Color = t1.color || '#08399A';
        matchData._t2Color = t2.color || '#4A90E2';
        wsApplyTeamColors(matchData._t1Color, matchData._t2Color);

        bwScoreboard.innerHTML = `
            <div class="score-container">
                <div class="team team1">
                    ${t1.logo ? `<img src="${t1.logo}" class="team-logo" alt="">` : ''}
                    <div class="team-name">${matchData.team1Name || ''}</div>
                </div>
                <div class="score-card">
                    <span class="score-num">${matchData.score1 || 0}</span>
                    <div class="score-divider"></div>
                    <span class="score-num">${matchData.score2 || 0}</span>
                </div>
                <div class="team team2">
                    ${t2.logo ? `<img src="${t2.logo}" class="team-logo" alt="">` : ''}
                    <div class="team-name">${matchData.team2Name || ''}</div>
                </div>
            </div>
            <div class="timer-container" id="timerBar">
                ${wsGetTimerContent(matchData)}
            </div>`;
    });
}

function bwStartTimer(matchData) {
    if (bwTimerInterval) { clearInterval(bwTimerInterval); bwTimerInterval = null; }
    wsStartTimer(matchData, _bwTimerRef);
    bwTimerInterval = _bwTimerRef.id;
}

// ── Notification (broadcast uses #bw-goal-notif) ──
const _bwNotifTimeouts = { show: null, hide: null };

function renderNotification(html) {
    wsShowGoalNotif(bwGoalNotif, html, _bwNotifTimeouts, 5000, bwPostGoalAnnouncement);
}

function bwHandleNewGoal(goal) {
    wsHandleGoal(goal, bwGoalNotif, _bwNotifTimeouts, function() { return bwMatchData; }, 5000, bwPostGoalAnnouncement);
}

function bwHandleOppGoal() {
    if (bwMatchData) wsShowOppGoalCard(bwMatchData, bwGoalNotif, _bwNotifTimeouts, false, 5000, bwPostGoalAnnouncement);
}

function showPlayerGoalCard(goal, player) {
    wsShowHomeGoalCard(goal, bwMatchData, bwGoalNotif, _bwNotifTimeouts);
}

function showOpponentGoalCard(matchData) {
    wsShowOppGoalCard(matchData, bwGoalNotif, _bwNotifTimeouts);
}

function showOwnGoalCard() {
    wsShowOwnGoalCard(bwMatchData, bwGoalNotif, _bwNotifTimeouts, null);
}

// ════════════════════════════════════════════════════════════════
//  STATS OVERLAY
// ════════════════════════════════════════════════════════════════

function bwRenderStats(matchData) {
    return new Promise(function(resolve) {
        database.ref('goals').orderByChild('matchId').equalTo(BW_MATCH_ID).once('value')
        .then(function(snap) {
            const goalsData = {};
            snap.forEach(function(child) { goalsData[child.key] = child.val(); });

            const homeGoals = Object.values(goalsData).filter(function(g) {
                return g.playerId || g.isOwnGoal;
            });

            if (homeGoals.length === 0) { resolve(false); return; }

            const needed = [];
            homeGoals.forEach(function(g) {
                if (g.playerId && !bwPlayersCache[g.playerId]) needed.push(g.playerId);
                if (g.assists) g.assists.forEach(function(a) {
                    if (a.playerId && !bwPlayersCache[a.playerId]) needed.push(a.playerId);
                });
            });
            const unique = [...new Set(needed)];
            Promise.all(unique.map(function(pid) {
                return database.ref('players/' + pid).once('value').then(function(s) {
                    if (s.val()) bwPlayersCache[pid] = s.val();
                });
            })).then(function() {
                const t1Id = matchData.team1Id;
                bwFetchTeamData(t1Id).then(function(t1) {
                    const color = (t1 && t1.color) || '#08399A';
                    const logo  = (t1 && t1.logo)  || '';
                    bwSetCssColor(color);
                    bwStatsBox.innerHTML = bwBuildStatsHtml(matchData, homeGoals, logo, color);
                    resolve(true);
                });
            });
        });
    });
}

function bwBuildStatsHtml(matchData, goals, logoUrl, color) {
    const sorted = goals.slice().sort(function(a,b) {
        if ((a.half||0) !== (b.half||0)) return (a.half||0)-(b.half||0);
        return (a.matchTime||'').localeCompare(b.matchTime||'');
    });

    const statusLabels = {
        'playing':     matchData.currentHalf === 1 ? '1-й тайм' : '2-й тайм',
        'half1_ended': 'Перерыв', 'half2_ended': '2-й тайм окончен', 'ended': 'Матч окончен'
    };
    const halfLabel = statusLabels[matchData.status] || '';

    const logoHtml = logoUrl ? `<img class="bw-stats-logo" src="${logoUrl}" alt="">` : '';

    let html = `<div class="bw-stats-header">
        ${logoHtml}
        <div class="bw-stats-title-wrap">
            <div class="bw-stats-team-name">${matchData.team1Name || ''}</div>
            <div class="bw-stats-sub">Статистика голов${halfLabel ? ' · ' + halfLabel : ''}</div>
        </div>
        <div class="bw-stats-score-badge">
            <span class="bw-stats-score-num">${matchData.score1||0}</span>
            <span class="bw-stats-score-sep">:</span>
            <span class="bw-stats-score-opp">${matchData.score2||0}</span>
        </div>
    </div>
    <div class="bw-stats-content">`;

    const useTable = goals.length <= 8;
    if (useTable) {
        html += '<table class="bw-goals-table">';
        let lastHalf = null;
        sorted.forEach(function(g, idx) {
            if ((g.half||0) !== lastHalf) {
                lastHalf = g.half||0;
                const label = lastHalf === 0 ? 'Добавлено вручную' : (lastHalf === 1 ? '1-й тайм' : '2-й тайм');
                html += `<tr class="bw-half-header"><td colspan="5">${label}</td></tr>`;
            }
            const timeStr = g.matchTime || '—';
            let badgeHtml, nameHtml;
            if (g.isOwnGoal) {
                badgeHtml = '<span class="bw-number-badge bw-own-goal-badge">АГ</span>';
                nameHtml  = 'Автогол';
            } else {
                const p   = g.playerId ? (bwPlayersCache[g.playerId]||null) : null;
                const num = p ? p.number : (g.playerNumber||'?');
                const fn  = p ? (p.firstName||'') : '';
                const ln  = p ? (p.lastName||'').toUpperCase() : 'НЕИЗВЕСТНЫЙ';
                badgeHtml = `<span class="bw-number-badge">#${num}</span>`;
                nameHtml  = (fn ? `<span class="bw-first-name">${fn}</span>` : '') + ln;
            }
            let assistHtml = '';
            if (!g.isOwnGoal && g.assists && g.assists.length > 0) {
                const chips = g.assists.map(function(a) {
                    const ap  = a.playerId ? bwPlayersCache[a.playerId] : null;
                    const num = ap ? ap.number : (a.playerNumber||'?');
                    const ln  = ap ? (ap.lastName||'').toUpperCase() : '';
                    return `<span class="bw-assist-chip"><span class="bw-assist-chip-num">#${num}</span>${ln?`<span class="bw-assist-chip-name">${ln}</span>`:''}</span>`;
                }).join('');
                assistHtml = `<span class="bw-assist-icon">👟</span>${chips}`;
            }
            const delay = (idx * 0.05).toFixed(2) + 's';
            html += `<tr class="bw-goal-row" style="animation-delay:${delay}">
                <td class="bw-cell-time">${timeStr}</td>
                <td class="bw-cell-number">${badgeHtml}</td>
                <td class="bw-cell-name">${nameHtml}</td>
                <td></td>
                <td class="bw-cell-assist">${assistHtml}</td>
            </tr>`;
        });
        html += '</table>';
    } else {
        // Aggregate scorers into cards
        const scorers = {};
        goals.forEach(function(g) {
            const key = g.isOwnGoal ? '__og__' : (g.playerId||'__unknown__');
            if (!scorers[key]) scorers[key] = { playerId: g.playerId, isOwnGoal: !!g.isOwnGoal, goals: 0, assists: 0, playerNumber: g.playerNumber };
            scorers[key].goals++;
            if (g.assists) g.assists.forEach(function(a) {
                const ak = a.playerId||'__unknown__';
                if (!scorers[ak]) scorers[ak] = { playerId: a.playerId, isOwnGoal: false, goals: 0, assists: 0, playerNumber: a.playerNumber };
                scorers[ak].assists++;
            });
        });
        const scorerList = Object.values(scorers).filter(s => s.goals > 0).sort((a,b) => b.goals - a.goals);
        const goalLabel   = n => n===1?'гол':n<=4?'гола':'голов';
        const assistLabel = n => n===1?'передача':n<=4?'передачи':'передач';
        html += '<div class="bw-cards-grid">';
        scorerList.forEach(function(sc, idx) {
            const delay = (idx * 0.06).toFixed(2) + 's';

            if (sc.isOwnGoal) {
                // Автогол — лого команды 1 на тёмном фоне (как у игроков), название команды 2
                const team2Name = matchData.team2Name || 'Соперник';
                const ogLogoHtml = logoUrl
                    ? `<div class="bw-player-photo-wrap" style="display:flex;align-items:center;justify-content:center;">
                           <img src="${logoUrl}" alt="" style="width:60px;height:60px;object-fit:contain;position:relative;z-index:1;">
                       </div>`
                    : `<div class="bw-player-avatar">⚽</div>`;
                html += `<div class="bw-player-card bw-own-goal" style="animation-delay:${delay}">
                    ${ogLogoHtml}
                    <div class="bw-card-sep"></div>
                    <div class="bw-player-info">
                        <div class="bw-player-firstname">Автогол команды</div>
                        <div class="bw-player-lastname">${team2Name.toUpperCase()}</div>
                    </div>
                    <div class="bw-goal-count">
                        <div class="bw-goal-count-goals">
                            <div class="bw-goal-count-number">${sc.goals}</div>
                            <div class="bw-goal-count-label">${goalLabel(sc.goals)}</div>
                        </div>
                    </div>
                </div>`;
                return;
            }

            const p     = sc.playerId ? (bwPlayersCache[sc.playerId]||null) : null;
            const num   = p ? p.number : (sc.playerNumber||'?');
            const fn    = p ? (p.firstName||'') : '';
            const ln    = p ? (p.lastName||'').toUpperCase() : 'НЕИЗВЕСТНЫЙ';
            const photo = p ? (p.photo||'') : '';

            const photoBlockHtml = photo
                ? `<div class="bw-player-photo-wrap">
                       <img class="bw-player-photo" src="${photo}" alt="${ln}" onerror="this.style.display='none'">
                       <div class="bw-player-photo-footer"></div>
                       <div class="bw-player-num-badge">${num}</div>
                   </div>`
                : `<div class="bw-player-avatar"><span style="font-size:14px;font-weight:700;">#${num}</span></div>`;

            const assistsHtml = sc.assists > 0
                ? `<div class="bw-goal-count-assists">
                       <div class="bw-goal-count-number bw-assist-num">${sc.assists}</div>
                       <div class="bw-goal-count-label">${assistLabel(sc.assists)}</div>
                   </div>`
                : '';

            html += `<div class="bw-player-card" style="animation-delay:${delay}">
                ${photoBlockHtml}
                <div class="bw-card-sep"></div>
                <div class="bw-player-info">
                    ${fn ? `<div class="bw-player-firstname">${fn}</div>` : ''}
                    <div class="bw-player-lastname">${ln}</div>
                </div>
                <div class="bw-goal-count">
                    <div class="bw-goal-count-goals">
                        <div class="bw-goal-count-number">${sc.goals}</div>
                        <div class="bw-goal-count-label">${goalLabel(sc.goals)}</div>
                    </div>
                    ${assistsHtml}
                </div>
            </div>`;
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}



