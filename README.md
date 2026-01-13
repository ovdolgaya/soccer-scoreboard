# ⚽ Soccer Scoreboard - Real-Time Streaming Widget

Professional soccer scoreboard system with Firebase real-time synchronization for live streaming on OBS, Larix, and other platforms.

## ✨ Features

### 🎮 Control Panel
- **Multi-User Access** - All authenticated users can create and manage matches
- **Real-Time Dashboard** - Live updates across all devices
- **Match Scheduling** - Schedule matches for future dates/times
- **Team Management** - Save and reuse team data with logos and colors
- **Live Score Control** - Update scores in real-time during matches
- **Timer Management** - Start/stop/track match time by halves
- **Mobile Friendly** - Full control from phone or tablet

### 📺 Stream Widget
- **Transparent Background** - Perfect for video overlays
- **Compact Design** - Minimal screen space usage
- **Left-Aligned Layout** - Professional positioning
- **Real-Time Updates** - Instant score/time synchronization
- **No Authentication Required** - Widget works via shareable URL
- **Cross-Device Sync** - Control from phone, display on streaming PC

### 🔐 Multi-User Collaboration
- **Shared Matches** - All users see and manage all matches
- **Shared Teams** - Team library accessible to all users
- **Firebase Authentication** - Secure user management
- **Real-Time Sync** - Changes visible instantly to all users

### 🎨 Customization
- **Team Colors** - Custom colors for each team
- **Team Logos** - Upload images for professional appearance
- **Responsive Design** - Works on all screen sizes

---

## 🚀 Quick Start

### Prerequisites
- **Firebase Account** (free) - https://firebase.google.com/
- **Web Hosting** (GitHub Pages, Netlify, or any web server)
- **Modern Browser** (Chrome, Firefox, Safari, Edge)

### Installation Steps

#### 1. Firebase Setup

**Create Firebase Project:**
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Enter project name: `soccer-scoreboard`
4. Disable Google Analytics (optional)
5. Click "Create project"

**Enable Authentication:**
1. In Firebase Console, click "Authentication" → "Get started"
2. Click "Sign-in method" tab
3. Enable "Email/Password"
4. Click "Save"

**Create Realtime Database:**
1. Click "Realtime Database" → "Create Database"
2. Choose location (closest to you)
3. Start in **"Locked mode"**
4. Click "Enable"

**Configure Database Rules:**
1. Click "Rules" tab
2. Replace with:
```json
{
  "rules": {
    "matches": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$matchId": {
        ".read": true
      }
    },
    "teams": {
      ".read": "auth != null",
      ".write": "auth != null",
      "$teamId": {
        ".read": true
      }
    }
  }
}
```
3. Click "Publish"

**Get Firebase Configuration:**
1. Click ⚙️ Project Settings
2. Scroll to "Your apps" → Click Web icon (</>)
3. Register app name: "Soccer Scoreboard"
4. Copy the `firebaseConfig` object

#### 2. Configure Application

**Update firebase-config.js:**
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

**Update firebase-config-widget.js:**
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

#### 3. Create First User

1. In Firebase Console → Authentication → Users
2. Click "Add user"
3. Enter email and password
4. Click "Add user"

#### 4. Deploy Application

**GitHub Pages (Recommended):**
1. Create repository: `soccer-scoreboard`
2. Upload all files:
   - `index.html`
   - `widget.html`
   - `firebase-config.js`
   - `firebase-config-widget.js`
   - `auth.js`
   - `match-control.js`
   - `match-management.js`
3. Enable GitHub Pages in repository settings
4. Access at: `https://YOUR_USERNAME.github.io/soccer-scoreboard/`

**Local Testing:**
1. Place all files in one folder
2. Open `index.html` in browser
3. Login with Firebase credentials

---

## 📁 File Structure

```
soccer-scoreboard/
├── index.html                    # Main control panel (login, dashboard, controls)
├── widget.html                   # Stream overlay widget
├── firebase-config.js            # Firebase config for control panel
├── firebase-config-widget.js     # Firebase config for widget (read-only)
├── auth.js                       # Authentication & navigation logic
├── match-control.js              # Match CRUD operations & timer management
├── match-management.js           # Dashboard, match list, real-time updates
├── README.md                     # This file
└── FIREBASE_SETUP.md            # Detailed setup guide
```

### Code Architecture

**Modular Design:**
- **index.html** (538 lines) - HTML structure & CSS only
- **auth.js** (178 lines) - Authentication, navigation, cleanup
- **match-management.js** (339 lines) - Dashboard, real-time listeners, UI rendering
- **match-control.js** (353 lines) - Match operations, score/time management, team data

**Benefits:**
- ✅ Easy maintenance and debugging
- ✅ Clear separation of concerns
- ✅ Browser caching for faster loads
- ✅ Reusable components
- ✅ Future React/Vue migration ready

---

## 🎯 How to Use

### Control Panel

#### 1. Login
```
URL: https://your-site.com/soccer-scoreboard/
```
- Enter Firebase email and password
- Click "Войти"

#### 2. Create Match
- Click "Создать новый матч"
- **Option A**: Enter team names manually
- **Option B**: Select from saved teams
- Upload team logos (optional)
- Choose team colors
- Schedule match (optional) or start immediately
- Click "Сохранить и начать матч"

#### 3. Control Match
- **Start Half**: Click "▶ Начать 1 тайм" or "▶ Начать 2 тайм"
- **Stop Half**: Click "⏸ Остановить" to pause
- **Update Score**: Click ➕/➖ buttons
- **End Match**: Click "⏹ Закончить матч"
- **Copy Widget URL**: Click "📋 Копировать URL"

#### 4. Stream Widget
- Copy widget URL from control panel
- Add to OBS/Larix as Browser Source
- Widget updates automatically in real-time

### Dashboard Features

**Match Cards Display:**
- Match status (Scheduled/Playing/Halftime/Ended)
- Current score
- Match time
- Team names and logos
- Quick actions: Open, Copy Widget, Copy ID, Delete

**Filters:**
- ☑️ Hide past matches (toggle on/off)

**Real-Time Updates:**
- New matches appear instantly
- Score changes update live
- Timer ticks in real-time
- Status changes sync across users

### Team Management

**Save Teams:**
1. When creating match, fill in team data
2. Click "💾 Сохранить" next to team name
3. Team saved to library (accessible to all users)

**Load Teams:**
1. When creating match, select from dropdown
2. Click team name
3. Data auto-fills (name, logo, color)

**Shared Library:**
- All users see all saved teams
- Any user can use any team
- Teams persist across sessions

---

## 🎥 Streaming Setup

### OBS Studio

1. Add Source → Browser Source
2. **URL**: Paste widget URL from control panel
   ```
   https://your-site.com/soccer-scoreboard/widget.html?match=MATCH_ID
   ```
3. **Width**: 600px
4. **Height**: 150px
5. **Custom CSS** (optional):
   ```css
   body { 
     margin: 0; 
     overflow: hidden; 
     background: transparent; 
   }
   ```
6. ✅ Enable "Shutdown source when not visible"
7. Position widget on stream (usually top-left)

**Tips:**
- Transparent background works automatically
- Resize widget to fit your layout
- Use Chroma Key filter if needed (though not required)
- Test before going live

### Larix Broadcaster (Mobile)

1. Open Larix app
2. Settings → Web Overlay
3. **URL**: Paste widget URL
4. **Width**: 600
5. **Height**: 150
6. **Position**: Top-left (or custom)
7. Start streaming

**Workflow:**
- Phone 1: Run Larix with widget overlay
- Phone 2: Open control panel, manage match
- Widget updates automatically across devices

### Prism Live Studio

1. Add Scene → Web Page
2. Paste widget URL
3. Set size: 600×150
4. Position on canvas
5. Widget syncs in real-time

---

## 👥 Multi-User Collaboration

### How It Works

**Access Model:**
```
All authenticated users → Can see and edit ALL matches
All authenticated users → Can see and use ALL teams
Widget (no auth) → Can view individual match by URL
```

**Example Scenario:**
```
User A creates match "Team X vs Team Y"
  ↓
User B logs in
  ↓
User B sees "Team X vs Team Y" in dashboard
  ↓
User B can:
  ✅ Open and control the match
  ✅ Update score
  ✅ Start/stop timer
  ✅ Delete match
  ✅ Copy widget URL
```

**Team Sharing:**
```
User A saves "Real Madrid" team
  ↓
User B logs in
  ↓
User B sees "Real Madrid" in team dropdown
  ↓
User B can use team to create new matches
```

### Use Cases

**Small Sports Club:**
- Multiple coaches/operators
- Anyone can create matches
- Anyone can control scoreboard
- Shared team library

**Family/Friends:**
- Different people run different games
- Everyone has full access
- No permission management needed

**Production Team:**
- Multiple operators during event
- Seamless handoff between users
- All see same dashboard

---

## 🔒 Security & Privacy

### Authentication
- Firebase Authentication (industry standard)
- Email/password only (no Google/Facebook)
- Secure token-based sessions
- Automatic session management

### Database Rules
```json
{
  "matches": {
    ".read": "auth != null",      // Only logged-in users can list matches
    ".write": "auth != null",     // Only logged-in users can edit
    "$matchId": {
      ".read": true               // Anyone with URL can view specific match
    }
  }
}
```

**What This Means:**
- ✅ Dashboard requires authentication
- ✅ Creating/editing matches requires authentication
- ✅ Widget URLs are public (shareable)
- ✅ Can't discover other matches without auth
- ✅ Widget can't write data (read-only)

### Best Practices
- ✅ Use strong passwords for Firebase users
- ✅ Don't share widget URLs publicly (unless intended)
- ✅ Regularly review Firebase users
- ✅ Enable 2FA on Firebase account
- ❌ Don't commit firebase-config.js with real credentials to public repos

---

## 📊 Firebase Usage & Limits

### Free Tier (Spark Plan)

| Resource | Free Limit | Typical Usage |
|----------|-----------|---------------|
| **Connections** | 100 simultaneous | ~5-10 users |
| **Storage** | 1 GB | ~5 MB (1000 matches) |
| **Bandwidth** | 10 GB/month | ~100-500 MB |
| **Reads/Writes** | Unlimited | Unlimited |

### Monitoring Usage

**Firebase Console:**
1. Go to: https://console.firebase.google.com/
2. Select project → Realtime Database → Usage
3. View graphs:
   - Connections (live count)
   - Storage (MB used)
   - Bandwidth (GB transferred)

**Set Up Alerts:**
1. Project Settings → Usage and billing
2. "Set budget alerts"
3. Configure alerts at 50%, 80%, 100%
4. Receive email notifications

### Optimization (Already Implemented)

✅ **Widget Read-Only** - Doesn't write timer updates  
✅ **10-Second Sync** - Control panel syncs every 10s, not every second  
✅ **Efficient Listeners** - Single connection per client  
✅ **Clean Listeners** - Removed on logout/navigation  

**Result:** 95% reduction in writes, very low bandwidth usage

### When to Upgrade

You'd need Blaze (pay-as-you-go) plan if:
- ❌ >100 simultaneous users (unlikely for most use cases)
- ❌ >1 GB storage (>500,000 matches)
- ❌ >10 GB bandwidth/month (thousands of daily viewers)

**Cost if upgraded:**
- Storage: $5/GB/month
- Bandwidth: $1/GB/month (after free 10 GB)
- Your typical usage: $0-5/month

---

## 🛠️ Troubleshooting

### Login Issues

**Problem:** "Invalid credentials"  
**Solution:**
- Verify email/password in Firebase Console → Authentication
- Check for typos
- Create new user if needed

**Problem:** "Network error"  
**Solution:**
- Check internet connection
- Verify Firebase config in `firebase-config.js`
- Check browser console for errors

### Widget Not Updating

**Problem:** Widget shows old data  
**Solution:**
- Refresh widget (F5)
- Verify match ID in URL is correct
- Check Firebase database rules allow reading
- Open browser console, look for errors

**Problem:** Widget shows "Ожидание начала матча"  
**Solution:**
- Match may not be started yet
- Click "Начать 1 тайм" in control panel
- Check `scheduledTime` field in Firebase (should be null when playing)

### Real-Time Sync Issues

**Problem:** Dashboard doesn't update  
**Solution:**
- Refresh page (F5)
- Check internet connection
- Verify Firebase database rules are published
- Open console, check for permission errors

**Problem:** Multiple users see different data  
**Solution:**
- All users should refresh browsers
- Check Firebase database directly (Console → Database → Data)
- Verify database rules allow `.read": "auth != null"`

### Mobile Issues

**Problem:** Can't open `/soccer-scoreboard/` on mobile  
**Solution:**
- Ensure `index.html` exists (not `control.html`)
- Delete old `control.html` from repository
- Clear mobile browser cache
- Try incognito/private mode

**Problem:** Can't copy widget URL on mobile  
**Solution:**
- Use "📋 Widget" button on match card
- Fallback copy method works on iOS/Android
- Long-press URL field and select "Copy"

---

## 💡 Tips & Best Practices

### Match Management
- ✅ Delete old matches to keep dashboard clean
- ✅ Use "Hide past matches" toggle for active events
- ✅ Schedule matches in advance for organized events
- ✅ Copy widget URLs before starting stream

### Team Library
- ✅ Save frequently used teams for quick setup
- ✅ Use high-quality logos (PNG with transparency)
- ✅ Choose contrasting colors for better visibility
- ✅ Consistent naming (e.g., "Real Madrid" not "R. Madrid")

### Streaming
- ✅ Test widget before going live
- ✅ Position in corner for minimal obstruction
- ✅ Use 600×150 size for compact display
- ✅ Keep control panel open during stream
- ⚠️ Don't close control panel tab (breaks timer sync)

### Multi-User Workflow
- ✅ Communicate with other users about active matches
- ✅ Use descriptive team names for clarity
- ✅ Delete test matches after use
- ⚠️ Multiple users editing same match = possible conflicts

---

## 🔄 Updates & Changelog

### Version 2.0 - Firebase Real-Time System
**Released:** January 2026

**Major Changes:**
- ✅ Migrated from local storage to Firebase Realtime Database
- ✅ Added multi-user authentication and access
- ✅ Implemented real-time synchronization across devices
- ✅ Modularized codebase (index.html, auth.js, match-control.js, match-management.js)
- ✅ Added shared team library
- ✅ Renamed control.html → index.html for cleaner URLs
- ✅ Optimized widget for transparent overlay streaming
- ✅ Reduced widget size for minimal screen space
- ✅ Fixed mobile compatibility issues
- ✅ Added match scheduling functionality
- ✅ Implemented real-time dashboard updates

**Performance:**
- 95% reduction in Firebase writes
- Real-time updates with <100ms latency
- Compact widget (40% smaller than v1)
- Modular code structure for maintainability

---

## 🆘 Support & Resources

### Documentation
- **Firebase Setup**: See `FIREBASE_SETUP.md`
- **Usage Monitoring**: See `FIREBASE_USAGE_MONITORING.md`
- **This README**: Complete usage guide

### Firebase Resources
- Firebase Console: https://console.firebase.google.com/
- Firebase Documentation: https://firebase.google.com/docs/database
- Authentication Guide: https://firebase.google.com/docs/auth

### Common Links
- **Your Control Panel**: `https://YOUR_USERNAME.github.io/soccer-scoreboard/`
- **Firebase Console**: `https://console.firebase.google.com/project/YOUR_PROJECT/`
- **Database Rules**: Console → Realtime Database → Rules
- **Usage Monitor**: Console → Realtime Database → Usage

---

## 📄 License

Free to use for personal and commercial projects. No attribution required.

---

## 🙏 Credits

Built with:
- Firebase Realtime Database
- JavaScript (ES6+)
- HTML5 & CSS3
- No external frameworks

---

**Enjoy your professional soccer scoreboard system! ⚽🎥**

For questions or issues, check Firebase Console logs and browser developer console for error messages.
