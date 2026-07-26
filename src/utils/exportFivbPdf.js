import * as PDFLib from 'pdf-lib';
import FIVB_TEMPLATE_B64 from '../assets/fivbTemplateB64.js';
import { fillFIVBScoresheet } from './fillFivbScoresheet.js';
import { normalizeExportGameData } from './normalizeExportGameData.js';

function ab3(n) {
  if (!n) return '???';
  const w = n.trim().split(/\s+/).filter(Boolean);
  return w.length === 1 ? w[0].slice(0, 3).toUpperCase() : w.map((x) => x[0]).join('').slice(0, 3).toUpperCase();
}

/**
 * Official FIVB scoresheet PDF export (pdf-lib template fill — HTML parity).
 */
export async function exportFivbPdf(gameData) {
  const data = normalizeExportGameData(gameData);
  const bin = atob(FIVB_TEMPLATE_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const out = await fillFIVBScoresheet(bytes, data, PDFLib);
  const mi = data.matchInfo || {};
  const dt = (mi.date || new Date().toISOString().split('T')[0]).replace(/\//g, '-');
  const fileName = `FIVB_${ab3(mi.teamAName || 'A')}_vs_${ab3(mi.teamBName || 'B')}_${dt}.pdf`;

  const blob = new Blob([out], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 2000);
}
