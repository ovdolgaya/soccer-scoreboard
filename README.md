# Soccer Scoreboard Application - Chat Handoff Document
## Last Updated: February 18, 2026

---

## 📋 PROJECT OVERVIEW

**Application**: Soccer Scoreboard — Real-time streaming widget with Firebase backend  
**Tech Stack**: Vanilla JavaScript, Firebase Realtime Database, HTML5 Canvas  
**Key Pages**:
- `index.html` — Main match control panel
- `widget.html` — Live scoreboard stream overlay
- `roster.html` — Team roster management
- `goals-widget.html` — Goals statistics stream overlay (NEW)

---

## 🎯 SESSION 1 ACCOMPLISHMENTS (Previous Session)

### 1. Team Roster Management System
- ✅ Player database with photos and positions (goalkeeper / field player)
- ✅ Coach configuration with photo upload
- ✅ Customizable badge icons per position
- ✅ Roster thumbnail generator (1280×720 PNG)
- ✅ Quick absence toggle (present / absent)
- ✅ Modal forms for mobile-friendly add/edit
- ✅ Mobile card layout vs desktop table view
- ✅ Collapsible team settings section

### 2. Match Control Page Updates
- ✅ Championship dropdown for past matches
- ✅ Consolidated "Match Resources" section (4 buttons: Табло, Заставка, Команда, Статистика)
- ✅ Match thumbnail generation
- ✅ One-click roster download from match control
- ✅ Shared `roster-thumbnail-helper.js` for reuse across pages

### Key Files (Session 1)
- `roster.html` / `roster.js` / `roster-styles.css`
- `roster-thumbnail-helper.js`
- `index.html` / `match-control.js` / `match-management.js`
- `firebase-rules-updated.json`

---

## 🎯 SESSION 2 ACCOMPLISHMENTS (This Session)

### 1. Goal Tracking System
Per-goal recording attached to player identities, stored in a `/goals` Firebase collection.

**How it works:**
- Operator clicks **+** for the home team → player picker modal opens
- Operator selects the scoring player (or "Own Goal") → goal saved, score incremented
- Operator clicks **−** for the home team → list of recorded goals appears → select to remove
- Team 2 (opponent) remains direct +/− with no tracking (no roster available)

**Player picker modal:**
- Grid of player number cards (72px, auto-fill)
- Goalkeeper badge in purple, field players in blue
- "Автогол" (own goal) button at the top in orange
- Filters out absent players and soft-deleted players

**Goal removal modal:**
- Chronological list, newest first (pink highlight)
- Each entry shows: player number + name / "Автогол", half, match time
- Cancel or select to delete

### 2. Soft Delete for Players
Instead of hard-deleting players from the database, deletion now sets `isDeleted: true` + `deletedAt` timestamp. This ensures:
- Deleted players remain in Firebase and can be looked up by ID
- Historical goal records stay accurate (goals reference `playerId`)
- Player never appears in the UI, player picker, or roster thumbnail

**Files changed:** `roster.js`, `goal-tracking.js`

### 3. Goals Statistics Widget (`goals-widget.html`)
A 1280×720 OBS browser source overlay showing goal scorers for the current match.

**Adaptive layout — automatically switches based on goal count:**
- **≤ 10 goals** → Table view: match time | number badge | player name | ⚽
- **≥ 11 goals** → Card view: 3-column grid, one card per scorer, goal count on right

**Table view features:**
- Half separators ("1-й тайм" / "2-й тайм")
- Monospace match time column
- White number badge with team colour text
- First name + LAST NAME with staggered fade-in animation
- ⚽ icon right-aligned in each row

**Card view features:**
- Fixed 110px height cards, full-width 3-column grid
- Player photo flush-left (or number avatar fallback)
- Number / first name / LAST NAME in separate rows
- Goal count column right side (36px bold, Russian plural: гол/гола/голов)
- Own goal card: ⚽ avatar, grey accent, "АГ" label

**Background:** `rgba(59, 131, 246, 0.7)` — same blue as match thumbnails  
**Pre-match state:** Shows header with "Матч ещё не начался" — never blank

**Sync strategy:**
- Fetch on load
- Poll every 30 seconds (interval cleared when match ends)
- One lightweight Firebase listener on `matches/{id}/status` only — triggers immediate re-fetch on `half1_ended`, `half2_ended`, `ended`
- When status reaches `'ended'`: final fetch runs, then **all Firebase activity stops completely** — no ongoing connections after match is over

**Access:** `goals-widget.html?match={matchId}`  
Operator copies URL via the 📊 Статистика button in match control.

### 4. Goals Statistics Table in Match Details (Ended Matches Only)
When opening an ended match in the control panel, a "Голы команды" section appears below the score controls. Shows:
- Half separators
- Match time (monospace)
- Blue number badge
- Player first name + LAST NAME
- ⚽ icon

Fetches players by ID — works for soft-deleted players too (name/number preserved).  
Hidden entirely for active/scheduled/waiting matches.

### 5. Bug Fix: Match Creation Error
`startMatch()` was calling `document.getElementById('widgetUrl').value` — a leftover reference to an input field removed in Session 1. Caused "Cannot set properties of null" on every new match creation.  
**Fix:** Removed the dead line from `match-control.js`.

---

## 📁 COMPLETE FILE LIST

### Core Application Files
| File | Status | Notes |
|------|--------|-------|
| `index.html` | Updated | Goals stats section added for ended matches |
| `styles.css` | Unchanged | |
| `widget.html` | Unchanged | Live scoreboard overlay |
| `firebase-config.js` | Unchanged | Authenticated config |
| `firebase-config-widget.js` | Unchanged | Public read-only config for widgets |
| `auth.js` | Unchanged | |
| `match-control.js` | Updated | Dead `widgetUrl` reference removed |
| `match-management.js` | Updated | `loadGoalsStats()`, `renderGoalsStats()`, goals section show/hide |

### Roster Management Files
| File | Status | Notes |
|------|--------|-------|
| `roster.html` | Unchanged | |
| `roster.js` | Updated | Soft delete, filter `isDeleted` from UI and player picker |
| `roster-styles.css` | Unchanged | |
| `roster-thumbnail-helper.js` | Unchanged | |

### Goal Tracking Files (NEW)
| File | Status | Notes |
|------|--------|-------|
| `goal-tracking.js` | NEW | Player picker modal, goal save/remove, match time calc |
| `goals-widget.html` | NEW | 1280×720 OBS overlay, adaptive table/card layout |

### Configuration
| File | Status | Notes |
|------|--------|-------|
| `firebase-rules-updated.json` | Updated | `/goals` collection, public read, auth write |

---

## 💾 FIREBASE DATA STRUCTURES

### `/goals/{goalId}`
```javascript
{
  matchId:      "match_1234567890",   // links to /matches
  teamId:       "team_abc",           // from settings/defaultTeam
  playerId:     "player_xyz",         // null for own goals
  playerNumber: 9,                    // stored at time of goal (for display)
  isGoalkeeper: false,                // stored at time of goal
  isOwnGoal:    false,
  half:         1,                    // 1 or 2
  matchTime:    "34:12",              // MM:SS calculated from match.startTime
  timestamp:    1739876543210,        // Unix ms (absolute)
  createdAt:    1739876543210
}
```

### `/players/{playerId}` — updated fields
```javascript
{
  // ... existing fields ...
  isAbsent:   false,    // game-day availability toggle
  isDeleted:  true,     // soft delete flag (NEW)
  deletedAt:  1739876543210  // Unix ms (NEW)
}
```

### `/matches/{matchId}` — status values
| Status | Meaning |
|--------|---------|
| `waiting` | Created, not started |
| `scheduled` | Scheduled for future |
| `playing` | Active (check `currentHalf`: 1 or 2) |
| `half1_ended` | Half-time break |
| `half2_ended` | Second half ended |
| `ended` | Match complete |

---

## 🔒 FIREBASE RULES SUMMARY

```json
{
  "rules": {
    "players": {
      ".read":    "auth != null",
      ".write":   "auth != null",
      ".indexOn": ["teamId"]
    },
    "goals": {
      ".read":    "true",
      ".write":   "auth != null",
      ".indexOn": ["matchId", "teamId", "timestamp"]
    }
  }
}
```

`/goals` is **publicly readable** so `goals-widget.html` can access it without auth.  
All other collections remain auth-protected for writes.

---

## 🎨 DESIGN DECISIONS

### Soft Delete vs Hard Delete
**Decision:** Players are never removed from the database. `isDeleted: true` hides them from all UI.  
**Rationale:** Goals reference players by ID. Hard-deleting a player would break historical goal records in the stats widget and match details table.

### Adaptive Widget Layout (Table / Cards)
**Decision:** Table for ≤ 10 goals, cards for ≥ 11.  
**Rationale:** With 1-2 scorers the card grid looks sparse and empty. A table always looks full regardless of how few goals there are. Cards are better when there are many unique scorers and the table would overflow the 720px height.  
**Constant:** `TABLE_MAX_GOALS = 10` at the top of `goals-widget.html` — easy to adjust.

### Widget Sync Strategy (Poll + Status Trigger, not Real-time Listeners)
**Decision:** Fetch on load, poll every 30s, trigger on status transitions, stop everything on `ended`.  
**Rationale:** The stats widget is shown between halves / after the match — not during live play. Polling avoids multiple OBS instances hammering Firebase with persistent connections. Stopping sync on `ended` ensures no ongoing Firebase activity for finished matches.

### Goal Tracking Scope (Home Team Only)
**Decision:** Only the home team (default team) has per-player goal tracking. Opponent score is a direct counter.  
**Rationale:** No opponent roster is loaded into the system. Tracking opponent goals would require entering player data that doesn't exist.

---

## 🔧 KEY FUNCTIONS REFERENCE

### `goal-tracking.js`
```javascript
initGoalTracking()          // Call after openMatch() — loads team + players
openGoalScorerModal()       // + button for home team
confirmGoal(playerId, isOwnGoal)  // Saves goal, increments score
requestGoalRemoval(team)    // − button — shows removal list for home team
removeGoal(goalKey, side)   // Deletes goal, decrements score
getMatchTimeString()        // Returns "MM:SS" from match.startTime or wall clock
resolveDefaultTeamSide(matchData)  // Returns 'team1' or 'team2'
```

### `match-management.js` (new functions)
```javascript
loadGoalsStats(matchId)     // Fetches goals for ended match, calls renderGoalsStats
renderGoalsStats(goals, players, container)  // Builds half-grouped table HTML
```

### `goals-widget.html` (internal)
```javascript
fetchAll()                  // Parallel fetch: match + goals + players
loadMissingPlayers()        // Fetches uncached player records by ID
getGoalsList()              // Flat sorted array for table view
aggregateScorers()          // Grouped by scorer for card view
buildTable(goals)           // Generates table HTML
buildCards(scorers)         // Generates card grid HTML
stopSync()                  // Clears interval + detaches status listener
```

---

## 🚀 DEPLOYMENT CHECKLIST

### New files to deploy
- [ ] `goal-tracking.js` (NEW)
- [ ] `goals-widget.html` (NEW)

### Updated files to deploy
- [ ] `index.html`
- [ ] `match-management.js`
- [ ] `match-control.js`
- [ ] `roster.js`

### Firebase
- [ ] Update rules from `firebase-rules-updated.json` (add `/goals` collection)
- [ ] Verify `settings/defaultTeam` is set in roster.html before testing

### Testing Checklist
- [ ] Create new match — no error on save
- [ ] Open active match → + button opens player picker
- [ ] Select player → goal saved, score increments
- [ ] − button → goal list appears → delete works, score decrements
- [ ] Own goal button records correctly
- [ ] Absent players don't appear in picker
- [ ] Soft-deleted player: deleted in roster, still shows in goal history
- [ ] Stats widget URL copies via 📊 button
- [ ] `goals-widget.html?match=...` loads and shows table/cards correctly
- [ ] Widget shows "Матч ещё не начался" for unstarted match
- [ ] Widget stops all Firebase activity after match ends
- [ ] Open ended match in control panel → goals table appears
- [ ] Open active match → goals table hidden

---

## 🔮 FUTURE FEATURES TO CONSIDER

1. **Opponent goal tracking** — requires entering opponent roster or at least a player number
2. **Substitutions** — track player in/out with time
3. **Yellow/red cards** — same modal pattern as goals
4. **Shot statistics** — on target / off target counter
5. **Second statistics widget variant** — showing both teams side-by-side
6. **Goal time restore** — times are already stored; remove `display:none` from `.player-times` in `goals-widget.html` and uncomment `timesStr` in `buildCard()` to show them

---

*All output files are in `/mnt/user-data/outputs/soccer-goals-update/`* ⚽
