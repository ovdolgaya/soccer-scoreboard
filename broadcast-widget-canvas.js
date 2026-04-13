// ════════════════════════════════════════════════════════════════
//  BROADCAST WIDGET — CANVAS / THUMBNAIL RENDERING
//  Depends on: bwCanvas, bwCtx, bwCanvasLayer, bwTeamsCache,
//              bwFetchTeamData(), database, BW_MATCH_ID
// ════════════════════════════════════════════════════════════════

// ── Draw match thumbnail onto bwCanvas ──
function bwDrawMatchThumb(matchData, showScore, callback) {
    const champTitle = (matchData.championshipTitle || '').trim();

    function fetchTeamPair() {
        const p1 = matchData.team1Id
            ? database.ref('teams/' + matchData.team1Id).once('value').then(s => { const t = s.val()||{}; return {logo:t.logo||'', color:t.color||'#08399A'}; })
            : Promise.resolve({ logo: matchData.team1Logo||'', color: matchData.team1Color||'#08399A' });
        const p2 = matchData.team2Id
            ? database.ref('teams/' + matchData.team2Id).once('value').then(s => { const t = s.val()||{}; return {logo:t.logo||'', color:t.color||'#08399A'}; })
            : Promise.resolve({ logo: matchData.team2Logo||'', color: matchData.team2Color||'#08399A' });
        return Promise.all([p1, p2]);
    }

    function drawAll(champLogoImg, t1, t2) {
        const canvas = bwCanvas;
        const ctx    = bwCtx;
        const W = 1920, H = 1080;
        canvas.width = W; canvas.height = H;
        const SCALE = W / 1280;

        // Background
        const bgGrad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.65);
        bgGrad.addColorStop(0, 'rgba(25,71,186,0.8)');
        bgGrad.addColorStop(1, 'rgba(0,51,160,0.90)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Header bar
        const headerH = Math.round(100 * SCALE);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(0, 0, W, headerH);

        // Championship logo
        const logoSize = Math.round(68 * SCALE);
        const pad      = (headerH - logoSize) / 2;
        if (champLogoImg && champLogoImg.naturalWidth > 0) {
            const sc = logoSize / Math.max(champLogoImg.naturalWidth, champLogoImg.naturalHeight);
            const lw = champLogoImg.naturalWidth * sc, lh = champLogoImg.naturalHeight * sc;
            const lx = pad, ly = (headerH - lh) / 2;
            const lp = logoSize * 0.1;
            ctx.fillStyle = 'white';
            ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = Math.round(6*SCALE); ctx.shadowOffsetY = Math.round(2*SCALE);
            ctx.beginPath(); ctx.roundRect(lx-lp, ly-lp, lw+lp*2, lh+lp*2, Math.round(8*SCALE)); ctx.fill();
            ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
            ctx.drawImage(champLogoImg, lx, ly, lw, lh);
        }

        ctx.fillStyle = 'white';
        ctx.font = `bold ${Math.round(52*SCALE)}px Calibri, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(champTitle || 'ТОВАРИЩЕСКИЙ МАТЧ', W/2, headerH/2);

        // Load team logos
        const toLoad = [];
        if (t1.logo) toLoad.push({key:'t1', src:t1.logo});
        if (t2.logo) toLoad.push({key:'t2', src:t2.logo});
        const loaded = {}; let count = 0;

        function onLoaded() {
            if (++count < toLoad.length) return;
            drawBody();
        }

        function drawBody() {
            const squareSize = Math.round(200 * SCALE);
            const squareY    = H/2 - Math.round(100 * SCALE);
            const cx1 = W/2 - Math.round(350 * SCALE);
            const cx2 = W/2 + Math.round(350 * SCALE);

            function drawSquare(img, cx) {
                const sqX = cx - squareSize/2;
                const r   = squareSize * 0.18;
                ctx.fillStyle = 'white';
                ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = Math.round(12*SCALE); ctx.shadowOffsetY = Math.round(4*SCALE);
                ctx.beginPath(); ctx.roundRect(sqX, squareY, squareSize, squareSize, r); ctx.fill();
                ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
                if (img && img.naturalWidth > 0) {
                    const p2 = squareSize * 0.1, avail = squareSize - p2*2;
                    const s  = Math.min(avail/img.naturalWidth, avail/img.naturalHeight);
                    const iw = img.naturalWidth*s, ih = img.naturalHeight*s;
                    ctx.drawImage(img, sqX+(squareSize-iw)/2, squareY+(squareSize-ih)/2, iw, ih);
                }
            }

            drawSquare(loaded['t1']||null, cx1);
            drawSquare(loaded['t2']||null, cx2);

            ctx.fillStyle = 'white';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

            // Center: VS or score
            if (showScore) {
                const s1 = String(matchData.score1 || 0);
                const s2 = String(matchData.score2 || 0);
                ctx.font = `bold ${Math.round(90*SCALE)}px Calibri, sans-serif`;
                const sepW = Math.round(24*SCALE);
                const s1W  = ctx.measureText(s1).width;
                const s2W  = ctx.measureText(s2).width;
                const totalW = s1W + sepW*2 + ctx.measureText(':').width + s2W;
                let x = W/2 - totalW/2;
                const midY = H/2 + Math.round(20*SCALE);
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'left';
                ctx.fillText(s1, x, midY); x += s1W + sepW;
                ctx.fillStyle = 'rgba(255,255,255,0.55)';
                ctx.font = `bold ${Math.round(60*SCALE)}px Calibri, sans-serif`;
                ctx.textBaseline = 'middle';
                ctx.fillText(':', x, midY); x += ctx.measureText(':').width + sepW;
                ctx.fillStyle = 'white';
                ctx.font = `bold ${Math.round(90*SCALE)}px Calibri, sans-serif`;
                ctx.fillText(s2, x, midY);
            } else {
                ctx.font = `bold ${Math.round(60*SCALE)}px Calibri, sans-serif`;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('VS', W/2, H/2 + Math.round(20*SCALE));
            }

            // Team names
            ctx.fillStyle = 'white';
            ctx.font = `bold ${Math.round(48*SCALE)}px Calibri, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'top';
            ctx.fillText(matchData.team1Name || '', cx1, squareY + squareSize + Math.round(20*SCALE));
            ctx.fillText(matchData.team2Name || '', cx2, squareY + squareSize + Math.round(20*SCALE));

            // Date
            let dateStr = '';
            if (matchData.scheduledTime) {
                const d = new Date(matchData.scheduledTime);
                dateStr = String(d.getDate()).padStart(2,'0') + '.' +
                          String(d.getMonth()+1).padStart(2,'0') + '.' +
                          d.getFullYear();
                if (!showScore) {
                    dateStr += ' в ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
                }
            } else if (matchData.matchDate) {
                const p = matchData.matchDate.split('-');
                dateStr = p[2] + '.' + p[1] + '.' + p[0];
            }
            if (dateStr) {
                ctx.font = `${Math.round(44*SCALE)}px Calibri, sans-serif`;
                ctx.textBaseline = 'bottom';
                ctx.fillText(dateStr, W/2, H - Math.round(60*SCALE));
            }

            if (callback) callback();
        }

        if (toLoad.length === 0) { drawBody(); return; }
        toLoad.forEach(function(item) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload  = function() { loaded[item.key] = img; onLoaded(); };
            img.onerror = function() { onLoaded(); };
            img.src = item.src;
        });
    }

    fetchTeamPair().then(function(teams) {
        const t1 = teams[0], t2 = teams[1];
        if (champTitle) {
            database.ref('championships').orderByChild('title').equalTo(champTitle)
                .once('value').then(function(snap) {
                    let logoSrc = null;
                    snap.forEach(function(child) { if (child.val().logo) logoSrc = child.val().logo; });
                    if (logoSrc) {
                        const img = new Image(); img.crossOrigin = 'anonymous';
                        img.onload  = () => drawAll(img, t1, t2);
                        img.onerror = () => drawAll(null, t1, t2);
                        img.src = logoSrc;
                    } else { drawAll(null, t1, t2); }
                }).catch(() => drawAll(null, t1, t2));
        } else { drawAll(null, t1, t2); }
    });
}

// Draw canvas then capture as data URL for caching
function bwCacheMatchThumb(matchData, showScore) {
    return new Promise(function(resolve) {
        bwDrawMatchThumb(matchData, showScore, function() {
            resolve(bwCanvas.toDataURL('image/png'));
        });
    });
}

// Draw roster thumbnail and return data URL via the existing helper
function bwCacheRosterThumb(teamId) {
    return new Promise(function(resolve, reject) {
        try {
            generateRosterThumbnailHelper(teamId, function(blob) {
                if (!blob) { reject(new Error('no blob')); return; }
                const url = URL.createObjectURL(blob);
                resolve(url);
            });
        } catch(e) { reject(e); }
    });
}

// Display a cached URL on the canvas layer (as an <img> for perf)
function bwShowCachedImage(url) {
    // Clear the canvas so it does not bleed through behind the img
    bwCtx.clearRect(0, 0, bwCanvas.width, bwCanvas.height);

    let img = document.getElementById('bw-canvas-img');
    if (!img) {
        img = document.createElement('img');
        img.id = 'bw-canvas-img';
        img.style.cssText = 'width:1920px;height:1080px;object-fit:cover;position:absolute;inset:0;';
        bwCanvasLayer.appendChild(img);
    }
    img.src = url;
}

function bwShowLiveCanvas() {
    // Hide the cached img so the live <canvas> is visible
    const img = document.getElementById('bw-canvas-img');
    if (img) { img.src = ''; }
}
