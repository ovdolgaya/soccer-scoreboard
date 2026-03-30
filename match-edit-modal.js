// ============================================
// MATCH EDIT MODAL
// Injected once on page load, opened per match.
// Handles: scheduled time, match date, championship,
//          team1 name/logo/color, team2 name/logo/color.
// ============================================

(function () {

    // ── Inject modal HTML once ──────────────────────────────
    function injectModal() {
        if (document.getElementById('matchEditModal')) return;

        const el = document.createElement('div');
        el.innerHTML = `
<div id="matchEditModal" style="display:none; position:fixed; inset:0; z-index:2000;
     background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); overflow-y:auto;">
  <div style="min-height:100%; display:flex; align-items:flex-start; justify-content:center; padding:20px;">
    <div style="background:#fff; border-radius:20px; width:100%; max-width:540px;
                overflow:hidden; box-shadow:0 25px 60px rgba(0,0,0,0.3); margin:auto;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#08399A,#1e5fd4); padding:20px 24px; color:#fff;
                  display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:12px; opacity:.8; text-transform:uppercase; letter-spacing:.08em; margin-bottom:3px;">Редактирование матча</div>
          <h2 style="margin:0; font-size:18px; font-weight:700; color:#fff;" id="editModalTitle">Изменить матч</h2>
        </div>
        <button onclick="closeMatchEditModal()"
                style="background:rgba(255,255,255,0.2); border:none; color:#fff; width:36px; height:36px;
                       border-radius:50%; font-size:20px; cursor:pointer; display:flex; align-items:center; justify-content:center;">×</button>
      </div>

      <!-- Body -->
      <div style="padding:20px; display:flex; flex-direction:column; gap:16px;">

        <!-- Scheduled date/time — upcoming matches -->
        <div id="editScheduledSection">
          <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:6px;">
            📅 Дата и время матча
          </label>
          <input type="datetime-local" id="editScheduledTime"
                 style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px;
                        font-size:14px; box-sizing:border-box;">
          <div style="font-size:12px; color:#94a3b8; margin-top:4px;">Для запланированных матчей</div>
        </div>

        <!-- Match date — played matches -->
        <div id="editMatchDateSection">
          <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:6px;">
            📆 Дата проведения
          </label>
          <input type="date" id="editMatchDate"
                 style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px;
                        font-size:14px; box-sizing:border-box;">
          <div style="font-size:12px; color:#94a3b8; margin-top:4px;">Дата фактического проведения</div>
        </div>

        <!-- Championship -->
        <div>
          <label style="font-size:13px; font-weight:600; color:#374151; display:block; margin-bottom:6px;">
            🏆 Чемпионат
          </label>
          <div style="display:flex; gap:8px;">
            <select id="editChampionshipSelect"
                    style="flex:1; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px;
                           font-size:14px; background:white;"
                    onchange="editLoadChampionshipTitle()">
              <option value="">-- Выбрать из сохранённых --</option>
            </select>
            <button onclick="editSaveChampionship()"
                    style="padding:10px 14px; background:#f1f5f9; border:2px solid #e2e8f0;
                           border-radius:10px; font-size:13px; cursor:pointer; white-space:nowrap;">
                💾 Сохранить
            </button>
          </div>
          <input type="text" id="editChampionshipTitle" placeholder="Или введите название"
                 style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px;
                        font-size:14px; margin-top:8px; box-sizing:border-box;">
        </div>

        <!-- Divider -->
        <div style="border-top:1px solid #f1f5f9;"></div>

        <!-- Team 1 -->
        <div>
          <label style="font-size:13px; font-weight:700; color:#fff; display:block; margin-bottom:8px;">
            Команда 1
          </label>
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <select id="editTeam1Select"
                    style="flex:1; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px;
                           font-size:14px; background:white;"
                    onchange="editLoadTeamData(1)">
              <option value="">-- Выбрать из сохранённых --</option>
            </select>
          </div>
          <input type="text" id="editTeam1Name" placeholder="Название команды 1"
                 style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px;
                        font-size:14px; margin-bottom:8px; box-sizing:border-box;">
          <div style="display:flex; gap:10px; align-items:center;">
            <div style="flex:1;">
              <label style="font-size:12px; color:#64748b; margin-bottom:4px; display:block;">Логотип</label>
              <input type="file" id="editTeam1Logo" accept="image/*" onchange="editPreviewLogo(1)"
                     style="width:100%; font-size:13px;">
              <img id="editTeam1Preview" style="display:none; height:40px; margin-top:6px; border-radius:6px; object-fit:contain;">
            </div>
            <div>
              <label style="font-size:12px; color:#64748b; margin-bottom:4px; display:block;">Цвет</label>
              <input type="color" id="editTeam1Color" value="#08399A"
                     style="width:48px; height:40px; border:2px solid #e2e8f0; border-radius:8px; cursor:pointer; padding:2px;">
            </div>
          </div>
        </div>

        <!-- Team 2 -->
        <div>
          <label style="font-size:13px; font-weight:700; color:#fff; display:block; margin-bottom:8px;">
            Команда 2
          </label>
          <div style="display:flex; gap:8px; margin-bottom:8px;">
            <select id="editTeam2Select"
                    style="flex:1; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px;
                           font-size:14px; background:white;"
                    onchange="editLoadTeamData(2)">
              <option value="">-- Выбрать из сохранённых --</option>
            </select>
          </div>
          <input type="text" id="editTeam2Name" placeholder="Название команды 2"
                 style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:10px;
                        font-size:14px; margin-bottom:8px; box-sizing:border-box;">
          <div style="display:flex; gap:10px; align-items:center;">
            <div style="flex:1;">
              <label style="font-size:12px; color:#64748b; margin-bottom:4px; display:block;">Логотип</label>
              <input type="file" id="editTeam2Logo" accept="image/*" onchange="editPreviewLogo(2)"
                     style="width:100%; font-size:13px;">
              <img id="editTeam2Preview" style="display:none; height:40px; margin-top:6px; border-radius:6px; object-fit:contain;">
            </div>
            <div>
              <label style="font-size:12px; color:#64748b; margin-bottom:4px; display:block;">Цвет</label>
              <input type="color" id="editTeam2Color" value="#4A90E2"
                     style="width:48px; height:40px; border:2px solid #e2e8f0; border-radius:8px; cursor:pointer; padding:2px;">
            </div>
          </div>
        </div>

      </div><!-- /body -->

      <!-- Footer -->
      <div style="padding:16px 20px; border-top:1px solid #f1f5f9; display:flex; gap:10px;">
        <button onclick="closeMatchEditModal()"
                style="flex:1; padding:12px; background:#f1f5f9; color:#64748b; border:none;
                       border-radius:10px; font-size:14px; font-weight:600; cursor:pointer;">
          Отмена
        </button>
        <button onclick="saveMatchEdit()"
                style="flex:2; padding:12px; background:linear-gradient(135deg,#08399A,#1e5fd4);
                       color:#fff; border:none; border-radius:10px; font-size:14px;
                       font-weight:700; cursor:pointer;">
          <i class="fas fa-save"></i> Сохранить изменения
        </button>
      </div>

    </div>
  </div>
</div>`;
        document.body.appendChild(el.firstElementChild);
    }

    // ── State ───────────────────────────────────────────────
    let _editingMatchId  = null;
    let _editLogo1       = null;   // base64 or null (null = keep existing)
    let _editLogo2       = null;

    // ── Open ────────────────────────────────────────────────
    window.openMatchEditModal = function (matchId) {
        _editingMatchId = matchId;
        _editLogo1 = null;
        _editLogo2 = null;

        // Reset logo previews
        ['editTeam1Preview', 'editTeam2Preview'].forEach(function (id) {
            const el = document.getElementById(id);
            el.style.display = 'none';
            el.src = '';
        });
        document.getElementById('editTeam1Logo').value = '';
        document.getElementById('editTeam2Logo').value = '';

        // Load championships into select
        _loadEditChampionships();
        // Load teams into selects
        _loadEditTeams();

        // Fetch current match data
        database.ref('matches/' + matchId).once('value').then(function (snap) {
            const m = snap.val();
            if (!m) return;

            document.getElementById('editModalTitle').textContent =
                (m.team1Name || '') + ' vs ' + (m.team2Name || '');

            // Scheduled time
            if (m.scheduledTime) {
                const d = new Date(m.scheduledTime);
                // Format as datetime-local value: YYYY-MM-DDTHH:MM
                const pad = function (n) { return String(n).padStart(2, '0'); };
                const local = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                              'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
                document.getElementById('editScheduledTime').value = local;
            } else {
                document.getElementById('editScheduledTime').value = '';
            }

            // Match date
            document.getElementById('editMatchDate').value = m.matchDate || '';

            // Championship
            document.getElementById('editChampionshipTitle').value = m.championshipTitle || '';

            // Teams
            document.getElementById('editTeam1Name').value  = m.team1Name  || '';
            document.getElementById('editTeam2Name').value  = m.team2Name  || '';
            document.getElementById('editTeam1Color').value = m.team1Color || '#08399A';
            document.getElementById('editTeam2Color').value = m.team2Color || '#4A90E2';

            // Show existing logos as previews
            if (m.team1Logo) {
                const p = document.getElementById('editTeam1Preview');
                p.src = m.team1Logo; p.style.display = 'block';
                _editLogo1 = m.team1Logo;   // keep unless replaced
            }
            if (m.team2Logo) {
                const p = document.getElementById('editTeam2Preview');
                p.src = m.team2Logo; p.style.display = 'block';
                _editLogo2 = m.team2Logo;
            }
        });

        document.getElementById('matchEditModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    // ── Close ───────────────────────────────────────────────
    window.closeMatchEditModal = function () {
        document.getElementById('matchEditModal').style.display = 'none';
        document.body.style.overflow = '';
        _editingMatchId = null;
    };

    // Close on backdrop click
    document.addEventListener('click', function (e) {
        const modal = document.getElementById('matchEditModal');
        if (e.target === modal) window.closeMatchEditModal();
    });

    // ── Logo preview ────────────────────────────────────────
    window.editPreviewLogo = function (teamNum) {
        const input = document.getElementById('editTeam' + teamNum + 'Logo');
        const preview = document.getElementById('editTeam' + teamNum + 'Preview');
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            if (teamNum === 1) _editLogo1 = e.target.result;
            else               _editLogo2 = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    // ── Championship helpers ────────────────────────────────
    function _loadEditChampionships() {
        database.ref('championships').once('value').then(function (snap) {
            const sel = document.getElementById('editChampionshipSelect');
            sel.innerHTML = '<option value="">-- Выбрать из сохранённых --</option>';
            const items = [];
            snap.forEach(function (child) { items.push(child.val()); });
            items.sort(function (a, b) { return a.title.localeCompare(b.title, 'ru'); });
            items.forEach(function (c) {
                const opt = document.createElement('option');
                opt.value = c.title;
                opt.textContent = c.title;
                sel.appendChild(opt);
            });
            // Pre-select if title matches
            const current = document.getElementById('editChampionshipTitle').value;
            if (current) sel.value = current;
        });
    }

    window.editLoadChampionshipTitle = function () {
        const val = document.getElementById('editChampionshipSelect').value;
        if (val) document.getElementById('editChampionshipTitle').value = val;
    };

    window.editSaveChampionship = function () {
        const title = document.getElementById('editChampionshipTitle').value.trim();
        if (!title) { alert('Введите название чемпионата'); return; }
        const id = 'champ_' + Date.now();
        database.ref('championships/' + id).set({ title: title, createdAt: Date.now() })
            .then(function () {
                showToast('✓ Чемпионат сохранён!');
                _loadEditChampionships();
            });
    };

    // ── Team helpers ────────────────────────────────────────
    function _loadEditTeams() {
        database.ref('teams').once('value').then(function (snap) {
            const sel1 = document.getElementById('editTeam1Select');
            const sel2 = document.getElementById('editTeam2Select');
            const empty = '<option value="">-- Выбрать из сохранённых --</option>';
            sel1.innerHTML = empty;
            sel2.innerHTML = empty;
            snap.forEach(function (child) {
                const t = child.val();
                [sel1, sel2].forEach(function (sel) {
                    const opt = document.createElement('option');
                    opt.value = child.key;
                    opt.textContent = t.name;
                    sel.appendChild(opt);
                });
            });
        });
    }

    window.editLoadTeamData = function (teamNum) {
        const teamId = document.getElementById('editTeam' + teamNum + 'Select').value;
        if (!teamId) return;
        database.ref('teams/' + teamId).once('value').then(function (snap) {
            const t = snap.val();
            if (!t) return;
            document.getElementById('editTeam' + teamNum + 'Name').value  = t.name  || '';
            document.getElementById('editTeam' + teamNum + 'Color').value = t.color || (teamNum === 1 ? '#08399A' : '#4A90E2');
            if (t.logo) {
                const p = document.getElementById('editTeam' + teamNum + 'Preview');
                p.src = t.logo; p.style.display = 'block';
                if (teamNum === 1) _editLogo1 = t.logo;
                else               _editLogo2 = t.logo;
            }
        });
    };

    // ── Save ────────────────────────────────────────────────
    window.saveMatchEdit = function () {
        if (!_editingMatchId) return;

        const team1Name = document.getElementById('editTeam1Name').value.trim();
        const team2Name = document.getElementById('editTeam2Name').value.trim();
        if (!team1Name || !team2Name) {
            alert('Пожалуйста, введите названия обеих команд');
            return;
        }

        const updates = {
            team1Name:  team1Name,
            team2Name:  team2Name,
            team1Color: document.getElementById('editTeam1Color').value,
            team2Color: document.getElementById('editTeam2Color').value,
            team1Logo:  _editLogo1 || '',
            team2Logo:  _editLogo2 || '',
            championshipTitle: document.getElementById('editChampionshipTitle').value.trim()
        };

        // Scheduled time — parse datetime-local as local time (same fix as match creation)
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

        // Match date (can be set independently of scheduled time)
        const matchDateVal = document.getElementById('editMatchDate').value;
        if (matchDateVal) updates.matchDate = matchDateVal;

        database.ref('matches/' + _editingMatchId).update(updates)
            .then(function () {
                showToast('✓ Матч обновлён!');
                window.closeMatchEditModal();
                // If we're currently viewing this match in the cockpit, refresh the header
                if (typeof matchId !== 'undefined' && matchId === _editingMatchId) {
                    _refreshCockpitHeader(updates);
                }
            })
            .catch(function (err) {
                alert('Ошибка сохранения: ' + err.message);
            });
    };

    // ── Refresh cockpit header after save ───────────────────
    function _refreshCockpitHeader(data) {
        const h = document.getElementById('cockpitMatchHeader');
        if (!h) return;
        const t1 = document.getElementById('cockpitTeam1');
        const t2 = document.getElementById('cockpitTeam2');
        const dt = document.getElementById('cockpitDate');
        if (t1) t1.textContent = data.team1Name || '';
        if (t2) t2.textContent = data.team2Name || '';
        if (dt) {
            if (data.scheduledTime) {
                const d = new Date(data.scheduledTime);
                const pad = function (n) { return String(n).padStart(2, '0'); };
                dt.textContent = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() +
                                 ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
            } else if (data.matchDate) {
                const p = data.matchDate.split('-');
                dt.textContent = p[2] + '.' + p[1] + '.' + p[0];
            } else {
                dt.textContent = '';
            }
        }
    }

    // ── Init on DOM ready ────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectModal);
    } else {
        injectModal();
    }

})();
