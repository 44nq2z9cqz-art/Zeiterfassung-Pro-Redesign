// Data Layer v2.0
const DB = {
  KEYS: {
    EINTRAEGE:        'ze_eintraege',
    SETTINGS:         'ze_settings',
    UEBERSTUNDEN:     'ze_ueberstunden',
    ENTNAHMEN:        'ze_entnahmen',
    URLAUB_BUCHUNGEN: 'ze_urlaub_buchungen',
    URLAUB_ANTRAEGE:  'ze_urlaub_antraege'
  },

  defaultSettings() {
    return {
      sollarbeitszeitMinuten: 480,       // Mo-Fr Standard
      sollUrlaubKrankMinuten: 0,         // Urlaub/Krank
      sollFeiertageHalbMinuten: 240,     // 24.12 + 31.12
      ueberstundenSockelLimit: 40 * 60,
      pauseStartKorrekturSek: 0,
      pauseEndeKorrekturSek: 0,
      tagStartKorrekturSek: 0,
      tagEndeKorrekturSek: 0,
      pushNotifications: false,
      pushPauseStart: false,
      pushPauseEnde: false,
      pushDatensicherung: null,          // 'daily' | 'weekly' | null
      startErinnerung: null,
      endeErinnerung: null,
      emailEmpfaenger: '',
      zeitzone: 'Europe/Berlin'
    };
  },

  getSettings() {
    try {
      const s = localStorage.getItem(this.KEYS.SETTINGS);
      const merged = s ? { ...this.defaultSettings(), ...JSON.parse(s) } : this.defaultSettings();
      // Migration: remove startsaldo fields (replaced by Zeitkonto-Buchungen)
      delete merged.startsaldoDatum;
      delete merged.startsaldoSockel;
      delete merged.startsaldoUeberSockel;
      return merged;
    } catch { return this.defaultSettings(); }
  },
  saveSettings(s) { localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(s)); },

  // ─── Einträge ─────────────────────────────────────────────────────────────
  getEintraege() {
    try { const e = localStorage.getItem(this.KEYS.EINTRAEGE); return e ? JSON.parse(e) : {}; }
    catch { return {}; }
  },
  getEintrag(d) { return this.getEintraege()[d] || null; },
  saveEintrag(dateStr, patch) {
    const all = this.getEintraege();
    // Handle null-Felder: sollOverrideMinuten=null → löschen
    const existing = all[dateStr] || { dateStr };
    const merged = { ...existing, ...patch, dateStr };
    if (patch.sollOverrideMinuten === null) delete merged.sollOverrideMinuten;
    // Tag-Array sauber zusammenführen
    all[dateStr] = merged;
    localStorage.setItem(this.KEYS.EINTRAEGE, JSON.stringify(all));
    this.recalcUeberstunden();
  },
  deleteEintrag(dateStr) {
    const all = this.getEintraege();
    delete all[dateStr];
    localStorage.setItem(this.KEYS.EINTRAEGE, JSON.stringify(all));
    this.recalcUeberstunden();
  },

  // ─── Pausen ───────────────────────────────────────────────────────────────
  addPause(dateStr, pause) {
    const all = this.getEintraege();
    if (!all[dateStr]) all[dateStr] = { dateStr };
    if (!all[dateStr].pausen) all[dateStr].pausen = [];
    all[dateStr].pausen.push({ ...pause, id: Date.now() });
    localStorage.setItem(this.KEYS.EINTRAEGE, JSON.stringify(all));
    this.recalcUeberstunden();
  },
  updatePause(dateStr, id, upd) {
    const all = this.getEintraege();
    if (all[dateStr]?.pausen)
      all[dateStr].pausen = all[dateStr].pausen.map(p => p.id === id ? { ...p, ...upd } : p);
    localStorage.setItem(this.KEYS.EINTRAEGE, JSON.stringify(all));
    this.recalcUeberstunden();
  },
  deletePause(dateStr, id) {
    const all = this.getEintraege();
    if (all[dateStr]?.pausen)
      all[dateStr].pausen = all[dateStr].pausen.filter(p => p.id !== id);
    localStorage.setItem(this.KEYS.EINTRAEGE, JSON.stringify(all));
    this.recalcUeberstunden();
  },

  // ─── Entnahmen ────────────────────────────────────────────────────────────
  getEntnahmen() {
    try { const e = localStorage.getItem(this.KEYS.ENTNAHMEN); return e ? JSON.parse(e) : []; }
    catch { return []; }
  },
  _saveEntnahmen(list) {
    list.sort((a, b) => a.datum.localeCompare(b.datum));
    localStorage.setItem(this.KEYS.ENTNAHMEN, JSON.stringify(list));
    this.recalcUeberstunden();
  },
  addEntnahme(e)      { const l = this.getEntnahmen(); l.push({ ...e, id: Date.now() }); this._saveEntnahmen(l); },
  updateEntnahme(id, upd) { this._saveEntnahmen(this.getEntnahmen().map(e => e.id===id ? {...e,...upd} : e)); },
  deleteEntnahme(id)  { this._saveEntnahmen(this.getEntnahmen().filter(e => e.id !== id)); },

  // ─── Berechnungen ─────────────────────────────────────────────────────────
  calcArbeitszeit(eintrag) {
    if (!eintrag?.start || !eintrag?.end) return null;
    const s = this.timeToMinutes(eintrag.start);
    const e = this.timeToMinutes(eintrag.end);
    if (e <= s) return null;
    const pausen = (eintrag.pausen || []).reduce((a, p) => a + (p.dauer || 0), 0);
    return (e - s) - pausen + (eintrag.anpassungMinuten || 0);
  },

  getSollMinuten(dateStr, settings) {
    const s = settings || this.getSettings();
    const eintrag = this.getEintrag(dateStr);
    // Manueller Override pro Tag
    if (eintrag && typeof eintrag.sollOverrideMinuten === 'number') return eintrag.sollOverrideMinuten;
    // Urlaub/Krank Tag
    if (eintrag?.tagTyp === 'urlaub' || eintrag?.tagTyp === 'krank') return s.sollUrlaubKrankMinuten ?? 0;
    return window.Feiertage.getSollarbeitszeit(dateStr, s);
  },

  getDiffMinuten(dateStr) {
    const eintrag = this.getEintrag(dateStr);
    const ist  = eintrag ? this.calcArbeitszeit(eintrag) : 0;
    const soll = this.getSollMinuten(dateStr);
    if (ist === null) return soll > 0 ? -soll : 0;
    return (ist || 0) - soll;
  },

  // ─── Überstunden (mit Startsaldo + Entnahmen) ─────────────────────────────
  recalcUeberstunden() {
    const s      = this.getSettings();
    const all    = this.getEintraege();
    const today  = this.todayStr();
    const yesterday = this.dateAdd(today, -1);
    const limit  = s.ueberstundenSockelLimit;
    // Kein Startsaldo mehr aus Einstellungen - alles über Zeitkonto-Buchungen
    let sockel      = 0;
    let ueberSockel = 0;

    // Entnahmen-Map aufbauen (alle)
    const entnahmen = this.getEntnahmen();
    const entnahmenMap = {};
    entnahmen.forEach(e => { (entnahmenMap[e.datum] = entnahmenMap[e.datum] || []).push(e); });

    // Alle relevanten Daten bis gestern (Vortag)
    const arbDaten  = Object.keys(all).filter(d => d <= yesterday);
    const entDaten  = Object.keys(entnahmenMap).filter(d => d <= yesterday);
    const allDates  = [...new Set([...arbDaten, ...entDaten])].sort();

    for (const d of allDates) {
      if (all[d]) {
        const diff = this.getDiffMinuten(d);
        if (diff > 0) {
          const raum = Math.max(0, limit - sockel);
          sockel     += Math.min(diff, raum);
          ueberSockel+= diff - Math.min(diff, raum);
        } else if (diff < 0) {
          const abzug = Math.abs(diff);
          const as    = Math.min(abzug, sockel);
          sockel     -= as;
          ueberSockel-= Math.min(abzug - as, ueberSockel);
        }
      }
      if (entnahmenMap[d]) {
        entnahmenMap[d].forEach(en => {
          // Auto-Logik: zuerst aus Konto 2 (über Sockel), dann aus Konto 1 (Sockel)
          // Für Korrekturen (positiv) werden Stunden hinzugefügt
          const betrag = en.betragMin; // kann negativ sein (Korrektur/Gutschrift)
          if (betrag > 0) {
            // Abzug: erst aus ueberSockel, dann aus sockel
            const ausUeber = Math.min(betrag, Math.max(0, ueberSockel));
            ueberSockel -= ausUeber;
            const rest = betrag - ausUeber;
            sockel = Math.max(-999999, sockel - rest);
          } else if (betrag < 0) {
            // Gutschrift: wie Überstunden (erst sockel füllen, dann ueberSockel)
            const gutschrift = Math.abs(betrag);
            const raum = Math.max(0, limit - sockel);
            sockel += Math.min(gutschrift, raum);
            ueberSockel += gutschrift - Math.min(gutschrift, raum);
          }
        });
      }
    }

    const result = { sockel, ueberSockel, gesamt: sockel + ueberSockel, limit,
                     standDatum: yesterday, updatedAt: Date.now() };
    localStorage.setItem(this.KEYS.UEBERSTUNDEN, JSON.stringify(result));
    return result;
  },

  getUeberstunden() {
    try {
      const u = localStorage.getItem(this.KEYS.UEBERSTUNDEN);
      return u ? JSON.parse(u) : this.recalcUeberstunden();
    } catch { return { sockel: 0, ueberSockel: 0, gesamt: 0 }; }
  },

  // ─── Helfer ───────────────────────────────────────────────────────────────
  timeToMinutes(t) { if (!t) return 0; const [h,m] = t.split(':').map(Number); return h*60+m; },
  minutesToTime(min) {
    const abs = Math.abs(min);
    return `${String(Math.floor(abs/60)).padStart(2,'0')}:${String(abs%60).padStart(2,'0')}`;
  },
  formatDuration(min, showSign=false) {
    if (min===null||min===undefined) return '--:--';
    const sign = min<0 ? '-' : (showSign&&min>0 ? '+' : '');
    return `${sign}${Math.floor(Math.abs(min)/60)}:${String(Math.abs(min)%60).padStart(2,'00')} h`;
  },
  dateToTimeStr(date, korSek=0) {
    const d = new Date(date.getTime() + korSek*1000);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },
  todayStr()    { return new Date().toISOString().substring(0,10); },
  yesterdayStr(){ return this.dateAdd(this.todayStr(), -1); },
  dateToStr(d)  { return d.toISOString().substring(0,10); },
  dateAdd(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return this.dateToStr(d);
  },
  formatDateDE(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' });
  },

  // ─── Backup & Restore ─────────────────────────────────────────────────────
  createBackup() {
    const b = { version:'2.0.0', exportedAt: new Date().toISOString(), app:'Zeiterfassung Pro',
                data:{ eintraege:this.getEintraege(), settings:this.getSettings(), entnahmen:this.getEntnahmen() } };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(b,null,2)],{type:'application/json'}));
    a.download = `zeiterfassung-backup-${this.todayStr()}.json`; a.click();
  },
  restoreBackup(jsonStr) {
    const b = JSON.parse(jsonStr);
    if (b.app !== 'Zeiterfassung Pro') throw new Error('Ungültiges Backup');
    localStorage.setItem(this.KEYS.EINTRAEGE, JSON.stringify(b.data.eintraege));
    localStorage.setItem(this.KEYS.SETTINGS,  JSON.stringify(b.data.settings));
    localStorage.setItem(this.KEYS.ENTNAHMEN, JSON.stringify(b.data.entnahmen||[]));
    this.recalcUeberstunden(); return true;
  },

  // ─── CSV Export ───────────────────────────────────────────────────────────
  exportCSV(von, bis) {
    const all = this.getEintraege(); const s = this.getSettings();
    const wt  = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    const rows = [['Datum','Wochentag','Beginn','Ende','Pausen(min)','Ist(min)','Soll(min)','Diff(min)','Typ','Kommentar'].join(';')];
    let cur = new Date((von||'2024-01-01')+'T12:00:00');
    const end = new Date((bis||this.todayStr())+'T12:00:00');
    while (cur <= end) {
      const ds = this.dateToStr(cur); const e = all[ds]||{};
      const pausen = (e.pausen||[]).reduce((a,p)=>a+(p.dauer||0),0);
      const ist  = e.start&&e.end ? this.calcArbeitszeit(e) : '';
      const soll = this.getSollMinuten(ds,s);
      rows.push([ds, wt[cur.getDay()], e.start||'', e.end||'', pausen||'',
        ist!==''?ist:'', soll, ist!==''?(ist-soll):'',
        e.tagTyp||window.Feiertage.isFeiertag(ds,cur.getFullYear())||'',
        (e.kommentar||'').replace(/;/g,',')].join(';'));
      cur.setDate(cur.getDate()+1);
    }
    const entnahmen = this.getEntnahmen().filter(e=>e.datum>=von&&e.datum<=bis);
    if (entnahmen.length) {
      rows.push(''); rows.push('Kontobuchungen;;;;;;;;;');
      rows.push('Datum;Konto;Betrag(min);Betrag;Grund;;;;;');
      entnahmen.forEach(en=>rows.push([en.datum,
        en.konto==='sockel'?'Konto 1':'Konto 2',
        en.betragMin, this.formatDuration(en.betragMin),
        (en.grund||'').replace(/;/g,',')].join(';')));
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\uFEFF'+rows.join('\n')],{type:'text/csv;charset=utf-8'}));
    a.download = `zeiterfassung-${von||'alle'}-${bis||'heute'}.csv`; a.click();
  },

  // ─── E-Mail Tagesabschluss ────────────────────────────────────────────────
  buildEmailEntwurf(dateStr) {
    const s = this.getSettings(); const e = this.getEintrag(dateStr)||{};
    const ist  = this.calcArbeitszeit(e); const soll = this.getSollMinuten(dateStr,s);
    const diff = ist!==null ? ist-soll : null;
    const pausen = (e.pausen||[]);
    const pausenText = pausen.length
      ? pausen.map(p=>`  ${p.start}–${p.end} (${p.dauer} Min)`).join('\n')
      : '  Keine Pausen';
    const body = encodeURIComponent(
      `Arbeitszeiterfassung ${this.formatDateDE(dateStr)}\n` +
      `─────────────────────────\n` +
      `Beginn:       ${e.start||'–'}\n` +
      `Ende:         ${e.end||'–'}\n` +
      `Pausen:\n${pausenText}\n` +
      `Pausen gesamt: ${DB.formatDuration(pausen.reduce((a,p)=>a+(p.dauer||0),0))} (${pausen.reduce((a,p)=>a+(p.dauer||0),0)} Minuten)\n` +
      `─────────────────────────\n` +
      `Ist-Zeit:     ${ist!==null?this.formatDuration(ist):'–'}\n` +
      `Soll-Zeit:    ${this.formatDuration(soll)}\n` +
      `Differenz:    ${diff!==null?this.formatDuration(diff,true):'–'}\n` +
      (e.kommentar ? `\nKommentar: ${e.kommentar}\n` : '') +
      `\n– Gesendet von Zeiterfassung Pro`
    );
    const to = s.emailEmpfaenger ? encodeURIComponent(s.emailEmpfaenger) : '';
    const subject = encodeURIComponent(`Arbeitszeit ${this.formatDateDE(dateStr)}`);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }
};
  // ── Urlaubskonto ────────────────────────────────────────────────────────
  getUrlaubBuchungen() {
    try { const e = localStorage.getItem(this.KEYS.URLAUB_BUCHUNGEN); return e ? JSON.parse(e) : []; }
    catch { return []; }
  },
  saveUrlaubBuchungen(list) { localStorage.setItem(this.KEYS.URLAUB_BUCHUNGEN, JSON.stringify(list)); },
  addUrlaubBuchung(b) {
    const list = this.getUrlaubBuchungen(); b.id = Date.now(); list.push(b);
    this.saveUrlaubBuchungen(list); return b;
  },
  deleteUrlaubBuchung(id) { this.saveUrlaubBuchungen(this.getUrlaubBuchungen().filter(b => b.id !== id)); },

  getUrlaubAntraege() {
    try { const e = localStorage.getItem(this.KEYS.URLAUB_ANTRAEGE); return e ? JSON.parse(e) : []; }
    catch { return []; }
  },
  saveUrlaubAntraege(list) { localStorage.setItem(this.KEYS.URLAUB_ANTRAEGE, JSON.stringify(list)); },
  addUrlaubAntrag(a) {
    const list = this.getUrlaubAntraege(); a.id = Date.now(); list.push(a);
    this.saveUrlaubAntraege(list); return a;
  },
  deleteUrlaubAntrag(id) {
    const list = this.getUrlaubAntraege();
    const antrag = list.find(a => a.id === id);
    this.saveUrlaubAntraege(list.filter(a => a.id !== id));
    return antrag;
  },

  // Arbeitstage berechnen (Mo–Fr, keine Feiertage, 24.12+31.12 = 0.5 wenn Werktag)
  calcUrlaubstage(fromStr, toStr) {
    let days = 0;
    let cur = new Date(fromStr + 'T00:00:00');
    const end = new Date(toStr + 'T00:00:00');
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow >= 1 && dow <= 5) {
        const ds = this.dateToStr(cur);
        if (!Feiertage.isFeiertag(ds)) {
          const m = cur.getMonth()+1, d = cur.getDate();
          days += ((m===12 && d===24) || (m===12 && d===31)) ? 0.5 : 1;
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  },

  // Gesamtsaldo jahresübergreifend — kein Verfall beim Jahreswechsel
  calcUrlaubSaldo() {
    const buchungen = this.getUrlaubBuchungen();
    const zugaenge    = buchungen.filter(b => b.sign < 0).reduce((s,b) => s + b.tage, 0);
    const korrekturen = buchungen.filter(b => b.sign > 0).reduce((s,b) => s + b.tage, 0);
    const antraege    = this.getUrlaubAntraege();
    const beantragt   = antraege.reduce((s,a) => s + (a.tage||0), 0);
    return { zugaenge, korrekturen, beantragt, rest: zugaenge - korrekturen - beantragt };
  }
};
window.DB = DB;
