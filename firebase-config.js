// ========================================
// FIREBASE CONFIGURATION
// ========================================
// REPLACE THIS WITH YOUR FIREBASE CONFIG FROM FIREBASE CONSOLE
// Get your config from: Firebase Console → Project Settings → Your apps → Web app

const firebaseConfig = {
  apiKey: "AIzaSyABbacrWMxQzL8gmPQ3NxX6XOCW1HwMjNQ",
  authDomain: "scoreboard-684b8.firebaseapp.com",
  databaseURL: "https://scoreboard-684b8-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "scoreboard-684b8",
  storageBucket: "scoreboard-684b8.firebasestorage.app",
  messagingSenderId: "730776664146",
  appId: "1:730776664146:web:02f8847ab8b843a30d078b"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();
