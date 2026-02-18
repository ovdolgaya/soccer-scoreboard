// ========================================
// GOAL TRACKING
// ========================================
// Handles the player picker modal (+ button for team 1),
// goal removal modal (− button for team 1),
// and all Firebase read/write for /goals

// ---- State ----
let goalTracking = {
    defaultTeamId: null,    // loaded from settings/defaultTeam
    defaultTeamSide: null,  // 1 or 2 — which side the default team is in this match
    playersCache: []        // active (non-absent) players for the default team
};

// ----------------------------------------
// INIT — called once after a match loads
// ----------------------------------------
function initGoalTracking() {
    // Load the default team from settings
    firebase.database().ref('settings/defaultTeam').once('value')
        .then(function(snap) {
            goalTracking.defaultTeamId = snap.val() || null;
            if (goalTracking.defaultTeamId) {
                loadGoalTrackingPlayers();
            }
        });
}

// Pre-load players so the modal opens instantly
function loadGoalTrackingPlayers() {
    if (!goalTracking.defaultTeamId) return;

    firebase.database().ref('players')
        .orderByChild('teamId')
        .equalTo(goalTracking.defaultTeamId)
        .once('value')
        .then(function(snap) {
            const players = [];
            snap.forEach(function(child) {
                const p = child.val();
                p.id = child.key;
                if (!p.isAbsent && !p.isDeleted) players.push(p);
            });
            players.sort(function(a, b) { return a.number - b.number; });
            goalTracking.playersCache = players;
        });
}

// ----------------------------------------
// CALCULATE MATCH TIME
// ----------------------------------------
function getMatchTimeString() {
    // Returns "MM:SS" based on live match timer, or HH:MM:SS wall clock as fallback
    return firebase.database().ref('matches/' + matchId).once('value')
        .then(function(snap) {
            const match = snap.val();
            if (!match) return getCurrentWallTime();

            if (match.status === 'playing' && match.startTime) {
                const elapsed = Date.now() - match.startTime;
                const totalSeconds = Math.floor(elapsed / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
            }

            return getCurrentWallTime();
        });
}

function getCurrentWallTime() {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' +
           String(now.getMinutes()).padStart(2, '0') + ':' +
           String(now.getSeconds()).padStart(2, '0');
}

// ----------------------------------------
// DETERMINE DEFAULT TEAM SIDE
// ----------------------------------------
// Checks match team names vs default team name to figure out if it's team 1 or 2
function resolveDefaultTeamSide(matchData) {
    if (!goalTracking.defaultTeamId) return null;

    return firebase.database().ref('teams/' + goalTracking.defaultTeamId).once('value')
        .then(function(snap) {
            const team = snap.val();
            if (!team) return null;

            const teamName = (team.name || '').trim().toLowerCase();
            const t1 = (matchData.team1Name || '').trim().toLowerCase();
            const t2 = (matchData.team2Name || '').trim().toLowerCase();

            if (teamName === t1) return 1;
            if (teamName === t2) return 2;
            // Fallback: assume team 1 is the home/default team
            return 1;
        });
}

// ----------------------------------------
// OPEN GOAL SCORER MODAL (+ button team 1)
// ----------------------------------------
function openGoalScorerModal() {
    if (!matchId) return;

    // Populate header info
    firebase.database().ref('matches/' + matchId).once('value').then(function(snap) {
        const match = snap.val();
        if (!match) return;

        // Update modal header time info
        getMatchTimeString().then(function(timeStr) {
            const halfLabel = match.currentHalf === 1 ? '1-й тайм' :
                              match.currentHalf === 2 ? '2-й тайм' : '';
            const info = halfLabel ? halfLabel + ' · ' + timeStr : timeStr;
            const el = document.getElementById('goalModalMatchInfo');
            if (el) el.textContent = info;
        });

        // Render player grid
        renderPlayerGrid();

        // Show modal
        document.getElementById('goalScorerModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    });
}

function closeGoalScorerModal() {
    document.getElementById('goalScorerModal').style.display = 'none';
    document.body.style.overflow = '';
}

// ----------------------------------------
// RENDER PLAYER NUMBER CARDS
// ----------------------------------------
function renderPlayerGrid() {
    const grid = document.getElementById('goalPlayerGrid');
    if (!grid) return;

    if (goalTracking.playersCache.length === 0) {
        // Try reloading in case they weren't ready
        loadGoalTrackingPlayers();
        grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;grid-column:1/-1;">Нет активных игроков.<br><small>Проверьте настройки команды.</small></div>';
        return;
    }

    grid.innerHTML = goalTracking.playersCache.map(function(player) {
        const isGK = player.isGoalkeeper;
        const bg = isGK
            ? 'linear-gradient(135deg,#7c3aed,#4c1d95)'
            : 'linear-gradient(135deg,#1e5fd4,#08399A)';
        const badge = isGK ? '<div style="font-size:9px;opacity:.75;margin-top:2px;">🧤</div>' : '';

        return '<button onclick="confirmGoal(\'' + player.id + '\', false)" ' +
               'style="background:' + bg + ';color:#fff;border:none;border-radius:14px;' +
               'padding:16px 8px;font-size:24px;font-weight:800;cursor:pointer;' +
               'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
               'min-height:72px;transition:transform .1s,box-shadow .1s;' +
               'box-shadow:0 4px 12px rgba(0,0,0,0.15);" ' +
               'onmousedown="this.style.transform=\'scale(.94)\'" ' +
               'onmouseup="this.style.transform=\'scale(1)\'" ' +
               'onmouseleave="this.style.transform=\'scale(1)\'">' +
               '#' + player.number +
               badge +
               '</button>';
    }).join('');
}

// ----------------------------------------
// CONFIRM GOAL — save to Firebase + update score
// ----------------------------------------
function confirmGoal(playerId, isOwnGoal) {
    if (!matchId) return;

    closeGoalScorerModal();

    Promise.all([
        firebase.database().ref('matches/' + matchId).once('value'),
        getMatchTimeString()
    ]).then(function(results) {
        const matchSnap = results[0];
        const timeStr = results[1];
        const match = matchSnap.val();
        if (!match) return;

        // Build goal record
        const goalData = {
            matchId: matchId,
            teamId: goalTracking.defaultTeamId || null,
            playerId: isOwnGoal ? null : (playerId || null),
            isOwnGoal: isOwnGoal || false,
            half: match.currentHalf || 0,
            matchTime: timeStr,          // e.g. "34:12" within the half
            timestamp: Date.now(),       // absolute wall-clock time
            createdAt: Date.now()
        };

        // If it's a real player, also store their number for quick display
        if (!isOwnGoal && playerId) {
            const player = goalTracking.playersCache.find(function(p) { return p.id === playerId; });
            if (player) {
                goalData.playerNumber = player.number;
                goalData.isGoalkeeper = player.isGoalkeeper || false;
            }
        }

        // Save goal, then increment score
        return firebase.database().ref('goals').push(goalData)
            .then(function() {
                // Determine which score side to increment
                return resolveDefaultTeamSide(match);
            })
            .then(function(side) {
                const scoreKey = 'score' + (side || 1);
                const currentScore = match[scoreKey] || 0;
                return firebase.database().ref('matches/' + matchId).update({
                    [scoreKey]: currentScore + 1
                });
            })
            .then(function() {
                showToast('⚽ Гол сохранён!');
            });
    }).catch(function(err) {
        console.error('Goal save error:', err);
        showToast('❌ Ошибка сохранения гола');
    });
}

// ----------------------------------------
// REQUEST GOAL REMOVAL (− button team 1)
// ----------------------------------------
function requestGoalRemoval(team) {
    if (!matchId) return;

    // For team 2: simple decrement, no goal tracking
    if (team === 2) {
        changeScore(2, -1);
        return;
    }

    // For team 1: check current score first
    firebase.database().ref('matches/' + matchId).once('value').then(function(snap) {
        const match = snap.val();
        if (!match) return;

        // Determine side
        return resolveDefaultTeamSide(match).then(function(side) {
            const scoreKey = 'score' + (side || 1);
            const currentScore = match[scoreKey] || 0;

            if (currentScore <= 0) {
                showToast('❌ Счёт уже 0');
                return;
            }

            // Load goals for this match
            return firebase.database().ref('goals')
                .orderByChild('matchId')
                .equalTo(matchId)
                .once('value')
                .then(function(goalsSnap) {
                    const goals = [];
                    goalsSnap.forEach(function(child) {
                        const g = child.val();
                        g._key = child.key;
                        goals.push(g);
                    });

                    // Filter to only goals for the default team
                    const teamGoals = goals
                        .filter(function(g) { return g.teamId === goalTracking.defaultTeamId; })
                        .sort(function(a, b) { return b.timestamp - a.timestamp; }); // newest first

                    if (teamGoals.length === 0) {
                        // No tracked goals — just decrement score silently
                        return changeScore(side || 1, -1);
                    }

                    // Show removal modal
                    renderGoalRemoveList(teamGoals, side || 1, currentScore);
                    document.getElementById('goalRemoveModal').style.display = 'block';
                    document.body.style.overflow = 'hidden';
                });
        });
    }).catch(function(err) {
        console.error('Goal removal error:', err);
        showToast('❌ Ошибка загрузки голов');
    });
}

function closeGoalRemoveModal() {
    document.getElementById('goalRemoveModal').style.display = 'none';
    document.body.style.overflow = '';
}

// ----------------------------------------
// RENDER GOAL REMOVAL LIST
// ----------------------------------------
function renderGoalRemoveList(goals, side, currentScore) {
    const list = document.getElementById('goalRemoveList');
    if (!list) return;

    list.innerHTML = goals.map(function(goal, index) {
        const halfLabel = goal.half === 1 ? '1-й тайм' :
                          goal.half === 2 ? '2-й тайм' : 'Тайм ' + goal.half;
        const timeLabel = goal.matchTime || new Date(goal.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        let scorerLabel;
        if (goal.isOwnGoal) {
            scorerLabel = '🔄 Автогол';
        } else if (goal.playerNumber != null) {
            scorerLabel = '⚽ Игрок #' + goal.playerNumber;
        } else {
            scorerLabel = '⚽ Неизвестный игрок';
        }

        // Show newest first, mark the first as "most recent"
        const isNewest = index === 0;

        return '<button onclick="removeGoal(\'' + goal._key + '\', ' + side + ')" ' +
               'style="width:100%;padding:14px 16px;background:' + (isNewest ? '#fef2f2' : '#f8fafc') + ';' +
               'border:2px solid ' + (isNewest ? '#fecaca' : '#e2e8f0') + ';border-radius:12px;' +
               'cursor:pointer;display:flex;justify-content:space-between;align-items:center;' +
               'text-align:left;transition:background .15s;">' +
               '<div>' +
               '<div style="font-size:15px;font-weight:700;color:#1e293b;">' + scorerLabel + '</div>' +
               '<div style="font-size:12px;color:#64748b;margin-top:2px;">' + halfLabel + ' · ' + timeLabel + '</div>' +
               '</div>' +
               '<div style="background:#ef4444;color:#fff;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;white-space:nowrap;margin-left:12px;">' +
               (isNewest ? '× Удалить' : '× Удалить') +
               '</div>' +
               '</button>';
    }).join('');
}

// ----------------------------------------
// REMOVE A SPECIFIC GOAL
// ----------------------------------------
function removeGoal(goalKey, side) {
    closeGoalRemoveModal();

    // Get current score before deleting
    firebase.database().ref('matches/' + matchId).once('value').then(function(snap) {
        const match = snap.val();
        if (!match) return;

        const scoreKey = 'score' + side;
        const newScore = Math.max(0, (match[scoreKey] || 0) - 1);

        // Delete goal record and decrement score in parallel
        return Promise.all([
            firebase.database().ref('goals/' + goalKey).remove(),
            firebase.database().ref('matches/' + matchId).update({ [scoreKey]: newScore })
        ]);
    }).then(function() {
        showToast('✓ Гол удалён');
    }).catch(function(err) {
        console.error('Remove goal error:', err);
        showToast('❌ Ошибка удаления');
    });
}

// ----------------------------------------
// CLOSE MODALS ON BACKDROP CLICK
// ----------------------------------------
document.addEventListener('click', function(e) {
    const scorerModal = document.getElementById('goalScorerModal');
    const removeModal = document.getElementById('goalRemoveModal');

    if (e.target === scorerModal) closeGoalScorerModal();
    if (e.target === removeModal) closeGoalRemoveModal();
});

// ----------------------------------------
// CLOSE MODALS ON ESC
// ----------------------------------------
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeGoalScorerModal();
        closeGoalRemoveModal();
    }
});
