// ════════════════════════════════════════════════════════════════
//  BROADCAST WIDGET — SCOREBOARD, TIMER, STATS, GOAL CARDS
//  Depends on: bwScoreboard, bwStatsBox, bwGoalNotif,
//              bwMatchData, bwTeamsCache, bwPlayersCache,
//              bwFetchTeamData(), bwSetCssColor(),
//              bwPostGoalAnnouncement(), database, BW_MATCH_ID
// ════════════════════════════════════════════════════════════════

// ── Color helpers ──
function lightenColor(hex, percent) {
    const num = parseInt((hex || '#08399A').replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + (R * 0x10000) + (G * 0x100) + B).toString(16).slice(1);
}

function _applyScoreboardColors(t1Color, t2Color) {
    document.documentElement.style.setProperty('--team1-color', t1Color);
    document.documentElement.style.setProperty('--team1-color-light', lightenColor(t1Color, 10));
    document.documentElement.style.setProperty('--team2-color', t2Color);
    document.documentElement.style.setProperty('--team2-color-light', lightenColor(t2Color, 10));
}

// ════════════════════════════════════════════════════════════════
//  SCOREBOARD
// ════════════════════════════════════════════════════════════════

function getMatchStatus(matchData) {
    if (matchData.scheduledTime && matchData.scheduledTime > Date.now()) return 'scheduled';
    return matchData.status || 'waiting';
}

function getTimerContent(matchData) {
    const status = getMatchStatus(matchData);
    if (status === 'scheduled') {
        const d = new Date(matchData.scheduledTime);
        return `<div class="status-message">Матч начнется ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} в ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</div>`;
    }
    if (status === 'waiting')     return '<div class="status-message">Ожидание начала матча</div>';
    if (status === 'ended')       return '<div class="status-message">МАТЧ ОКОНЧЕН</div>';
    if (status === 'half1_ended') return '<div class="status-message">1 ТАЙМ ОКОНЧЕН</div>';
    if (status === 'half2_ended') return '<div class="status-message">2 ТАЙМ ОКОНЧЕН</div>';
    if (status === 'playing') {
        const halfText = matchData.currentHalf === 1 ? '1 ТАЙМ' : '2 ТАЙМ';
        const initElapsed = Math.max(0, Date.now() - matchData.startTime);
        const initSec = Math.floor(initElapsed / 1000);
        const ih = String(Math.floor(initSec / 3600)).padStart(2, '0');
        const im = String(Math.floor((initSec % 3600) / 60)).padStart(2, '0');
        const is = String(initSec % 60).padStart(2, '0');
        return `<span class="half-indicator">${halfText}:</span><span class="timer" id="timerDisplay">${ih}:${im}:${is}</span>`;
    }
    return '<div class="timer">00:00:00</div>';
}

// Called on data update — fetches team data then renders
function bwRenderScoreboard(matchData) {
    if (!matchData) return;
    const t1Id = matchData.team1Id, t2Id = matchData.team2Id;
    Promise.all([bwFetchTeamData(t1Id), bwFetchTeamData(t2Id)]).then(function(teams) {
        const t1Logo  = (teams[0] && teams[0].logo)  || '';
        const t2Logo  = (teams[1] && teams[1].logo)  || '';
        const t1Color = (teams[0] && teams[0].color) || '#08399A';
        const t2Color = (teams[1] && teams[1].color) || '#4A90E2';
        // Cache on matchData for fast re-renders
        matchData._t1Logo = t1Logo; matchData._t2Logo = t2Logo;
        matchData._t1Color = t1Color; matchData._t2Color = t2Color;
        _applyScoreboardColors(t1Color, t2Color);
        _renderScoreboardHtml(matchData, t1Logo, t2Logo);
    });
}

function _renderScoreboardHtml(matchData, t1Logo, t2Logo) {
    const scoreboardHtml = `
        <div class="score-container">
            <div class="team team1">
                ${t1Logo ? `<img src="${t1Logo}" class="team-logo" alt="">` : ''}
                <div class="team-name">${matchData.team1Name || ''}</div>
            </div>
            <div class="score-card">
                <span class="score-num">${matchData.score1 || 0}</span>
                <div class="score-divider"></div>
                <span class="score-num">${matchData.score2 || 0}</span>
            </div>
            <div class="team team2">
                ${t2Logo ? `<img src="${t2Logo}" class="team-logo" alt="">` : ''}
                <div class="team-name">${matchData.team2Name || ''}</div>
            </div>
        </div>
        <div class="timer-container" id="timerBar">
            ${getTimerContent(matchData)}
        </div>
    `;
    bwScoreboard.innerHTML = scoreboardHtml;
}

function bwStartTimer(matchData) {
    if (bwTimerInterval) { clearInterval(bwTimerInterval); bwTimerInterval = null; }
    if (matchData.status !== 'playing') return;
    bwTimerInterval = setInterval(function() {
        const el = document.getElementById('timerDisplay');
        if (!el) return;
        const elapsed  = Math.max(0, Date.now() - (matchData.startTime || Date.now()));
        const totalSec = Math.floor(elapsed / 1000);
        const h = String(Math.floor(totalSec/3600)).padStart(2,'0');
        const m = String(Math.floor((totalSec%3600)/60)).padStart(2,'0');
        const s = String(totalSec%60).padStart(2,'0');
        el.textContent = h + ':' + m + ':' + s;
    }, 100);
}

// ════════════════════════════════════════════════════════════════
//  GOAL CARD BUILDER
// ════════════════════════════════════════════════════════════════

// Goal card builder — exact copy from widget.html
function buildCardHtml({ teamColor, numberClass, numberContent, numberStyle, label, nameContent, assistLine, hideBall }) {
    const hasAssist = assistLine && assistLine.length > 0;
    const cardHeight = hasAssist ? '76px' : '56px';
    const assistHtml = hasAssist ? `<div class="goal-card-assist">${assistLine}</div>` : '';
    const ballHtml = hideBall ? '' : '<div class="goal-card-ball">⚽</div>';
    const numExtraStyle = numberStyle ? `;${numberStyle}` : '';
    return `
        <div class="goal-card">
            <div class="goal-card-inner" style="height:${cardHeight}">
                <div class="goal-card-number ${numberClass}" style="--goal-team-color:${teamColor}${numExtraStyle}">
                    ${numberContent}
                </div>
                <div class="goal-card-info">
                    <div class="goal-card-label" style="color:${teamColor}">${label}</div>
                    <div class="goal-card-name">${nameContent}</div>
                    ${assistHtml}
                </div>
                ${ballHtml}
                <div class="goal-card-progress" style="background:${teamColor}"></div>
            </div>
        </div>
    `;
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
        const goalLabel = n => n===1?'гол':n<=4?'гола':'голов';
        html += '<div class="bw-cards-grid">';
        scorerList.forEach(function(sc) {
            if (sc.isOwnGoal) {
                html += `<div class="bw-player-card bw-own-goal"><div class="bw-card-accent"></div><div class="bw-player-avatar">⚽</div><div class="bw-player-info"><div class="bw-player-number">АГ</div><div class="bw-player-lastname">Автогол</div></div><div class="bw-goal-count"><div class="bw-goal-count-number">${sc.goals}</div><div class="bw-goal-count-label">${goalLabel(sc.goals)}</div></div></div>`;
                return;
            }
            const p    = sc.playerId ? (bwPlayersCache[sc.playerId]||null) : null;
            const num  = p ? ('#'+p.number) : (sc.playerNumber ? '#'+sc.playerNumber : '?');
            const fn   = p ? (p.firstName||'') : '';
            const ln   = p ? (p.lastName||'').toUpperCase() : 'НЕИЗВЕСТНЫЙ';
            const photo= p ? (p.photo||'') : '';
            const photoHtml = photo
                ? `<div class="bw-player-photo-wrap"><img class="bw-player-photo" src="${photo}" alt="${ln}" onerror="this.style.display='none'"></div>`
                : `<div class="bw-player-avatar">${num}</div>`;
            const assistBadge = sc.assists > 0 ? `<div class="bw-player-assist-badge">👟 ${sc.assists}</div>` : '';
            html += `<div class="bw-player-card"><div class="bw-card-accent"></div>${photoHtml}<div class="bw-player-info"><div class="bw-player-number">${num}</div>${fn?`<div class="bw-player-firstname">${fn}</div>`:''}<div class="bw-player-lastname">${ln}</div>${assistBadge}</div><div class="bw-goal-count"><div class="bw-goal-count-number">${sc.goals}</div><div class="bw-goal-count-label">${goalLabel(sc.goals)}</div></div></div>`;
        });
        html += '</div>';
    }

    html += '</div>';
    return html;
}

// ════════════════════════════════════════════════════════════════
//  GOAL NOTIFICATION CARD
// ════════════════════════════════════════════════════════════════

function renderNotification(cardHtml, teamColor) {
    const el = bwGoalNotif;
    if (bwNotifTimeout)     { clearTimeout(bwNotifTimeout);     bwNotifTimeout     = null; }
    if (bwNotifHideTimeout) { clearTimeout(bwNotifHideTimeout); bwNotifHideTimeout = null; }

    el.style.setProperty('--goal-team-color', teamColor);
    el.classList.remove('bw-notif-visible', 'bw-notif-hiding');
    el.innerHTML = cardHtml;
    void el.offsetHeight;  // force reflow
    el.classList.add('bw-notif-visible');
    bwNotifVisible = true;

    bwNotifTimeout = setTimeout(function() {
        el.classList.remove('bw-notif-visible');
        el.classList.add('bw-notif-hiding');
        bwNotifHideTimeout = setTimeout(function() {
            el.classList.remove('bw-notif-hiding');
            el.innerHTML = '';
            bwNotifVisible = false;
            bwPostGoalAnnouncement();
        }, 600);
    }, 5000);
}

function bwHandleNewGoal(goal) {
    if (goal.isOwnGoal) {
        showOwnGoalCard();
        return;
    }
    const needed = [];
    if (goal.playerId && !bwPlayersCache[goal.playerId]) needed.push(goal.playerId);
    if (goal.assists) goal.assists.forEach(a => { if (a.playerId && !bwPlayersCache[a.playerId]) needed.push(a.playerId); });
    Promise.all(needed.map(pid =>
        database.ref('players/' + pid).once('value').then(s => { if (s.val()) bwPlayersCache[pid] = s.val(); })
    )).then(function() {
        showPlayerGoalCard(goal, goal.playerId ? (bwPlayersCache[goal.playerId]||null) : null);
    });
}

function bwHandleOppGoal() {
    if (!bwMatchData) return;
    showOpponentGoalCard(bwMatchData);
}

function showPlayerGoalCard(goal, player) {
    const teamColor = bwMatchData ? (bwMatchData._t1Color || '#08399A') : '#08399A';
    let numberHtml, nameHtml;
    if (player) {
        numberHtml = `<span>#${player.number || goal.playerNumber || '?'}</span>`;
        nameHtml   = `${player.firstName ? `<span class="first-name">${player.firstName}</span>` : ''}${(player.lastName||'').toUpperCase()}`;
    } else {
        numberHtml = `<span>#${goal.playerNumber || '?'}</span>`;
        nameHtml   = 'НЕИЗВЕСТНЫЙ';
    }
    let assistLine = '';
    if (goal.assists && goal.assists.length > 0) {
        const parts = goal.assists.map(function(a) {
            const ap = a.playerId ? bwPlayersCache[a.playerId] : null;
            return '#' + (ap ? ap.number : (a.playerNumber||'?')) + (ap && ap.lastName ? ' ' + ap.lastName.toUpperCase() : '');
        });
        assistLine = '👟 ' + parts.join(' · ');
    }
    renderNotification(buildCardHtml({ teamColor, numberClass: '', numberContent: numberHtml, label: 'Гол!', nameContent: nameHtml, assistLine }), teamColor);
}

function showOpponentGoalCard(matchData) {
    const t2Id     = matchData.team2Id;
    const cached   = t2Id ? (bwTeamsCache[t2Id] || {}) : {};
    const teamColor = matchData._t2Color || cached.color || '#4A90E2';
    const teamLogo  = matchData._t2Logo  || cached.logo  || '';
    const teamName  = matchData.team2Name || 'Соперник';
    const logoContent = teamLogo
        ? `<img src="${teamLogo}" style="width:100%;height:100%;object-fit:contain;display:block;">`
        : '<span>⚽</span>';
    const numberStyle = teamLogo
        ? `padding:4px;box-shadow:inset 0 0 0 3px ${teamColor};background:#fff;border-radius:20px 0 0 20px;`
        : '';
    renderNotification(buildCardHtml({ teamColor, numberClass: 'opponent', numberContent: logoContent, numberStyle, label: 'Гол!', nameContent: `<span class="opponent-text">${teamName}</span>` }), teamColor);
}

function showOwnGoalCard() {
    // Own goal always scores for team1 — show their logo/color
    const teamColor  = bwMatchData ? (bwMatchData._t1Color || '#08399A') : '#08399A';
    const teamLogo   = bwMatchData ? (bwMatchData._t1Logo  || '') : '';
    const oppName    = bwMatchData ? (bwMatchData.team2Name || 'Соперник') : 'Соперник';
    const logoContent = teamLogo
        ? `<img src="${teamLogo}" style="width:100%;height:100%;object-fit:contain;display:block;">`
        : '<span>⚽</span>';
    const numberStyle = teamLogo
        ? `padding:4px;box-shadow:inset 0 0 0 3px ${teamColor};background:#fff;border-radius:20px 0 0 20px;`
        : '';
    renderNotification(buildCardHtml({ teamColor, numberClass: 'opponent', numberContent: logoContent, numberStyle, label: 'Автогол', nameContent: `<span class="own-goal-text">Автогол ${oppName}</span>` }), teamColor);
}
