// Zeitkonto Tab v3.0
const Zeitkonto = {
  render() {
    const container = document.getElementById('zeitkonto-container');
    if (!container) return;
    const ue = DB.recalcUeberstunden();
    const standDatum = ue.standDatum || DB.yesterdayStr();

    const kachelHtml = (label, wert, cls) => `
      <div class="zk-kachel ${cls}">
        <div class="zk-label">${label}</div>
        <div class="zk-wert ${wert<0?'neg':'pos'}">${DB.formatDuration(wert, true)}</div>
        <div class="zk-stand">Stand ${DB.formatDateDE(standDatum)}</div>
      </div>`;

    const icon_pen = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg>`;

    container.innerHTML = `
      <div class="zk-header">
        <div class="zk-tab-switcher">
          <button class="zk-tab-btn active">Zeitkonto</button>
          <button class="zk-tab-btn" onclick="Urlaubskonto.render()">Urlaubskonto</button>
        </div>
      </div>
      <div class="zk-kacheln-grid">
        ${kachelHtml('Gesamtsaldo', ue.gesamt, 'zk-gesamt')}
        <div class="zk-row2">
          ${kachelHtml('Konto 1', ue.sockel, 'zk-sockel')}
          ${kachelHtml('Konto 2', ue.ueberSockel, 'zk-ueber')}
        </div>
      </div>
      <div class="zk-limit-bar">
        <div class="zk-limit-label">
          <span class="zk-bar-left">Konto 1</span>
          <span class="zk-bar-right">${DB.formatDuration(ue.sockel)} / ${DB.formatDuration(ue.limit)}</span>
        </div>
        <div class="soll-bar">
          <div class="soll-bar-fill ${ue.sockel>=ue.limit?'over':''}"
               style="width:${Math.min(100,Math.max(0,Math.round(ue.sockel/ue.limit*100)))}%"></div>
        </div>
      </div>

      <div class="zk-section-title">Kontobuchungen</div>
      ${this._buildBuchungen(icon_pen)}
      <button class="neue-buchung-btn" onclick="App.openEntnahmeNeu(null)">
        + Neue Zeitkonto-Buchung
      </button>`;
  },

  _buildBuchungen(icon_pen) {
    const list = DB.getEntnahmen();
    if (!list.length) return '<p class="no-data">Noch keine Buchungen</p>';

    const sorted = [...list].sort((a,b) => b.datum.localeCompare(a.datum));
    const now    = new Date();

    // Week boundary (Monday)
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay()===0?6:weekStart.getDay()-1));
    weekStart.setHours(0,0,0,0);
    const weekStartStr = DB.dateToStr(weekStart);

    // Structure: { __week__: items[], years: { 2025: { '2025-03': items[] } } }
    const weekItems = [];
    const byYear = {}; // year → { month-key → items[] }

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

    // Init expanded state: only current week open, everything else closed
    if (!this._expanded) {
      this._expanded = { '__week__': true };
    }

    const monthNames = ['Januar','Februar','März','April','Mai','Juni',
                        'Juli','August','September','Oktober','November','Dezember'];
    const arrowSvg = (open) => `<svg class="zk-group-arrow ${open?'open':''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;

    const renderItems = (items) => items.map(en => {
      const pos = en.betragMin < 0;
      return `<div class="entnahme-item">
        <div class="entnahme-left">
          <span class="entnahme-datum">${DB.formatDateDE(en.datum)}</span>
          ${en.buchungstyp?`<span class="entnahme-tag-badge">${en.buchungstyp}`+`</span>`:''}
          ${en.grund?`<span class="entnahme-grund">${en.grund}</span>`:''}
        </div>
        <div class="entnahme-right">
          <span class="entnahme-betrag ${pos?'pos':'neg'}">${pos?'+':'−'}${DB.formatDuration(Math.abs(en.betragMin))}</span>
          <button class="icon-btn ${pos?'pos':'neg'}" onclick="App.openEntnahmeEdit(${en.id})">${icon_pen}</button>
        </div>
      </div>`;
    }).join('');

    let html = '';

    // Current week group
    if (weekItems.length) {
      const open = this._expanded['__week__'] !== false;
      html += `<div class="zk-group">
        <div class="zk-group-header" onclick="Zeitkonto.toggleGroup('__week__')">
          <span class="zk-group-label">Diese Woche</span>
          <span class="zk-group-meta">${weekItems.length} Eintrag${weekItems.length!==1?'e':''}</span>
          ${arrowSvg(open)}
        </div>
        ${open ? `<div class="kontobuchungen-list">${renderItems(weekItems)}</div>` : ''}
      </div>`;
    }

    // Year groups (descending)
    const years = Object.keys(byYear).sort((a,b) => b-a);
    years.forEach(yr => {
      const yearOpen = this._expanded[`y-${yr}`] !== false ? false : false; // years always closed by default
      // But we DO expand years if explicitly toggled
      const yOpen = this._expanded[`y-${yr}`] === true;
      const monthKeys = Object.keys(byYear[yr]).sort((a,b)=>b.localeCompare(a));
      const yearTotal = monthKeys.reduce((s,k)=>s+byYear[yr][k].length,0);

      html += `<div class="zk-group zk-year-group">
        <div class="zk-group-header zk-year-header" onclick="Zeitkonto.toggleGroup('y-${yr}')">
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
            <div class="zk-group-header zk-month-header" onclick="Zeitkonto.toggleGroup('${mk}')">
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
      // Default is closed (false), toggle to true/false
      this._expanded[key] = this._expanded[key] !== true;
    }
    this.render();
  }
};
window.Zeitkonto = Zeitkonto;
