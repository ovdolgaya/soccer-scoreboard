// ========================================
// GOAL TRACKING
// ========================================
// Handles the player picker modal (+ button for team 1),
// goal removal modal (− button for team 1),
// assist picker modal (👟 button in stats),
// and all Firebase read/write for /goals

// ---- State ----
let goalTracking = {
    defaultTeamId:   null,  // loaded once from settings/defaultTeam
    defaultTeamSide: null,  // 1 or 2 — resolved once per match, cached here
    playersCache:    [],    // active players — no photos, only fields needed for modal
    selectedAssists: []     // [{ id, number }] — selected assistants for current goal
};

// ---- Match cache — kept current by listenToMatchChanges real-time listener ----
// Eliminates repeated match fetches on every goal / modal open
let _matchCache = null;

// Called from listenToMatchChanges so cache stays always up to date
function updateMatchCache(matchData) {
    _matchCache = matchData;
}

// ----------------------------------------
// INIT — called once after a match loads
// ----------------------------------------
function initGoalTracking() {
    // Reset per-match state
    goalTracking.defaultTeamSide = null;
    _matchCache = null;

    // Only fetch settings once per page load
    if (goalTracking.defaultTeamId) {
        if (goalTracking.playersCache.length === 0) loadGoalTrackingPlayers();
        return;
    }

    firebase.database().ref('settings/defaultTeam').once('value')
        .then(function(snap) {
            goalTracking.defaultTeamId = snap.val() || null;
            if (goalTracking.defaultTeamId) {
                loadGoalTrackingPlayers();
            }
        });
}

// Pre-load players — only fields needed for modal, never photo
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
                if (!p.isAbsent && !p.isDeleted) {
                    players.push({
                        id:           child.key,
                        number:       p.number,
                        firstName:    p.firstName  || '',
                        lastName:     p.lastName   || '',
                        isGoalkeeper: p.isGoalkeeper || false,
                        teamId:       p.teamId
                    });
                }
            });
            players.sort(function(a, b) { return a.number - b.number; });
            goalTracking.playersCache = players;
        });
}

// ----------------------------------------
// CALCULATE MATCH TIME — uses _matchCache, zero Firebase reads
// ----------------------------------------
function getMatchTimeString() {
    if (_matchCache && _matchCache.status === 'playing' && _matchCache.startTime) {
        const elapsed = Date.now() - _matchCache.startTime;
        const totalSeconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return Promise.resolve(
            String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
        );
    }
    return Promise.resolve(getCurrentWallTime());
}

function getCurrentWallTime() {
    const now = new Date();
    return String(now.getHours()).padStart(2, '0') + ':' +
           String(now.getMinutes()).padStart(2, '0') + ':' +
           String(now.getSeconds()).padStart(2, '0');
}

// ----------------------------------------
// DETERMINE DEFAULT TEAM SIDE — resolved once per match, cached
// ----------------------------------------
function _resolveAndCacheTeamSide(matchData) {
    if (!goalTracking.defaultTeamId || !matchData) {
        goalTracking.defaultTeamSide = 1;
        return Promise.resolve(1);
    }
    // Fetch ONLY the name field — not the full team record (no logo, badges, etc.)
    return firebase.database().ref('teams/' + goalTracking.defaultTeamId + '/name').once('value')
        .then(function(snap) {
            const teamName = (snap.val() || '').trim().toLowerCase();
            const t2 = (matchData.team2Name || '').trim().toLowerCase();
            goalTracking.defaultTeamSide = (teamName === t2) ? 2 : 1;
            return goalTracking.defaultTeamSide;
        });
}

function resolveDefaultTeamSide(matchData) {
    // Use cached value — no Firebase call after first resolution
    if (goalTracking.defaultTeamSide !== null) {
        return Promise.resolve(goalTracking.defaultTeamSide);
    }
    return _resolveAndCacheTeamSide(matchData);
}

// ----------------------------------------
// OPEN GOAL SCORER MODAL (+ button team 1)
// ----------------------------------------
function openGoalScorerModal() {
    if (!matchId) return;

    // Reset assists state every time modal opens
    goalTracking.selectedAssists = [];

    // Use cached match data — zero Firebase read
    const match = _matchCache;
    if (match) {
        getMatchTimeString().then(function(timeStr) {
            const halfLabel = match.currentHalf === 1 ? '1-й тайм' :
                              match.currentHalf === 2 ? '2-й тайм' : '';
            const info = halfLabel ? halfLabel + ' · ' + timeStr : timeStr;
            const el = document.getElementById('goalModalMatchInfo');
            if (el) el.textContent = info;
        });
    }

    renderAssistGrid();
    renderPlayerGrid();

    document.getElementById('goalScorerModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeGoalScorerModal() {
    goalTracking.selectedAssists = [];
    document.getElementById('goalScorerModal').style.display = 'none';
    document.body.style.overflow = '';
}

// ----------------------------------------
// RENDER ASSIST GRID (muted style, multi-select, no auto-close)
// ----------------------------------------
function renderAssistGrid() {
    const grid = document.getElementById('goalAssistGrid');
    if (!grid) return;

    if (goalTracking.playersCache.length === 0) {
        grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:10px;grid-column:1/-1;font-size:13px;">Нет активных игроков</div>';
        return;
    }

    grid.innerHTML = goalTracking.playersCache.map(function(player) {
        const isSelected = goalTracking.selectedAssists.some(function(a) { return a.id === player.id; });

        const bg = isSelected
            ? 'linear-gradient(135deg,#0ea5e9,#0369a1)'   // highlighted — teal-blue
            : 'linear-gradient(135deg,#475569,#334155)';  // default — muted slate

        const border = isSelected
            ? '2px solid #7dd3fc'
            : '2px solid transparent';

        const checkmark = isSelected
            ? '<div style="font-size:9px;margin-top:2px;">✓</div>'
            : '';

        return '<button onclick="toggleAssist(\'' + player.id + '\', ' + player.number + ')" ' +
               'style="background:' + bg + ';color:#fff;border:' + border + ';border-radius:12px;' +
               'padding:10px 6px;font-size:20px;font-weight:800;cursor:pointer;' +
               'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
               'min-height:56px;transition:all .15s;' +
               'box-shadow:0 2px 8px rgba(0,0,0,0.2);">' +
               '#' + player.number +
               checkmark +
               '</button>';
    }).join('');
}

// ----------------------------------------
// TOGGLE ASSIST SELECTION
// ----------------------------------------
function toggleAssist(playerId, playerNumber) {
    const idx = goalTracking.selectedAssists.findIndex(function(a) { return a.id === playerId; });
    if (idx === -1) {
        goalTracking.selectedAssists.push({ id: playerId, number: playerNumber });
    } else {
        goalTracking.selectedAssists.splice(idx, 1);
    }
    // Re-render both grids to sync state (assist highlights + scorer disabled states)
    renderAssistGrid();
    renderPlayerGrid();
}

// ----------------------------------------
// RENDER PLAYER NUMBER CARDS (scorer grid)
// ----------------------------------------
function renderPlayerGrid() {
    const grid = document.getElementById('goalPlayerGrid');
    if (!grid) return;

    if (goalTracking.playersCache.length === 0) {
        loadGoalTrackingPlayers();
        grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;grid-column:1/-1;">Нет активных игроков.<br><small>Проверьте настройки команды.</small></div>';
        return;
    }

    grid.innerHTML = goalTracking.playersCache.map(function(player) {
        const isAssist = goalTracking.selectedAssists.some(function(a) { return a.id === player.id; });
        const isGK = player.isGoalkeeper;

        // Greyed out if already selected as assistant
        const bg = isAssist
            ? 'linear-gradient(135deg,#94a3b8,#64748b)'
            : isGK
                ? 'linear-gradient(135deg,#7c3aed,#4c1d95)'
                : 'linear-gradient(135deg,#1e5fd4,#08399A)';

        const opacity = isAssist ? '0.45' : '1';
        const pointer = isAssist ? 'none' : 'auto';
        const badge = isGK && !isAssist ? '<div style="font-size:9px;opacity:.75;margin-top:2px;">🧤</div>' : '';
        const assistLabel = isAssist ? '<div style="font-size:9px;opacity:.9;margin-top:2px;">👟</div>' : '';

        const clickHandler = isAssist
            ? ''
            : 'onclick="confirmGoal(\'' + player.id + '\', false)"';

        return '<button ' + clickHandler + ' ' +
               'style="background:' + bg + ';color:#fff;border:none;border-radius:14px;' +
               'padding:16px 8px;font-size:24px;font-weight:800;cursor:pointer;' +
               'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
               'min-height:72px;transition:transform .1s,box-shadow .1s;' +
               'opacity:' + opacity + ';pointer-events:' + pointer + ';' +
               'box-shadow:0 4px 12px rgba(0,0,0,0.15);" ' +
               'onmousedown="this.style.transform=\'scale(.94)\'" ' +
               'onmouseup="this.style.transform=\'scale(1)\'" ' +
               'onmouseleave="this.style.transform=\'scale(1)\'">' +
               '#' + player.number +
               badge +
               assistLabel +
               '</button>';
    }).join('');
}

// ----------------------------------------
// CONFIRM GOAL — save to Firebase + update score
// ----------------------------------------
function confirmGoal(playerId, isOwnGoal) {
    if (!matchId) return;

    // Capture assists before closing (closeGoalScorerModal resets them)
    const assistsSnapshot = goalTracking.selectedAssists.slice();
    closeGoalScorerModal();

    // Use cached match data + cached time — zero Firebase reads before saving
    const match = _matchCache;
    if (!match) { showToast('❌ Данные матча недоступны'); return; }

    getMatchTimeString().then(function(timeStr) {
        // Build goal record
        const goalData = {
            matchId: matchId,
            teamId: goalTracking.defaultTeamId || null,
            playerId: isOwnGoal ? null : (playerId || null),
            isOwnGoal: isOwnGoal || false,
            half: match.currentHalf || 0,
            matchTime: timeStr,
            timestamp: Date.now(),
            createdAt: Date.now()
        };

        // Store assists (only for non-own-goals)
        if (!isOwnGoal && assistsSnapshot.length > 0) {
            goalData.assists = assistsSnapshot.map(function(a) {
                return { playerId: a.id, playerNumber: a.number };
            });
        }

        // Store scorer's number for quick display
        if (!isOwnGoal && playerId) {
            const player = goalTracking.playersCache.find(function(p) { return p.id === playerId; });
            if (player) {
                goalData.playerNumber = player.number;
                goalData.isGoalkeeper = player.isGoalkeeper || false;
            }
        }

        // Save goal then increment score — side resolved from cache (no team fetch if already known)
        return firebase.database().ref('goals').push(goalData)
            .then(function() {
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

    if (team === 2) {
        changeScore(2, -1);
        return;
    }

    // Use cached match data — no Firebase read
    const match = _matchCache;
    if (!match) { showToast('❌ Данные матча недоступны'); return; }

    resolveDefaultTeamSide(match).then(function(side) {
        const scoreKey = 'score' + (side || 1);
        const currentScore = match[scoreKey] || 0;

        if (currentScore <= 0) {
            showToast('❌ Счёт уже 0');
            return;
        }

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

                const teamGoals = goals
                    .filter(function(g) { return g.teamId === goalTracking.defaultTeamId; })
                    .sort(function(a, b) { return b.timestamp - a.timestamp; });

                if (teamGoals.length === 0) {
                    return changeScore(side || 1, -1);
                }

                renderGoalRemoveList(teamGoals, side || 1, currentScore);
                document.getElementById('goalRemoveModal').style.display = 'block';
                document.body.style.overflow = 'hidden';
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
               '<div style="background:#ef4444;color:#fff;padding:6px 12px;border-radius:8px;font-size:13px;font-weight:600;white-space:nowrap;margin-left:12px;">× Удалить</div>' +
               '</button>';
    }).join('');
}

// ----------------------------------------
// REMOVE A SPECIFIC GOAL
// ----------------------------------------
function removeGoal(goalKey, side) {
    closeGoalRemoveModal();

    // Use cached score — no Firebase read
    const match = _matchCache;
    if (!match) { showToast('❌ Данные матча недоступны'); return; }

    const scoreKey = 'score' + side;
    const newScore = Math.max(0, (match[scoreKey] || 0) - 1);

    Promise.all([
        firebase.database().ref('goals/' + goalKey).remove(),
        firebase.database().ref('matches/' + matchId).update({ [scoreKey]: newScore })
    ]).then(function() {
        showToast('✓ Гол удалён');
    }).catch(function(err) {
        console.error('Remove goal error:', err);
        showToast('❌ Ошибка удаления');
    });
}

// ----------------------------------------
// RETROACTIVE GOAL ENTRY (ended matches)
// ----------------------------------------

function openRetroGoalModal() {
    if (!matchId) return;

    if (goalTracking.playersCache.length === 0 && goalTracking.defaultTeamId) {
        loadGoalTrackingPlayers();
    }

    renderRetroPlayerGrid();
    document.getElementById('retroGoalModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeRetroGoalModal() {
    document.getElementById('retroGoalModal').style.display = 'none';
    document.body.style.overflow = '';
}

function renderRetroPlayerGrid() {
    const grid = document.getElementById('retroPlayerGrid');
    if (!grid) return;

    if (goalTracking.playersCache.length === 0) {
        grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px;grid-column:1/-1;">' +
            'Нет активных игроков.<br><small>Проверьте настройки команды.</small></div>';
        return;
    }

    grid.innerHTML = goalTracking.playersCache.map(function(player) {
        const isGK = player.isGoalkeeper;
        const bg = isGK
            ? 'linear-gradient(135deg,#7c3aed,#4c1d95)'
            : 'linear-gradient(135deg,#1e5fd4,#08399A)';
        const badge = isGK ? '<div style="font-size:9px;opacity:.75;margin-top:2px;">🧤</div>' : '';

        return '<button onclick="confirmRetroGoal(\'' + player.id + '\', false)" ' +
               'style="background:' + bg + ';color:#fff;border:none;border-radius:14px;' +
               'padding:16px 8px;font-size:24px;font-weight:800;cursor:pointer;' +
               'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
               'min-height:72px;transition:transform .1s,box-shadow .1s;' +
               'box-shadow:0 4px 12px rgba(0,0,0,0.15);" ' +
               'onmousedown="this.style.transform=\'scale(.94)\'" ' +
               'onmouseup="this.style.transform=\'scale(1)\'" ' +
               'onmouseleave="this.style.transform=\'scale(1)\'">' +
               '#' + player.number + badge +
               '</button>';
    }).join('');
}

function confirmRetroGoal(playerId, isOwnGoal) {
    if (!matchId) return;
    closeRetroGoalModal();

    // Use cached match data — no Firebase read
    const match = _matchCache;
    if (!match) { showToast('❌ Данные матча недоступны'); return; }

    const goalData = {
        matchId:     matchId,
        teamId:      goalTracking.defaultTeamId || null,
        playerId:    isOwnGoal ? null : (playerId || null),
        isOwnGoal:   isOwnGoal || false,
        half:        null,
        matchTime:   null,
        retroactive: true,
        timestamp:   Date.now(),
        createdAt:   Date.now()
    };

    if (!isOwnGoal && playerId) {
        const player = goalTracking.playersCache.find(function(p) { return p.id === playerId; });
        if (player) {
            goalData.playerNumber = player.number;
            goalData.isGoalkeeper = player.isGoalkeeper || false;
        }
    }

    firebase.database().ref('goals').push(goalData)
        .then(function() {
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
            showToast('⚽ Гол добавлен!');
            if (typeof loadGoalsStats === 'function') loadGoalsStats(matchId);
        })
        .catch(function(err) {
            console.error('Retro goal save error:', err);
            showToast('❌ Ошибка сохранения гола');
        });
}

// ----------------------------------------
// ASSIST PICKER MODAL (from stats rows)
// ----------------------------------------

// Currently editing goal key
let _assistPickerGoalKey = null;
let _assistPickerSelected = []; // [{ playerId, playerNumber }]

function openAssistPickerModal(goalKey) {
    if (!goalKey) return;
    _assistPickerGoalKey = goalKey;
    _assistPickerSelected = [];

    // Load existing assists for this goal so we can pre-select them
    firebase.database().ref('goals/' + goalKey).once('value').then(function(snap) {
        const goal = snap.val();
        if (!goal) return;

        // Pre-populate with existing assists
        if (goal.assists && Array.isArray(goal.assists)) {
            _assistPickerSelected = goal.assists.map(function(a) {
                return { playerId: a.playerId, playerNumber: a.playerNumber };
            });
        }

        renderAssistPickerGrid();
        document.getElementById('assistPickerModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    });
}

function closeAssistPickerModal() {
    _assistPickerGoalKey = null;
    _assistPickerSelected = [];
    document.getElementById('assistPickerModal').style.display = 'none';
    document.body.style.overflow = '';
}

function renderAssistPickerGrid() {
    const grid = document.getElementById('assistPickerGrid');
    if (!grid) return;

    if (goalTracking.playersCache.length === 0) {
        grid.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:16px;grid-column:1/-1;font-size:13px;">Нет активных игроков</div>';
        return;
    }

    grid.innerHTML = goalTracking.playersCache.map(function(player) {
        const isSelected = _assistPickerSelected.some(function(a) { return a.playerId === player.id; });

        const bg = isSelected
            ? 'linear-gradient(135deg,#0ea5e9,#0369a1)'
            : 'linear-gradient(135deg,#475569,#334155)';

        const border = isSelected ? '2px solid #7dd3fc' : '2px solid transparent';
        const checkmark = isSelected ? '<div style="font-size:9px;margin-top:2px;">✓</div>' : '';

        return '<button onclick="toggleAssistPicker(\'' + player.id + '\', ' + player.number + ')" ' +
               'style="background:' + bg + ';color:#fff;border:' + border + ';border-radius:12px;' +
               'padding:10px 6px;font-size:20px;font-weight:800;cursor:pointer;' +
               'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
               'min-height:56px;transition:all .15s;' +
               'box-shadow:0 2px 8px rgba(0,0,0,0.2);">' +
               '#' + player.number +
               checkmark +
               '</button>';
    }).join('');
}

function toggleAssistPicker(playerId, playerNumber) {
    const idx = _assistPickerSelected.findIndex(function(a) { return a.playerId === playerId; });
    if (idx === -1) {
        _assistPickerSelected.push({ playerId: playerId, playerNumber: playerNumber });
    } else {
        _assistPickerSelected.splice(idx, 1);
    }
    renderAssistPickerGrid();
}

function saveAssistPicker() {
    if (!_assistPickerGoalKey) return;

    const assists = _assistPickerSelected.length > 0 ? _assistPickerSelected : null;

    firebase.database().ref('goals/' + _assistPickerGoalKey).update({
        assists: assists
    }).then(function() {
        showToast('👟 Ассистент(ы) сохранены!');
        closeAssistPickerModal();
        // Refresh stats if visible
        if (typeof loadGoalsStats === 'function') loadGoalsStats(matchId);
    }).catch(function(err) {
        console.error('Assist save error:', err);
        showToast('❌ Ошибка сохранения');
    });
}

// ----------------------------------------
// REMOVE A SINGLE ASSIST FROM A GOAL
// ----------------------------------------
function removeAssist(goalKey, assistPlayerId) {
    firebase.database().ref('goals/' + goalKey).once('value').then(function(snap) {
        const goal = snap.val();
        if (!goal) return;

        const currentAssists = (goal.assists || []).filter(function(a) {
            return a.playerId !== assistPlayerId;
        });

        // Write null if empty (cleaner Firebase record), array if remaining
        return firebase.database().ref('goals/' + goalKey).update({
            assists: currentAssists.length > 0 ? currentAssists : null
        });
    }).then(function() {
        showToast('✓ Ассистент удалён');
        if (typeof loadGoalsStats === 'function') loadGoalsStats(matchId);
    }).catch(function(err) {
        console.error('Remove assist error:', err);
        showToast('❌ Ошибка удаления ассистента');
    });
}

// ----------------------------------------
// CLOSE MODALS ON BACKDROP CLICK
// ----------------------------------------
document.addEventListener('click', function(e) {
    const scorerModal  = document.getElementById('goalScorerModal');
    const removeModal  = document.getElementById('goalRemoveModal');
    const retroModal   = document.getElementById('retroGoalModal');
    const assistModal  = document.getElementById('assistPickerModal');

    if (e.target === scorerModal) closeGoalScorerModal();
    if (e.target === removeModal) closeGoalRemoveModal();
    if (e.target === retroModal)  closeRetroGoalModal();
    if (e.target === assistModal) closeAssistPickerModal();
});

// ----------------------------------------
// CLOSE MODALS ON ESC
// ----------------------------------------
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeGoalScorerModal();
        closeGoalRemoveModal();
        closeRetroGoalModal();
        closeAssistPickerModal();
    }
});
