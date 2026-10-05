# Soccer App — Project Context
*Last updated: 2026-10-05 (Session 20)*

---

## Project Overview
A web-based soccer team management app hosted on **GitHub Pages**, using **Firebase Realtime Database** for data storage. No Firebase Storage (decided to stay with base64 in database). Files are vanilla HTML/CSS/JS — no build system.

---

## File Structure

| File | Purpose |
|---|---|
| `index.html` | Match dashboard, cockpit. Includes clip marker button + clip log section |
| `match-control.js` | Score control, time/half management, thumbnail generation, roster download, **clip marker functions** |
| `match-management.js` | Match list rendering, pagination, openMatch, cockpit header, goals stats, `copyBroadcastWidgetUrl(res)`, `copyVerticalWidgetUrl()`, clip visibility hook |
| `match-edit-modal.js` | Unified create/edit match modal — dropdown-only teams & championships |
| `match-helpers.js` | Shared sort/format utilities |
| `team-stats.js` | **NEW (S20)** — shared stats logic: fetch-once goals/saves/player caches, `tsAggregate` (W/D/L, goals, per-player goals/assists/saves by **playerId**), `tsRender` (results + ⚽/👟/🧤 table). Used by championships.html and the roster Аналитика tab |
| `roster-analytics.js` | **NEW (S20)** — roster «📊 Аналитика» tab: period (С/По + Этот месяц / Прошлый месяц / Этот год), whole squad listed |
| `goalkeeper-saves.js` | **NEW (S20)** — cockpit «🧤 Вратари» section: active keeper radio + save −/+, `/saves` writes |
| `auth.js` | Authentication, view switching |
| `championships.html` | Two tabs: Чемпионаты (match groups) + Управление (CRUD for championships) |
| `roster.html` | Two tabs: Состав (players/coach/badges) + Команды (CRUD for teams) |
| `roster.js` | Player CRUD, coach, badge icons, resize-before-save. Uses `_safeRosterCacheClear()` wrapper |
| `roster-thumbnail-helper.js` | Shared roster thumbnail generator (2560×1440), session cache. Header has dark overlay band |
| `roster-styles.css` | Roster page styles |
| `goal-tracking.js` | Goal tracking logic, player picker modal, assist picker modal. `openRetroGoalModal('penalty')` = shootout scorer picker |
| `penalty-helpers.js` | **NEW (S19)** — shared pure penalty logic: sets / sudden death / decided / scores / W-D-L comparison |
| `penalty-shootout.js` | **NEW (S19)** — cockpit penalty section (format, dots, writes, `penRequestEnd`) |
| `match-calendar.js` | Dashboard calendar view (S17) |
| `widget.html` | Live scoreboard OBS overlay. Goal notification cards for home player, opponent, own goal |
| `goals-widget.html` | Goals statistics OBS overlay (table ≤10 / card grid >10) |
| `broadcast-widget.html` | Full-screen automated broadcast director (HD 1920×1080 or 2K 2560×1440) |
| `broadcast-widget.css` | Broadcast-specific styles (layers, positions, stats overlay) |
| `broadcast-widget-2k.css` | Broadcast 2K overrides — loaded dynamically when `?res=2k` |
| `broadcast-widget-sequences.js` | State machine: layer helpers, half start/end sequences, status change handler |
| `broadcast-widget-scoreboard.js` | Broadcast-specific aliases and stats overlay |
| `broadcast-widget-canvas.js` | Canvas/thumbnail rendering helpers for broadcast widget |
| `widget-shared.css` | Shared styles for scoreboard and goal cards (`.ngc-*`) |
| `widget-shared-2k.css` | 2K overrides for shared scoreboard and goal card styles |
| `widget-shared.js` | Shared JS: color helpers, team/player cache, scoreboard rendering, goal card builders |
| `widget-goal-listener.js` | Shared Firebase goal listening logic |
| `vertical-widget.html` | Vertical 1440×2560 widget for YouTube Shorts/Reels |
| `firebase-config-loader.js` | **NEW** — Dynamic Firebase config selector. Reads `localStorage.fcEnv` and loads the right config file via `document.write` |
| `firebase-config.js` | Firebase credentials — PROD, with auth (**not in repo**) |
| `firebase-config-test.js` | Firebase credentials — TEST, with auth (**not in repo**) |
| `firebase-config-widget.js` | Firebase credentials — PROD, widgets (no auth) |
| `firebase-config-widget-test.js` | Firebase credentials — TEST, widgets (no auth) (**not in repo**) |
| `nav.js` | Navigation bar + env toggle in profile dropdown |
| `styles.css` | Main styles |
| `app-layout.css` | Shared layout |
| `manifest.json` | PWA manifest |
| `sw.js` | Service worker (network-first caching) |

---

## Firebase Database Structure

```
/players/{playerId}
    teamId, number, firstName, lastName
    photo (base64 JPEG, resized to 400×400)
    isGoalkeeper, isAbsent, isDeleted, deletedAt
    createdAt

/teams/{teamId}
    name, color, logo (base64)
    goalkeeperBadge, fieldPlayerBadge (base64 PNG transparent)
    isActive (bool, default true)
    createdBy, createdAt, updatedAt

/coaches/{teamId}
    firstName, lastName, middleName
    photo (base64 JPEG, 400×400)
    teamId, updatedAt

/matches/{matchId}
    team1Id, team2Id
    team1Name, team2Name
    score1, score2
    status: 'scheduled'|'waiting'|'playing'|'half1_ended'|'half2_ended'|'penalties'|'ended'
    scheduledTime (ms), matchDate (YYYY-MM-DD)
    halvesCount (1|2|3; missing = 2)
    penaltyFormat (3|5)            — present ⇒ match went to penalties (kept after 'ended')
    penaltyScore1, penaltyScore2   — shootout tally, separate from score1/score2
    activeGoalkeeperId             — keeper currently in goal (cockpit radio), default team
    championship, createdBy, createdAt

/penaltyAttempts/{matchId}/{s#_t#_a#}      — deterministic id: set / team side / attempt
    team (1|2), setIndex (0 = main set, 1+ = sudden death), attemptIndex
    result ('goal'|'miss'), playerId?, playerNumber? (home only)
    goalKey? (linked /goals record for goals), timestamp

/championships/{champ_XXXX}
    title, logo (base64)
    isPassed (bool)
    createdAt, updatedAt

/goals/{goalId}
    matchId, teamId, playerId, playerNumber
    isOwnGoal (bool)
    isOpponent (bool) — true for opponent goals; teamId=null, playerId=null
    half (1|2|null), matchTime (MM:SS|null)
    timestamp, retroactive (bool)
    assists: [{ playerId, playerNumber }]
    isPenalty (bool) — shootout goal; half/matchTime absent; penaltyAttemptId
                       home: teamId + playerId; opponent: isOpponent, no team/player

/saves/{saveId}                     — goalkeeper saves, default team only (S20)
    matchId, playerId, playerNumber?
    half?, matchTime?            — live saves only (same logic as goals)
    isPenalty? (bool)            — recorded while status === 'penalties'
    retroactive? (bool)          — recorded after 'ended'; no half/matchTime
    timestamp

/clips/{clipId}
    matchId
    timestamp (ms)
    matchTime (HH:MM:SS)
    half (1|2)
```

**Notes:**
- `team1Color`/`team2Color` are NOT stored in match records — fetched from `/teams` at display time
- `createdAt` removed from goal records in Session 13 (was duplicate of `timestamp`)

---

## Firebase Security Rules

Current production rules (Session 20 — `saves` block is new):

```json
{
  "rules": {
    "matches": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$matchId": { ".read": true }
    },
    "teams": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$teamId": { ".read": true, ".indexOn": ["teamId"] }
    },
    "championships": { ".read": "auth != null", ".write": "auth != null" },
    "players": {
      ".read": "true",
      ".write": "auth != null",
      ".indexOn": ["teamId"],
      "$playerId": {
        ".validate": "newData.hasChildren(['number', 'firstName', 'lastName', 'teamId'])",
        "number":      { ".validate": "newData.isNumber()" },
        "firstName":   { ".validate": "newData.isString()" },
        "lastName":    { ".validate": "newData.isString()" },
        "teamId":      { ".validate": "newData.isString()" },
        "isGoalkeeper":{ ".validate": "newData.isBoolean()" },
        "isAbsent":    { ".validate": "newData.isBoolean()" },
        "photo":       { ".validate": "newData.isString()" },
        "createdAt":   { ".validate": "newData.isNumber()" },
        "updatedAt":   { ".validate": "newData.isNumber()" }
      }
    },
    "coaches": {
      ".read": "true",
      ".write": "auth != null",
      "$teamId": {
        ".validate": "newData.hasChildren(['name', 'teamId'])",
        "name":      { ".validate": "newData.isString()" },
        "teamId":    { ".validate": "newData.isString()" },
        "photo":     { ".validate": "newData.isString()" },
        "createdAt": { ".validate": "newData.isNumber()" },
        "updatedAt": { ".validate": "newData.isNumber()" }
      }
    },
    "settings": { ".read": "auth != null", ".write": "auth != null" },
    "goals": {
      ".read": "true",
      ".write": "auth != null",
      ".indexOn": ["matchId", "teamId", "timestamp"],
      "$goalId": {
        ".validate": "newData.hasChildren(['matchId', 'timestamp'])",
        "matchId":      { ".validate": "newData.isString()" },
        "teamId":       { ".validate": "newData.isString() || newData.val() === null" },
        "playerId":     { ".validate": "newData.isString() || newData.val() === null" },
        "playerNumber": { ".validate": "newData.isNumber() || !newData.exists()" },
        "isOwnGoal":    { ".validate": "newData.isBoolean()" },
        "isPenalty":    { ".validate": "newData.isBoolean()" },
        "half":         { ".validate": "newData.isNumber()" },
        "matchTime":    { ".validate": "newData.isString()" },
        "timestamp":    { ".validate": "newData.isNumber()" }
      }
    },
    "penaltyAttempts": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$matchId": {
        ".read": true,
        "$attemptId": {
          ".validate": "newData.hasChildren(['team', 'setIndex', 'attemptIndex', 'result', 'timestamp'])",
          "team":         { ".validate": "newData.val() === 1 || newData.val() === 2" },
          "setIndex":     { ".validate": "newData.isNumber()" },
          "attemptIndex": { ".validate": "newData.isNumber()" },
          "result":       { ".validate": "newData.val() === 'goal' || newData.val() === 'miss'" },
          "playerId":     { ".validate": "newData.isString()" },
          "playerNumber": { ".validate": "newData.isNumber()" },
          "goalKey":      { ".validate": "newData.isString()" },
          "timestamp":    { ".validate": "newData.isNumber()" }
        }
      }
    },
    "saves": {
      ".read": "true",
      ".write": "auth != null",
      ".indexOn": ["matchId", "playerId"],
      "$saveId": {
        ".validate": "newData.hasChildren(['matchId', 'playerId', 'timestamp'])",
        "matchId":      { ".validate": "newData.isString()" },
        "playerId":     { ".validate": "newData.isString()" },
        "playerNumber": { ".validate": "newData.isNumber()" },
        "half":         { ".validate": "newData.isNumber()" },
        "matchTime":    { ".validate": "newData.isString()" },
        "isPenalty":    { ".validate": "newData.isBoolean()" },
        "retroactive":  { ".validate": "newData.isBoolean()" },
        "timestamp":    { ".validate": "newData.isNumber()" }
      }
    },
    "clips": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".indexOn": ["matchId", "timestamp"],
      "$clipId": {
        ".validate": "newData.hasChildren(['matchId', 'timestamp', 'matchTime', 'half'])",
        "matchId":   { ".validate": "newData.isString()" },
        "timestamp": { ".validate": "newData.isNumber()" },
        "matchTime": { ".validate": "newData.isString()" },
        "half":      { ".validate": "newData.isNumber()" }
      }
    }
  }
}
```

Notes:
- Penalty clicks use one root-level multi-path `update()` (attempt + goal + scores) — each path is checked against its own rule, no root write permission needed.
- `/saves` is publicly readable (like `/goals`) so the unauthenticated broadcast widget can show keeper stats at the end of the match (phase 2).
- `/penaltyAttempts/$matchId` is publicly readable (same pattern as `/matches/$matchId`) so the unauthenticated widgets can draw the dots.

---

## Environment Switcher (added Session 14)

Allows switching between PROD and TEST Firebase databases without touching code.

**How it works:**
- `localStorage.fcEnv` — `'prod'` (default) or `'test'`
- `firebase-config-loader.js` reads env in priority order: **URL param `?env=test`** → `localStorage.fcEnv` → `'prod'`
- Uses `document.write` to synchronously inject the correct config `<script>` before any Firebase SDK use
- App pages: `firebase-config-loader.js` (no param) → `firebase-config.js` or `firebase-config-test.js`
- Widget pages: `firebase-config-loader.js?widget` → `firebase-config-widget.js` or `firebase-config-widget-test.js`

**URL param propagation:**
- `match-management.js` — `_envSuffix()` returns `'&env=test'` when test is active, `''` otherwise
- All four copy functions (`copyWidgetUrl`, `copyStatsWidgetUrl`, `copyBroadcastWidgetUrl`, `copyVerticalWidgetUrl`) append `_envSuffix()` to the URL
- Result: copied widget links automatically carry `&env=test` → work correctly in any browser or OBS without needing `localStorage`

**UI in nav dropdown:**
- Toggle row "База данных: PROD/TEST" with switch
- **PROD** — green badge; **TEST** — yellow badge
- When TEST active: yellow `TEST` badge appears in nav bar next to logo — impossible to miss
- On toggle: `localStorage` updated → `location.reload()` — Firebase re-initializes with new config

**Files NOT in repo** (must be created manually for each environment):
- `firebase-config-test.js` — TEST credentials with `auth` + `database`
- `firebase-config-widget-test.js` — TEST credentials with `database` only

**Important:** SW caches `firebase-config-loader.js`. After deploying a new version, browsers with old SW must either wait for automatic update or manually Unregister SW in DevTools → Application → Service Workers.

---

## Match Cockpit Resources Panel

- **Табло** → `widget.html?match=ID`
- **Заставка** → match thumbnail PNG download
- **Команда** → roster thumbnail PNG download
- **Статистика** → `goals-widget.html?match=ID`
- **Трансляция HD** → `broadcast-widget.html?match=ID`
- **Трансляция 2К** → `broadcast-widget.html?match=ID&res=2k`
- **Табло 2К** → `vertical-widget.html?match=ID`

URL building: `getBasePath()` + `_copyUrl(url, toastMsg)` in `match-management.js`.

---

## Opponent Goals Feature (added Session 13)

Opponent goals saved to `/goals` with `isOpponent: true`.

- `+` → `addOpponentGoal()` — saves `{isOpponent:true, teamId:null, playerId:null, half, matchTime, timestamp}`, increments `score2`
- `−` → `requestGoalRemoval(2)` — shows list from `/goals`, deletes + decrements. Falls back to `changeScore(2,-1)` if no records (backward compat)
- **Cockpit stats**: colored rectangle badge (team2 color) + team name, no assist controls
- **Championships modal**: same — always table view regardless of goal count
- **goals-widget.html**: unchanged (table ≤10 / cards >10)

---

## Clip Markers

- Button "📍 Отметить момент" — visible only when `status === 'playing'`
- Saves `{ matchId, timestamp, matchTime, half }` to `/clips`
- Clip log shown during playing (with delete) and after match ends (read-only)

---

## Shared Widget Modules Architecture

### `widget-shared.js`
- **Color helpers:** `wsLightenColor`, `wsApplyTeamColors`
- **Caches:** `wsTeamsCache`, `wsPlayersCache`
- **Data fetching:** `wsFetchTeamData`, `wsPrefillPlayersCache`
- **Scoreboard:** `wsRenderScoreboard`, `wsStartTimer`, `wsGetTimerContent`
- **Goal cards:** `wsBuildHomeGoalCard`, `wsBuildOwnGoalCard`, `wsBuildOppGoalCard`
- **Notifications:** `wsShowGoalNotif`

### `widget-goal-listener.js`
- `wsInitGoalListener` — subscribes to `/goals` (home/own goals) and `score2` delta (opponent goals)

---

## Broadcast Widget

Full-screen automated director. Supports HD (1920×1080) and 2K (2560×1440) via `?res=2k`.

### State Machine

| Trigger | Sequence |
|---|---|
| Load (waiting/scheduled) | Match thumbnail (15s) → roster thumbnail (15s) → transparent |
| Half starts (`playing`) | **Instantly** clear canvas + stats → score bottom-center (5s) → top-left → subscribe reminder (8s) |
| Playing | Score top-left with live timer |
| Goal | Goal card (5s) → score bottom-center (3s) → top-left |
| Half/match ends | Score bottom-center (3s) → subscribe reminder (4s) → stats (10s) → match thumbnail |

### Key Design Principle
- `bwHalfStart()` is **synchronous** — instantly wipes via `bwHideCanvasInstant()` / `bwHideStatsInstant()`
- `bwHalfEndSequence()` has **guard checks** after every `await`

---

## Key Learnings & Patterns

- **`firebase-config-loader.js`**: uses `document.write` — must load synchronously before Firebase SDK. `?widget` query param selects widget (no-auth) config variant
- **`sortMatches` order (match-helpers.js):** active (`playing`/`half1_ended`) → `scheduled` (by date asc) → `waiting` (by date/createdAt) → played (`ended`/`half2_ended`, newest first). `waiting` always sorts after `scheduled` regardless of timestamps.
- **`_matchCache`** — always use it, never `database.once()` for score reads in cockpit
- **`getBasePath()`** in `match-management.js` — single place for app base URL
- **`_renderPlayerNumberGrid(gridId, options)`** — shared renderer for all player number grids. Options: `mode`, `large`, `onClick` (`{id}`/`{num}` placeholders), `isSelected`
- **Opponent goals**: `isOpponent: true`, `teamId: null`. Team color fetched from `/teams` at render time
- **`championships.html` always uses table view** — `buildStatsCards` exists but not called from `renderStatsBody`
- **Firebase bandwidth:** session caching essential; never store logos in match records
- **PWA cache:** bump `CACHE_NAME` in `sw.js` after every deployment
- **UTC timezone bug:** parse date strings manually — `new Date(str)` treats local datetime as UTC
- **matchTime is MM:SS:** `parts[0]` is minutes directly

---

## Penalty Shootout (Session 19)

- **Dot input (S20):** tap a dot → choice row (⚽ Гол · ✕ Промах · 🗑 Очистить) → one write with the final result. Replaced the S19 click-cycle, which wrote «miss» on the way to «goal» (red flash on widgets). Home «Гол» writes nothing until a player is picked.
- **Single entry point:** `endMatch()` (match-control.js). Level score → «Нужна серия пенальти?» → Нет: `_finalizeEndMatch()`; Да: status `'penalties'`. With status `'penalties'`, `endMatch()` → `penRequestEnd()` → confirm if undecided / no attempts → `_finalizeEndMatch()`. The tie popup never shows twice.
- **«Закончить матч» stays in the time controls** during the shootout (not under the dots) — deliberate, to avoid accidental clicks. Zero attempts + end = undo: ended as draw, `penaltyFormat`/scores/attempts cleared.
- **Sets are derived, never stored:** `penBuildSets(attempts, format)` appends a same-size set while the last set is complete and tied. `penIsDecided()` = last set complete and not tied.
- **Cockpit sections:** `_applyStatusSections()` (match-management.js) runs on open *and* on every live status change — penalties swap out `#scoreControlsSection`; `ended` shows the stats table without reopening the match.
- **Home side** for the player picker = `resolveDefaultTeamSide()` (default team; in practice always team 1).
- **Goal cards:** `wsGoalCardAllowed()` blocks everything while status is `'penalties'` and any `isPenalty` goal; `widget.html` has its own `isPenalty` bail.
- **Broadcast:** `bwPenaltyStartSequence()` — thumbnail (tied score, 5s) → subscribe (4s) → `bwEnterPenaltyView()` (`.bw-penalties` on the score layer: timer hidden, `#bw-pen-panel` shown, score bottom-center). Bumps `bwSeqToken`. `bwHalfEndSequence()` removes `.bw-penalties` after the final score card. Reload mid-shootout → `bwEnterPenaltyView()` directly.
- **Vertical:** no transition sequence (no canvas layers) — timer hidden, `#vw-pen` shown immediately.
- **Broadcast stats:** table ≤ 7 home goals (penalty goals included), cards ≥ 8. `goals-widget.html` deliberately unchanged (still ≤ 10).
- **Championships W/D/L:** `penResultScores()` uses penalty scores for ended matches with `penaltyFormat`; goals for/against stay regulation-only.

---

## Player Stats & Numbers (Session 20)

- All player stats are aggregated by **playerId**, never by number — a player who wore #2 in one match and #7 in another stays one row. The displayed number is the **current** roster number; `playerNumber` on goals/saves is only a fallback label.
- Real risks are record-level only: one child under two player records (stats split) or one record reused for another child (stats merge).

## Goalkeeper Saves (Session 20)

- **Phase 1 (done): cockpit tracking only.** Nothing is shown on any widget during the match.
- **Section** `#gkSection` sits between the score/penalty controls and «📍 Отметить момент». Visible in every status, including `'penalties'` (goals are hidden there, saves are not).
- **Keeper list** = `goalTracking.playersCache` filtered by `isGoalkeeper` (already excludes absent/deleted). A field player playing in goal is marked as goalkeeper in the roster. Keepers with saves who later left the active list are still shown (number from the save record). The list is loaded once per page load — reload the cockpit after a roster change.
- **Radio** writes `matches/{id}/activeGoalkeeperId` (live cockpit field — synced across devices). One keeper + nobody selected → auto-selected (not for ended matches).
- **+** pushes a save for the active keeper; **−** removes his latest save (no confirm). Both disabled in `scheduled`/`waiting`; − disabled at 0.
- **Save flags by status:** playing / breaks → `half` + `matchTime` (`getMatchTimeString`); `penalties` → `isPenalty: true`; `ended` → `retroactive: true`.
- **Default team only** — no opponent keeper tracking, no keeper link on opponent goals.
- **Shootout saves stay manual** (decided S20): −/+ during `penalties` writes `isPenalty: true`. Not derived from `/penaltyAttempts` — a miss isn't necessarily a save.
- **Championships page (done S20):** saves in the match stats modal and a «🧤 Сейвы» tab in championship stats.
- **Next:** keeper stats below goals in the broadcast end-of-match stats (`bwRenderStats` in `broadcast-widget-scoreboard.js`).

---

## Changelog

### 2026-10-05 (Session 20) — Goalkeeper saves (phase 1)

1. `goalkeeper-saves.js` — **new**: `gkApplyStatus`, `gkRender`, `gkSelect`, `gkAddSave`, `gkRemoveSave`, `gkDetach`; live `/saves` query by `matchId`
2. `index.html` — `#gkSection` markup + script tag
3. `match-management.js` — `activeGoalkeeperId` added to `_COCKPIT_FIELDS` (re-renders section); `gkApplyStatus` in `_applyStatusSections`; `gkDetach` in `_detachCockpitListeners`
4. `goal-tracking.js` — `gkRender()` after players load
5. `styles.css` — `.gk-*` styles (system primary blue, same card style as score controls)
6. `sw.js` — `scoreboard-v11`, `goalkeeper-saves.js` added
7. Firebase rules — new `/saves` block (TEST and PROD)
9. `championships.html` — match stats modal: «👟 Пасы» and «🧤 Сейвы» (with «пен. N») sections under the goals table; championship stats: «Бомбардиры» title removed, full-width toggle ⚽ Голы · 👟 Пасы · 🧤 Сейвы, «not linked» warning only on the goals tab; matches without a championship grouped as «Товарищеские матчи» (first card, 🤝, no logo upload, stats + thumbnail work). Shared fetch-once helpers `_fetchMatchGoals` / `_fetchMatchSaves` (`_matchSavesCache`); saves load failure never blocks goal stats
10. `team-stats.js` — **new** shared module; `championships.html` championship stats now render through it (old `_renderChampStats` / `_buildChampStatsHTML` / `_renderChampScorerTable` removed; `_fetchMatchGoals/Saves` are aliases). Our side is resolved by team id first, then name
11. `roster.html` / `roster-analytics.js` / `roster-styles.css` — «📊 Аналитика» tab. Ended matches whose `matchDate` (else day of `scheduledTime`) is in the period; default = current month; swapped dates auto-fixed; selected ⚽/👟/🧤 tab kept on period change. Squad without the stat listed greyed below (saves: goalkeepers only); deleted players shown only with stats («удалён»). Squad records prefill the name cache (fresh after roster edits, no extra reads)
12. `sw.js` — `team-stats.js`, `roster-analytics.js` added (still v11)
8. `penalty-shootout.js` — click-cycle replaced by a choice row (`penSelect` / `penChoose`): one write per attempt, no intermediate «miss»; changing a home scorer removes the old `/goals` record. `index.html` — `.pen-choice*` styles, selected-dot ring. Shootout keeper saves stay manual (−/+ with `isPenalty`)


### 2026-09-28 (Session 19) — Penalty shootout

1. `penalty-helpers.js` — **new**, shared pure logic
2. `penalty-shootout.js` — **new**, cockpit section: format picker, dots (empty → goal → miss → empty), player picker for home goals, atomic writes, `penRequestEnd()`
3. `match-control.js` — `endMatch()` tie-check + «Нужна серия пенальти?»; `_finalizeEndMatch(extra)`; `penaltyPromptYes/No`
4. `match-management.js` — `'penalties'` status text/card/button; `_applyStatusSections()` (live section swap); «Пенальти» section in cockpit stats; penalty fields in live listeners; penalty line on list cards
5. `goal-tracking.js` — `openRetroGoalModal(mode)` with `'penalty'` mode; penalty goals excluded from «−» removal lists
6. `index.html` — penalty section, prompt modal, retro modal ids, `#scoreControlsSection`, penalty styles, new script tags
7. `match-helpers.js`, `match-calendar.js` — `'penalties'` counts as active
8. `match-edit-modal.js` — `'penalties'` added to `lockedStatuses` (**bug fix:** editing mid-shootout would have reset status to `waiting`)
9. `widget-shared.js/.css/-2k.css` — penalty status text, dots panel renderer, `wsInitPenaltyListener()`
10. `widget-goal-listener.js` — no cards during penalties / for `isPenalty`
11. `vertical-widget.html`, `broadcast-widget.html/.css/-2k.css`, `broadcast-widget-sequences.js` — penalty view + transition
12. `broadcast-widget-scoreboard.js` — «Пенальти» table section, penalty line in stats header, 7-goal threshold
13. `broadcast-widget-canvas.js` — «ПЕНАЛЬТИ X : Y» line on the final thumbnail, «СЕРИЯ ПЕНАЛЬТИ» label
14. `widget.html` — «ПЕНАЛЬТИ X:Y» status text, `isPenalty` bail
15. `championships.html` — status labels, «(пен. X:Y)» on cards/stats badge, «Пенальти» stats section, W/D/L via penalty scores
16. `sw.js` — `scoreboard-v10`, new files added
20. `broadcast-widget-scoreboard.js` + `broadcast-widget.css`/`-2k.css` — stats card view shows assist-only players after the scorers (assists block only); `.bw-cards-dense` 4×4 grid when > 12 cards. `goals-widget.html` intentionally unchanged
19. Penalty section restyled to the light cockpit card style; dot cycle changed to **empty → miss → goal → empty** (miss = one click; goal = second click → scorer picker; cancelling keeps the miss)
18. `championships.html` — both tabs split into active (by name) → «Прошедшие чемпионаты» (by name) via `_splitActivePassed()`; `isPassed` now carried into `champGroups`
17. Firebase rules — `/penaltyAttempts` block, `isPenalty` validation on goals

### Sessions 16–18
Calendar view, `halvesCount`, landscape corner overlay, goal-card and sequence race fixes — see README.md.

### 2026-05-01 (Session 15)

**Championship thumbnail — match sort order:**
1. `championships.html` — `generateChampThumbnail()`: matches now sorted into three buckets: played with date (earliest first) → scheduled with date (earliest first) → `waiting`/undated (always last). Previously `waiting` matches without a date were mixed in by `createdAt`.

**Championship analytics — dense rank:**
2. `championships.html` — `_renderChampScorerTable()`: replaced sequential row index with dense rank. Players sharing the same stat value get the same rank and medal (🥇/🥈/🥉). Next distinct value gets the next rank number.

**Match create/edit modal — date without time:**
3. `match-edit-modal.js` — replaced single `datetime-local` input with two separate fields: **Дата матча** (`date`, required when known) + **Время начала** (`time`, optional). If only date is set → `scheduledTime = null`, status `waiting`. If date + time → `scheduledTime` timestamp saved, status `scheduled`.

**Match list sort — `scheduled` always before `waiting`:**
4. `match-helpers.js` — `sortMatches()` rewritten with explicit sub-groups within upcoming: `playing`/`half1_ended` (0) → `scheduled` (1) → `waiting` (2). Prevents `waiting` matches from floating above `scheduled` ones due to bogus or missing timestamps.

### 2026-04-29 (Session 14)

**New feature — Environment switcher (PROD/TEST):**
1. `firebase-config-loader.js` — **new file**. Reads env from URL `?env=test` first, then `localStorage.fcEnv`, then defaults to `'prod'`. Uses `document.write` to synchronously load correct config before Firebase SDK. App pages: no param; widget pages: `?widget`
2. `match-management.js` — `_envSuffix()` helper appends `&env=test` to all copied widget URLs when test is active — ensures links work in any browser/OBS without needing `localStorage`
3. `nav.js` — env toggle in profile dropdown: PROD/TEST badge, toggle switch, yellow `TEST` badge in nav bar. `navToggleEnv(isTest)` saves to `localStorage` + reloads
4. `index.html`, `roster.html`, `championships.html` — `firebase-config.js` → `firebase-config-loader.js`
5. `widget.html`, `goals-widget.html`, `broadcast-widget.html`, `vertical-widget.html` — `firebase-config-widget.js` → `firebase-config-loader.js?widget`
6. `sw.js` — bumped to `scoreboard-v7`, added `firebase-config-loader.js` to `STATIC_SHELL`

### 2026-04-28 (Session 13)

**Code quality:**
1. `match-control.js` — `changeScore()` uses `_matchCache` instead of `database.once()`
2. `match-management.js` — `getBasePath()` + `_copyUrl()` extracted, ~100 lines removed
3. `goal-tracking.js` — 4 grid render functions → 1 `_renderPlayerNumberGrid()`. Removed duplicate `createdAt`

**New feature — Opponent goals tracking:**
4. `goal-tracking.js` — `addOpponentGoal()`, `requestGoalRemoval(2)` with goal list UI
5. `index.html` — `+`/`−` buttons for team2 wired to new functions
6. `match-management.js` — opponent goals in stats with team-color badge + team name
7. `championships.html` — `buildStatsTable()` handles `isOpponent`, always table view

### 2026-04-27 (Session 12)
2K resolution support, new goal card design, shared widget modules, vertical widget.

### 2026-04-14 (Sessions 9–11)
Broadcast widget race condition fix, own goal card, subscribe reminder, clip markers.

**Earlier sessions:** see git history
