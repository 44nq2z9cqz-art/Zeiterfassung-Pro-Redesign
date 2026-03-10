// App Controller v2.1
const App = {
  init() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
    Timer.init();
    Calendar.init();
    Zeitkonto.render();
    Settings._page = 'main';
    this.switchTab('today');
    Notifications.init();
    this.renderHeutePausen(DB.todayStr());
  },

  switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tab}`)?.classList.add('active');
    if (tab === 'calendar')   { Calendar.selectedDate = null; Calendar.render(); }
    if (tab === 'zeitkonto')    Zeitkonto.render();
    if (tab === 'settings')     Settings.render();
    if (tab === 'today')      { Calendar.goToToday(); Timer.render(); this.renderHeutePausen(DB.todayStr()); }
  },

  _fmtPauseSec(dauerSek) {
    if (!dauerSek && dauerSek !== 0) return '--';
    const h = Math.floor(dauerSek / 3600);
    const m = Math.floor((dauerSek % 3600) / 60);
    const s = dauerSek % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  },

  // ─── Heute: Pausen-Liste ─────────────────────────────────────────────────
  renderHeutePausen(dateStr) {
    const el = document.getElementById('tages-pausen');
    if (!el) return;
    const e = DB.getEintrag(dateStr) || {};
    const pausen = [...(e.pausen || [])].sort((a, b) => b.id - a.id);
    if (!pausen.length) { el.innerHTML = '<p class="no-data">Keine Pausen heute</p>'; return; }
    const total = pausen.reduce((a, p) => a + (p.dauer || 0), 0);
    el.innerHTML = pausen.map(p => {
      const dispSek = p.dauerSek !== undefined ? p.dauerSek : (p.dauer * 60);
      return `<div class="pause-item">
        <div class="pause-info"><span class="pause-time">${p.start} – ${p.end}</span></div>
        <span class="pause-dauer">${this._fmtPauseSec(dispSek)}</span>
      </div>`;
    }).join('') +
    `<div class="pause-summe">Gesamt: ${DB.formatDuration(total)}</div>`;
  },

  // ─── Kalender Tag öffnen ─────────────────────────────────────────────────
  openKalenderTag(dateStr) {
    App.switchTab('calendar');
    setTimeout(() => Calendar.selectDay(dateStr), 80);
  },

  // ─── Kalender Overlay ───────────────────────────────────────────────────────
  // ─── State for inline pausen expand ─────────────────────────────────────
  _coPausenOpen: false,
  _coKommentarOpen: false,

  openCalOverlay(dateStr, opts) {
    opts = opts || {};
    const e    = DB.getEintrag(dateStr) || {};
    const s    = DB.getSettings();
    const soll = DB.getSollMinuten(dateStr, s);
    const ist  = DB.calcArbeitszeit(e);
    const diff = ist !== null ? ist - soll : null;
    const date = new Date(dateStr + 'T12:00:00');
    const feiertag = window.Feiertage.isFeiertag(dateStr, date.getFullYear());
    const wt = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    const tagTyp = e.tagTyp || '';
    const pauGesamt = (e.pausen||[]).reduce((a,p)=>a+(p.dauer||0),0);
    const pauOpen = opts.pauOpen !== undefined ? opts.pauOpen : this._coPausenOpen;
    const komOpen = opts.komOpen !== undefined ? opts.komOpen : this._coKommentarOpen;
    this._coPausenOpen  = pauOpen;
    this._coKommentarOpen = komOpen;
    this._coDate = dateStr;

    const icon_pen   = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>`;
    const icon_trash = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    const icon_arrow = (open) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="${open?'18 15 12 9 6 15':'6 9 12 15 18 9'}"/></svg>`;

    const typen = [
      {id:'urlaub',label:'Urlaub'},{id:'krank',label:'Krank'},
      {id:'gleittag',label:'Gleittag'},{id:'feiertag',label:'Feiertag'},
      {id:'dienstreise',label:'Dienstreise'},
    ];

    // ── Pausen inline list ──
    const pausen = [...(e.pausen||[])].sort((a,b)=>a.id-b.id);
    const pausenList = pauOpen ? `
      <div class="co-pausen-list">
        ${pausen.length ? pausen.map(p => `
          <div class="co-pause-item">
            <span class="co-pause-time">${p.start} – ${p.end}</span>
            <span class="co-pause-dauer">${App._fmtPauseSec(p.dauerSek!==undefined?p.dauerSek:p.dauer*60)}</span>
            <button class="co-pause-del" onclick="App.coDeletePause('${dateStr}',${p.id})">${icon_trash}</button>
          </div>`).join('') : '<p class="no-data" style="padding:8px 0">Keine Pausen</p>'}
        <div class="co-pause-add">
          <input type="time" id="co-pau-start" class="co-time-inline">
          <span>–</span>
          <input type="time" id="co-pau-end" class="co-time-inline">
          <button class="co-pause-add-btn" onclick="App.coAddPause('${dateStr}')">+ Pause</button>
        </div>
      </div>` : '';

    // ── Kommentar inline ──
    const kommentarField = komOpen ? `
      <div class="co-kommentar-inline">
        <textarea id="co-kommentar-input" class="co-kommentar-textarea" rows="2" placeholder="Kommentar eingeben…">${e.kommentar||''}</textarea>
        <button class="co-kommentar-save btn-primary btn-sm" onclick="App.coSaveKommentar('${dateStr}')">Speichern</button>
      </div>` : '';

    const body = document.getElementById('cal-overlay-body');
    if (!body) return;

    body.innerHTML = `
      <div class="co-header">
        <div class="co-date-row">
          <span class="co-date">${wt[date.getDay()]}, ${DB.formatDateDE(dateStr)}</span>
          ${feiertag ? `<span class="badge badge-holiday">${feiertag}</span>` : ''}
        </div>
        <div class="tag-typ-row">
          ${typen.map(t => `<button class="tag-typ-btn ${tagTyp===t.id?'active-'+t.id:''}"
            onclick="Calendar.setTagTyp('${dateStr}','${t.id}');App.openCalOverlay('${dateStr}')">${t.label}</button>`).join('')}
          ${tagTyp ? `<button class="tag-typ-btn tag-typ-clear"
            onclick="Calendar.clearTagTyp('${dateStr}');App.openCalOverlay('${dateStr}')">✕</button>` : ''}
        </div>
      </div>
      <div class="co-fields">
        <div class="co-field">
          <span class="co-field-label">Arbeitsbeginn</span>
          <div class="co-field-right">
            <input type="time" class="co-time-picker" value="${e.start||''}"
              onchange="App.coSaveZeit('${dateStr}','start',this.value)">
          </div>
        </div>
        <div class="co-field">
          <span class="co-field-label">Arbeitsende</span>
          <div class="co-field-right">
            <input type="time" class="co-time-picker" value="${e.end||''}"
              onchange="App.coSaveZeit('${dateStr}','end',this.value)">
          </div>
        </div>
        <div class="co-field co-field-toggle" onclick="App.openCalOverlay('${dateStr}',{pauOpen:${!pauOpen},komOpen:${komOpen}})">
          <span class="co-field-label">Pausen gesamt</span>
          <div class="co-field-right">
            <span class="co-field-val">${DB.formatDuration(pauGesamt)}</span>
            <span class="co-field-icon">${icon_arrow(pauOpen)}</span>
          </div>
        </div>
        ${pausenList}
        <div class="co-field">
          <span class="co-field-label">Sollzeit</span>
          <div class="co-field-right">
            <input type="time" class="co-time-picker" value="${(() => { const h=String(Math.floor(soll/60)).padStart(2,'0'); const m=String(soll%60).padStart(2,'0'); return h+':'+m; })()"
              onchange="App.coSaveSoll('${dateStr}',this.value)">
          </div>
        </div>
        ${diff !== null ? `
        <div class="co-field no-tap">
          <span class="co-field-label">Differenz</span>
          <div class="co-field-right">
            <span class="co-field-val ${diff>=0?'pos':'neg'}">${DB.formatDuration(diff,true)}</span>
          </div>
        </div>` : ''}
      </div>
      <div class="co-fields co-fields-comment">
        <div class="co-field co-field-toggle" onclick="App.openCalOverlay('${dateStr}',{pauOpen:${pauOpen},komOpen:${!komOpen}})">
          <span class="co-field-label">Kommentar</span>
          <div class="co-field-right">
            <span class="co-field-val ${!e.kommentar&&!komOpen?'missing':''}">${e.kommentar||'–'}</span>
            <span class="co-field-icon">${icon_arrow(komOpen)}</span>
          </div>
        </div>
        ${kommentarField}
      </div>
      ${(e.start||e.end||e.tagTyp||e.kommentar) ? `
      <div class="co-delete" onclick="Calendar.deleteEintrag('${dateStr}')">
        <span>Tag löschen</span>
        <span class="co-delete-icon">${icon_trash}</span>
      </div>` : ''}`;

    document.getElementById('cal-overlay').classList.add('open');
  },

  // ─── Cal overlay inline helpers ──────────────────────────────────────────
  coSaveZeit(dateStr, field, val) {
    if (!val) return;
    DB.saveEintrag(dateStr, { [field]: val });
    App.showToast('Gespeichert ✓', 'success');
    Calendar.selectedDate = dateStr; Calendar.render();
    if (dateStr === DB.todayStr()) Timer.render();
    // Refresh diff only — re-render overlay inline
    this.openCalOverlay(dateStr);
  },

  coSaveSoll(dateStr, val) {
    if (!val) return;
    const [h, m] = val.split(':');
    const mins = parseInt(h||0)*60 + parseInt(m||0);
    DB.saveEintrag(dateStr, { sollOverrideMinuten: mins });
    App.showToast('Sollzeit gespeichert ✓', 'success');
    Calendar.selectedDate = dateStr; Calendar.render();
    this.openCalOverlay(dateStr);
  },

  coSaveKommentar(dateStr) {
    const val = document.getElementById('co-kommentar-input')?.value.trim() || '';
    DB.saveEintrag(dateStr, { kommentar: val });
    App.showToast('Gespeichert ✓', 'success');
    Calendar.selectedDate = dateStr; Calendar.render();
    this.openCalOverlay(dateStr, {komOpen: false});
  },

  coAddPause(dateStr) {
    const start = document.getElementById('co-pau-start')?.value;
    const end   = document.getElementById('co-pau-end')?.value;
    if (!start || !end) { App.showToast('Bitte Start und Ende eingeben', 'error'); return; }
    const sm = DB.timeToMinutes(start), em = DB.timeToMinutes(end);
    if (em <= sm) { App.showToast('Ende muss nach Start liegen', 'error'); return; }
    DB.addPause(dateStr, { start, end, dauer: em-sm, dauerSek: (em-sm)*60 });
    Calendar.selectedDate = dateStr; Calendar.render();
    if (dateStr === DB.todayStr()) { Timer.render(); App.renderHeutePausen(dateStr); }
    App.showToast('Pause gespeichert ✓', 'success');
    this.openCalOverlay(dateStr, {pauOpen: true});
  },

  coDeletePause(dateStr, id) {
    if (!confirm('Pause löschen?')) return;
    DB.deletePause(dateStr, id);
    Calendar.selectedDate = dateStr; Calendar.render();
    if (dateStr === DB.todayStr()) { Timer.render(); App.renderHeutePausen(dateStr); }
    this.openCalOverlay(dateStr, {pauOpen: true});
  },

  // ─── Zeit-Edit mit nativem iOS-Picker ───────────────────────────────────
  editZeit(dateStr, field) {
    const e = DB.getEintrag(dateStr) || {};
    const label = field === 'start' ? 'Arbeitsbeginn' : 'Arbeitsende';
    document.getElementById('ez-title').textContent = `${label} bearbeiten`;
    document.getElementById('ez-date').value  = dateStr;
    document.getElementById('ez-field').value = field;
    const cur = e[field] || (field === 'start' ? '08:00' : '17:00');
    document.getElementById('ez-time-input').value = cur;
    document.getElementById('edit-zeit-modal').classList.add('open');
    // Focus triggers native iOS wheel picker
    setTimeout(() => document.getElementById('ez-time-input').focus(), 150);
  },

  saveZeit() {
    const dateStr = document.getElementById('ez-date').value;
    const field   = document.getElementById('ez-field').value;
    const timeStr = document.getElementById('ez-time-input').value;
    if (!timeStr) { App.showToast('Bitte Zeit eingeben', 'error'); return; }
    DB.saveEintrag(dateStr, { [field]: timeStr });
    this.closeModal('edit-zeit-modal');
    App.showToast('Gespeichert ✓', 'success');
    Calendar.selectedDate = dateStr; Calendar.render();
    if (dateStr === DB.todayStr()) Timer.render();
  },

  editSoll(dateStr) {
    const e = DB.getEintrag(dateStr) || {};
    const s = DB.getSettings();
    const cur = typeof e.sollOverrideMinuten === 'number' ? e.sollOverrideMinuten : DB.getSollMinuten(dateStr, s);
    const h = String(Math.floor(cur / 60)).padStart(2,'0');
    const m = String(cur % 60).padStart(2,'0');
    document.getElementById('es-date').value = dateStr;
    document.getElementById('es-time-input').value = `${h}:${m}`;
    document.getElementById('edit-soll-modal').classList.add('open');
    setTimeout(() => document.getElementById('es-time-input').focus(), 150);
  },

  saveSoll() {
    const dateStr = document.getElementById('es-date').value;
    const timeStr = document.getElementById('es-time-input').value || '08:00';
    const [h, m] = timeStr.split(':');
    const mins = parseInt(h||0) * 60 + parseInt(m||0);
    DB.saveEintrag(dateStr, { sollOverrideMinuten: mins });
    this.closeModal('edit-soll-modal');
    App.showToast('Sollzeit gespeichert ✓', 'success');
    Calendar.selectedDate = dateStr; Calendar.render();
    if (document.getElementById('cal-overlay')?.classList.contains('open')) App.openCalOverlay(dateStr);
  },

  editKommentar(dateStr) {
    const e = DB.getEintrag(dateStr) || {};
    document.getElementById('ek-date').value = dateStr;
    document.getElementById('ek-kommentar').value = e.kommentar || '';
    document.querySelectorAll('.quick-tag').forEach(b => b.classList.toggle('active', b.dataset.tag === e.kommentar));
    document.getElementById('edit-kommentar-modal').classList.add('open');
  },

  saveKommentar() {
    const dateStr = document.getElementById('ek-date').value;
    DB.saveEintrag(dateStr, { kommentar: document.getElementById('ek-kommentar').value.trim() });
    this.closeModal('edit-kommentar-modal');
    App.showToast('Gespeichert ✓', 'success');
    Calendar.selectedDate = dateStr; Calendar.render();
    if (dateStr === DB.todayStr()) Timer.render();
    if (document.getElementById('cal-overlay')?.classList.contains('open')) App.openCalOverlay(dateStr);
  },

  setQuickKommentar(tag, btn) {
    const inp = document.getElementById('ek-kommentar');
    document.querySelectorAll('.quick-tag').forEach(b => b.classList.remove('active'));
    inp.value = inp.value === tag ? '' : tag;
    if (inp.value) btn.classList.add('active');
  },

  editPausenDetail(dateStr) {
    document.getElementById('ep-date').value = dateStr;
    this._renderPausenModalList(dateStr);
    document.getElementById('edit-pausen-modal').classList.add('open');
  },

  _renderPausenModalList(dateStr) {
    const el = document.getElementById('ep-pausen-list');
    if (!el) return;
    const e = DB.getEintrag(dateStr) || {};
    const pausen = [...(e.pausen || [])].sort((a, b) => b.id - a.id);
    if (!pausen.length) { el.innerHTML = '<p class="no-data">Keine Pausen</p>'; return; }
    el.innerHTML = pausen.map(p => {
      const dispSek = p.dauerSek !== undefined ? p.dauerSek : (p.dauer * 60);
      return `<div class="pause-item">
        <div class="pause-info"><span class="pause-time">${p.start} – ${p.end}</span></div>
        <span class="pause-dauer">${App._fmtPauseSec(dispSek)}</span>
        <div class="pause-actions">
          <button class="icon-btn danger" onclick="App.deletePauseFromModal('${dateStr}',${p.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      </div>`;
    }).join('');
  },

  deletePauseFromModal(dateStr, id) {
    if (!confirm('Pause löschen?')) return;
    DB.deletePause(dateStr, id);
    this._renderPausenModalList(dateStr);
    Calendar.selectedDate = dateStr; Calendar.render();
    if (dateStr === DB.todayStr()) { Timer.render(); this.renderHeutePausen(dateStr); }
  },

  addPauseFromModal() {
    const dateStr = document.getElementById('ep-date').value;
    const start = document.getElementById('ep-start').value;
    const end   = document.getElementById('ep-end').value;
    if (!start || !end) { App.showToast('Bitte Start und Ende eingeben', 'error'); return; }
    const sm = DB.timeToMinutes(start), em = DB.timeToMinutes(end);
    if (em <= sm) { App.showToast('Ende muss nach Start liegen', 'error'); return; }
    DB.addPause(dateStr, { start, end, dauer: em - sm });
    document.getElementById('ep-start').value = '';
    document.getElementById('ep-end').value = '';
    this._renderPausenModalList(dateStr);
    Calendar.selectedDate = dateStr; Calendar.render();
    if (dateStr === DB.todayStr()) { Timer.render(); this.renderHeutePausen(dateStr); }
    App.showToast('Pause gespeichert ✓', 'success');
  },

  // ─── Entnahmen – kein Konto-Auswahl, +/- Vorzeichen, Tags ───────────────
  _entnahmeSign: 1,  // 1 = Abzug (default), -1 = Gutschrift

  openEntnahmeNeu(dateStr) { this._openEntnahmeModal(null, dateStr); },
  openEntnahmeEdit(id) {
    const en = DB.getEntnahmen().find(e => e.id === id);
    this._openEntnahmeModal(en);
  },

  _openEntnahmeModal(existing, defaultDate) {
    const modal = document.getElementById('entnahme-modal');
    document.getElementById('en-id').value    = existing?.id || '';
    document.getElementById('en-datum').value = existing?.datum || defaultDate || DB.todayStr();
    document.getElementById('en-grund').value = existing?.grund || '';
    document.getElementById('en-modal-title').textContent = existing ? 'Buchung bearbeiten' : 'Neue Zeitkonto-Buchung';
    const delBtn = document.getElementById('en-delete-btn');
    if (delBtn) delBtn.style.display = existing ? 'flex' : 'none';

    // Vorzeichen: betragMin negativ = Gutschrift
    const isGutschrift = existing ? (existing.betragMin < 0) : false;
    this._entnahmeSign = isGutschrift ? -1 : 1;
    this._updateEntnahmeSign();

    // Tags
    document.querySelectorAll('.en-tag').forEach(b => b.classList.toggle('active', b.dataset.tag === (existing?.buchungstyp || '')));

    const betrag = existing ? Math.abs(existing.betragMin) : 0;
    const h = Math.floor(betrag / 60);
    const m = betrag % 60;
    // Use hhhh:mm format for values > 24h
    document.getElementById('en-time-input').value =
      `${String(h).padStart(3,'0')}:${String(m).padStart(2,'0')}`;
    modal.classList.add('open');
    setTimeout(() => document.getElementById('en-time-input').focus(), 150);
  },

  _updateEntnahmeSign() {
    document.getElementById('en-sign-minus')?.classList.toggle('active', this._entnahmeSign === 1);
    document.getElementById('en-sign-plus')?.classList.toggle('active', this._entnahmeSign === -1);
  },

  setEntnahmeSign(sign) {
    this._entnahmeSign = sign;
    this._updateEntnahmeSign();
  },

  setEntnahmeTag(tag, btn) {
    document.querySelectorAll('.en-tag').forEach(b => b.classList.remove('active'));
    const inp = document.getElementById('en-grund');
    if (inp.dataset.lastTag === tag) { inp.dataset.lastTag = ''; }
    else { inp.value = inp.value || tag; btn.classList.add('active'); inp.dataset.lastTag = tag; }
  },

  saveEntnahme() {
    const id      = document.getElementById('en-id').value;
    const datum   = document.getElementById('en-datum').value;
    const grund   = document.getElementById('en-grund').value.trim();
    const buchungstyp = document.querySelector('.en-tag.active')?.dataset.tag || '';
    const tval = document.getElementById('en-time-input').value || '000:00';
    const parts = tval.split(':');
    const absBetrag = (parseInt(parts[0]||0) * 60) + Math.min(59, parseInt(parts[1]||0));
    const betragMin = this._entnahmeSign * absBetrag;  // negativ = Gutschrift

    if (!datum) { App.showToast('Datum fehlt', 'error'); return; }
    if (absBetrag <= 0) { App.showToast('Betrag muss > 0 sein', 'error'); return; }

    if (id) DB.updateEntnahme(parseInt(id), { datum, betragMin, grund, buchungstyp });
    else    DB.addEntnahme({ datum, betragMin, grund, buchungstyp });

    this.closeModal('entnahme-modal');
    App.showToast('Buchung gespeichert ✓', 'success');
    Zeitkonto.render();
    if (Calendar.selectedDate) Calendar.render();
  },

  deleteEntnahme() {
    const id = document.getElementById('en-id').value;
    if (!id) return;
    if (!confirm('Buchung wirklich löschen?')) return;
    DB.deleteEntnahme(parseInt(id));
    this.closeModal('entnahme-modal');
    App.showToast('Buchung gelöscht', 'info');
    Zeitkonto.render();
    if (Calendar.selectedDate) Calendar.render();
  },

  // ─── Auswertungen ────────────────────────────────────────────────────────
  openAuswertungen() {
    document.getElementById('au-modal').classList.add('open');
    this.setAuswertungRange('month');
  },

  setAuswertungRange(preset) {
    const now = new Date(); const today = DB.todayStr();
    let von, bis;
    const pad = n => String(n).padStart(2, '0');
    if      (preset === 'today')     { von = bis = today; }
    else if (preset === 'yesterday') { von = bis = DB.dateAdd(today, -1); }
    else if (preset === 'week')      { const d = new Date(); d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); von = DB.dateToStr(d); bis = today; }
    else if (preset === 'month')     { von = `${now.getFullYear()}-${pad(now.getMonth()+1)}-01`; bis = today; }
    else if (preset === 'lastmonth') { const lm = new Date(now.getFullYear(), now.getMonth()-1, 1); const last = new Date(now.getFullYear(), now.getMonth(), 0); von = DB.dateToStr(lm); bis = DB.dateToStr(last); }
    else if (preset === 'year')      { von = `${now.getFullYear()}-01-01`; bis = today; }
    else if (preset === 'lastyear')  { von = `${now.getFullYear()-1}-01-01`; bis = `${now.getFullYear()-1}-12-31`; }
    document.getElementById('au-von').value = von;
    document.getElementById('au-bis').value = bis;
    document.querySelectorAll('.au-preset').forEach(b => b.classList.toggle('active', b.dataset.p === preset));
  },

  doExportCSV() {
    DB.exportCSV(document.getElementById('au-von').value, document.getElementById('au-bis').value);
    App.showToast('CSV exportiert ✓', 'success');
  },

  doExportPDF() {
    this.generatePDF(document.getElementById('au-von').value, document.getElementById('au-bis').value);
  },

  _buildZKRows(rows, all, von, bis) {
    const s2 = DB.getSettings();
    const limit2 = s2.ueberstundenSockelLimit;
    const enAll = DB.getEntnahmen().filter(e => (!von || e.datum >= von) && (!bis || e.datum <= bis));
    const enMap2 = {};
    enAll.forEach(e => { (enMap2[e.datum] = enMap2[e.datum] || []).push(e); });
    const dates2 = [...new Set([
      ...rows.filter(r => r.ds).map(r => r.ds),
      ...enAll.map(e => e.datum)
    ])].sort();
    let lS = 0, lU = 0, result = '';
    const fmtD = v => DB.formatDuration(v, true);
    for (const d of dates2) {
      const e2 = all[d];
      if (e2 && e2.start && e2.end) {
        const diff2 = DB.getDiffMinuten(d);
        if (diff2 > 0) { const r2 = Math.max(0, limit2 - lS); lS += Math.min(diff2, r2); lU += diff2 - Math.min(diff2, r2); }
        else if (diff2 < 0) { const a2 = Math.abs(diff2); const as2 = Math.min(a2, lS); lS -= as2; lU -= Math.min(a2 - as2, lU); }
        if (diff2 !== 0) result += '<tr><td>' + DB.formatDateDE(d) + '</td><td>Arbeitstag</td>'
          + '<td class="' + (diff2 >= 0 ? 'pos' : 'neg') + '">' + fmtD(diff2) + '</td>'
          + '<td>' + DB.formatDuration(lS) + '</td><td>' + DB.formatDuration(lU) + '</td>'
          + '<td class="' + ((lS + lU) >= 0 ? 'pos' : 'neg') + '">' + DB.formatDuration(lS + lU) + '</td></tr>';
      }
      if (enMap2[d]) {
        enMap2[d].forEach(en2 => {
          const b = en2.betragMin;
          if (b > 0) { const aU = Math.min(b, Math.max(0, lU)); lU -= aU; lS = Math.max(-999999, lS - (b - aU)); }
          else if (b < 0) { const gv = Math.abs(b); const r2 = Math.max(0, limit2 - lS); lS += Math.min(gv, r2); lU += gv - Math.min(gv, r2); }
          result += '<tr class="sp"><td>' + DB.formatDateDE(d) + '</td>'
            + '<td>Buchung: ' + (en2.buchungstyp || '') + ' ' + (en2.grund || '') + '</td>'
            + '<td class="' + (b <= 0 ? 'pos' : 'neg') + '">' + fmtD(b) + '</td>'
            + '<td>' + DB.formatDuration(lS) + '</td><td>' + DB.formatDuration(lU) + '</td>'
            + '<td class="' + ((lS + lU) >= 0 ? 'pos' : 'neg') + '">' + DB.formatDuration(lS + lU) + '</td></tr>';
        });
      }
    }
    return result;
  },

  _buildZKRows(rows, all, von, bis) {
    const s2 = DB.getSettings();
    const limit2 = s2.ueberstundenSockelLimit;
    const enAll = DB.getEntnahmen().filter(e => (!von || e.datum >= von) && (!bis || e.datum <= bis));
    const enMap2 = {};
    enAll.forEach(e => { (enMap2[e.datum] = enMap2[e.datum] || []).push(e); });
    const dates2 = [...new Set([
      ...rows.filter(r => r.ds).map(r => r.ds),
      ...enAll.map(e => e.datum)
    ])].sort();
    let lS = 0, lU = 0, result = '';
    const fmtD = v => DB.formatDuration(v, true);
    for (const d of dates2) {
      const e2 = all[d];
      if (e2 && e2.start && e2.end) {
        const diff2 = DB.getDiffMinuten(d);
        if (diff2 > 0) { const r2 = Math.max(0, limit2 - lS); lS += Math.min(diff2, r2); lU += diff2 - Math.min(diff2, r2); }
        else if (diff2 < 0) { const a2 = Math.abs(diff2); const as2 = Math.min(a2, lS); lS -= as2; lU -= Math.min(a2 - as2, lU); }
        if (diff2 !== 0) result += '<tr><td>' + DB.formatDateDE(d) + '</td><td>Arbeitstag</td>'
          + '<td class="' + (diff2 >= 0 ? 'pos' : 'neg') + '">' + fmtD(diff2) + '</td>'
          + '<td>' + DB.formatDuration(lS) + '</td><td>' + DB.formatDuration(lU) + '</td>'
          + '<td class="' + ((lS + lU) >= 0 ? 'pos' : 'neg') + '">' + DB.formatDuration(lS + lU) + '</td></tr>';
      }
      if (enMap2[d]) {
        enMap2[d].forEach(en2 => {
          const b = en2.betragMin;
          if (b > 0) { const aU = Math.min(b, Math.max(0, lU)); lU -= aU; lS = Math.max(-999999, lS - (b - aU)); }
          else if (b < 0) { const gv = Math.abs(b); const r2 = Math.max(0, limit2 - lS); lS += Math.min(gv, r2); lU += gv - Math.min(gv, r2); }
          result += '<tr class="sp"><td>' + DB.formatDateDE(d) + '</td>'
            + '<td>Buchung: ' + (en2.buchungstyp || '') + ' ' + (en2.grund || '') + '</td>'
            + '<td class="' + (b <= 0 ? 'pos' : 'neg') + '">' + fmtD(b) + '</td>'
            + '<td>' + DB.formatDuration(lS) + '</td><td>' + DB.formatDuration(lU) + '</td>'
            + '<td class="' + ((lS + lU) >= 0 ? 'pos' : 'neg') + '">' + DB.formatDuration(lS + lU) + '</td></tr>';
        });
      }
    }
    return result;
  },

  generatePDF(von, bis) {
    const all = DB.getEintraege(); const s = DB.getSettings();
    const wt = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    const limit = s.ueberstundenSockelLimit;

    // Opening balance (everything before range)
    let lS = 0, lU = 0;
    const enBefore = DB.getEntnahmen().filter(e => von && e.datum < von);
    const daysBefore = Object.keys(all).filter(d => von && d < von);
    const beforeDates = [...new Set([...daysBefore, ...enBefore.map(e=>e.datum)])].sort();
    for (const d of beforeDates) {
      const e = all[d];
      if (e && e.start && e.end) {
        const diff = DB.getDiffMinuten(d);
        if (diff > 0) { const r = Math.max(0, limit-lS); lS += Math.min(diff,r); lU += diff-Math.min(diff,r); }
        else if (diff < 0) { const a = Math.abs(diff); const as = Math.min(a,lS); lS -= as; lU -= Math.min(a-as,lU); }
      }
      enBefore.filter(en=>en.datum===d).forEach(en => {
        const b = en.betragMin;
        if (b>0){const aU=Math.min(b,Math.max(0,lU));lU-=aU;lS=Math.max(-999999,lS-(b-aU));}
        else if(b<0){const gv=Math.abs(b);const r=Math.max(0,limit-lS);lS+=Math.min(gv,r);lU+=gv-Math.min(gv,r);}
      });
    }

    // Build rows
    const enAll = DB.getEntnahmen().filter(e=>(!von||e.datum>=von)&&(!bis||e.datum<=bis));
    const enMap = {};
    enAll.forEach(e=>{(enMap[e.datum]=enMap[e.datum]||[]).push(e);});

    let rows = [], totalIst = 0, totalSoll = 0;
    let cur = new Date(((von||'2024-01-01')+'T12:00:00'));
    const end = new Date(((bis||DB.todayStr())+'T12:00:00'));

    while (cur <= end) {
      const ds = DB.dateToStr(cur); const e = all[ds]||{};
      const ist   = e.start&&e.end ? DB.calcArbeitszeit(e) : null;
      const soll  = DB.getSollMinuten(ds, s);
      const diff  = ist!==null ? ist-soll : null;
      const pausen= (e.pausen||[]).reduce((a,p)=>a+(p.dauer||0),0);
      const feiertag = window.Feiertage.isFeiertag(ds, cur.getFullYear());

      // Apply day arbeitszeit to balance
      if (diff!==null) {
        if (diff>0){const r=Math.max(0,limit-lS);lS+=Math.min(diff,r);lU+=diff-Math.min(diff,r);}
        else if(diff<0){const a=Math.abs(diff);const as=Math.min(a,lS);lS-=as;lU-=Math.min(a-as,lU);}
      }

      // Apply buchungen for this day
      let buchBetragSum = 0;
      let buchKommentar = [];
      if (enMap[ds]) {
        enMap[ds].forEach(en => {
          const b = en.betragMin;
          const dispB = b>0 ? -b : Math.abs(b); // Abzug negativ, Gutschrift positiv
          buchBetragSum += dispB;
          if (b>0){const aU=Math.min(b,Math.max(0,lU));lU-=aU;lS=Math.max(-999999,lS-(b-aU));}
          else if(b<0){const gv=Math.abs(b);const r=Math.max(0,limit-lS);lS+=Math.min(gv,r);lU+=gv-Math.min(gv,r);}
          const label = [en.buchungstyp, en.grund].filter(Boolean).join(' – ');
          if (label) buchKommentar.push(label);
        });
      }

      if (ist!==null) totalIst += ist;
      totalSoll += soll;

      rows.push({ ds, dow:wt[cur.getDay()], start:e.start||'', end:e.end||'',
        pausen, ist, soll, diff,
        typ: e.tagTyp||feiertag||'', kommentar: e.kommentar||'',
        buchBetrag: enMap[ds] ? buchBetragSum : null,
        buchKommentar: buchKommentar.join('; '),
        saldo: lS+lU
      });
      cur.setDate(cur.getDate()+1);
    }

    const totalDiff = totalIst - totalSoll;
    const fmtS = v => DB.formatDuration(v, true);
    const fmtU = v => DB.formatDuration(v);
    const cls  = v => v>=0 ? 'pos' : 'neg';

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
      <title>Zeiterfassung ${von}–${bis}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:9px;margin:12px;color:#1a2e21}
        h1{font-size:13px;color:#4a7c59;margin-bottom:2px}
        .sub{font-size:8px;color:#6a8a72;margin-bottom:8px}
        table{width:100%;border-collapse:collapse}
        th{background:#4a7c59;color:#fff;padding:4px 3px;text-align:left;font-size:8px;white-space:normal;line-height:1.2}
        td{padding:3px;border-bottom:1px solid #e0e8e2;font-size:9px}
        tr:nth-child(even) td{background:#f5f7f5}
        .we td{color:#aaa}
        .sp td{background:#f0f7f0!important}
        .pos{color:#2e7d32;font-weight:700} .neg{color:#c62828;font-weight:700}
        tfoot td{font-weight:700;background:#e8f5e9;border-top:2px solid #4a7c59}
        @media print{body{margin:6px}@page{margin:8mm;size:landscape}}
      </style></head><body>
      <h1>Zeiterfassung Pro</h1>
      <div class="sub">${DB.formatDateDE(von)} – ${DB.formatDateDE(bis)}</div>
      <table><thead><tr>
        <th>Datum</th><th>Tag</th><th>Beginn</th><th>Ende</th>
        <th>Pausen</th><th>Ist</th><th>Soll</th><th>Diff</th>
        <th>Typ</th><th>Kommentar</th>
        <th>Buchung</th><th>Saldo</th><th>Kommentar<br>Zeitkonto</th>
      </tr></thead><tbody>
      ${rows.map(r => `<tr class="${r.dow==='Sa'||r.dow==='So'?'we':''} ${r.typ?'sp':''}">
        <td>${DB.formatDateDE(r.ds)}</td>
        <td>${r.dow}</td>
        <td>${r.start}</td>
        <td>${r.end}</td>
        <td>${r.pausen ? r.pausen+' Min' : ''}</td>
        <td>${r.ist!==null ? fmtU(r.ist) : ''}</td>
        <td>${r.soll ? fmtU(r.soll) : ''}</td>
        <td class="${r.diff!==null?cls(r.diff):''}">${r.diff!==null ? fmtS(r.diff) : ''}</td>
        <td>${r.typ}</td>
        <td>${r.kommentar}</td>
        <td class="${r.buchBetrag!==null?cls(r.buchBetrag):''}">${r.buchBetrag!==null ? fmtS(r.buchBetrag) : ''}</td>
        <td class="${cls(r.saldo)}">${fmtS(r.saldo)}</td>
        <td>${r.buchKommentar}</td>
      </tr>`).join('')}
      </tbody><tfoot><tr>
        <td colspan="5">Gesamt</td>
        <td>${fmtU(totalIst)}</td>
        <td>${fmtU(totalSoll)}</td>
        <td class="${cls(totalDiff)}">${fmtS(totalDiff)}</td>
        <td colspan="5"></td>
      </tr></tfoot></table>
      <script>window.onload=()=>window.print();<\/script>
      </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html); w.document.close();
  },

    _buildZKRows(rows, all, von, bis) {
    const s2 = DB.getSettings();
    const limit2 = s2.ueberstundenSockelLimit;
    const enAll = DB.getEntnahmen().filter(e => (!von || e.datum >= von) && (!bis || e.datum <= bis));
    const enMap2 = {};
    enAll.forEach(e => { (enMap2[e.datum] = enMap2[e.datum] || []).push(e); });
    const dates2 = [...new Set([
      ...rows.filter(r => r.ds).map(r => r.ds),
      ...enAll.map(e => e.datum)
    ])].sort();
    let lS = 0, lU = 0, result = '';
    const fmtD = v => DB.formatDuration(v, true);
    for (const d of dates2) {
      const e2 = all[d];
      if (e2 && e2.start && e2.end) {
        const diff2 = DB.getDiffMinuten(d);
        if (diff2 > 0) { const r2 = Math.max(0, limit2 - lS); lS += Math.min(diff2, r2); lU += diff2 - Math.min(diff2, r2); }
        else if (diff2 < 0) { const a2 = Math.abs(diff2); const as2 = Math.min(a2, lS); lS -= as2; lU -= Math.min(a2 - as2, lU); }
        if (diff2 !== 0) result += '<tr><td>' + DB.formatDateDE(d) + '</td><td>Arbeitstag</td>'
          + '<td class="' + (diff2 >= 0 ? 'pos' : 'neg') + '">' + fmtD(diff2) + '</td>'
          + '<td>' + DB.formatDuration(lS) + '</td><td>' + DB.formatDuration(lU) + '</td>'
          + '<td class="' + ((lS + lU) >= 0 ? 'pos' : 'neg') + '">' + DB.formatDuration(lS + lU) + '</td></tr>';
      }
      if (enMap2[d]) {
        enMap2[d].forEach(en2 => {
          const b = en2.betragMin;
          if (b > 0) { const aU = Math.min(b, Math.max(0, lU)); lU -= aU; lS = Math.max(-999999, lS - (b - aU)); }
          else if (b < 0) { const gv = Math.abs(b); const r2 = Math.max(0, limit2 - lS); lS += Math.min(gv, r2); lU += gv - Math.min(gv, r2); }
          result += '<tr class="sp"><td>' + DB.formatDateDE(d) + '</td>'
            + '<td>Buchung: ' + (en2.buchungstyp || '') + ' ' + (en2.grund || '') + '</td>'
            + '<td class="' + (b <= 0 ? 'pos' : 'neg') + '">' + fmtD(b) + '</td>'
            + '<td>' + DB.formatDuration(lS) + '</td><td>' + DB.formatDuration(lU) + '</td>'
            + '<td class="' + ((lS + lU) >= 0 ? 'pos' : 'neg') + '">' + DB.formatDuration(lS + lU) + '</td></tr>';
        });
      }
    }
    return result;
  },

  generatePDF(von, bis) {
    const all = DB.getEintraege(); const s = DB.getSettings();
    const wt = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    const limit = s.ueberstundenSockelLimit;

    // Build rows with running Zeitkonto saldo
    let rows = [], totalIst = 0, totalSoll = 0;
    let lS = 0, lU = 0; // laufender Saldo Sockel / ÜberSockel

    // Collect all entnahmen in range
    const enAll = DB.getEntnahmen().filter(e => (!von || e.datum >= von) && (!bis || e.datum <= bis));
    const enMap = {};
    enAll.forEach(e => { (enMap[e.datum] = enMap[e.datum] || []).push(e); });

    // Also need entnahmen BEFORE range to get correct opening balance
    const enBefore = DB.getEntnahmen().filter(e => von && e.datum < von);
    const allBefore = Object.keys(all).filter(d => von && d < von);

    // Calculate opening balance (everything before von)
    const allDates = [...new Set([...allBefore, ...enBefore.map(e=>e.datum)])].sort();
    for (const d of allDates) {
      const e = all[d];
      if (e && e.start && e.end) {
        const diff = DB.getDiffMinuten(d);
        if (diff > 0) { const r = Math.max(0, limit - lS); lS += Math.min(diff, r); lU += diff - Math.min(diff, r); }
        else if (diff < 0) { const a = Math.abs(diff); const as = Math.min(a, lS); lS -= as; lU -= Math.min(a - as, lU); }
      }
      const eb = enBefore.filter(en => en.datum === d);
      eb.forEach(en => {
        const b = en.betragMin;
        if (b > 0) { const aU = Math.min(b, Math.max(0, lU)); lU -= aU; lS = Math.max(-999999, lS - (b - aU)); }
        else if (b < 0) { const gv = Math.abs(b); const r = Math.max(0, limit - lS); lS += Math.min(gv, r); lU += gv - Math.min(gv, r); }
      });
    }

    // Now build report rows for the range
    let cur = new Date(((von || '2024-01-01') + 'T12:00:00'));
    const end = new Date(((bis || DB.todayStr()) + 'T12:00:00'));

    while (cur <= end) {
      const ds = DB.dateToStr(cur); const e = all[ds] || {};
      const ist  = e.start && e.end ? DB.calcArbeitszeit(e) : null;
      const soll = DB.getSollMinuten(ds, s);
      const diff = ist !== null ? ist - soll : null;
      const pausen = (e.pausen || []).reduce((a, p) => a + (p.dauer || 0), 0);
      const feiertag = window.Feiertage.isFeiertag(ds, cur.getFullYear());

      // Apply to running balance
      let enRows = [];
      if (enMap[ds]) {
        enMap[ds].forEach(en => {
          const b = en.betragMin;
          const dispB = b > 0 ? -b : Math.abs(b); // Abzug negativ, Gutschrift positiv
          if (b > 0) { const aU = Math.min(b, Math.max(0, lU)); lU -= aU; lS = Math.max(-999999, lS - (b - aU)); }
          else if (b < 0) { const gv = Math.abs(b); const r = Math.max(0, limit - lS); lS += Math.min(gv, r); lU += gv - Math.min(gv, r); }
          enRows.push({ type: 'buchung', ds, label: (en.buchungstyp || '') + (en.grund ? ' – ' + en.grund : ''), b: dispB, lS, lU });
        });
      }
      if (diff !== null) {
        if (diff > 0) { const r = Math.max(0, limit - lS); lS += Math.min(diff, r); lU += diff - Math.min(diff, r); }
        else if (diff < 0) { const a = Math.abs(diff); const as = Math.min(a, lS); lS -= as; lU -= Math.min(a - as, lU); }
      }

      if (ist !== null) totalIst += ist;
      totalSoll += soll;

      rows.push({ ds, dow: wt[cur.getDay()], start: e.start||'', end: e.end||'', pausen,
        ist, soll, diff, typ: e.tagTyp || feiertag || '', kommentar: e.kommentar||'',
        lS, lU, gesamt: lS+lU, enRows });
      cur.setDate(cur.getDate() + 1);
    }

    const totalDiff = totalIst - totalSoll;
    const fmtS = v => DB.formatDuration(v, true);
    const fmtU = v => DB.formatDuration(v);
    const cls = v => v >= 0 ? 'pos' : 'neg';

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
      <title>Zeiterfassung ${von}–${bis}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:10px;margin:16px;color:#1a2e21}
        h1{font-size:14px;color:#4a7c59;margin-bottom:2px}
        .sub{font-size:9px;color:#6a8a72;margin-bottom:10px}
        table{width:100%;border-collapse:collapse;margin-top:6px}
        th{background:#4a7c59;color:white;padding:4px 3px;text-align:left;font-size:9px;white-space:nowrap}
        td{padding:3px;border-bottom:1px solid #e0e8e2;font-size:9px;white-space:nowrap}
        tr:nth-child(even) td{background:#f5f7f5}
        .pos{color:#2e7d32;font-weight:700} .neg{color:#c62828;font-weight:700}
        .we td{color:#9e9e9e}
        .sp td{background:#f0f7f0!important}
        .buch td{background:#fffde7!important;font-style:italic}
        tfoot td{font-weight:700;background:#e8f5e9;border-top:2px solid #4a7c59}
        @media print{body{margin:6px}@page{margin:10mm}}
      </style></head><body>
      <h1>Zeiterfassung Pro</h1>
      <div class="sub">${DB.formatDateDE(von)} – ${DB.formatDateDE(bis)}</div>
      <table><thead><tr>
        <th>Datum</th><th>Tag</th><th>Beginn</th><th>Ende</th>
        <th>Pausen</th><th>Ist</th><th>Soll</th><th>Diff</th>
        <th>Konto 1</th><th>Konto 2</th><th>Saldo</th>
        <th>Typ</th><th>Kommentar</th>
      </tr></thead><tbody>
      ${rows.map(r => {
        let out = '';
        // Buchungen VOR dem Arbeitstag (bereits in enRows mit Saldo nach Buchung)
        r.enRows.forEach(en => {
          out += `<tr class="buch">
            <td>${DB.formatDateDE(en.ds)}</td>
            <td colspan="7" style="color:#5d4037">${en.label}</td>
            <td class="${cls(en.lS)}">${fmtU(en.lS)}</td>
            <td class="${cls(en.lU)}">${fmtU(en.lU)}</td>
            <td class="${cls(en.lS+en.lU)}">${fmtS(en.lS+en.lU)}</td>
            <td colspan="2"></td>
          </tr>`;
        });
        // Arbeitstag-Zeile
        out += `<tr class="${r.dow==='Sa'||r.dow==='So'?'we':''} ${r.typ?'sp':''}">
          <td>${DB.formatDateDE(r.ds)}</td><td>${r.dow}</td>
          <td>${r.start}</td><td>${r.end}</td>
          <td>${r.pausen ? r.pausen+' Min' : ''}</td>
          <td>${r.ist!==null ? fmtU(r.ist) : ''}</td>
          <td>${fmtU(r.soll)}</td>
          <td class="${r.diff!==null?cls(r.diff):''}">${r.diff!==null?fmtS(r.diff):''}</td>
          <td class="${cls(r.lS)}">${fmtU(r.lS)}</td>
          <td class="${cls(r.lU)}">${fmtU(r.lU)}</td>
          <td class="${cls(r.gesamt)}">${fmtS(r.gesamt)}</td>
          <td>${r.typ}</td><td>${r.kommentar}</td>
        </tr>`;
        return out;
      }).join('')}
      </tbody><tfoot><tr>
        <td colspan="5">Gesamt</td>
        <td>${fmtU(totalIst)}</td>
        <td>${fmtU(totalSoll)}</td>
        <td class="${cls(totalDiff)}">${fmtS(totalDiff)}</td>
        <td colspan="5"></td>
      </tr></tfoot></table>
      <script>window.onload=()=>window.print();<\/script>
      </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html); w.document.close();
  },

    _buildZKRows(rows, all, von, bis) {
    const s2 = DB.getSettings();
    const limit2 = s2.ueberstundenSockelLimit;
    const enAll = DB.getEntnahmen().filter(e => (!von || e.datum >= von) && (!bis || e.datum <= bis));
    const enMap2 = {};
    enAll.forEach(e => { (enMap2[e.datum] = enMap2[e.datum] || []).push(e); });
    const dates2 = [...new Set([
      ...rows.filter(r => r.ds).map(r => r.ds),
      ...enAll.map(e => e.datum)
    ])].sort();
    let lS = 0, lU = 0, result = '';
    const fmtD = v => DB.formatDuration(v, true);
    for (const d of dates2) {
      const e2 = all[d];
      if (e2 && e2.start && e2.end) {
        const diff2 = DB.getDiffMinuten(d);
        if (diff2 > 0) { const r2 = Math.max(0, limit2 - lS); lS += Math.min(diff2, r2); lU += diff2 - Math.min(diff2, r2); }
        else if (diff2 < 0) { const a2 = Math.abs(diff2); const as2 = Math.min(a2, lS); lS -= as2; lU -= Math.min(a2 - as2, lU); }
        if (diff2 !== 0) result += '<tr><td>' + DB.formatDateDE(d) + '</td><td>Arbeitstag</td>'
          + '<td class="' + (diff2 >= 0 ? 'pos' : 'neg') + '">' + fmtD(diff2) + '</td>'
          + '<td>' + DB.formatDuration(lS) + '</td><td>' + DB.formatDuration(lU) + '</td>'
          + '<td class="' + ((lS + lU) >= 0 ? 'pos' : 'neg') + '">' + DB.formatDuration(lS + lU) + '</td></tr>';
      }
      if (enMap2[d]) {
        enMap2[d].forEach(en2 => {
          const b = en2.betragMin;
          if (b > 0) { const aU = Math.min(b, Math.max(0, lU)); lU -= aU; lS = Math.max(-999999, lS - (b - aU)); }
          else if (b < 0) { const gv = Math.abs(b); const r2 = Math.max(0, limit2 - lS); lS += Math.min(gv, r2); lU += gv - Math.min(gv, r2); }
          result += '<tr class="sp"><td>' + DB.formatDateDE(d) + '</td>'
            + '<td>Buchung: ' + (en2.buchungstyp || '') + ' ' + (en2.grund || '') + '</td>'
            + '<td class="' + (b <= 0 ? 'pos' : 'neg') + '">' + fmtD(b) + '</td>'
            + '<td>' + DB.formatDuration(lS) + '</td><td>' + DB.formatDuration(lU) + '</td>'
            + '<td class="' + ((lS + lU) >= 0 ? 'pos' : 'neg') + '">' + DB.formatDuration(lS + lU) + '</td></tr>';
        });
      }
    }
    return result;
  },

  generatePDF(von, bis) {
    const all = DB.getEintraege(); const s = DB.getSettings();
    const wt = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    let rows = [], totalIst = 0, totalSoll = 0;
    let cur = new Date((von||'2024-01-01')+'T12:00:00');
    const end = new Date((bis||DB.todayStr())+'T12:00:00');
    while (cur <= end) {
      const ds = DB.dateToStr(cur); const e = all[ds]||{};
      const ist  = e.start&&e.end ? DB.calcArbeitszeit(e) : null;
      const soll = DB.getSollMinuten(ds, s);
      const diff = ist !== null ? ist - soll : null;
      const pausen = (e.pausen||[]).reduce((a,p)=>a+(p.dauer||0),0);
      if (ist !== null) totalIst += ist;
      totalSoll += soll;
      rows.push({ds,dow:wt[cur.getDay()],start:e.start||'',end:e.end||'',pausen,ist,soll,diff,typ:e.tagTyp||window.Feiertage.isFeiertag(ds,cur.getFullYear())||'',kommentar:e.kommentar||''});
      cur.setDate(cur.getDate()+1);
    }
    const totalDiff = totalIst - totalSoll;
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
      <title>Zeiterfassung ${von}–${bis}</title>
      <style>
        body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#1a2e21}
        h1{font-size:15px;color:#4a7c59;margin-bottom:4px}
        .sub{font-size:10px;color:#6a8a72;margin-bottom:12px}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th{background:#4a7c59;color:white;padding:5px 4px;text-align:left;font-size:10px}
        td{padding:4px;border-bottom:1px solid #e0e8e2;font-size:10px}
        tr:nth-child(even){background:#f5f7f5}
        .pos{color:#2e7d32;font-weight:700} .neg{color:#c62828;font-weight:700}
        .we{color:#9e9e9e} .sp{background:#e8f5e9}
        tfoot td{font-weight:700;background:#e8f5e9;border-top:2px solid #4a7c59}
        @media print{body{margin:8px}}
      </style></head><body>
      <h1>Zeiterfassung Pro</h1>
      <div class="sub">${DB.formatDateDE(von)} – ${DB.formatDateDE(bis)}</div>
      <table><thead><tr>
        <th>Datum</th><th>Tag</th><th>Beginn</th><th>Ende</th>
        <th>Pausen</th><th>Ist</th><th>Soll</th><th>Diff</th><th>Typ</th><th>Kommentar</th>
      </tr></thead><tbody>
      ${rows.map(r=>`<tr class="${r.dow==='Sa'||r.dow==='So'?'we':''} ${r.typ?'sp':''}">
        <td>${DB.formatDateDE(r.ds)}</td><td>${r.dow}</td>
        <td>${r.start}</td><td>${r.end}</td>
        <td>${r.pausen?r.pausen+' Min':''}</td>
        <td>${r.ist!==null?DB.formatDuration(r.ist):''}</td>
        <td>${DB.formatDuration(r.soll)}</td>
        <td class="${r.diff!==null?(r.diff>=0?'pos':'neg'):''}">${r.diff!==null?DB.formatDuration(r.diff,true):''}</td>
        <td>${r.typ}</td><td>${r.kommentar}</td>
      </tr>`).join('')}
      </tbody><tfoot><tr>
        <td colspan="5">Gesamt</td>
        <td>${DB.formatDuration(totalIst)}</td>
        <td>${DB.formatDuration(totalSoll)}</td>
        <td class="${totalDiff>=0?'pos':'neg'}">${DB.formatDuration(totalDiff,true)}</td>
        <td colspan="2"></td>
      </tr></tfoot></table>
      <h2 style="font-size:13px;color:#4a7c59;margin-top:20px;border-top:2px solid #4a7c59;padding-top:8px">Zeitkonto-Verlauf</h2>
      <table><thead><tr>
        <th>Datum</th><th>Ereignis</th><th>Differenz</th>
        <th>Konto 1</th><th>Konto 2</th><th>Gesamt</th>
      </tr></thead><tbody id="zk-rows-placeholder"></tbody></table>
      <script>
        window.onload = () => {
          // inject Zeitkonto rows via DOM to avoid template literal escaping issues
          const zkData = document.getElementById('zk-data');
          if (zkData) {
            document.getElementById('zk-rows-placeholder').innerHTML = zkData.textContent;
          }
          window.print();
        };
      <\/script>
      <div id="zk-data" style="display:none">${this._buildZKRows(rows, all, von, bis)}</div>
      </body></html>`;
    const w = window.open('', '_blank');
    w.document.write(html); w.document.close();
  },

  // ─── Modal / Toast ───────────────────────────────────────────────────────
  openModal(id)   { document.getElementById(id)?.classList.add('open'); },
  closeModal(id)  { document.getElementById(id)?.classList.remove('open'); },

  showToast(msg, type = 'info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`; t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3000);
  }
};

const Notifications = {
  _lastBackupDay: null,
  _pauseReminderFired: false,

  async init() {
    // Re-request permission silently if already granted
    if ('Notification' in window && Notification.permission !== 'granted') {
      const s = DB.getSettings();
      if (s.pushNotifications) await Notification.requestPermission();
    }
    this._schedule();
  },

  async requestPermission() {
    if (!('Notification' in window)) { App.showToast('Nicht unterstützt', 'error'); return; }
    const p = await Notification.requestPermission();
    if (p === 'granted') { App.showToast('Benachrichtigungen aktiv ✓', 'success'); this._schedule(); }
    else App.showToast('Benachrichtigungen abgelehnt', 'error');
  },

  _notify(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    new Notification(title, { body, icon: 'icon-192.png' });
  },

  _schedule() {
    // Clear old interval
    if (this._interval) clearInterval(this._interval);
    this._lastMinute = '';

    this._interval = setInterval(() => {
      const s = DB.getSettings();
      if (!s.pushNotifications || !('Notification' in window) || Notification.permission !== 'granted') return;

      const now   = new Date();
      const today = DB.todayStr();
      const e     = DB.getEintrag(today);
      const hh    = String(now.getHours()).padStart(2,'0');
      const mm    = String(now.getMinutes()).padStart(2,'0');
      const ts    = `${hh}:${mm}`;

      // Prevent double-firing in same minute
      if (ts === this._lastMinute) return;
      this._lastMinute = ts;

      // Arbeitsbeginn-Erinnerung
      if (s.startErinnerung && s.startErinnerung === ts && !e?.start) {
        this._notify('Zeiterfassung', 'Arbeitszeit starten?');
      }

      // Arbeitsende-Erinnerung
      if (s.endeErinnerung && s.endeErinnerung === ts && e?.start && !e?.end) {
        this._notify('Zeiterfassung', 'Arbeitstag beenden?');
      }

      // Datensicherungs-Erinnerung (täglich einmal zur eingestellten Zeit)
      if (s.pushDatensicherung && s.datensicherungZeit) {
        const dayKey = today;
        if (s.datensicherungZeit === ts && this._lastBackupDay !== dayKey) {
          this._lastBackupDay = dayKey;
          this._notify('Zeiterfassung', 'Bitte Datensicherung durchführen');
        }
      }

      // Pause-Erinnerung: nach 5h15min ohne Pause
      if (e?.start && !e?.end) {
        const pausen = (e.pausen || []);
        const lastPauseEnd = pausen.length
          ? pausen.reduce((a,p)=>p.id>a?p.id:a, 0) // use id as proxy
          : null;
        const startMs = new Date(`${today}T${e.start}:00`).getTime();
        const pauGesamt = pausen.reduce((a,p)=>a+(p.dauer||0),0);
        // Time since last pause ended (or since start if no pauses)
        const pauseActiveMs = Timer.state.pauseLaufend && Timer.state.aktuellesPause
          ? (now - Timer.state.aktuellesPause.start) : 0;
        const netto = Math.floor((now - startMs) / 60000) - pauGesamt - Math.floor(pauseActiveMs/60000);
        const timeSinceLastPause = pauGesamt > 0
          ? (() => {
              // find the latest pause end time
              const sorted = [...pausen].sort((a,b)=>b.id-a.id);
              const last = sorted[0];
              if (!last?.end) return netto;
              return Math.floor((now - new Date(`${today}T${last.end}:00`).getTime()) / 60000);
            })()
          : netto;

        const THRESHOLD = 315; // 5h15min = 315 min
        const fireKey = `pause-remind-${today}`;
        if (timeSinceLastPause >= THRESHOLD && !localStorage.getItem(fireKey) && !Timer.state.pauseLaufend) {
          localStorage.setItem(fireKey, '1');
          const hStr = String(Math.floor(timeSinceLastPause/60)).padStart(2,'0');
          const mStr = String(timeSinceLastPause%60).padStart(2,'0');
          this._notify('Zeiterfassung', `Mach mal Pause! Du hast schon ${hStr}:${mStr} ohne Pause durchgearbeitet`);
        }
        // Reset on new day
        const yesterday = DB.dateAdd(today, -1);
        localStorage.removeItem(`pause-remind-${yesterday}`);
      }
    }, 10000); // Check every 10s for accuracy
  }
};

window.App = App;
window.Notifications = Notifications;
document.addEventListener('DOMContentLoaded', () => App.init());
