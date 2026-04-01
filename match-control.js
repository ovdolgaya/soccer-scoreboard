// ========================================
// MATCH CONTROL — score, time, halftime
// Match creation/editing handled by match-edit-modal.js
// ========================================

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
// THUMBNAIL GENERATOR
// ========================================

function generateThumbnail() {
    if (!matchId) return;

    // Use cached match data — already downloaded, no extra read
    const match = (_matchDataCache && _matchDataCache[matchId]) ? _matchDataCache[matchId] : null;

    function proceedWithMatch(match) {
        if (!match) return;
        const champTitle = (match.championshipTitle || '').trim();

        // Fetch team data (logo + color) from /teams — use teamId if available,
        // fall back to embedded logos for old records that haven't been migrated yet
        function fetchTeamData(teamId, fallbackLogo, fallbackColor) {
            if (teamId) {
                return database.ref('teams/' + teamId).once('value').then(function(snap) {
                    const t = snap.val() || {};
                    return { logo: t.logo || '', color: t.color || '#08399A' };
                });
            }
            return Promise.resolve({ logo: fallbackLogo || '', color: fallbackColor || '#08399A' });
        }

        Promise.all([
            fetchTeamData(match.team1Id, match.team1Logo, match.team1Color),
            fetchTeamData(match.team2Id, match.team2Logo, match.team2Color)
        ]).then(function(teams) {
            const t1 = teams[0], t2 = teams[1];

            function drawWithChampLogo(champLogoImg) {
                const canvas = document.getElementById('thumbnailCanvas');
                const ctx    = canvas.getContext('2d');

                const W = 2560, H = 1440;
                canvas.width  = W;
                canvas.height = H;
                const SCALE = W / 1280;

                // ── Background ──
                const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.65);
                bgGrad.addColorStop(0, 'rgba(25, 71, 186, 0.8)');
                bgGrad.addColorStop(1, 'rgba(0, 51, 160, 0.90)');
                ctx.fillStyle = bgGrad;
                ctx.fillRect(0, 0, W, H);

                // ── Header ──
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

                ctx.fillStyle    = 'white';
                ctx.font         = `bold ${Math.round(52 * SCALE)}px Calibri, sans-serif`;
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(champTitle || 'ФУТБОЛ', W / 2, headerH / 2);

                // ── Load team logos then draw body ──
                const toLoad = [];
                if (t1.logo) toLoad.push({ key: 't1', src: t1.logo });
                if (t2.logo) toLoad.push({ key: 't2', src: t2.logo });

                const loaded = {};
                let count = 0;

                function onLoaded() {
                    if (++count === toLoad.length || toLoad.length === 0) drawBody();
                }

                function drawBody() {
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

                    ctx.fillStyle    = 'white';
                    ctx.font         = `bold ${Math.round(60 * SCALE)}px Calibri, sans-serif`;
                    ctx.textAlign    = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('VS', W / 2, H / 2 + Math.round(20 * SCALE));

                    ctx.font         = `bold ${Math.round(48 * SCALE)}px Calibri, sans-serif`;
                    ctx.textBaseline = 'top';
                    ctx.fillText(match.team1Name || '', cx1, squareY + squareSize + Math.round(20 * SCALE));
                    ctx.fillText(match.team2Name || '', cx2, squareY + squareSize + Math.round(20 * SCALE));

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

            // Fetch championship logo
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

    if (match) {
        proceedWithMatch(match);
    } else {
        // Fallback fetch if cache missed
        database.ref('matches/' + matchId).once('value').then(function(snapshot) {
            proceedWithMatch(snapshot.val());
        });
    }
}

