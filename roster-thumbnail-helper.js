// ============================================
// SHARED ROSTER THUMBNAIL GENERATOR
// ============================================
// This helper can be used from multiple pages

function generateRosterThumbnailHelper(teamId, callback) {
    if (!teamId) {
        alert('Команда не выбрана');
        return;
    }

    // Load team data
    firebase.database().ref('teams/' + teamId).once('value')
        .then(teamSnapshot => {
            if (!teamSnapshot.exists()) {
                alert('Команда не найдена');
                return;
            }

            const teamData = teamSnapshot.val();

            // Load players for this team
            firebase.database().ref('players')
                .orderByChild('teamId')
                .equalTo(teamId)
                .once('value')
                .then(playersSnapshot => {
                    const players = [];
                    playersSnapshot.forEach(childSnapshot => {
                        const player = childSnapshot.val();
                        player.id = childSnapshot.key;
                        // Exclude absent players
                        if (!player.isAbsent) {
                            players.push(player);
                        }
                    });

                    // Sort by number
                    players.sort((a, b) => a.number - b.number);

                    // Load coach
                    firebase.database().ref('coaches/' + teamId).once('value')
                        .then(coachSnapshot => {
                            const coachData = coachSnapshot.exists() ? coachSnapshot.val() : null;

                            // Generate thumbnail
                            generateRosterImage(teamData, players, coachData, callback);
                        })
                        .catch(error => {
                            console.error('Error loading coach:', error);
                            // Continue without coach
                            generateRosterImage(teamData, players, null, callback);
                        });
                })
                .catch(error => {
                    alert('Ошибка загрузки игроков: ' + error.message);
                });
        })
        .catch(error => {
            alert('Ошибка загрузки команды: ' + error.message);
        });
}

function generateRosterImage(teamData, players, coachData, callback) {
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1280;
    canvas.height = 720;
    
    // Separate goalkeepers and field players
    const goalkeepers = players.filter(p => p.isGoalkeeper);
    const fieldPlayers = players.filter(p => !p.isGoalkeeper);
    
    // Prepare image loading
    const imagesToLoad = [];
    const loadedImages = {};
    
    // Add team logo
    imagesToLoad.push({
        key: 'teamLogo',
        src: teamData.logo
    });
    
    // Add badge icons if configured
    if (teamData.goalkeeperBadge) {
        imagesToLoad.push({
            key: 'goalkeeperBadge',
            src: teamData.goalkeeperBadge
        });
    }
    
    if (teamData.fieldPlayerBadge) {
        imagesToLoad.push({
            key: 'fieldPlayerBadge',
            src: teamData.fieldPlayerBadge
        });
    }
    
    // Add coach photo if exists
    if (coachData && coachData.name) {
        imagesToLoad.push({
            key: 'coachPhoto',
            src: coachData.photo || teamData.logo
        });
    }
    
    // Add goalkeeper photos (max 3)
    const gksToShow = goalkeepers.slice(0, 3);
    gksToShow.forEach((gk, index) => {
        imagesToLoad.push({
            key: `gk_${index}`,
            src: gk.photo || teamData.logo,
            player: gk
        });
    });
    
    // Add field player photos (max 15)
    const playersToShow = fieldPlayers.slice(0, 15);
    playersToShow.forEach((player, index) => {
        imagesToLoad.push({
            key: `player_${index}`,
            src: player.photo || teamData.logo,
            player: player
        });
    });
    
    // Load all images
    let loadedCount = 0;
    const totalImages = imagesToLoad.length;
    
    if (totalImages === 0) {
        alert('Нет игроков для отображения');
        return;
    }
    
    imagesToLoad.forEach(imgData => {
        const img = new Image();
        img.onload = function() {
            loadedImages[imgData.key] = {
                img: img,
                player: imgData.player
            };
            loadedCount++;
            
            if (loadedCount === totalImages) {
                drawRosterOnCanvas(canvas, ctx, teamData, coachData, gksToShow, playersToShow, loadedImages, callback);
            }
        };
        
        img.onerror = function() {
            console.error('Failed to load image:', imgData.src);
            loadedCount++;
            
            if (loadedCount === totalImages) {
                drawRosterOnCanvas(canvas, ctx, teamData, coachData, gksToShow, playersToShow, loadedImages, callback);
            }
        };
        
        // Set crossOrigin for HTTP(S) URLs
        if (imgData.src.startsWith('http://') || imgData.src.startsWith('https://')) {
            img.crossOrigin = "anonymous";
        }
        
        img.src = imgData.src;
    });
}

function drawRosterOnCanvas(canvas, ctx, teamData, coachData, gksToShow, playersToShow, loadedImages, callback) {
    // Clear and draw background
    ctx.fillStyle = 'rgba(59, 131, 246, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    let currentY = 60;
    
    // ========================================
    // HEADER: Logo and Coach
    // ========================================
    
    const headerY = currentY;
    const logoSquareSize = 90;
    const logoMaxSize = 70;
    const logoSquareX = 80;
    const cornerRadius = 15;
    
    // Draw logo background
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.roundRect(logoSquareX, headerY, logoSquareSize, logoSquareSize, cornerRadius);
    ctx.fill();
    
    // Draw team logo
    if (loadedImages['teamLogo']) {
        const img = loadedImages['teamLogo'].img;
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
        
        const logoX = logoSquareX + (logoSquareSize - width) / 2;
        const logoY = headerY + (logoSquareSize - height) / 2;
        ctx.drawImage(img, logoX, logoY, width, height);
    }
    
    // Draw coach (centered, same row as logo)
    if (coachData && coachData.name && loadedImages['coachPhoto']) {
        const coachPhotoSize = 70;
        const centerX = canvas.width / 2;
        const coachPhotoY = headerY + (logoSquareSize - coachPhotoSize) / 2;
        
        drawRoundedImage(ctx, loadedImages['coachPhoto'].img, centerX - coachPhotoSize / 2, coachPhotoY, coachPhotoSize);
        
        ctx.fillStyle = 'white';
        ctx.font = '22px Calibri, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Тренер: ' + coachData.name, centerX, coachPhotoY + coachPhotoSize + 25);
    }
    
    currentY = headerY + logoSquareSize + 40;
    
    // ========================================
    // GOALKEEPERS
    // ========================================
    
    if (gksToShow.length > 0) {
        const gkSize = 100;
        const gkCellWidth = canvas.width / gksToShow.length;
        const badgeSize = 32;
        
        gksToShow.forEach((gk, index) => {
            const cellX = index * gkCellWidth;
            const centerX = cellX + gkCellWidth / 2;
            const imgData = loadedImages[`gk_${index}`];
            
            if (imgData) {
                const photoX = centerX - gkSize / 2;
                drawRoundedImage(ctx, imgData.img, photoX, currentY, gkSize);
                
                // Draw badge if available
                if (loadedImages['goalkeeperBadge']) {
                    const badgeX = photoX + gkSize + 5;
                    const badgeY = currentY + gkSize - badgeSize;
                    ctx.drawImage(loadedImages['goalkeeperBadge'].img, badgeX, badgeY, badgeSize, badgeSize);
                }
                
                // Draw name
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
    // FIELD PLAYERS
    // ========================================
    
    if (playersToShow.length > 0) {
        const playerSize = 85;
        const playersPerRow = 5;
        const playerCellWidth = canvas.width / playersPerRow;
        const rowSpacing = 150;
        const badgeSize = 28;
        
        playersToShow.forEach((player, index) => {
            const row = Math.floor(index / playersPerRow);
            const col = index % playersPerRow;
            const cellX = col * playerCellWidth;
            const centerX = cellX + playerCellWidth / 2;
            const y = currentY + (row * rowSpacing);
            const imgData = loadedImages[`player_${index}`];
            
            if (imgData) {
                const photoX = centerX - playerSize / 2;
                drawRoundedImage(ctx, imgData.img, photoX, y, playerSize);
                
                // Draw badge if available
                if (loadedImages['fieldPlayerBadge']) {
                    const badgeX = photoX + playerSize + 3;
                    const badgeY = y + playerSize - badgeSize;
                    ctx.drawImage(loadedImages['fieldPlayerBadge'].img, badgeX, badgeY, badgeSize, badgeSize);
                }
                
                // Draw name
                const textY = y + playerSize + 35;
                ctx.fillStyle = 'white';
                ctx.font = 'bold 22px Calibri, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`#${player.number} ${player.firstName} ${player.lastName}`, centerX, textY);
            }
        });
    }
    
    // Convert to blob and callback
    canvas.toBlob(function(blob) {
        if (callback) {
            callback(blob, teamData.name);
        }
    });
}

function drawRoundedImage(ctx, img, x, y, size) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
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
