// ========================================
// MATCH DASHBOARD & LIST MANAGEMENT
// ========================================

let currentMatchesDisplayed = 10;
const MATCHES_PER_PAGE = 10;
let allMatchesCache = [];
let activeChampFilter = '';

// Full match data cache — keyed by matchId, includes logos.
// Downloaded once on page load. Individual field listeners update scores/status.
const _matchDataCache = {};

// Active field listeners — keyed by matchId. Cleaned up on backToDashboard.
const _matchFieldListeners = {};

function loadMatches(reset = true) {
    const matchListDiv = document.getElementById('matchList');
    const loadMoreBtn  = document.getElementById('loadMoreBtn');
    const hidePast = document.getElementById('hidePastMatches')
        ? document.getElementById('hidePastMatches').checked : false;

    if (reset) {
        currentMatchesDisplayed = MATCHES_PER_PAGE;
        matchListDiv.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">Загрузка матчей...</div>';
    }

    // Detach old real-time listener if resetting
    if (matchListListener && reset) {
        database.ref('matches').off('value', matchListListener);
        matchListListener = null;
    }

    // ── Fetch all matches ONCE (includes logos — stored in cache for cockpit use) ──
    database.ref('matches').once('value', function(snapshot) {
        const matches = [];
        snapshot.forEach(function(childSnapshot) {
            const match = childSnapshot.val();
            match.id = childSnapshot.key;
            _matchDataCache[match.id] = match; // cache full record including logos
            if (hidePast && match.status === 'ended') return;
            matches.push(match);
        });

        sortMatches(matches);
        allMatchesCache = matches;
        _populateChampFilter(matches);
        displayMatches();

        // ── Set up lightweight field listeners ONLY for non-ended matches ──
        // Each listener watches only score1, score2, status, time — no logos re-downloaded
        _attachFieldListeners(matches.filter(function(m) {
            return m.status !== 'ended';
        }));

    }, function(error) {
        matchListDiv.innerHTML = '<div style="color:#f44336;padding:20px;">Ошибка загрузки: ' + error.message + '</div>';
    });
}

// Attach lightweight listeners for score/status/time fields only
function _attachFieldListeners(activeMatches) {
    activeMatches.forEach(function(match) {
        if (_matchFieldListeners[match.id]) return; // already listening

        const fields = ['score1', 'score2', 'status', 'time', 'currentHalf', 'startTime'];
        fields.forEach(function(field) {
            const ref = database.ref('matches/' + match.id + '/' + field);
            const listener = ref.on('value', function(snap) {
                // Update cache
                if (_matchDataCache[match.id]) {
                    _matchDataCache[match.id][field] = snap.val();
                }
                // Update allMatchesCache entry
                const cached = allMatchesCache.find(function(m) { return m.id === match.id; });
                if (cached) {
                    cached[field] = snap.val();
                    // Stop listening when match ends
                    if (field === 'status' && snap.val() === 'ended') {
                        _detachFieldListeners(match.id);
                    }
                }
                // Re-render list to reflect score/status changes
                displayMatches();
                // Update match cache for goal tracking
                if (_matchDataCache[match.id] && typeof updateMatchCache === 'function') {
                    updateMatchCache(_matchDataCache[match.id]);
                }
            });
            if (!_matchFieldListeners[match.id]) _matchFieldListeners[match.id] = {};
            _matchFieldListeners[match.id][field] = { ref, listener };
        });
    });
}

function _detachFieldListeners(matchId) {
    if (!_matchFieldListeners[matchId]) return;
    Object.values(_matchFieldListeners[matchId]).forEach(function(entry) {
        entry.ref.off('value', entry.listener);
    });
    delete _matchFieldListeners[matchId];
}

function _detachAllFieldListeners() {
    Object.keys(_matchFieldListeners).forEach(_detachFieldListeners);
}

function displayMatches() {
    const matchListDiv = document.getElementById('matchList');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const hidePast = document.getElementById('hidePastMatches') ? document.getElementById('hidePastMatches').checked : false;

    if (allMatchesCache.length === 0) {
        matchListDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚽</div>
                <h3>${hidePast ? 'Активных матчей нет' : 'Матчей пока нет'}</h3>
                <p>${hidePast ? 'Прошедшие матчи скрыты' : 'Нажмите "Создать новый матч" чтобы начать'}</p>
            </div>
        `;
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
    }

    // Apply championship filter (client-side, no Firebase read)
    const filtered = activeChampFilter
        ? allMatchesCache.filter(function(m) { return (m.championshipTitle || '') === activeChampFilter; })
        : allMatchesCache;

    if (filtered.length === 0) {
        matchListDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏆</div>
                <h3>Нет матчей по выбранному чемпионату</h3>
                <p>Выберите другой чемпионат или «Все чемпионаты»</p>
            </div>
        `;
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        return;
    }

    // Get matches to display (limited by currentMatchesDisplayed)
    const matchesToShow = filtered.slice(0, currentMatchesDisplayed);
    matchListDiv.innerHTML = matchesToShow.map(renderMatchCard).join('');

    // Show/hide "Load More" button
    if (loadMoreBtn) {
        if (filtered.length > currentMatchesDisplayed) {
            loadMoreBtn.style.display = 'block';
            const remaining = filtered.length - currentMatchesDisplayed;
            loadMoreBtn.querySelector('span').textContent = `Показать ещё (${remaining})`;
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }
}

function loadMoreMatches() {
    currentMatchesDisplayed += MATCHES_PER_PAGE;
    displayMatches();
}


function getMatchStatus(match) {
    if (match.scheduledTime && match.scheduledTime > Date.now()) {
        return 'scheduled';
    }
    return match.status || 'waiting';
}

function getStatusText(status) {
    const statusTexts = {
        'scheduled': 'Ожидается',
        'playing': 'Идет сейчас',
        'waiting': 'Готов к началу',
        'half1_ended': '1 тайм окончен',
        'half2_ended': '2 тайм окончен',
        'ended': 'Закончен'
    };
    return statusTexts[status] || 'Неизвестен';
}

// formatDate, formatDateTime, sortMatches — see match-helpers.js

function renderMatchCard(match) {
    const status = getMatchStatus(match);
    const statusText = getStatusText(status);
    const cardClass = status === 'playing' ? 'active' : 
                     status === 'ended' ? 'ended' :
                     status === 'scheduled' ? 'scheduled' : 
                     status === 'half1_ended' || status === 'half2_ended' ? 'active' : '';

    // Show scheduled time for scheduled matches, matchDate for others, or creation date as fallback
    let dateInfo = '';
    if (match.scheduledTime && status === 'scheduled') {
        dateInfo = `<div class="match-info"><span>📅</span> <span>${formatDateTime(match.scheduledTime)}</span></div>`;
    } else if (match.matchDate) {
        dateInfo = `<div class="match-info"><span>📅</span> <span>Дата матча: ${formatDate(match.matchDate)}</span></div>`;
    } else {
        dateInfo = `<div class="match-info"><span>📅</span> <span>Создан: ${formatDateTime(match.createdAt)}</span></div>`;
    }

    const matchIdShort = match.id.substring(match.id.length - 8);

    return `
        <div class="match-card ${cardClass}" onclick="openMatch('${match.id}')">
            ${match.championshipTitle ? `<div style="font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.06em; padding:10px 0 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🏆 ${match.championshipTitle}</div>` : ''}
            <div class="match-header">
                <div class="match-row">
                    <span class="match-teams">${match.team1Name}</span>
                    <span class="match-score">${match.score1}</span>
                </div>
                <div class="match-row match-row-reverse">
                    <span class="match-score">${match.score2}</span>
                    <span class="match-teams">${match.team2Name}</span>
                </div>
                <span class="match-status ${status}">${statusText}</span>
            </div>
            ${dateInfo}
            ${status === 'playing' ? '<div class="match-info"><span>⏱️</span> <span>' + (match.time || '00:00:00') + '</span></div>' : ''}
            <div class="match-actions">
                <button class="button" onclick="event.stopPropagation(); openMatch('${match.id}')">Открыть</button>
                <button class="button secondary" onclick="event.stopPropagation(); openMatchEditModal('${match.id}')"><i class="fas fa-edit"></i> Изменить</button>
                <button class="button danger" onclick="event.stopPropagation(); deleteMatch('${match.id}')">Удалить</button>
            </div>
        </div>
    `;
}

// ── Championship filter helpers ──────────────────────────────────────────

function _populateChampFilter(matches) {
    const sel = document.getElementById('champFilterSelect');
    if (!sel) return;

    // Collect unique non-empty championship titles from the loaded matches
    const titles = [];
    matches.forEach(function(m) {
        const t = (m.championshipTitle || '').trim();
        if (t && !titles.includes(t)) titles.push(t);
    });
    titles.sort(function(a, b) { return a.localeCompare(b, 'ru'); });

    // Preserve current selection if it still exists in the new list
    const current = activeChampFilter;
    sel.innerHTML = '<option value="">Все чемпионаты</option>';
    titles.forEach(function(t) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        if (t === current) opt.selected = true;
        sel.appendChild(opt);
    });
}

function applyChampFilter() {
    const sel = document.getElementById('champFilterSelect');
    activeChampFilter = sel ? sel.value : '';
    currentMatchesDisplayed = MATCHES_PER_PAGE; // reset pagination on filter change
    displayMatches();
}

function openMatch(matchIdToOpen) {
    matchId = matchIdToOpen;

    // Use cached match data — already downloaded on page load including logos
    const match = _matchDataCache[matchId];
    if (match) {
        _applyMatchToView(match);
    } else {
        // Fallback: fetch if somehow not in cache
        database.ref('matches/' + matchId).once('value')
            .then(function(snapshot) {
                const m = snapshot.val();
                if (!m) { alert('Матч не найден'); return; }
                _matchDataCache[matchId] = m;
                m.id = matchId;
                _applyMatchToView(m);
            })
            .catch(function(error) {
                alert('Ошибка открытия матча: ' + error.message);
            });
    }
}

function _applyMatchToView(match) {
            // Update display
            document.getElementById('team1NameDisplay').textContent = match.team1Name;
            document.getElementById('team2NameDisplay').textContent = match.team2Name;
            document.getElementById('score1').textContent = match.score1;
            document.getElementById('score2').textContent = match.score2;

            // ── Cockpit header ──
            const cockpitT1 = document.getElementById('cockpitTeam1');
            const cockpitT2 = document.getElementById('cockpitTeam2');
            const cockpitDt = document.getElementById('cockpitDate');
            const cockpitSt = document.getElementById('cockpitStatus');
            if (cockpitT1) cockpitT1.textContent = match.team1Name || '';
            if (cockpitT2) cockpitT2.textContent = match.team2Name || '';
            if (cockpitDt) {
                if (match.scheduledTime) {
                    const d = new Date(match.scheduledTime);
                    const pad = n => String(n).padStart(2, '0');
                    cockpitDt.textContent = pad(d.getDate()) + '.' + pad(d.getMonth()+1) + '.' + d.getFullYear()
                                         + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
                } else if (match.matchDate) {
                    const p = match.matchDate.split('-');
                    cockpitDt.textContent = p[2] + '.' + p[1] + '.' + p[0];
                } else {
                    cockpitDt.textContent = '';
                }
            }
            if (cockpitSt) cockpitSt.textContent = getStatusText(match.status || 'waiting');

            updateMatchMetadata(match);

            const isEnded = match.status === 'ended';

            const timeControlsSection = document.getElementById('timeControlsSection');
            if (timeControlsSection) {
                timeControlsSection.style.display = isEnded ? 'none' : 'block';
            }

            const goalsStatsSection = document.getElementById('goalsStatsSection');
            if (goalsStatsSection) {
                if (isEnded) {
                    goalsStatsSection.style.display = 'block';
                    loadGoalsStats(matchId);
                } else {
                    goalsStatsSection.style.display = 'none';
                }
            }

            // Show clips for ended matches (read-only review)
            if (isEnded && typeof loadClips === 'function') {
                loadClips();
            }

            updateButtonStates(match);

            hideAllViews();
            document.getElementById('controlPanel').classList.add('active');

            listenToMatchChanges();
            if (typeof initGoalTracking === 'function') initGoalTracking();
}

function updateMatchMetadata(match) {
    let createdHtml = '';
    let startedHtml = '';
    
    // Created by info
    if (match.createdAt) {
        const createdBy = match.createdByEmail || 'Неизвестно';
        createdHtml = `<div><strong>Создан:</strong> ${formatDateTime(match.createdAt)} (${createdBy})</div>`;
    }
    
    // Match started info
    if (match.matchStartedAt) {
        startedHtml = `<div><strong>Начало матча:</strong> ${formatDateTime(match.matchStartedAt)}</div>`;
    }
    
    if (document.getElementById('metadataCreated'))
        document.getElementById('metadataCreated').innerHTML = createdHtml;
    if (document.getElementById('metadataStarted'))
        document.getElementById('metadataStarted').innerHTML = startedHtml;
}

function updateButtonStates(match) {
    // Get actual status from match data, ignoring scheduled time
    const actualStatus = match.status;
    
    // Reset all buttons
    document.getElementById('startHalf1Btn').classList.add('hidden');
    document.getElementById('stopHalf1Btn').classList.add('hidden');
    document.getElementById('startHalf2Btn').classList.add('hidden');
    document.getElementById('endMatchBtn').classList.add('hidden');

    if (actualStatus === 'scheduled' || actualStatus === 'waiting') {
        // Can start even if scheduled for future
        document.getElementById('startHalf1Btn').classList.remove('hidden');
    } else if (actualStatus === 'playing') {
        if (match.currentHalf === 1) {
            document.getElementById('stopHalf1Btn').classList.remove('hidden');
            // endMatchBtn intentionally hidden during half 1 — available in halftime popup instead
        } else if (match.currentHalf === 2) {
            // stopHalf2Btn removed — only End Match button shown during half 2
            document.getElementById('endMatchBtn').classList.remove('hidden');
        }
    } else if (actualStatus === 'half1_ended') {
        document.getElementById('startHalf2Btn').classList.remove('hidden');
    } else if (actualStatus === 'half2_ended') {
        // Second half ended, show end match button
        document.getElementById('endMatchBtn').classList.remove('hidden');
    }

    // Show/hide clip marker button based on whether a half is actively playing
    if (typeof updateClipMarkerVisibility === 'function') {
        updateClipMarkerVisibility(actualStatus);
    }
}

// ========================================
// GOALS STATISTICS (ended matches only)
// ========================================

// Page-level player cache — persists across modal opens, cleared on page reload only.
// Stores only display fields (no photo) to keep memory and download size minimal.
const _playersCache = {};

function _fetchPlayerFields(pid) {
    // Return cached immediately if available
    if (_playersCache[pid]) return Promise.resolve(_playersCache[pid]);

    // Fetch the full node but strip photo before caching — 1 read instead of 3
    return database.ref('players/' + pid).once('value').then(function(snap) {
        const p = snap.val() || {};
        const player = {
            firstName: p.firstName || '',
            lastName:  p.lastName  || '',
            number:    p.number    || '?'
            // photo intentionally omitted
        };
        _playersCache[pid] = player;
        return player;
    });
}

function loadGoalsStats(forMatchId) {
    const body = document.getElementById('goalsStatsBody');
    if (!body) return;

    body.innerHTML = '<div style="padding:16px 20px; color:#94a3b8; font-size:14px;">Загрузка...</div>';

    database.ref('goals').orderByChild('matchId').equalTo(forMatchId).once('value')
        .then(function(goalsSnap) {
            const goals = [];
            goalsSnap.forEach(function(child) {
                const g = child.val();
                g._key = child.key;
                goals.push(g);
            });

            // Sort by half then matchTime; goals without matchTime go at end
            goals.sort(function(a, b) {
                const aHalf = a.half || 999;
                const bHalf = b.half || 999;
                if (aHalf !== bHalf) return aHalf - bHalf;
                if (!a.matchTime && !b.matchTime) return 0;
                if (!a.matchTime) return 1;
                if (!b.matchTime) return -1;
                return (a.matchTime || '').localeCompare(b.matchTime || '');
            });

            // Collect all unique playerIds — scorers + assistants
            const playerIdSet = new Set();
            goals.forEach(function(g) {
                if (g.playerId) playerIdSet.add(g.playerId);
                if (g.assists && Array.isArray(g.assists)) {
                    g.assists.forEach(function(a) {
                        if (a.playerId) playerIdSet.add(a.playerId);
                    });
                }
            });

            // Fetch only uncached players, and only the fields we need (no photo)
            const fetches = Array.from(playerIdSet).map(function(pid) {
                return _fetchPlayerFields(pid).then(function(data) {
                    return { id: pid, data: data };
                });
            });

            return Promise.all(fetches).then(function(results) {
                const players = {};
                results.forEach(function(r) {
                    if (r.data) players[r.id] = r.data;
                });
                renderGoalsStats(goals, players, body);
            });
        })
        .catch(function(err) {
            console.error('loadGoalsStats error:', err);
            body.innerHTML = '<div style="padding:16px 20px; color:#ef4444; font-size:14px;">Ошибка загрузки статистики</div>';
        });
}

function renderGoalsStats(goals, players, container) {
    let currentHalf = null;
    let html = '';

    // Add goal button at the top
    html += '<div style="padding:12px 20px 8px; border-bottom:1px solid #f1f5f9;">' +
            '<button onclick="openRetroGoalModal()" ' +
            'style="background:linear-gradient(135deg,#08399A,#1e5fd4);color:#fff;border:none;' +
            'border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;' +
            'display:inline-flex;align-items:center;gap:6px;">' +
            '<i class="fas fa-plus"></i> Добавить гол' +
            '</button>' +
            '</div>';

    if (goals.length === 0) {
        html += '<div style="padding:16px 20px; color:#94a3b8; font-size:14px; font-style:italic;">Голов не зафиксировано</div>';
        container.innerHTML = html;
        return;
    }

    goals.forEach(function(g) {
        // Half separator
        const halfVal = g.half || null;
        if (halfVal !== currentHalf) {
            currentHalf = halfVal;
            const halfLabel = !halfVal
                ? 'Добавлено вручную'
                : halfVal === 1 ? '1-й тайм'
                : halfVal === 2 ? '2-й тайм'
                : (halfVal + '-й тайм');
            html += '<div style="padding:8px 20px 4px; font-size:11px; font-weight:700; color:#94a3b8; ' +
                    'text-transform:uppercase; letter-spacing:0.08em; background:#f1f5f9; ' +
                    'border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0;">' +
                    halfLabel + '</div>';
        }

        const timeStr = g.matchTime || '—';

        let playerNumber = '—';
        let playerName   = '—';

        if (g.isOwnGoal) {
            playerNumber = 'АГ';
            playerName   = 'Автогол';
        } else if (g.playerId && players[g.playerId]) {
            const p = players[g.playerId];
            playerNumber = '#' + (p.number || '?');
            const fn = p.firstName || '';
            const ln = (p.lastName  || '').toUpperCase();
            playerName = fn ? fn + ' ' + ln : ln;
        } else {
            playerNumber = g.playerNumber ? ('#' + g.playerNumber) : '?';
            playerName   = 'Неизвестный игрок';
        }

        const rowBg = 'background: transparent;';

        // Build assist chips
        const assists = (g.assists && Array.isArray(g.assists)) ? g.assists : [];
        let assistHtml = '';

        // Existing assist chips with × remove button
        assists.forEach(function(a) {
            const aNum = a.playerNumber || '?';
            assistHtml +=
                '<span style="display:inline-flex;align-items:center;gap:3px;' +
                'background:#e0f2fe;color:#0369a1;border-radius:6px;' +
                'padding:2px 6px 2px 7px;font-size:12px;font-weight:700;white-space:nowrap;">' +
                '#' + aNum +
                '<button onclick="removeAssist(\'' + g._key + '\',\'' + a.playerId + '\')" ' +
                'style="background:none;border:none;color:#0369a1;cursor:pointer;' +
                'font-size:11px;padding:0 0 0 2px;line-height:1;opacity:.7;" ' +
                'title="Удалить ассистента">×</button>' +
                '</span>';
        });

        // 👟 button — always shown, opens assist picker
        assistHtml +=
            '<button onclick="openAssistPickerModal(\'' + g._key + '\')" ' +
            'style="background:none;border:none;cursor:pointer;font-size:15px;' +
            'padding:0 2px;opacity:' + (assists.length > 0 ? '0.5' : '0.8') + ';' +
            'display:flex;align-items:center;justify-content:center;height:28px;" ' +
            'title="' + (assists.length > 0 ? 'Изменить ассистентов' : 'Добавить ассистента') + '">👟</button>';

        html += '<div style="display:flex; align-items:center; gap:0; padding:10px 20px; ' +
                'border-bottom:1px solid #f1f5f9; ' + rowBg + '">' +

                // Match time
                '<div style="width:48px; flex-shrink:0; font-size:13px; font-weight:700; ' +
                'color:' + (g.matchTime ? '#64748b' : '#cbd5e1') + '; font-family:monospace;">' + timeStr + '</div>' +

                // Divider
                '<div style="width:1px; height:28px; background:#e2e8f0; margin-right:12px; flex-shrink:0;"></div>' +

                // Player number badge
                '<div style="flex-shrink:0; background:#08399A; color:#fff; border-radius:6px; ' +
                'padding:3px 8px; font-size:12px; font-weight:800; margin-right:10px; ' +
                'min-width:34px; text-align:center;">' + playerNumber + '</div>' +

                // Player name
                '<div style="flex:1; font-size:14px; font-weight:600; color:#1e293b; min-width:0; ' +
                'white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + playerName + '</div>' +

                // Ball icon
                '<div style="display:flex;align-items:center;justify-content:center;' +
                'font-size:15px; flex-shrink:0; margin-left:8px; height:28px;">⚽</div>' +

                // Assist chips + 👟 button
                '<div style="display:flex; align-items:center; gap:4px; flex-shrink:0; margin-left:4px; flex-wrap:nowrap; height:28px;">' +
                assistHtml +
                '</div>' +

                '</div>';
    });

    container.innerHTML = html;
}

function deleteMatch(matchIdToDelete) {
    if (confirm('Вы уверены, что хотите удалить этот матч?')) {
        database.ref('matches/' + matchIdToDelete).remove()
            .then(function() {
                loadMatches();
            })
            .catch(function(error) {
                alert('Ошибка удаления: ' + error.message);
            });
    }
}

// Cockpit match listener reference — for cleanup on navigate away
let _cockpitMatchListener = null;
let _cockpitMatchRef = null;

function listenToMatchChanges() {
    // Clean up any previous cockpit listener
    if (_cockpitMatchRef && _cockpitMatchListener) {
        _cockpitMatchRef.off('value', _cockpitMatchListener);
    }

    // Listen to individual score fields only — no logos re-downloaded
    // score1 and score2 are the only fields that need live display in the cockpit
    const fields = ['score1', 'score2', 'status', 'currentHalf', 'startTime'];
    fields.forEach(function(field) {
        database.ref('matches/' + matchId + '/' + field).on('value', function(snap) {
            if (!_matchDataCache[matchId]) return;
            _matchDataCache[matchId][field] = snap.val();
            if (typeof updateMatchCache === 'function') updateMatchCache(_matchDataCache[matchId]);
            // Update score display
            if (field === 'score1') document.getElementById('score1').textContent = snap.val() || 0;
            if (field === 'score2') document.getElementById('score2').textContent = snap.val() || 0;
            // Re-evaluate button states when status or half changes
            if (field === 'status' || field === 'currentHalf') {
                updateButtonStates(_matchDataCache[matchId]);
            }
        });
    });

    // Store ref for cleanup — use score1 as representative
    _cockpitMatchRef = database.ref('matches/' + matchId + '/score1');
    _cockpitMatchListener = true; // flag only — actual cleanup via _detachCockpitListeners
}

function _detachCockpitListeners() {
    if (!matchId) return;
    const fields = ['score1', 'score2', 'status', 'currentHalf', 'startTime'];
    fields.forEach(function(field) {
        database.ref('matches/' + matchId + '/' + field).off();
    });
    _cockpitMatchRef = null;
    _cockpitMatchListener = null;
}

// ========================================
// COPY FUNCTIONS
// ========================================

function copyWidgetLinkFromCard(matchIdToCopy, event) {
    // Prevent card click
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    // Generate widget URL
    let basePath = window.location.pathname;
    
    // Remove trailing slash if present
    if (basePath.endsWith('/')) {
        basePath = basePath.slice(0, -1);
    }
    
    // Remove index.html if present
    if (basePath.endsWith('/index.html')) {
        basePath = basePath.replace('/index.html', '');
    } else if (basePath.endsWith('index.html')) {
        basePath = basePath.replace('index.html', '');
    }
    
    // Add widget.html
    const widgetUrl = window.location.origin + basePath + '/widget.html?match=' + matchIdToCopy;
    
    // Modern clipboard API with fallback
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(widgetUrl)
            .then(function() {
                showToast('✓ Ссылка виджета скопирована!');
            })
            .catch(function() {
                fallbackCopyTextToClipboard(widgetUrl);
            });
    } else {
        fallbackCopyTextToClipboard(widgetUrl);
    }
}


function copyWidgetUrl() {
    if (!matchId) {
        alert('Матч не выбран');
        return;
    }
    
    // Generate widget URL
    let basePath = window.location.pathname;
    
    // Remove trailing slash if present
    if (basePath.endsWith('/')) {
        basePath = basePath.slice(0, -1);
    }
    
    // Remove index.html if present
    if (basePath.endsWith('/index.html')) {
        basePath = basePath.replace('/index.html', '');
    } else if (basePath.endsWith('index.html')) {
        basePath = basePath.replace('index.html', '');
    }
    
    // Add widget.html
    const widgetUrl = window.location.origin + basePath + '/widget.html?match=' + matchId;
    
    // Copy to clipboard
    const copyMessage = document.getElementById('copyMessage');
    
    try {
        navigator.clipboard.writeText(widgetUrl).then(function() {
            showCopyMessage();
        }).catch(function() {
            fallbackCopyTextToClipboard(widgetUrl);
        });
    } catch (err) {
        fallbackCopyTextToClipboard(widgetUrl);
    }
    
    function showCopyMessage() {
        copyMessage.style.display = 'block';
        setTimeout(function() {
            copyMessage.style.display = 'none';
        }, 3000);
    }
}

function copyStatsWidgetUrl() {
    if (!matchId) {
        alert('Матч не выбран');
        return;
    }

    let basePath = window.location.pathname;
    if (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
    if (basePath.endsWith('/index.html')) {
        basePath = basePath.replace('/index.html', '');
    } else if (basePath.endsWith('index.html')) {
        basePath = basePath.replace('index.html', '');
    }

    const statsUrl = window.location.origin + basePath + '/goals-widget.html?match=' + matchId;

    try {
        navigator.clipboard.writeText(statsUrl).then(function() {
            showToast('📊 Ссылка на статистику скопирована!');
        }).catch(function() {
            fallbackCopyTextToClipboard(statsUrl);
        });
    } catch (err) {
        fallbackCopyTextToClipboard(statsUrl);
    }
}

function copyBroadcastWidgetUrl(res) {
    if (!matchId) {
        alert('Матч не выбран');
        return;
    }

    let basePath = window.location.pathname;
    if (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
    if (basePath.endsWith('/index.html')) {
        basePath = basePath.replace('/index.html', '');
    } else if (basePath.endsWith('index.html')) {
        basePath = basePath.replace('index.html', '');
    }

    let broadcastUrl = window.location.origin + basePath + '/broadcast-widget.html?match=' + matchId;
    if (res) broadcastUrl += '&res=' + res;

    try {
        navigator.clipboard.writeText(broadcastUrl).then(function() {
            showToast(res ? '🎬 Ссылка на трансляцию 2К скопирована!' : '🎬 Ссылка на трансляцию скопирована!');
        }).catch(function() {
            fallbackCopyTextToClipboard(broadcastUrl);
        });
    } catch (err) {
        fallbackCopyTextToClipboard(broadcastUrl);
    }
}

function copyVerticalWidgetUrl() {
    if (!matchId) {
        alert('Матч не выбран');
        return;
    }

    let basePath = window.location.pathname;
    if (basePath.endsWith('/')) basePath = basePath.slice(0, -1);
    if (basePath.endsWith('/index.html')) {
        basePath = basePath.replace('/index.html', '');
    } else if (basePath.endsWith('index.html')) {
        basePath = basePath.replace('index.html', '');
    }

    const url = window.location.origin + basePath + '/vertical-widget.html?match=' + matchId;

    try {
        navigator.clipboard.writeText(url).then(function() {
            showToast('📱 Ссылка на вертикальное табло 2К скопирована!');
        }).catch(function() {
            fallbackCopyTextToClipboard(url);
        });
    } catch (err) {
        fallbackCopyTextToClipboard(url);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showToast('✓ Скопировано!');
    } catch (err) {
        showToast('❌ Ошибка копирования');
    }
    
    document.body.removeChild(textArea);
}

function showToast(message) {
    // Create toast element
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 25px;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: bold;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(function() {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(function() {
            document.body.removeChild(toast);
        }, 300);
    }, 2000);
}

// loadChampionshipsForMatch removed — championship editing moved to match-edit-modal.js
