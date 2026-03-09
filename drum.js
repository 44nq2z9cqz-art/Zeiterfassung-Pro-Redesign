// Drum Picker v2 – korrekte Indexierung, kein DOM-Padding-Bug
// Verwendet ausschließlich CSS-Padding für visuelle Zentrierung.
// DOM-Struktur: nur echte Items, kein Pad-Overhead.
// idx = scrollTop / ITEM_H  ->  direkte 1:1 Abbildung auf Wert

const Drum = {
  ITEM_H: 44,   // px – etwas größer für bessere Bedienbarkeit

  // Erzeugt HTML-String für einen Picker (h:mm oder hh:mm)
  html(id, totalMin, opts = {}) {
    const { maxH = 999, label = 'h\u00a0min' } = opts;
    const h = Math.floor(Math.abs(totalMin) / 60);
    const m = Math.abs(totalMin) % 60;
    return `
      <div class="drum-picker" data-id="${id}" data-maxh="${maxH}">
        <div class="drum-highlight"></div>
        <div class="drum-fade-top"></div>
        <div class="drum-fade-bot"></div>
        <div class="drum-col" id="dc-${id}-h" data-val="${h}" data-min="0" data-max="${maxH}"></div>
        <div class="drum-sep">:</div>
        <div class="drum-col" id="dc-${id}-m" data-val="${m}" data-min="0" data-max="59"></div>
        <div class="drum-unit">${label}</div>
      </div>`;
  },

  // Picker für Uhrzeit (0–23 : 0–59), label "Uhr"
  htmlTime(id, timeStr) {
    const parts = (timeStr || '08:00').split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return `
      <div class="drum-picker" data-id="${id}">
        <div class="drum-highlight"></div>
        <div class="drum-fade-top"></div>
        <div class="drum-fade-bot"></div>
        <div class="drum-col" id="dc-${id}-h" data-val="${h}" data-min="0" data-max="23"></div>
        <div class="drum-sep">:</div>
        <div class="drum-col" id="dc-${id}-m" data-val="${m}" data-min="0" data-max="59"></div>
        <div class="drum-unit">Uhr</div>
      </div>`;
  },

  // Initialisiert alle .drum-picker im Container (default: document)
  initAll(container) {
    const root = container || document;
    root.querySelectorAll('.drum-picker[data-id]').forEach(picker => {
      const id = picker.dataset.id;
      picker.querySelectorAll('.drum-col').forEach(col => {
        this._initCol(col);
      });
    });
  },

  _initCol(col) {
    const minV = parseInt(col.dataset.min);
    const maxV = parseInt(col.dataset.max);
    const initV = Math.max(minV, Math.min(maxV, parseInt(col.dataset.val) || minV));
    const IH = this.ITEM_H;
    const VISIBLE = 5; // sichtbare Items
    const PAD_PX  = Math.floor(VISIBLE / 2) * IH; // 2 * IH = visuelles Padding

    // Items aufbauen
    let html = '';
    for (let v = minV; v <= maxV; v++) {
      html += `<div class="drum-item">${String(v).padStart(2, '0')}</div>`;
    }
    col.innerHTML = `<div class="drum-scroll" style="padding:${PAD_PX}px 0">${html}</div>`;

    const scroll = col.querySelector('.drum-scroll');

    // Zum Initialwert scrollen (kein smooth)
    scroll.scrollTop = (initV - minV) * IH;

    // Snap bei Scroll-Ende
    let snapTimer;
    const snapToValue = () => {
      const idx = Math.round(scroll.scrollTop / IH);
      const clampedIdx = Math.max(0, Math.min(maxV - minV, idx));
      const newTop = clampedIdx * IH;
      if (Math.abs(scroll.scrollTop - newTop) > 1) {
        scroll.scrollTo({ top: newTop, behavior: 'smooth' });
      }
      const newVal = clampedIdx + minV;
      if (parseInt(col.dataset.val) !== newVal) {
        col.dataset.val = newVal;
        // Highlight-Aktualisierung
        this._updateHighlight(scroll, clampedIdx);
        // Callback zum Picker
        const picker = col.closest('.drum-picker');
        if (picker) this._notify(picker);
      }
    };

    scroll.addEventListener('scroll', () => {
      clearTimeout(snapTimer);
      snapTimer = setTimeout(snapToValue, 200);
    }, { passive: true });
    // scrollend is more reliable on modern iOS
    if ('onscrollend' in scroll) {
      scroll.addEventListener('scrollend', snapToValue, { passive: true });
    }

    this._updateHighlight(scroll, initV - minV);
  },

  _updateHighlight(scroll, idx) {
    scroll.querySelectorAll('.drum-item').forEach((el, i) => {
      el.classList.toggle('drum-item-selected', i === idx);
    });
  },

  _notify(picker) {
    // Falls jemand auf Änderungen lauschen will
    picker.dispatchEvent(new CustomEvent('drum-change', { bubbles: true }));
  },

  // Liest aktuellen Gesamtwert (Minuten) aus einem Picker
  getMinutes(id) {
    const hCol = document.getElementById(`dc-${id}-h`);
    const mCol = document.getElementById(`dc-${id}-m`);
    if (!hCol || !mCol) return 0;
    return parseInt(hCol.dataset.val || 0) * 60 + parseInt(mCol.dataset.val || 0);
  },

  // Liest Uhrzeit als "HH:MM" String
  getTime(id) {
    const hCol = document.getElementById(`dc-${id}-h`);
    const mCol = document.getElementById(`dc-${id}-m`);
    if (!hCol || !mCol) return '00:00';
    return `${String(hCol.dataset.val||0).padStart(2,'0')}:${String(mCol.dataset.val||0).padStart(2,'0')}`;
  },

  // Setzt Picker auf neuen Wert (smooth)
  setMinutes(id, totalMin) {
    const h = Math.floor(Math.abs(totalMin) / 60);
    const m = Math.abs(totalMin) % 60;
    this._scrollTo(`dc-${id}-h`, h);
    this._scrollTo(`dc-${id}-m`, m);
  },

  _scrollTo(colId, val) {
    const col = document.getElementById(colId);
    if (!col) return;
    const minV = parseInt(col.dataset.min);
    const scroll = col.querySelector('.drum-scroll');
    if (scroll) {
      col.dataset.val = val;
      scroll.scrollTo({ top: (val - minV) * this.ITEM_H, behavior: 'smooth' });
    }
  }
};

window.Drum = Drum;
