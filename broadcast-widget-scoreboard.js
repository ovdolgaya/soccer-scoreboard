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
//  GOAL CARD BUILDER — новый дизайн по макету Figma
// ════════════════════════════════════════════════════════════════

// Карточка гола основной команды (БАТЭ)
// photoSrc  — base64/url фото игрока (или '' → лого команды)
// logoSrc   — лого команды (fallback если нет фото)
// number    — номер игрока
// firstName, lastName — имя/фамилия
// minute    — строка "64'"
// assists   — массив {name, number} или []
// teamColor — цвет команды для жёлтого разделителя (всегда #e3c600 для своей)
function buildHomeGoalCard({ photoSrc, logoSrc, number, firstName, lastName, minute, assists, teamName }) {
    const imgSrc = photoSrc || logoSrc || '';
    const photoHtml = imgSrc
        ? `<img class="ngc-photo-img" src="${imgSrc}" alt="" onerror="this.style.display='none'">`
        : '';

    const nameHtml = `${firstName ? `<span class="ngc-firstname">${firstName}</span>` : ''}<span class="ngc-lastname">${(lastName||'').toUpperCase()}</span>`;

    let assistsHtml = '';
    if (assists && assists.length > 0) {
        const rows = assists.map(function(a) {
            const fullName = [a.firstName, a.lastName ? a.lastName.toUpperCase() : ''].filter(Boolean).join(' ');
            return `<div class="ngc-assist-row">
                <span class="ngc-assist-name">${fullName || '—'}</span>
                <span class="ngc-assist-num">#${a.number||'?'}</span>
            </div>`;
        }).join('');
        assistsHtml = `<div class="ngc-assists">
            <div class="ngc-assists-title">Ассистенты</div>
            <div class="ngc-assists-list">${rows}</div>
        </div>`;
    }

    return `
        <div class="ngc ngc-home">
            <div class="ngc-photo">
                ${photoHtml}
                <div class="ngc-photo-footer"></div>
                <div class="ngc-num-badge">${number||'?'}</div>
            </div>
            <div class="ngc-sep"></div>
            <div class="ngc-panel">
                <div class="ngc-left">
                    <div class="ngc-goal-row">
                        <span class="ngc-goal-word">Гол!</span>
                        <span class="ngc-minute">${minute||''}</span>
                    </div>
                    <div class="ngc-name">${nameHtml}</div>
                    ${teamName ? `<div class="ngc-club">${teamName}</div>` : ''}
                </div>
                ${assistsHtml}
                <div class="ngc-progress" style="background:linear-gradient(to right,#e3c600,rgba(227,198,0,0.05))"></div>
            </div>
        </div>
    `;
}

// Карточка автогола — стиль карточки БАТЭ (синий градиент),
// но вместо фото — лого команды 1 (БАТЭ), без номера игрока,
// "Автогол" жёлтым, внизу название команды которая совершила автогол.
function buildOwnGoalCard({ logoSrc, oppTeamName, minute }) {
    const logoHtml = logoSrc
        ? `<img class="ngc-photo-img" src="${logoSrc}" alt="" style="object-fit:contain;padding:16px;">`
        : '';

    return `
        <div class="ngc ngc-home">
            <div class="ngc-photo" style="display:flex;align-items:center;justify-content:center;">
                ${logoHtml}
                <div class="ngc-photo-footer"></div>
            </div>
            <div class="ngc-sep"></div>
            <div class="ngc-panel">
                <div class="ngc-left">
                    <div class="ngc-goal-row">
                        <span class="ngc-goal-word">Автогол</span>
                        <span class="ngc-minute">${minute||''}</span>
                    </div>
                    ${oppTeamName ? `<div class="ngc-club" style="font-size:20px;margin-top:6px;color:rgba(226,226,232,0.7);">Автогол команды ${oppTeamName}</div>` : ''}
                </div>
                <div class="ngc-progress" style="background:linear-gradient(to right,#e3c600,rgba(227,198,0,0.05))"></div>
            </div>
        </div>
    `;
}


// teamName  — название команды
// teamColor — цвет команды соперника (разделитель + progress)
// minute    — строка "64'"
// label     — 'Гол!' или 'Автогол'
function buildOppGoalCard({ logoSrc, teamName, teamColor, minute, label }) {
    const logoHtml = logoSrc
        ? `<img src="${logoSrc}" alt="" style="width:80px;height:80px;object-fit:contain;">`
        : `<span style="font-size:48px;">⚽</span>`;

    return `
        <div class="ngc ngc-opp">
            <div class="ngc-opp-logo">
                ${logoHtml}
            </div>
            <div class="ngc-opp-panel" style="background:${teamColor};">
                <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,0) 30%,rgba(0,0,0,0.45) 100%);pointer-events:none;"></div>
                <div style="position:relative;z-index:1;">
                    <div class="ngc-goal-row">
                        <span class="ngc-opp-goal-word">${label||'Гол!'}</span>
                        <span class="ngc-opp-minute">${minute||''}</span>
                    </div>
                    <div class="ngc-opp-name">${(teamName||'Соперник').toUpperCase()}</div>
                </div>
                <div class="ngc-progress" style="background:linear-gradient(to right,rgba(255,255,255,0.5),rgba(255,255,255,0.03))"></div>
            </div>
        </div>
    `;
}

// Форматирует время матча в строку "5'" 
// matchTime хранится как "MM:SS" (например "05:19") → показываем только минуты
function _fmtMinute(goal) {
    if (!goal.matchTime) return '';
    const parts = (goal.matchTime || '').split(':');
    if (parts.length >= 1) {
        const minutes = parseInt(parts[0] || 0, 10);
        return minutes + `'`;
    }
    return '';
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
    const teamColor  = bwMatchData ? (bwMatchData._t1Color || '#08399A') : '#08399A';
    const teamLogo   = bwMatchData ? (bwMatchData._t1Logo  || '') : '';
    const teamName   = bwMatchData ? (bwMatchData.team1Name || '') : '';
    const photoSrc   = player ? (player.photo || '') : '';
    const number     = player ? (player.number || goal.playerNumber || '?') : (goal.playerNumber || '?');
    const firstName  = player ? (player.firstName || '') : '';
    const lastName   = player ? (player.lastName  || '') : 'НЕИЗВЕСТНЫЙ';
    const minute     = _fmtMinute(goal);

    const assists = [];
    if (goal.assists && goal.assists.length > 0) {
        goal.assists.forEach(function(a) {
            const ap = a.playerId ? bwPlayersCache[a.playerId] : null;
            assists.push({
                firstName: ap ? (ap.firstName || '') : '',
                lastName:  ap ? (ap.lastName  || '') : '',
                number:    ap ? (ap.number || a.playerNumber || '?') : (a.playerNumber || '?')
            });
        });
    }

    const html = buildHomeGoalCard({ photoSrc, logoSrc: teamLogo, number, firstName, lastName, minute, assists, teamName });
    renderNotification(html, teamColor);
}

function showOpponentGoalCard(matchData) {
    const t2Id      = matchData.team2Id;
    const cached    = t2Id ? (bwTeamsCache[t2Id] || {}) : {};
    const teamColor = matchData._t2Color || cached.color || '#4A90E2';
    const teamLogo  = matchData._t2Logo  || cached.logo  || '';
    const teamName  = matchData.team2Name || 'Соперник';

    // minute not available for opponent goals — no goal record
    const html = buildOppGoalCard({ logoSrc: teamLogo, teamName, teamColor, minute: '', label: 'Гол!' });
    renderNotification(html, teamColor);
}

function showOwnGoalCard() {
    const teamColor = bwMatchData ? (bwMatchData._t1Color || '#08399A') : '#08399A';
    const teamLogo  = bwMatchData ? (bwMatchData._t1Logo  || '') : '';
    const oppName   = bwMatchData ? (bwMatchData.team2Name || 'Соперник') : 'Соперник';

    const html = buildOwnGoalCard({ logoSrc: teamLogo, oppTeamName: oppName, minute: '' });
    renderNotification(html, teamColor);
}
