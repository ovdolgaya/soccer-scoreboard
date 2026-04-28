# Soccer Scoreboard Application
## Last Updated: April 28, 2026 (Session 12)

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
| `widget-shared.js` | **Shared** — color helpers, team/player cache, scoreboard rendering, goal card builders, notification display |
| `widget-goal-listener.js` | **Shared** — Firebase goal listening logic (`/goals` + `score2` change detection) |
| `vertical-widget.html` | Vertical 1440×2560 widget for YouTube Shorts/Reels |
| `roster.html` | Team roster management (tabs: Состав / Команды) |
| `championships.html` | Championships (tabs: Чемпионаты / Управление) |
| `match-helpers.js` | Shared date formatting, sort logic, status constants |
| `match-management.js` | Match list, dashboard, goals stats, widget URL helpers, clip visibility |
| `match-control.js` | Score/time control, thumbnails, clip marker functions |
| `match-edit-modal.js` | Unified create/edit match modal |
| `auth.js` | Firebase auth, login/logout, view switching |
| `nav.js` | Shared navigation bar |
| `goal-tracking.js` | Goal recording, player picker, assist picker |
| `roster-thumbnail-helper.js` | Roster thumbnail generator (2560×1440) with session cache |
| `roster.js` | Roster management logic |
| `firebase-config.js` | Firebase credentials (**not in repo**) |
| `firebase-config-widget.js` | Firebase credentials for public widgets |
| `styles.css` | Main styles |
| `app-layout.css` | Shared layout styles |
| `roster-styles.css` | Roster page styles |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker (network-first caching) |

---

## ✅ FEATURES

### Match Management
- Match list: upcoming soonest first, played newest first
- Match cockpit: team names, date, status, quick-edit icon
- Create/edit via unified modal — team & championship dropdowns
- Time management: start/stop halves, halftime popup, end match
- Score controls with goal scorer modal (player grid + own goal + assists)
- Goal removal modal
- Retroactive goal entry for ended matches
- Resources panel:
  - **Icon buttons:** Табло, Заставка, Команда, Статистика
  - **Full buttons:** Трансляция, Трансляция 2К, Табло 2К

### Clip Markers
- "📍 Отметить момент" button appears only while a half is playing
- Saves `{ matchId, timestamp, matchTime, half }` to `/clips` Firebase node
- Clip log shown during match (with delete) and after match ends (read-only review)

### Firebase Bandwidth Optimisation
- `.once()` replaces collection real-time listener; per-field listeners for live updates
- `_matchDataCache` serves cockpit with zero reads after initial load
- Team logos fetched from `/teams/{id}`, never stored in match records
- Session caches throughout: `_teamsCache`, `_playersPageCache`, `_coachCache`, `_champTeamsCache`

### Goal Tracking & Assists
- Live goal modal: assist section above scorer grid, multi-select, modal stays open
- Assist picker modal on every goal stats row
- `assists: [{playerId, playerNumber}]` array on goal records

### Championships
- Championship Stats Modal: W/D/L, goals for/against, ⚽/👟 toggle, medals, warning banner
- Championship thumbnail (2560×1440)
- `isPassed` toggle hides from match form

### Roster Management
- Player CRUD with photo upload, absent toggle, soft delete
- Coach management with photo
- Badge icons (goalkeeper/field/coach PNG)
- Roster thumbnail (2560×1440) — dark header band matching match thumbnail style

### Thumbnails
- **Match thumbnail** — 1920×1080 canvas, team logos, VS or score, date, championship. Shows "ПЕРЕРЫВ" / "МАТЧ ОКОНЧЕН" instead of date after match starts
- **Roster thumbnail** — 2560×1440, player cards, coach, GK section
- **Championship thumbnail** — 2560×1440, card grid ≤15 / table >15

---

## 📺 STREAMING WIDGETS

### `widget.html` — Live Scoreboard
Real-time score + timer for OBS. Goal notification card (5s).

### `goals-widget.html` — Goal Statistics
Table (≤10 goals) or card grid (>10).

### `broadcast-widget.html` — Automated Broadcast Director
Full-screen widget for Larix/OBS. Supports **HD (1920×1080)** and **2K (2560×1440)** via `?res=2k`. Automates the entire presentation:

1. **Load** — match thumbnail (15s) → roster thumbnail (15s) → transparent
2. **Half starts** — canvas/stats cleared instantly → score bottom-center (5s) → top-left → YouTube subscribe reminder (8s)
3. **Playing** — score widget top-left with live timer
4. **Goal** — goal card bottom-center (5s) → score bottom-center (3s) → top-left
5. **Half ends** — score bottom-center (3s) → YouTube subscribe reminder (4s) → stats full-screen (10s) → match thumbnail with score
6. **Load with ended status** — stats shown immediately (no scoreboard)

#### 2K Resolution
- URL parameter `?res=2k` loads `widget-shared-2k.css` + `broadcast-widget-2k.css` dynamically
- Canvas dimensions set via `BW_W`/`BW_H` globals
- `ws-2k` class added to `#bw-goal-notif` for card size overrides
- Scoreboard scales: top-left `scale(1.0)`, bottom-center `scale(1.33)`

#### Shared Widget Modules
All goal card and scoreboard logic is in shared files used by both `broadcast-widget.html` and `vertical-widget.html`:
- **`widget-shared.js`** — `wsLightenColor`, `wsApplyTeamColors`, `wsFetchTeamData`, `wsPrefillPlayersCache`, `wsRenderScoreboard`, `wsStartTimer`, `wsBuildHomeGoalCard`, `wsBuildOwnGoalCard`, `wsBuildOppGoalCard`, `wsShowGoalNotif`
- **`widget-goal-listener.js`** — `wsInitGoalListener` subscribes to `/goals` (home/own goals) and `score2` field (opponent goals). `wsHandleGoal`, `wsShowHomeGoalCard`, `wsShowOwnGoalCard`, `wsShowOppGoalCard` — all accept optional `durationMs` and `onHide` callback
- **`widget-shared.css`** — all `.ngc-*` and scoreboard base styles
- **`widget-shared-2k.css`** — 2K overrides scoped to `.ws-2k` class

#### Goal Notification Cards
**Home team goal** — player photo (dark bg, radial glow, yellow number badge) | yellow separator | blue gradient panel (Гол! + minute + firstName LASTNAME + club) | optional Ассистенты (full name + #number). After card hides → `bwPostGoalAnnouncement()` shows score bottom-center.

**Opponent goal** — white logo block (team logo `80px`) | team-color panel + dark gradient overlay | white text with shadow. Logo loaded from `matchData._t2Logo` (preserved across Firebase updates).

**Own goal** — БАТЭ-style blue gradient panel | team1 logo | "Автогол команды {team2Name}".

`_t2Logo`/`_t2Color` fields preserved on `bwMatchData` when Firebase sends updates (prevents empty logo on opponent goal card).

### `vertical-widget.html` — Vertical 2K Widget (Shorts/Reels)
1440×2560px widget for YouTube Shorts. Scoreboard centered at top, goal cards at bottom-center. Uses shared modules only (~150 lines). `body` is `display:flex; flex-direction:column; align-items:center` for automatic horizontal centering.

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
- [ ] Resources panel: icon buttons (Табло/Заставка/Команда/Статистика) work, full buttons copy correct URLs
- [ ] Goal modal: assist multi-select, modal stays open, scorer saves with assists
- [ ] Clip button appears only while half is playing
- [ ] broadcast-widget.html: goal card appears bottom-center
- [ ] broadcast-widget.html: after goal card hides → score shows bottom-center → moves top-left
- [ ] broadcast-widget.html: opponent goal card uses team 2 color + logo
- [ ] broadcast-widget.html: own goal card shows team 1 logo + team 2 name
- [ ] broadcast-widget.html ?res=2k: scoreboard top-left scale(1.0), bottom-center scale(1.33)
- [ ] broadcast-widget.html ?res=2k: goal card sizes correct (ws-2k class applied)
- [ ] vertical-widget.html: scoreboard centered at top
- [ ] vertical-widget.html: goal cards appear bottom-center
- [ ] vertical-widget.html: opponent goal card uses team 2 color + logo
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
| `broadcast-widget.html` | Full-screen automated broadcast director (supports HD 1920×1080 and 2K 2560×1440) |
| `broadcast-widget-2k.css` | 2K resolution overrides (loaded dynamically when `?res=2k`) |
| `broadcast-widget-sequences.js` | State machine: layer helpers, half start/end sequences, status handler |
| `broadcast-widget-scoreboard.js` | Scoreboard rendering and goal notification cards |
| `broadcast-widget-canvas.js` | Canvas/thumbnail rendering helpers |
| `broadcast-widget.css` | Broadcast widget styles |
| `roster.html` | Team roster management (tabs: Состав / Команды) |
| `championships.html` | Championships (tabs: Чемпионаты / Управление) |
| `match-helpers.js` | Shared date formatting, sort logic, status constants |
| `match-management.js` | Match list, dashboard, goals stats, widget URL helpers, clip visibility |
| `match-control.js` | Score/time control, thumbnails, clip marker functions |
| `match-edit-modal.js` | Unified create/edit match modal |
| `auth.js` | Firebase auth, login/logout, view switching |
| `nav.js` | Shared navigation bar |
| `goal-tracking.js` | Goal recording, player picker, assist picker |
| `roster-thumbnail-helper.js` | Roster thumbnail generator (2560×1440) with session cache |
| `roster.js` | Roster management logic |
| `firebase-config.js` | Firebase credentials (**not in repo**) |
| `firebase-config-widget.js` | Firebase credentials for public widgets |
| `styles.css` | Main styles |
| `app-layout.css` | Shared layout styles |
| `roster-styles.css` | Roster page styles |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker (network-first caching) |

---

## ✅ FEATURES

### Match Management
- Match list: upcoming soonest first, played newest first
- Match cockpit: team names, date, status, quick-edit icon
- Create/edit via unified modal — team & championship dropdowns
- Time management: start/stop halves, halftime popup, end match
- Score controls with goal scorer modal (player grid + own goal + assists)
- Goal removal modal
- Retroactive goal entry for ended matches
- Resources panel: **Табло**, **Заставка**, **Команда**, **Статистика**, **Трансляция HD**, **Трансляция 2К**

### Clip Markers
- "📍 Отметить момент" button appears only while a half is playing
- Saves `{ matchId, timestamp, matchTime, half }` to `/clips` Firebase node
- Clip log shown during match (with delete) and after match ends (read-only review)
- Useful for finding highlight moments in the recording later

### Firebase Bandwidth Optimisation
- `.once()` replaces collection real-time listener; per-field listeners for live updates
- `_matchDataCache` serves cockpit with zero reads after initial load
- Team logos fetched from `/teams/{id}`, never stored in match records
- Session caches throughout: `_teamsCache`, `_playersPageCache`, `_coachCache`, `_champTeamsCache`

### Goal Tracking & Assists
- Live goal modal: assist section above scorer grid, multi-select, modal stays open
- Assist picker modal on every goal stats row
- `assists: [{playerId, playerNumber}]` array on goal records

### Championships
- Championship Stats Modal: W/D/L, goals for/against, ⚽/👟 toggle, medals, warning banner
- Championship thumbnail (2560×1440)
- `isPassed` toggle hides from match form

### Roster Management
- Player CRUD with photo upload, absent toggle, soft delete
- Coach management with photo
- Badge icons (goalkeeper/field/coach PNG)
- Roster thumbnail (2560×1440) — dark header band matching match thumbnail style

### Thumbnails
- **Match thumbnail** — 1920×1080 canvas, team logos, VS or score, date, championship
- **Roster thumbnail** — 2560×1440, player cards, coach, GK section
- **Championship thumbnail** — 2560×1440, card grid ≤15 / table >15

---

## 📺 STREAMING WIDGETS

### `widget.html` — Live Scoreboard
Real-time score + timer for OBS. Goal notification card (5s):
- Home player: `#N | Гол! / LASTNAME | ⚽` (+ assist line if assists)
- Opponent: team 2 logo (or ⚽) | "Гол!" + team name | ⚽
- Own goal: team 1 logo | "Автогол" + "Автогол команды {team2Name}" | ⚽

### `goals-widget.html` — Goal Statistics
Table (≤10 goals) or card grid (>10). Assist chips in table, assist badge in cards.

### `broadcast-widget.html` — Automated Broadcast Director
Full-screen widget for Larix/OBS. Supports **HD (1920×1080)** and **2K (2560×1440)** via `?res=2k` URL parameter. Automates the entire presentation:

1. **Load** — match thumbnail (15s) → roster thumbnail (15s) → transparent
2. **Half starts** — canvas/stats cleared **instantly** → score bottom-center (5s) → top-left → YouTube subscribe reminder (8s)
3. **Playing** — score widget top-left with live timer
4. **Goal** — goal card bottom-center (5s) → score bottom-center (3s) → top-left
5. **Half ends** — score bottom-center (3s) → YouTube subscribe reminder (4s) → stats full-screen (10s) → match thumbnail with score
6. **Next half starts** — thumbnail/stats cleared instantly → repeat from step 2

Score widget uses exact `widget.html` layout. Stats overlay: full-screen solid background, table ≤7 / cards >7.

**State machine design:** `playing` always wins — `bwHalfStart()` runs synchronously and instantly clears whatever is on screen. `bwHalfEndSequence()` has guard checks after every long `await` — if status becomes `playing` mid-sequence the sequence exits without touching the screen.

#### 2K Resolution
- URL parameter `?res=2k` loads `broadcast-widget-2k.css` dynamically before render
- Canvas dimensions set via `BW_W`/`BW_H` globals (2560×1440 or 1920×1080)
- `broadcast-widget-canvas.js` uses `BW_W`/`BW_H` instead of hardcoded values — `SCALE = W/1280` auto-scales everything
- Resources panel has two buttons: **Трансляция HD** and **Трансляция 2К**
- OBS Browser Source must be set to matching resolution (1920×1080 or 2560×1440)

#### Goal Notification Cards (new design)
**Home team goal** — player photo (roster style: dark bg, radial glow, yellow number badge top-left) | yellow separator | blue gradient panel (Гол! + minute + first/last name + club) | optional Ассистенты block (name + #number per row)

**Opponent goal / Own goal** — white block with team logo | team-color separator | white panel (Гол!/Автогол + minute + team name). Separator and progress bar use team's color dynamically.

`matchTime` stored as `MM:SS` → displayed as whole minutes only (e.g. `"05:19"` → `5'`).

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

- [ ] Match list sorts correctly (upcoming first, played newest first)
- [ ] Create/edit modal: dropdowns populate, saves correctly
- [ ] Resources panel: Трансляция HD and Трансляция 2К copy correct URLs
- [ ] Goal modal: assist multi-select, modal stays open, scorer saves with assists
- [ ] Assist picker: pre-populates, saves, × removes individual assist
- [ ] Clip button appears only while half is playing
- [ ] Clip button saves with correct matchTime and half
- [ ] Clip list shown during match and after match ends (read-only)
- [ ] Player status toggle: no false error alert
- [ ] widget.html: opponent goal card shows team 2 logo + correct color
- [ ] widget.html: own goal card shows team 1 logo + "Автогол команды {name}"
- [ ] broadcast-widget.html: intro thumbnails show correctly before match
- [ ] broadcast-widget.html: match details screen hides instantly when half 2 starts
- [ ] broadcast-widget.html: score visible at top-left after half starts
- [ ] broadcast-widget.html: stats full-screen solid background
- [ ] broadcast-widget.html: goal card shows player photo + yellow number badge
- [ ] broadcast-widget.html: goal card shows Ассистенты with full name + number
- [ ] broadcast-widget.html: goal card shows minute correctly (not seconds)
- [ ] broadcast-widget.html: opponent card uses team color for separator
- [ ] broadcast-widget.html: own goal card shows team 1 logo + team 2 name
- [ ] broadcast-widget.html: YouTube subscribe reminder shown at half start (8s)
- [ ] broadcast-widget.html: YouTube subscribe reminder shown at half end (4s)
- [ ] broadcast-widget.html ?res=2k: all elements scale to 2560×1440
- [ ] Roster thumbnail: dark header band, cards correct
- [ ] Championship stats: W/D/L, ⚽/👟 toggle, medals
- [ ] PWA cache cleared after deployment

---

## 🔮 FUTURE FEATURES

1. Assist tracking in retroactive goal modal
2. Opponent goal tracking with roster/number input
3. Substitutions — player in/out with time
4. Yellow/red cards
5. Championship standings table (auto W/D/L/pts)
6. Broadcast widget: configurable timing values
7. Broadcast widget: manual override mode
8. Match notes / venue field
9. Export match report (PDF)
10. Team archive (`isArchived: true` flag — proposed, not yet implemented)

---

*Hosted on GitHub Pages. All files deploy from the repo root.* ⚽
