# Soccer Scoreboard Application
## Last Updated: April 12, 2026 (Session 8)

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
| `broadcast-widget.html` | **NEW** Full-screen automated broadcast director (1920×1080) |
| `roster.html` | Team roster management (tabs: Состав / Команды) |
| `championships.html` | Championships (tabs: Чемпионаты / Управление) |
| `match-helpers.js` | **Shared** date formatting, sort logic, status constants |
| `match-management.js` | Match list rendering, dashboard, pagination, goals stats, widget URL helpers |
| `match-control.js` | Score/time control, match thumbnail generator, roster download |
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
- Resources panel: Табло, Заставка, Команда, Статистика, **Трансляция** (broadcast widget link)

### Firebase Bandwidth Optimisation
All pages use page-level session caches to avoid re-downloading data. Key principle: **never store base64 photos/logos in display-only caches, and never store logos in match records**.

- **`match-management.js`** — `.once()` replaces collection real-time listener; per-field listeners (~50 bytes each) for live score updates; `_matchDataCache` serves match cockpit with zero reads
- **`match-edit-modal.js`** — no longer writes `team1Logo`/`team2Logo`/`team1Color`/`team2Color` to match records; writes `team1Id`/`team2Id` instead
- **`match-control.js`** — thumbnail fetches logos from `/teams/{id}`, not from match record
- **`widget.html`** / **`goals-widget.html`** — logos/colors fetched from `/teams` with three-level fallback: teamId → name match → embedded field
- **`championships.html`** — teams fetched once alongside matches; `_champTeamsCache` used for all logo resolution
- **`goal-tracking.js`** — `_matchCache` eliminates match fetches during a match; players cache strips photos
- **`roster.js`** — `_teamsCache`, `_playersPageCache`, `_coachCache` cover all roster page reads

### Goal Tracking & Assists
- **Live goal modal** — assist section above scorer grid; multi-select; modal stays open until scorer tapped
- **Assist picker modal** — 👟 button on every goal stats row; pre-populates existing assists; × chip removes individually
- **Firebase schema** — `assists: [{playerId, playerNumber}]` array on goal records; fully optional/additive

### Championships
- **Championship Stats Modal** — W/D/L + ratio bar; goals for/against; ⚽ Голы / 👟 Пасы toggle; ranked table with medals; ⚠️ warning banner
- Championship thumbnail generator (2560×1440 PNG)
- **`isPassed` toggle** — passed championships hidden from match form dropdown

### Team & Championship Management
- **Teams** — Команды tab: create, edit, delete with logo/color
- **`isActive` toggle** — inactive teams hidden from match dropdowns, shown greyed in Команды tab
- **Championships** — Управление tab: create, edit, delete with logo

### Roster Management
- Player CRUD: number, name, position (goalkeeper / field), photo upload, absent toggle
- Coach management: name, photo
- Badge icons: goalkeeper, field player, coach (PNG with transparency)
- Soft delete — players marked `isDeleted:true`, historical goal data preserved
- Roster thumbnail download (2560×1440 PNG, broadcast-ready)
- Header now has dark overlay band matching match thumbnail style

### Thumbnails
- **Match thumbnail** — 1920×1080 canvas render, team logos, VS or score, date, championship title
- **Roster thumbnail** — 2560×1440, vertical player cards with photos, coach card, GK section, dark header band
- **Championship thumbnail** — 2560×1440, card grid (≤15 matches) or table layout (>15)

### Streaming Widgets

#### `widget.html` — Live Scoreboard (OBS overlay)
Real-time score + timer. Goal notification card (5s):
- Without assists: 56px card — `#N | Гол! / LASTNAME | ⚽`
- With assists: 76px card — scorer row + `👟 #7 ИВАНОВ · #11 ПЕТРОВ`
- Opponent goal: team color card with team name
- Own goal: grey card

#### `goals-widget.html` — Goal Statistics (OBS overlay)
- Table layout (≤10 goals): assist chips with number badge + last name
- Card grid (>10 goals): `👟 N` assist badge if player has assists

#### `broadcast-widget.html` — Automated Broadcast Director (NEW)
Full-screen 1920×1080 widget for streaming via Larix/OBS browser source. Automates the entire presentation flow:

**State flow:**
1. **Load** — match thumbnail (15s) → roster thumbnail (15s) → transparent
2. **Half 1 starts** — score widget at bottom-center large (5s) → moves to top-left
3. **Playing** — score widget top-left with live timer
4. **Goal** — large goal card bottom-center (5s) → score announcement bottom-center (3s) → top-left
5. **Half 1 ends** — score bottom-center (3s) → goals stats full-screen (10s) → match thumbnail with score
6. **Half 2 starts** — thumbnail hides instantly → score bottom-center (5s) → top-left
7. **Match ends** — same as half-end

**Key design decisions:**
- Score widget: exact `widget.html` HTML/CSS, `min-width: 600px`, `scale(2.0)` at bottom-center
- Goal card: 900px wide, fixed `bottom: 60px`, independent of score widget position
- Stats overlay: full-screen solid background `rgb(0,44,138)`, no padding/rounding, table ≤7 / cards >7
- All CSS prefixed `bw-` except scoreboard classes (reuse original verbatim — zero conflict risk)
- `bwFlashTransition(ms, midFn)` — content swap only happens when overlay is fully opaque
- Timer bar hidden via CSS rule on parent class (not JS DOM lookup) — survives DOM re-renders

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
| Coach accent | `#FCDC00` yellow | Coach card top line, number badges |
| Footer gradient | transparent → `#0033A0` | Card footer overlay |
| On-surface | `#d4e3ff` | Last name text |
| On-surface muted | `rgba(166,200,255,0.65)` | First name text |
| Font | Lexend → Calibri fallback | All canvas text |
| Stats background | `rgb(0,44,138)` | Broadcast stats overlay solid bg |

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

`/players`, `/coaches`, `/teams`, `/championships` must all allow public read for `broadcast-widget.html` to work unauthenticated.

---

## 📱 PWA INSTALLATION (Android)

1. Open Chrome → `https://ovdolgaya.github.io/soccer-scoreboard/`
2. Tap three-dot menu → **Add to Home screen**
3. App installs with soccer ball icon, opens fullscreen

**Service worker**: Network-first. Always fetches live Firebase data. Falls back to cached static shell if offline.

---

## 🧪 TESTING CHECKLIST

- [ ] No login form flash for already-authenticated users
- [ ] Match list: upcoming at top (soonest first), played below (newest first)
- [ ] Create match modal: team/championship dropdowns populate correctly (active/non-passed only)
- [ ] Edit match modal: pre-fills existing values, saves correctly
- [ ] Cockpit resources: all 5 buttons copy correct URLs / trigger downloads
- [ ] **Трансляция button copies broadcast-widget.html?match=ID**
- [ ] Roster tab: players, coach, badges work as before
- [ ] Команды tab: create/edit/delete teams, logo + color saved
- [ ] isActive toggle — inactive teams show ❌, grey card, hidden from dropdowns
- [ ] Управление tab: create/edit/delete championships
- [ ] isPassed toggle — passed championships show ❌, grey card, hidden from dropdown
- [ ] Goal modal: assist section above scorer grid, multi-select, modal stays open
- [ ] Assist picker modal: pre-populates, saves, × removes individual assist
- [ ] widget.html: goal card shows assist line when assists present
- [ ] goals-widget.html: table assist chips + card assist badge correct
- [ ] Championship stats modal: W/D/L, goals, ⚽/👟 toggle, medals, warning banner
- [ ] **broadcast-widget.html: intro sequence shows match thumb then roster thumb**
- [ ] **broadcast-widget.html: thumbnails do not overlap (canvas cleared on switch)**
- [ ] **broadcast-widget.html: score widget appears at top-left when half starts**
- [ ] **broadcast-widget.html: score widget visible after half 2 starts (not hidden from half-end)**
- [ ] **broadcast-widget.html: goal card appears bottom-center, large**
- [ ] **broadcast-widget.html: after goal card — score announcement bottom-center then top-left**
- [ ] **broadcast-widget.html: timer bar hidden in bottom-center position**
- [ ] **broadcast-widget.html: stats shown after half ends, transitions to match thumbnail**
- [ ] **broadcast-widget.html: stats show table for ≤7 goals, cards for >7**
- [ ] **broadcast-widget.html: match thumbnail with score shown during half break**
- [ ] **broadcast-widget.html: thumbnail hidden instantly when half 2 starts**
- [ ] Roster thumbnail: dark header band, player cards, gradient footer
- [ ] Session cache: second thumbnail generation makes zero Firebase reads
- [ ] After deployment: bump `CACHE_NAME` in `sw.js` to force PWA update

---

## 🔮 FUTURE FEATURES TO CONSIDER

1. Assist tracking in retroactive goal modal (currently goals-only)
2. Opponent goal tracking — opponent roster or number input
3. Substitutions — player in/out with time
4. Yellow/red cards
5. Championship standings table — auto-calculated points/wins/draws/losses
6. Second stats widget variant — both teams side-by-side
7. Match notes / venue field
8. Export match report (PDF)
9. Broadcast widget: configurable timing values (intro duration, stats duration, etc.)
10. Broadcast widget: manual override mode — operator can skip/hold any phase

---

*Hosted on GitHub Pages. All files deploy from the repo root.*  ⚽
