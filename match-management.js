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

        // Sort by date DESC (newest/future first)
        matches.sort(function(a, b) {
            const aDate = a.scheduledTime || a.createdAt || 0;
            const bDate = b.scheduledTime || b.createdAt || 0;
            return bDate - aDate; // Descending order
        });

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

function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function formatDate(dateString) {
    if (!dateString) return '';
    // dateString format: YYYY-MM-DD
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return `${parts[2]}.${parts[1]}.${parts[0]}`;  // DD.MM.YYYY
}

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
            <div class="match-info" style="font-family: monospace; font-size: 12px;">
                ID: ${matchIdShort} 
                <button onclick="event.stopPropagation(); copyMatchId('${match.id}');" style="border: none; background: none; cursor: pointer; padding: 2px 6px; font-size: 12px;">📋</button>
            </div>
            <div class="match-actions">
                <button class="button secondary" onclick="event.stopPropagation(); openMatch('${match.id}')">Открыть</button>
                <button class="button" onclick="event.stopPropagation(); copyWidgetLinkFromCard('${match.id}', event)">📋 Ссылка</button>
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

            // Update metadata
            updateMatchMetadata(match);

            // Update match date field
            if (match.matchDate) {
                document.getElementById('matchDateEdit').value = match.matchDate;
            } else {
                // Set to today's date as default
                const today = new Date();
                const todayString = today.getFullYear() + '-' + 
                                  String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                                  String(today.getDate()).padStart(2, '0');
                document.getElementById('matchDateEdit').value = todayString;
            }

            // Show/hide sections based on match status
            const isEnded = match.status === 'ended';
            document.getElementById('widgetUrlSection').style.display = isEnded ? 'none' : 'block';
            document.getElementById('timeControlsSection').style.display = isEnded ? 'none' : 'block';

            // Show widget URL (for non-ended matches)
            if (!isEnded) {
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
                document.getElementById('widgetUrl').value = widgetUrl;
            }

            // Update button states based on match status
            updateButtonStates(match);

            // Switch to control panel
            hideAllViews();
            document.getElementById('controlPanel').classList.add('active');

            // Listen for changes
            listenToMatchChanges();
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
    
    document.getElementById('metadataCreated').innerHTML = createdHtml;
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
    const urlInput = document.getElementById('widgetUrl');
    const copyMessage = document.getElementById('copyMessage');
    
    urlInput.select();
    urlInput.setSelectionRange(0, 99999);
    
    try {
        navigator.clipboard.writeText(urlInput.value).then(function() {
            showCopyMessage();
        }).catch(function() {
            document.execCommand('copy');
            showCopyMessage();
        });
    } catch (err) {
        document.execCommand('copy');
        showCopyMessage();
    }
    
    function showCopyMessage() {
        copyMessage.style.display = 'block';
        setTimeout(function() {
            copyMessage.style.display = 'none';
        }, 3000);
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
