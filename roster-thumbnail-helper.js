// ============================================
// SHARED ROSTER THUMBNAIL GENERATOR
// ============================================

function generateRosterThumbnailHelper(teamId, callback) {
    if (!teamId) { alert('Команда не выбрана'); return; }

    firebase.database().ref('teams/' + teamId).once('value')
        .then(teamSnapshot => {
            if (!teamSnapshot.exists()) { alert('Команда не найдена'); return; }
            const teamData = teamSnapshot.val();

            firebase.database().ref('players')
                .orderByChild('teamId').equalTo(teamId).once('value')
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
                        .catch(() => generateRosterImage(teamData, players, null, callback));
                })
                .catch(error => alert('Ошибка загрузки игроков: ' + error.message));
        })
        .catch(error => alert('Ошибка загрузки команды: ' + error.message));
}

// ============================================
// LAYOUT CALCULATOR — field players
// ============================================
function calcFieldLayout(count) {
    if (count <= 0)  return { cols: 0, rows: 0 };
    if (count <= 5)  return { cols: count, rows: 1 };
    if (count <= 8)  return { cols: Math.ceil(count / 2), rows: 2 };
    if (count <= 10) return { cols: Math.ceil(count / 3), rows: 3 };
    if (count <= 12) return { cols: 4, rows: 3 };
    if (count <= 14) return { cols: 5, rows: 3 };
    if (count <= 15) return { cols: 5, rows: 3 };
    if (count <= 18) return { cols: 6, rows: 3 };
    return             { cols: 7, rows: 3 };
}

function generateRosterImage(teamData, players, coachData, callback) {
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');
    canvas.width  = 2560;
    canvas.height = 1440;

    const goalkeepers  = players.filter(p => p.isGoalkeeper);
    const fieldPlayers = players.filter(p => !p.isGoalkeeper);

    const imagesToLoad = [];
    const loadedImages = {};

    imagesToLoad.push({ key: 'teamLogo', src: teamData.logo });
    if (teamData.goalkeeperBadge)  imagesToLoad.push({ key: 'goalkeeperBadge',  src: teamData.goalkeeperBadge });
    if (teamData.fieldPlayerBadge) imagesToLoad.push({ key: 'fieldPlayerBadge', src: teamData.fieldPlayerBadge });

    const hasCoach = coachData && (coachData.lastName || coachData.firstName || coachData.name);
    if (hasCoach) {
        imagesToLoad.push({ key: 'coachPhoto', src: coachData.photo || teamData.logo });
    }

    const gksToShow = goalkeepers.slice(0, 3);
    gksToShow.forEach((gk, i) =>
        imagesToLoad.push({ key: `gk_${i}`, src: gk.photo || teamData.logo, player: gk }));

    const layout     = calcFieldLayout(fieldPlayers.length);
    const maxPlayers = layout.cols * layout.rows;
    const playersToShow = fieldPlayers.slice(0, maxPlayers);
    playersToShow.forEach((player, i) =>
        imagesToLoad.push({ key: `player_${i}`, src: player.photo || teamData.logo, player }));

    let loadedCount = 0;
    const totalImages = imagesToLoad.length;
    if (totalImages === 0) { alert('Нет игроков для отображения'); return; }

    imagesToLoad.forEach(imgData => {
        const img = new Image();
        img.onload = function () {
            loadedImages[imgData.key] = { img, player: imgData.player };
            if (++loadedCount === totalImages)
                drawRosterOnCanvas(canvas, ctx, teamData, coachData, hasCoach,
                                   gksToShow, playersToShow, layout, loadedImages, callback);
        };
        img.onerror = function () {
            if (++loadedCount === totalImages)
                drawRosterOnCanvas(canvas, ctx, teamData, coachData, hasCoach,
                                   gksToShow, playersToShow, layout, loadedImages, callback);
        };
        if (imgData.src && (imgData.src.startsWith('http://') || imgData.src.startsWith('https://')))
            img.crossOrigin = 'anonymous';
        img.src = imgData.src;
    });
}

// ============================================
// MAIN DRAW
// ============================================
function drawRosterOnCanvas(canvas, ctx, teamData, coachData, hasCoach,
                            gksToShow, playersToShow, layout, loadedImages, callback) {
    const W = canvas.width;   // 2560
    const H = canvas.height;  // 1440
    const SCALE = W / 1280;   // 2 at 2560px

    // ── Shared sizing — all cards the same height ──
    const CARD_H     = Math.round(90  * SCALE);
    const CARD_R     = Math.round(12  * SCALE);
    const PHOTO_SZ   = Math.round(80  * SCALE);
    const BADGE_SZ   = Math.round(22  * SCALE);
    const PADDING    = Math.round(40  * SCALE);
    const GAP_X      = Math.round(10  * SCALE);
    const GAP_Y      = Math.round(14  * SCALE);
    const LABEL_H    = Math.round(40  * SCALE);  // section label row height
    const BOTTOM_PAD = Math.round(24  * SCALE);

    // ── Single background color — same everywhere ──
    ctx.fillStyle = 'rgba(59, 131, 246, 0.9)';
    ctx.fillRect(0, 0, W, H);

    // ════════════════════════════════════════════════════════
    // HEADER BAND — dark overlay with logo + "СОСТАВ КОМАНДЫ"
    // Same style as championship thumbnail, only this band differs
    // ════════════════════════════════════════════════════════
    const HEADER_H  = Math.round(110 * SCALE);
    const logoSize  = Math.round(70  * SCALE);
    const logoPad   = (HEADER_H - logoSize) / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, 0, W, HEADER_H);

    // Team logo — white rounded square
    let titleOffsetX = PADDING;
    if (loadedImages['teamLogo']) {
        const img   = loadedImages['teamLogo'].img;
        const lpad  = logoSize * 0.1;
        const scale = logoSize / Math.max(img.width, img.height);
        const lw    = img.width  * scale;
        const lh    = img.height * scale;
        const lx    = logoPad;
        const ly    = (HEADER_H - lh) / 2;

        ctx.fillStyle     = 'white';
        ctx.shadowColor   = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur    = Math.round(8 * SCALE);
        ctx.shadowOffsetY = Math.round(2 * SCALE);
        ctx.beginPath();
        ctx.roundRect(lx - lpad, ly - lpad, lw + lpad * 2, lh + lpad * 2, Math.round(10 * SCALE));
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, lx, ly, lw, lh);

        titleOffsetX = lx + lw + lpad * 2 + Math.round(20 * SCALE);
    }

    // "СОСТАВ КОМАНДЫ" — big bold centred in space right of logo
    const titleAreaW = W - titleOffsetX;
    ctx.fillStyle    = 'white';
    ctx.font         = `bold ${Math.round(52 * SCALE)}px Calibri, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.30)';
    ctx.shadowBlur   = Math.round(8 * SCALE);
    ctx.fillText('СОСТАВ КОМАНДЫ', titleOffsetX + titleAreaW / 2, HEADER_H / 2);
    ctx.shadowBlur   = 0;
    ctx.textBaseline = 'alphabetic';

    // ════════════════════════════════════════════════════════
    // CONTENT AREA — coach + GKs row, then field players
    // All on the same blue background, no extra overlays
    // ════════════════════════════════════════════════════════
    let currentY = HEADER_H + Math.round(20 * SCALE);

    // Calculate cardW based on field player columns (used for all cards)
    const cardW = Math.floor((W - PADDING * 2 - GAP_X * (layout.cols - 1)) / layout.cols);

    // ── Row 1: Coach (25% width) + "ВРАТАРИ" label + GK cards (75%) ──
    const hasGks    = gksToShow.length > 0;
    const showRow1  = hasCoach || hasGks;

    if (showRow1) {
        const ROW1_INNER_W = W - PADDING * 2;
        const SPLIT_GAP    = Math.round(20 * SCALE);
        const COACH_CARD_W = Math.round(ROW1_INNER_W * 0.25) - Math.round(SPLIT_GAP / 2);
        const GK_AREA_W    = ROW1_INNER_W - COACH_CARD_W - SPLIT_GAP;
        const GK_AREA_X    = PADDING + COACH_CARD_W + SPLIT_GAP;

        // Coach card is taller: it spans LABEL_H (for the ВРАТАРИ title) + CARD_H
        // so its bottom edge aligns with the GK cards' bottom edge
        const COACH_CARD_H = LABEL_H + CARD_H;

        // "ВРАТАРИ" label above GK cards — left-aligned to GK area
        if (hasGks) {
            // Calculate where the first GK card will start so the label aligns with it
            const gkGap      = Math.round(10 * SCALE);
            const gkCardW    = cardW;
            const totalGkW   = gksToShow.length * gkCardW + (gksToShow.length - 1) * gkGap;
            const gkStartX   = GK_AREA_X + Math.max(0, (GK_AREA_W - totalGkW) / 2);

            ctx.fillStyle    = 'rgba(255,255,255,0.85)';
            ctx.font         = `bold ${Math.round(20 * SCALE)}px Calibri, sans-serif`;
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'middle';
            ctx.shadowColor  = 'rgba(0,0,0,0.20)';
            ctx.shadowBlur   = Math.round(3 * SCALE);
            ctx.fillText('ВРАТАРИ', gkStartX, currentY + LABEL_H / 2);
            ctx.shadowBlur   = 0;
            ctx.textBaseline = 'alphabetic';
        }

        // Coach card starts at currentY (same as ВРАТАРИ label), spans full COACH_CARD_H
        if (hasCoach) {
            const coachName = {
                lastName:   coachData.lastName   || '',
                firstName:  coachData.firstName  || '',
                middleName: coachData.middleName || '',
            };
            if (!coachName.lastName && !coachName.firstName && coachData.name)
                coachName.lastName = coachData.name;

            drawCoachCard(ctx, PADDING, currentY, COACH_CARD_W, COACH_CARD_H, CARD_R,
                          loadedImages['coachPhoto'], '#08399A', coachName, SCALE);
        }

        // GK cards — same width as field player cardW, centred in GK area
        const cardRowY = currentY + LABEL_H;
        if (hasGks) {
            const gkGap      = Math.round(10 * SCALE);
            // Use field player cardW so GK cards match their size
            const gkCardW    = cardW;
            const totalGkW   = gksToShow.length * gkCardW + (gksToShow.length - 1) * gkGap;
            // Centre the GK group within the GK area
            const gkStartX   = GK_AREA_X + Math.max(0, (GK_AREA_W - totalGkW) / 2);
            gksToShow.forEach((gk, i) => {
                const gkX = gkStartX + i * (gkCardW + gkGap);
                drawPlayerCard(ctx, gkX, cardRowY, gkCardW, CARD_H, CARD_R, PHOTO_SZ, BADGE_SZ,
                               loadedImages[`gk_${i}`], loadedImages['goalkeeperBadge'],
                               '#08399A', gk.number, gk.firstName, gk.lastName);
            });
        }

        currentY = cardRowY + CARD_H + Math.round(20 * SCALE);
    }

    // ── Field players section ──
    if (playersToShow.length > 0 && layout.cols > 0) {
        // "ПОЛЕВЫЕ ИГРОКИ" label
        ctx.fillStyle    = 'rgba(255,255,255,0.85)';
        ctx.font         = `bold ${Math.round(20 * SCALE)}px Calibri, sans-serif`;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor  = 'rgba(0,0,0,0.20)';
        ctx.shadowBlur   = Math.round(3 * SCALE);
        ctx.fillText('ПОЛЕВЫЕ ИГРОКИ', PADDING, currentY + LABEL_H / 2);
        ctx.shadowBlur   = 0;
        ctx.textBaseline = 'alphabetic';

        currentY += LABEL_H;

        playersToShow.forEach((player, i) => {
            const row   = Math.floor(i / layout.cols);
            const col   = i % layout.cols;
            const cardX = PADDING + col * (cardW + GAP_X);
            const cardY = currentY + row * (CARD_H + GAP_Y);
            drawPlayerCard(ctx, cardX, cardY, cardW, CARD_H, CARD_R, PHOTO_SZ, BADGE_SZ,
                           loadedImages[`player_${i}`], loadedImages['fieldPlayerBadge'],
                           '#08399A', player.number, player.firstName, player.lastName);
        });
    }

    // ── Footer — team name with divider lines, only if enough space remains ──
    // currentY now points to start of field player grid (after LABEL_H increment)
    // so lastCardBottom = currentY + rows × CARD_H + row gaps
    const fieldRows     = layout.rows;
    const fieldGridBase = currentY;  // currentY after LABEL_H increment = start of grid
    const lastCardBottom = (playersToShow.length > 0)
        ? fieldGridBase + fieldRows * CARD_H + (fieldRows - 1) * GAP_Y
        : fieldGridBase;

    const footerMinSpace = Math.round(60 * SCALE);  // minimum gap needed to show footer
    const footerY        = H - Math.round(48 * SCALE);  // anchor from bottom

    if (footerY - lastCardBottom >= footerMinSpace) {
        const lineY      = footerY - Math.round(16 * SCALE);
        const textY      = footerY;
        const lineColor  = 'rgba(255,255,255,0.25)';
        const teamName   = (teamData.name || '').toUpperCase();

        // Measure text to know gap width
        ctx.font = `${Math.round(16 * SCALE)}px Calibri, sans-serif`;
        const textW    = ctx.measureText(teamName).width;
        const textGap  = Math.round(20 * SCALE);
        const lineLeft  = PADDING;
        const lineRight = W - PADDING;
        const textCX    = W / 2;
        const gapLeft   = textCX - textW / 2 - textGap;
        const gapRight  = textCX + textW / 2 + textGap;

        // Left line
        ctx.strokeStyle = lineColor;
        ctx.lineWidth   = Math.round(1.5 * SCALE);
        ctx.beginPath();
        ctx.moveTo(lineLeft,  lineY);
        ctx.lineTo(gapLeft,   lineY);
        ctx.stroke();

        // Right line
        ctx.beginPath();
        ctx.moveTo(gapRight,  lineY);
        ctx.lineTo(lineRight, lineY);
        ctx.stroke();

        // Team name centred
        ctx.fillStyle    = 'rgba(255,255,255,0.45)';
        ctx.font         = `${Math.round(16 * SCALE)}px Calibri, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(teamName, textCX, lineY);
        ctx.textBaseline = 'alphabetic';
    }

    canvas.toBlob(blob => { if (callback) callback(blob, teamData.name); });
}

// ============================================
// COACH CARD
// Taller than player cards (LABEL_H + CARD_H) so it aligns with
// the ВРАТАРИ label + GK cards on the right.
// "ТРЕНЕР" is a small yellow pill badge in the top-left corner of the photo.
// Photo fills full card height, name lines on the right — same as player card.
// ============================================
function drawCoachCard(ctx, cardX, cardY, cardW, cardH, cardR,
                       imgData, accentColor, coachName, SCALE) {

    const barW    = Math.round(6 * (cardH / 90));
    const badgeR  = Math.round(6 * SCALE);   // small fixed radius — square with rounded corners
    const badgeSz = Math.round(28 * SCALE);  // coach icon size (top-right)
    const photoX  = cardX + barW;

    // Photo slot width = same proportion as player card (photoSz/CARD_H × cardH)
    // Player card: photoSz = 80*SCALE, cardH = 90*SCALE → ratio ≈ 0.889
    // Apply same ratio to coach cardH so photo is proportionally identical
    const photoSlotW = Math.round(cardH * (80 / 90));
    const photoSlotH = cardH;

    // ── Card background ──
    ctx.save();
    ctx.fillStyle     = 'rgba(255,255,255,0.93)';
    ctx.shadowColor   = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur    = Math.round(cardR * 0.83);
    ctx.shadowOffsetY = Math.round(cardR * 0.25);
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fill();
    ctx.restore();

    // ── Left accent bar ──
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

    // ── Photo — contain-fit (no crop), bottom-aligned within slot ──
    if (imgData && imgData.img) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
        ctx.clip();
        const scale = Math.min(photoSlotW / imgData.img.width, photoSlotH / imgData.img.height);
        const dw    = imgData.img.width  * scale;
        const dh    = imgData.img.height * scale;
        const dx    = photoX + (photoSlotW - dw) / 2;  // centre horizontally
        const dy    = cardY  + (photoSlotH - dh);       // bottom-aligned
        ctx.drawImage(imgData.img, 0, 0, imgData.img.width, imgData.img.height, dx, dy, dw, dh);
        ctx.restore();
    }

    // ── "ТРЕНЕР" badge — top-right corner, yellow, small fixed corner radius ──
    const pillH   = Math.round(24 * SCALE);
    const pillPad = Math.round(14 * SCALE);
    ctx.font      = `bold ${Math.round(12 * SCALE)}px Calibri, sans-serif`;
    const pillW   = ctx.measureText('ТРЕНЕР').width + pillPad * 2;
    const pillX   = cardX + cardW - pillW - Math.round(cardR * 0.5);
    const pillY   = cardY + Math.round(8 * SCALE);

    ctx.save();
    ctx.fillStyle   = '#fcd34d';
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur  = Math.round(3 * SCALE);
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, badgeR);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle    = '#1e293b';
    ctx.font         = `bold ${Math.round(12 * SCALE)}px Calibri, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ТРЕНЕР', pillX + pillW / 2, pillY + pillH / 2);
    ctx.textBaseline = 'alphabetic';

    // ── Text block — name aligned to bottom of card ──
    const textGap = Math.round(10 * SCALE);
    const textX   = photoX + photoSlotW + textGap;
    const availW  = cardX + cardW - textX - Math.round(8 * SCALE);
    const _s      = cardH / 90;
    const pad     = Math.round(10 * SCALE);

    ctx.save();
    ctx.beginPath();
    ctx.rect(textX, cardY, availW, cardH);
    ctx.clip();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';

   
    const lastNameSize   = Math.round(15 * _s);
    const firstNameSize  = Math.round(11 * _s);
    const middleNameSize = Math.round(12 * _s);
    const lineGap        = Math.round(6  * SCALE);

    // Centre the 3-line name block vertically in the card
    const blockH      = firstNameSize + lineGap + middleNameSize + lineGap + lastNameSize;
    const blockTop    = cardY + (cardH - blockH) / 2;
    const firstNameY  = blockTop + firstNameSize;
    const middleNameY = firstNameY + lineGap + middleNameSize;
    const bottomY     = middleNameY + lineGap + lastNameSize;

    ctx.fillStyle = '#64748b';
    ctx.font      = `${firstNameSize}px Calibri, sans-serif`;
    ctx.fillText(coachName.firstName, textX, firstNameY);

    ctx.fillStyle = '#475569';
    ctx.font      = `${middleNameSize}px Calibri, sans-serif`;
    ctx.fillText(coachName.middleName, textX, middleNameY);

    ctx.fillStyle = '#1e293b';
    ctx.font      = `bold ${lastNameSize}px Calibri, sans-serif`;
    ctx.fillText(coachName.lastName, textX, bottomY);

    ctx.restore();
}

// ============================================
// PLAYER / GK CARD
// ============================================
function drawPlayerCard(ctx, cardX, cardY, cardW, cardH, cardR, photoSz, badgeSz,
                        imgData, badgeImg, accentColor, number, firstName, lastName) {

    const barW = Math.round(6 * (cardH / 90));

    // ── Card background ──
    ctx.save();
    ctx.fillStyle     = 'rgba(255,255,255,0.93)';
    ctx.shadowColor   = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur    = Math.round(cardR * 0.83);
    ctx.shadowOffsetY = Math.round(cardR * 0.25);
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fill();
    ctx.restore();

    // ── Left accent bar ──
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

    // ── Photo (rectangular, cover-fit, full card height) ──
    const photoX = cardX + barW;
    if (imgData && imgData.img) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
        ctx.clip();
        const srcRatio  = imgData.img.width / imgData.img.height;
        const destRatio = photoSz / cardH;
        let sw, sh, sx, sy;
        if (srcRatio > destRatio) {
            sh = imgData.img.height; sw = sh * destRatio;
            sx = (imgData.img.width - sw) / 2; sy = 0;
        } else {
            sw = imgData.img.width; sh = sw / destRatio;
            sx = 0; sy = 0;
        }
        ctx.drawImage(imgData.img, sx, sy, sw, sh, photoX, cardY, photoSz, cardH);
        ctx.restore();
    }

    // ── Badge top-right ──
    if (badgeImg && badgeImg.img) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(badgeImg.img,
            cardX + cardW - badgeSz - Math.round(cardR * 0.5),
            cardY + Math.round(cardR * 0.5), badgeSz, badgeSz);
    }

    // ── Text block ──
    const textGap = Math.round(cardR * 0.83);
    const textX   = photoX + photoSz + textGap;
    const availW  = cardX + cardW - textX - Math.round(cardR * 0.5);
    const _s      = cardH / 90;

    ctx.save();
    ctx.beginPath();
    ctx.rect(textX, cardY, availW, cardH);
    ctx.clip();
    ctx.textAlign = 'left';

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

// ============================================
// HELPERS
// ============================================
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
