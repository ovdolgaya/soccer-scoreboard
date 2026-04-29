// ========================================
// FIREBASE CONFIGURATION FOR WIDGET
// ========================================
// This is a simplified version for the widget that only needs database access

const firebaseConfig = {
  apiKey: "AIzaSyCiJ9hVszKWjjTobFJadSgikTxHfdGCjsc",
  authDomain: "soccer-scoreboard-test.firebaseapp.com",
  databaseURL: "https://soccer-scoreboard-test-default-rtdb.firebaseio.com",
  projectId: "soccer-scoreboard-test",
  storageBucket: "soccer-scoreboard-test.firebasestorage.app",
  messagingSenderId: "118838393064",
  appId: "1:118838393064:web:824a7244f532a4e807f15d"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize only database (no auth needed for widget)
const database = firebase.database();
