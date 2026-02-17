// roster.js - Player Roster Management
// Version 1.1 - Added Coach and Goalkeeper support

let currentDefaultTeam = null;
let currentDefaultTeamData = null;
let currentCoachData = null;
let allPlayers = [];
let editingPlayerId = null;

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

function loadTeamsDropdown() {
    const select = document.getElementById('defaultTeamSelect');
    select.innerHTML = '<option value="">Загрузка команд...</option>';

    firebase.database().ref('teams').once('value')
        .then((snapshot) => {
            select.innerHTML = '<option value="">-- Выберите команду --</option>';
            
            const teams = [];
            snapshot.forEach((childSnapshot) => {
                teams.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });

            // Sort teams by name
            teams.sort((a, b) => a.name.localeCompare(b.name));

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
    firebase.database().ref('settings/defaultTeam').once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const teamId = snapshot.val();
                currentDefaultTeam = teamId;
                
                // Set dropdown value
                document.getElementById('defaultTeamSelect').value = teamId;
                
                // Load team details
                return firebase.database().ref('teams/' + teamId).once('value');
            }
            return null;
        })
        .then((teamSnapshot) => {
            if (teamSnapshot && teamSnapshot.exists()) {
                currentDefaultTeamData = {
                    id: currentDefaultTeam,
                    ...teamSnapshot.val()
                };
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

    // Save to Firebase settings
    firebase.database().ref('settings/defaultTeam').set(selectedTeamId)
        .then(() => {
            console.log('Default team saved:', selectedTeamId);
            currentDefaultTeam = selectedTeamId;
            
            // Load team details
            return firebase.database().ref('teams/' + selectedTeamId).once('value');
        })
        .then((snapshot) => {
            if (snapshot.exists()) {
                currentDefaultTeamData = {
                    id: currentDefaultTeam,
                    ...snapshot.val()
                };
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

    const playersRef = firebase.database().ref('players').orderByChild('teamId').equalTo(currentDefaultTeam);
    
    playersRef.once('value')
        .then((snapshot) => {
            allPlayers = [];
            
            snapshot.forEach((childSnapshot) => {
                allPlayers.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });

            // Sort by player number
            allPlayers.sort((a, b) => a.number - b.number);

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

    // Handle photo upload (will override existing photo if new one is selected)
    if (photoInput.files.length > 0) {
        const file = photoInput.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            playerData.photo = e.target.result;
            savePlayerToFirebase(playerData, saveBtn);
        };
        
        reader.onerror = function() {
            alert('Ошибка при чтении файла фото');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить игрока';
        };
        
        reader.readAsDataURL(file);
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

    firebase.database().ref('players/' + playerId).remove()
        .then(() => {
            console.log('Player deleted:', playerId);
            alert('Игрок удален');
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
            loadPlayers(); // Reload to update UI
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
    if (!currentDefaultTeam) {
        return;
    }

    firebase.database().ref('coaches/' + currentDefaultTeam).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                currentCoachData = snapshot.val();
                displayCoach();
            } else {
                currentCoachData = null;
                displayCoach();
            }
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

    if (currentCoachData && currentCoachData.name) {
        nameElement.textContent = currentCoachData.name;
        photoElement.src = currentCoachData.photo || currentDefaultTeamData.logo;
    } else {
        nameElement.textContent = 'Не указан';
        photoElement.src = currentDefaultTeamData.logo || '';
    }

    // Update coach photo preview
    updateCoachPhotoPreview();
}

function toggleCoachForm() {
    const form = document.getElementById('editCoachForm');
    const isHidden = form.classList.contains('hidden');
    
    if (isHidden) {
        // Show form and populate with current data
        if (currentCoachData) {
            document.getElementById('coachName').value = currentCoachData.name || '';
        } else {
            document.getElementById('coachName').value = '';
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
    const name = document.getElementById('coachName').value.trim();
    const photoInput = document.getElementById('coachPhotoInput');

    if (!name) {
        alert('Пожалуйста, введите имя тренера');
        return;
    }

    const coachData = {
        name: name,
        teamId: currentDefaultTeam,
        updatedAt: Date.now()
    };

    // Handle photo upload
    if (photoInput.files.length > 0) {
        const file = photoInput.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            coachData.photo = e.target.result;
            saveCoachToFirebase(coachData);
        };
        
        reader.onerror = function() {
            alert('Ошибка при чтении файла фото');
        };
        
        reader.readAsDataURL(file);
    } else if (currentCoachData && currentCoachData.photo) {
        // Keep existing photo if not changed
        coachData.photo = currentCoachData.photo;
        saveCoachToFirebase(coachData);
    } else {
        // No photo
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
    // Display current badge icons or placeholder
    const goalkeeperBadge = currentDefaultTeamData.goalkeeperBadge || '';
    const fieldPlayerBadge = currentDefaultTeamData.fieldPlayerBadge || '';
    
    // Use data URI placeholder for empty badges
    const placeholderBadge = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" fill="%23e2e8f0"/%3E%3Ctext x="32" y="32" text-anchor="middle" dominant-baseline="middle" font-size="30" fill="%2394a3b8"%3E%3F%3C/text%3E%3C/svg%3E';
    
    document.getElementById('currentGoalkeeperBadge').src = goalkeeperBadge || placeholderBadge;
    document.getElementById('currentFieldPlayerBadge').src = fieldPlayerBadge || placeholderBadge;
    document.getElementById('goalkeeperBadgePreview').src = goalkeeperBadge || placeholderBadge;
    document.getElementById('fieldPlayerBadgePreview').src = fieldPlayerBadge || placeholderBadge;
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
    document.getElementById('goalkeeperBadgeInput').value = '';
    document.getElementById('fieldPlayerBadgeInput').value = '';
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

function saveBadgeIcons() {
    const goalkeeperInput = document.getElementById('goalkeeperBadgeInput');
    const fieldPlayerInput = document.getElementById('fieldPlayerBadgeInput');
    
    let updatesNeeded = 0;
    let updatesCompleted = 0;
    
    const updates = {};
    
    // Check if goalkeeper badge needs update
    if (goalkeeperInput.files.length > 0) {
        updatesNeeded++;
        const file = goalkeeperInput.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            updates.goalkeeperBadge = e.target.result;
            updatesCompleted++;
            if (updatesCompleted === updatesNeeded) {
                saveBadgeIconsToFirebase(updates);
            }
        };
        
        reader.readAsDataURL(file);
    }
    
    // Check if field player badge needs update
    if (fieldPlayerInput.files.length > 0) {
        updatesNeeded++;
        const file = fieldPlayerInput.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            updates.fieldPlayerBadge = e.target.result;
            updatesCompleted++;
            if (updatesCompleted === updatesNeeded) {
                saveBadgeIconsToFirebase(updates);
            }
        };
        
        reader.readAsDataURL(file);
    }
    
    // If no updates needed, just close the form
    if (updatesNeeded === 0) {
        alert('Нет изменений для сохранения');
        cancelEditBadgeIcons();
    }
}

function saveBadgeIconsToFirebase(updates) {
    firebase.database().ref('teams/' + currentDefaultTeam).update(updates)
        .then(() => {
            console.log('Badge icons saved successfully');
            alert('Иконки значков сохранены!');
            
            // Update current team data
            if (updates.goalkeeperBadge) {
                currentDefaultTeamData.goalkeeperBadge = updates.goalkeeperBadge;
            }
            if (updates.fieldPlayerBadge) {
                currentDefaultTeamData.fieldPlayerBadge = updates.fieldPlayerBadge;
            }
            
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

    // Create canvas
    const canvas = document.getElementById('rosterThumbnailCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size (YouTube thumbnail: 1280x720)
    canvas.width = 1280;
    canvas.height = 720;
    
    // Separate goalkeepers and field players, excluding absent players
    const goalkeepers = allPlayers.filter(p => p.isGoalkeeper && !p.isAbsent);
    const fieldPlayers = allPlayers.filter(p => !p.isGoalkeeper && !p.isAbsent);
    
    // Prepare image loading array
    const imagesToLoad = [];
    const loadedImages = {};
    
    // Add team logo
    imagesToLoad.push({
        key: 'teamLogo',
        src: currentDefaultTeamData.logo
    });
    
    // Add badge icons from team settings (only if configured)
    // These can be configured in team settings to customize the badges
    const goalkeeperBadge = currentDefaultTeamData.goalkeeperBadge;
    const fieldPlayerBadge = currentDefaultTeamData.fieldPlayerBadge;
    
    if (goalkeeperBadge) {
        imagesToLoad.push({
            key: 'goalkeeperBadge',
            src: goalkeeperBadge
        });
    }
    
    if (fieldPlayerBadge) {
        imagesToLoad.push({
            key: 'fieldPlayerBadge',
            src: fieldPlayerBadge
        });
    }
    
    // Add coach photo if exists
    if (currentCoachData && currentCoachData.name) {
        imagesToLoad.push({
            key: 'coachPhoto',
            src: currentCoachData.photo || currentDefaultTeamData.logo
        });
    }
    
    // Add goalkeeper photos (max 3)
    const gksToShow = goalkeepers.slice(0, 3);
    gksToShow.forEach((gk, index) => {
        imagesToLoad.push({
            key: `gk_${index}`,
            src: gk.photo || currentDefaultTeamData.logo,
            player: gk
        });
    });
    
    // Add field player photos (max 15 - 3 rows of 5)
    const playersToShow = fieldPlayers.slice(0, 15);
    playersToShow.forEach((player, index) => {
        imagesToLoad.push({
            key: `player_${index}`,
            src: player.photo || currentDefaultTeamData.logo,
            player: player
        });
    });
    
    // Load all images first
    let imagesLoaded = 0;
    const totalImages = imagesToLoad.length;
    
    imagesToLoad.forEach(imgData => {
        const img = new Image();
        // Only set crossOrigin for HTTP(S) URLs, not for data URIs
        if (imgData.src.startsWith('http://') || imgData.src.startsWith('https://')) {
            img.crossOrigin = "anonymous";  // Enable CORS to avoid tainted canvas
        }
        img.onload = function() {
            loadedImages[imgData.key] = {
                img: img,
                player: imgData.player
            };
            imagesLoaded++;
            if (imagesLoaded === totalImages) {
                drawEverything();
            }
        };
        img.onerror = function() {
            imagesLoaded++;
            if (imagesLoaded === totalImages) {
                drawEverything();
            }
        };
        img.src = imgData.src;
    });
    
    function drawEverything() {
        // Clear and redraw background
        ctx.fillStyle = 'rgba(59, 131, 246, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        let currentY = 60;
        
        // ========================================
        // 1. HEADER ROW: Logo (left) and Coach (center)
        // ========================================
        
        const headerY = currentY;
        const logoSquareSize = 90;
        const logoMaxSize = 70;
        
        // Draw white rounded square for team logo (LEFT SIDE)
        const logoSquareX = 80;
        const cornerRadius = 15;
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.roundRect(logoSquareX, headerY, logoSquareSize, logoSquareSize, cornerRadius);
        ctx.fill();
        
        // Draw team logo inside square
        if (loadedImages['teamLogo']) {
            const img = loadedImages['teamLogo'].img;
            
            // Calculate proportional size
            let width = img.width;
            let height = img.height;
            
            if (width > height) {
                if (width > logoMaxSize) {
                    height = (height * logoMaxSize) / width;
                    width = logoMaxSize;
                }
            } else {
                if (height > logoMaxSize) {
                    width = (width * logoMaxSize) / height;
                    height = logoMaxSize;
                }
            }
            
            // Center logo in square
            const logoX = logoSquareX + (logoSquareSize - width) / 2;
            const logoY = headerY + (logoSquareSize - height) / 2;
            ctx.drawImage(img, logoX, logoY, width, height);
        }
        
        // Coach (centered horizontally, same vertical line as logo) - if exists
        if (currentCoachData && currentCoachData.name && loadedImages['coachPhoto']) {
            const coachPhotoSize = 70;
            const centerX = canvas.width / 2;
            const coachPhotoY = headerY + (logoSquareSize - coachPhotoSize) / 2; // Vertically center with logo
            
            drawRoundedImage(loadedImages['coachPhoto'].img, centerX - coachPhotoSize / 2, coachPhotoY, coachPhotoSize);
            
            // Coach name (centered below photo, on same row)
            ctx.fillStyle = 'white';
            ctx.font = '22px Calibri, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Тренер: ' + currentCoachData.name, centerX, coachPhotoY + coachPhotoSize + 25);
        }
        
        currentY = headerY + logoSquareSize + 40;
        
        // ========================================
        // 2. GOALKEEPERS ROW (1-3 keepers, equal cells)
        // ========================================
        
        if (gksToShow.length > 0) {
            const gkSize = 100;
            const gkCellWidth = canvas.width / gksToShow.length; // Equal width cells
            const badgeSize = 32;  // Badge icon size
            
            gksToShow.forEach((gk, index) => {
                const cellX = index * gkCellWidth;
                const centerX = cellX + gkCellWidth / 2;
                
                const imgData = loadedImages[`gk_${index}`];
                
                if (imgData) {
                    // Draw photo centered in cell
                    const photoX = centerX - gkSize / 2;
                    drawRoundedImage(imgData.img, photoX, currentY, gkSize);
                    
                    // Draw goalkeeper badge next to photo (bottom-right, not overlaying)
                    if (loadedImages['goalkeeperBadge']) {
                        const badgeX = photoX + gkSize + 5; // 5px gap from photo
                        const badgeY = currentY + gkSize - badgeSize; // Align to bottom of photo
                        ctx.drawImage(loadedImages['goalkeeperBadge'].img, badgeX, badgeY, badgeSize, badgeSize);
                    }
                    
                    // Draw name (no card, no truncation)
                    const textY = currentY + gkSize + 35;
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 24px Calibri, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(`#${gk.number} ${gk.firstName} ${gk.lastName}`, centerX, textY);
                }
            });
            
            currentY += gkSize + 70;
        }
        
        // ========================================
        // 3. FIELD PLAYERS GRID (5 per row, equal cells)
        // ========================================
        
        if (playersToShow.length > 0) {
            const playerSize = 85;
            const playersPerRow = 5;
            const playerCellWidth = canvas.width / playersPerRow; // 20% each
            const rowSpacing = 150;  // Increased from 120 to prevent overlap
            const badgeSize = 28;  // Badge icon size
            
            playersToShow.forEach((player, index) => {
                const row = Math.floor(index / playersPerRow);
                const col = index % playersPerRow;
                
                const cellX = col * playerCellWidth;
                const centerX = cellX + playerCellWidth / 2;
                const y = currentY + (row * rowSpacing);
                
                const imgData = loadedImages[`player_${index}`];
                
                if (imgData) {
                    // Draw photo centered in cell
                    const photoX = centerX - playerSize / 2;
                    drawRoundedImage(imgData.img, photoX, y, playerSize);
                    
                    // Draw field player badge next to photo (bottom-right, not overlaying)
                    if (loadedImages['fieldPlayerBadge']) {
                        const badgeX = photoX + playerSize + 3; // 3px gap from photo
                        const badgeY = y + playerSize - badgeSize; // Align to bottom of photo
                        ctx.drawImage(loadedImages['fieldPlayerBadge'].img, badgeX, badgeY, badgeSize, badgeSize);
                    }
                    
                    // Draw name (no card, no truncation)
                    const textY = y + playerSize + 35;
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 22px Calibri, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(`#${player.number} ${player.firstName} ${player.lastName}`, centerX, textY);
                }
            });
        }
        
        // Now download
        downloadRosterThumbnail();
    }
    
    function downloadRosterThumbnail() {
        // Convert to image and download
        canvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `roster-${currentDefaultTeamData.name}.png`;
            link.click();
            URL.revokeObjectURL(url);
            alert('✓ Состав команды скачан!');
        });
    }
    
    // Helper function to draw rounded image
    function drawRoundedImage(img, x, y, size) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        // Calculate scaling to cover the circle
        const scale = Math.max(size / img.width, size / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = x + (size - scaledWidth) / 2;
        const offsetY = y + (size - scaledHeight) / 2;
        
        ctx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
        ctx.restore();
        
        // White border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
        ctx.stroke();
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Handle page visibility to reload data when returning to page
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && currentDefaultTeam) {
        loadPlayers();
    }
});

console.log('Roster management script loaded');
