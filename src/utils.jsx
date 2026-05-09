import { MONTHS } from './constants.js';
import * as chrono from 'chrono-node';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function fmtDate(s) {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1].slice(0, 3)} ${y}`;
}

export function toDateStr(y, mo, d) {
  return `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function linkifyText(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const urlTest = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (!part) return null;
    if (urlTest.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a key={index} href={href} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

const MONTHS_MAP = {
  enero: 0, ene: 0, febrero: 1, feb: 1, marzo: 2, mar: 2,
  abril: 3, abr: 3, mayo: 4, may: 4, junio: 5, jun: 5,
  julio: 6, jul: 6, agosto: 7, ago: 7, septiembre: 8, sep: 8, sept: 8,
  octubre: 9, oct: 9, noviembre: 10, nov: 10, diciembre: 11, dic: 11,
};

const WEEKDAYS_MAP = {
  domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
  jueves: 4, viernes: 5, sábado: 6, sabado: 6,
};

function parseDateFromDescription(text) {
  const parser = chrono.es || chrono;
  if (typeof parser.parseDate === 'function') {
    return parser.parseDate(text, new Date(), { forwardDate: true }) || null;
  }
  if (typeof chrono.parseDate === 'function') {
    return chrono.parseDate(text, new Date(), { forwardDate: true }) || null;
  }
  return null;
}

export function parseDescriptionDateResult(text) {
  const parser = chrono.es || chrono;
  const parseFn = typeof parser.parse === 'function' ? parser.parse
    : typeof chrono.parse === 'function' ? chrono.parse : null;
  if (!parseFn) return null;
  const results = parseFn(text, new Date(), { forwardDate: true });
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}

const stripDiacritics = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function cleanDescriptionSegment(text, segment) {
  if (!segment) return text.trim();
  const source = text || '';
  const normalized = stripDiacritics(source).toLowerCase();
  const needle = stripDiacritics(segment).toLowerCase();
  const index = normalized.indexOf(needle);
  const cleaned = index >= 0
    ? source.slice(0, index) + source.slice(index + segment.length)
    : source.replace(new RegExp(escapeRegExp(segment), 'i'), '');
  return cleaned.replace(/\s{2,}/g, ' ').trim()
    .replace(/^(a|a las|a la|al|el|la|en|para)\s+/i, '')
    .replace(/\s+(a|a las|a la|al|el|la|en|para)$/i, '')
    .trim();
}

export function parseDateTimeFromDescription(text) {
  if (!text) return null;
  const found = parseDateFromDescription(text);
  if (found) {
    const date = toDateStr(found.getFullYear(), found.getMonth(), found.getDate());
    const hasTime = found.getHours() !== 0 || found.getMinutes() !== 0;
    const time = hasTime
      ? `${String(found.getHours()).padStart(2, '0')}:${String(found.getMinutes()).padStart(2, '0')}`
      : '';
    return { date, time };
  }

  const lower = text.toLowerCase();
  const timeMatch = lower.match(/(\d{1,2})(?::|h)(\d{2})/);
  const time = timeMatch
    ? `${String(parseInt(timeMatch[1], 10)).padStart(2, '0')}:${String(parseInt(timeMatch[2], 10)).padStart(2, '0')}`
    : '';

  const today = new Date();
  let date = '';

  const weekdayMatch = lower.match(
    /(?:el\s+)?(?:pr[oó]ximo\s+|este\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)(?:\s+de\s+este\s+mes)?/
  );
  if (weekdayMatch) {
    const target = WEEKDAYS_MAP[weekdayMatch[1]];
    if (typeof target === 'number') {
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      let delta = (target - start.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      const candidate = new Date(start);
      candidate.setDate(start.getDate() + delta);
      if (/de\s+este\s+mes/.test(lower)) {
        candidate.setDate(1);
        while (candidate.getMonth() === today.getMonth()) {
          if (candidate.getDay() === target && candidate >= today) {
            date = toDateStr(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
            break;
          }
          candidate.setDate(candidate.getDate() + 1);
        }
      } else {
        date = toDateStr(candidate.getFullYear(), candidate.getMonth(), candidate.getDate());
      }
    }
  }

  if (!date) {
    const monthNameMatch = lower.match(
      /(?:el\s*)?(\d{1,2})(?:º|ª)?\s*(?:de\s*)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|ene|feb|mar|abr|may|jun|jul|ago|sep|sept|oct|nov|dic)(?:\s*de\s*(\d{2,4}))?/
    );
    if (monthNameMatch) {
      const day = parseInt(monthNameMatch[1], 10);
      const month = MONTHS_MAP[monthNameMatch[2]];
      let year = monthNameMatch[3] ? parseInt(monthNameMatch[3], 10) : today.getFullYear();
      if (year < 100) year += 2000;
      if (!Number.isNaN(day) && month >= 0) {
        date = toDateStr(year, month, day);
      }
    }
  }

  if (!date) {
    if (/pasado\s*mañana/.test(lower)) {
      const next = new Date(today);
      next.setDate(next.getDate() + 2);
      date = toDateStr(next.getFullYear(), next.getMonth(), next.getDate());
    } else if (/mañana/.test(lower)) {
      const next = new Date(today);
      next.setDate(next.getDate() + 1);
      date = toDateStr(next.getFullYear(), next.getMonth(), next.getDate());
    } else if (/hoy|día de hoy|dia de hoy|el dia de hoy|el día de hoy/.test(lower)) {
      date = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
    } else {
      const dateMatch = lower.match(new RegExp('(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?'));
      if (dateMatch) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1;
        let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : today.getFullYear();
        if (year < 100) year += 2000;
        date = toDateStr(year, month, day);
      }
    }
  }

  return date || time ? { date, time } : null;
}
