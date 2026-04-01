// roster.js - Player Roster Management
// Version 1.1 - Added Coach and Goalkeeper support

let currentDefaultTeam = null;
let currentDefaultTeamData = null;
let currentCoachData = null;
let allPlayers = [];
let editingPlayerId = null;

// ============================================
// PAGE-LEVEL CACHES
// ============================================

// Teams list — shared between dropdown and Команды tab.
// Invalidated whenever a team is created, edited, or deleted.
let _teamsCache = null;      // null = not loaded yet; [] = loaded but empty; [{...}] = data

// Players cache — keyed by teamId. Full records including photos (needed for roster UI).
// Invalidated by rosterCacheClear() which is already wired to all save/delete points.
const _playersPageCache = {};

// Coach cache — keyed by teamId.
const _coachCache = {};

// Default team setting — fetched once per page load.
let _defaultTeamSettingLoaded = false;

// Invalidate team-related caches (called after team create/edit/delete)
function _invalidateTeamsCache() {
    _teamsCache = null;
}

// Clear page-level player + coach caches for a team.
// Call this alongside rosterCacheClear() at every save/delete point.
function _clearPageCaches(teamId) {
    if (teamId) {
        delete _playersPageCache[teamId];
        delete _coachCache[teamId];
    } else {
        Object.keys(_playersPageCache).forEach(k => delete _playersPageCache[k]);
        Object.keys(_coachCache).forEach(k => delete _coachCache[k]);
    }
}

// ============================================
// INITIALIZATION
// ============================================

firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        console.log('User authenticated:', user.email);
        initializeRoster();
    } else {
        console.log('No user authenticated, redirecting...');
        window.location.href = 'index.html';
    }
});

function initializeRoster() {
    loadTeamsDropdown();
    loadDefaultTeam();
}

// ============================================
// TEAM MANAGEMENT
// ============================================

function _fetchAllTeams() {
    // Return cached teams immediately if available
    if (_teamsCache !== null) return Promise.resolve(_teamsCache);

    return firebase.database().ref('teams').once('value').then(function(snapshot) {
        const teams = [];
        snapshot.forEach(function(child) {
            teams.push({ id: child.key, ...child.val() });
        });
        teams.sort((a, b) => a.name.localeCompare(b.name));
        _teamsCache = teams;
        return teams;
    });
}

function loadTeamsDropdown() {
    const select = document.getElementById('defaultTeamSelect');
    select.innerHTML = '<option value="">Загрузка команд...</option>';

    _fetchAllTeams()
        .then((teams) => {
            select.innerHTML = '<option value="">-- Выберите команду --</option>';
            teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.id;
                option.textContent = team.name;
                select.appendChild(option);
            });
            console.log(`Loaded ${teams.length} teams`);
        })
        .catch((error) => {
            console.error('Error loading teams:', error);
            select.innerHTML = '<option value="">Ошибка загрузки команд</option>';
            alert('Ошибка при загрузке команд: ' + error.message);
        });
}

function loadDefaultTeam() {
    // Only fetch settings once per page load
    if (_defaultTeamSettingLoaded) return;
    _defaultTeamSettingLoaded = true;

    firebase.database().ref('settings/defaultTeam').once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const teamId = snapshot.val();
                currentDefaultTeam = teamId;
                document.getElementById('defaultTeamSelect').value = teamId;

                // Use teams cache instead of separate fetch
                return _fetchAllTeams().then(function(teams) {
                    const team = teams.find(t => t.id === teamId);
                    return team || null;
                });
            }
            return null;
        })
        .then((team) => {
            if (team) {
                currentDefaultTeamData = team;
                displayCurrentTeam();
                loadPlayers();
            } else {
                showNoTeamState();
            }
        })
        .catch((error) => {
            console.error('Error loading default team:', error);
            showNoTeamState();
        });
}

function saveDefaultTeam() {
    const selectedTeamId = document.getElementById('defaultTeamSelect').value;

    if (!selectedTeamId) {
        alert('Пожалуйста, выберите команду');
        return;
    }

    firebase.database().ref('settings/defaultTeam').set(selectedTeamId)
        .then(() => {
            currentDefaultTeam = selectedTeamId;
            // Use teams cache — no extra Firebase read
            return _fetchAllTeams().then(function(teams) {
                return teams.find(t => t.id === selectedTeamId) || null;
            });
        })
        .then((team) => {
            if (team) {
                currentDefaultTeamData = team;
                displayCurrentTeam();
                loadPlayers();
                alert('Команда по умолчанию сохранена!');
            }
        })
        .catch((error) => {
            console.error('Error saving default team:', error);
            alert('Ошибка при сохранении: ' + error.message);
        });
}

function displayCurrentTeam() {
    if (!currentDefaultTeamData) {
        showNoTeamState();
        return;
    }

    document.getElementById('currentTeamLogo').src = currentDefaultTeamData.logo || '';
    document.getElementById('currentTeamName').textContent = currentDefaultTeamData.name;
    document.getElementById('currentTeamDisplay').style.display = 'flex';
    document.getElementById('coachInfoDisplay').style.display = 'flex';
    document.getElementById('badgeIconsSection').style.display = 'block';
    document.getElementById('playersSection').style.display = 'block';
    document.getElementById('noTeamState').style.display = 'none';

    // Update photo preview with team logo
    updatePhotoPreview();
    
    // Load coach data
    loadCoach();
    
    // Load badge icons
    loadBadgeIcons();
}

function showNoTeamState() {
    document.getElementById('currentTeamDisplay').style.display = 'none';
    document.getElementById('coachInfoDisplay').style.display = 'none';
    document.getElementById('badgeIconsSection').style.display = 'none';
    document.getElementById('playersSection').style.display = 'none';
    document.getElementById('noTeamState').style.display = 'block';
}

// ============================================
// TEAM SETTINGS TOGGLE
// ============================================

function toggleTeamSettings() {
    const content = document.getElementById('teamSettingsContent');
    const button = document.getElementById('toggleTeamSettingsBtn');
    const isHidden = content.classList.contains('hidden');
    
    if (isHidden) {
        content.classList.remove('hidden');
        button.innerHTML = '<i class="fas fa-chevron-up"></i> Свернуть';
    } else {
        content.classList.add('hidden');
        button.innerHTML = '<i class="fas fa-chevron-down"></i> Развернуть';
    }
}

// ============================================
// PLAYERS MANAGEMENT
// ============================================

function loadPlayers() {
    if (!currentDefaultTeam) {
        console.log('No default team selected');
        return;
    }

    // Serve from cache if available — cleared by _clearPageCaches() on any save/delete
    if (_playersPageCache[currentDefaultTeam]) {
        allPlayers = _playersPageCache[currentDefaultTeam];
        displayPlayers();
        return;
    }

    const playersRef = firebase.database().ref('players').orderByChild('teamId').equalTo(currentDefaultTeam);

    playersRef.once('value')
        .then((snapshot) => {
            allPlayers = [];

            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.isDeleted) return;
                allPlayers.push({
                    id: childSnapshot.key,
                    ...data
                });
            });

            allPlayers.sort((a, b) => a.number - b.number);

            // Cache for subsequent calls
            _playersPageCache[currentDefaultTeam] = allPlayers;

            console.log(`Loaded ${allPlayers.length} players for team ${currentDefaultTeam}`);
            displayPlayers();
        })
        .catch((error) => {
            console.error('Error loading players:', error);
            alert('Ошибка при загрузке игроков: ' + error.message);
        });
}

function displayPlayers() {
    const tbody = document.getElementById('playersTableBody');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.querySelector('.players-table-wrapper');
    const countBadge = document.getElementById('playersCount');

    // Update count
    countBadge.textContent = allPlayers.length;

    if (allPlayers.length === 0) {
        tableWrapper.style.display = 'none';
        emptyState.style.display = 'block';
        // Hide cards container if it exists
        const cardsContainer = document.getElementById('playersCards');
        if (cardsContainer) {
            cardsContainer.innerHTML = '';
        }
        return;
    }

    tableWrapper.style.display = 'block';
    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    // Create or get cards container for mobile
    let cardsContainer = document.getElementById('playersCards');
    if (!cardsContainer) {
        cardsContainer = document.createElement('div');
        cardsContainer.id = 'playersCards';
        cardsContainer.className = 'players-cards';
        tableWrapper.parentNode.insertBefore(cardsContainer, tableWrapper);
    }
    cardsContainer.innerHTML = '';
    // Don't set display style - let CSS handle it based on screen size

    allPlayers.forEach(player => {
        // ===== RENDER TABLE ROW (Desktop) =====
        const row = document.createElement('tr');
        
        // Photo
        const photoTd = document.createElement('td');
        photoTd.className = 'player-photo-cell';
        const photo = document.createElement('img');
        photo.src = player.photo || currentDefaultTeamData.logo;
        photo.alt = `${player.firstName} ${player.lastName}`;
        photo.className = 'player-photo';
        photoTd.appendChild(photo);
        row.appendChild(photoTd);

        // Number
        const numberTd = document.createElement('td');
        numberTd.className = 'player-number-cell';
        numberTd.innerHTML = `<div class="player-number">${player.number}</div>`;
        row.appendChild(numberTd);

        // First Name
        const firstNameTd = document.createElement('td');
        firstNameTd.innerHTML = `<span class="player-name">${player.firstName}</span>`;
        row.appendChild(firstNameTd);

        // Last Name
        const lastNameTd = document.createElement('td');
        lastNameTd.innerHTML = `<span class="player-name">${player.lastName}</span>`;
        row.appendChild(lastNameTd);

        // Position (Goalkeeper or Field Player)
        const positionTd = document.createElement('td');
        positionTd.className = 'player-position-cell';
        if (player.isGoalkeeper) {
            positionTd.innerHTML = `
                <span class="position-badge goalkeeper">
                    <i class="fas fa-hand-paper"></i>
                    Вратарь
                </span>
            `;
        } else {
            positionTd.innerHTML = `
                <span class="position-badge field-player">
                    <i class="fas fa-running"></i>
                    Полевой
                </span>
            `;
        }
        row.appendChild(positionTd);

        // Status (Present/Absent toggle)
        const statusTd = document.createElement('td');
        statusTd.className = 'player-status-cell';
        const isAbsent = player.isAbsent || false;
        const statusClass = isAbsent ? 'absent' : 'present';
        const statusIcon = isAbsent ? 'fa-times' : 'fa-check';
        const statusTitle = isAbsent ? 'Отсутствует' : 'Присутствует';
        statusTd.innerHTML = `
            <button class="status-toggle ${statusClass}" 
                    onclick="togglePlayerStatus('${player.id}')" 
                    title="${statusTitle}">
                <i class="fas ${statusIcon}"></i>
            </button>
        `;
        row.appendChild(statusTd);

        // Actions
        const actionsTd = document.createElement('td');
        actionsTd.innerHTML = `
            <div class="player-actions">
                <button onclick="editPlayer('${player.id}')" class="button" title="Редактировать">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deletePlayer('${player.id}')" class="button danger" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        row.appendChild(actionsTd);

        tbody.appendChild(row);

        // ===== RENDER MOBILE CARD =====
        const card = document.createElement('div');
        card.className = 'player-card';

        // Position badge icon (just icon, no text)
        const positionIcon = player.isGoalkeeper ? 
            '<i class="fas fa-hand-paper"></i>' : 
            '<i class="fas fa-running"></i>';
        const positionClass = player.isGoalkeeper ? 'goalkeeper' : 'field-player';

        card.innerHTML = `
            <div class="player-card-badge ${positionClass}">
                ${positionIcon}
            </div>
            
            <div class="player-card-content">
                <img src="${player.photo || currentDefaultTeamData.logo}" 
                     alt="${player.firstName} ${player.lastName}" 
                     class="player-card-photo">
                
                <div class="player-card-info">
                    <div class="player-card-number">#${player.number}</div>
                    <div class="player-card-name">${player.firstName} ${player.lastName}</div>
                </div>
            </div>

            <div class="player-card-actions">
                <button class="status-toggle ${statusClass}" 
                        onclick="togglePlayerStatus('${player.id}')" 
                        title="${statusTitle}">
                    <i class="fas ${statusIcon}"></i>
                </button>
                <button onclick="editPlayer('${player.id}')" class="button" title="Изменить">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deletePlayer('${player.id}')" class="button danger" title="Удалить">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        cardsContainer.appendChild(card);
    });
}

// ============================================
// ADD/EDIT PLAYER FORM
// ============================================

function toggleAddPlayerForm() {
    const modal = document.getElementById('playerModal');
    const isHidden = modal.classList.contains('hidden');
    
    if (isHidden) {
        resetPlayerForm();
        document.getElementById('formTitle').textContent = 'Добавить нового игрока';
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    } else {
        cancelAddPlayer();
    }
}

function cancelAddPlayer() {
    const modal = document.getElementById('playerModal');
    modal.classList.add('hidden');
    document.body.style.overflow = ''; // Restore scrolling
    resetPlayerForm();
}

function resetPlayerForm() {
    document.getElementById('playerNumber').value = '';
    document.getElementById('playerFirstName').value = '';
    document.getElementById('playerLastName').value = '';
    document.getElementById('playerIsGoalkeeper').checked = false;
    document.getElementById('playerPhotoInput').value = '';
    editingPlayerId = null;
    updatePhotoPreview();
}

function previewPlayerPhoto(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('playerPhotoPreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function clearPlayerPhoto() {
    document.getElementById('playerPhotoInput').value = '';
    updatePhotoPreview();
}

function updatePhotoPreview() {
    const preview = document.getElementById('playerPhotoPreview');
    if (currentDefaultTeamData && currentDefaultTeamData.logo) {
        preview.src = currentDefaultTeamData.logo;
    } else {
        preview.src = '';
    }
}

// ============================================
// SAVE PLAYER
// ============================================

function savePlayer() {
    const number = document.getElementById('playerNumber').value.trim();
    const firstName = document.getElementById('playerFirstName').value.trim();
    const lastName = document.getElementById('playerLastName').value.trim();
    const isGoalkeeper = document.getElementById('playerIsGoalkeeper').checked;
    const photoInput = document.getElementById('playerPhotoInput');

    // Validation
    if (!number || !firstName || !lastName) {
        alert('Пожалуйста, заполните все обязательные поля (Номер, Имя, Фамилия)');
        return;
    }

    const playerNumber = parseInt(number);
    if (isNaN(playerNumber) || playerNumber < 0 || playerNumber > 99) {
        alert('Номер игрока должен быть от 0 до 99');
        return;
    }

    // Check if number is already taken (exclude current player if editing)
    const existingPlayer = allPlayers.find(p => 
        p.number === playerNumber && p.id !== editingPlayerId
    );
    if (existingPlayer) {
        alert(`Номер ${playerNumber} уже занят игроком ${existingPlayer.firstName} ${existingPlayer.lastName}`);
        return;
    }

    const saveBtn = document.getElementById('savePlayerBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';

    // Prepare player data
    const playerData = {
        teamId: currentDefaultTeam,
        number: playerNumber,
        firstName: firstName,
        lastName: lastName,
        isGoalkeeper: isGoalkeeper,
        updatedAt: Date.now()
    };

    // If editing, preserve existing photo unless a new one is uploaded
    if (editingPlayerId) {
        const existingPlayerData = allPlayers.find(p => p.id === editingPlayerId);
        if (existingPlayerData && existingPlayerData.photo) {
            playerData.photo = existingPlayerData.photo; // Keep existing photo
        }
    }

    // Handle photo upload — resize to 400×400 before saving as base64
    if (photoInput.files.length > 0) {
        const file = photoInput.files[0];
        resizeImageFile(file, 400, 400, 0.88,
            function(dataUrl) {
                playerData.photo = dataUrl;
                savePlayerToFirebase(playerData, saveBtn);
            },
            function() {
                alert('Ошибка при чтении файла фото');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить игрока';
            }
        );
    } else {
        // No new photo uploaded, save with existing photo (if editing) or without photo (if new)
        savePlayerToFirebase(playerData, saveBtn);
    }
}

function savePlayerToFirebase(playerData, saveBtn) {
    let playerRef;
    
    if (editingPlayerId) {
        // Update existing player
        playerRef = firebase.database().ref('players/' + editingPlayerId);
    } else {
        // Create new player
        playerData.createdAt = Date.now();
        playerRef = firebase.database().ref('players').push();
    }

    playerRef.set(playerData)
        .then(() => {
            console.log('Player saved successfully');
            rosterCacheClear(currentDefaultTeam); _clearPageCaches(currentDefaultTeam);  // invalidate cache — roster changed
            alert(editingPlayerId ? 'Игрок обновлен!' : 'Игрок добавлен!');
            cancelAddPlayer();
            loadPlayers();
        })
        .catch((error) => {
            console.error('Error saving player:', error);
            alert('Ошибка при сохранении игрока: ' + error.message);
        })
        .finally(() => {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить игрока';
        });
}

// ============================================
// EDIT PLAYER
// ============================================

function editPlayer(playerId) {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) {
        alert('Игрок не найден');
        return;
    }

    editingPlayerId = playerId;

    // Fill form with player data
    document.getElementById('playerNumber').value = player.number;
    document.getElementById('playerFirstName').value = player.firstName;
    document.getElementById('playerLastName').value = player.lastName;
    document.getElementById('playerIsGoalkeeper').checked = player.isGoalkeeper || false;
    
    // Update photo preview
    if (player.photo) {
        document.getElementById('playerPhotoPreview').src = player.photo;
    } else {
        updatePhotoPreview();
    }

    // Show modal
    const modal = document.getElementById('playerModal');
    document.getElementById('formTitle').textContent = 'Редактировать игрока';
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// ============================================
// DELETE PLAYER
// ============================================

function deletePlayer(playerId) {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) {
        alert('Игрок не найден');
        return;
    }

    const confirmDelete = confirm(
        `Вы уверены, что хотите удалить игрока?\n\n` +
        `№${player.number} ${player.firstName} ${player.lastName}\n\n` +
        `Это действие нельзя отменить.`
    );

    if (!confirmDelete) {
        return;
    }

    firebase.database().ref('players/' + playerId).update({
        isDeleted: true,
        deletedAt: Date.now()
    })
        .then(() => {
            console.log('Player soft-deleted:', playerId);
            rosterCacheClear(currentDefaultTeam); _clearPageCaches(currentDefaultTeam);  // invalidate cache — roster changed
            showToast('Игрок удалён');
            allPlayers = allPlayers.filter(p => p.id !== playerId);
            displayPlayers();
            loadPlayers();
        })
        .catch((error) => {
            console.error('Error deleting player:', error);
            alert('Ошибка при удалении игрока: ' + error.message);
        });
}

function togglePlayerStatus(playerId) {
    const player = allPlayers.find(p => p.id === playerId);
    if (!player) {
        return;
    }

    const newStatus = !(player.isAbsent || false);
    
    firebase.database().ref('players/' + playerId).update({
        isAbsent: newStatus
    })
        .then(() => {
            console.log('Player status updated:', playerId, newStatus);
            rosterCacheClear(currentDefaultTeam); _clearPageCaches(currentDefaultTeam);  // invalidate cache — absent status affects thumbnail
            loadPlayers();
        })
        .catch((error) => {
            console.error('Error updating player status:', error);
            alert('Ошибка при обновлении статуса: ' + error.message);
        });
}

// ============================================
// COACH MANAGEMENT
// ============================================

function loadCoach() {
    if (!currentDefaultTeam) return;

    // Serve from cache if available
    if (_coachCache[currentDefaultTeam] !== undefined) {
        currentCoachData = _coachCache[currentDefaultTeam] || null;
        displayCoach();
        return;
    }

    firebase.database().ref('coaches/' + currentDefaultTeam).once('value')
        .then((snapshot) => {
            currentCoachData = snapshot.exists() ? snapshot.val() : null;
            _coachCache[currentDefaultTeam] = currentCoachData; // cache (null = no coach)
            displayCoach();
        })
        .catch((error) => {
            console.error('Error loading coach:', error);
            currentCoachData = null;
            displayCoach();
        });
}

function displayCoach() {
    const nameElement = document.getElementById('currentCoachName');
    const photoElement = document.getElementById('currentCoachPhoto');

    if (currentCoachData && (currentCoachData.lastName || currentCoachData.name)) {
        // Build display name: lastName firstName middleName (fallback to legacy name field)
        const parts = [
            currentCoachData.lastName,
            currentCoachData.firstName,
            currentCoachData.middleName
        ].filter(Boolean);
        nameElement.textContent = parts.length ? parts.join(' ') : (currentCoachData.name || 'Не указан');
        photoElement.src = currentCoachData.photo || currentDefaultTeamData.logo;
    } else {
        nameElement.textContent = 'Не указан';
        photoElement.src = currentDefaultTeamData.logo || '';
    }

    updateCoachPhotoPreview();
}

function toggleCoachForm() {
    const form = document.getElementById('editCoachForm');
    const isHidden = form.classList.contains('hidden');
    
    if (isHidden) {
        if (currentCoachData) {
            document.getElementById('coachLastName').value   = currentCoachData.lastName   || '';
            document.getElementById('coachFirstName').value  = currentCoachData.firstName  || '';
            document.getElementById('coachMiddleName').value = currentCoachData.middleName || '';
        } else {
            document.getElementById('coachLastName').value   = '';
            document.getElementById('coachFirstName').value  = '';
            document.getElementById('coachMiddleName').value = '';
        }
        updateCoachPhotoPreview();
        form.classList.remove('hidden');
        document.getElementById('editCoachBtn').innerHTML = '<i class="fas fa-times"></i> Закрыть';
    } else {
        cancelEditCoach();
    }
}

function cancelEditCoach() {
    const form = document.getElementById('editCoachForm');
    form.classList.add('hidden');
    document.getElementById('editCoachBtn').innerHTML = '<i class="fas fa-edit"></i> Редактировать';
    document.getElementById('coachLastName').value   = '';
    document.getElementById('coachFirstName').value  = '';
    document.getElementById('coachMiddleName').value = '';
    document.getElementById('coachPhotoInput').value = '';
    updateCoachPhotoPreview();
}

function previewCoachPhoto(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('coachPhotoPreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function clearCoachPhoto() {
    document.getElementById('coachPhotoInput').value = '';
    updateCoachPhotoPreview();
}

function updateCoachPhotoPreview() {
    const preview = document.getElementById('coachPhotoPreview');
    
    if (currentCoachData && currentCoachData.photo) {
        preview.src = currentCoachData.photo;
    } else if (currentDefaultTeamData && currentDefaultTeamData.logo) {
        preview.src = currentDefaultTeamData.logo;
    } else {
        preview.src = '';
    }
}

function saveCoach() {
    const lastName   = document.getElementById('coachLastName').value.trim();
    const firstName  = document.getElementById('coachFirstName').value.trim();
    const middleName = document.getElementById('coachMiddleName').value.trim();
    const photoInput = document.getElementById('coachPhotoInput');

    if (!lastName && !firstName) {
        alert('Пожалуйста, введите имя или фамилию тренера');
        return;
    }

    const coachData = {
        lastName,
        firstName,
        middleName,
        // legacy name field for backward compat with old thumbnail / other pages
        name: [lastName, firstName, middleName].filter(Boolean).join(' '),
        teamId: currentDefaultTeam,
        updatedAt: Date.now()
    };

    if (photoInput.files.length > 0) {
        const file = photoInput.files[0];
        resizeImageFile(file, 400, 400, 0.88,
            function(dataUrl) {
                coachData.photo = dataUrl;
                saveCoachToFirebase(coachData);
            },
            function() { alert('Ошибка при чтении файла фото'); }
        );
    } else if (currentCoachData && currentCoachData.photo) {
        coachData.photo = currentCoachData.photo;
        saveCoachToFirebase(coachData);
    } else {
        saveCoachToFirebase(coachData);
    }
}

function saveCoachToFirebase(coachData) {
    if (!currentCoachData || !currentCoachData.createdAt) {
        coachData.createdAt = Date.now();
    }

    firebase.database().ref('coaches/' + currentDefaultTeam).set(coachData)
        .then(() => {
            console.log('Coach saved successfully');
            rosterCacheClear(currentDefaultTeam); _clearPageCaches(currentDefaultTeam);  // invalidate cache — coach changed
            alert('Тренер сохранен!');
            currentCoachData = coachData;
            displayCoach();
            cancelEditCoach();
        })
        .catch((error) => {
            console.error('Error saving coach:', error);
            alert('Ошибка при сохранении: ' + error.message);
        });
}

// ============================================
// BADGE ICONS MANAGEMENT
// ============================================

function loadBadgeIcons() {
    const goalkeeperBadge  = currentDefaultTeamData.goalkeeperBadge  || '';
    const fieldPlayerBadge = currentDefaultTeamData.fieldPlayerBadge || '';
    const coachBadge       = currentDefaultTeamData.coachBadge       || '';

    const placeholderBadge = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" fill="%23e2e8f0"/%3E%3Ctext x="32" y="32" text-anchor="middle" dominant-baseline="middle" font-size="30" fill="%2394a3b8"%3E%3F%3C/text%3E%3C/svg%3E';

    document.getElementById('currentGoalkeeperBadge').src  = goalkeeperBadge  || placeholderBadge;
    document.getElementById('currentFieldPlayerBadge').src = fieldPlayerBadge || placeholderBadge;
    document.getElementById('currentCoachBadge').src       = coachBadge       || placeholderBadge;
    document.getElementById('goalkeeperBadgePreview').src  = goalkeeperBadge  || placeholderBadge;
    document.getElementById('fieldPlayerBadgePreview').src = fieldPlayerBadge || placeholderBadge;
    document.getElementById('coachBadgePreview').src       = coachBadge       || placeholderBadge;
}

function toggleBadgeIconsForm() {
    const form = document.getElementById('editBadgeIconsForm');
    const isHidden = form.classList.contains('hidden');
    
    if (isHidden) {
        // Show form and populate with current data
        loadBadgeIcons();
        form.classList.remove('hidden');
        document.getElementById('editBadgeIconsBtn').innerHTML = '<i class="fas fa-times"></i> Закрыть';
    } else {
        cancelEditBadgeIcons();
    }
}

function cancelEditBadgeIcons() {
    const form = document.getElementById('editBadgeIconsForm');
    form.classList.add('hidden');
    document.getElementById('editBadgeIconsBtn').innerHTML = '<i class="fas fa-edit"></i> Редактировать';
    document.getElementById('goalkeeperBadgeInput').value  = '';
    document.getElementById('fieldPlayerBadgeInput').value = '';
    document.getElementById('coachBadgeInput').value       = '';
    loadBadgeIcons();
}

function previewGoalkeeperBadge(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('goalkeeperBadgePreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function previewFieldPlayerBadge(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('fieldPlayerBadgePreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function clearGoalkeeperBadge() {
    document.getElementById('goalkeeperBadgeInput').value = '';
    const defaultBadge = 'goalkeeper.png';
    document.getElementById('goalkeeperBadgePreview').src = defaultBadge;
}

function clearFieldPlayerBadge() {
    document.getElementById('fieldPlayerBadgeInput').value = '';
    const defaultBadge = 'soccer-player.png';
    document.getElementById('fieldPlayerBadgePreview').src = defaultBadge;
}

function previewCoachBadge(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('coachBadgePreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function clearCoachBadge() {
    document.getElementById('coachBadgeInput').value = '';
    document.getElementById('coachBadgePreview').src = 'coach.png';
}

function saveBadgeIcons() {
    const goalkeeperInput  = document.getElementById('goalkeeperBadgeInput');
    const fieldPlayerInput = document.getElementById('fieldPlayerBadgeInput');
    const coachBadgeInput  = document.getElementById('coachBadgeInput');
    
    let updatesNeeded = 0;
    let updatesCompleted = 0;
    const updates = {};

    function checkDone() {
        if (++updatesCompleted === updatesNeeded) saveBadgeIconsToFirebase(updates);
    }

    if (goalkeeperInput.files.length > 0) {
        updatesNeeded++;
        const reader = new FileReader();
        reader.onload = e => { updates.goalkeeperBadge = e.target.result; checkDone(); };
        reader.readAsDataURL(goalkeeperInput.files[0]);
    }
    if (fieldPlayerInput.files.length > 0) {
        updatesNeeded++;
        const reader = new FileReader();
        reader.onload = e => { updates.fieldPlayerBadge = e.target.result; checkDone(); };
        reader.readAsDataURL(fieldPlayerInput.files[0]);
    }
    if (coachBadgeInput.files.length > 0) {
        updatesNeeded++;
        const reader = new FileReader();
        reader.onload = e => { updates.coachBadge = e.target.result; checkDone(); };
        reader.readAsDataURL(coachBadgeInput.files[0]);
    }

    if (updatesNeeded === 0) {
        alert('Нет изменений для сохранения');
        cancelEditBadgeIcons();
    }
}

function saveBadgeIconsToFirebase(updates) {
    firebase.database().ref('teams/' + currentDefaultTeam).update(updates)
        .then(() => {
            console.log('Badge icons saved successfully');
            rosterCacheClear(currentDefaultTeam); _clearPageCaches(currentDefaultTeam);  // invalidate cache — team badges changed
            alert('Иконки значков сохранены!');
            if (updates.goalkeeperBadge)  currentDefaultTeamData.goalkeeperBadge  = updates.goalkeeperBadge;
            if (updates.fieldPlayerBadge) currentDefaultTeamData.fieldPlayerBadge = updates.fieldPlayerBadge;
            if (updates.coachBadge)       currentDefaultTeamData.coachBadge       = updates.coachBadge;
            loadBadgeIcons();
            cancelEditBadgeIcons();
        })
        .catch((error) => {
            console.error('Error saving badge icons:', error);
            alert('Ошибка при сохранении: ' + error.message);
        });
}

// ============================================
// ROSTER THUMBNAIL GENERATION
// ============================================

function generateRosterThumbnail() {
    if (!currentDefaultTeam || !currentDefaultTeamData) {
        alert('Сначала выберите команду');
        return;
    }

    if (allPlayers.length === 0) {
        alert('В команде нет игроков');
        return;
    }

    generateRosterThumbnailHelper(currentDefaultTeam, function(blob, teamName) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `roster-${teamName}.png`;
        link.click();
        URL.revokeObjectURL(url);
        alert('✓ Состав команды скачан!');
    });
}


// ============================================
// UTILITY FUNCTIONS
// ============================================

// Resize image before saving to Firebase (caps to maxW×maxH).
// Uses PNG for transparent images (png/gif/webp), JPEG otherwise.
function resizeImageFile(file, maxW, maxH, quality, onSuccess, onError) {
    const reader = new FileReader();
    reader.onerror = onError;
    reader.onload = function(e) {
        const img = new Image();
        img.onerror = onError;
        img.onload = function() {
            let w = img.width, h = img.height;
            if (w > maxW || h > maxH) {
                const ratio = Math.min(maxW / w, maxH / h);
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);
            const isPng = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp';
            onSuccess(isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}


// Simple toast notification (self-contained, no DOM element needed)
let _toastTimer = null;
function showToast(msg) {
    let el = document.getElementById('rosterToast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'rosterToast';
        el.style.cssText = [
            'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
            'background:rgba(30,41,59,0.92)', 'color:#fff', 'padding:12px 24px',
            'border-radius:10px', 'font-size:15px', 'font-weight:600',
            'box-shadow:0 4px 16px rgba(0,0,0,0.25)', 'z-index:9999',
            'transition:opacity .2s', 'pointer-events:none'
        ].join(';');
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.display = 'block';
    if (_toastTimer) clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function() {
        el.style.opacity = '0';
        setTimeout(function() { el.style.display = 'none'; }, 200);
    }, 3000);
}

// Handle page visibility — only reload if cache was cleared (i.e. data actually changed)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentDefaultTeam) {
        // Only fetch if cache was cleared — avoids re-downloading on every tab switch
        if (!_playersPageCache[currentDefaultTeam]) {
            loadPlayers();
        }
    }
});

console.log('Roster management script loaded');
