// Urlaubskonto Tab v1.0
const Urlaubskonto = {
  _expanded: null,
  _ukSign: 1, // 1 = Abzug, -1 = Gutschrift

  render() {
    const container = document.getElementById('zeitkonto-container');
    if (!container) return;

    const todayStr = DB.todayStr();
    const saldo = DB.calcUrlaubSaldo();

    // Tage genommen: alle antraege mit bis <= today (jahresübergreifend)
    const antraege = DB.getUrlaubAntraege();
    const genommen = antraege
      .filter(a => a.bis <= todayStr)
      .reduce((s,a) => s + (a.tage||0), 0);
    // Beantragt: alle antraege mit von > today
    const beantragt = antraege
      .filter(a => a.von > todayStr)
      .reduce((s,a) => s + (a.tage||0), 0);

    const fmtT = (t) => {
      if (t === Math.floor(t)) return `${t}`;
      return `${Math.floor(t)},5`;
    };

    const blue = '#4a7cb5';

    const icon_pen = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>`;

    container.innerHTML = `
      <div class="zk-header">
        <div class="zk-tab-switcher">
          <button class="zk-tab-btn" onclick="Zeitkonto.render()">Zeitkonto</button>
          <button class="zk-tab-btn active">Urlaubskonto</button>
        </div>
      </div>

      <div class="zk-kacheln-grid uk-kacheln">
        <div class="zk-kachel zk-gesamt" style="border-color:${blue}">
          <div class="zk-label" style="color:${blue}">Restlicher Urlaubsanspruch</div>
          <div class="zk-wert" style="color:${blue}">${fmtT(saldo.rest)} <span class="zk-unit">Tage</span></div>
          <div class="zk-stand">Stand ${DB.formatDateDE(todayStr)}</div>
        </div>
        <div class="zk-row2">
          <div class="zk-kachel zk-sockel" style="border-color:${blue}">
            <div class="zk-label" style="color:${blue}">Genommener Urlaub</div>
            <div class="zk-wert" style="color:${blue}">${fmtT(genommen)} <span class="zk-unit">Tage</span></div>
          </div>
          <div class="zk-kachel zk-ueber" style="border-color:${blue}">
            <div class="zk-label" style="color:${blue}">Beantragter Urlaub</div>
            <div class="zk-wert" style="color:${blue}">${fmtT(beantragt)} <span class="zk-unit">Tage</span></div>
          </div>
        </div>
      </div>

      <div class="zk-section-title">Urlaubsbuchungen</div>
      ${this._buildBuchungen(icon_pen)}

      <button class="neue-buchung-btn uk-btn" onclick="Urlaubskonto.openBuchungModal(null)">
        + Neue Urlaubskonto-Buchung
      </button>
      <button class="neue-buchung-btn uk-btn" style="margin-top:10px" onclick="Urlaubskonto.openAntragModal(null)">
        + Urlaubsantrag
      </button>`;
  },

  _buildBuchungen(icon_pen) {
    const buchungen = DB.getUrlaubBuchungen();
    const antraege = DB.getUrlaubAntraege();
    const all = [
      ...buchungen.map(b => ({ ...b, _type: 'buchung' })),
      ...antraege.map(a => ({ ...a, datum: a.von, _type: 'antrag' }))
    ];
    if (!all.length) return '<p class="no-data">Noch keine Buchungen</p>';

    const sorted = [...all].sort((a,b) => b.datum.localeCompare(a.datum));
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay()===0?6:weekStart.getDay()-1));
    weekStart.setHours(0,0,0,0);
    const weekStartStr = DB.dateToStr(weekStart);

    const weekItems = [], byYear = {};
    sorted.forEach(en => {
      if (en.datum >= weekStartStr) {
        weekItems.push(en);
      } else {
        const [y, m] = en.datum.split('-');
        if (!byYear[y]) byYear[y] = {};
        const mk = `${y}-${m}`;
        if (!byYear[y][mk]) byYear[y][mk] = [];
        byYear[y][mk].push(en);
      }
    });

    if (!this._expanded) this._expanded = { '__week__': true };

    const monthNames = ['Januar','Februar','März','April','Mai','Juni',
                        'Juli','August','September','Oktober','November','Dezember'];
    const arrowSvg = (open) => `<svg class="zk-group-arrow ${open?'open':''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;

    const fmtT = (t) => t === Math.floor(t) ? `${t}` : `${Math.floor(t)},5`;

    const renderItems = (items) => items.map(en => {
      if (en._type === 'antrag') {
        const von = DB.formatDateDE(en.von);
        const bis = DB.formatDateDE(en.bis);
        return `<div class="entnahme-item">
          <div class="entnahme-left">
            <span class="entnahme-datum">${von} – ${bis}</span>
            <span class="entnahme-tag-badge uk-badge">Urlaubsantrag</span>
            ${en.kommentar?`<span class="entnahme-grund">${en.kommentar}</span>`:''}
          </div>
          <div class="entnahme-right">
            <span class="entnahme-betrag neg">−${fmtT(en.tage)} T</span>
            <button class="icon-btn neg" onclick="Urlaubskonto.openAntragModal(${en.id})">${icon_pen}</button>
          </div>
        </div>`;
      } else {
        const pos = en.sign < 0;
        return `<div class="entnahme-item">
          <div class="entnahme-left">
            <span class="entnahme-datum">${DB.formatDateDE(en.datum)}</span>
            ${en.buchungstyp?`<span class="entnahme-tag-badge uk-badge">${en.buchungstyp}</span>`:''}
            ${en.kommentar?`<span class="entnahme-grund">${en.kommentar}</span>`:''}
          </div>
          <div class="entnahme-right">
            <span class="entnahme-betrag ${pos?'pos':'neg'}">${pos?'+':'−'}${fmtT(en.tage)} T</span>
            <button class="icon-btn ${pos?'pos':'neg'}" onclick="Urlaubskonto.openBuchungModal(${en.id})">${icon_pen}</button>
          </div>
        </div>`;
      }
    }).join('');

    let html = '';
    if (weekItems.length) {
      const open = this._expanded['__week__'] !== false;
      html += `<div class="zk-group">
        <div class="zk-group-header" onclick="Urlaubskonto.toggleGroup('__week__')">
          <span class="zk-group-label">Diese Woche</span>
          <span class="zk-group-meta">${weekItems.length} Eintrag${weekItems.length!==1?'e':''}</span>
          ${arrowSvg(open)}
        </div>
        ${open ? `<div class="kontobuchungen-list">${renderItems(weekItems)}</div>` : ''}
      </div>`;
    }

    const years = Object.keys(byYear).sort((a,b) => b-a);
    years.forEach(yr => {
      const yOpen = this._expanded[`y-${yr}`] === true;
      const monthKeys = Object.keys(byYear[yr]).sort((a,b)=>b.localeCompare(a));
      const yearTotal = monthKeys.reduce((s,k)=>s+byYear[yr][k].length,0);
      html += `<div class="zk-group zk-year-group">
        <div class="zk-group-header zk-year-header" onclick="Urlaubskonto.toggleGroup('y-${yr}')">
          <span class="zk-group-label">${yr}</span>
          <span class="zk-group-meta">${yearTotal} Eintrag${yearTotal!==1?'e':''}</span>
          ${arrowSvg(yOpen)}
        </div>`;
      if (yOpen) {
        monthKeys.forEach(mk => {
          const items = byYear[yr][mk];
          const mOpen = this._expanded[mk] === true;
          const [, m] = mk.split('-');
          html += `<div class="zk-month-group">
            <div class="zk-group-header zk-month-header" onclick="Urlaubskonto.toggleGroup('${mk}')">
              <span class="zk-group-label">${monthNames[parseInt(m)-1]}</span>
              <span class="zk-group-meta">${items.length} Eintrag${items.length!==1?'e':''}</span>
              ${arrowSvg(mOpen)}
            </div>
            ${mOpen ? `<div class="kontobuchungen-list">${renderItems(items)}</div>` : ''}
          </div>`;
        });
      }
      html += `</div>`;
    });

    return html || '<p class="no-data">Noch keine Buchungen</p>';
  },

  toggleGroup(key) {
    if (!this._expanded) this._expanded = {};
    if (key === '__week__') {
      this._expanded[key] = !(this._expanded[key] !== false);
    } else {
      this._expanded[key] = this._expanded[key] !== true;
    }
    this.render();
  },

  // ── Buchung Modal ────────────────────────────────────────────────────────
  openBuchungModal(id) {
    const modal = document.getElementById('uk-buchung-modal');
    const titleEl = document.getElementById('uk-modal-title');
    const delBtn = document.getElementById('uk-delete-btn');
    document.getElementById('uk-id').value = '';
    document.getElementById('uk-datum').value = DB.todayStr();
    document.getElementById('uk-tage').value = '';
    document.getElementById('uk-kommentar').value = '';
    this._ukSign = -1; // default Gutschrift
    document.querySelectorAll('.uk-tag').forEach(b => b.classList.remove('active'));
    this._setUkSign(-1);

    if (id) {
      const b = DB.getUrlaubBuchungen().find(x => x.id === id);
      if (b) {
        titleEl.textContent = 'Urlaubsbuchung bearbeiten';
        document.getElementById('uk-id').value = b.id;
        document.getElementById('uk-datum').value = b.datum;
        document.getElementById('uk-tage').value = String(b.tage).replace('.',',');
        document.getElementById('uk-kommentar').value = b.kommentar || '';
        this._setUkSign(b.sign);
        if (b.buchungstyp) {
          document.querySelectorAll('.uk-tag').forEach(btn => {
            if (btn.dataset.tag === b.buchungstyp) btn.classList.add('active');
          });
        }
        delBtn.style.display = 'flex';
      }
    } else {
      titleEl.textContent = 'Neue Urlaubskonto-Buchung';
      delBtn.style.display = 'none';
    }
    modal.classList.add('open');
  },

  _setUkSign(sign) {
    this._ukSign = sign;
    document.getElementById('uk-sign-plus').classList.toggle('active', sign < 0);
    document.getElementById('uk-sign-minus').classList.toggle('active', sign > 0);
  },

  setUkTag(tag, btn) {
    document.querySelectorAll('.uk-tag').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  },

  saveBuchung() {
    const id = document.getElementById('uk-id').value;
    const datum = document.getElementById('uk-datum').value;
    const tageRaw = document.getElementById('uk-tage').value.replace(',','.');
    const tage = parseFloat(tageRaw);
    const kommentar = document.getElementById('uk-kommentar').value.trim();
    const activeTag = document.querySelector('.uk-tag.active');
    const buchungstyp = activeTag ? activeTag.dataset.tag : '';

    if (!datum || isNaN(tage) || tage <= 0) return;

    const list = DB.getUrlaubBuchungen();
    if (id) {
      const idx = list.findIndex(b => b.id == id);
      if (idx >= 0) { list[idx] = { ...list[idx], datum, tage, sign: this._ukSign, buchungstyp, kommentar }; }
      DB.saveUrlaubBuchungen(list);
    } else {
      DB.addUrlaubBuchung({ datum, tage, sign: this._ukSign, buchungstyp, kommentar });
    }
    this.closeBuchungModal();
    this.render();
  },

  deleteBuchung() {
    const id = parseInt(document.getElementById('uk-id').value);
    if (!id) return;
    DB.saveUrlaubBuchungen(DB.getUrlaubBuchungen().filter(b => b.id !== id));
    this.closeBuchungModal();
    this.render();
  },

  closeBuchungModal() {
    document.getElementById('uk-buchung-modal').classList.remove('open');
  },

  // ── Antrag Modal ─────────────────────────────────────────────────────────
  openAntragModal(id) {
    const modal = document.getElementById('uk-antrag-modal');
    const delBtn = document.getElementById('uka-delete-btn');
    const titleEl = document.getElementById('uka-modal-title');
    document.getElementById('uka-id').value = '';
    document.getElementById('uka-von').value = '';
    document.getElementById('uka-bis').value = '';
    document.getElementById('uka-tage-info').textContent = '';
    document.getElementById('uka-kommentar').value = '';

    if (id) {
      const a = DB.getUrlaubAntraege().find(x => x.id === id);
      if (a) {
        titleEl.textContent = 'Urlaubsantrag bearbeiten';
        document.getElementById('uka-id').value = a.id;
        document.getElementById('uka-von').value = a.von;
        document.getElementById('uka-bis').value = a.bis;
        document.getElementById('uka-tage-info').textContent = `${this._fmtT(a.tage)} Arbeitstage`;
        document.getElementById('uka-kommentar').value = a.kommentar || '';
        delBtn.style.display = 'flex';
      }
    } else {
      titleEl.textContent = 'Neuer Urlaubsantrag';
      delBtn.style.display = 'none';
    }
    modal.classList.add('open');
  },

  updateAntragTage() {
    const von = document.getElementById('uka-von').value;
    const bis = document.getElementById('uka-bis').value;
    const info = document.getElementById('uka-tage-info');
    if (von && bis && bis >= von) {
      const tage = DB.calcUrlaubstage(von, bis);
      info.textContent = `${this._fmtT(tage)} Arbeitstage`;
    } else {
      info.textContent = '';
    }
  },

  _fmtT(t) { return t === Math.floor(t) ? `${t}` : `${Math.floor(t)},5`; },

  saveAntrag() {
    const id = document.getElementById('uka-id').value;
    const von = document.getElementById('uka-von').value;
    const bis = document.getElementById('uka-bis').value;
    const kommentar = document.getElementById('uka-kommentar').value.trim();
    if (!von || !bis || bis < von) return;

    const tage = DB.calcUrlaubstage(von, bis);

    // Mark calendar days as urlaub
    let cur = new Date(von + 'T00:00:00');
    const end = new Date(bis + 'T00:00:00');
    while (cur <= end) {
      const ds = DB.dateToStr(cur);
      const dow = cur.getDay();
      if (dow >= 1 && dow <= 5 && !Feiertage.isFeiertag(ds)) {
        const e = DB.getEintrag(ds) || {};
        if (!e.tagTyp || e.tagTyp === '') {
          DB.saveEintrag(ds, { ...e, tagTyp: 'urlaub' });
        }
      }
      cur.setDate(cur.getDate() + 1);
    }

    const list = DB.getUrlaubAntraege();
    if (id) {
      const idx = list.findIndex(a => a.id == id);
      if (idx >= 0) { list[idx] = { ...list[idx], von, bis, tage, kommentar }; }
      DB.saveUrlaubAntraege(list);
    } else {
      DB.addUrlaubAntrag({ von, bis, tage, kommentar });
    }

    this.closeAntragModal();
    this.render();
    if (window.Calendar) Calendar.render();
  },

  deleteAntrag() {
    const id = parseInt(document.getElementById('uka-id').value);
    if (!id) return;
    DB.deleteUrlaubAntrag(id);
    this.closeAntragModal();
    this.render();
  },

  closeAntragModal() {
    document.getElementById('uk-antrag-modal').classList.remove('open');
  }
};
window.Urlaubskonto = Urlaubskonto;
