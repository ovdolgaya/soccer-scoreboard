// ============================================
// SHARED ROSTER THUMBNAIL GENERATOR
// ============================================
// This helper can be used from multiple pages

function generateRosterThumbnailHelper(teamId, callback) {
    if (!teamId) {
        alert('Команда не выбрана');
        return;
    }

    firebase.database().ref('teams/' + teamId).once('value')
        .then(teamSnapshot => {
            if (!teamSnapshot.exists()) {
                alert('Команда не найдена');
                return;
            }

            const teamData = teamSnapshot.val();

            firebase.database().ref('players')
                .orderByChild('teamId')
                .equalTo(teamId)
                .once('value')
                .then(playersSnapshot => {
                    const players = [];
                    playersSnapshot.forEach(childSnapshot => {
                        const player = childSnapshot.val();
                        player.id = childSnapshot.key;
                        if (!player.isAbsent && !player.isDeleted) players.push(player);
                    });

                    players.sort((a, b) => a.number - b.number);

                    firebase.database().ref('coaches/' + teamId).once('value')
                        .then(coachSnapshot => {
                            const coachData = coachSnapshot.exists() ? coachSnapshot.val() : null;
                            generateRosterImage(teamData, players, coachData, callback);
                        })
                        .catch(() => {
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

// ============================================
// LAYOUT CALCULATOR
// Returns { cols, rows } for field players
// ============================================
function calcFieldLayout(count) {
    if (count <= 0)  return { cols: 0, rows: 0 };
    if (count <= 5)  return { cols: count, rows: 1 };   // 1–5: single row
    if (count <= 7)  return { cols: Math.ceil(count / 2), rows: 2 }; // 6–7 → 3–4 cols × 2 rows
    if (count <= 10) return { cols: Math.ceil(count / 2), rows: 2 }; // 8–10 → 4–5 cols × 2 rows
    if (count <= 12) return { cols: 6, rows: 2 };
    if (count <= 14) return { cols: 5, rows: 3 };
    if (count <= 15) return { cols: 5, rows: 3 };
    if (count <= 18) return { cols: 6, rows: 3 };
    return             { cols: 7, rows: 3 };             // 19–21
}

function generateRosterImage(teamData, players, coachData, callback) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width  = 1280;
    canvas.height = 720;

    const goalkeepers  = players.filter(p => p.isGoalkeeper);
    const fieldPlayers = players.filter(p => !p.isGoalkeeper);

    const imagesToLoad = [];
    const loadedImages = {};

    // Team logo
    imagesToLoad.push({ key: 'teamLogo', src: teamData.logo });

    // Badge icons
    if (teamData.goalkeeperBadge)  imagesToLoad.push({ key: 'goalkeeperBadge',  src: teamData.goalkeeperBadge });
    if (teamData.fieldPlayerBadge) imagesToLoad.push({ key: 'fieldPlayerBadge', src: teamData.fieldPlayerBadge });

    // Coach photo
    if (coachData && coachData.name) {
        imagesToLoad.push({ key: 'coachPhoto', src: coachData.photo || teamData.logo });
    }

    // GK photos (max 3)
    const gksToShow = goalkeepers.slice(0, 3);
    gksToShow.forEach((gk, i) => {
        imagesToLoad.push({ key: `gk_${i}`, src: gk.photo || teamData.logo, player: gk });
    });

    // Field player photos — auto-calculated max
    const layout = calcFieldLayout(fieldPlayers.length);
    const maxPlayers = layout.cols * layout.rows;
    const playersToShow = fieldPlayers.slice(0, maxPlayers);
    playersToShow.forEach((player, i) => {
        imagesToLoad.push({ key: `player_${i}`, src: player.photo || teamData.logo, player });
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
        img.onload = function () {
            loadedImages[imgData.key] = { img, player: imgData.player };
            if (++loadedCount === totalImages)
                drawRosterOnCanvas(canvas, ctx, teamData, coachData, gksToShow, playersToShow, layout, loadedImages, callback);
        };
        img.onerror = function () {
            if (++loadedCount === totalImages)
                drawRosterOnCanvas(canvas, ctx, teamData, coachData, gksToShow, playersToShow, layout, loadedImages, callback);
        };
        if (imgData.src && (imgData.src.startsWith('http://') || imgData.src.startsWith('https://'))) {
            img.crossOrigin = 'anonymous';
        }
        img.src = imgData.src;
    });
}

function drawRosterOnCanvas(canvas, ctx, teamData, coachData, gksToShow, playersToShow, layout, loadedImages, callback) {
    const W = canvas.width;   // 1280
    const H = canvas.height;  // 720

    // Shared card constants — same for GKs and field players
    const CARD_H    = 90;
    const PHOTO_SZ  = CARD_H;
    const BADGE_SZ  = 22;
    const PADDING   = 40;   // left/right page margin
    const GAP_X     = 10;
    const BOTTOM_PAD = 20;

    // ── Background ──
    ctx.fillStyle = 'rgba(59, 131, 246, 0.7)';
    ctx.fillRect(0, 0, W, H);

    let currentY = 40;

    // ============================================
    // HEADER: Team logo (left) + Coach (centre)
    // ============================================
    const logoSquareSize = 75;
    const logoMaxSize    = 58;
    const logoSquareX    = 70;

    ctx.fillStyle     = 'white';
    ctx.shadowColor   = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur    = 10;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(logoSquareX, currentY, logoSquareSize, logoSquareSize, 12);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    if (loadedImages['teamLogo']) {
        const img = loadedImages['teamLogo'].img;
        let w = img.width, h = img.height;
        if (w > h) { if (w > logoMaxSize) { h = h * logoMaxSize / w; w = logoMaxSize; } }
        else        { if (h > logoMaxSize) { w = w * logoMaxSize / h; h = logoMaxSize; } }
        ctx.drawImage(img,
            logoSquareX + (logoSquareSize - w) / 2,
            currentY    + (logoSquareSize - h) / 2, w, h);
    }

    // Coach — centred, same row as logo
    let headerH = logoSquareSize;
    if (coachData && coachData.name && loadedImages['coachPhoto']) {
        const coachSize = 58;
        const cx = W / 2;
        const cy = currentY + (logoSquareSize - coachSize) / 2;
        drawRoundedImage(ctx, loadedImages['coachPhoto'].img, cx - coachSize / 2, cy, coachSize);

        ctx.fillStyle   = 'white';
        ctx.font        = '18px Calibri, sans-serif';
        ctx.textAlign   = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur  = 6;
        ctx.fillText('Тренер: ' + coachData.name, cx, cy + coachSize + 20);
        ctx.shadowBlur = 0;
        headerH = Math.max(logoSquareSize, coachSize + 20 + 16);
    }

    // Bigger gap after coach block
    currentY += headerH + 40;

    // ── Calculate layout constants needed for title centering and grid ──
    const totalRows   = (gksToShow.length > 0 ? 1 : 0) + layout.rows;
    const cardW       = Math.floor((W - PADDING * 2 - GAP_X * (layout.cols - 1)) / layout.cols);

    // Gap between rows: 2× bigger when ≤2 rows
    const GAP_Y = totalRows <= 2 ? 40 : 20;

    // ============================================
    // TITLE: "Состав команды" — centred above the table
    // ============================================
    const TITLE_H = 44;   // total height reserved for title + gap below it
    ctx.fillStyle   = 'rgba(255,255,255,0.92)';
    ctx.font        = 'bold 26px Calibri, sans-serif';
    ctx.textAlign   = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur  = 6;
    ctx.fillText('Состав команды', W / 2, currentY + 22);
    ctx.shadowBlur  = 0;
    currentY += TITLE_H;

    const totalGridH  = totalRows * CARD_H + (totalRows - 1) * GAP_Y;
    const availableH  = H - currentY - BOTTOM_PAD;
    const gridStartY  = currentY + Math.max(0, (availableH - totalGridH) / 2);

    let rowY = gridStartY;

    // ============================================
    // GOALKEEPERS
    // ============================================
    if (gksToShow.length > 0) {
        const totalW = gksToShow.length * cardW + (gksToShow.length - 1) * GAP_X;
        const startX = (W - totalW) / 2;

        gksToShow.forEach((gk, i) => {
            const cardX   = startX + i * (cardW + GAP_X);
            const imgData = loadedImages[`gk_${i}`];

            drawPlayerCard(ctx, cardX, rowY, cardW, CARD_H, PHOTO_SZ, BADGE_SZ,
                imgData, loadedImages['goalkeeperBadge'],
                '#08399A', gk.number, gk.firstName, gk.lastName);
        });

        rowY += CARD_H + GAP_Y;
    }

    // ============================================
    // FIELD PLAYERS
    // ============================================
    if (playersToShow.length > 0 && layout.cols > 0) {
        playersToShow.forEach((player, i) => {
            const row   = Math.floor(i / layout.cols);
            const col   = i % layout.cols;
            const cardX = PADDING + col * (cardW + GAP_X);
            const cardY = rowY + row * (CARD_H + GAP_Y);
            const imgData = loadedImages[`player_${i}`];

            drawPlayerCard(ctx, cardX, cardY, cardW, CARD_H, PHOTO_SZ, BADGE_SZ,
                imgData, loadedImages['fieldPlayerBadge'],
                '#08399A', player.number, player.firstName, player.lastName);
        });
    }

    canvas.toBlob(function (blob) {
        if (callback) callback(blob, teamData.name);
    });
}

// ── Shared card renderer ──────────────────────────────────────
function drawPlayerCard(ctx, cardX, cardY, cardW, cardH, photoSz, badgeSz,
                        imgData, badgeImg, accentColor, number, firstName, lastName) {
    // Card background
    ctx.fillStyle     = 'rgba(255,255,255,0.93)';
    ctx.shadowColor   = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur    = 10;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // Left accent bar
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, 5, cardH, [12, 0, 0, 12]);
    ctx.fill();

    // Circular photo, vertically centred
    const photoOffsetY = (cardH - photoSz) / 2;
    if (imgData && imgData.img) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.beginPath();
        ctx.arc(cardX + 5 + photoSz / 2, cardY + photoOffsetY + photoSz / 2, photoSz / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const scale = Math.max(photoSz / imgData.img.width, photoSz / imgData.img.height);
        const sw = imgData.img.width * scale, sh = imgData.img.height * scale;
        ctx.drawImage(imgData.img,
            cardX + 5 + (photoSz - sw) / 2,
            cardY + photoOffsetY + (photoSz - sh) / 2, sw, sh);
        ctx.restore();
    }

    // Badge — top-right corner of card
    if (badgeImg && badgeImg.img) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(badgeImg.img,
            cardX + cardW - badgeSz - 6,
            cardY + 6, badgeSz, badgeSz);
    }

    // Text block
    const textX  = cardX + 5 + photoSz + 10;
    const availW = cardW - photoSz - 5 - 10 - 6;

    ctx.save();
    ctx.beginPath();
    ctx.rect(textX, cardY, availW, cardH);
    ctx.clip();

    ctx.textAlign = 'left';

    ctx.fillStyle = accentColor;
    ctx.font      = 'bold 13px Calibri, sans-serif';
    ctx.fillText('#' + number, textX, cardY + cardH * 0.30);

    ctx.fillStyle = '#475569';
    ctx.font      = '12px Calibri, sans-serif';
    ctx.fillText(firstName, textX, cardY + cardH * 0.55);

    ctx.fillStyle = '#1e293b';
    ctx.font      = 'bold 14px Calibri, sans-serif';
    ctx.fillText(lastName, textX, cardY + cardH * 0.82);

    ctx.restore();
}


// ─── Helpers ───────────────────────────────

function drawRoundedImage(ctx, img, x, y, size) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    const scale = Math.max(size / img.width, size / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, x + (size - sw) / 2, y + (size - sh) / 2, sw, sh);
    ctx.restore();

    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();
}
