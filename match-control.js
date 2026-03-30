// ========================================
// MATCH CREATION & EDITING
// ========================================

function startMatch() {
    const team1Name = document.getElementById('team1Name').value.trim();
    const team2Name = document.getElementById('team2Name').value.trim();
    const team1Color = document.getElementById('team1Color').value;
    const team2Color = document.getElementById('team2Color').value;
    const matchDateTime = document.getElementById('matchDateTime').value;
    const championshipTitle = document.getElementById('championshipTitle').value.trim();

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
        // datetime-local input gives "YYYY-MM-DDTHH:MM" with no timezone.
        // new Date() would treat it as UTC, shifting the time by the local offset.
        // Parse manually so it's always interpreted as local time.
        const [datePart, timePart] = matchDateTime.split('T');
        const [year, month, day]   = datePart.split('-').map(Number);
        const [hour, minute]       = (timePart || '00:00').split(':').map(Number);
        const localDate = new Date(year, month - 1, day, hour, minute);

        scheduledTime = localDate.getTime();
        matchDate     = datePart;  // already YYYY-MM-DD — no timezone shift needed

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
        championshipTitle: championshipTitle || '',
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email || '',
        createdAt: Date.now(),
        matchStartedAt: null  // Will be set when match actually starts
    };

    // Save to Firebase
    database.ref('matches/' + matchId).set(matchData)
        .then(function() {
            // Clear form and return to match list — user can open from there
            clearSetupForm();
            hideAllViews();
            document.getElementById('dashboard').classList.add('active');
            showToast('✓ Матч сохранён! Откройте его из списка.');
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

function updateMatchChampionship() {
    if (!matchId) {
        alert('Матч не выбран');
        return;
    }

    const championshipSelect = document.getElementById('matchChampionshipEdit');
    const championshipTitle = championshipSelect.options[championshipSelect.selectedIndex].text;
    
    if (!championshipTitle || championshipTitle === '-- Выберите чемпионат --') {
        alert('Выберите чемпионат');
        return;
    }

    database.ref('matches/' + matchId).update({
        championshipTitle: championshipTitle
    })
    .then(function() {
        showToast('✓ Чемпионат обновлен!');
        // The match data will update automatically via Firebase listeners
        // No need to reload - the real-time listener handles it
    })
    .catch(function(error) {
        alert('Ошибка обновления чемпионата: ' + error.message);
    });
}

function downloadTeamRoster() {
    // Get default team from settings
    firebase.database().ref('settings/defaultTeam').once('value')
        .then(snapshot => {
            const defaultTeam = snapshot.val();
            
            if (!defaultTeam) {
                alert('Пожалуйста, выберите команду по умолчанию на странице "Состав"');
                return;
            }
            
            // Show loading message
            showToast('Подготовка состава команды...');
            
            // Generate roster thumbnail using helper
            generateRosterThumbnailHelper(defaultTeam, function(blob, teamName) {
                if (blob) {
                    // Download the image
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `roster-${teamName}.png`;
                    link.click();
                    URL.revokeObjectURL(url);
                    
                    showToast('✓ Состав команды скачан!');
                } else {
                    alert('Ошибка создания изображения');
                }
            });
        })
        .catch(error => {
            alert('Ошибка загрузки настроек: ' + error.message);
        });
}

// ========================================
// CHAMPIONSHIP MANAGEMENT
// ========================================

function saveChampionshipTitle() {
    const title = document.getElementById('championshipTitle').value.trim();
    
    if (!title) {
        alert('Введите название чемпионата');
        return;
    }
    
    const championshipId = 'champ_' + Date.now();
    const championshipData = {
        title: title,
        createdAt: Date.now()
    };
    
    database.ref('championships/' + championshipId).set(championshipData)
        .then(function() {
            showToast('✓ Чемпионат сохранен!');
            loadChampionships();
        })
        .catch(function(error) {
            alert('Ошибка сохранения: ' + error.message);
        });
}

function loadChampionships() {
    database.ref('championships').once('value').then(function(snapshot) {
        const select = document.getElementById('championshipSelect');
        select.innerHTML = '<option value="">-- Выбрать из сохраненных --</option>';
        
        snapshot.forEach(function(childSnapshot) {
            const championship = childSnapshot.val();
            const option = document.createElement('option');
            option.value = childSnapshot.key;
            option.textContent = championship.title;
            select.appendChild(option);
        });
    });
}

function loadChampionshipTitle() {
    const select = document.getElementById('championshipSelect');
    const championshipId = select.value;
    
    if (!championshipId) {
        document.getElementById('championshipTitle').value = '';
        return;
    }
    
    database.ref('championships/' + championshipId).once('value').then(function(snapshot) {
        const championship = snapshot.val();
        if (championship) {
            document.getElementById('championshipTitle').value = championship.title;
        }
    });
}

// ========================================
// THUMBNAIL GENERATOR
// ========================================

function generateThumbnail() {
    if (!matchId) return;

    database.ref('matches/' + matchId).once('value').then(function(snapshot) {
        const match = snapshot.val();
        if (!match) return;

        const champTitle = (match.championshipTitle || '').trim();

        function drawWithChampLogo(champLogoImg) {
            const canvas = document.getElementById('thumbnailCanvas');
            const ctx    = canvas.getContext('2d');

            // ── 2560×1440 with full SCALE system (same as championship thumbnail) ──
            const W = 2560, H = 1440;
            canvas.width  = W;
            canvas.height = H;
            const SCALE = W / 1280;  // = 2

            // ── Background ──
            const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.65);
             bgGrad.addColorStop(0, 'rgba(25, 71, 186, 0.8)');
             bgGrad.addColorStop(1, 'rgba(0, 51, 160, 0.90)');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // ── Header — identical to championship thumbnail ──
            const headerH  = Math.round(100 * SCALE);
            const logoSize = Math.round(68  * SCALE);
            const pad      = (headerH - logoSize) / 2;

            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(0, 0, W, headerH);

            if (champLogoImg && champLogoImg.naturalWidth > 0) {
                const scale = logoSize / Math.max(champLogoImg.naturalWidth, champLogoImg.naturalHeight);
                const lw    = champLogoImg.naturalWidth  * scale;
                const lh    = champLogoImg.naturalHeight * scale;
                const lx    = pad;
                const ly    = (headerH - lh) / 2;
                const lpad  = logoSize * 0.1;

                ctx.fillStyle     = 'white';
                ctx.shadowColor   = 'rgba(0,0,0,0.12)';
                ctx.shadowBlur    = Math.round(6 * SCALE);
                ctx.shadowOffsetY = Math.round(2 * SCALE);
                ctx.beginPath();
                ctx.roundRect(lx - lpad, ly - lpad, lw + lpad * 2, lh + lpad * 2, Math.round(8 * SCALE));
                ctx.fill();
                ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
                ctx.drawImage(champLogoImg, lx, ly, lw, lh);
            }

            // Title centred across full width (same as championship)
            ctx.fillStyle    = 'white';
            ctx.font         = `bold ${Math.round(52 * SCALE)}px Calibri, sans-serif`;
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(champTitle || 'ФУТБОЛ', W / 2, headerH / 2);

            // ── Load team logos then draw body ──
            const toLoad = [];
            if (match.team1Logo) toLoad.push({ key: 't1', src: match.team1Logo });
            if (match.team2Logo) toLoad.push({ key: 't2', src: match.team2Logo });

            const loaded = {};
            let count = 0;

            function onLoaded() {
                if (++count === toLoad.length || toLoad.length === 0) drawBody();
            }

            function drawBody() {
                // ── Team logo squares ──
                const squareSize = Math.round(200 * SCALE);
                const squareY    = H / 2 - Math.round(100 * SCALE);
                const cx1 = W / 2 - Math.round(350 * SCALE);
                const cx2 = W / 2 + Math.round(350 * SCALE);

                function drawTeamSquare(img, cx) {
                    const sqX = cx - squareSize / 2;
                    const r   = squareSize * 0.18;
                    ctx.fillStyle     = 'white';
                    ctx.shadowColor   = 'rgba(0,0,0,0.15)';
                    ctx.shadowBlur    = Math.round(12 * SCALE);
                    ctx.shadowOffsetY = Math.round(4  * SCALE);
                    ctx.beginPath();
                    ctx.roundRect(sqX, squareY, squareSize, squareSize, r);
                    ctx.fill();
                    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

                    if (img && img.naturalWidth > 0) {
                        // Fit to available area with 10% padding — identical to championship thumbnail
                        const pad   = squareSize * 0.1;
                        const avail = squareSize - pad * 2;
                        const s     = Math.min(avail / img.naturalWidth, avail / img.naturalHeight);
                        const w     = img.naturalWidth  * s;
                        const h     = img.naturalHeight * s;
                        ctx.drawImage(img, sqX + (squareSize - w) / 2, squareY + (squareSize - h) / 2, w, h);
                    }
                }

                drawTeamSquare(loaded['t1'] || null, cx1);
                drawTeamSquare(loaded['t2'] || null, cx2);

                // ── VS ──
                ctx.fillStyle    = 'white';
                ctx.font         = `bold ${Math.round(60 * SCALE)}px Calibri, sans-serif`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('VS', W / 2, H / 2 + Math.round(20 * SCALE));

                // ── Team names ──
                ctx.font         = `bold ${Math.round(48 * SCALE)}px Calibri, sans-serif`;
                ctx.textBaseline = 'top';
                ctx.fillText(match.team1Name || '', cx1, squareY + squareSize + Math.round(20 * SCALE));
                ctx.fillText(match.team2Name || '', cx2, squareY + squareSize + Math.round(20 * SCALE));

                // ── Date ──
                let dateStr = '';
                if (match.scheduledTime) {
                    const d = new Date(match.scheduledTime);
                    dateStr = String(d.getDate()).padStart(2,'0') + '.' +
                              String(d.getMonth()+1).padStart(2,'0') + '.' +
                              d.getFullYear() + ' в ' +
                              String(d.getHours()).padStart(2,'0') + ':' +
                              String(d.getMinutes()).padStart(2,'0');
                } else if (match.matchDate) {
                    const p = match.matchDate.split('-');
                    dateStr = p[2] + '.' + p[1] + '.' + p[0];
                }
                if (dateStr) {
                    ctx.font         = `${Math.round(44 * SCALE)}px Calibri, sans-serif`;
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(dateStr, W / 2, H - Math.round(60 * SCALE));
                }

                // ── Download ──
                canvas.toBlob(function(blob) {
                    const url  = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href     = url;
                    link.download = `match-thumbnail-${match.team1Name}-vs-${match.team2Name}.png`;
                    link.click();
                    URL.revokeObjectURL(url);
                    showToast('✓ Заставка скачана!');
                });
            }

            if (toLoad.length === 0) { drawBody(); return; }
            toLoad.forEach(function(item) {
                const img = new Image();
                img.onload  = function() { loaded[item.key] = img; onLoaded(); };
                img.onerror = function() { onLoaded(); };
                img.src = item.src;
            });
        }

        // Fetch championship logo if title exists
        if (champTitle) {
            database.ref('championships').orderByChild('title').equalTo(champTitle)
                .once('value').then(function(snap) {
                    let logoSrc = null;
                    snap.forEach(function(child) { if (child.val().logo) logoSrc = child.val().logo; });
                    if (logoSrc) {
                        const img = new Image();
                        img.onload  = function() { drawWithChampLogo(img); };
                        img.onerror = function() { drawWithChampLogo(null); };
                        img.src = logoSrc;
                    } else {
                        drawWithChampLogo(null);
                    }
                }).catch(function() { drawWithChampLogo(null); });
        } else {
            drawWithChampLogo(null);
        }
    });
}

// Load championships on page load
if (typeof window !== 'undefined') {
    window.addEventListener('load', function() {
        loadChampionships();
    });
}
