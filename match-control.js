// ========================================
// MATCH CREATION & EDITING
// ========================================

function startMatch() {
    const team1Name = document.getElementById('team1Name').value.trim();
    const team2Name = document.getElementById('team2Name').value.trim();
    const team1Color = document.getElementById('team1Color').value;
    const team2Color = document.getElementById('team2Color').value;
    const matchDateTime = document.getElementById('matchDateTime').value;

    if (!team1Name || !team2Name) {
        alert('Пожалуйста, введите названия обеих команд');
        return;
    }

    if (!currentUser) {
        alert('Ошибка: пользователь не авторизован');
        return;
    }

    // Generate unique match ID
    matchId = 'match_' + Date.now();

    // Parse scheduled time if provided
    let scheduledTime = null;
    let matchDate = null;
    let initialStatus = 'waiting';
    
    if (matchDateTime) {
        scheduledTime = new Date(matchDateTime).getTime();
        // Extract date only (YYYY-MM-DD format)
        const dateObj = new Date(matchDateTime);
        matchDate = dateObj.getFullYear() + '-' + 
                   String(dateObj.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(dateObj.getDate()).padStart(2, '0');
        
        if (scheduledTime > Date.now()) {
            initialStatus = 'scheduled';
        }
    }

    // Prepare match data
    const matchData = {
        team1Name: team1Name,
        team2Name: team2Name,
        team1Logo: team1Logo || '',
        team2Logo: team2Logo || '',
        team1Color: team1Color,
        team2Color: team2Color,
        score1: 0,
        score2: 0,
        time: '00:00:00',
        status: initialStatus,
        currentHalf: 0,
        startTime: 0,
        scheduledTime: scheduledTime,
        matchDate: matchDate,
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email || '',
        createdAt: Date.now(),
        matchStartedAt: null  // Will be set when match actually starts
    };

    // Save to Firebase
    database.ref('matches/' + matchId).set(matchData)
        .then(function() {
            // Update display
            document.getElementById('team1NameDisplay').textContent = team1Name;
            document.getElementById('team2NameDisplay').textContent = team2Name;

            // Show widget URL (use same logic as openMatch)
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

            // Switch to control panel
            hideAllViews();
            document.getElementById('controlPanel').classList.add('active');

            // Show appropriate button
            if (initialStatus === 'scheduled' || initialStatus === 'waiting') {
                document.getElementById('startHalf1Btn').classList.remove('hidden');
            }

            // Listen for changes
            listenToMatchChanges();

            // Clear form
            clearSetupForm();
        })
        .catch(function(error) {
            alert('Ошибка создания матча: ' + error.message);
        });
}

function clearSetupForm() {
    document.getElementById('team1Name').value = '';
    document.getElementById('team2Name').value = '';
    document.getElementById('matchDateTime').value = '';
    document.getElementById('team1Logo').value = '';
    document.getElementById('team2Logo').value = '';
    document.getElementById('team1Color').value = '#08399A';
    document.getElementById('team2Color').value = '#4A90E2';
    document.getElementById('team1Preview').classList.add('hidden');
    document.getElementById('team2Preview').classList.add('hidden');
    team1Logo = null;
    team2Logo = null;
}

// ========================================
// SCORE MANAGEMENT
// ========================================

function changeScore(team, delta) {
    if (!matchId) return;

    database.ref('matches/' + matchId).once('value').then(function(snapshot) {
        const matchData = snapshot.val();
        if (matchData) {
            const scoreKey = 'score' + team;
            const newScore = Math.max(0, matchData[scoreKey] + delta);
            
            const updates = {};
            updates[scoreKey] = newScore;
            
            database.ref('matches/' + matchId).update(updates);
        }
    });
}

// ========================================
// TIME MANAGEMENT
// ========================================

function startHalf(half) {
    if (!matchId) return;

    // Get current date for matchDate if not already set
    const today = new Date();
    const matchDateToday = today.getFullYear() + '-' + 
                          String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(today.getDate()).padStart(2, '0');

    const updates = {
        currentHalf: half,
        status: 'playing',
        startTime: Date.now(),
        time: '00:00:00',
        scheduledTime: null  // Clear scheduled time when match actually starts
    };

    // Only set matchStartedAt on first half
    if (half === 1) {
        updates.matchStartedAt = Date.now();
    }

    // Set matchDate if not already set (from scheduled date or current date)
    database.ref('matches/' + matchId).once('value').then(function(snapshot) {
        const matchData = snapshot.val();
        if (!matchData.matchDate) {
            updates.matchDate = matchDateToday;
        }

        database.ref('matches/' + matchId).update(updates).then(function() {
            // Update buttons
            document.getElementById('startHalf' + half + 'Btn').classList.add('hidden');
            document.getElementById('stopHalf' + half + 'Btn').classList.remove('hidden');
            document.getElementById('endMatchBtn').classList.remove('hidden');

            currentHalf = half;
            
            // Start timer sync (updates every 10 seconds)
            startTimerSync();
        });
    });
}

// Timer sync for control panel
let timerSyncInterval = null;

function startTimerSync() {
    // Clear existing interval
    if (timerSyncInterval) {
        clearInterval(timerSyncInterval);
    }
    
    // Update timer every 10 seconds
    timerSyncInterval = setInterval(function() {
        if (!matchId) {
            stopTimerSync();
            return;
        }
        
        database.ref('matches/' + matchId).once('value').then(function(snapshot) {
            const matchData = snapshot.val();
            if (!matchData || matchData.status !== 'playing') {
                stopTimerSync();
                return;
            }
            
            // Calculate current time
            const elapsed = Date.now() - matchData.startTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            
            const displaySeconds = String(seconds % 60).padStart(2, '0');
            const displayMinutes = String(minutes % 60).padStart(2, '0');
            const displayHours = String(hours).padStart(2, '0');
            
            const timeString = `${displayHours}:${displayMinutes}:${displaySeconds}`;
            
            // Update Firebase (for reference, widgets calculate their own)
            database.ref('matches/' + matchId + '/time').set(timeString);
        });
    }, 10000); // Every 10 seconds
}

function stopTimerSync() {
    if (timerSyncInterval) {
        clearInterval(timerSyncInterval);
        timerSyncInterval = null;
    }
}

function stopHalf(half) {
    if (!matchId) return;

    const updates = {
        status: 'half' + half + '_ended'
    };

    database.ref('matches/' + matchId).update(updates).then(function() {
        // Stop timer sync
        stopTimerSync();
        
        // Update buttons
        document.getElementById('stopHalf' + half + 'Btn').classList.add('hidden');
        
        if (half === 1) {
            document.getElementById('startHalf2Btn').classList.remove('hidden');
            // Show halftime popup
            showHalftimePopup();
        }
    });
}

// ========================================
// HALFTIME POPUP
// ========================================

let halftimeTimerInterval = null;
let halftimeSecondsRemaining = 300; // 5 minutes

function showHalftimePopup() {
    // Reset timer
    halftimeSecondsRemaining = 300; // 5 minutes
    
    // Show popup
    document.getElementById('halftimePopup').style.display = 'block';
    
    // Start countdown
    updateHalftimeTimer();
    halftimeTimerInterval = setInterval(function() {
        halftimeSecondsRemaining--;
        updateHalftimeTimer();
        
        if (halftimeSecondsRemaining <= 0) {
            clearInterval(halftimeTimerInterval);
            halftimeTimerInterval = null;
            // Timer finished but don't auto-close
        }
    }, 1000);
}

function updateHalftimeTimer() {
    const minutes = Math.floor(halftimeSecondsRemaining / 60);
    const seconds = halftimeSecondsRemaining % 60;
    const display = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    document.getElementById('halftimeTimer').textContent = display;
    
    // Change color when time runs out
    if (halftimeSecondsRemaining <= 0) {
        document.getElementById('halftimeTimer').style.color = '#ef4444'; // Red
    } else {
        document.getElementById('halftimeTimer').style.color = '#3b82f6'; // Blue
    }
}

function closeHalftimePopup() {
    document.getElementById('halftimePopup').style.display = 'none';
    if (halftimeTimerInterval) {
        clearInterval(halftimeTimerInterval);
        halftimeTimerInterval = null;
    }
}

function startSecondHalfFromPopup() {
    closeHalftimePopup();
    startHalf(2);
}

function endMatchFromPopup() {
    closeHalftimePopup();
    endMatch();
}

function endMatch() {
    if (!matchId) return;

    const updates = {
        status: 'ended'
    };

    database.ref('matches/' + matchId).update(updates).then(function() {
        // Stop timer sync
        stopTimerSync();
        
        // Hide all half buttons
        document.getElementById('stopHalf1Btn').classList.add('hidden');
        document.getElementById('stopHalf2Btn').classList.add('hidden');
        document.getElementById('startHalf2Btn').classList.add('hidden');
        document.getElementById('endMatchBtn').classList.add('hidden');
    });
}

// ========================================
// TEAM MANAGEMENT
// ========================================

function loadSavedTeams() {
    if (!currentUser) return;

    // Load ALL teams (not filtered by user)
    database.ref('teams').once('value')
        .then(function(snapshot) {
            const team1Select = document.getElementById('team1Select');
            const team2Select = document.getElementById('team2Select');
            
            // Clear existing options except first
            team1Select.innerHTML = '<option value="">-- Выбрать из сохраненных --</option>';
            team2Select.innerHTML = '<option value="">-- Выбрать из сохраненных --</option>';

            snapshot.forEach(function(childSnapshot) {
                const team = childSnapshot.val();
                const teamId = childSnapshot.key;
                const option1 = document.createElement('option');
                const option2 = document.createElement('option');
                
                option1.value = teamId;
                option1.textContent = team.name;
                option2.value = teamId;
                option2.textContent = team.name;
                
                team1Select.appendChild(option1);
                team2Select.appendChild(option2);
            });
        });
}

function loadTeamData(teamNumber) {
    const selectId = 'team' + teamNumber + 'Select';
    const teamId = document.getElementById(selectId).value;
    
    if (!teamId) return;

    database.ref('teams/' + teamId).once('value')
        .then(function(snapshot) {
            const team = snapshot.val();
            if (team) {
                document.getElementById('team' + teamNumber + 'Name').value = team.name;
                document.getElementById('team' + teamNumber + 'Color').value = team.color || (teamNumber === 1 ? '#08399A' : '#4A90E2');
                
                if (team.logo) {
                    if (teamNumber === 1) {
                        team1Logo = team.logo;
                        document.getElementById('team1Preview').src = team.logo;
                        document.getElementById('team1Preview').classList.remove('hidden');
                    } else {
                        team2Logo = team.logo;
                        document.getElementById('team2Preview').src = team.logo;
                        document.getElementById('team2Preview').classList.remove('hidden');
                    }
                }
            }
        });
}

function saveTeamData(teamNumber) {
    const name = document.getElementById('team' + teamNumber + 'Name').value.trim();
    const color = document.getElementById('team' + teamNumber + 'Color').value;
    const logo = teamNumber === 1 ? team1Logo : team2Logo;

    if (!name) {
        alert('Введите название команды');
        return;
    }

    if (!currentUser) {
        alert('Ошибка: пользователь не авторизован');
        return;
    }

    // Check if team already exists
    database.ref('teams').orderByChild('name').equalTo(name).once('value')
        .then(function(snapshot) {
            let teamId = null;
            snapshot.forEach(function(childSnapshot) {
                const team = childSnapshot.val();
                if (team.createdBy === currentUser.uid) {
                    teamId = childSnapshot.key;
                }
            });

            const teamData = {
                name: name,
                color: color,
                logo: logo || '',
                createdBy: currentUser.uid,
                updatedAt: Date.now()
            };

            if (teamId) {
                // Update existing team
                database.ref('teams/' + teamId).update(teamData)
                    .then(function() {
                        showToast('✓ Команда обновлена!');
                        loadSavedTeams();
                    });
            } else {
                // Create new team
                teamData.createdAt = Date.now();
                database.ref('teams').push(teamData)
                    .then(function() {
                        showToast('✓ Команда сохранена!');
                        loadSavedTeams();
                    });
            }
        })
        .catch(function(error) {
            alert('Ошибка сохранения команды: ' + error.message);
        });
}

// ========================================
// MATCH DATE UPDATE
// ========================================

function updateMatchDate() {
    if (!matchId) {
        alert('Матч не выбран');
        return;
    }

    const newDate = document.getElementById('matchDateEdit').value;
    if (!newDate) {
        alert('Выберите дату');
        return;
    }

    database.ref('matches/' + matchId).update({
        matchDate: newDate
    })
    .then(function() {
        showToast('✓ Дата матча обновлена!');
    })
    .catch(function(error) {
        alert('Ошибка обновления даты: ' + error.message);
    });
}

