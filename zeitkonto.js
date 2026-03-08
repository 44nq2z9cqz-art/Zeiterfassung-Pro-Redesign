// Zeitkonto Tab v2.0
const Zeitkonto = {
  render() {
    const container = document.getElementById('zeitkonto-container');
    if (!container) return;
    const ue = DB.recalcUeberstunden();
    const standDatum = ue.standDatum || DB.yesterdayStr();

    const kachelHtml = (label, wert, cls, icon) => `
      <div class="zk-kachel ${cls}">
        
        <div class="zk-label">${label}</div>
        <div class="zk-wert ${wert<0?'neg':'pos'}">${DB.formatDuration(wert, true)}</div>
        <div class="zk-stand">Stand ${DB.formatDateDE(standDatum)}</div>
      </div>`;

    container.innerHTML = `
      <div class="zk-header">
        <h2>Zeitkonto</h2>
        <span class="zk-stand-hint">Stand: Ende ${DB.formatDateDE(standDatum)}</span>
      </div>
      <div class="zk-kacheln-grid">
        ${kachelHtml('Gesamtsaldo', ue.gesamt, 'zk-gesamt', '⏱')}
        <div class="zk-row2">
          ${kachelHtml('Konto 1', ue.sockel, 'zk-sockel', '🏦')}
          ${kachelHtml('Konto 2', ue.ueberSockel, 'zk-ueber', '📈')}
        </div>
      </div>
      <div class="zk-limit-bar">
        <div class="zk-limit-label">
          <span>${DB.formatDuration(ue.sockel)} / ${DB.formatDuration(ue.limit)}</span>
        </div>
        <div class="soll-bar">
          <div class="soll-bar-fill ${ue.sockel>=ue.limit?'over':''}"
               style="width:${Math.min(100,Math.max(0,Math.round(ue.sockel/ue.limit*100)))}%"></div>
        </div>
      </div>

      <div class="zk-section-title">Kontobuchungen</div>
      ${this._buildBuchungen()}
      <button class="btn-outline btn-full mt-8" onclick="App.openEntnahmeNeu(null)">
        + Neue Zeitkonto-Buchung
      </button>`;
  },

  _buildBuchungen() {
    const list = DB.getEntnahmen();
    if (!list.length) return '<p class="no-data">Noch keine Buchungen</p>';
    const sorted = [...list].sort((a,b)=>b.datum.localeCompare(a.datum));
    return `<div class="entnahmen-list">${sorted.map(en=>`
      <div class="entnahme-item">
        <div class="entnahme-left">
          <span class="entnahme-datum">${DB.formatDateDE(en.datum)}</span>
          ${en.buchungstyp?`<span class="entnahme-tag-badge">${en.buchungstyp}</span>`:''}
          ${en.grund?`<span class="entnahme-grund">${en.grund}</span>`:''}
        </div>
        <div class="entnahme-right">
          <span class="entnahme-betrag ${en.betragMin<0?'pos':'neg'}">${en.betragMin<0?'+':'−'}${DB.formatDuration(Math.abs(en.betragMin))}</span>
          <div class="entnahme-actions">
            <button class="icon-btn ${en.betragMin<0?'pos':'neg'}" onclick="App.openEntnahmeEdit(${en.id})"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/></svg></button>
            
          </div>
        </div>
      </div>`).join('')}</div>`;
  },

  deleteEntnahme(id) {
    if (!confirm('Buchung löschen?')) return;
    DB.deleteEntnahme(id);
    this.render();
    App.showToast('Buchung gelöscht', 'info');
  },

  refresh() { if (document.getElementById('tab-zeitkonto')?.classList.contains('active')) this.render(); }
};
window.Zeitkonto = Zeitkonto;
