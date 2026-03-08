// Einstellungen v2.3 – nativer iOS-Zeitpicker überall, kein Startsaldo
const Settings = {
  _page: 'main',
  APP_VERSION: '3.0.0',

  render() {
    const c = document.getElementById('settings-container');
    if (!c) return;
    if (this._page === 'main') this._renderMain(c);
    else this._renderSubPage(c, this._page);
  },

  _renderMain(c) {
    c.innerHTML = `
      <div class="settings-menu">
        ${[
          ['arbeitszeit',  '#4a7c59',
           '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
           'Einstellungen Arbeitszeit'],
          ['zeitkonto',    '#3a5fa0',
           '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
           'Einstellungen Zeitkonto'],
          ['timetracking', '#7a6030',
           '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
           'Timetracking'],
          ['notifications','#8B3A3A',
           '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
           'Benachrichtigungen'],
          ['daten',        '#5a5a6a',
           '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
           'Daten & Backup'],
        ].map(([p,color,svg,lb]) => `
          <div class="settings-menu-item" onclick="Settings.goTo('${p}')">
            <span class="smi-icon-tile" style="background:${color}">${svg}</span>
            <span class="smi-label">${lb}</span>
            <span class="smi-arrow">›</span>
          </div>`).join('')}
      </div>
      <div class="settings-section mt-16">
        <div class="settings-card">
          <div class="setting-row danger-row">
            <label>Alle Daten löschen</label>
            <button class="btn-danger btn-sm" onclick="Settings.deleteAll()"> Löschen</button>
          </div>
        </div>
      </div>
      <div class="settings-version">Version ${this.APP_VERSION}</div>`;
  },

  goTo(page) {
    this._page = page;
    const c = document.getElementById('settings-container');
    if (c) this._renderSubPage(c, page);
  },
  goBack() { this._page = 'main'; this.render(); },

  _back(title) {
    return `<div class="subpage-header">
      <button class="back-btn" onclick="Settings.goBack()">‹ Einstellungen</button>
      <h3>${title}</h3>
    </div>`;
  },

  // ─── hhhh:mm Helfer ─────────────────────────────────────────────────────
  _minToHHMM(min) {
    const abs = Math.abs(min || 0);
    return `${String(Math.floor(abs/60)).padStart(3,'0')}:${String(abs%60).padStart(2,'0')}`;
  },
  _hhmmToMin(str) {
    if (!str) return 0;
    const parts = str.replace(/[^0-9:]/g,'').split(':');
    const h = parseInt(parts[0]||0);
    const m = parseInt(parts[1]||0);
    return h * 60 + Math.min(59, m);
  },
  validateHHMM(el) {
    const min = this._hhmmToMin(el.value);
    el.value = this._minToHHMM(min);
  },

  // ─── Helfer: Zeit in Minuten ────────────────────────────────────────────
  // Native <input type="time"> gibt "HH:MM" zurück → in Minuten
  _timeVal(id) {
    const v = document.getElementById(id)?.value || '00:00';
    const [h, m] = v.split(':').map(Number);
    return h * 60 + m;
  },
  // Minuten → "HH:MM" für input[type=time]
  _minToTime(min) {
    const abs = Math.abs(min || 0);
    return `${String(Math.floor(abs/60)).padStart(2,'0')}:${String(abs%60).padStart(2,'0')}`;
  },
  // Native time field HTML
  _timeField(id, minutes, label) {
    return `
      <div class="native-time-field">
        <span class="ntf-label">${label}</span>
        <input type="time" id="${id}" class="ntf-input" value="${this._minToTime(minutes)}" step="60">
      </div>`;
  },

  _renderSubPage(c, page) {
    const s = DB.getSettings();

    const pages = {
      arbeitszeit: () => `
        ${this._back('Einstellungen Arbeitszeit')}
        <div class="settings-info-box">Änderungen wirken ab dem aktuellen Tag als Standard.</div>
        <div class="settings-section">
          <div class="settings-card">
            ${this._timeField('s-soll',        s.sollarbeitszeitMinuten,    'Arbeitszeit Mo–Fr')}
            ${this._timeField('s-urlaub',       s.sollUrlaubKrankMinuten||0, 'Soll-Zeit Urlaub / Krank')}
            ${this._timeField('s-halbtag',      s.sollFeiertageHalbMinuten||240, 'Soll-Zeit 24.12 + 31.12')}
          </div>
        </div>
        <button class="btn-primary btn-full mt-8" onclick="Settings.saveArbeitszeit()">Speichern</button>`,

      zeitkonto: () => `
        ${this._back('Einstellungen Zeitkonto')}
        <div class="settings-info-box">Nur das Sockel-Limit für Konto 1. Vortragsbeträge als Zeitkonto-Buchung eintragen.</div>
        <div class="settings-section">
          <div class="settings-card">
            <div class="native-time-field">
              <span class="ntf-label">Sockel-Limit Konto 1 (z.B. 040:00)</span>
              <input type="text" id="s-limit" class="ntf-input hhmm-input"
                value="${Settings._minToHHMM(s.ueberstundenSockelLimit)}"
                placeholder="040:00"
                pattern="[0-9]+:[0-5][0-9]"
                inputmode="numeric"
                onblur="Settings.validateHHMM(this)">
            </div>
          </div>
        </div>
        <button class="btn-primary btn-full mt-8" onclick="Settings.saveZeitkonto()">Speichern</button>`,

      timetracking: () => `
        ${this._back('Timetracking')}
        <div class="settings-info-box">Stoppuhr-Korrektur in Sekunden. Negativ = früher, Positiv = später.</div>
        <div class="settings-section">
          <div class="settings-card">
            ${[
              ['pauseStartKorrekturSek', 'Verzögerung Pause Start'],
              ['pauseEndeKorrekturSek',  'Verzögerung Pause Stopp'],
              ['tagStartKorrekturSek',   'Verzögerung Tagesbeginn'],
              ['tagEndeKorrekturSek',    'Verzögerung Tagesende'],
            ].map(([key, label]) => `
              <div class="setting-row setting-row-col">
                <label>${label}</label>
                <div class="slider-row">
                  <input type="range" id="sl-${key}" min="-120" max="120" step="1"
                    value="${s[key]||0}" class="sek-slider"
                    oninput="document.getElementById('sv-${key}').textContent=(+this.value>0?'+':'')+this.value+'s'">
                  <span class="slider-val" id="sv-${key}">${(s[key]||0)>0?'+'+(s[key]||0):'s[key]'||0}s</span>
                </div>
              </div>`).join('')}
          </div>
        </div>
        <button class="btn-primary btn-full mt-8" onclick="Settings.saveTimetracking()">Speichern</button>`,

      notifications: () => `
        ${this._back('Benachrichtigungen')}
        <div class="settings-section">
          <div class="settings-card">
            <div class="setting-row">
              <label>Push-Benachrichtigungen</label>
              <div class="toggle-wrap">
                <div class="toggle-wrap"><input type="checkbox" class="toggle-input" id="s-push" ${s.pushNotifications?'checked':''} onchange="Settings.togglePush(this.checked)"><label class="toggle-label" for="s-push"></label></div>
                <label for="s-push" class="toggle-label"></label>
              </div>
            </div>
            <div class="setting-row">
              <label>Erinnerung Arbeitsbeginn</label>
              <input type="time" class="setting-input" id="s-start-reminder" value="${s.startErinnerung||''}">
            </div>
            <div class="setting-row">
              <label>Erinnerung Arbeitsende</label>
              <input type="time" class="setting-input" id="s-end-reminder" value="${s.endeErinnerung||''}">
            </div>
            <div class="setting-row">
              <label>Benachrichtigung bei Pausen</label>
              <div class="toggle-wrap">
                <div class="toggle-wrap"><input type="checkbox" class="toggle-input" id="s-push-pause" ${s.pushPauseStart?'checked':''} ><label class="toggle-label" for="s-push-pause"></label></div>
                <label for="s-push-pause" class="toggle-label"></label>
              </div>
            </div>
            <div class="setting-row">
              <label>Erinnerung Datensicherung</label>
              <select class="setting-input" id="s-datensicherung">
                <option value="" ${!s.pushDatensicherung?'selected':''}>Aus</option>
                <option value="daily"  ${s.pushDatensicherung==='daily'?'selected':''}>Täglich</option>
                <option value="weekly" ${s.pushDatensicherung==='weekly'?'selected':''}>Wöchentlich</option>
              </select>
            </div>
            <div class="setting-row setting-row-col">
              <label>E-Mail für Tagesabschluss-Bericht</label>
              <input type="email" class="setting-input" id="s-email"
                value="${s.emailEmpfaenger||''}" placeholder="deine@email.de"
                style="max-width:100%;width:100%">
            </div>
          </div>
        </div>
        <button class="btn-primary btn-full mt-8" onclick="Settings.saveNotifications()">Speichern</button>`,

      daten: () => `
        ${this._back('Daten & Backup')}
        <div class="settings-section">
          <div class="settings-card">
            <div class="setting-row">
              <label>Backup erstellen</label>
              <button class="btn-outline btn-sm" onclick="DB.createBackup()">💾 Download</button>
            </div>
            <div class="setting-row">
              <label>Backup wiederherstellen</label>
              <button class="btn-outline btn-sm" onclick="Settings.triggerRestore()">📂 Datei wählen</button>
              <input type="file" id="restore-file" accept=".json" style="display:none"
                onchange="Settings.doRestore(event)">
            </div>
          </div>
        </div>
        <div class="settings-version">Version ${this.APP_VERSION}</div>`
    };

    c.innerHTML = pages[page]?.() || '';
    // Fix timetracking slider display values
    if (page === 'timetracking') {
      ['pauseStartKorrekturSek','pauseEndeKorrekturSek','tagStartKorrekturSek','tagEndeKorrekturSek'].forEach(key => {
        const v = s[key] || 0;
        const el = document.getElementById(`sv-${key}`);
        if (el) el.textContent = (v > 0 ? '+' : '') + v + 's';
      });
    }
  },

  // ─── Speichern ──────────────────────────────────────────────────────────
  saveArbeitszeit() {
    const s = DB.getSettings();
    const soll = this._timeVal('s-soll');
    DB.saveSettings({ ...s,
      sollarbeitszeitMinuten:   soll || 480,
      sollUrlaubKrankMinuten:   this._timeVal('s-urlaub'),
      sollFeiertageHalbMinuten: this._timeVal('s-halbtag'),
    });
    DB.recalcUeberstunden();
    App.showToast('Arbeitszeit gespeichert ✓', 'success');
    this.goBack();
  },

  saveZeitkonto() {
    const s = DB.getSettings();
    const limit = this._hhmmToMin(document.getElementById('s-limit')?.value);
    DB.saveSettings({ ...s,
      ueberstundenSockelLimit: limit || 2400,
      // Startsaldo-Felder komplett entfernen/nullen
      startsaldoDatum: null,
      startsaldoSockel: 0,
      startsaldoUeberSockel: 0,
    });
    DB.recalcUeberstunden();
    App.showToast('Zeitkonto gespeichert ✓', 'success');
    this.goBack();
  },

  saveTimetracking() {
    const s = DB.getSettings();
    DB.saveSettings({ ...s,
      pauseStartKorrekturSek: parseInt(document.getElementById('sl-pauseStartKorrekturSek')?.value||0),
      pauseEndeKorrekturSek:  parseInt(document.getElementById('sl-pauseEndeKorrekturSek')?.value||0),
      tagStartKorrekturSek:   parseInt(document.getElementById('sl-tagStartKorrekturSek')?.value||0),
      tagEndeKorrekturSek:    parseInt(document.getElementById('sl-tagEndeKorrekturSek')?.value||0),
    });
    App.showToast('Timetracking gespeichert ✓', 'success');
    this.goBack();
  },

  saveNotifications() {
    const s = DB.getSettings();
    DB.saveSettings({ ...s,
      pushNotifications: document.getElementById('s-push')?.checked ?? false,
      startErinnerung:   document.getElementById('s-start-reminder')?.value || null,
      endeErinnerung:    document.getElementById('s-end-reminder')?.value || null,
      pushPauseStart:    document.getElementById('s-push-pause')?.checked ?? false,
      pushPauseEnde:     document.getElementById('s-push-pause')?.checked ?? false,
      pushDatensicherung:document.getElementById('s-datensicherung')?.value || null,
      emailEmpfaenger:   document.getElementById('s-email')?.value || '',
    });
    App.showToast('Benachrichtigungen gespeichert ✓', 'success');
    this.goBack();
  },

  togglePush(en) { if (en) Notifications.requestPermission(); },
  triggerRestore() { document.getElementById('restore-file')?.click(); },
  doRestore(ev) {
    const f = ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = e => {
      try { DB.restoreBackup(e.target.result); App.showToast('Backup wiederhergestellt ✓', 'success'); App.init(); }
      catch (er) { App.showToast('Fehler: ' + er.message, 'error'); }
    };
    r.readAsText(f);
  },
  deleteAll() {
    if (!confirm('Wirklich alle Daten löschen? Nicht rückgängig machbar!')) return;
    [DB.KEYS.EINTRAEGE, DB.KEYS.SETTINGS, DB.KEYS.UEBERSTUNDEN, DB.KEYS.ENTNAHMEN]
      .forEach(k => localStorage.removeItem(k));
    App.showToast('Alle Daten gelöscht', 'info');
    App.init();
  }
};
window.Settings = Settings;
