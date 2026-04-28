// ════════════════════════════════════════════════════════════════
//  WIDGET SHARED JS
//  Используется в broadcast-widget и vertical-widget
//  Зависимости: database (Firebase), font Lexend
//  Экспортирует глобальные функции — подключать до виджет-specific скриптов
// ════════════════════════════════════════════════════════════════

// ── Shared state ──
const wsTeamsCache   = {};   // teamId → {logo, color, name}
const wsPlayersCache = {};   // playerId → player object

// ── Color helpers ──
function wsLightenColor(hex, percent) {
    const num = parseInt((hex || '#08399A').replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return '#' + (0x1000000 + (R * 0x10000) + (G * 0x100) + B).toString(16).slice(1);
}

function wsApplyTeamColors(t1Color, t2Color) {
    document.documentElement.style.setProperty('--team1-color',       t1Color);
    document.documentElement.style.setProperty('--team1-color-light', wsLightenColor(t1Color, 10));
    document.documentElement.style.setProperty('--team2-color',       t2Color);
    document.documentElement.style.setProperty('--team2-color-light', wsLightenColor(t2Color, 10));
}

// ── Team data fetch (shared cache) ──
function wsFetchTeamData(teamId) {
    if (!teamId) return Promise.resolve(null);
    if (wsTeamsCache[teamId]) return Promise.resolve(wsTeamsCache[teamId]);
    return database.ref('teams/' + teamId).once('value').then(function(s) {
        const t = s.val();
        if (t) wsTeamsCache[teamId] = t;
        return t;
    });
}

// ── Players cache prefill ──
function wsPrefillPlayersCache(teamId) {
    if (!teamId) return;
    const cached = typeof _rosterCache !== 'undefined' && _rosterCache['players_' + teamId];
    if (cached) {
        try {
            cached.forEach(function(childSnap) {
                const p = childSnap.val();
                if (p && childSnap.key) wsPlayersCache[childSnap.key] = p;
            });
            return;
        } catch(e) { /* fallthrough */ }
    }
    database.ref('players').orderByChild('teamId').equalTo(teamId)
        .once('value').then(function(snap) {
            snap.forEach(function(childSnap) {
                const p = childSnap.val();
                if (p && !p.isDeleted) wsPlayersCache[childSnap.key] = p;
            });
        }).catch(function() {});
}

// ════════════════════════════════════════════════════════════════
//  SCOREBOARD
// ════════════════════════════════════════════════════════════════

function wsGetMatchStatus(matchData) {
    if (matchData.scheduledTime && matchData.scheduledTime > Date.now()) return 'scheduled';
    return matchData.status || 'waiting';
}

function wsGetTimerContent(matchData) {
    const status = wsGetMatchStatus(matchData);
    if (status === 'scheduled') {
        const d = new Date(matchData.scheduledTime);
        return `<div class="status-message">Матч начнется ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')} в ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}</div>`;
    }
    if (status === 'waiting')     return '<div class="status-message">Ожидание начала матча</div>';
    if (status === 'ended')       return '<div class="status-message">МАТЧ ОКОНЧЕН</div>';
    if (status === 'half1_ended') return '<div class="status-message">ПЕРЕРЫВ</div>';
    if (status === 'half2_ended') return '<div class="status-message">МАТЧ ОКОНЧЕН</div>';
    if (status === 'playing') {
        const halfText = matchData.currentHalf === 1 ? '1 ТАЙМ' : '2 ТАЙМ';
        const elapsed  = Math.max(0, Date.now() - matchData.startTime);
        const sec      = Math.floor(elapsed / 1000);
        const h = String(Math.floor(sec / 3600)).padStart(2, '0');
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        return `<span class="half-indicator">${halfText}:</span><span class="timer" id="wsTimerDisplay">${h}:${m}:${s}</span>`;
    }
    return '<div class="timer">00:00:00</div>';
}

// Рендерит скорборд в переданный DOM-элемент
// scoreboardEl — элемент для score-container
// timerEl — элемент для timer-container (null если не нужен)
function wsRenderScoreboard(matchData, scoreboardEl, timerEl) {
    if (!matchData || !scoreboardEl) return;
    Promise.all([wsFetchTeamData(matchData.team1Id), wsFetchTeamData(matchData.team2Id)])
    .then(function(teams) {
        const t1 = teams[0] || {}, t2 = teams[1] || {};
        const t1Color = t1.color || '#08399A';
        const t2Color = t2.color || '#4A90E2';
        matchData._t1Logo  = t1.logo  || '';
        matchData._t2Logo  = t2.logo  || '';
        matchData._t1Color = t1Color;
        matchData._t2Color = t2Color;
        wsApplyTeamColors(t1Color, t2Color);

        scoreboardEl.innerHTML = `
            <div class="score-container">
                <div class="team team1">
                    ${t1.logo ? `<img src="${t1.logo}" class="team-logo" alt="">` : ''}
                    <div class="team-name">${matchData.team1Name || ''}</div>
                </div>
                <div class="score-card">
                    <span class="score-num">${matchData.score1 || 0}</span>
                    <div class="score-divider"></div>
                    <span class="score-num">${matchData.score2 || 0}</span>
                </div>
                <div class="team team2">
                    ${t2.logo ? `<img src="${t2.logo}" class="team-logo" alt="">` : ''}
                    <div class="team-name">${matchData.team2Name || ''}</div>
                </div>
            </div>`;

        if (timerEl) {
            timerEl.innerHTML = wsGetTimerContent(matchData);
        }
    });
}

// Запускает таймер — обновляет элемент #wsTimerDisplay каждые 100мс
function wsStartTimer(matchData, intervalRef) {
    if (intervalRef.id) { clearInterval(intervalRef.id); intervalRef.id = null; }
    if (matchData.status !== 'playing') return;
    intervalRef.id = setInterval(function() {
        const el = document.getElementById('wsTimerDisplay');
        if (!el) return;
        const elapsed = Math.max(0, Date.now() - (matchData.startTime || Date.now()));
        const sec     = Math.floor(elapsed / 1000);
        const h = String(Math.floor(sec / 3600)).padStart(2, '0');
        const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        el.textContent = h + ':' + m + ':' + s;
    }, 100);
}

// ════════════════════════════════════════════════════════════════
//  GOAL CARD BUILDERS
// ════════════════════════════════════════════════════════════════

// Форматирует matchTime "MM:SS" → "5'"
function wsFmtMinute(goal) {
    if (!goal || !goal.matchTime) return '';
    const parts = goal.matchTime.split(':');
    return parts.length >= 1 ? parseInt(parts[0] || 0, 10) + "'" : '';
}

// Карточка гола основной команды
function wsBuildHomeGoalCard({ photoSrc, logoSrc, number, firstName, lastName, minute, assists, teamName }) {
    const imgSrc    = photoSrc || logoSrc || '';
    const photoHtml = imgSrc ? `<img class="ngc-photo-img" src="${imgSrc}" alt="" onerror="this.style.display='none'">` : '';
    const nameHtml  = `${firstName ? `<span class="ngc-firstname">${firstName}</span>` : ''}<span class="ngc-lastname">${(lastName||'').toUpperCase()}</span>`;

    let assistsHtml = '';
    if (assists && assists.length > 0) {
        const rows = assists.map(function(a) {
            const fullName = [a.firstName, a.lastName ? a.lastName.toUpperCase() : ''].filter(Boolean).join(' ');
            return `<div class="ngc-assist-row">
                <span class="ngc-assist-name">${fullName || '—'}</span>
                <span class="ngc-assist-num">#${a.number || '?'}</span>
            </div>`;
        }).join('');
        assistsHtml = `<div class="ngc-assists">
            <div class="ngc-assists-title">Ассистенты</div>
            <div class="ngc-assists-list">${rows}</div>
        </div>`;
    }

    return `
        <div class="ngc ngc-home">
            <div class="ngc-photo">
                ${photoHtml}
                <div class="ngc-photo-footer"></div>
                <div class="ngc-num-badge">${number || '?'}</div>
            </div>
            <div class="ngc-sep"></div>
            <div class="ngc-panel">
                <div class="ngc-left">
                    <div class="ngc-goal-row">
                        <span class="ngc-goal-word">Гол!</span>
                        <span class="ngc-minute">${minute || ''}</span>
                    </div>
                    <div class="ngc-name">${nameHtml}</div>
                    ${teamName ? `<div class="ngc-club">${teamName}</div>` : ''}
                </div>
                ${assistsHtml}
                <div class="ngc-progress" style="background:linear-gradient(to right,#e3c600,rgba(227,198,0,0.05))"></div>
            </div>
        </div>`;
}

// Карточка автогола (стиль БАТЭ, без фото игрока)
function wsBuildOwnGoalCard({ logoSrc, oppTeamName, minute }) {
    const logoHtml = logoSrc ? `<img class="ngc-photo-img" src="${logoSrc}" alt="" style="object-fit:contain;padding:16px;">` : '';
    return `
        <div class="ngc ngc-home">
            <div class="ngc-photo" style="display:flex;align-items:center;justify-content:center;">
                ${logoHtml}
                <div class="ngc-photo-footer"></div>
            </div>
            <div class="ngc-sep"></div>
            <div class="ngc-panel">
                <div class="ngc-left">
                    <div class="ngc-goal-row">
                        <span class="ngc-goal-word">Автогол</span>
                        <span class="ngc-minute">${minute || ''}</span>
                    </div>
                    ${oppTeamName ? `<div class="ngc-club">Автогол команды ${oppTeamName}</div>` : ''}
                </div>
                <div class="ngc-progress" style="background:linear-gradient(to right,#e3c600,rgba(227,198,0,0.05))"></div>
            </div>
        </div>`;
}

// Карточка гола соперника (белый логоблок + цвет команды)
function wsBuildOppGoalCard({ logoSrc, teamName, teamColor, minute }) {
    const logoHtml = logoSrc
        ? `<img src="${logoSrc}" alt="" class="ngc-opp-logo-img">`
        : `<span class="ngc-opp-logo-fallback">⚽</span>`;
    return `
        <div class="ngc ngc-opp">
            <div class="ngc-opp-logo">${logoHtml}</div>
            <div class="ngc-opp-panel" style="background:${teamColor};">
                <div style="position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,0) 30%,rgba(0,0,0,0.45) 100%);pointer-events:none;"></div>
                <div style="position:relative;z-index:1;">
                    <div class="ngc-goal-row">
                        <span class="ngc-opp-goal-word">Гол!</span>
                        <span class="ngc-opp-minute">${minute || ''}</span>
                    </div>
                    <div class="ngc-opp-name">${(teamName || 'Соперник').toUpperCase()}</div>
                </div>
                <div class="ngc-progress" style="background:linear-gradient(to right,rgba(255,255,255,0.5),rgba(255,255,255,0.03))"></div>
            </div>
        </div>`;
}

// ════════════════════════════════════════════════════════════════
//  GOAL NOTIFICATION DISPLAY
//  notifEl  — DOM-элемент контейнера уведомления
//  timeouts — объект {show: null, hide: null} для хранения таймеров
// ════════════════════════════════════════════════════════════════

function wsShowGoalNotif(notifEl, html, timeouts, durationMs, onHide) {
    durationMs = durationMs || 7000;
    if (timeouts.show) { clearTimeout(timeouts.show); timeouts.show = null; }
    if (timeouts.hide) { clearTimeout(timeouts.hide); timeouts.hide = null; }

    notifEl.innerHTML = html;
    notifEl.classList.remove('ws-notif-hiding');
    notifEl.classList.add('ws-notif-visible');
    notifEl.style.opacity = '1';
    notifEl.style.transform = 'translateX(-50%) translateY(0)';
    console.log('[wsShowGoalNotif] showing card, el:', notifEl.id, 'html length:', html.length);

    timeouts.show = setTimeout(function() {
        notifEl.classList.add('ws-notif-hiding');
        notifEl.classList.remove('ws-notif-visible');
        notifEl.style.opacity = '0';
        timeouts.hide = setTimeout(function() {
            notifEl.classList.remove('ws-notif-hiding');
            notifEl.innerHTML = '';
            notifEl.style.opacity = '';
            notifEl.style.transform = '';
            if (onHide) onHide();
        }, 600);
    }, durationMs);
}
