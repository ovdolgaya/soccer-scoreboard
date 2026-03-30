// ========================================
// MATCH DASHBOARD & LIST MANAGEMENT
// ========================================

let currentMatchesDisplayed = 10; // Show 10 initially
const MATCHES_PER_PAGE = 10;
let allMatchesCache = []; // Store all matches for pagination

function loadMatches(reset = true) {
    const matchListDiv = document.getElementById('matchList');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const hidePast = document.getElementById('hidePastMatches') ? document.getElementById('hidePastMatches').checked : false;
    
    if (reset) {
        currentMatchesDisplayed = MATCHES_PER_PAGE;
        matchListDiv.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Загрузка матчей...</div>';
    }

    // Remove old listener if exists
    if (matchListListener && reset) {
        database.ref('matches').off('value', matchListListener);
    }

    // Set up real-time listener for ALL matches (not filtered by user)
    matchListListener = database.ref('matches').on('value', function(snapshot) {
        const matches = [];
        snapshot.forEach(function(childSnapshot) {
            const match = childSnapshot.val();
            match.id = childSnapshot.key;
            
            // Filter out ended matches if toggle is on
            if (hidePast && match.status === 'ended') {
                return; // skip this match
            }
            
            matches.push(match);
        });

        // Sort: upcoming first (soonest), then played desc by matchDate
        sortMatches(matches);

        // Cache all matches
        allMatchesCache = matches;

        // Display matches
        displayMatches();
    }, function(error) {
        matchListDiv.innerHTML = '<div style="color: #f44336; padding: 20px;">Ошибка загрузки: ' + error.message + '</div>';
    });
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

    // Get matches to display (limited by currentMatchesDisplayed)
    const matchesToShow = allMatchesCache.slice(0, currentMatchesDisplayed);
    matchListDiv.innerHTML = matchesToShow.map(renderMatchCard).join('');

    // Show/hide "Load More" button
    if (loadMoreBtn) {
        if (allMatchesCache.length > currentMatchesDisplayed) {
            loadMoreBtn.style.display = 'block';
            const remaining = allMatchesCache.length - currentMatchesDisplayed;
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

function openMatch(matchIdToOpen) {
    matchId = matchIdToOpen;
    
    database.ref('matches/' + matchId).once('value')
        .then(function(snapshot) {
            const match = snapshot.val();
            if (!match) {
                alert('Матч не найден');
                return;
            }

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

            // Update metadata (created/started timestamps — kept in memory, not shown in UI)
            updateMatchMetadata(match);

            // Show/hide sections based on match status
            const isEnded = match.status === 'ended';

            // Hide time controls for ended matches
            const timeControlsSection = document.getElementById('timeControlsSection');
            if (timeControlsSection) {
                timeControlsSection.style.display = isEnded ? 'none' : 'block';
            }

            // Show goals stats only for ended matches
            const goalsStatsSection = document.getElementById('goalsStatsSection');
            if (goalsStatsSection) {
                if (isEnded) {
                    goalsStatsSection.style.display = 'block';
                    loadGoalsStats(matchId);
                } else {
                    goalsStatsSection.style.display = 'none';
                }
            }

            // Update button states based on match status
            updateButtonStates(match);

            // Switch to control panel
            hideAllViews();
            document.getElementById('controlPanel').classList.add('active');

            // Listen for changes
            listenToMatchChanges();
            // Init goal tracking (loads default team + players)
            if (typeof initGoalTracking === 'function') initGoalTracking();
        })
        .catch(function(error) {
            alert('Ошибка открытия матча: ' + error.message);
        });
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
    document.getElementById('stopHalf2Btn').classList.add('hidden');
    document.getElementById('endMatchBtn').classList.add('hidden');

    if (actualStatus === 'scheduled' || actualStatus === 'waiting') {
        // Can start even if scheduled for future
        document.getElementById('startHalf1Btn').classList.remove('hidden');
    } else if (actualStatus === 'playing') {
        if (match.currentHalf === 1) {
            document.getElementById('stopHalf1Btn').classList.remove('hidden');
        } else if (match.currentHalf === 2) {
            document.getElementById('stopHalf2Btn').classList.remove('hidden');
        }
        document.getElementById('endMatchBtn').classList.remove('hidden');
    } else if (actualStatus === 'half1_ended') {
        document.getElementById('startHalf2Btn').classList.remove('hidden');
    } else if (actualStatus === 'half2_ended') {
        // Second half ended, show end match button
        document.getElementById('endMatchBtn').classList.remove('hidden');
    }
}

// ========================================
// GOALS STATISTICS (ended matches only)
// ========================================

function loadGoalsStats(forMatchId) {
    const body = document.getElementById('goalsStatsBody');
    if (!body) return;

    body.innerHTML = '<div style="padding:16px 20px; color:#94a3b8; font-size:14px;">Загрузка...</div>';

    // Fetch goals for this match
    database.ref('goals').orderByChild('matchId').equalTo(forMatchId).once('value')
        .then(function(goalsSnap) {
            const goals = [];
            goalsSnap.forEach(function(child) {
                const g = child.val();
                g._key = child.key;
                goals.push(g);
            });

            if (goals.length === 0) {
                body.innerHTML = '<div style="padding:16px 20px; color:#94a3b8; font-size:14px; font-style:italic;">Голов не зафиксировано</div>';
                return;
            }

            // Sort by half then by matchTime string (lexicographic works for MM:SS)
            goals.sort(function(a, b) {
                if ((a.half || 0) !== (b.half || 0)) return (a.half || 0) - (b.half || 0);
                return (a.matchTime || '').localeCompare(b.matchTime || '');
            });

            // Collect unique playerIds we need to look up
            const playerIds = [...new Set(
                goals.filter(function(g) { return g.playerId; }).map(function(g) { return g.playerId; })
            )];

            // Fetch all players in parallel (works for soft-deleted too)
            const playerFetches = playerIds.map(function(pid) {
                return database.ref('players/' + pid).once('value').then(function(snap) {
                    return { id: pid, data: snap.val() };
                });
            });

            return Promise.all(playerFetches).then(function(playerResults) {
                const players = {};
                playerResults.forEach(function(r) {
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

    goals.forEach(function(g) {
        // Half separator
        if (g.half && g.half !== currentHalf) {
            currentHalf = g.half;
            const halfLabel = g.half === 1 ? '1-й тайм' : g.half === 2 ? '2-й тайм' : (g.half + '-й тайм');
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

        // Alternating row background
        const rowBg = 'background: transparent;';

        html += '<div style="display:flex; align-items:center; gap:0; padding:10px 20px; ' +
                'border-bottom:1px solid #f1f5f9; ' + rowBg + '">' +

                // Match time
                '<div style="width:56px; flex-shrink:0; font-size:13px; font-weight:700; ' +
                'color:#64748b; font-family:monospace;">' + timeStr + '</div>' +

                // Divider
                '<div style="width:1px; height:28px; background:#e2e8f0; margin-right:16px; flex-shrink:0;"></div>' +

                // Player number badge
                '<div style="flex-shrink:0; background:#08399A; color:#fff; border-radius:6px; ' +
                'padding:3px 8px; font-size:12px; font-weight:800; margin-right:12px; ' +
                'min-width:36px; text-align:center;">' + playerNumber + '</div>' +

                // Player name
                '<div style="flex:1; font-size:14px; font-weight:600; color:#1e293b;">' + playerName + '</div>' +

                // Ball icon
                '<div style="font-size:16px; flex-shrink:0;">⚽</div>' +

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

function listenToMatchChanges() {
    database.ref('matches/' + matchId).on('value', function(snapshot) {
        const matchData = snapshot.val();
        if (matchData) {
            // Update score display
            document.getElementById('score1').textContent = matchData.score1;
            document.getElementById('score2').textContent = matchData.score2;
        }
    });
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

function copyMatchId(matchIdToCopy) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(matchIdToCopy)
            .then(function() {
                showToast('✓ ID матча скопирован!');
            })
            .catch(function() {
                fallbackCopyTextToClipboard(matchIdToCopy);
            });
    } else {
        fallbackCopyTextToClipboard(matchIdToCopy);
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

// ========================================
// LOAD CHAMPIONSHIPS FOR MATCH EDIT
// ========================================

function loadChampionshipsForMatch(currentChampionship) {
    const select = document.getElementById('matchChampionshipEdit');
    select.innerHTML = '<option value="">-- Выберите чемпионат --</option>';
    
    database.ref('championships').once('value')
        .then(function(snapshot) {
            const championships = [];
            snapshot.forEach(function(childSnapshot) {
                championships.push(childSnapshot.val());
            });
            
            // Sort by title
            championships.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
            
            // Add options
            championships.forEach(function(championship) {
                const option = document.createElement('option');
                option.value = championship.title;
                option.textContent = championship.title;
                
                // Select current championship if it matches
                if (championship.title === currentChampionship) {
                    option.selected = true;
                }
                
                select.appendChild(option);
            });
        })
        .catch(function(error) {
            console.error('Error loading championships:', error);
        });
}
