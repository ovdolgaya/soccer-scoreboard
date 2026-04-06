# Soccer Scoreboard Application
## Last Updated: April 6, 2026 (Session 8)

---

## 📋 PROJECT OVERVIEW

**Application**: Soccer Scoreboard — Real-time streaming widget with Firebase backend  
**Tech Stack**: Vanilla JavaScript, Firebase Realtime Database, HTML5 Canvas  
**Purpose**: Track kids' soccer matches, display live scoreboards for OBS/YouTube streaming, generate match and roster thumbnails  
**Hosting**: GitHub Pages at `https://ovdolgaya.github.io/soccer-scoreboard/`

---

## 📁 FILE STRUCTURE

| File | Purpose |
|---|---|
| `index.html` | Match dashboard and cockpit |
| `widget.html` | Live scoreboard widget for OBS overlay |
| `goals-widget.html` | Goal statistics overlay for OBS |
| `roster.html` | Team roster management (tabs: Состав / Команды) |
| `championships.html` | Championships (tabs: Чемпионаты / Управление) |
| `match-helpers.js` | **Shared** date formatting, sort logic, status constants |
| `match-management.js` | Match list rendering, dashboard, pagination, goals stats |
| `match-control.js` | Score/time control, match thumbnail generator, roster download, clip markers |
| `match-edit-modal.js` | Unified create/edit match modal |
| `auth.js` | Firebase auth, login/logout, view switching |
| `nav.js` | Shared navigation bar (injected into all pages) |
| `goal-tracking.js` | Goal recording, player picker modal, assist picker modal |
| `roster-thumbnail-helper.js` | Roster thumbnail generator (2560×1440) with session cache |
| `roster.js` | Roster management logic |
| `firebase-config.js` | Firebase credentials (**not in repo**) |
| `firebase-config-widget.js` | Firebase credentials for public widgets |
| `styles.css` | Main styles |
| `app-layout.css` | Shared layout styles |
| `roster-styles.css` | Roster page styles |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker (network-first caching) |
| `icon-192.png` | PWA home screen icon (192×192) |
| `icon-512.png` | PWA splash screen icon (512×512) |

---

## ✅ FEATURES

### Match Management
- Match list with upcoming/played sorting (upcoming soonest first, played newest first)
- Match cockpit showing team names, date, status with quick-edit icon
- Create / edit matches via unified modal — select teams and championships from saved lists
- Time management: start/stop halves, halftime countdown popup, end match
- Score controls with goal scorer modal (player grid + own goal)
- Goal removal modal
- **Retroactive goal entry** — ended matches show "Добавить гол" in goals stats section; saves with `retroactive: true`, no time/half; appears under "Добавлено вручную" separator
- Resources panel: scoreboard link, match thumbnail, roster thumbnail, stats widget link
- **📍 Clip markers** — yellow button in time controls, visible only while playing; saves `{ matchId, timestamp, matchTime, half }` to Firebase `/clips`; table of saved moments shown in cockpit with delete option

### Firebase Bandwidth Optimisation
All pages use page-level session caches to avoid re-downloading data. Key principle: **never store base64 photos/logos in display-only caches, and never store logos in match records**.

- **`match-management.js`** — `.once()` replaces collection real-time listener; per-field listeners (~50 bytes each) for live score updates; `_matchDataCache` serves match cockpit with zero reads
- **`match-edit-modal.js`** — no longer writes `team1Logo`/`team2Logo`/`team1Color`/`team2Color` to match records; writes `team1Id`/`team2Id` instead
- **`match-control.js`** — thumbnail fetches logos from `/teams/{id}`, not from match record
- **`widget.html`** / **`goals-widget.html`** — logos/colors fetched from `/teams` with three-level fallback: teamId → name match → embedded field
- **`championships.html`** — teams fetched once alongside matches; `_champTeamsCache` used for all logo resolution; `resolveTeamLogo()` helper with name fallback
- **`goal-tracking.js`** — `_matchCache` eliminates match fetches during a match; players cache strips photos; team side resolved once
- **`roster.js`** — `_teamsCache`, `_playersPageCache`, `_coachCache` cover all roster page reads
- **Migration script** — `migration_add_teamIds.js` — run once in browser console to add teamIds and delete embedded logos from all existing match records

**Expected reads per session after full optimisation + migration:**
- `index.html` load: 1 `.once()` read of all matches (text fields only, no logos) + field listeners
- Open match cockpit: 0 reads (served from `_matchDataCache`)
- Score a goal: 0 reads
- `championships.html` load: matches + championships + teams in one parallel call, cached
- Championship stats (first open): goals query only
- Championship stats (repeat open): 0 reads
- **Live goal modal** — assist section appears above the scorer grid; muted slate number buttons; multi-select (modal stays open); selected assistants highlighted teal with ✓ checkmark; greyed/disabled in scorer grid below
- Clicking a scorer saves goal + any pre-selected assists and closes modal; own goal skips assist step
- **Assist picker modal** — 👟 button on every goal stats row opens a picker; pre-populates existing assists; multi-select; Save writes back to Firebase; × chip on each assist removes it individually
- **Firebase schema** — `assists: [{playerId, playerNumber}]` array added to goal records; fully optional/additive — old goals without it work unchanged

### Championships
- Championships page with expand/collapse match groups
- **Championship Stats Modal** — analytics button on each card shows:
  - Match results: Won / Draw / Lost with colour ratio bar and win %
  - Goals: scored (default team) vs conceded (opponents)
  - **Top scorers / Top assisters toggle** — ⚽ Голы / 👟 Пасы buttons switch the ranked table; each mode shows only players with stat > 0, sorted descending, with proportional bar and 🥇🥈🥉 medals; own goals row in goals mode only
  - ⚠️ Warning banner if tracked goal count doesn't match actual score
- Championship thumbnail generator (2560×1440 PNG)
- **`isPassed` toggle** — passed championships hidden from match form dropdown; shown greyed in Управление tab with full analytics still accessible

### Team & Championship Management
- **Teams** managed on Roster page → Команды tab: create, edit, delete with logo/color
- **`isActive` toggle on teams** — inactive teams hidden from match dropdowns, shown greyed in Команды tab
- **Championships** managed on Championships page → Управление tab: create, edit, delete with logo
- Match create/edit form uses dropdowns — no inline creation needed

### Roster Management
- Player CRUD: number, name, position (goalkeeper / field), photo upload, absent toggle
- Coach management: name, photo
- Badge icons: goalkeeper, field player, coach (PNG with transparency)
- Soft delete — players marked `isDeleted:true`, historical goal data preserved
- Roster thumbnail download (2560×1440 PNG, broadcast-ready)

### Thumbnails
- **Match thumbnail** — 2560×1440, team logos, VS, date, championship title
- **Roster thumbnail** — 2560×1440, vertical player cards with photos, coach card, GK section
- **Championship thumbnail** — 2560×1440, card grid (≤15 matches) or table layout (>15)

### Streaming Widgets
- **`widget.html`** — live scoreboard overlay for OBS; real-time score + timer + goal scorer notification card (5s):
  - Card **replaces the timer bar** for 5s (crossfade), then timer fades back in
  - Positioned via `getBoundingClientRect()` — pixel-perfect regardless of scoreboard state
  - Without assists: 56px card — `#N | Гол! / LASTNAME | ⚽`
  - With assists: 76px card — scorer row + `👟 #7 ИВАНОВ · #11 ПЕТРОВ` assist line below
  - Card style: bottom-radius only, matching timer bar shape
- **`goals-widget.html`** — goal statistics overlay; table (≤10 goals) or card grid (>10):
  - Table: ⚽ icon hidden; assist chips show white number badge + white uppercase last name on translucent pill
  - Cards: `👟 N` assist badge shown only if player has ≥1 assist; players with 0 goals not shown

### PWA
- Installable on Android via Chrome "Add to Home Screen"
- Network-first service worker — always fetches live data, falls back to cache if offline

---

## 🎨 DESIGN SYSTEM (BATE Borisov palette)

| Token | Value | Usage |
|---|---|---|
| Background | Radial gradient `#1947BA` → `#0033A0` | Page/canvas background |
| Card background | `#0d1b3e` | Player/coach cards |
| Primary accent | `#1947BA` | Player card top line |
| Coach accent | `#FCDC00` yellow | Coach card top line, number badges, clip marker button |
| Footer gradient | transparent → `#0033A0` | Card footer overlay |
| On-surface | `#d4e3ff` | Last name text |
| On-surface muted | `rgba(166,200,255,0.65)` | First name text |
| Font | Lexend → Calibri fallback | All canvas text |

---

## 🏆 ROSTER THUMBNAIL

### Layout
- **Header**: team logo + "СОСТАВ КОМАНДЫ" title
- **Row 1**: Coach card (25% width, yellow accent) + ВРАТАРИ label + GK cards
- **Field players**: dynamic 1–2 row grid, max 2 rows

### Card design (vertical, 3:4 portrait ratio)
- Dark navy background (`#0d1b3e`)
- Photo pinned to card bottom, contain-fit, 6% top inset
- Radial blue glow behind photo (works with transparent PNG cutouts)
- Yellow number badge top-left (no `#` prefix)
- Footer gradient to `#0033A0` with firstName + LASTNAME
- Badge icon right-aligned in footer

### Layout calculator
```js
function calcFieldLayout(count) {
    if (count <= 0) return { cols: 0, rows: 0 };
    if (count <= 8) return { cols: count, rows: 1 };
    return            { cols: Math.ceil(count / 2), rows: 2 };
}
```

### Session cache
Every thumbnail generation caches team/player/coach data for the browser session — zero repeated Firebase downloads. Cache auto-invalidates on any roster save via `rosterCacheClear(teamId)`.

---

## 🏅 CHAMPIONSHIP THUMBNAIL

| Matches | Layout |
|---|---|
| ≤ 15 | Card grid, 3 columns |
| > 15 | Compact table |

- Championship logo shown left of title in header if available
- Team logos in match cards: white rounded square, proportional scaling, ⚽ placeholder
- Scores in blue if ended, grey if not yet played

---

## ⏱️ WIDGET TIMER

```js
// Always restart — prevents stale closure after goal updates
if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
if (matchData.status === 'playing') {
    timerInterval = setInterval(function() { updateTimer(matchData); }, 100);
}
// Clamp to zero — prevents negative display if client clock lags Firebase
elapsed = Math.max(0, Date.now() - matchData.startTime);
```

---

## 🔃 MATCH SORTING (`match-helpers.js`)

1. **Upcoming** (`scheduled`, `waiting`, `playing`, `half1_ended`) — top, ascending by `scheduledTime || createdAt`
2. **Played** (`ended`, `half2_ended`) — below, descending by `matchDate || createdAt`

---

## 📦 MATCH-HELPERS.JS API

Must load **before** `match-management.js` and before the inline script in `championships.html`.

| Export | Description |
|---|---|
| `UPCOMING_STATUSES` | `['scheduled', 'waiting', 'playing', 'half1_ended']` |
| `PLAYED_STATUSES` | `['ended', 'half2_ended']` |
| `sortMatches(arr)` | Sorts array in-place, returns it |
| `formatDate(str)` | YYYY-MM-DD → DD.MM.YYYY |
| `formatDateTime(ts)` | Timestamp → DD.MM.YYYY HH:MM |
| `formatMatchDate(m)` | Smart date display — `scheduledTime` → datetime, `matchDate` → date, neither → `'Дата уточняется'` |
| `sanitizeChampKey(title)` | Championship title → safe Firebase key |

---

## 🔥 FIREBASE DATA STRUCTURE

```
/matches/{matchId}
  team1Id, team2Id  ← links to /teams (written by migration script)
  team1Name, team2Name  ← kept as safety denormalization
  score1, score2
  status          ← waiting|scheduled|playing|half1_ended|half2_ended|ended
  championshipTitle
  matchDate       ← YYYY-MM-DD
  scheduledTime   ← timestamp ms
  createdAt, matchStartedAt, startTime
  NOTE: team1Logo, team2Logo, team1Color, team2Color removed by migration

/goals/{goalId}
  matchId, teamId
  playerId, playerNumber
  isOwnGoal, half, matchTime, timestamp, createdAt
  retroactive     ← true only on retroactive goals
  assists         ← OPTIONAL array [{playerId, playerNumber}]

/players/{playerId}
  firstName, lastName, number, teamId
  photo           ← base64 JPEG, 400×400
  isGoalkeeper, isAbsent
  isDeleted       ← soft delete flag
  createdAt

/teams/{teamId}
  name, color
  logo            ← base64
  goalkeeperBadge, fieldPlayerBadge  ← base64 PNG transparent
  isActive        ← bool, default true; false = hidden from match form
  createdBy, createdAt, updatedAt

/coaches/{teamId}
  firstName, lastName, middleName
  photo           ← base64 JPEG, 400×400
  teamId, updatedAt

/championships/{champ_XXXX}
  title, logo     ← base64
  isPassed        ← bool, default false; true = hidden from match form
  createdAt, updatedAt

/clips/{clipId}
  matchId
  timestamp       ← ms epoch
  matchTime       ← HH:MM:SS elapsed time within the half
  half            ← 1 or 2
```

---

## 🔐 FIREBASE RULES

See `FIREBASE_SETUP.md` for full rules with validation. Summary:

```
matches, goals, players  — public read, auth write
teams, coaches, championships, settings — auth read/write
clips                    — auth read/write (private, not needed by widgets)
```

Indexes: `goals` on `[matchId, teamId, timestamp]`; `clips` on `[matchId, timestamp]`; `players` on `teamId`

---

## 📱 PWA INSTALLATION (Android)

1. Open Chrome → `https://ovdolgaya.github.io/soccer-scoreboard/`
2. Tap three-dot menu → **Add to Home screen**
3. App installs with soccer ball icon, opens fullscreen

**Service worker**: Network-first. Always fetches live Firebase data. Falls back to cached static shell if offline. Firebase and CDN requests bypass service worker entirely.

---

## ⚽ GOAL SCORER NOTIFICATION (`widget.html`)

Overlays the timer bar for 5 seconds on new goal, then crossfades back to timer:
- Home player (no assists): 56px card — `#number | Гол! / LASTNAME | ⚽`
- Home player (with assists): 76px card — scorer row + `👟 #7 ИВАНОВ · #11 ПЕТРОВ`
- Opponent goal: team color card with team name
- Own goal: grey card labelled "Автогол"
- Card style matches timer bar: bottom-radius only, same 400px width, same shadow

**Key implementation:** `#goalNotification` lives outside `#scoreboard` (re-renders can't destroy it). Position set via `getBoundingClientRect()` on `#timerBar` at goal time. `notifVisible` flag re-applies `.collapsing` to new `#timerBar` after every scoreboard re-render while card is showing.

Uses `database.ref('goals').on('child_added')` with initial-load guard. Scorer and all assist players fetched in parallel from `playersCache` before rendering.

---

## 🧪 TESTING CHECKLIST

- [ ] No login form flash for already-authenticated users
- [ ] Match list: upcoming at top (soonest first), played below (newest first)
- [ ] Create match modal: team/championship dropdowns populate correctly (active/non-passed only)
- [ ] Edit match modal: pre-fills existing values, saves correctly
- [ ] Edit match modal: adding a future date to a waiting match → status changes to scheduled
- [ ] Edit match modal: editing a playing/ended match does not reset its status
- [ ] Cockpit header shows correct team names, date, status
- [ ] Cockpit edit icon opens modal pre-filled
- [ ] Roster tab: players, coach, badges work as before
- [ ] Команды tab: create/edit/delete teams, logo + color saved
- [ ] Команды tab: 2 columns on desktop/tablet, 1 column on mobile
- [ ] Команды tab: isActive toggle — inactive teams show ❌, grey card, dimmed logo
- [ ] Inactive teams absent from match form dropdowns
- [ ] Управление tab: create/edit/delete championships
- [ ] Управление tab: isPassed toggle — passed championships show ❌, grey card
- [ ] Passed championships absent from match form championship dropdown
- [ ] **Goal modal: assist section appears above scorer grid**
- [ ] **Assist buttons toggle highlight on tap; modal stays open**
- [ ] **Selected assistants greyed/disabled in scorer grid**
- [ ] **Clicking scorer saves goal with assists; modal closes**
- [ ] **Own goal button saves immediately with no assists**
- [ ] **Assist state resets on modal close/re-open**
- [ ] **Goal stats row: 👟 button opens assist picker modal**
- [ ] **Assist picker pre-populates existing assists**
- [ ] **Saving assist picker updates Firebase and refreshes stats**
- [ ] **× chip removes individual assist; refreshes stats**
- [ ] **widget.html: goal card shows assist line when assists present**
- [ ] **widget.html: card height expands correctly with assist line**
- [ ] **goals-widget.html table: assist chips show correct number + last name**
- [ ] **goals-widget.html cards: assist badge shown only when assists > 0**
- [ ] Championship stats modal: W/D/L counts correct for default team
- [ ] Championship stats modal: goals for/against calculated correctly
- [ ] **Championship stats modal: ⚽ Голы / 👟 Пасы toggle works**
- [ ] **Championship stats modal: assists mode shows correct ranked list**
- [ ] **Championship stats modal: players with 0 in current mode are hidden**
- [ ] Championship stats modal: warning banner shown when tracked goals < actual score
- [ ] Championship stats modal: graceful empty state when no goal data exists
- [ ] Ended match cockpit: "Добавить гол" button visible in goals stats section
- [ ] Retroactive goal saves with no time/half, appears under "Добавлено вручную", score increments
- [ ] Roster thumbnail: correct layout, photos bottom-aligned, gradient to `#0033A0`
- [ ] Session cache: second thumbnail generation makes zero Firebase reads
- [ ] Championship thumbnail: card grid ≤15, table >15
- [ ] Goals widget: player photos contained, no cropping, white background
- [ ] Widget timer: no negative display, no freeze after goal
- [ ] **widget.html: goal card overlays timer bar (not below scoreboard)**
- [ ] **widget.html: timer reappears correctly after 5s**
- [ ] **widget.html: rapid goals don't leave timer permanently hidden**
- [ ] **Clip marker: 📍 button appears instantly on match start**
- [ ] **Clip marker: button hidden instantly on stop half / end match**
- [ ] **Clip marker: tapping button flashes confirmation with time**
- [ ] **Clip marker: clips table appears in cockpit after first save**
- [ ] **Clip marker: delete clip removes from Firebase and table**
- [ ] **Championship thumbnail: undated matches sort to end of list**
- [ ] Nav bar on all pages, active state correct, mobile menu works
- [ ] PWA installs correctly on Android
- [ ] **Firebase cache: index.html load — match list downloads once, no logos in match records**
- [ ] **Firebase cache: second match open shows only 0 reads (served from _matchDataCache)**
- [ ] **Firebase cache: goal scored shows 0 reads**
- [ ] **Firebase cache: navigation index → championships → index burns <1MB total**
- [ ] **Firebase cache: roster page second player load shows 0 reads**
- [ ] **Firebase cache: Команды tab second open shows 0 reads**
- [ ] **Firebase cache: championship stats second open shows only goals query**
- [ ] **Firebase cache: player status toggle invalidates cache correctly (next load re-fetches)**
- [ ] **widget.html: team logos show correctly (fetched from /teams)**
- [ ] **goals-widget.html: team logo shows correctly in header**
- [ ] **championships.html: match row logos show correctly**
- [ ] **Match thumbnail: logos fetched from /teams, not from match record**
- [ ] **Migration: run migration_add_teamIds.js in console, verify all matches get team1Id/team2Id**
- [ ] **Migration: after migration, match records have no team1Logo/team2Logo fields**
- [ ] After deployment: clear PWA cache or bump `CACHE_NAME` in `sw.js` to force update

---

## 🔮 FUTURE FEATURES TO CONSIDER

**Pending (deploy ready, needs to be run):**
- Run `migration_add_teamIds.js` in browser console to permanently remove embedded logos from all existing match records

**Planned features:**
1. Assist tracking in retroactive goal modal (currently goals-only; assists can be added via picker after the fact)
2. Clip markers review page — dedicated page listing all clips per match with video timestamps for coach review (data already saved to `/clips`)
3. Assist info in goals-widget.html card layout (currently only badge count; could show names)
4. Opponent goal tracking — opponent roster or number input
5. Substitutions — player in/out with time
6. Yellow/red cards — same modal pattern as goals
7. Championship standings table — auto-calculated points/wins/draws/losses
8. Second stats widget variant — both teams side-by-side
9. Goal times in stats widget — stored already; remove `display:none` from `.player-times` in `goals-widget.html`
10. Match notes / venue field
11. Export match report (PDF)

---

*Hosted on GitHub Pages. All files deploy from the repo root.*  ⚽
