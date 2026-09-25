# Soccer Scoreboard Application
## Last Updated: September 25, 2026 (Session 18)

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
| `widget.html` | Live scoreboard widget for OBS overlay. Independent of `widget-shared.*` — has its own copy of the timer/status labels, team1/team2 scoreboard gradient CSS, and goal-card listener logic, so changes to those areas need to be made in both places |
| `goals-widget.html` | Goal statistics overlay for OBS |
| `broadcast-widget.html` | Full-screen automated broadcast director (HD 1920×1080 and 2K 2560×1440) |
| `broadcast-widget.css` | Broadcast-specific styles (layers, positions, stats overlay) |
| `broadcast-widget-2k.css` | 2K resolution overrides (loaded dynamically when `?res=2k`) |
| `broadcast-widget-sequences.js` | State machine: layer helpers, half start/end sequences, status handler |
| `broadcast-widget-scoreboard.js` | Broadcast aliases for shared functions + stats overlay rendering |
| `broadcast-widget-canvas.js` | Canvas/thumbnail rendering helpers |
| `widget-shared.css` | **Shared** — scoreboard and goal card styles (`.ngc-*`, `.score-container`, `.timer-container`). Team scoreboard cards (`.team.team1`/`.team.team2`) use the same "flat team color + dark diagonal overlay" technique as the opponent goal card: team1 is dark on the left fading to team color on the right, team2 is the mirror (team color on the left, dark on the right) |
| `widget-shared-2k.css` | **Shared** — 2K overrides for scoreboard and goal cards (via `.ws-2k` class) |
| `widget-shared.js` | **Shared** — color helpers, team/player cache, scoreboard rendering, goal card builders |
| `widget-goal-listener.js` | **Shared** — Firebase goal listening logic (`/goals` + `score2` change detection) |
| `vertical-widget.html` | Vertical 1440×2560 widget for YouTube Shorts/Reels. Also doubles as a landscape corner overlay via `?view=landscape&position=left\|right` — see **Landscape Corner Overlay** below |
| `roster.html` | Team roster management (tabs: Состав / Команды) |
| `championships.html` | Championships (tabs: Чемпионаты / Управление) |
| `match-helpers.js` | Shared date formatting, sort logic (`matchSortKey` always returns a numeric timestamp), status constants |
| `match-management.js` | Match list, dashboard, goals stats, widget URL helpers, clip visibility. `displayMatches()` hands off to `renderMatchCalendar()` when the calendar view is active |
| `match-calendar.js` | Dashboard calendar view — Список / Календарь switch, month grid, day panel, «Без даты», create-from-empty-day. See **Calendar View** below |
| `match-control.js` | Score/time control, thumbnails, clip marker functions |
| `match-edit-modal.js` | Unified create/edit match modal — includes 1/2/3 halves-count toggle. `openMatchEditModal(matchId, prefillDate)` — optional `'YYYY-MM-DD'` prefills the date for new matches |
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
| `styles.css` | Main styles (calendar styles at the end: `.view-switch`, `.cal-*`) |
| `app-layout.css` | Shared layout styles |
| `roster-styles.css` | Roster page styles |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker (network-first caching) |

---

## ✅ FEATURES

### Match Management
- Match list: active → scheduled (soonest first) → waiting (by date, soonest first) → played (newest first)
- Sort key (`matchSortKey` in `match-helpers.js`) is always a numeric timestamp:
  - Upcoming: `scheduledTime` → `matchDate` → `createdAt`
  - Played: `matchDate` → `scheduledTime` → `createdAt`
  - Previously upcoming matches ignored `matchDate` and fell back to `createdAt`, so date-only matches sorted by creation order; mixing number and string keys also broke comparison
- Match cockpit: team names, date, status, quick-edit icon
- Create/edit via unified modal — team & championship dropdowns; date-only entry supported (time optional)
- Time management: start/stop halves, halftime popup, end match
- Score controls with goal scorer modal (player grid + own goal + assists)
- Goal removal modal with per-goal selection
- Retroactive goal entry for ended matches
- Resources panel: **Табло**, **Заставка**, **Команда**, **Статистика**, **Табло 2К**, **Табло справа**, **Табло слева**, **Трансляция 2К** (the old **Трансляция HD** button was removed — unused)

### Calendar View (`match-calendar.js`)
- **Список / Календарь** segmented switch in the dashboard filter row; last choice saved in `localStorage.matchViewMode`
- Month grid, Monday-first, with ‹ › navigation and a **Сегодня** button; today = yellow border + blue day number
- Uses the same data as the list (`allMatchesCache` + `activeChampFilter`) — no extra Firebase reads. Respects «Спрятать прошедшие матчи» and the championship filter
- Day placement: `matchDate` (always saved by the modal), fallback to the local date of `scheduledTime`; matches with neither are listed under **«Без даты: N»**
- One match on a day → chip «Команда 1 — Команда 2» with time (time hidden on mobile); ended matches show the score in grey
- 2+ matches → chip **«Несколько матчей (N)»**
- Chip colours follow card statuses (via `getMatchStatus`): blue ожидается, orange готов к началу, green идёт / перерыв, grey закончен
- Clicking a day with matches opens a panel **above** the grid with the existing match cards (`renderMatchCard`, sorted by time) — Открыть / Изменить / Удалить work as in the list. Panel has **«＋ Добавить матч»** for adding more matches to that day
- Clicking an **empty day** opens «Создать матч» with that date prefilled (`openMatchEditModal(null, date)`); desktop shows a «+» hover hint
- Live updates: `displayMatches()` re-renders the calendar on every field-listener update; the open panel stays in sync and closes automatically if its day becomes empty (deleted / filtered out)
- Team names in chips are HTML-escaped

### Multi-Half Matches (1 / 2 / 3 halves)
- 3-position toggle in the create/edit match modal — "⏱️ Количество таймов" (1, 2, or 3), defaults to 2
- Stored as `halvesCount` on the match record; matches created before this feature have no value and default to 2, so old data behaves exactly as before
- Simple rule, no championship/friendly check needed: whichever half number equals `halvesCount` is the **last** half —
  - Playing the last half → the cockpit shows **"⏹ Закончить матч"**, which ends the match directly, no break screen
  - Playing any earlier half → the cockpit shows **"⏸ Остановить N тайм"**, which leads to a break popup always offering **"Начать (N+1) тайм"** alongside **"Закончить матч"** (safety valve, in case the ref wants to stop early)
- A match paused mid-break (`half1_ended`, `half2_ended`) is treated as **active** everywhere — dashboard sorting, card styling, clip-marker visibility — not lumped in with finished matches
- Streaming widgets show **"ПЕРЕРЫВ"** during any of these breaks (not "МАТЧ ОКОНЧЕН"), since the match isn't formally over until the ref actually ends it
- Goals scored in a 3rd half are grouped under their own "3-й тайм" section automatically in all goal tables (cockpit, `goals-widget.html`, `championships.html`, broadcast stats) — no special-casing needed, they already group goals by half number generically

### Landscape Corner Overlay (`vertical-widget.html?view=landscape`)
- Reuses the vertical widget's existing scoreboard + goal-card markup unchanged — no new widget file
- `?view=landscape` switches the page canvas from portrait 1440×2560 to a full-screen transparent 2560×1440 layer
- The original 1440×2560 content block is scaled down proportionally (×0.5625, i.e. 1440/2560) so it fits the 1440px screen height exactly, then pinned to one edge via `?position=right` (default) or `?position=left`
- Scoreboard and goal notification card scale and move together, since the goal card is positioned relative to the scaled content block rather than the raw viewport
- With no `view` param the page behaves exactly as before (portrait Shorts export) — fully backward compatible
- Resources panel buttons **Табло справа** / **Табло слева** copy the ready-made landscape URL (`&view=landscape&position=right|left`) for pasting into an OBS/Larix browser source that covers the full 2K broadcast screen
- Intended use: a simple, static scoreboard-in-the-corner overlay for a 16:9 broadcast layout, without the full `broadcast-widget.html` animation/state-machine — just score + goal indication

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

**State machine design:** `playing` always wins — `bwHalfStart()` runs synchronously and instantly clears whatever is on screen. A shared generation token (`bwSeqToken`) is bumped by `bwHalfStart()` and `bwHalfEndSequence()`, and checked by both of those plus `bwPostGoalAnnouncement()` after every `await` — so if the ref fires off a new transition (start/stop a half) while an older fire-and-forget sequence is still mid-flight, the stale one bails out immediately instead of re-showing the scoreboard or thumbnail over a state that's already moved on. (Fixes a real production bug where quickly starting/stopping halves left the thumbnail and live scoreboard overlapping.)

#### Goal Notification Cards
**Home team goal** — player photo (dark bg, radial glow, yellow number badge) | yellow separator | blue gradient panel (Гол! + minute + name + club) | optional Ассистенты block

**Opponent goal** — white logo block | team-color separator | white panel (Гол! + minute + team name). Opponent goals are also written to `/goals` (for stats), but the goal-card listener now explicitly skips `isOpponent` records there — previously it briefly rendered them as a home-team card with no player ("Гол! НЕИЗВЕСТНЫЙ") before the real opponent card replaced it a moment later. Fixed in both `widget-goal-listener.js` (shared) and `widget.html`'s own independent copy of the same logic.

**Own goal** — team1 logo | blue panel | Автогол команды {team2Name}

#### Shared Widget Modules
`widget-shared.js`, `widget-shared.css`, `widget-shared-2k.css`, `widget-goal-listener.js` — used by both `broadcast-widget.html` and `vertical-widget.html`.

### `vertical-widget.html` — Vertical 2K Widget / Landscape Corner Overlay
1440×2560px for YouTube Shorts by default. Scoreboard at top, goal cards at bottom. Uses shared modules only.

Also supports a **landscape mode** for embedding into a 16:9 broadcast as a corner overlay instead of a Shorts export:
- `?view=landscape` — canvas becomes a full 2560×1440 transparent layer; the portrait content is scaled ×0.5625 (1440/2560) to fit the 1440px screen height
- `?position=right` (default) / `?position=left` — pins the scaled content to that edge of the 2560px-wide canvas
- No animation/state machine, unlike `broadcast-widget.html` — just the live scoreboard and goal notification card
- Example: `vertical-widget.html?match=match_123&view=landscape&position=right`

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

- [ ] Match list sorts correctly — date-only (waiting) matches ordered by `matchDate`, not creation order
- [ ] Calendar: Список / Календарь switch works; choice survives reload
- [ ] Calendar: today highlighted; ‹ › and «Сегодня» navigate correctly
- [ ] Calendar: day with one match → click shows its card above the grid; «Открыть» opens the cockpit
- [ ] Calendar: day with several matches → «Несколько матчей (N)», panel lists all cards sorted by time
- [ ] Calendar: «Спрятать прошедшие матчи» off → past matches grey with score; championship filter applies
- [ ] Calendar: «Без даты: N» lists matches without date
- [ ] Calendar: click empty day → «Создать матч» with date prefilled; saved match appears on that day
- [ ] Calendar: «Добавить матч» in the day panel prefills that day's date
- [ ] Calendar: «Создать новый матч» (top button) still opens with an empty date
- [ ] Calendar: deleting the last match of the open day closes the panel
- [ ] Calendar: live match chip turns green without reload
- [ ] Calendar on mobile: chips readable, switch full width
- [ ] Create/edit modal: dropdowns populate, saves correctly
- [ ] Resources panel: all buttons copy correct URLs
- [ ] Goal modal: assist multi-select, modal stays open, scorer saves with assists
- [ ] Opponent `+` button: saves goal to Firebase, score increments
- [ ] Opponent `−` button: shows goal list, selected goal deleted + score decrements
- [ ] Opponent goals shown in stats with color badge + team name, no assist controls
- [ ] Environment switcher: toggle in nav dropdown switches PROD/TEST, TEST badge visible
- [ ] Clip button appears only while half is playing
- [ ] widget.html: opponent goal card shows team 2 logo + correct color — no flash of a home-team "НЕИЗВЕСТНЫЙ" card first
- [ ] widget.html: own goal card shows team 1 logo + "Автогол команды {name}"
- [ ] broadcast-widget.html / vertical-widget.html: same opponent-goal check — no flash before the correct card
- [ ] broadcast-widget.html: goal card shows player photo + yellow number badge
- [ ] broadcast-widget.html: match details screen hides instantly when half 2 starts
- [ ] broadcast-widget.html: rapid start/stop of a half doesn't leave the scoreboard and match thumbnail overlapping (stale fire-and-forget sequence)
- [ ] broadcast-widget.html: YouTube subscribe reminder shown at half start (8s) and half end (4s)
- [ ] broadcast-widget.html ?res=2k: all elements scale to 2560×1440
- [ ] vertical-widget.html: scoreboard centered at top, goal cards bottom-center
- [ ] vertical-widget.html `?view=landscape&position=right`: canvas is 2560×1440, scoreboard+goal card pinned to the right edge, scaled to fit 1440px height
- [ ] vertical-widget.html `?view=landscape&position=left`: same, pinned to the left edge
- [ ] vertical-widget.html with no `view` param: still renders as the original 1440×2560 portrait Shorts export (no regression)
- [ ] Resources panel: **Табло справа** / **Табло слева** buttons copy the correct landscape URLs
- [ ] Match created with 1 half: cockpit shows only "Начать 1 тайм" → "Закончить матч" directly, no break screen
- [ ] Match created with 3 halves: two break screens (after half 1, after half 2), each offering "start next half" + "Закончить матч"; the 3rd half ends directly with no third break screen
- [ ] Existing matches with no `halvesCount` field behave exactly as 2-half matches
- [ ] Championships match stats: table always shown (no card switch), opponent goals display correctly
- [ ] Roster thumbnail: dark header band, cards correct
- [ ] PWA cache cleared after deployment

---

## 🔮 FUTURE FEATURES

1. Penalty shootout — prototyped (attempt-tracking dots, widget previews, sudden-death sets) but not yet built into production code
2. Assist tracking in retroactive goal modal
3. Substitutions — player in/out with time
4. Yellow/red cards
5. Championship standings table (auto W/D/L/pts) — will need to account for penalty-shootout results once that feature ships, since a shootout win doesn't change the regulation score
6. Broadcast widget: configurable timing values
7. Match notes / venue field
8. Export match report (PDF)
9. Team archive (`isArchived: true` flag — proposed, not yet implemented)

---

*Hosted on GitHub Pages. All files deploy from the repo root.* ⚽
