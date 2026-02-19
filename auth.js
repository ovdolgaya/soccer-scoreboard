// ========================================
// GLOBAL VARIABLES
// ========================================
let matchId = null;
let currentHalf = 0;
let team1Logo = null;
let team2Logo = null;
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
        if (!document.getElementById('controlPanel').classList.contains('active') && 
            !document.getElementById('setupForm').classList.contains('active')) {
            showDashboard();
        }
    } else {
        // Hide nav when logged out
        if (typeof renderNav === 'function') renderNav(null);
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
            document.getElementById('passwordForm').classList.add('active');
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
            if (e.key === 'Enter') {
                loginUser();
            }
        });
    }
    
    if (emailInput) {
        emailInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                document.getElementById('passwordInput').focus();
            }
        });
    }

    // Setup image preview handlers
    const team1LogoInput = document.getElementById('team1Logo');
    const team2LogoInput = document.getElementById('team2Logo');
    
    if (team1LogoInput) {
        team1LogoInput.addEventListener('change', function(e) {
            previewImage(e.target, 'team1Preview');
        });
    }
    
    if (team2LogoInput) {
        team2LogoInput.addEventListener('change', function(e) {
            previewImage(e.target, 'team2Preview');
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
    document.getElementById('setupForm').classList.remove('active');
    document.getElementById('controlPanel').classList.remove('active');
}

function showDashboard() {
    hideAllViews();
    document.getElementById('dashboard').classList.add('active');
    loadMatches();
}

function showSetupForm() {
    hideAllViews();
    document.getElementById('setupForm').classList.add('active');
    loadSavedTeams();
}

function backToDashboard() {
    showDashboard();
}

// ========================================
// IMAGE PREVIEW
// ========================================

function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    const file = input.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            if (previewId === 'team1Preview') {
                team1Logo = e.target.result;
            } else {
                team2Logo = e.target.result;
            }
        };
        reader.readAsDataURL(file);
    }
}

// ========================================
// CLEANUP
// ========================================

function clearMatchLocal() {
    clearSetupForm();
    
    matchId = null;
    currentHalf = 0;

    // Reset display
    const score1 = document.getElementById('score1');
    const score2 = document.getElementById('score2');
    if (score1) score1.textContent = '0';
    if (score2) score2.textContent = '0';

    // Reset buttons
    document.getElementById('startHalf1Btn').classList.remove('hidden');
    document.getElementById('stopHalf1Btn').classList.add('hidden');
    document.getElementById('startHalf2Btn').classList.add('hidden');
    document.getElementById('stopHalf2Btn').classList.add('hidden');
    document.getElementById('endMatchBtn').classList.add('hidden');
}
