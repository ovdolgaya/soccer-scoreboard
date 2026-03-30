// ========================================
// GLOBAL VARIABLES
// ========================================
let matchId = null;
let currentHalf = 0;
let currentUser = null;
let matchListListener = null; // For real-time dashboard updates

// ========================================
// AUTHENTICATION
// ========================================

// Check if user is already logged in
auth.onAuthStateChanged(function(user) {
    if (user) {
        currentUser = user;
        // Render the shared nav bar (from nav.js)
        if (typeof renderNav === 'function') renderNav(user);
        // Show the floating page title
        const pt = document.getElementById('pageTitle');
        if (pt) pt.style.display = 'flex';
        // Show dashboard if not already in control panel
        const cp = document.getElementById('controlPanel');
        if (!cp || !cp.classList.contains('active')) {
            showDashboard();
        }
    } else {
        // Hide nav when logged out
        if (typeof renderNav === 'function') renderNav(null);
        // Show login form only now — avoids flash on load for logged-in users
        const pf = document.getElementById('passwordForm');
        if (pf) { pf.style.visibility = ''; pf.classList.add('active'); }
    }
});

function loginUser() {
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const errorDiv = document.getElementById('loginError');
    const loadingDiv = document.getElementById('loginLoading');

    if (!email || !password) {
        errorDiv.textContent = 'Введите email и пароль';
        errorDiv.style.display = 'block';
        return;
    }

    errorDiv.style.display = 'none';
    loadingDiv.style.display = 'block';

    auth.signInWithEmailAndPassword(email, password)
        .then(function(userCredential) {
            currentUser = userCredential.user;
            loadingDiv.style.display = 'none';
            showDashboard();
        })
        .catch(function(error) {
            loadingDiv.style.display = 'none';
            errorDiv.textContent = 'Ошибка: ' + error.message;
            errorDiv.style.display = 'block';
        });
}

function logoutUser() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        auth.signOut().then(function() {
            // Reset everything
            clearMatchLocal();
            hideAllViews();
            const pf = document.getElementById('passwordForm'); if (pf) { pf.style.visibility = ''; pf.classList.add('active'); }
            document.getElementById('emailInput').value = '';
            document.getElementById('passwordInput').value = '';
        });
    }
}

// Allow Enter key to submit login
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('passwordInput');
    const emailInput = document.getElementById('emailInput');

    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') loginUser();
        });
    }

    if (emailInput) {
        emailInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') document.getElementById('passwordInput').focus();
        });
    }
});

// ========================================
// NAVIGATION
// ========================================

function hideAllViews() {
    // Clean up match list listener when leaving dashboard
    if (matchListListener && database) {
        database.ref('matches').off('value', matchListListener);
        matchListListener = null;
    }

    document.getElementById('passwordForm').classList.remove('active');
    document.getElementById('dashboard').classList.remove('active');
    document.getElementById('controlPanel').classList.remove('active');
}

function showDashboard() {
    hideAllViews();
    document.getElementById('dashboard').classList.add('active');
    loadMatches();
}

function backToDashboard() {
    showDashboard();
}

// ========================================
// CLEANUP
// ========================================

function clearMatchLocal() {
    matchId = null;
    currentHalf = 0;

    // Reset score display
    const score1 = document.getElementById('score1');
    const score2 = document.getElementById('score2');
    if (score1) score1.textContent = '0';
    if (score2) score2.textContent = '0';

    // Reset half buttons
    const s1 = document.getElementById('startHalf1Btn');
    const p1 = document.getElementById('stopHalf1Btn');
    const s2 = document.getElementById('startHalf2Btn');
    const p2 = document.getElementById('stopHalf2Btn');
    const em = document.getElementById('endMatchBtn');
    if (s1) s1.classList.remove('hidden');
    if (p1) p1.classList.add('hidden');
    if (s2) s2.classList.add('hidden');
    if (p2) p2.classList.add('hidden');
    if (em) em.classList.add('hidden');
}
