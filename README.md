# Soccer Scoreboard Application
## Last Updated: April 13, 2026 (Session 8)

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
| `broadcast-widget.html` | Full-screen automated broadcast director (1920×1080) |
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
- Resources panel: **Табло**, **Заставка**, **Команда**, **Статистика**, **Трансляция**

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
- Own goal: grey ⚽ | "Автогол" | ⚽

### `goals-widget.html` — Goal Statistics
Table (≤10 goals) or card grid (>10). Assist chips in table, assist badge in cards.

### `broadcast-widget.html` — Automated Broadcast Director
Full-screen 1920×1080 widget for Larix/OBS. Automates the entire presentation:

1. **Load** — match thumbnail (15s) → roster thumbnail (15s) → transparent
2. **Half starts** — score widget bottom-center large (5s) → slides to top-left
3. **Playing** — score widget top-left with live timer
4. **Goal** — large goal card bottom-center (5s) → score announcement (3s) → top-left
5. **Half ends** — score bottom-center (3s) → goals stats full-screen (10s) → match thumbnail with score
6. **Next half** — thumbnail hides instantly → repeat

Score widget uses exact `widget.html` layout. Stats overlay: full-screen solid background, table ≤7 / cards >7.

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
- [ ] Resources panel: all 5 buttons work (Табло, Заставка, Команда, Статистика, Трансляция)
- [ ] Goal modal: assist multi-select, modal stays open, scorer saves with assists
- [ ] Assist picker: pre-populates, saves, × removes individual assist
- [ ] Clip button appears only while half is playing
- [ ] Clip button saves with correct matchTime and half
- [ ] Clip list shown during match and after match ends (read-only)
- [ ] Player status toggle: no false error alert
- [ ] widget.html: opponent goal card shows team 2 logo + correct color
- [ ] broadcast-widget.html: intro thumbnails don't overlap
- [ ] broadcast-widget.html: score visible at top-left after half starts
- [ ] broadcast-widget.html: stats full-screen solid background
- [ ] broadcast-widget.html: opponent goal card shows team 2 logo
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

---

*Hosted on GitHub Pages. All files deploy from the repo root.* ⚽
