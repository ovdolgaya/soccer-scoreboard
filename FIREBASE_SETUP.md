# 🔥 Firebase Setup Instructions

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name it: "soccer-scoreboard" (or any name you like)
4. Disable Google Analytics (not needed)
5. Click "Create project"

## Step 2: Enable Realtime Database

1. In left menu, click "Build" → "Realtime Database"
2. Click "Create Database"
3. Choose location closest to you
4. Start in **"test mode"** (we'll secure it later)
5. Click "Enable"

## Step 3: Enable Authentication

1. In left menu, click "Build" → "Authentication"
2. Click "Get started"
3. Click "Email/Password" 
4. Enable the first toggle (Email/Password)
5. Click "Save"

## Step 4: Create Your User Account

1. Click "Users" tab
2. Click "Add user"
3. Enter your email and password
4. Click "Add user"

## Step 5: Get Firebase Configuration

1. Click the gear icon (⚙️) next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the Web icon `</>`
5. Register app name: "scoreboard"
6. You'll see configuration code like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

7. **COPY THIS** - you'll need it in the next step!

## Step 6: Update control.html

Open `control.html` and find this section near the top of the `<script>` tag:

```javascript
// REPLACE THIS WITH YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

Replace it with YOUR configuration from Step 5.

## Step 7: Update widget.html

Do the same for `widget.html` - replace the Firebase config with YOUR configuration.

## Step 8: Secure Your Database (IMPORTANT!)

1. Go back to Firebase Console → Realtime Database
2. Click "Rules" tab
3. Replace the rules with this:

```json
{
  "rules": {
    "matches": {
      "$matchId": {
        ".read": "auth != null && (data.child('createdBy').val() === auth.uid || !data.exists())",
        ".write": "auth != null && (!data.exists() || data.child('createdBy').val() === auth.uid)"
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

4. Click "Publish"

This means:
- Anyone can READ matches (for the widget)
- Only authenticated users can WRITE (create/update matches)
- Authenticated users can read/write their teams
- Individual teams can be read by anyone (for loading team data)

## ✅ Done!

Now your app will:
- ✅ Use Firebase Authentication (secure login with email/password)
- ✅ Store match data in cloud (works across all devices)
- ✅ No password visible in code
- ✅ Real-time sync

## 🔐 Security Benefits:

1. **No password in code** - Firebase Authentication handles it
2. **Your email/password** - Only you know it, stored securely by Google
3. **API keys are safe** - Firebase API keys are meant to be public
4. **Database rules** - Only authenticated users can modify data
5. **Can manage users** - Add/remove users from Firebase Console

## 💡 Important Notes:

- Firebase API keys in code are SAFE - they're designed to be public
- Real security comes from Firebase Authentication + Database Rules
- You can change your password anytime in Firebase Console
- Free tier: 100 simultaneous connections, 1GB storage (way more than you need)
