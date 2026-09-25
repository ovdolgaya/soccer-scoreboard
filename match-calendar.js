// ========================================
// MATCH CALENDAR VIEW
// ========================================
// Month-grid alternative to the card list on the dashboard.
// Uses the same data as the list (allMatchesCache + activeChampFilter from
// match-management.js), so it respects «Спрятать прошедшие матчи» and the
// championship filter and costs no extra Firebase reads.
//
// Rendering entry point: renderMatchCalendar() — called from displayMatches()
// whenever the calendar view is active, so live score/status updates
// flow into the calendar the same way they flow into the list.
//
// Day placement: matchDate (always saved by the edit modal), falling back to
// the local date of scheduledTime. Matches with neither → «Без даты».
//
// Clicking a day shows the existing match cards (renderMatchCard) above the
// grid; clicking a card opens the match exactly like in the list view.
// Clicking an empty day opens the «Создать матч» modal with that date
// prefilled; the day panel also has «Добавить матч» for busy days.

let _calViewActive  = false;
let _calMonth       = null;   // Date: first day of the displayed month
let _calSelectedKey = null;   // 'YYYY-MM-DD' | '__nodate' | null

const _CAL_VIEW_STORAGE_KEY = 'matchViewMode';
const _CAL_NODATE_KEY       = '__nodate';

const _CAL_MONTHS     = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const _CAL_MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const _CAL_WEEKDAYS   = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const _CAL_WD_LONG    = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

// ── View switching ─────────────────────────────────────────────────────

function isCalendarView() {
    return _calViewActive;
}

function setMatchView(view) {
    _calViewActive = (view === 'calendar');
    try { localStorage.setItem(_CAL_VIEW_STORAGE_KEY, view); } catch (e) {}
    _calApplyViewVisibility();
    displayMatches(); // renders list or calendar depending on the mode
}

function _calApplyViewVisibility() {
    const listBtn  = document.getElementById('viewListBtn');
    const calBtn   = document.getElementById('viewCalendarBtn');
    const list     = document.getElementById('matchList');
    const loadMore = document.getElementById('loadMoreBtn');
    const cal      = document.getElementById('calendarView');

    if (listBtn) listBtn.classList.toggle('active', !_calViewActive);
    if (calBtn)  calBtn.classList.toggle('active', _calViewActive);
    if (list)    list.style.display = _calViewActive ? 'none' : '';
    if (cal)     cal.style.display  = _calViewActive ? '' : 'none';
    // In list mode displayMatches() decides whether «Показать ещё» is needed
    if (loadMore && _calViewActive) loadMore.style.display = 'none';
}

// Restore the last chosen view on page load
document.addEventListener('DOMContentLoaded', function() {
    let saved = 'list';
    try { saved = localStorage.getItem(_CAL_VIEW_STORAGE_KEY) || 'list'; } catch (e) {}
    _calViewActive = (saved === 'calendar');
    _calApplyViewVisibility();
    if (_calViewActive) renderMatchCalendar(); // empty grid until matches load
});

// ── Month navigation ───────────────────────────────────────────────────

function calPrevMonth() {
    _calEnsureMonth();
    _calMonth = new Date(_calMonth.getFullYear(), _calMonth.getMonth() - 1, 1);
    renderMatchCalendar();
}

function calNextMonth() {
    _calEnsureMonth();
    _calMonth = new Date(_calMonth.getFullYear(), _calMonth.getMonth() + 1, 1);
    renderMatchCalendar();
}

function calGoToday() {
    const t = new Date();
    _calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
    renderMatchCalendar();
}

function _calEnsureMonth() {
    if (!_calMonth) {
        const t = new Date();
        _calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
    }
}

// ── Helpers ────────────────────────────────────────────────────────────

function _calKeyFromDate(d) {
    return d.getFullYear() + '-'
         + String(d.getMonth() + 1).padStart(2, '0') + '-'
         + String(d.getDate()).padStart(2, '0');
}

// Which calendar day a match belongs to (null → no date)
function _calDayKey(m) {
    if (m.matchDate) return m.matchDate;
    if (m.scheduledTime) return _calKeyFromDate(new Date(m.scheduledTime));
    return null;
}

function _calEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _calHHMM(ts) {
    const d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// Chip colour class — same status logic as the cards (getMatchStatus)
function _calChipClass(m) {
    const s = getMatchStatus(m);
    if (s === 'playing' || s === 'half1_ended' || s === 'half2_ended') return 'active';
    if (s === 'ended') return 'ended';
    if (s === 'scheduled') return 'scheduled';
    return 'waiting';
}

// 1 матч, 2 матча, 5 матчей
function _calMatchesWord(n) {
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return 'матч';
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'матча';
    return 'матчей';
}

function _calPanelTitle(key) {
    const p = key.split('-').map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return _CAL_WD_LONG[d.getDay()] + ', ' + p[2] + ' ' + _CAL_MONTHS_GEN[p[1] - 1];
}

// Same source as the list: allMatchesCache (already hidePast-filtered) + championship filter
function _calSourceMatches() {
    return activeChampFilter
        ? allMatchesCache.filter(function(m) { return (m.championshipTitle || '') === activeChampFilter; })
        : allMatchesCache;
}

function _calByTime(a, b) {
    return (a.scheduledTime || 0) - (b.scheduledTime || 0);
}

// ── Rendering ──────────────────────────────────────────────────────────

function renderMatchCalendar() {
    const grid = document.getElementById('calGrid');
    if (!grid) return;
    _calEnsureMonth();

    // Group matches by day
    const byDay  = {};
    const noDate = [];
    _calSourceMatches().forEach(function(m) {
        const k = _calDayKey(m);
        if (!k) { noDate.push(m); return; }
        (byDay[k] = byDay[k] || []).push(m);
    });
    Object.keys(byDay).forEach(function(k) { byDay[k].sort(_calByTime); });

    // Drop the selection if its day has no matches any more (deleted / filtered out)
    if (_calSelectedKey === _CAL_NODATE_KEY ? !noDate.length : (_calSelectedKey && !byDay[_calSelectedKey])) {
        calClosePanel(true);
    }

    // Header
    const year  = _calMonth.getFullYear();
    const month = _calMonth.getMonth();
    const title = document.getElementById('calMonthTitle');
    if (title) title.textContent = _CAL_MONTHS[month] + ' ' + year;

    // Grid: Monday-first, 5 or 6 rows
    const shift    = (new Date(year, month, 1).getDay() + 6) % 7;
    const todayKey = _calKeyFromDate(new Date());
    let html = _CAL_WEEKDAYS.map(function(w, i) {
        return '<div class="cal-wd' + (i > 4 ? ' weekend' : '') + '">' + w + '</div>';
    }).join('');

    for (let i = 0; i < 42; i++) {
        const d = new Date(year, month, 1 - shift + i);
        if (i >= 35 && d.getMonth() !== month) break; // skip an all-next-month 6th row
        const key  = _calKeyFromDate(d);
        const list = byDay[key] || [];

        const classes = ['cal-cell'];
        if (d.getMonth() !== month) classes.push('out');
        if (key === todayKey)       classes.push('today');
        classes.push(list.length ? 'has' : 'empty');
        if (key === _calSelectedKey) classes.push('selected');

        let chip = '';
        if (list.length === 1) {
            const m    = list[0];
            const cls  = _calChipClass(m);
            const time = (m.scheduledTime && cls !== 'ended')
                ? '<span class="cal-chip-time">' + _calHHMM(m.scheduledTime) + '</span> ' : '';
            const text = cls === 'ended'
                ? _calEsc(m.team1Name) + ' ' + (m.score1 || 0) + ':' + (m.score2 || 0) + ' ' + _calEsc(m.team2Name)
                : _calEsc(m.team1Name) + ' — ' + _calEsc(m.team2Name);
            chip = '<div class="cal-chip ' + cls + '">' + time + text + '</div>';
        } else if (list.length > 1) {
            chip = '<div class="cal-chip multi">Несколько матчей (' + list.length + ')</div>';
        }

        html += '<div class="' + classes.join(' ') + '"'
              + ' onclick="' + (list.length ? 'calOpenDay' : 'calCreateMatch') + '(\'' + key + '\')"'
              + (list.length ? '' : ' title="Создать матч на эту дату"') + '>'
              + '<div class="cal-num">' + d.getDate() + '</div>' + chip + '</div>';
    }
    grid.innerHTML = html;

    // «Без даты: N»
    const noDateBtn = document.getElementById('calNoDateBtn');
    if (noDateBtn) {
        noDateBtn.style.display = noDate.length ? '' : 'none';
        noDateBtn.textContent = 'Без даты: ' + noDate.length;
    }

    // Keep an open day panel in sync (live score/status updates)
    if (_calSelectedKey === _CAL_NODATE_KEY) {
        _calRenderPanel('Дата уточняется', noDate);
    } else if (_calSelectedKey) {
        _calRenderPanel(_calPanelTitle(_calSelectedKey), byDay[_calSelectedKey], _calSelectedKey);
    }
}

function _calRenderPanel(title, list, dayKey) {
    const panel = document.getElementById('calDayPanel');
    if (!panel) return;
    const count = list.length > 1 ? ' · ' + list.length + ' ' + _calMatchesWord(list.length) : '';
    panel.innerHTML =
        '<div class="cal-day-panel-head">'
      +   '<h3>' + title + count + '</h3>'
      +   (dayKey ? '<button class="cal-add-btn" onclick="calCreateMatch(\'' + dayKey + '\')">'
      +             '<i class="fas fa-plus"></i> Добавить матч</button>' : '')
      +   '<button class="cal-close" onclick="calClosePanel()" title="Закрыть">✕</button>'
      + '</div>'
      + list.map(renderMatchCard).join('');
    panel.style.display = '';
}

// ── Day panel actions ──────────────────────────────────────────────────

function calOpenDay(key) {
    _calSelectedKey = key;
    renderMatchCalendar(); // highlights the cell and fills the panel
    _calScrollToPanel();
}

// Empty day (or «Добавить матч» in the panel) → new match with this date
function calCreateMatch(key) {
    openMatchEditModal(null, key);
}

function calOpenNoDate() {
    _calSelectedKey = _CAL_NODATE_KEY;
    renderMatchCalendar();
    _calScrollToPanel();
}

// silent = called from renderMatchCalendar (no re-render loop)
function calClosePanel(silent) {
    _calSelectedKey = null;
    const panel = document.getElementById('calDayPanel');
    if (panel) { panel.style.display = 'none'; panel.innerHTML = ''; }
    if (!silent) renderMatchCalendar();
}

function _calScrollToPanel() {
    const panel = document.getElementById('calDayPanel');
    if (panel && panel.style.display !== 'none') {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
