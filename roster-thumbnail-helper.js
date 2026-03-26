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
    if (count <= 0) return { cols: 0, rows: 0 };
    if (count <= 8) return { cols: count, rows: 1 };
    return            { cols: Math.ceil(count / 2), rows: 2 };
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
    if (teamData.coachBadge) imagesToLoad.push({ key: 'coachBadge', src: teamData.coachBadge })

    const hasCoach = coachData && (coachData.lastName || coachData.firstName || coachData.name);
    if (hasCoach) {
        imagesToLoad.push({ key: 'coachPhoto', src: coachData.photo || teamData.logo });
    }

    const gksToShow = goalkeepers.slice(0, 3);
    gksToShow.forEach((gk, i) =>
        imagesToLoad.push({ key: `gk_${i}`, src: gk.photo || teamData.logo, player: gk }));

    const layout        = calcFieldLayout(fieldPlayers.length);
    const maxPlayers    = layout.cols * layout.rows;
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
    const W     = canvas.width;   // 2560
    const H     = canvas.height;  // 1440
    const SCALE = W / 1280;       // 2 at 2560px

    // ── Fixed structural constants ──
    const CARD_R   = Math.round(10 * SCALE);
    const BADGE_SZ = Math.round(22 * SCALE);
    const PADDING  = Math.round(40 * SCALE);
    const GAP_X    = Math.round(12 * SCALE);
    const GAP_Y    = Math.round(12 * SCALE);
    const LABEL_H  = Math.round(40 * SCALE);  // section label row height
    const HEADER_H = Math.round(100 * SCALE);
    const FOOTER_RESERVE = Math.round(60 * SCALE);  // space at bottom for team name footer

    // ── Dynamic sizing — 3:4 portrait aspect ratio (width:height) ──
    // Step 1: calculate cardW from available width and column count
    // Step 2: derive CARD_H = cardW * 4/3
    // Step 3: verify all rows fit in available height — scale down if needed
    const hasGks   = gksToShow.length > 0;
    const showRow1 = hasCoach || hasGks;

    const contentStartY = HEADER_H + Math.round(20 * SCALE);
    const totalCardRows = (showRow1 ? 1 : 0) + (layout.rows || 0);

    // Fixed vertical overhead (everything except the cards themselves)
    const fixedVertical = (showRow1 ? LABEL_H : 0)                            // ВРАТАРИ label
                        + (playersToShow.length > 0 ? LABEL_H : 0)            // ПОЛЕВЫЕ ИГРОКИ label
                        + (showRow1 ? Math.round(20 * SCALE) : 0)             // gap after GK row
                        + (layout.rows > 1 ? (layout.rows - 1) * GAP_Y : 0)  // gaps between field rows
                        + FOOTER_RESERVE;

    const availableHForCards = H - contentStartY - fixedVertical;

    // cardW always fills the full available width for the given column count
    const availW         = W - PADDING * 2;
    const cardWFromWidth = Math.floor((availW - GAP_X * (layout.cols - 1)) / layout.cols);

    // CARD_H from 3:4 ratio
    const cardHFrom3x4 = Math.round(cardWFromWidth * 4 / 3);

    // Max CARD_H that fits all rows vertically
    const cardHFromHeight = totalCardRows > 0
        ? Math.floor(availableHForCards / totalCardRows)
        : cardHFrom3x4;

    // Use whichever is smaller — ratio wins unless we're tight on height
    const CARD_H = Math.max(Math.round(100 * SCALE), Math.min(cardHFrom3x4, cardHFromHeight));

    // cardW always stretches to fill full width regardless of CARD_H
    const cardW = cardWFromWidth;

    // ── Radial gradient background — stadium spotlight effect ──
    const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.65);
    bgGrad.addColorStop(0, 'rgba(25, 71, 186, 0.8)');
    bgGrad.addColorStop(1, 'rgba(0, 51, 160, 0.90)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ════════════════════════════════════════════════════════
    // HEADER BAND — logo + "СОСТАВ КОМАНДЫ"
    // ════════════════════════════════════════════════════════
    const logoSize = Math.round(70 * SCALE);

    // Team logo — white rounded square
    let titleOffsetX = PADDING;
    if (loadedImages['teamLogo']) {
        const img  = loadedImages['teamLogo'].img;
        const lpad = logoSize * 0.1;
        const sc   = logoSize / Math.max(img.width, img.height);
        const lw   = img.width  * sc;
        const lh   = img.height * sc;
        const lx   = PADDING;
        const ly   = (HEADER_H - lh) / 2;

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

    // "СОСТАВ КОМАНДЫ" title
    ctx.fillStyle    = 'white';
    ctx.font         = `bold ${Math.round(45 * SCALE)}px Lexend, Calibri, sans-serif`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor  = 'rgba(0,0,0,0.30)';
    ctx.shadowBlur   = Math.round(8 * SCALE);
    ctx.fillText('СОСТАВ КОМАНДЫ', titleOffsetX, HEADER_H / 2);
    ctx.shadowBlur   = 0;
    ctx.textBaseline = 'alphabetic';

    // ════════════════════════════════════════════════════════
    // CONTENT AREA — coach + GKs row, then field players
    // ════════════════════════════════════════════════════════
    let currentY = contentStartY;

    if (showRow1) {
        const ROW1_INNER_W = W - PADDING * 2;
        const SPLIT_GAP    = Math.round(20 * SCALE);
        const COACH_CARD_W = Math.round(ROW1_INNER_W * 0.25) - Math.round(SPLIT_GAP / 2);
        const GK_AREA_W    = ROW1_INNER_W - COACH_CARD_W - SPLIT_GAP;
        const GK_AREA_X    = PADDING + COACH_CARD_W + SPLIT_GAP;

        // Coach card spans LABEL_H + CARD_H so its bottom aligns with GK cards' bottom
        const COACH_CARD_H = LABEL_H + CARD_H;

        // "ВРАТАРИ" label — left-aligned to first GK card
        if (hasGks) {
            const gkGap    = Math.round(10 * SCALE);
            const gkCardW  = cardW;
            const totalGkW = gksToShow.length * gkCardW + (gksToShow.length - 1) * gkGap;
            const gkStartX = GK_AREA_X + Math.max(0, (GK_AREA_W - totalGkW) / 2);

            ctx.fillStyle    = 'rgba(166, 200, 255, 0.75)';
            ctx.font         = `bold ${Math.round(20 * SCALE)}px Lexend, Calibri, sans-serif`;
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'middle';
            ctx.shadowColor  = 'rgba(0,0,0,0.20)';
            ctx.shadowBlur   = Math.round(3 * SCALE);
            ctx.fillText('ВРАТАРИ', gkStartX, currentY + LABEL_H / 2);
            ctx.shadowBlur   = 0;
            ctx.textBaseline = 'alphabetic';
        }

        // Coach card — starts at currentY, spans full COACH_CARD_H
        if (hasCoach) {
            const coachName = {
                lastName:   coachData.lastName   || '',
                firstName:  coachData.firstName  || '',
                middleName: coachData.middleName || '',
            };
            if (!coachName.lastName && !coachName.firstName && coachData.name)
                coachName.lastName = coachData.name;

            drawCoachCard(ctx, PADDING, currentY, COACH_CARD_W, COACH_CARD_H, CARD_R,
                          loadedImages['coachPhoto'], loadedImages['coachBadge'], coachName, SCALE);
        }

        // GK cards — vertical, centred in GK area
        const cardRowY = currentY + LABEL_H;
        if (hasGks) {
            const gkGap    = Math.round(10 * SCALE);
            const gkCardW  = cardW;
            const totalGkW = gksToShow.length * gkCardW + (gksToShow.length - 1) * gkGap;
            const gkStartX = GK_AREA_X + Math.max(0, (GK_AREA_W - totalGkW) / 2);
            gksToShow.forEach((gk, i) => {
                const gkX = gkStartX + i * (gkCardW + gkGap);
                drawPlayerCard(ctx, gkX, cardRowY, gkCardW, CARD_H, CARD_R, BADGE_SZ,
                               loadedImages[`gk_${i}`], loadedImages['goalkeeperBadge'],
                               gk.number, gk.firstName, gk.lastName);
            });
        }

        currentY = cardRowY + CARD_H + Math.round(20 * SCALE);
    }

    // ── Field players section ──
    if (playersToShow.length > 0 && layout.cols > 0) {
        // "ПОЛЕВЫЕ ИГРОКИ" label
        ctx.fillStyle    = 'rgba(166, 200, 255, 0.75)';
        ctx.font         = `bold ${Math.round(20 * SCALE)}px Lexend, Calibri, sans-serif`;
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
            drawPlayerCard(ctx, cardX, cardY, cardW, CARD_H, CARD_R, BADGE_SZ,
                           loadedImages[`player_${i}`], loadedImages['fieldPlayerBadge'],
                           player.number, player.firstName, player.lastName);
        });
    }

    // ── Footer — team name with divider lines, only if enough space remains ──
    const fieldRows      = layout.rows;
    const fieldGridBase  = currentY;
    const lastCardBottom = (playersToShow.length > 0)
        ? fieldGridBase + fieldRows * CARD_H + (fieldRows - 1) * GAP_Y
        : fieldGridBase;

    const footerMinSpace = Math.round(60 * SCALE);
    const footerY        = H - Math.round(48 * SCALE);

    if (footerY - lastCardBottom >= footerMinSpace) {
        const lineY     = footerY - Math.round(16 * SCALE);
        const lineColor = 'rgba(166, 200, 255, 0.20)';
        const teamName  = (teamData.name || '').toUpperCase();

        ctx.font = `${Math.round(16 * SCALE)}px Lexend, Calibri, sans-serif`;
        const textW    = ctx.measureText(teamName).width;
        const textGap  = Math.round(20 * SCALE);
        const lineLeft  = PADDING;
        const lineRight = W - PADDING;
        const textCX    = W / 2;
        const gapLeft   = textCX - textW / 2 - textGap;
        const gapRight  = textCX + textW / 2 + textGap;

        ctx.strokeStyle = lineColor;
        ctx.lineWidth   = Math.round(1.5 * SCALE);
        ctx.beginPath();
        ctx.moveTo(lineLeft, lineY);
        ctx.lineTo(gapLeft,  lineY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(gapRight,  lineY);
        ctx.lineTo(lineRight, lineY);
        ctx.stroke();

        ctx.fillStyle    = 'rgba(166, 200, 255, 0.40)';
        ctx.font         = `${Math.round(16 * SCALE)}px Lexend, Calibri, sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(teamName, textCX, lineY);
        ctx.textBaseline = 'alphabetic';
    }

    canvas.toBlob(blob => { if (callback) callback(blob, teamData.name); });
}

// ============================================
// COACH CARD — vertical layout
// Taller than player cards (LABEL_H + CARD_H) so its bottom aligns
// with the GK cards on the right.
// Yellow top accent line distinguishes it from blue player cards.
// ============================================
function drawCoachCard(ctx, cardX, cardY, cardW, cardH, cardR,
                       imgData, badgeImg, coachName, SCALE) {

    const FOOTER_H = Math.round(cardH * 0.22);  // name strip — ~22% of card height
    const photoH   = cardH - FOOTER_H;
    const _s       = cardH / 170;

    // ── Card background ──
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur    = Math.round(cardR * 1.2);
    ctx.shadowOffsetY = Math.round(cardR * 0.3);
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = '#0d1b3e';
    ctx.fill();
    ctx.restore();

    // ── Top accent line — yellow, distinguishes coach from player cards ──
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.clip();
    ctx.fillStyle = '#FCDC00';
    ctx.fillRect(cardX, cardY, cardW, Math.round(3 * (cardH / 170)));
    ctx.restore();

    // ── Radial glow behind photo — warm yellow tint for coach ──
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, photoH, [cardR, cardR, 0, 0]);
    ctx.clip();
    const glow = ctx.createRadialGradient(
        cardX + cardW / 2, cardY + photoH * 0.6, 0,
        cardX + cardW / 2, cardY + photoH * 0.6, cardW * 0.75
    );
    glow.addColorStop(0,   'rgba(252, 220, 0,   0.12)');
    glow.addColorStop(0.5, 'rgba(0,   51,  160, 0.35)');
    glow.addColorStop(1,   'rgba(0,   10,  40,  0.00)');
    ctx.fillStyle = glow;
    ctx.fillRect(cardX, cardY, cardW, photoH);
    ctx.restore();

    // ── Coach photo — contain-fit, pinned to card bottom edge ──
    if (imgData && imgData.img) {
        const photoTopInset = Math.round(cardH * 0.04);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, cardR);  // clip to full card
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const availH = cardH - photoTopInset;
        const scale  = Math.min(cardW / imgData.img.width, availH / imgData.img.height);
        const dw     = imgData.img.width  * scale;
        const dh     = imgData.img.height * scale;
        const dx     = cardX + (cardW - dw) / 2;
        const dy     = cardY + cardH - dh;   // pin to card bottom
        ctx.drawImage(imgData.img, dx, dy, dw, dh);
        ctx.restore();
    }

    // ── Gradient footer overlay — fades smoothly into #0033A0 blue ──
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY + photoH - Math.round(cardH * 0.18), cardW,
                  FOOTER_H + Math.round(cardH * 0.18), [0, 0, cardR, cardR]);
    ctx.clip();
    const footGrad = ctx.createLinearGradient(
        0, cardY + photoH - Math.round(cardH * 0.20),
        0, cardY + cardH
    );
    footGrad.addColorStop(0,    'rgba(0, 51, 160, 0)');
    footGrad.addColorStop(0.35, 'rgba(0, 51, 160, 0.75)');
    footGrad.addColorStop(0.65, 'rgba(0, 51, 160, 0.95)');
    footGrad.addColorStop(1,    'rgba(0, 51, 160, 1.0)');
    ctx.fillStyle = footGrad;
    ctx.fillRect(cardX, cardY + photoH - Math.round(cardH * 0.20),
                 cardW, FOOTER_H + Math.round(cardH * 0.20));
    ctx.restore();

    // ── "ТРЕНЕР" badge — top-left, yellow pill ──
    const badgeH  = Math.round(cardH * 0.085);
    const badgeY  = cardY + Math.round(cardR * 0.5) + Math.round(3 * (cardH / 170));
    ctx.font      = `bold ${Math.round(badgeH * 0.62)}px Lexend, Calibri, sans-serif`;
    const badgeW  = ctx.measureText('ТРЕНЕР').width + Math.round(cardW * 0.12);
    const badgeX  = cardX + Math.round(cardR * 0.5);
    const badgeR2 = Math.round(4 * (cardH / 170));

    ctx.save();
    ctx.fillStyle = '#FCDC00';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeR2);
    ctx.fill();
    ctx.fillStyle    = '#0d1b3e';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ТРЕНЕР', badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.restore();

    // ── Name block — firstName / LASTNAME, plus icon right-aligned in footer ──
    const footerTextX  = cardX + Math.round(cardW * 0.08);
    const footerBottom = cardY + cardH - Math.round(cardH * 0.06);
    const badgeSz      = Math.round(28 * SCALE);
    const badgeAreaW   = badgeSz + Math.round(cardW * 0.06);
    const nameAvailW   = cardW - Math.round(cardW * 0.08) - badgeAreaW;
    const footerMidY   = cardY + photoH + FOOTER_H / 2;

    const lastNameSize  = Math.round(13 * _s);
    const firstNameSize = Math.round(9.5 * _s);
    const lineGap       = Math.round(5   * _s);

    const lastNameY  = footerBottom;
    const firstNameY = lastNameY - lastNameSize - lineGap;

    // Icon — right side of footer, vertically centred
    if (badgeImg && badgeImg.img) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(badgeImg.img,
            cardX + cardW - badgeSz - Math.round(cardW * 0.05),
            footerMidY - badgeSz / 2,
            badgeSz, badgeSz);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(footerTextX, cardY + photoH, nameAvailW, FOOTER_H);
    ctx.clip();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = 'rgba(166, 200, 255, 0.55)';
    ctx.font      = `${firstNameSize}px Lexend, Calibri, sans-serif`;
    ctx.fillText(coachName.firstName, footerTextX, firstNameY);

    ctx.fillStyle = '#d4e3ff';
    ctx.font      = `bold ${lastNameSize}px Lexend, Calibri, sans-serif`;
    ctx.fillText(coachName.lastName, footerTextX, lastNameY);

    ctx.restore();
}

// ============================================
// PLAYER / GK CARD — vertical layout
// Photo fills upper area with radial glow behind transparent PNG.
// Yellow number badge top-left. Gradient footer with name.
// Used for both field players and goalkeepers.
// ============================================
function drawPlayerCard(ctx, cardX, cardY, cardW, cardH, cardR, badgeSz,
                        imgData, badgeImg, number, firstName, lastName) {

    const FOOTER_H = Math.round(cardH * 0.26);  // name strip — ~26% of card height
    const photoH   = cardH - FOOTER_H;
    const _s       = cardH / 170;

    // ── Card background ──
    ctx.save();
    ctx.shadowColor   = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur    = Math.round(cardR * 1.2);
    ctx.shadowOffsetY = Math.round(cardR * 0.3);
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.fillStyle = '#0d1b3e';
    ctx.fill();
    ctx.restore();

    // ── Top accent line — blue ──
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
    ctx.clip();
    ctx.fillStyle = '#1947BA';
    ctx.fillRect(cardX, cardY, cardW, Math.round(3 * (cardH / 170)));
    ctx.restore();

    // ── Radial glow behind photo ──
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, photoH, [cardR, cardR, 0, 0]);
    ctx.clip();
    const glow = ctx.createRadialGradient(
        cardX + cardW / 2, cardY + photoH * 0.55, 0,
        cardX + cardW / 2, cardY + photoH * 0.55, cardW * 0.75
    );
    glow.addColorStop(0, 'rgba(0, 51, 160, 0.55)');
    glow.addColorStop(1, 'rgba(0, 10, 40,  0.00)');
    ctx.fillStyle = glow;
    ctx.fillRect(cardX, cardY, cardW, photoH);
    ctx.restore();

    // ── Player photo — contain-fit, pinned to card bottom edge
    // Photo is scaled against full cardH so chest-up shots fill the card nicely.
    // Clipped to the full card roundRect so it doesn't bleed outside rounded corners.
    // The gradient footer overlay renders on top of the lower portion. ──
    if (imgData && imgData.img) {
        const photoTopInset = Math.round(cardH * 0.06);  // breathing room from top edge
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, cardR);  // clip to full card
        ctx.clip();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        const availH = cardH - photoTopInset;
        const scale  = Math.min(cardW / imgData.img.width, availH / imgData.img.height);
        const dw     = imgData.img.width  * scale;
        const dh     = imgData.img.height * scale;
        const dx     = cardX + (cardW - dw) / 2;   // centre horizontally
        const dy     = cardY + cardH - dh;           // pin to card bottom
        ctx.drawImage(imgData.img, dx, dy, dw, dh);
        ctx.restore();
    }

    // ── Gradient footer overlay — fades photo smoothly into #0033A0 blue ──
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(cardX, cardY + photoH - Math.round(cardH * 0.18), cardW,
                  FOOTER_H + Math.round(cardH * 0.18), [0, 0, cardR, cardR]);
    ctx.clip();
    const footGrad = ctx.createLinearGradient(
        0, cardY + photoH - Math.round(cardH * 0.20),
        0, cardY + cardH
    );
    footGrad.addColorStop(0,    'rgba(0, 51, 160, 0)');
    footGrad.addColorStop(0.35, 'rgba(0, 51, 160, 0.75)');
    footGrad.addColorStop(0.65, 'rgba(0, 51, 160, 0.95)');
    footGrad.addColorStop(1,    'rgba(0, 51, 160, 1.0)');
    ctx.fillStyle = footGrad;
    ctx.fillRect(cardX, cardY + photoH - Math.round(cardH * 0.20),
                 cardW, FOOTER_H + Math.round(cardH * 0.20));
    ctx.restore();

    // ── Number badge — top-left, yellow square ──
    const badgeH  = Math.round(cardH * 0.10);   // smaller: 10% of card height
    const badgeR2 = Math.round(4 * (cardH / 170));
    ctx.save();
    ctx.font = `bold ${Math.round(badgeH * 0.65)}px Lexend, Calibri, sans-serif`;
    const badgeW  = Math.max(
        ctx.measureText(String(number)).width + Math.round(cardW * 0.10),
        Math.round(cardW * 0.18)              // minimum width so single digits aren't too narrow
    );
    const badgeX  = cardX + Math.round(cardR * 0.5);
    const badgeY  = cardY + Math.round(cardR * 0.5) + Math.round(3 * (cardH / 170));

    ctx.fillStyle = '#FCDC00';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, badgeR2);
    ctx.fill();
    ctx.fillStyle    = '#0d1b3e';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(number), badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.restore();

    // ── Badge icon — right side of footer strip, vertically centred ──
    // Drawn before name text so text clipping doesn't affect it
    const footerTextX  = cardX + Math.round(cardW * 0.08);
    const footerBottom = cardY + cardH - Math.round(cardH * 0.06);
    const badgeAreaW   = badgeSz + Math.round(cardW * 0.06);  // icon + right margin
    const nameAvailW   = cardW - Math.round(cardW * 0.08) - badgeAreaW;  // text doesn't overlap icon
    const footerMidY   = cardY + photoH + FOOTER_H / 2;

    if (badgeImg && badgeImg.img) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(badgeImg.img,
            cardX + cardW - badgeSz - Math.round(cardW * 0.05),
            footerMidY - badgeSz / 2,
            badgeSz, badgeSz);
    }

    // ── Name text in footer ──
    ctx.save();
    ctx.beginPath();
    ctx.rect(footerTextX, cardY + photoH, nameAvailW, FOOTER_H);
    ctx.clip();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = 'rgba(166, 200, 255, 0.65)';
    ctx.font      = `${Math.round(10 * _s)}px Lexend, Calibri, sans-serif`;
    ctx.fillText(firstName, footerTextX, footerBottom - Math.round(16 * _s));

    ctx.fillStyle = '#d4e3ff';
    ctx.font      = `bold ${Math.round(13 * _s)}px Lexend, Calibri, sans-serif`;
    ctx.fillText(lastName, footerTextX, footerBottom);

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
