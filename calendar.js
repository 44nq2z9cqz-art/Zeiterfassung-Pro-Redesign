// Kalender v2.0 – nur Tageszahlen, Detailansicht darunter
const Calendar = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  selectedDate: null,
  view: 'month',

  init() { this.selectedDate = null; },

  prevPeriod() {
    this.currentMonth--;
    if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
    this.render();
  },
  nextPeriod() {
    this.currentMonth++;
    if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
    this.render();
  },
  goToToday()  { this.currentYear=new Date().getFullYear();this.currentMonth=new Date().getMonth();this.render(); },

  render() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    const names = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
    document.getElementById('cal-period-label').textContent =
      `${names[this.currentMonth]} ${this.currentYear}`;
    container.innerHTML = this._buildMonth();
    // Detailansicht wieder rendern wenn ein Tag ausgewählt ist
    if (this.selectedDate) this._renderDetail(this.selectedDate);
  },

  _kw(d) {
    const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    const day=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-day);
    const ys=new Date(Date.UTC(t.getUTCFullYear(),0,1));
    return Math.ceil((((t-ys)/86400000)+1)/7);
  },

  _buildMonth() {
    const today=DB.todayStr(); const all=DB.getEintraege();
    const s=DB.getSettings(); const y=this.currentYear; const m=this.currentMonth;
    const first=new Date(y,m,1); const last=new Date(y,m+1,0);
    const startDow=first.getDay()===0?6:first.getDay()-1;
    const dn=['Mo','Di','Mi','Do','Fr','Sa','So'];
    let html='<div class="cal-weekdays-row">';
    dn.forEach(d=>html+=`<div class="cal-weekday-label">${d}</div>`);
    html+='</div><div class="cal-grid">'; for(let i=0;i<startDow;i++) html+='<div class="cal-cell empty"></div>';
    for(let day=1;day<=last.getDate();day++) {
      const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dow=new Date(y,m,day).getDay();
      const isTod=ds===today; const isSel=ds===this.selectedDate; const isFut=ds>today;
      const e=all[ds]; const tagTyp=e?.tagTyp||'';
      const feiertag=window.Feiertage.isFeiertag(ds,y);
      const soll=DB.getSollMinuten(ds,s); const ist=e?DB.calcArbeitszeit(e):null;
      const diff=ist!==null&&soll>0?ist-soll:null;
      const hasWork     = !isFut && ist !== null;
      const hasVacation = tagTyp === 'urlaub';
      const hasSick     = tagTyp === 'krank';
      const hasHoliday  = !!feiertag;
      const hasIncomplete = !isFut && ds < today && !feiertag && tagTyp !== 'urlaub' && tagTyp !== 'krank' && soll > 0 && ist === null;
      const cls = ['cal-cell',
        isTod ? 'today' : '',
        isSel ? 'selected' : '',
        isFut ? 'future' : '',
        (dow===0||dow===6) ? 'weekend' : '',
        hasWork     ? 'has-work'       : '',
        hasVacation ? 'has-vacation'   : '',
        hasSick     ? 'has-sick'       : '',
        hasHoliday  ? 'has-holiday'    : '',
        hasIncomplete ? 'has-incomplete' : ''
      ].filter(Boolean).join(' ');
      html += `<div class="${cls}" onclick="Calendar.selectDay('${ds}')">
        <div class="cal-day-num">${day}</div>
      </div>`;
    }
    html+='</div></div>';
    // Detailbereich Platzhalter
    html+=`<div id="cal-detail-area">${this.selectedDate?'':'<p class="cal-hint">Tag antippen für Details</p>'}</div>`;
    // Auswertungen Button
    html+=`<button class="btn-auswertungen" onclick="App.openAuswertungen()">📊 Auswertungen</button>`;
    return html;
  },


  selectDay(dateStr) {
    this.selectedDate = dateStr;
    // Kalender-Zellen aktualisieren
    document.querySelectorAll('.cal-cell.selected').forEach(el=>el.classList.remove('selected'));
    const cell = document.querySelector(`[onclick="Calendar.selectDay('${dateStr}')"]`);
    if (cell) cell.classList.add('selected');
    this._renderDetail(dateStr);
  },

  _renderDetail(dateStr) {
    const area = document.getElementById('cal-detail-area');
    if (!area) return;
    const e    = DB.getEintrag(dateStr) || {};
    const s    = DB.getSettings();
    const soll = DB.getSollMinuten(dateStr, s);
    const ist  = DB.calcArbeitszeit(e);
    const diff = ist!==null ? ist-soll : null;
    const date = new Date(dateStr+'T12:00:00');
    const feiertag = window.Feiertage.isFeiertag(dateStr, date.getFullYear());
    const wt = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    const tagTyp = e.tagTyp || '';
    const pauGesamt = (e.pausen||[]).reduce((a,p)=>a+(p.dauer||0),0);

    // Typ-Buttons
    const typen = [
      {id:'urlaub', label:'🏖 Urlaub'},
      {id:'krank',  label:'🤒 Krank'},
      {id:'gleittag',label:'↕ Gleittag'},
      {id:'feiertag',label:'🎉 Feiertag'},
      {id:'dienstreise',label:'✈ Dienstreise'},
    ];

    area.innerHTML = `
      <div class="cal-detail">
        <div class="cal-detail-header">
          <h3>${wt[date.getDay()]}, ${DB.formatDateDE(dateStr)}</h3>
          ${feiertag?`<span class="badge badge-holiday">🎉 ${feiertag}</span>`:''}
        </div>

        <!-- Tag-Typ Buttons -->
        <div class="tag-typ-row">
          ${typen.map(t=>`<button class="tag-typ-btn ${tagTyp===t.id?'active':''}"
            onclick="Calendar.setTagTyp('${dateStr}','${t.id}')">${t.label}</button>`).join('')}
          ${tagTyp?`<button class="tag-typ-btn tag-typ-clear" onclick="Calendar.clearTagTyp('${dateStr}')">✕ Tag löschen</button>`:''}
        </div>

        <!-- Datenfelder -->
        <div class="cal-detail-grid">
          <div class="cal-detail-field" onclick="App.editZeit('${dateStr}','start')">
            <span class="cdf-label">Arbeitsbeginn</span>
            <span class="cdf-wert ${!e.start?'missing':''}">${e.start||'–'}</span>
            <span class="cdf-edit">✏️</span>
          </div>
          <div class="cal-detail-field" onclick="App.editZeit('${dateStr}','end')">
            <span class="cdf-label">Arbeitsende</span>
            <span class="cdf-wert ${!e.end?'missing':''}">${e.end||'–'}</span>
            <span class="cdf-edit">✏️</span>
          </div>
          <div class="cal-detail-field" onclick="App.editPausenDetail('${dateStr}')">
            <span class="cdf-label">Pausen gesamt</span>
            <span class="cdf-wert">${DB.formatDuration(pauGesamt)}</span>
            <span class="cdf-edit">✏️</span>
          </div>
          <div class="cal-detail-field" onclick="App.editSoll('${dateStr}')">
            <span class="cdf-label">Sollzeit</span>
            <span class="cdf-wert">${DB.formatDuration(soll)}</span>
            <span class="cdf-edit">✏️</span>
          </div>
          ${diff!==null?`
          <div class="cal-detail-field no-tap">
            <span class="cdf-label">Differenz</span>
            <span class="cdf-wert ${diff>=0?'pos':'neg'}">${DB.formatDuration(diff,true)}</span>
          </div>`:''}
        </div>

        <!-- Kommentar -->
        <div class="cal-detail-field" onclick="App.editKommentar('${dateStr}')">
          <span class="cdf-label">Kommentar</span>
          <span class="cdf-wert ${!e.kommentar?'missing':''}">${e.kommentar||'– tippen zum Bearbeiten'}</span>
          <span class="cdf-edit">✏️</span>
        </div>

        <!-- Kontobuchung -->
        <button class="btn-outline btn-full mt-8" onclick="App.openEntnahmeNeu('${dateStr}')">
          + Zeitkonto-Buchung für diesen Tag
        </button>

        <!-- Eintrag löschen -->
        ${(e.start||e.end||e.tagTyp||e.kommentar)?`
        <button class="btn-danger-outline btn-full mt-4" onclick="Calendar.deleteEintrag('${dateStr}')">
          🗑 Eintrag löschen
        </button>`:''}
      </div>`;
  },

  setTagTyp(dateStr, typ) {
    const e = DB.getEintrag(dateStr) || {};
    if (e.tagTyp === typ) return this.clearTagTyp(dateStr);
    DB.saveEintrag(dateStr, { tagTyp: typ });
    this.selectedDate = dateStr;
    this.render();
    App.showToast(`${typ} gesetzt ✓`, 'success');
  },

  clearTagTyp(dateStr) {
    const e = DB.getEintrag(dateStr) || {};
    delete e.tagTyp;
    delete e.sollOverrideMinuten;
    DB.saveEintrag(dateStr, { tagTyp: null, sollOverrideMinuten: null });
    this.selectedDate = dateStr;
    this.render();
    App.showToast('Tag-Typ entfernt', 'info');
  },

  deleteEintrag(dateStr) {
    if (!confirm(`Eintrag für ${DB.formatDateDE(dateStr)} wirklich löschen?`)) return;
    DB.deleteEintrag(dateStr);
    this.selectedDate = dateStr;
    this.render();
    App.showToast('Eintrag gelöscht', 'info');
  }
};
window.Calendar = Calendar;
