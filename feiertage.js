// Feiertage Berlin / Deutschland
// Berechnung beweglicher und fester Feiertage

const Feiertage = {
  // Osterberechnung nach Gauß
  getOsterSonntag(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  },

  getFeiertage(year) {
    const ostern = this.getOsterSonntag(year);
    const addDays = (d, n) => {
      const r = new Date(d);
      r.setDate(r.getDate() + n);
      return r;
    };
    const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

    const feiertage = {};

    // Bundesweit
    feiertage[`${year}-01-01`] = 'Neujahr';
    feiertage[fmt(addDays(ostern, -2))] = 'Karfreitag';
    feiertage[fmt(ostern)] = 'Ostersonntag';
    feiertage[fmt(addDays(ostern, 1))] = 'Ostermontag';
    feiertage[`${year}-05-01`] = 'Tag der Arbeit';
    feiertage[fmt(addDays(ostern, 39))] = 'Christi Himmelfahrt';
    feiertage[fmt(addDays(ostern, 49))] = 'Pfingstsonntag';
    feiertage[fmt(addDays(ostern, 50))] = 'Pfingstmontag';
    feiertage[`${year}-10-03`] = 'Tag der Deutschen Einheit';
    feiertage[`${year}-12-25`] = '1. Weihnachtstag';
    feiertage[`${year}-12-26`] = '2. Weihnachtstag';

    // Berlin spezifisch
    feiertage[`${year}-03-08`] = 'Internationaler Frauentag';

    return feiertage;
  },

  // Halbe Tage
  getHalbeFeiertage(year) {
    const half = {};
    const fmt = (y, m, d) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    // Heiligabend und Silvester = 4h Sollarbeitszeit wenn Werktag
    const heiligabend = new Date(year, 11, 24);
    const silvester = new Date(year, 11, 31);
    const dow24 = heiligabend.getDay();
    const dow31 = silvester.getDay();

    if (dow24 >= 1 && dow24 <= 5) half[fmt(year, 12, 24)] = { name: 'Heiligabend (halber Tag)', stunden: 4 };
    if (dow31 >= 1 && dow31 <= 5) half[fmt(year, 12, 31)] = { name: 'Silvester (halber Tag)', stunden: 4 };

    return half;
  },

  isFeiertag(dateStr, year) {
    const feiertage = this.getFeiertage(year || parseInt(dateStr.substring(0,4)));
    return feiertage[dateStr] || null;
  },

  isHalberTag(dateStr, year) {
    const halbe = this.getHalbeFeiertage(year || parseInt(dateStr.substring(0,4)));
    return halbe[dateStr] || null;
  },

  getSollarbeitszeit(dateStr, settings) {
    const date = new Date(dateStr + 'T12:00:00');
    const dow = date.getDay(); // 0=So, 6=Sa
    const year = date.getFullYear();

    // Feiertag?
    if (this.isFeiertag(dateStr, year)) return 0;

    // Halber Tag (Heiligabend/Silvester)?
    const halber = this.isHalberTag(dateStr, year);
    if (halber) return halber.stunden * 60; // in Minuten

    // Wochenende
    if (dow === 0 || dow === 6) return 0;

    // Normaler Werktag
    return (settings?.sollarbeitszeitMinuten || 480); // default 8h = 480min
  }
};

window.Feiertage = Feiertage;
