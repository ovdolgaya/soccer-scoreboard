// ============================================
// SHARED NAVIGATION BAR
// ============================================
// Include this file in every app page (index.html, roster.html, championships.html).
// Call renderNav() once the DOM is ready — it injects the nav bar at the top of <body>.
// Expects `auth` and `database` to be available from firebase-config.js.

(function () {

    // ── Styles injected once ──────────────────────────────────────────────────
    const CSS = `
        #appNav {
            position: sticky;
            top: 0;
            z-index: 500;
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            box-shadow: 0 2px 12px rgba(0,0,0,0.25);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        #appNav .nav-inner {
            max-width: 960px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            gap: 0;
            padding: 0 20px;
            height: 56px;
        }

        /* Brand / Logo */
        #appNav .nav-brand {
            font-size: 20px;
            font-weight: 800;
            color: white;
            text-decoration: none;
            margin-right: 24px;
            letter-spacing: -0.3px;
            white-space: nowrap;
        }

        /* Nav links */
        #appNav .nav-links {
            display: flex;
            align-items: center;
            gap: 4px;
            flex: 1;
        }

        #appNav .nav-link {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            color: rgba(255,255,255,0.82);
            text-decoration: none;
            font-size: 14px;
            font-weight: 600;
            padding: 6px 14px;
            border-radius: 8px;
            transition: all 0.18s ease;
            white-space: nowrap;
        }

        #appNav .nav-link:hover {
            color: white;
            background: rgba(255,255,255,0.15);
        }

        #appNav .nav-link.active {
            color: white;
            background: rgba(255,255,255,0.22);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.3);
        }

        /* Right section: user info + dropdown */
        #appNav .nav-user {
            display: flex;
            align-items: center;
            gap: 10px;
            position: relative;
        }

        #appNav .nav-user-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.25);
            color: white;
            padding: 6px 14px 6px 10px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: all 0.18s ease;
        }

        #appNav .nav-user-btn:hover {
            background: rgba(255,255,255,0.25);
        }

        #appNav .nav-avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(255,255,255,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: 700;
            color: white;
            flex-shrink: 0;
        }

        #appNav .nav-chevron {
            font-size: 10px;
            opacity: 0.75;
            transition: transform 0.2s;
        }

        #appNav .nav-dropdown {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            background: white;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            min-width: 200px;
            overflow: hidden;
            display: none;
            z-index: 600;
        }

        #appNav .nav-dropdown.open {
            display: block;
            animation: navDropIn 0.15s ease;
        }

        @keyframes navDropIn {
            from { opacity: 0; transform: translateY(-6px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        #appNav .nav-dropdown-header {
            padding: 12px 16px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
        }

        #appNav .nav-dropdown-email {
            font-size: 12px;
            color: #64748b;
            word-break: break-all;
        }

        #appNav .nav-dropdown-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 11px 16px;
            font-size: 14px;
            font-weight: 500;
            color: #334155;
            cursor: pointer;
            transition: background 0.15s;
            border: none;
            background: none;
            width: 100%;
            text-align: left;
            text-decoration: none;
        }

        #appNav .nav-dropdown-item:hover {
            background: #f1f5f9;
        }

        #appNav .nav-dropdown-item.danger {
            color: #ef4444;
        }

        #appNav .nav-dropdown-item.danger:hover {
            background: #fef2f2;
        }

        #appNav .nav-divider {
            height: 1px;
            background: #e2e8f0;
            margin: 4px 0;
        }

        /* Env toggle */
        #appNav .nav-env-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            font-size: 13px;
            font-weight: 600;
            color: #475569;
        }

        #appNav .nav-env-label {
            display: flex;
            align-items: center;
            gap: 7px;
        }

        #appNav .nav-env-badge {
            display: inline-block;
            background: #fef9c3;
            color: #854d0e;
            font-size: 10px;
            font-weight: 800;
            padding: 1px 6px;
            border-radius: 4px;
            letter-spacing: .04em;
        }

        #appNav .nav-env-badge.prod {
            background: #dcfce7;
            color: #166534;
        }

        /* Toggle switch */
        #appNav .nav-toggle {
            position: relative;
            width: 40px;
            height: 22px;
            flex-shrink: 0;
        }

        #appNav .nav-toggle input {
            opacity: 0;
            width: 0;
            height: 0;
            position: absolute;
        }

        #appNav .nav-toggle-track {
            position: absolute;
            inset: 0;
            border-radius: 11px;
            background: #cbd5e1;
            cursor: pointer;
            transition: background 0.2s;
        }

        #appNav .nav-toggle-track::after {
            content: '';
            position: absolute;
            left: 3px;
            top: 3px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: white;
            transition: transform 0.2s;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }

        #appNav .nav-toggle input:checked + .nav-toggle-track {
            background: #f59e0b;
        }

        #appNav .nav-toggle input:checked + .nav-toggle-track::after {
            transform: translateX(18px);
        }

        /* TEST indicator in nav bar */
        #appNav .nav-test-badge {
            background: #fef08a;
            color: #713f12;
            font-size: 11px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 5px;
            letter-spacing: .05em;
            margin-left: 8px;
        }

        /* Hidden until logged in */
        #appNav.nav-hidden {
            display: none;
        }

        /* Mobile — links move into dropdown */
        #appNav .nav-dropdown-link { display: none; }

        @media (max-width: 600px) {
            #appNav .nav-inner  { padding: 0 12px; }
            #appNav .nav-brand  { font-size: 16px; margin-right: 0; flex: 1; }
            #appNav .nav-links  { display: none; }
            #appNav .nav-dropdown-link { display: flex; }
        }
    `;

    function injectStyles() {
        if (document.getElementById('appNavStyles')) return;
        const style = document.createElement('style');
        style.id = 'appNavStyles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    // ── Detect current page ───────────────────────────────────────────────────
    function currentPage() {
        const path = window.location.pathname;
        if (path.includes('roster'))          return 'roster';
        if (path.includes('championships'))   return 'championships';
        return 'matches';   // index.html or /
    }

    function link(href, icon, label, page) {
        const active = currentPage() === page ? ' active' : '';
        return `<a href="${href}" class="nav-link${active}"><i class="${icon}"></i>${label}</a>`;
    }

    // ── Build HTML ────────────────────────────────────────────────────────────
    function buildNav(user) {
        const emailInitial = user && user.email ? user.email[0].toUpperCase() : '?';
        const email = user ? user.email : '';

        return `
        <div class="nav-inner">
            <a class="nav-brand" href="index.html">⚽ Scoreboard</a>
            <span class="nav-test-badge" id="navTestBadge" style="display:none;">TEST</span>

            <nav class="nav-links">
                ${link('index.html',         'fas fa-futbol',    'Матчи',       'matches')}
                ${link('roster.html',        'fas fa-users',     'Команда',     'roster')}
                ${link('championships.html', 'fas fa-trophy',    'Чемпионаты',  'championships')}
            </nav>

            <div class="nav-user">
                <button class="nav-user-btn" id="navUserBtn" onclick="toggleNavDropdown(event)">
                    <div class="nav-avatar">${emailInitial}</div>
                    <span class="nav-chevron">▼</span>
                </button>

                <div class="nav-dropdown" id="navDropdown">
                    <div class="nav-dropdown-header">
                        <div class="nav-dropdown-email">${email}</div>
                    </div>
                    <a class="nav-dropdown-item nav-dropdown-link" href="index.html">
                        <i class="fas fa-futbol"></i> Матчи
                    </a>
                    <a class="nav-dropdown-item nav-dropdown-link" href="roster.html">
                        <i class="fas fa-users"></i> Команда
                    </a>
                    <a class="nav-dropdown-item nav-dropdown-link" href="championships.html">
                        <i class="fas fa-trophy"></i> Чемпионаты
                    </a>
                    <div class="nav-divider"></div>
                    <div class="nav-env-row">
                        <span class="nav-env-label">
                            <i class="fas fa-database"></i>
                            База данных:
                            <span class="nav-env-badge" id="navEnvBadge">PROD</span>
                        </span>
                        <label class="nav-toggle" title="Переключить на тестовую базу">
                            <input type="checkbox" id="navEnvToggle" onchange="navToggleEnv(this.checked)">
                            <span class="nav-toggle-track"></span>
                        </label>
                    </div>
                    <div class="nav-divider"></div>
                    <button class="nav-dropdown-item danger" onclick="navLogout()">
                        <i class="fas fa-sign-out-alt"></i> Выйти
                    </button>
                </div>
            </div>
        </div>`;
    }

    // ── Render ────────────────────────────────────────────────────────────────
    window.renderNav = function (user) {
        injectStyles();

        let nav = document.getElementById('appNav');
        if (!nav) {
            nav = document.createElement('nav');
            nav.id = 'appNav';
            document.body.insertBefore(nav, document.body.firstChild);
        }

        if (!user) {
            nav.classList.add('nav-hidden');
            return;
        }

        nav.classList.remove('nav-hidden');
        nav.innerHTML = buildNav(user);

        // Init env toggle state
        const env = localStorage.getItem('fcEnv') || 'prod';
        const toggle = document.getElementById('navEnvToggle');
        const badge  = document.getElementById('navEnvBadge');
        const testBadge = document.getElementById('navTestBadge');
        if (toggle) toggle.checked = (env === 'test');
        if (badge)  {
            badge.textContent = env === 'test' ? 'TEST' : 'PROD';
            badge.className   = 'nav-env-badge' + (env === 'test' ? '' : ' prod');
        }
        if (testBadge) testBadge.style.display = env === 'test' ? 'inline-block' : 'none';
    };

    // ── Dropdown toggle ───────────────────────────────────────────────────────
    window.toggleNavDropdown = function (e) {
        e.stopPropagation();
        const dd = document.getElementById('navDropdown');
        if (dd) dd.classList.toggle('open');
    };

    // Close dropdown on outside click
    document.addEventListener('click', function () {
        const dd = document.getElementById('navDropdown');
        if (dd) dd.classList.remove('open');
    });

    // ── Env toggle ───────────────────────────────────────────────────────────
    window.navToggleEnv = function (isTest) {
        localStorage.setItem('fcEnv', isTest ? 'test' : 'prod');
        // Reload so Firebase re-initializes with the correct config
        window.location.reload();
    };

    // ── Logout ────────────────────────────────────────────────────────────────
    window.navLogout = function () {
        if (!confirm('Вы уверены, что хотите выйти?')) return;
        if (typeof auth !== 'undefined') {
            auth.signOut().then(function () {
                window.location.href = 'index.html';
            });
        }
    };

})();
