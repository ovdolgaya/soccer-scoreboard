// ============================================
// MATCH EDIT / CREATE MODAL
// Handles both creating a new match (matchId=null)
// and editing an existing one (matchId=string).
// Teams and championships are selected from saved lists only.
// ============================================

(function () {

    function injectModal() {
        if (document.getElementById('matchEditModal')) return;
        const el = document.createElement('div');
        el.innerHTML = `
<div id="matchEditModal" style="display:none; position:fixed; inset:0; z-index:2000;
     background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); overflow-y:auto;">
  <div style="min-height:100%; display:flex; align-items:flex-start; justify-content:center; padding:20px;">
    <div style="background:#fff; border-radius:20px; width:100%; max-width:480px;
                overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.3); margin:auto;">

      <div style="background:linear-gradient(135deg,#08399A,#1e5fd4); padding:20px 24px; color:#fff;
                  display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:12px; opacity:.8; text-transform:uppercase; letter-spacing:.08em; margin-bottom:3px;" id="editModalSubtitle">Новый матч</div>
          <h2 style="margin:0; font-size:18px; font-weight:700; color:#fff;" id="editModalTitle">Создать матч</h2>
        </div>
        <button onclick="closeMatchEditModal()"
                style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:36px; height:36px;
                       border-radius:50%; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>
      </div>

      <div style="padding:20px; display:flex; flex-direction:column; gap:16px;">

        <div>
          <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:6px;">📅 Дата и время матча</label>
          <input type="datetime-local" id="editScheduledTime"
                 style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; box-sizing:border-box;">
          <div style="font-size:12px; color:#94a3b8; margin-top:4px;">Для запланированных матчей</div>
        </div>

        <div>
          <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:6px;">📆 Дата проведения</label>
          <input type="date" id="editMatchDate"
                 style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; box-sizing:border-box;">
        </div>

        <div>
          <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:6px;">🏆 Чемпионат</label>
          <select id="editChampionshipSelect"
                  style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; background:white; box-sizing:border-box;">
            <option value="">— Без чемпионата —</option>
          </select>
          <div style="font-size:12px; color:#94a3b8; margin-top:4px;">
            Управление — <a href="championships.html" style="color:#3b82f6;">Чемпионаты → Управление</a>
          </div>
        </div>

        <div style="border-top:1px solid #f1f5f9;"></div>

        <div>
          <label style="font-size:13px; font-weight:700; color:#08399A; display:block; margin-bottom:8px;">Команда 1</label>
          <select id="editTeam1Select"
                  style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; background:white; box-sizing:border-box;"
                  onchange="editOnTeamSelect(1)">
            <option value="">— Выберите команду —</option>
          </select>
          <div id="editTeam1Preview" style="display:none; margin-top:10px; padding:10px 12px;
               background:#f8fafc; border-radius:10px; align-items:center; gap:10px;">
            <img id="editTeam1Logo" style="width:36px;height:36px;object-fit:contain;border-radius:6px;background:#e2e8f0;padding:2px;">
            <div id="editTeam1ColorDot" style="width:18px;height:18px;border-radius:50%;border:2px solid #e2e8f0;flex-shrink:0;"></div>
            <span id="editTeam1Name" style="font-size:14px;font-weight:600;color:#1e293b;"></span>
          </div>
        </div>

        <div>
          <label style="font-size:13px; font-weight:700; color:#08399A; display:block; margin-bottom:8px;">Команда 2</label>
          <select id="editTeam2Select"
                  style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px; font-size:14px; background:white; box-sizing:border-box;"
                  onchange="editOnTeamSelect(2)">
            <option value="">— Выберите команду —</option>
          </select>
          <div id="editTeam2Preview" style="display:none; margin-top:10px; padding:10px 12px;
               background:#f8fafc; border-radius:10px; align-items:center; gap:10px;">
            <img id="editTeam2Logo" style="width:36px;height:36px;object-fit:contain;border-radius:6px;background:#e2e8f0;padding:2px;">
            <div id="editTeam2ColorDot" style="width:18px;height:18px;border-radius:50%;border:2px solid #e2e8f0;flex-shrink:0;"></div>
            <span id="editTeam2Name" style="font-size:14px;font-weight:600;color:#1e293b;"></span>
          </div>
        </div>

        <div style="font-size:12px; color:#94a3b8;">
          Управление командами — <a href="roster.html" style="color:#3b82f6;">Состав → Команды</a>
        </div>

      </div>

      <div style="padding:16px 20px; border-top:1px solid #f1f5f9; display:flex; gap:10px;">
        <button onclick="closeMatchEditModal()"
                style="flex:1; padding:12px; background:#f1f5f9; color:#64748b; border:none;
                       border-radius:10px; font-size:14px; font-weight:600; cursor:pointer;">Отмена</button>
        <button onclick="saveMatchEdit()" id="editModalSaveBtn"
                style="flex:2; padding:12px; background:linear-gradient(135deg,#08399A,#1e5fd4);
                       color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer;">
          <i class="fas fa-save"></i> Сохранить
        </button>
      </div>

    </div>
  </div>
</div>`;
        document.body.appendChild(el.firstElementChild);
    }

    // ── State ────────────────────────────────────────────────
    let _editingMatchId = null;
    let _teamsCache     = {};

    // ── Open ─────────────────────────────────────────────────
    window.openMatchEditModal = function (matchId) {
        _editingMatchId = matchId;
        const isNew = !matchId;

        document.getElementById('editModalSubtitle').textContent = isNew ? 'Новый матч' : 'Редактирование матча';
        document.getElementById('editModalTitle').textContent    = isNew ? 'Создать матч' : 'Изменить матч';
        document.getElementById('editModalSaveBtn').innerHTML    = isNew
            ? '<i class="fas fa-plus-circle"></i> Создать матч'
            : '<i class="fas fa-save"></i> Сохранить изменения';

        document.getElementById('editScheduledTime').value = '';
        document.getElementById('editMatchDate').value     = '';
        ['1','2'].forEach(function(n) {
            document.getElementById('editTeam' + n + 'Select').value      = '';
            document.getElementById('editTeam' + n + 'Preview').style.display = 'none';
        });

        Promise.all([_loadTeamOptions(), _loadChampOptions()]).then(function() {
            if (!matchId) return;
            database.ref('matches/' + matchId).once('value').then(function(snap) {
                const m = snap.val(); if (!m) return;
                document.getElementById('editModalTitle').textContent =
                    (m.team1Name || '') + ' vs ' + (m.team2Name || '');

                if (m.scheduledTime) {
                    const d   = new Date(m.scheduledTime);
                    const pad = function(n) { return String(n).padStart(2,'0'); };
                    document.getElementById('editScheduledTime').value =
                        d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) +
                        'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
                }
                document.getElementById('editMatchDate').value = m.matchDate || '';
                if (m.championshipTitle)
                    document.getElementById('editChampionshipSelect').value = m.championshipTitle;

                _preselectTeamByName(1, m.team1Name);
                _preselectTeamByName(2, m.team2Name);
            });
        });

        document.getElementById('matchEditModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    window.closeMatchEditModal = function () {
        document.getElementById('matchEditModal').style.display = 'none';
        document.body.style.overflow = '';
        _editingMatchId = null;
    };

    document.addEventListener('click', function(e) {
        const modal = document.getElementById('matchEditModal');
        if (e.target === modal) window.closeMatchEditModal();
    });

    // ── Load dropdowns ────────────────────────────────────────
    function _loadTeamOptions() {
        return database.ref('teams').once('value').then(function(snap) {
            _teamsCache = {};
            const teams = [];
            snap.forEach(function(child) {
                const t = child.val(); t.id = child.key;
                _teamsCache[child.key] = t;
                if (t.isActive !== false) teams.push(t); // only active teams
            });
            teams.sort(function(a,b) { return (a.name||'').localeCompare(b.name||'','ru'); });
            ['editTeam1Select','editTeam2Select'].forEach(function(id) {
                const sel = document.getElementById(id);
                sel.innerHTML = '<option value="">— Выберите команду —</option>';
                teams.forEach(function(t) {
                    const opt = document.createElement('option');
                    opt.value = t.id; opt.textContent = t.name;
                    sel.appendChild(opt);
                });
            });
        });
    }

    function _loadChampOptions() {
        return database.ref('championships').once('value').then(function(snap) {
            const items = [];
            snap.forEach(function(child) {
                const c = child.val();
                if (c.title) items.push(c.title);
            });
            items.sort(function(a,b) { return a.localeCompare(b,'ru'); });
            const sel = document.getElementById('editChampionshipSelect');
            sel.innerHTML = '<option value="">— Без чемпионата —</option>';
            items.forEach(function(title) {
                const opt = document.createElement('option');
                opt.value = title; opt.textContent = title;
                sel.appendChild(opt);
            });
        });
    }

    // ── Team select preview ───────────────────────────────────
    window.editOnTeamSelect = function(teamNum) {
        const teamId  = document.getElementById('editTeam' + teamNum + 'Select').value;
        const preview = document.getElementById('editTeam' + teamNum + 'Preview');
        if (!teamId || !_teamsCache[teamId]) { preview.style.display = 'none'; return; }
        const t = _teamsCache[teamId];
        const logoEl  = document.getElementById('editTeam' + teamNum + 'Logo');
        const colorEl = document.getElementById('editTeam' + teamNum + 'ColorDot');
        const nameEl  = document.getElementById('editTeam' + teamNum + 'Name');
        if (t.logo) { logoEl.src = t.logo; logoEl.style.display = 'inline-block'; }
        else { logoEl.style.display = 'none'; }
        colorEl.style.background = t.color || '#08399A';
        nameEl.textContent = t.name || '';
        preview.style.display = 'flex';
    };

    function _preselectTeamByName(teamNum, name) {
        if (!name) return;
        const found = Object.values(_teamsCache).find(function(t) {
            return (t.name||'').toLowerCase() === (name||'').toLowerCase();
        });
        if (found) {
            document.getElementById('editTeam' + teamNum + 'Select').value = found.id;
            window.editOnTeamSelect(teamNum);
        }
    }

    // ── Save ──────────────────────────────────────────────────
    window.saveMatchEdit = function () {
        const team1Id = document.getElementById('editTeam1Select').value;
        const team2Id = document.getElementById('editTeam2Select').value;
        if (!team1Id || !team2Id) { alert('Пожалуйста, выберите обе команды'); return; }

        const t1 = _teamsCache[team1Id];
        const t2 = _teamsCache[team2Id];

        const updates = {
            team1Name:  t1.name  || '',
            team2Name:  t2.name  || '',
            team1Logo:  t1.logo  || '',
            team2Logo:  t2.logo  || '',
            team1Color: t1.color || '#08399A',
            team2Color: t2.color || '#4A90E2',
            championshipTitle: document.getElementById('editChampionshipSelect').value || ''
        };

        const scheduledRaw = document.getElementById('editScheduledTime').value;
        if (scheduledRaw) {
            const [datePart, timePart] = scheduledRaw.split('T');
            const [year, month, day]   = datePart.split('-').map(Number);
            const [hour, minute]       = (timePart || '00:00').split(':').map(Number);
            const localDate = new Date(year, month - 1, day, hour, minute);
            updates.scheduledTime = localDate.getTime();
            updates.matchDate     = datePart;
        } else {
            updates.scheduledTime = null;
        }

        const matchDateVal = document.getElementById('editMatchDate').value;
        if (matchDateVal) updates.matchDate = matchDateVal;

        // Only recalculate status for matches that haven't started yet.
        // Playing/ended matches keep their current status unchanged.
        const lockedStatuses = ['playing', 'half1_ended', 'half2_ended', 'ended'];
        if (!_editingMatchId) {
            // New match — always set status
            updates.status = (updates.scheduledTime && updates.scheduledTime > Date.now())
                ? 'scheduled' : 'waiting';
        } else {
            // Editing — only update status if match hasn't started
            database.ref('matches/' + _editingMatchId + '/status').once('value').then(function(snap) {
                const currentStatus = snap.val() || 'waiting';
                if (!lockedStatuses.includes(currentStatus)) {
                    const newStatus = (updates.scheduledTime && updates.scheduledTime > Date.now())
                        ? 'scheduled' : 'waiting';
                    database.ref('matches/' + _editingMatchId + '/status').set(newStatus);
                }
            });
        }

        if (!_editingMatchId) {
            // Create new match
            const newId = 'match_' + Date.now();
            updates.score1         = 0;
            updates.score2         = 0;
            updates.time           = '00:00:00';
            updates.currentHalf    = 0;
            updates.startTime      = 0;
            updates.createdBy      = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.uid : '';
            updates.createdByEmail = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.email || '') : '';
            updates.createdAt      = Date.now();
            updates.matchStartedAt = null;

            database.ref('matches/' + newId).set(updates)
                .then(function() {
                    showToast('✓ Матч создан!');
                    window.closeMatchEditModal();
                    if (typeof loadMatches === 'function') loadMatches();
                })
                .catch(function(err) { alert('Ошибка: ' + err.message); });
        } else {
            database.ref('matches/' + _editingMatchId).update(updates)
                .then(function() {
                    showToast('✓ Матч обновлён!');
                    window.closeMatchEditModal();
                    _refreshCockpitHeader(updates);
                    if (typeof loadMatches === 'function') loadMatches();
                })
                .catch(function(err) { alert('Ошибка: ' + err.message); });
        }
    };

    function _refreshCockpitHeader(data) {
        const map = { scheduled:'Ожидается', waiting:'Готов к началу', playing:'Идёт сейчас',
                      ended:'Закончен', half1_ended:'1 тайм окончен', half2_ended:'2 тайм окончен' };
        const t1 = document.getElementById('cockpitTeam1');
        const t2 = document.getElementById('cockpitTeam2');
        const dt = document.getElementById('cockpitDate');
        const st = document.getElementById('cockpitStatus');
        const dn1 = document.getElementById('team1NameDisplay');
        const dn2 = document.getElementById('team2NameDisplay');
        if (t1) t1.textContent = data.team1Name || '';
        if (t2) t2.textContent = data.team2Name || '';
        if (dn1) dn1.textContent = data.team1Name || '';
        if (dn2) dn2.textContent = data.team2Name || '';
        if (dt) {
            if (data.scheduledTime) {
                const d = new Date(data.scheduledTime);
                const p = function(n) { return String(n).padStart(2,'0'); };
                dt.textContent = p(d.getDate())+'.'+p(d.getMonth()+1)+'.'+d.getFullYear()+' '+p(d.getHours())+':'+p(d.getMinutes());
            } else if (data.matchDate) {
                const parts = data.matchDate.split('-');
                dt.textContent = parts[2]+'.'+parts[1]+'.'+parts[0];
            }
        }
        if (st && data.status) st.textContent = map[data.status] || data.status;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectModal);
    } else {
        injectModal();
    }

})();
