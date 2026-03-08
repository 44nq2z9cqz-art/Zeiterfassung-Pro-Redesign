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
    if (tab === 'today')      { Timer.render(); this.renderHeutePausen(DB.todayStr()); }
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
    if (!confirm(`Sollzeit für ${DB.formatDateDE(dateStr)} anpassen?`)) return;
    const e = DB.getEintrag(dateStr) || {};
    const s = DB.getSettings();
    const cur = typeof e.sollOverrideMinuten === 'number' ? e.sollOverrideMinuten : DB.getSollMinuten(dateStr, s);
    document.getElementById('es-date').value = dateStr;
    document.getElementById('es-drum-wrap').innerHTML = Drum.html('esSoll', cur, { maxH: 24 });
    document.getElementById('edit-soll-modal').classList.add('open');
    requestAnimationFrame(() => Drum.initAll(document.getElementById('es-drum-wrap')));
  },

  saveSoll() {
    const dateStr = document.getElementById('es-date').value;
    DB.saveEintrag(dateStr, { sollOverrideMinuten: Drum.getMinutes('esSoll') });
    this.closeModal('edit-soll-modal');
    App.showToast('Sollzeit gespeichert ✓', 'success');
    Calendar.selectedDate = dateStr; Calendar.render();
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
          <button class="icon-btn danger" onclick="App.deletePauseFromModal('${dateStr}',${p.id})">🗑</button>
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
  async init() {
    const s = DB.getSettings();
    if (s.pushNotifications && 'Notification' in window && Notification.permission === 'granted') this._schedule();
  },
  async requestPermission() {
    if (!('Notification' in window)) { App.showToast('Nicht unterstützt', 'error'); return; }
    const p = await Notification.requestPermission();
    if (p === 'granted') { App.showToast('Benachrichtigungen aktiv ✓', 'success'); this._schedule(); }
    else App.showToast('Benachrichtigungen abgelehnt', 'error');
  },
  _schedule() {
    const s = DB.getSettings();
    setInterval(() => {
      const now = new Date();
      const ts  = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const today = DB.todayStr(); const e = DB.getEintrag(today);
      if (s.startErinnerung === ts && !e?.start) new Notification('Zeiterfassung', { body: '⏰ Arbeitszeit starten?', icon: 'icon-192.png' });
      if (s.endeErinnerung  === ts && e?.start && !e?.end) new Notification('Zeiterfassung', { body: '🔔 Arbeitstag beenden?', icon: 'icon-192.png' });
    }, 60000);
  }
};

window.App = App;
window.Notifications = Notifications;
document.addEventListener('DOMContentLoaded', () => App.init());
