// ════════════════════════════════════════════════════════════════
//  WIDGET GOAL LISTENER
//  Общая логика подписки на голы Firebase и показа карточек.
//  Используется в broadcast-widget и vertical-widget.
//
//  Зависимости: database, widget-shared.js (wsPlayersCache,
//    wsBuildHomeGoalCard, wsBuildOwnGoalCard, wsBuildOppGoalCard,
//    wsFmtMinute, wsShowGoalNotif)
//
//  Использование:
//    wsInitGoalListener({
//      matchId,
//      notifEl,        — DOM-элемент куда рендерится карточка
//      timeouts,       — объект {show:null, hide:null}
//      getMatchData,   — функция () → matchData (актуальные данные)
//      onOppGoal,      — опционально, callback при голе соперника
//    });
// ════════════════════════════════════════════════════════════════

function wsInitGoalListener({ matchId, notifEl, timeouts, getMatchData, onOppGoal }) {
    if (!matchId || !notifEl) return;

    // ── 1. Home/own goals через /goals ──
    database.ref('goals').orderByChild('matchId').equalTo(matchId)
    .once('value', function(snap) {
        const existingKeys = {};
        snap.forEach(function(c) { existingKeys[c.key] = true; });

        database.ref('goals').orderByChild('matchId').equalTo(matchId)
        .on('child_added', function(snap) {
            if (existingKeys[snap.key]) return;  // пропускаем существующие при загрузке
            const goal = snap.val();
            if (!goal) return;
            wsHandleGoal(goal, notifEl, timeouts, getMatchData);
        });
    });

    // ── 2. Opponent goals через score2 ──
    let prevScore2 = null;
    database.ref('matches/' + matchId + '/score2').on('value', function(snap) {
        const newScore = snap.val() || 0;
        if (prevScore2 !== null && newScore > prevScore2) {
            const matchData = getMatchData();
            if (matchData) {
                if (onOppGoal) {
                    onOppGoal(matchData);
                } else {
                    wsShowOppGoalCard(matchData, notifEl, timeouts);
                }
            }
        }
        prevScore2 = newScore;
    });
}

// ── Обрабатывает гол из /goals ──
function wsHandleGoal(goal, notifEl, timeouts, getMatchData, durationMs, onHide) {
    const matchData = getMatchData();
    if (!matchData) return;

    if (goal.isOwnGoal) {
        wsShowOwnGoalCard(matchData, notifEl, timeouts, goal, durationMs, onHide);
        return;
    }

    const needed = [];
    if (goal.playerId && !wsPlayersCache[goal.playerId]) needed.push(goal.playerId);
    if (goal.assists) {
        goal.assists.forEach(function(a) {
            if (a.playerId && !wsPlayersCache[a.playerId]) needed.push(a.playerId);
        });
    }

    Promise.all(needed.map(function(pid) {
        return database.ref('players/' + pid).once('value').then(function(s) {
            if (s.val()) wsPlayersCache[pid] = s.val();
        });
    })).then(function() {
        wsShowHomeGoalCard(goal, matchData, notifEl, timeouts, durationMs, onHide);
    });
}

// ── Показывает карточку гола основной команды ──
function wsShowHomeGoalCard(goal, matchData, notifEl, timeouts, durationMs, onHide) {
    const player    = goal.playerId ? (wsPlayersCache[goal.playerId] || null) : null;
    const photoSrc  = player ? (player.photo || '') : '';
    const number    = player ? (player.number || goal.playerNumber || '?') : (goal.playerNumber || '?');
    const firstName = player ? (player.firstName || '') : '';
    const lastName  = player ? (player.lastName  || '') : (goal.playerName || 'НЕИЗВЕСТНЫЙ');
    const minute    = wsFmtMinute(goal);

    const assists = [];
    if (goal.assists && goal.assists.length > 0) {
        goal.assists.forEach(function(a) {
            const ap = a.playerId ? wsPlayersCache[a.playerId] : null;
            assists.push({
                firstName: ap ? (ap.firstName || '') : '',
                lastName:  ap ? (ap.lastName  || '') : '',
                number:    ap ? (ap.number || a.playerNumber || '?') : (a.playerNumber || '?')
            });
        });
    }

    const html = wsBuildHomeGoalCard({
        photoSrc,
        logoSrc:  matchData._t1Logo  || '',
        number, firstName, lastName, minute, assists,
        teamName: matchData.team1Name || ''
    });
    wsShowGoalNotif(notifEl, html, timeouts, durationMs, onHide);
}

// ── Показывает карточку автогола ──
function wsShowOwnGoalCard(matchData, notifEl, timeouts, goal, durationMs, onHide) {
    const html = wsBuildOwnGoalCard({
        logoSrc:     matchData._t1Logo   || '',
        oppTeamName: matchData.team2Name || 'Соперник',
        minute:      goal ? wsFmtMinute(goal) : ''
    });
    wsShowGoalNotif(notifEl, html, timeouts, durationMs, onHide);
}

// ── Показывает карточку гола соперника ──
function wsShowOppGoalCard(matchData, notifEl, timeouts, useDefaultColor, durationMs, onHide) {
    const html = wsBuildOppGoalCard({
        logoSrc:         matchData._t2Logo   || '',
        teamName:        matchData.team2Name || 'Соперник',
        teamColor:       matchData._t2Color  || '#4A90E2',
        minute:          '',
        useDefaultColor: useDefaultColor || false
    });
    wsShowGoalNotif(notifEl, html, timeouts, durationMs, onHide);
}
