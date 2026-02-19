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
//   1. Upcoming first (soonest scheduled date at top)
//   2. Played after (newest matchDate at top)
function sortMatches(arr) {
    arr.sort(function(a, b) {
        const aUp = UPCOMING_STATUSES.includes(a.status);
        const bUp = UPCOMING_STATUSES.includes(b.status);

        if (aUp && !bUp) return -1;
        if (!aUp && bUp) return 1;

        const aKey = matchSortKey(a);
        const bKey = matchSortKey(b);

        if (aUp && bUp) {
            // Both upcoming: soonest first (ascending)
            return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
        }
        // Both played: newest first (descending)
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
//   Upcoming → scheduledTime or createdAt (DD.MM.YYYY HH:MM)
function formatMatchDate(m) {
    if (!UPCOMING_STATUSES.includes(m.status) && m.matchDate) {
        return formatDate(m.matchDate);
    }
    const ts = m.scheduledTime || m.createdAt;
    if (!ts) return '—';
    return formatDateTime(ts);
}

// Convert a championship title to a safe Firebase key
function sanitizeChampKey(title) {
    return title.trim().toLowerCase().replace(/[^a-z0-9]/gi, '_');
}
