// ============================================
// MATCH HELPERS — shared across all pages
// ============================================

const UPCOMING_STATUSES = ['scheduled', 'waiting', 'playing', 'half1_ended'];
const PLAYED_STATUSES   = ['ended', 'half2_ended'];

// Returns a sortable key for a match.
// Upcoming: uses scheduledTime / createdAt timestamp.
// Played:   uses matchDate string (YYYY-MM-DD sorts correctly) or createdAt fallback.
function matchSortKey(m) {
    if (UPCOMING_STATUSES.includes(m.status)) {
        return m.scheduledTime || m.createdAt || 0;
    }
    return m.matchDate || m.createdAt || 0;
}

// Sorts a match array in-place:
//   1. Active (playing/half*_ended) — first
//   2. Scheduled upcoming — soonest first
//   3. Waiting without a date — after scheduled
//   4. Played — newest first
function sortMatches(arr) {
    arr.sort(function(a, b) {
        const aUp = UPCOMING_STATUSES.includes(a.status);
        const bUp = UPCOMING_STATUSES.includes(b.status);

        // Played vs upcoming
        if (aUp && !bUp) return -1;
        if (!aUp && bUp) return 1;

        if (aUp && bUp) {
            // Within upcoming: 'waiting' without a date always goes last
            const aNoDate = (a.status === 'waiting' && !a.scheduledTime && !a.matchDate);
            const bNoDate = (b.status === 'waiting' && !b.scheduledTime && !b.matchDate);
            if (aNoDate && !bNoDate) return 1;
            if (!aNoDate && bNoDate) return -1;
            // Both undated waiting — keep stable
            if (aNoDate && bNoDate) return 0;
            // Both have a date — soonest first (ascending)
            const aKey = matchSortKey(a);
            const bKey = matchSortKey(b);
            return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
        }

        // Both played: newest first (descending)
        const aKey = matchSortKey(a);
        const bKey = matchSortKey(b);
        return aKey > bKey ? -1 : aKey < bKey ? 1 : 0;
    });
    return arr;
}

// YYYY-MM-DD → DD.MM.YYYY
function formatDate(dateString) {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    return parts[2] + '.' + parts[1] + '.' + parts[0];
}

// Timestamp → DD.MM.YYYY HH:MM
function formatDateTime(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return String(d.getDate()).padStart(2,'0') + '.'
         + String(d.getMonth()+1).padStart(2,'0') + '.'
         + d.getFullYear() + ' '
         + String(d.getHours()).padStart(2,'0') + ':'
         + String(d.getMinutes()).padStart(2,'0');
}

// Smart date display for a match card/thumbnail:
//   Played  → matchDate (DD.MM.YYYY)
//   Upcoming with scheduledTime → DD.MM.YYYY HH:MM
//   No date info → 'Дата уточняется'
function formatMatchDate(m) {
    if (!UPCOMING_STATUSES.includes(m.status) && m.matchDate) {
        return formatDate(m.matchDate);
    }
    if (m.scheduledTime) {
        return formatDateTime(m.scheduledTime);
    }
    if (m.matchDate) {
        return formatDate(m.matchDate);
    }
    return 'Дата уточняется';
}

// Convert a championship title to a safe Firebase key
function sanitizeChampKey(title) {
    return title.trim().toLowerCase().replace(/[^a-z0-9]/gi, '_');
}
