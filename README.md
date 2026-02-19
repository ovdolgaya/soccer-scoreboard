# Soccer Scoreboard Application - Chat Handoff Document
## Last Updated: February 19, 2026

---

## 📋 PROJECT OVERVIEW

**Application**: Soccer Scoreboard — Real-time streaming widget with Firebase backend  
**Tech Stack**: Vanilla JavaScript, Firebase Realtime Database, HTML5 Canvas  
**Purpose**: Track kids' soccer matches, display live scoreboards for OBS/YouTube streaming, generate match and championship thumbnails

---

## 📁 FILE STRUCTURE

| File | Purpose |
|---|---|
| `index.html` | Main match control panel (login, match management) |
| `widget.html` | Live scoreboard widget for OBS overlay |
| `goals-widget.html` | Goal statistics overlay for OBS |
| `roster.html` | Team roster management |
| `championships.html` | Championships page — groups matches, stats modal, thumbnail generator |
| `match-helpers.js` | **Shared** date formatting, sort logic, status constants |
| `match-management.js` | Match list rendering and control logic |
| `match-control.js` | Match control logic, match thumbnail generator |
| `nav.js` | Shared navigation bar (injected into all pages) |
| `firebase-config.js` | Firebase credentials (not in repo) |
| `app-layout.css` | Shared layout styles |

---

## ✅ FEATURES BUILT

### Session 1 — Core Scoreboard
- Real-time scoreboard widget for OBS/YouTube streaming
- Match control panel with Firebase backend
- Team roster management with player photos, goalkeeper/field player badges
- Roster thumbnail generator (1280×720 PNG)
- Match details page

### Session 2 — Goal Tracking
- Goal tracking system with per-player recording and player picker modal
- Own goal support and goal removal
- Soft delete for players (preserves historical goal data)
- Goals statistics widget (`goals-widget.html`) — adaptive table/card layout for OBS overlay
- Match details with goals table for ended matches

### Session 3 — Championships & Navigation
- `championships.html` — groups matches by `championshipTitle` field
- Championship cards with expand/collapse match subtable
- Match stats modal (adaptive table/cards)
- Championship thumbnail generator (1280×720 PNG)
- Goal scorer notification card in `widget.html` (5-second disappearing card)
- `nav.js` — shared navigation bar with mobile support

### Session 4 — Championship Logo, Sorting & Shared Helpers
- Championship logo upload — clickable 🏆 icon opens file picker, saves base64 to Firebase
- Championship logo shown in card list and in thumbnail header (left of title)
- Match sorting unified: upcoming first (soonest at top), played desc by `matchDate`
- `match-helpers.js` — new shared file extracted from `match-management.js` and `championships.html`
- Date display: played matches use `matchDate`, upcoming use `scheduledTime`/`createdAt`
- Championship thumbnail: date color matches team name color (`#1e293b`), 10px bottom padding

---

## 🏆 CHAMPIONSHIP THUMBNAIL GENERATOR

### Layout Logic
- **≤ 9 matches** → Card grid (3 columns × up to 3 rows). Threshold is 9 to keep logo size consistent — a 10th match would require a 4th row which shrinks logos too much
- **≥ 10 matches** → Compact table layout (text only, no logos)

### Key Constants (`championships.html`)
```js
const THUMB_W   = 1280;
const THUMB_H   = 720;
const MAX_CARDS = 9;
const COLS      = 3;
```

### Header
- Dark overlay strip (100px tall)
- If championship has a logo: shown left of title, white square background + shadow, proportionally scaled (longest edge = 68px). Title centres in remaining space to the right
- If no logo: title centred across full width

### Match Cards (≤ 9 matches)
- Left half: Team 1 logo + name
- Right half: Team 2 logo + name
- Centre: Score (blue if ended, grey if not played)
- Bottom: Match date in `#1e293b` with 10px bottom padding

### Logo Drawing (`drawTeamLogoSquare`)
- Fixed white square background with rounded corners and drop shadow
- Logo scaled proportionally: longest edge fills 80% of square (landscape fits by width, portrait/square fits by height)
- Centred inside the square. Falls back to ⚽ placeholder if no logo

### Logo Loading
Logos are stored as **base64 data URIs** in Firebase. Loading strategy:
- `data:` URIs → plain `<img>` (no CORS needed, canvas-safe)
- `http(s):` URLs → `fetch({ mode: 'cors' })` → Blob URL (bypasses CORS image cache taint)
- Fallback: `<img crossOrigin="anonymous">` if fetch fails

---

## 🏅 CHAMPIONSHIP LOGO

### Upload
- Clicking the 🏆 icon (or existing logo image) opens a file picker
- Saved as base64 to `/championships/{sanitizedTitle}/logo` in Firebase
- Card re-renders immediately after upload

### Firebase key
`sanitizeChampKey(title)` → `title.trim().toLowerCase().replace(/[^a-z0-9]/gi, '_')`
Defined in `match-helpers.js`.

---

## 🔃 MATCH SORTING (`match-helpers.js`)

All match lists use `sortMatches(arr)`:

1. **Upcoming** (`scheduled`, `waiting`, `playing`, `half1_ended`) → top, ascending by `scheduledTime || createdAt` (soonest first)
2. **Played** (`ended`, `half2_ended`) → below upcoming, descending by `matchDate || createdAt` (newest first)

### Date Display (`formatMatchDate(m)`)
- **Played**: uses `matchDate` (YYYY-MM-DD → DD.MM.YYYY)
- **Upcoming**: uses `scheduledTime || createdAt` (timestamp → DD.MM.YYYY HH:MM)

---

## 📦 MATCH-HELPERS.JS — API Reference

Must be loaded **before** `match-management.js` and before the inline script in `championships.html`.

| Export | Description |
|---|---|
| `UPCOMING_STATUSES` | `['scheduled', 'waiting', 'playing', 'half1_ended']` |
| `PLAYED_STATUSES` | `['ended', 'half2_ended']` |
| `matchSortKey(m)` | Returns sortable key for a match |
| `sortMatches(arr)` | Sorts array in-place, returns it |
| `formatDate(str)` | YYYY-MM-DD → DD.MM.YYYY |
| `formatDateTime(ts)` | Timestamp → DD.MM.YYYY HH:MM |
| `formatMatchDate(m)` | Smart date display based on match status |
| `sanitizeChampKey(title)` | Championship title → safe Firebase key |

**Load order in `index.html`:**
```html
<script src="match-helpers.js"></script>
<script src="match-management.js"></script>
```

**Load order in `championships.html`:**
```html
<script src="match-helpers.js"></script>
<script src="nav.js"></script>
```

---

## ⚽ GOAL SCORER NOTIFICATION (`widget.html`)

When a new goal is recorded, shows a card below the scoreboard for 5 seconds:
- Home player: `[#number]  [First Last]  ⚽`
- Opponent goal: `Opponent  ⚽`
- Own goal: `Own Goal  ⚽`

Uses `database.ref('goals').on('child_added')` with an initial-load guard to only react to new goals after widget loads.

---

## 🔥 FIREBASE DATA STRUCTURE

```
/matches/{matchId}
  team1Name, team2Name
  team1Logo, team2Logo       ← base64 data URIs
  team1Color
  score1, score2
  status                     ← waiting | scheduled | playing | half1_ended | half2_ended | ended
  championshipTitle          ← used to group on championships.html
  matchDate                  ← YYYY-MM-DD (set when match is played)
  scheduledTime              ← timestamp (set when match is scheduled)
  createdAt, matchStartedAt

/goals/{goalId}
  matchId, playerId, playerNumber
  isOwnGoal, half, matchTime, timestamp

/players/{playerId}
  firstName, lastName, number
  photo                      ← base64 data URI
  isGoalkeeper
  isDeleted                  ← soft delete flag

/championships/{sanitizedTitle}
  logo                       ← base64 data URI
```

---

## 🔐 FIREBASE RULES REMINDER

```json
{
  "rules": {
    "matches":       { ".read": true },
    "goals":         { ".read": true },
    "players":       { ".read": "auth != null" },
    "championships": { ".read": "auth != null", ".write": "auth != null" }
  }
}
```

---

## 🧪 TESTING CHECKLIST

- [ ] Match list on index: upcoming at top (soonest first), played below (newest first)
- [ ] Championship match list: same sort order
- [ ] Clicking 🏆 icon opens file picker, logo saves and appears immediately
- [ ] Clicking existing logo replaces it
- [ ] Championship logo appears left of title in thumbnail header with white background
- [ ] Thumbnail: card grid for ≤ 9 matches, table for ≥ 10
- [ ] Team logos render proportionally (not distorted)
- [ ] Card date uses `matchDate` for played matches, `scheduledTime` for upcoming
- [ ] Goal scorer card appears in widget for 5 seconds on new goal
- [ ] Nav bar on all pages, active state correct, mobile menu works

---

## 🔮 FUTURE FEATURES TO CONSIDER

1. Opponent goal tracking — requires opponent roster or player number input
2. Substitutions — track player in/out with time
3. Yellow/red cards — same modal pattern as goals
4. Shot statistics — on target / off target counter
5. Championship management — CRUD screen for renaming championships or moving matches
6. Championship standings table — auto-calculated points/wins/draws/losses
7. Second statistics widget variant — both teams side-by-side
8. Goal time restore — times stored already; remove `display:none` from `.player-times` and uncomment `timesStr` in `buildCard()` to show them
9. Add `match-helpers.js` to `roster.html` if date/sort helpers are needed there

---

## 🚀 DEPLOY REMINDER

`match-helpers.js` is a **new file** added in Session 4. Make sure it is uploaded to the server alongside the updated `index.html`, `match-management.js`, and `championships.html`. Without it, both pages will break. ⚽
