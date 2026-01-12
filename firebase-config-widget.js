// ========================================
// FIREBASE CONFIGURATION FOR WIDGET
// ========================================
// This is a simplified version for the widget that only needs database access

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

// Initialize only database (no auth needed for widget)
const database = firebase.database();
