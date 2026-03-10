// Timer v3.0
const Timer = {
  state: { arbeitsStart:null, arbeitsEnd:null, aktuellesPause:null, laufend:false, pauseLaufend:false },
  _ticker: null,

  init() {
    const today = DB.todayStr();
    const e = DB.getEintrag(today);
    if (e?.start) { this.state.arbeitsStart = new Date(`${today}T${e.start}:00`); this.state.laufend = !e.end; }
    if (e?.end)   { this.state.arbeitsEnd   = new Date(`${today}T${e.end}:00`);   this.state.laufend = false; }
    if (e?._pauseAktiv) {
      this.state.aktuellesPause = { start: new Date(e._pauseAktiv), id: e._pauseAktivId };
      this.state.pauseLaufend = true;
    }
    this.startTicker();
    this.render();
  },

  haptic(type='light') {
    if ('vibrate' in navigator) {
      const pat = { light:[30], medium:[50,30,50], heavy:[80,40,80] };
      navigator.vibrate(pat[type]||pat.light);
    }
  },

  arbeitsStart() {
    const s = DB.getSettings();
    const korr = s.tagStartKorrekturSek || 0;
    const korrigiert = new Date(new Date().getTime() + korr * 1000);
    const today = DB.todayStr();
    this.state.arbeitsStart = korrigiert; this.state.laufend = true; this.state.arbeitsEnd = null;
    DB.saveEintrag(today, { start: DB.dateToTimeStr(korrigiert), end: null });
    this.haptic('medium'); this.render();
    App.showToast('Arbeitszeit gestartet ✓', 'success');
  },

  arbeitsEnde() {
    if (!this.state.laufend) return;
    if (!confirm('Wollen Sie den Arbeitstag wirklich beenden?')) return;
    if (this.state.pauseLaufend) this.pauseEnde(true);
    const s = DB.getSettings();
    const korr = s.tagEndeKorrekturSek || 0;
    const korrigiert = new Date(new Date().getTime() + korr * 1000);
    const today = DB.todayStr();
    this.state.arbeitsEnd = korrigiert; this.state.laufend = false;
    DB.saveEintrag(today, { end: DB.dateToTimeStr(korrigiert) });
    this.haptic('heavy'); this.render();
    App.showToast('Arbeitszeit beendet ✓', 'success');
    const ss = DB.getSettings();
    if (ss.emailEmpfaenger) {
      setTimeout(() => {
        if (confirm('Tagesbericht per E-Mail senden?')) DB.buildEmailEntwurf(today);
      }, 600);
    }
    App.renderHeutePausen(today);
  },

  pauseStart() {
    if (!this.state.laufend || this.state.pauseLaufend) return;
    const s = DB.getSettings();
    const korr = s.pauseStartKorrekturSek || 0;
    const korrigiert = new Date(new Date().getTime() + korr*1000);
    const id = Date.now();
    this.state.aktuellesPause = { start: korrigiert, id };
    this.state.pauseLaufend = true;
    const all = DB.getEintraege(); const today = DB.todayStr();
    if (!all[today]) all[today] = { dateStr: today };
    all[today]._pauseAktiv     = korrigiert.toISOString();
    all[today]._pauseAktivId   = id;
    all[today]._pauseStartKorr = korr;
    localStorage.setItem(DB.KEYS.EINTRAEGE, JSON.stringify(all));
    this.haptic('light'); this.render();
    App.showToast('Pause gestartet', 'info');
    if (s.pushPauseStart && Notification.permission==='granted')
      new Notification('Pausenbeginn', { body: `Pause gestartet um ${DB.dateToTimeStr(korrigiert)}`, icon:'icon-192.png' });
  },

  pauseEnde(silent=false) {
    if (!this.state.pauseLaufend || !this.state.aktuellesPause) return;
    const s = DB.getSettings();
    const korr = s.pauseEndeKorrekturSek || 0;
    const korrigiertesEnde = new Date(new Date().getTime() + korr*1000);
    const start = this.state.aktuellesPause.start;
    const dauerMs  = Math.max(0, korrigiertesEnde - start);
    const dauerSek = Math.floor(dauerMs / 1000);
    const dauerMin = Math.floor(dauerSek / 60);
    const startStr = DB.dateToTimeStr(start);
    const endStr   = DB.dateToTimeStr(korrigiertesEnde);
    const today = DB.todayStr();
    const all = DB.getEintraege();
    if (all[today]) { delete all[today]._pauseAktiv; delete all[today]._pauseAktivId; delete all[today]._pauseStartKorr; }
    localStorage.setItem(DB.KEYS.EINTRAEGE, JSON.stringify(all));
    DB.addPause(today, { start: startStr, end: endStr, dauer: dauerMin, dauerSek, korrekturStart: all[today]?._pauseStartKorr||0, korrekturEnde: korr });
    this.state.aktuellesPause = null; this.state.pauseLaufend = false;
    this.haptic('light'); this.render();
    if (!silent) {
      App.showToast(`Pause beendet: ${dauerMin} Min ✓`, 'success');
      if (s.pushPauseStart && Notification.permission==='granted')
        new Notification('Pausenende', { body: `Pause beendet – Dauer: ${dauerMin} Min`, icon:'icon-192.png' });
    }
    App.renderHeutePausen(today);
  },

  startTicker() {
    if (this._ticker) clearInterval(this._ticker);
    this._ticker = setInterval(() => { if (this.state.laufend||this.state.pauseLaufend) this._tick(); }, 1000);
  },

  _tick() {
    const now = new Date(); const today = DB.todayStr();
    const e = DB.getEintrag(today);
    if (this.state.laufend && this.state.arbeitsStart) {
      const brutto = Math.floor((now - this.state.arbeitsStart)/60000);
      const pausen = (e?.pausen||[]).reduce((a,p)=>a+(p.dauer||0),0);
      const pauseJetzt = this.state.pauseLaufend && this.state.aktuellesPause
        ? Math.floor((now - this.state.aktuellesPause.start)/60000) : 0;
      const netto = brutto - pausen - pauseJetzt;
      const el = document.getElementById('live-arbeitszeit');
      if (el) el.textContent = DB.formatDuration(netto);
      if (this.state.pauseLaufend) {
        const pel = document.getElementById('live-pause-dauer');
        if (pel) {
          const pSec = Math.floor((now - this.state.aktuellesPause.start) / 1000);
          const pMin = Math.floor(pSec / 60);
          const pSecRest = pSec % 60;
          pel.textContent = `${pMin}:${String(pSecRest).padStart(2,'0')} min`;
        }
      }
      // Live progress bar update
      const barFill = document.getElementById('live-bar-fill');
      if (barFill) {
        const s2 = DB.getSettings();
        const soll2 = DB.getSollMinuten(today, s2);
        if (soll2 > 0) {
          const pct = Math.min(100, Math.round(netto / soll2 * 100));
          barFill.style.width = pct + '%';
        }
      }
    }
  },

  // SVG icons
  _svgPlay:  `<svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>`,
  _svgStop:  `<svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg>`,
  _svgPause: `<svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/></svg>`,
  _svgResume:`<svg width="33" height="33" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg>`,
  _svgDone:  `<svg class="done-icon" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>`,
  _svgSpin:  `<svg class="spin-icon" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
  _svgPauseBlink: `<svg class="blink-icon" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="10" x2="10" y1="15" y2="9"/><line x1="14" x2="14" y1="15" y2="9"/></svg>`,

  render() {
    const container = document.getElementById('timer-section');
    if (!container) return;
    const today = DB.todayStr();
    const e = DB.getEintrag(today);
    const s = DB.getSettings();
    const soll = DB.getSollMinuten(today, s);
    const ist  = e ? DB.calcArbeitszeit(e) : null;
    const diff = ist !== null ? ist - soll : null;
    const feiertag = window.Feiertage.isFeiertag(today, new Date().getFullYear());
    const tagTyp = e?.tagTyp || '';
    const wt = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    const heute = new Date();
    const datumStr = heute.toLocaleDateString('de-DE', {day:'2-digit',month:'long',year:'numeric'});
    const pauGesamt = (e?.pausen||[]).reduce((a,p)=>a+(p.dauer||0),0);

    // Header badges (Feiertag, Urlaub, Krank)
    let headerBadge = '';
    if (feiertag)
      headerBadge = `<span class="badge badge-holiday">${feiertag}</span>`;
    else if (tagTyp==='urlaub')
      headerBadge = `<span class="badge badge-vacation">Urlaubstag</span>`;
    else if (tagTyp==='krank')
      headerBadge = `<span class="badge badge-sick">Kranktag</span>`;

    // Kachel indicator (animated icons + done)
    let kachelIcon = '';
    if (this.state.pauseLaufend)
      kachelIcon = `<span class="timer-indicator pause-indicator">${this._svgPauseBlink}</span>`;
    else if (this.state.laufend)
      kachelIcon = `<span class="timer-indicator run-indicator">${this._svgSpin}</span>`;
    else if (e?.end)
      kachelIcon = `<span class="timer-indicator done-indicator">${this._svgDone}</span>`;

    // Animated border state
    const cardClass = 'timer-card';

    container.innerHTML = `
      <div class="${cardClass}" id="timer-card">
        <div class="timer-header">
          <div class="timer-date">
            <span class="timer-weekday">${wt[heute.getDay()]}</span>
            <span class="timer-datum">${datumStr}</span>
          </div>
          ${headerBadge}
        </div>

        ${kachelIcon ? `<div class="kachel-indicator">${kachelIcon}</div>` : ''}
        <div class="timer-zeiten">
          <div class="zeit-block">
            <span class="zeit-label">Beginn</span>
            <span class="zeit-wert">${e?.start||'--:--'}</span>
          </div>
          <div class="zeit-block">
            <span class="zeit-label">Ende</span>
            <span class="zeit-wert">${e?.end||'--:--'}</span>
          </div>
          <div class="zeit-block">
            <span class="zeit-label">Pause</span>
            <span class="zeit-wert">${DB.formatDuration(pauGesamt)}</span>
          </div>
          <div class="zeit-block highlight">
            <span class="zeit-label">Arbeitszeit</span>
            <span class="zeit-wert" id="live-arbeitszeit">${ist!==null?DB.formatDuration(ist):'--:--'}</span>
          </div>
        </div>
        ${soll>0?`
        <div class="soll-bar-container">
          <div class="soll-bar-labels">
            <span>Soll: ${DB.formatDuration(soll)}</span>
            ${diff!==null?`<span class="diff-indicator ${diff>=0?'positive':'negative'}">${DB.formatDuration(diff,true)}</span>`:''}
          </div>
          <div class="soll-bar"><div class="soll-bar-fill ${diff!==null&&diff>=0?'over':''}"
            id="live-bar-fill" style="width:${ist!==null?Math.min(100,Math.round(ist/soll*100)):0}%"></div></div>
        </div>`:''}
        ${e?.kommentar?`<div class="timer-kommentar"><span>${e.kommentar}</span></div>`:''}
        <div class="timer-buttons">${this._renderButtons(e, feiertag, tagTyp)}</div>
      </div>
      ${this.state.pauseLaufend?`
      <div class="pause-laufend-card">
        <div class="pause-laufend-info">
          <span class="pulse-dot"></span>
          <span>Pause seit ${e?._pauseAktiv?new Date(e._pauseAktiv).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'--:--'}</span>
        </div>
        <span class="pause-live" id="live-pause-dauer">0:00 min</span>
      </div>`:''}`;


  },

  _renderButtons(e, feiertag, tagTyp) {
    if (!this.state.laufend && !e?.end)
      return `<button class="btn-primary btn-lg" onclick="Timer.arbeitsStart()">${this._svgPlay}</button>`;

    if (this.state.laufend) {
      if (this.state.pauseLaufend)
        return `<div class="btn-row">
          <button class="btn-pause btn-lg" onclick="Timer.pauseEnde()" style="flex:1">${this._svgResume}</button>
          <button class="btn-end btn-lg" onclick="Timer.arbeitsEnde()" style="flex:1">${this._svgStop}</button>
        </div>`;
      return `<div class="btn-row">
        <button class="btn-pause btn-lg" onclick="Timer.pauseStart()" style="flex:1">${this._svgPause}</button>
        <button class="btn-end btn-lg" onclick="Timer.arbeitsEnde()" style="flex:1">${this._svgStop}</button>
      </div>`;
    }

    if (e?.end)
      return `<button class="btn-outline btn-sm btn-full" onclick="App.openKalenderTag('${DB.todayStr()}')">Eintrag bearbeiten</button>`;
    return '';
  },

};
window.Timer = Timer;
