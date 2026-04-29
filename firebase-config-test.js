// ========================================
// FIREBASE CONFIGURATION
// ========================================
// REPLACE THIS WITH YOUR FIREBASE CONFIG FROM FIREBASE CONSOLE
// Get your config from: Firebase Console → Project Settings → Your apps → Web app

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
const auth = firebase.auth();
const database = firebase.database();
