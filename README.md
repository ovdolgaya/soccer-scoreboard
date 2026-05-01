# Soccer Scoreboard Application
## Last Updated: May 1, 2026 (Session 15)

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
| `broadcast-widget.html` | Full-screen automated broadcast director (HD 1920×1080 and 2K 2560×1440) |
| `broadcast-widget.css` | Broadcast-specific styles (layers, positions, stats overlay) |
| `broadcast-widget-2k.css` | 2K resolution overrides (loaded dynamically when `?res=2k`) |
| `broadcast-widget-sequences.js` | State machine: layer helpers, half start/end sequences, status handler |
| `broadcast-widget-scoreboard.js` | Broadcast aliases for shared functions + stats overlay rendering |
| `broadcast-widget-canvas.js` | Canvas/thumbnail rendering helpers |
| `widget-shared.css` | **Shared** — scoreboard and goal card styles (`.ngc-*`, `.score-container`, `.timer-container`) |
| `widget-shared-2k.css` | **Shared** — 2K overrides for scoreboard and goal cards (via `.ws-2k` class) |
| `widget-shared.js` | **Shared** — color helpers, team/player cache, scoreboard rendering, goal card builders |
| `widget-goal-listener.js` | **Shared** — Firebase goal listening logic (`/goals` + `score2` change detection) |
| `vertical-widget.html` | Vertical 1440×2560 widget for YouTube Shorts/Reels |
| `roster.html` | Team roster management (tabs: Состав / Команды) |
| `championships.html` | Championships (tabs: Чемпионаты / Управление) |
| `match-helpers.js` | Shared date formatting, sort logic, status constants |
| `match-management.js` | Match list, dashboard, goals stats, widget URL helpers, clip visibility |
| `match-control.js` | Score/time control, thumbnails, clip marker functions |
| `match-edit-modal.js` | Unified create/edit match modal |
| `auth.js` | Firebase auth, login/logout, view switching |
| `nav.js` | Shared navigation bar + environment switcher |
| `goal-tracking.js` | Goal recording, player picker, assist picker |
| `roster-thumbnail-helper.js` | Roster thumbnail generator (2560×1440) with session cache |
| `roster.js` | Roster management logic |
| `firebase-config-loader.js` | Dynamic Firebase config selector (reads `localStorage.fcEnv`) |
| `firebase-config.js` | Firebase credentials — PROD with auth (**not in repo**) |
| `firebase-config-test.js` | Firebase credentials — TEST with auth (**not in repo**) |
| `firebase-config-widget.js` | Firebase credentials — PROD, widgets (no auth) |
| `firebase-config-widget-test.js` | Firebase credentials — TEST, widgets (no auth) (**not in repo**) |
| `styles.css` | Main styles |
| `app-layout.css` | Shared layout styles |
| `roster-styles.css` | Roster page styles |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker (network-first caching) |

---

## ✅ FEATURES

### Match Management
- Match list: active → scheduled (soonest first) → waiting (date unknown, always last) → played (newest first)
- Match cockpit: team names, date, status, quick-edit icon
- Create/edit via unified modal — team & championship dropdowns; date-only entry supported (time optional)
- Time management: start/stop halves, halftime popup, end match
- Score controls with goal scorer modal (player grid + own goal + assists)
- Goal removal modal with per-goal selection
- Retroactive goal entry for ended matches
- Resources panel: **Табло**, **Заставка**, **Команда**, **Статистика**, **Трансляция HD**, **Трансляция 2К**, **Табло 2К**

### Opponent Goal Tracking
- `+` button for team2 saves opponent goal to `/goals` with `isOpponent: true`, `half`, `matchTime`
- `−` button shows list of saved opponent goals for selection and deletion
- Goals displayed in chronological stats table with team-color badge + team name (no assists)
- Same table shown in championships match stats modal

### Environment Switcher (PROD / TEST)
- Toggle in nav dropdown (profile button) — visible only when logged in
- Switches between PROD and TEST Firebase databases without code changes
- Yellow `TEST` badge in nav bar when test mode is active
- Useful for testing on mobile (GitHub Pages) without burning PROD bandwidth
- On switch: page reloads, Firebase re-initializes with new config

### Clip Markers
- "📍 Отметить момент" button appears only while a half is playing
- Saves `{ matchId, timestamp, matchTime, half }` to `/clips` Firebase node
- Clip log shown during match (with delete) and after match ends (read-only)

### Firebase Bandwidth Optimisation
- `.once()` replaces collection real-time listener; per-field listeners for live updates
- `_matchDataCache` serves cockpit with zero reads after initial load
- `_matchCache` used for all score reads — no `database.once()` on button press
- Team logos fetched from `/teams/{id}`, never stored in match records
- Session caches: `_teamsCache`, `_playersPageCache`, `_coachCache`, `_champTeamsCache`

### Goal Tracking & Assists
- Live goal modal: assist section above scorer grid, multi-select, modal stays open
- Assist picker modal on every goal stats row
- `assists: [{playerId, playerNumber}]` array on goal records

### Championships
- Championship Stats Modal: W/D/L, goals for/against, ⚽/👟 toggle, medals (dense rank — tied players share rank and medal)
- Championship thumbnail (2560×1440)
- `isPassed` toggle hides from match form
- Match stats always use table view (no card-grid switch)

### Roster Management
- Player CRUD with photo upload, absent toggle, soft delete
- Coach management with photo
- Badge icons (goalkeeper/field/coach PNG)
- Roster thumbnail (2560×1440) — dark header band

### Thumbnails
- **Match thumbnail** — 1920×1080 canvas, team logos, VS or score, date, championship
- **Roster thumbnail** — 2560×1440, player cards, coach, GK section
- **Championship thumbnail** — 2560×1440, card grid ≤15 / table >15; matches sorted: played (date asc) → scheduled (date asc) → undated/waiting (last)

---

## 📺 STREAMING WIDGETS

### `widget.html` — Live Scoreboard
Real-time score + timer for OBS. Goal notification card (5s).

### `goals-widget.html` — Goal Statistics
Table (≤10 goals) or card grid (>10). Assist chips in table.

### `broadcast-widget.html` — Automated Broadcast Director
Full-screen widget for Larix/OBS. Supports **HD (1920×1080)** and **2K (2560×1440)** via `?res=2k`. Automates the entire presentation:

1. **Load** — match thumbnail (15s) → roster thumbnail (15s) → transparent
2. **Half starts** — canvas/stats cleared **instantly** → score bottom-center (5s) → top-left → YouTube subscribe reminder (8s)
3. **Playing** — score widget top-left with live timer
4. **Goal** — goal card bottom-center (5s) → score bottom-center (3s) → top-left
5. **Half ends** — score bottom-center (3s) → YouTube subscribe reminder (4s) → stats full-screen (10s) → match thumbnail with score

**State machine design:** `playing` always wins — `bwHalfStart()` runs synchronously and instantly clears whatever is on screen. `bwHalfEndSequence()` has guard checks after every `await`.

#### Goal Notification Cards
**Home team goal** — player photo (dark bg, radial glow, yellow number badge) | yellow separator | blue gradient panel (Гол! + minute + name + club) | optional Ассистенты block

**Opponent goal** — white logo block | team-color separator | white panel (Гол! + minute + team name)

**Own goal** — team1 logo | blue panel | Автогол команды {team2Name}

#### Shared Widget Modules
`widget-shared.js`, `widget-shared.css`, `widget-shared-2k.css`, `widget-goal-listener.js` — used by both `broadcast-widget.html` and `vertical-widget.html`.

### `vertical-widget.html` — Vertical 2K Widget
1440×2560px for YouTube Shorts. Scoreboard at top, goal cards at bottom. Uses shared modules only.

---

## 🔐 FIREBASE RULES

```json
{
  "rules": {
    "matches":       { ".read": true, ".write": "auth != null" },
    "goals":         { ".read": true, ".write": "auth != null" },
    "players":       { ".read": true, ".write": "auth != null" },
    "teams":         { "$teamId": { ".read": true }, ".read": "auth != null", ".write": "auth != null" },
    "coaches":       { ".read": true, ".write": "auth != null" },
    "championships": { ".read": true, ".write": "auth != null" },
    "clips":         { ".read": "auth != null", ".write": "auth != null" }
  }
}
```

---

## 📱 PWA INSTALLATION (Android)

1. Open Chrome → `https://ovdolgaya.github.io/soccer-scoreboard/`
2. Tap three-dot menu → **Add to Home screen**

**After each deployment:** bump `CACHE_NAME` in `sw.js` to force cache refresh.

---

## 🧪 TESTING CHECKLIST

- [ ] Match list sorts correctly
- [ ] Create/edit modal: dropdowns populate, saves correctly
- [ ] Resources panel: all buttons copy correct URLs
- [ ] Goal modal: assist multi-select, modal stays open, scorer saves with assists
- [ ] Opponent `+` button: saves goal to Firebase, score increments
- [ ] Opponent `−` button: shows goal list, selected goal deleted + score decrements
- [ ] Opponent goals shown in stats with color badge + team name, no assist controls
- [ ] Environment switcher: toggle in nav dropdown switches PROD/TEST, TEST badge visible
- [ ] Clip button appears only while half is playing
- [ ] widget.html: opponent goal card shows team 2 logo + correct color
- [ ] widget.html: own goal card shows team 1 logo + "Автогол команды {name}"
- [ ] broadcast-widget.html: goal card shows player photo + yellow number badge
- [ ] broadcast-widget.html: match details screen hides instantly when half 2 starts
- [ ] broadcast-widget.html: YouTube subscribe reminder shown at half start (8s) and half end (4s)
- [ ] broadcast-widget.html ?res=2k: all elements scale to 2560×1440
- [ ] vertical-widget.html: scoreboard centered at top, goal cards bottom-center
- [ ] Championships match stats: table always shown (no card switch), opponent goals display correctly
- [ ] Roster thumbnail: dark header band, cards correct
- [ ] PWA cache cleared after deployment

---

## 🔮 FUTURE FEATURES

1. Assist tracking in retroactive goal modal
2. Substitutions — player in/out with time
3. Yellow/red cards
4. Championship standings table (auto W/D/L/pts)
5. Broadcast widget: configurable timing values
6. Match notes / venue field
7. Export match report (PDF)
8. Team archive (`isArchived: true` flag — proposed, not yet implemented)

---

*Hosted on GitHub Pages. All files deploy from the repo root.* ⚽
