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
        <h2>Zeitkonto</h2>
        <span class="zk-stand-hint">Stand: Ende ${DB.formatDateDE(standDatum)}</span>
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
          <span>Konto 1 &nbsp; ${DB.formatDuration(ue.sockel)} / ${DB.formatDuration(ue.limit)}</span>
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
    const today  = DB.todayStr();
    const now    = new Date();

    // Week boundary (Monday)
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (weekStart.getDay()===0?6:weekStart.getDay()-1));
    weekStart.setHours(0,0,0,0);
    const weekStartStr = DB.dateToStr(weekStart);

    // Group: current week first, then by year-month
    const groups = {}; // key → { label, items[], expanded }
    sorted.forEach(en => {
      let key;
      if (en.datum >= weekStartStr) {
        key = '__week__';
      } else {
        const [y, m] = en.datum.split('-');
        key = `${y}-${m}`;
      }
      if (!groups[key]) groups[key] = { items: [] };
      groups[key].items.push(en);
    });

    // Determine which groups are expanded (stored in memory)
    if (!this._expanded) this._expanded = { '__week__': true };

    const monthNames = ['Januar','Februar','März','April','Mai','Juni',
                        'Juli','August','September','Oktober','November','Dezember'];

    let html = '';
    const orderedKeys = Object.keys(groups).sort((a,b) => {
      if (a==='__week__') return -1; if (b==='__week__') return 1;
      return b.localeCompare(a);
    });

    orderedKeys.forEach(key => {
      const group = groups[key];
      const isOpen = this._expanded[key] !== false;
      const label  = key==='__week__' ? 'Diese Woche'
        : (() => { const [y,m]=key.split('-'); return `${monthNames[parseInt(m)-1]} ${y}`; })();
      const count  = group.items.length;

      html += `<div class="zk-group">
        <div class="zk-group-header" onclick="Zeitkonto.toggleGroup('${key}')">
          <span class="zk-group-label">${label}</span>
          <span class="zk-group-meta">${count} Eintrag${count!==1?'e':''}</span>
          <svg class="zk-group-arrow ${isOpen?'open':''}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>`;

      if (isOpen) {
        html += `<div class="kontobuchungen-list">`;
        group.items.forEach(en => {
          const pos = en.betragMin < 0;
          html += `
          <div class="entnahme-item">
            <div class="entnahme-left">
              <span class="entnahme-datum">${DB.formatDateDE(en.datum)}</span>
              ${en.buchungstyp?`<span class="entnahme-tag-badge">${en.buchungstyp}</span>`:''}
              ${en.grund?`<span class="entnahme-grund">${en.grund}</span>`:''}
            </div>
            <div class="entnahme-right">
              <span class="entnahme-betrag ${pos?'pos':'neg'}">${pos?'+':'−'}${DB.formatDuration(Math.abs(en.betragMin))}</span>
              <button class="icon-btn ${pos?'pos':'neg'}" onclick="App.openEntnahmeEdit(${en.id})">${icon_pen}</button>
            </div>
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    });

    return html;
  },

  toggleGroup(key) {
    if (!this._expanded) this._expanded = { '__week__': true };
    this._expanded[key] = !(this._expanded[key] !== false);
    this.render();
  }
};
window.Zeitkonto = Zeitkonto;
