// Zeitkonto Tab v2.0
const Zeitkonto = {
  render() {
    const container = document.getElementById('zeitkonto-container');
    if (!container) return;
    const ue = DB.recalcUeberstunden();
    const standDatum = ue.standDatum || DB.yesterdayStr();

    const kachelHtml = (label, wert, cls, icon) => `
      <div class="zk-kachel ${cls}">
        <div class="zk-icon">${icon}</div>
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
        ${kachelHtml('Gesamtsaldo', ue.gesamt, 'zk-gesamt', '')}
        <div class="zk-row2">
          ${kachelHtml('Konto 1', ue.sockel, 'zk-sockel', '')}
          ${kachelHtml('Konto 2', ue.ueberSockel, 'zk-ueber', '')}
        </div>
      </div>
      <div class="zk-limit-bar">
        <div class="zk-limit-label">
          <span>Sockel-Füllstand</span>
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
          <span class="entnahme-konto">${en.konto==='sockel'?'Konto 1 · Sockel':'Konto 2 · Über Sockel'}</span>
          ${en.buchungstyp?`<span class="entnahme-tag-badge">${en.buchungstyp}</span>`:''}
          ${en.grund?`<span class="entnahme-grund">${en.grund}</span>`:''}
        </div>
        <div class="entnahme-right">
          <span class="entnahme-betrag ${en.betragMin<0?'pos':'neg'}">${en.betragMin<0?'+':'−'}${DB.formatDuration(Math.abs(en.betragMin))}</span>
          <div class="entnahme-actions">
            <button class="icon-btn" onclick="App.openEntnahmeEdit(${en.id})">✏️</button>
            
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
