// Kalender v3.0
const Calendar = {
  currentYear:  new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  selectedDate: null,

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
  goToToday() {
    this.currentYear  = new Date().getFullYear();
    this.currentMonth = new Date().getMonth();
    this.render();
  },

  render() {
    const container = document.getElementById('calendar-container');
    if (!container) return;
    const names = ['Januar','Februar','März','April','Mai','Juni',
                   'Juli','August','September','Oktober','November','Dezember'];
    document.getElementById('cal-period-label').textContent =
      `${names[this.currentMonth]} ${this.currentYear}`;
    container.innerHTML = this._buildMonth();
  },

  _buildMonth() {
    const today = DB.todayStr();
    const all   = DB.getEintraege();
    const s     = DB.getSettings();
    const y = this.currentYear, m = this.currentMonth;
    const first = new Date(y, m, 1);
    const last  = new Date(y, m+1, 0);
    const startDow = first.getDay() === 0 ? 6 : first.getDay() - 1;
    const dn = ['Mo','Di','Mi','Do','Fr','Sa','So'];

    let html = '<div class="cal-weekdays-row">';
    dn.forEach(d => html += `<div class="cal-weekday-label">${d}</div>`);
    html += '</div><div class="cal-grid">';

    for (let i = 0; i < startDow; i++) html += '<div class="cal-cell empty"></div>';

    for (let day = 1; day <= last.getDate(); day++) {
      const ds  = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const dow = new Date(y, m, day).getDay();
      const isTod = ds === today;
      const isSel = ds === this.selectedDate;
      const isFut = ds > today;
      const e       = all[ds];
      const tagTyp  = e?.tagTyp || '';
      const feiertag = window.Feiertage.isFeiertag(ds, y);
      const soll    = DB.getSollMinuten(ds, s);
      const ist     = e ? DB.calcArbeitszeit(e) : null;

      // Strip logic — only work days WITH actual start AND end get green
      const hasWork     = !isFut && e?.start && e?.end;
      const hasVacation = tagTyp === 'urlaub';
      const hasSick     = tagTyp === 'krank';
      const hasHoliday  = !!feiertag;

      const cls = ['cal-cell',
        isTod ? 'today' : '',
        isSel ? 'selected' : '',
        isFut ? 'future' : '',
        (dow === 0 || dow === 6) ? 'weekend' : '',
        hasWork     ? 'has-work'     : '',
        hasVacation ? 'has-vacation' : '',
        hasSick     ? 'has-sick'     : '',
        hasHoliday  ? 'has-holiday'  : '',
      ].filter(Boolean).join(' ');

      html += `<div class="${cls}" onclick="Calendar.selectDay('${ds}')">
        <div class="cal-day-num">${day}</div>
      </div>`;
    }

    html += '</div>';
    html += `<button class="btn-auswertungen" onclick="App.openAuswertungen()">Auswertungen</button>`;
    return html;
  },

  selectDay(dateStr) {
    this.selectedDate = dateStr;
    document.querySelectorAll('.cal-cell.selected').forEach(el => el.classList.remove('selected'));
    const cell = document.querySelector(`[onclick="Calendar.selectDay('${dateStr}')"]`);
    if (cell) cell.classList.add('selected');
    App.openCalOverlay(dateStr);
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
    DB.saveEintrag(dateStr, { tagTyp: null, sollOverrideMinuten: null });
    this.selectedDate = dateStr;
    this.render();
    App.showToast('Tag-Typ entfernt', 'info');
  },

  deleteEintrag(dateStr) {
    if (!confirm(`Eintrag für ${DB.formatDateDE(dateStr)} wirklich löschen?`)) return;
    DB.deleteEintrag(dateStr);
    this.selectedDate = null;
    this.render();
    App.closeModal('cal-overlay');
    App.showToast('Eintrag gelöscht', 'info');
  }
};
window.Calendar = Calendar;
