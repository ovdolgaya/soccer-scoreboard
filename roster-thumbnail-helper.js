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
    if (count <= 5)  return { cols: count, rows: 1 };
    if (count <= 7)  return { cols: Math.ceil(count / 2), rows: 2 };
    if (count <= 10) return { cols: Math.ceil(count / 2), rows: 2 };
    if (count <= 12) return { cols: 6, rows: 2 };
    if (count <= 14) return { cols: 5, rows: 3 };
    if (count <= 15) return { cols: 5, rows: 3 };
    if (count <= 18) return { cols: 6, rows: 3 };
    return             { cols: 7, rows: 3 };
}

function generateRosterImage(teamData, players, coachData, callback) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width  = 2560;
    canvas.height = 1440;

    const goalkeepers  = players.filter(p => p.isGoalkeeper);
    const fieldPlayers = players.filter(p => !p.isGoalkeeper);

    const imagesToLoad = [];
    const loadedImages = {};

    imagesToLoad.push({ key: 'teamLogo', src: teamData.logo });

    if (teamData.goalkeeperBadge)  imagesToLoad.push({ key: 'goalkeeperBadge',  src: teamData.goalkeeperBadge });
    if (teamData.fieldPlayerBadge) imagesToLoad.push({ key: 'fieldPlayerBadge', src: teamData.fieldPlayerBadge });

    if (coachData && coachData.name) {
        imagesToLoad.push({ key: 'coachPhoto', src: coachData.photo || teamData.logo });
    }

    const gksToShow = goalkeepers.slice(0, 3);
    gksToShow.forEach((gk, i) => {
        imagesToLoad.push({ key: `gk_${i}`, src: gk.photo || teamData.logo, player: gk });
    });

    const layout = calcFieldLayout(fieldPlayers.length);
    const maxPlayers = layout.cols * layout.rows;
    const playersToShow = fieldPlayers.slice(0, maxPlayers);
    playersToShow.forEach((player, i) => {
        imagesToLoad.push({ key: `player_${i}`, src: player.photo || teamData.logo, player });
    });

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
    const W = canvas.width;   // 2560
    const H = canvas.height;  // 1440

    const SCALE      = W / 1280;
    const CARD_H     = Math.round(90  * SCALE);
    const CARD_R     = Math.round(12  * SCALE);  // card corner radius — single source of truth
    const PHOTO_SZ   = Math.round(80  * SCALE);  // slightly smaller than CARD_H so it stays inside
    const BADGE_SZ   = Math.round(22  * SCALE);
    const PADDING    = Math.round(40  * SCALE);
    const GAP_X      = Math.round(10  * SCALE);
    const BOTTOM_PAD = Math.round(20  * SCALE);

    ctx.fillStyle = 'rgba(59, 131, 246, 0.7)';
    ctx.fillRect(0, 0, W, H);

    let currentY = Math.round(40 * SCALE);

    // ── Header: Team logo (left) + Coach (centre) ──
    const logoSquareSize = Math.round(75 * SCALE);
    const logoMaxSize    = Math.round(58 * SCALE);
    const logoSquareX    = Math.round(70 * SCALE);

    ctx.fillStyle     = 'white';
    ctx.shadowColor   = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur    = Math.round(10 * SCALE);
    ctx.shadowOffsetY = Math.round(4  * SCALE);
    ctx.beginPath();
    ctx.roundRect(logoSquareX, currentY, logoSquareSize, logoSquareSize, CARD_R);
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

    let headerH = logoSquareSize;
    if (coachData && coachData.name && loadedImages['coachPhoto']) {
        const coachSize = Math.round(58 * SCALE);
        const cx = W / 2;
        const cy = currentY + (logoSquareSize - coachSize) / 2;
        drawRoundedImage(ctx, loadedImages['coachPhoto'].img, cx - coachSize / 2, cy, coachSize);

        ctx.fillStyle   = 'white';
        ctx.font        = `bold ${Math.round(18 * SCALE)}px Calibri, sans-serif`;
        ctx.textAlign   = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur  = Math.round(6 * SCALE);
        ctx.fillText('Тренер: ' + coachData.name, cx, cy + coachSize + Math.round(20 * SCALE));
        ctx.shadowBlur = 0;
        headerH = Math.max(logoSquareSize, coachSize + Math.round(20 * SCALE) + Math.round(16 * SCALE));
    }

    currentY += headerH + Math.round(40 * SCALE);

    const totalRows = (gksToShow.length > 0 ? 1 : 0) + layout.rows;
    const cardW     = Math.floor((W - PADDING * 2 - GAP_X * (layout.cols - 1)) / layout.cols);
    const GAP_Y     = totalRows <= 2 ? Math.round(40 * SCALE) : Math.round(20 * SCALE);

    // ── Title ──
    const TITLE_H = Math.round(44 * SCALE);
    ctx.fillStyle   = 'rgba(255,255,255,0.92)';
    ctx.font        = `bold ${Math.round(26 * SCALE)}px Calibri, sans-serif`;
    ctx.textAlign   = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur  = Math.round(6 * SCALE);
    ctx.fillText('Состав команды', W / 2, currentY + Math.round(22 * SCALE));
    ctx.shadowBlur  = 0;
    currentY += TITLE_H;

    const totalGridH = totalRows * CARD_H + (totalRows - 1) * GAP_Y;
    const availableH = H - currentY - BOTTOM_PAD;
    const gridStartY = currentY + Math.max(0, (availableH - totalGridH) / 2);

    let rowY = gridStartY;

    // ── Goalkeepers ──
    if (gksToShow.length > 0) {
        const totalW = gksToShow.length * cardW + (gksToShow.length - 1) * GAP_X;
        const startX = (W - totalW) / 2;

        gksToShow.forEach((gk, i) => {
            const cardX = startX + i * (cardW + GAP_X);
            drawPlayerCard(ctx, cardX, rowY, cardW, CARD_H, CARD_R, PHOTO_SZ, BADGE_SZ,
                loadedImages[`gk_${i}`], loadedImages['goalkeeperBadge'],
                '#08399A', gk.number, gk.firstName, gk.lastName);
        });

        rowY += CARD_H + GAP_Y;
    }

    // ── Field players ──
    if (playersToShow.length > 0 && layout.cols > 0) {
        playersToShow.forEach((player, i) => {
            const row   = Math.floor(i / layout.cols);
            const col   = i % layout.cols;
            const cardX = PADDING + col * (cardW + GAP_X);
            const cardY = rowY + row * (CARD_H + GAP_Y);

            drawPlayerCard(ctx, cardX, cardY, cardW, CARD_H, CARD_R, PHOTO_SZ, BADGE_SZ,
                loadedImages[`player_${i}`], loadedImages['fieldPlayerBadge'],
                '#08399A', player.number, player.firstName, player.lastName);
        });
    }

    canvas.toBlob(function (blob) {
        if (callback) callback(blob, teamData.name);
    });
}

// ── Card renderer ─────────────────────────────────────────────
// CARD_R is passed in so accent bar corners match the card exactly
function drawPlayerCard(ctx, cardX, cardY, cardW, cardH, cardR, photoSz, badgeSz,
                        imgData, badgeImg, accentColor, number, firstName, lastName) {

    const barW = Math.round(6 * (cardH / 90));  // ~6px at base scale

    // ── Card background (with shadow) ──
    ctx.save();
    ctx.fillStyle     = 'rgba(255,255,255,0.93)';
    ctx.shadowColor   = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur    = Math.round(cardR * 0.83);
    ctx.shadowOffsetY = Math.round(cardR * 0.25);
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fill();
    ctx.restore();

    // ── Left accent border — clip to card shape, stroke a wide line flush to left edge ──
    // lineWidth is centred on the path; doubling it and placing the path at cardX means
    // the right half paints inside the card, the left half is clipped away.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.clip();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth   = barW * 2;
    ctx.beginPath();
    ctx.moveTo(cardX, cardY);
    ctx.lineTo(cardX, cardY + cardH);
    ctx.stroke();
    ctx.restore();

    // ── Rectangular photo, full card height, clipped by card rounded corners ──
    // Photo sits flush against the accent bar; card's roundRect clip handles the corners.
    const photoX = cardX + barW;

    if (imgData && imgData.img) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        // Clip to the card shape so photo corners follow the card's border-radius
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
        ctx.clip();
        // Cover-fit: fill the photo column (photoSz wide, full cardH tall)
        const srcRatio  = imgData.img.width / imgData.img.height;
        const destRatio = photoSz / cardH;
        let sw, sh, sx, sy;
        if (srcRatio > destRatio) {
            // image is wider than slot — crop sides
            sh = imgData.img.height;
            sw = sh * destRatio;
            sx = (imgData.img.width - sw) / 2;
            sy = 0;
        } else {
            // image is taller than slot — crop top/bottom, bias toward top (faces)
            sw = imgData.img.width;
            sh = sw / destRatio;
            sx = 0;
            sy = 0;  // top-aligned so faces aren't cropped
        }
        ctx.drawImage(imgData.img, sx, sy, sw, sh, photoX, cardY, photoSz, cardH);
        ctx.restore();
    }

    // Alias photoCX / photoCY so text-layout math below stays unchanged
    const photoCX = photoX + photoSz / 2;

    // ── Badge — top-right corner ──
    if (badgeImg && badgeImg.img) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(badgeImg.img,
            cardX + cardW - badgeSz - Math.round(cardR * 0.5),
            cardY + Math.round(cardR * 0.5), badgeSz, badgeSz);
    }

    // ── Text block ──
    const textGap = Math.round(cardR * 0.83);  // ~10px at base scale
    const textX   = photoX + photoSz + textGap;
    const availW  = cardX + cardW - textX - Math.round(cardR * 0.5);

    ctx.save();
    ctx.beginPath();
    ctx.rect(textX, cardY, availW, cardH);
    ctx.clip();

    ctx.textAlign = 'left';
    const _s = cardH / 90;

    ctx.fillStyle = accentColor;
    ctx.font      = `bold ${Math.round(13 * _s)}px Calibri, sans-serif`;
    ctx.fillText('#' + number, textX, cardY + cardH * 0.30);

    ctx.fillStyle = '#475569';
    ctx.font      = `${Math.round(12 * _s)}px Calibri, sans-serif`;
    ctx.fillText(firstName, textX, cardY + cardH * 0.55);

    ctx.fillStyle = '#1e293b';
    ctx.font      = `bold ${Math.round(14 * _s)}px Calibri, sans-serif`;
    ctx.fillText(lastName, textX, cardY + cardH * 0.82);

    ctx.restore();
}

// ─── Helpers ───────────────────────────────────────────────────

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
    ctx.lineWidth   = Math.max(1, Math.round(3 * (size / 58)));
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.stroke();
}
