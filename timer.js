// Timer v2.0
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

  // ─── Haptic ───────────────────────────────────────────────────────────────
  haptic(type='light') {
    if ('vibrate' in navigator) {
      const pat = { light:[30], medium:[50,30,50], heavy:[80,40,80] };
      navigator.vibrate(pat[type]||pat.light);
    }
  },

  // ─── Arbeit ───────────────────────────────────────────────────────────────
  arbeitsStart() {
    const s = DB.getSettings();
    const korr = s.tagStartKorrekturSek || 0;
    const now = new Date();
    const korrigiert = new Date(now.getTime() + korr * 1000);
    const today = DB.todayStr();
    this.state.arbeitsStart = korrigiert; this.state.laufend = true; this.state.arbeitsEnd = null;
    DB.saveEintrag(today, { start: DB.dateToTimeStr(korrigiert), end: null });
    this.haptic('medium');
    this.render();
    App.showToast('Arbeitszeit gestartet ✓', 'success');
  },

  arbeitsEnde() {
    if (!this.state.laufend) return;
    if (!confirm('Wollen Sie den Arbeitstag wirklich beenden?')) return;
    if (this.state.pauseLaufend) this.pauseEnde(true);
    const s = DB.getSettings();
    const korr = s.tagEndeKorrekturSek || 0;
    const now = new Date();
    const korrigiert = new Date(now.getTime() + korr * 1000);
    const today = DB.todayStr();
    this.state.arbeitsEnd = korrigiert; this.state.laufend = false;
    DB.saveEintrag(today, { end: DB.dateToTimeStr(korrigiert) });
    this.haptic('heavy');
    this.render();
    App.showToast('Arbeitszeit beendet ✓', 'success');
    // E-Mail Entwurf anbieten
    if (s.emailEmpfaenger) {
      setTimeout(() => {
        if (confirm('Tagesbericht per E-Mail senden?')) DB.buildEmailEntwurf(today);
      }, 600);
    }
    App.renderHeutePausen(today);
  },

  // ─── Pause ────────────────────────────────────────────────────────────────
  pauseStart() {
    if (!this.state.laufend || this.state.pauseLaufend) return;
    const s = DB.getSettings();
    const korr = s.pauseStartKorrekturSek || 0;
    const now  = new Date();
    const korrigiert = new Date(now.getTime() + korr*1000);
    const id = Date.now();
    this.state.aktuellesPause = { start: korrigiert, id };
    this.state.pauseLaufend = true;
    const all = DB.getEintraege(); const today = DB.todayStr();
    if (!all[today]) all[today] = { dateStr: today };
    all[today]._pauseAktiv      = korrigiert.toISOString();
    all[today]._pauseAktivId    = id;
    all[today]._pauseStartKorr  = korr;
    localStorage.setItem(DB.KEYS.EINTRAEGE, JSON.stringify(all));
    this.haptic('light');
    this.render();
    App.showToast('Pause gestartet', 'info');
    if (s.pushPauseStart && Notification.permission==='granted')
      new Notification('Pausenbeginn', { body: `Pause gestartet um ${DB.dateToTimeStr(korrigiert)}`, icon:'icon-192.png' });
  },

  pauseEnde(silent=false) {
    if (!this.state.pauseLaufend || !this.state.aktuellesPause) return;
    const s = DB.getSettings();
    const korr = s.pauseEndeKorrekturSek || 0;
    const now  = new Date();
    const korrigiertesEnde = new Date(now.getTime() + korr*1000);
    const start = this.state.aktuellesPause.start;
    const dauerMs  = Math.max(0, korrigiertesEnde - start);
    const dauerSek = Math.floor(dauerMs / 1000);
    const dauerMin = Math.floor(dauerSek / 60);  // abgerundet für Bilanz
    const startStr = DB.dateToTimeStr(start);
    const endStr   = DB.dateToTimeStr(korrigiertesEnde);
    const today = DB.todayStr();

    // Aktive Pause-Flags entfernen
    const all = DB.getEintraege();
    if (all[today]) { delete all[today]._pauseAktiv; delete all[today]._pauseAktivId; delete all[today]._pauseStartKorr; }
    localStorage.setItem(DB.KEYS.EINTRAEGE, JSON.stringify(all));

    // dauerSek gespeichert für genaue Anzeige; dauer (Minuten) für Bilanzberechnung
    DB.addPause(today, { start: startStr, end: endStr, dauer: dauerMin, dauerSek, korrekturStart: all[today]?._pauseStartKorr||0, korrekturEnde: korr });
    this.state.aktuellesPause = null; this.state.pauseLaufend = false;
    this.haptic('light');
    this.render();
    if (!silent) {
      App.showToast(`Pause beendet: ${dauerMin} Min ✓`, 'success');
      if (s.pushPauseStart && Notification.permission==='granted')
        new Notification('Pausenende', { body: `Pause beendet – Dauer: ${dauerMin} Min`, icon:'icon-192.png' });
    }
    App.renderHeutePausen(today);
  },

  // ─── Ticker ───────────────────────────────────────────────────────────────
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
    }
  },

  // ─── Render ───────────────────────────────────────────────────────────────
  render() {
    const container = document.getElementById('timer-section');
    if (!container) return;
    const today = DB.todayStr(); const e = DB.getEintrag(today);
    const s = DB.getSettings(); const soll = DB.getSollMinuten(today, s);
    const ist  = e ? DB.calcArbeitszeit(e) : null;
    const diff = ist!==null ? ist-soll : null;
    const feiertag = window.Feiertage.isFeiertag(today, new Date().getFullYear());
    const tagTyp = e?.tagTyp || '';

    const wt = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
    const heute = new Date();
    const datumStr = heute.toLocaleDateString('de-DE', {day:'2-digit',month:'long',year:'numeric'});

    let badge = '';
    if (feiertag)               badge=`<span class="badge badge-holiday">🎉 ${feiertag}</span>`;
    else if (tagTyp==='urlaub') badge=`<span class="badge badge-vacation">🏖 Urlaubstag</span>`;
    else if (tagTyp==='krank')  badge=`<span class="badge badge-sick">🤒 Kranktag</span>`;
    else if (this.state.pauseLaufend) badge=`<span class="badge badge-pause">⏸ Pause</span>`;
    else if (this.state.laufend) badge=`<span class="badge badge-running">● Läuft</span>`;
    else if (e?.end)             badge=`<span class="badge badge-done">✓ Abgeschlossen</span>`;

    const pauGesamt = (e?.pausen||[]).reduce((a,p)=>a+(p.dauer||0),0);

    container.innerHTML = `
      <div class="timer-card">
        <div class="timer-header">
          <div class="timer-date">
            <span class="timer-weekday">${wt[heute.getDay()]}</span>
            <span class="timer-datum">${datumStr}</span>
          </div>
          ${badge}
        </div>
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
            style="width:${ist!==null?Math.min(100,Math.round(ist/soll*100)):0}%"></div></div>
        </div>`:''}
        ${e?.kommentar?`<div class="timer-kommentar"><span>💬</span><span>${e.kommentar}</span></div>`:''}
        <div class="timer-buttons">${this._renderButtons(e, feiertag, tagTyp, soll)}</div>
      </div>
      ${this.state.pauseLaufend?`
      <div class="pause-laufend-card">
        <div class="pause-laufend-info"><span class="pulse-dot"></span>
          <span>Pause seit ${e?._pauseAktiv?new Date(e._pauseAktiv).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'--:--'}</span>
        </div>
        <span class="pause-live" id="live-pause-dauer">0:00h</span>
      </div>`:''}`;
  },

  _renderButtons(e, feiertag, tagTyp, soll) {
    if (!this.state.laufend && !e?.end)
      return `<button class="btn-primary btn-lg" onclick="Timer.arbeitsStart()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        Arbeit starten</button>`;
    if (this.state.laufend)
      return `<div class="btn-row">
        ${!this.state.pauseLaufend
          ?`<button class="btn-secondary" onclick="Timer.pauseStart()">⏸ Pause</button>`
          :`<button class="btn-pause-end" onclick="Timer.pauseEnde()">▶ Pause beenden</button>`}
        <button class="btn-danger" onclick="Timer.arbeitsEnde()">⏹ Beenden</button>
      </div>`;
    if (e?.end)
      return `<button class="btn-outline btn-sm" onclick="App.openKalenderTag('${DB.todayStr()}')">✏️ Eintrag bearbeiten</button>`;
    return '';
  }
};
window.Timer = Timer;
