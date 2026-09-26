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
//    → возвращает stop() — отписывает оба слушателя (вызывать при status 'ended')
// ════════════════════════════════════════════════════════════════

// ── Можно ли показывать карточку гола ──
// Никаких карточек после окончания матча и для голов, добавленных задним числом
// (retroactive: true — saveRetroGoal в goal-tracking.js). Иначе ретро-гол
// выводит карточку поверх статистики / заставки «Матч окончен».
function wsGoalCardAllowed(matchData, goal) {
    if (!matchData) return false;
    if (matchData.status === 'ended') return false;
    if (goal && goal.retroactive) return false;
    return true;
}

function wsInitGoalListener({ matchId, notifEl, timeouts, getMatchData, onOppGoal }) {
    if (!matchId || !notifEl) return function() {};

    let stopped = false;
    const goalsQuery = database.ref('goals').orderByChild('matchId').equalTo(matchId);
    const score2Ref  = database.ref('matches/' + matchId + '/score2');
    let onGoalAdded  = null;

    // ── 1. Home/own goals через /goals ──
    goalsQuery.once('value', function(snap) {
        if (stopped) return;  // stop() вызван до завершения начальной загрузки
        const existingKeys = {};
        snap.forEach(function(c) { existingKeys[c.key] = true; });

        onGoalAdded = function(snap) {
            if (existingKeys[snap.key]) return;  // пропускаем существующие при загрузке
            const goal = snap.val();
            if (!goal) return;
            wsHandleGoal(goal, notifEl, timeouts, getMatchData);
        };
        goalsQuery.on('child_added', onGoalAdded);
    });

    // ── 2. Opponent goals через score2 ──
    let prevScore2 = null;
    function onScore2(snap) {
        const newScore = snap.val() || 0;
        if (prevScore2 !== null && newScore > prevScore2) {
            const matchData = getMatchData();
            if (wsGoalCardAllowed(matchData)) {
                if (onOppGoal) {
                    onOppGoal(matchData);
                } else {
                    wsShowOppGoalCard(matchData, notifEl, timeouts);
                }
            }
        }
        prevScore2 = newScore;
    }
    score2Ref.on('value', onScore2);

    // ── stop(): отписка от Firebase — экономия трафика после окончания матча ──
    return function stop() {
        if (stopped) return;
        stopped = true;
        if (onGoalAdded) goalsQuery.off('child_added', onGoalAdded);
        score2Ref.off('value', onScore2);
        console.log('[wsGoalListener] stopped — match ended, listeners detached');
    };
}

// ── Обрабатывает гол из /goals ──
function wsHandleGoal(goal, notifEl, timeouts, getMatchData, durationMs, onHide) {
    const matchData = getMatchData();
    if (!wsGoalCardAllowed(matchData, goal)) return;

    // Opponent goals are handled entirely by the score2-change listener below
    // (wsInitGoalListener, section 2) — it has the team color/logo needed for
    // the opponent-style card. If we don't bail here, this generic /goals
    // listener fires first (since the opponent goal record itself lands in
    // /goals too) and briefly renders it as a home-team card with no player
    // (playerId is null for opponent goals) → "Гол! НЕИЗВЕСТНЫЙ" flashes
    // before the correct opponent card replaces it a moment later.
    if (goal.isOpponent) return;

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
    // Повторная проверка: игроки подгружаются асинхронно — матч мог закончиться за это время
    if (!wsGoalCardAllowed(matchData, goal)) return;
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
    if (!wsGoalCardAllowed(matchData, goal)) return;
    const html = wsBuildOwnGoalCard({
        logoSrc:     matchData._t1Logo   || '',
        oppTeamName: matchData.team2Name || 'Соперник',
        minute:      goal ? wsFmtMinute(goal) : ''
    });
    wsShowGoalNotif(notifEl, html, timeouts, durationMs, onHide);
}

// ── Показывает карточку гола соперника ──
function wsShowOppGoalCard(matchData, notifEl, timeouts, useDefaultColor, durationMs, onHide) {
    if (!wsGoalCardAllowed(matchData)) return;
    const html = wsBuildOppGoalCard({
        logoSrc:         matchData._t2Logo   || '',
        teamName:        matchData.team2Name || 'Соперник',
        teamColor:       matchData._t2Color  || '#4A90E2',
        minute:          '',
        useDefaultColor: useDefaultColor || false
    });
    wsShowGoalNotif(notifEl, html, timeouts, durationMs, onHide);
}
