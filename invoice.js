/* ============ SHYNWELL: invoice PDF (white / gold / light rose) + QR + bill e-mail + Download Center ============
   Loaded after app.js. It only uses helpers that app.js already defines ($, api, ensure, toast, num, iso, orders, COLS, ...). */
const STORE = {name: 'SHYNWELL', tag: 'PREMIUM COVERING JEWELLERY', addr: 'Vandavasi, Tamil Nadu', gstin: '33FFRPA2765D1ZK', hsn: '7117'};   // hsn = shown when an order has no HSN code
const IC = {gold: [184, 134, 11], rose: [183, 110, 121], roseL: [253, 241, 238], roseM: [246, 223, 218], line: [236, 211, 205], txt: [59, 42, 42], mut: [140, 119, 113]};
const JSPDF_SRC = ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'];
const QR_SRC = ['https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'];
const ZIP_SRC = ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'];
const XLSX_SRC = ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'];
const rs = n => 'Rs. ' + (Number(n) || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

/* ---------- data helpers ---------- */
function invData(o) {   // one order (sheet-style keys) -> numbers + text for the invoice
  const g = k => o[k] == null ? '' : String(o[k]).trim(), cg = num(o['CGST']), sg = num(o['SGST']), ig = num(o['IGST']), tax = cg + sg + ig;
  const total = num(o['Customer Price']) || num(o['Sale Price']), taxable = Math.max(0, total - tax);
  let rate = num(o['GST %']); if (!rate && taxable > 0 && tax > 0) rate = Math.round(tax / taxable * 10000) / 100;
  return {id: g('Order ID'), platform: g('Platform'), customer: g('Customer Name'), state: g('State'), address: g('Full Address'), invDate: g('Invoice Date').slice(0, 10) || iso(new Date()),
    shipDate: g('Shipping Date').slice(0, 10), sku: g('SKU ID'), sec: g('Secondary SKU IDs'), pay: g('Payment Type'), cg, sg, ig, tax, total, taxable, rate, hsn: g('HSN Code') || STORE.hsn};
}
const orderFromForm = p => ({'Order ID': p.orderId, 'Platform': p.platform, 'Customer Name': p.customerName, 'State': p.state, 'Full Address': p.address, 'Invoice Date': p.invoiceDate, 'Shipping Date': p.shippingDate,
  'SKU ID': p.skuId, 'Secondary SKU IDs': p.secondarySkus, 'Payment Type': p.paymentType, 'Customer Price': p.customerPrice, 'Sale Price': p.salePrice, 'CGST': p.cgst, 'SGST': p.sgst, 'IGST': p.igst,
  'HSN Code': p.hsnCode, 'GST %': p.gstPercent});
function inWords(n) {   // Indian numbering
  n = Math.round(n); if (!n) return 'Zero';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const out = [], cr = Math.floor(n / 1e7), lk = Math.floor(n % 1e7 / 1e5), th = Math.floor(n % 1e5 / 1e3), rest = n % 1e3;
  if (cr) out.push(three(cr) + ' Crore'); if (lk) out.push(two(lk) + ' Lakh'); if (th) out.push(two(th) + ' Thousand'); if (rest) out.push(three(rest));
  return out.join(' ');
}
function qrText(d) {   // everything on the invoice, so a scan shows the full bill
  return ['SHYNWELL TAX INVOICE', 'Seller GSTIN: ' + STORE.gstin, 'Invoice / Order ID: ' + d.id, 'Invoice date: ' + d.invDate, d.shipDate && 'Shipping date: ' + d.shipDate, d.platform && 'Platform: ' + d.platform,
    'Customer: ' + d.customer, d.state && 'State: ' + d.state, d.address && 'Address: ' + d.address.replace(/\s+/g, ' ').slice(0, 160), 'SKU: ' + [d.sku, d.sec].filter(Boolean).join(', '), 'HSN: ' + d.hsn,
    'Taxable value: ' + d.taxable.toFixed(2), 'GST rate: ' + (d.rate || 0) + '%', 'CGST: ' + d.cg.toFixed(2), 'SGST: ' + d.sg.toFixed(2), 'IGST: ' + d.ig.toFixed(2), 'TOTAL: Rs ' + d.total.toFixed(2),
    d.pay && 'Payment: ' + d.pay].filter(Boolean).join('\n');
}
let _logo = null;
const invLogo = () => _logo || (_logo = new Promise(res => {
  const i = new Image(); i.onload = () => { try { const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * i.naturalHeight / i.naturalWidth); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); res({url: c.toDataURL('image/png'), w: c.width, h: c.height}); } catch (e) { res(null); } };
  i.onerror = () => res(null); i.src = 'logo.webp';
}));
async function qrModules(text) {
  if (!await ensure(() => window.qrcode, QR_SRC)) throw new Error('QR library failed to load. Check internet.');
  qrcode.stringToBytes = t => Array.from(new TextEncoder().encode(t));   // UTF-8, so Tamil names scan correctly
  const q = qrcode(0, 'M'); q.addData(text, 'Byte'); q.make(); return q;
}
function drawQr(doc, q, x, y, size) {
  const n = q.getModuleCount(), m = size / n;
  doc.setFillColor(255, 255, 255); doc.rect(x - 2, y - 2, size + 4, size + 4, 'F'); doc.setFillColor(0, 0, 0);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) doc.rect(x + c * m, y + r * m, m + 0.03, m + 0.03, 'F');
}

/* ---------- the invoice itself (A4, one page) ---------- */
async function invoiceDoc(o, linkUrl) {
  if (!await ensure(() => window.jspdf, JSPDF_SRC)) throw new Error('PDF library failed to load. Check internet.');
  const d = invData(o); if (!d.id) throw new Error('Order ID is missing');
  const [q, logo] = [await qrModules(linkUrl || qrText(d)), await invLogo()], doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4'}), W = 210, M = 14, R = W - M;
  const fill = c => doc.setFillColor(...c), ink = c => doc.setTextColor(...c), line = c => doc.setDrawColor(...c), font = (f, s, st) => { doc.setFont(f, st || 'normal'); doc.setFontSize(s); };
  doc.setProperties({title: 'Invoice ' + d.id, author: STORE.name});
  fill(IC.roseL); doc.rect(0, 0, W, 42, 'F'); fill(IC.gold); doc.rect(0, 42, W, 1.2, 'F');                       // header band
  if (logo) { const h = 26 * logo.h / logo.w; doc.addImage(logo.url, 'PNG', M, 8, 26, h); line(IC.gold); doc.setLineWidth(.7); doc.rect(M, 8, 26, h, 'S'); }
  font('times', 27, 'bold'); ink(IC.gold); doc.text(STORE.name, 46, 20);
  font('helvetica', 7.5, 'normal'); ink(IC.rose); doc.text(STORE.tag, 46, 26, {charSpace: 1});
  font('helvetica', 9, 'normal'); ink(IC.txt); doc.text(STORE.addr, 46, 32.5); font('helvetica', 9, 'bold'); doc.text('GSTIN: ' + STORE.gstin, 46, 37.5);
  font('times', 21, 'bold'); ink(IC.rose); doc.text('TAX INVOICE', R, 19, {align: 'right'});
  font('helvetica', 9, 'bold'); ink(IC.txt); doc.text('Invoice No: ' + d.id.slice(0, 34), R, 27, {align: 'right'}); font('helvetica', 9, 'normal'); doc.text('Date: ' + d.invDate, R, 32.5, {align: 'right'});
  // bill-to + details boxes
  const box = (x, w, title) => { fill(IC.roseL); line(IC.line); doc.setLineWidth(.3); doc.roundedRect(x, 50, w, 40, 2, 2, 'FD'); font('helvetica', 7.5, 'bold'); ink(IC.rose); doc.text(title, x + 4, 56, {charSpace: .8}); };
  box(M, 88, 'BILL TO'); font('helvetica', 11, 'bold'); ink(IC.txt); doc.text(doc.splitTextToSize(d.customer || '-', 80).slice(0, 1), M + 4, 63);
  font('helvetica', 9, 'normal'); doc.text(doc.splitTextToSize(d.address || '-', 80).slice(0, 4), M + 4, 69); if (d.state) { font('helvetica', 9, 'bold'); doc.text(d.state, M + 4, 85); }
  box(M + 94, 88, 'INVOICE DETAILS');
  [['Invoice No', d.id.slice(0, 26)], ['Invoice date', d.invDate], ['Shipping date', d.shipDate || '-'], ['Platform', d.platform || '-'], ['Payment', d.pay || '-'], ['Place of supply', d.state || '-']].forEach((r, i) => {
    font('helvetica', 8.5, 'normal'); ink(IC.mut); doc.text(r[0], M + 98, 61.5 + i * 5); font('helvetica', 8.5, 'bold'); ink(IC.txt); doc.text(String(r[1]), M + 130, 61.5 + i * 5); });
  // item table
  const X = {n: M + 3, desc: M + 10, hsn: 82, tax: 112, pct: 124, cg: 141, sg: 158, ig: 174, amt: R - 2};
  fill(IC.gold); doc.rect(M, 97, R - M, 8, 'F'); font('helvetica', 8, 'bold'); ink([255, 255, 255]);
  doc.text('#', X.n, 102.2); doc.text('DESCRIPTION', X.desc, 102.2); doc.text('HSN', X.hsn, 102.2, {align: 'center'}); doc.text('TAXABLE', X.tax, 102.2, {align: 'right'}); doc.text('GST %', X.pct, 102.2, {align: 'right'});
  doc.text('CGST', X.cg, 102.2, {align: 'right'}); doc.text('SGST', X.sg, 102.2, {align: 'right'}); doc.text('IGST', X.ig, 102.2, {align: 'right'}); doc.text('AMOUNT', X.amt, 102.2, {align: 'right'});
  const desc = doc.splitTextToSize('Covering Jewellery' + (d.sku ? '\nSKU: ' + d.sku : '') + (d.sec ? '\nAlso: ' + d.sec : ''), 50).slice(0, 6), rh = Math.max(12, desc.length * 4.2 + 4);
  font('helvetica', 8.5, 'normal'); ink(IC.txt); doc.text('1', X.n, 111); doc.text(desc, X.desc, 111); doc.text(d.hsn, X.hsn, 111, {align: 'center'});
  doc.text(d.taxable.toFixed(2), X.tax, 111, {align: 'right'}); doc.text(d.rate ? String(d.rate) : '-', X.pct, 111, {align: 'right'});
  doc.text(d.cg.toFixed(2), X.cg, 111, {align: 'right'}); doc.text(d.sg.toFixed(2), X.sg, 111, {align: 'right'}); doc.text(d.ig.toFixed(2), X.ig, 111, {align: 'right'});
  font('helvetica', 8.5, 'bold'); doc.text(d.total.toFixed(2), X.amt, 111, {align: 'right'});
  line(IC.line); doc.setLineWidth(.3); doc.line(M, 105 + rh, R, 105 + rh);
  // totals (right) and amount in words (left)
  let y = 105 + rh + 8; const tx = 124;
  [['Taxable value', d.taxable], ['CGST', d.cg], ['SGST', d.sg], ['IGST', d.ig]].forEach((r, i) => { font('helvetica', 9, 'normal'); ink(IC.mut); doc.text(r[0], tx, y + i * 6); ink(IC.txt); doc.text(rs(r[1]), R, y + i * 6, {align: 'right'}); });
  fill(IC.gold); doc.roundedRect(tx - 3, y + 21.5, R - tx + 6, 9, 1.5, 1.5, 'F'); font('helvetica', 10.5, 'bold'); ink([255, 255, 255]); doc.text('TOTAL', tx, y + 27.4); doc.text(rs(d.total), R - 2, y + 27.4, {align: 'right'});
  font('helvetica', 7.5, 'bold'); ink(IC.rose); doc.text('AMOUNT IN WORDS', M, y - 1, {charSpace: .6}); font('helvetica', 9, 'normal'); ink(IC.txt);
  const paise = Math.round((d.total - Math.floor(d.total)) * 100), words = 'Rupees ' + inWords(Math.floor(d.total)) + (paise ? ' and ' + inWords(paise) + ' Paise' : '') + ' Only';
  doc.text(doc.splitTextToSize(words, 100), M, y + 5);
  // QR + terms + signature
  y += 44; fill(IC.roseL); line(IC.line); doc.roundedRect(M, y, R - M, 58, 2, 2, 'FD'); drawQr(doc, q, M + 6, y + 6, 40);
  font('helvetica', 8.5, 'bold'); ink(IC.gold); doc.text(linkUrl ? 'SCAN TO OPEN THIS INVOICE' : 'SCAN FOR INVOICE DETAILS', M + 6, y + 52.5); 
  font('helvetica', 8, 'bold'); ink(IC.rose); doc.text('TERMS', 74, y + 9, {charSpace: .6}); font('helvetica', 8, 'normal'); ink(IC.txt);
  doc.text(['Goods once sold are subject to the return policy of the selling platform.', 'This is a computer generated invoice and needs no signature.', 'Prices are inclusive of GST as shown above.'].flatMap(t => doc.splitTextToSize('- ' + t, 118)), 74, y + 15);
  line(IC.gold); doc.setLineWidth(.4); doc.line(138, y + 46, R - 4, y + 46); font('helvetica', 8, 'bold'); ink(IC.txt); doc.text('For ' + STORE.name, R - 4, y + 41, {align: 'right'}); font('helvetica', 7.5, 'normal'); ink(IC.mut); doc.text('Authorised Signatory', R - 4, y + 51, {align: 'right'});
  // footer
  fill(IC.gold); doc.rect(0, 283, W, .8, 'F'); font('times', 10, 'italic'); ink(IC.rose); doc.text('Thank you for shopping with ' + STORE.name, W / 2, 289, {align: 'center'});
  return doc;
}
const invFileName = id => 'SHYNWELL-Invoice-' + String(id).replace(/[^A-Za-z0-9_-]/g, '_') + '.pdf';
/* ---------- the QR on an invoice opens the stored invoice PDF (file name = order + a secret token from Apps Script) ---------- */
const TOKS = new Map();
async function invTokens(ids) {
  const need = [...new Set(ids.map(String))].filter(i => i && !TOKS.has(i.toLowerCase()));
  for (let i = 0; i < need.length; i += 200) { const r = await api('POST', {action: 'invTokens', ids: need.slice(i, i + 200)}); if (!r.success) throw new Error(r.error || 'Could not prepare the invoice link'); Object.keys(r.tokens || {}).forEach(k => TOKS.set(k.toLowerCase(), r.tokens[k])); }
}
const invPath = (id, tok) => `generated/${String(id).replace(/[^A-Za-z0-9_-]/g, '_')}_${tok}.pdf`, pubUrl = path => `${SUPA.url}/storage/v1/object/public/${SUPA.bucket}/${path}`;
async function invoiceStored(o, headFirst) {   // builds the invoice with a link-QR and stores the PDF; falls back to a details-QR if the PDF cannot be stored
  const id = String(o['Order ID'] || '').trim(); await invTokens([id]); const path = invPath(id, TOKS.get(id.toLowerCase())), url = pubUrl(path);
  let doc = await invoiceDoc(o, url), ok = false;
  const exists = async () => { try { return (await fetch(url, {method: 'HEAD', cache: 'no-store'})).ok; } catch (e) { return false; } };
  if (headFirst && await exists()) ok = true;
  else { try { const res = await fetch(`${SUPA.url}/storage/v1/object/${SUPA.bucket}/${path}`, {method: 'POST', headers: supaHeaders({'Content-Type': 'application/pdf', 'x-upsert': 'true'}), body: doc.output('blob')}); ok = res.ok || await exists(); } catch (e) { ok = await exists(); } }
  if (!ok) doc = await invoiceDoc(o, null);
  return {doc, url, stored: ok};
}
async function downloadInvoice(o) {
  try { toast('Preparing invoice...'); const r = await invoiceStored(o); r.doc.save(invFileName(o['Order ID'])); toast(r.stored ? 'Invoice downloaded' : 'Invoice downloaded (its QR shows the details because the PDF could not be stored online)', !r.stored); } catch (e) { toast('Invoice failed: ' + e.message, true); }
}

/* ---------- bill e-mail (Apps Script -> your Gmail, PDF attached). A failed mail is remembered and retried. ---------- */
async function emailInvoice(o, pre) {
  const d = invData(o), doc = (pre || await invoiceStored(o)).doc, pdf = doc.output('datauristring').split(',')[1];
  return api('POST', {action: 'mail_invoice', orderId: d.id, pdf, platform: d.platform, customer: d.customer, state: d.state, invoiceDate: d.invDate, payment: d.pay, sku: [d.sku, d.sec].filter(Boolean).join(', '),
    hsn: d.hsn, gstPct: d.rate || '', total: d.total, tax: d.tax, taxable: d.taxable});
}
const MQ_KEY = 'shyn_invmail_q', mqGet = () => { try { return JSON.parse(localStorage.getItem(MQ_KEY) || '[]'); } catch (e) { return []; } }, mqSet = a => { try { localStorage.setItem(MQ_KEY, JSON.stringify(a.slice(-50))); } catch (e) {} };
async function invoiceAfterSave(p, sp) {
  let st = null;
  try { st = await invoiceStored(orderFromForm(p)); if (sp) sp.ok(1, st.stored ? 'Invoice generated' : 'Invoice generated (QR shows details)'); }
  catch (e) { if (sp) sp.bad(1, 'Invoice not generated: ' + e.message); mqSet([...mqGet().filter(x => x !== p.orderId), p.orderId]); return; }
  try { const r = await emailInvoice(orderFromForm(p), st); if (!r || !r.success) throw new Error((r && r.error) || 'mail failed'); }
  catch (e) { if (e && e.authExpired) return; mqSet([...mqGet().filter(x => x !== p.orderId), p.orderId]); setTimeout(() => toast('Invoice mail failed (' + e.message + '). It will retry automatically.', true), 2700); }
}
async function invRetryQueue() {
  const q = mqGet(); if (!q.length || window._mqBusy) return; window._mqBusy = true; const left = [];
  try {
    for (const id of q) {
      const o = orders.find(x => String(x['Order ID']).trim().toLowerCase() === String(id).trim().toLowerCase()); if (!o) continue;   // order no longer exists
      try { const r = await emailInvoice(o); if (!r || !r.success) left.push(id); } catch (e) { left.push(id); if (e && e.authExpired) break; }
    }
  } finally { mqSet(left); window._mqBusy = false; }
}

/* ---------- Download Center ---------- */
const dlMsg = (t, bad) => { const e = $('dlMsg'); if (e) { e.textContent = t || ''; e.style.color = bad ? '#ff6b81' : 'var(--mut)'; } };
function openDownloads() { dlHome(); dlPreset('all'); openM('dlModal'); }
function dlHome() {   // main headings first; tap one to see what it can download
  document.querySelectorAll('#dlModal .dlpanel').forEach(p => p.classList.add('hidden')); $('dlHome').classList.remove('hidden'); $('dlBack').classList.add('hidden'); $('dlRange').classList.remove('hidden');
  $('dlTitle').querySelector('span').textContent = 'Download Center'; dlMsg('Choose what you want to download.'); $('dlModal').querySelector('.dlbox').scrollTop = 0;
}
function dlOpen(g) {
  const p = $('dlG_' + g); if (!p) return; document.querySelectorAll('#dlModal .dlpanel').forEach(x => x.classList.add('hidden')); $('dlHome').classList.add('hidden'); p.classList.remove('hidden');
  $('dlBack').classList.remove('hidden'); $('dlRange').classList.toggle('hidden', !p.dataset.range); $('dlTitle').querySelector('span').textContent = p.dataset.title;
  dlMsg(p.dataset.range ? 'Uses the dates above.' : ''); $('dlModal').querySelector('.dlbox').scrollTop = 0;
}
function dlPreset(k) {
  const n = new Date(), a = new Date(n.getFullYear(), n.getMonth() + (k === 'last' ? -1 : 0), 1), b = k === 'last' ? new Date(n.getFullYear(), n.getMonth(), 0) : n;
  $('dlFrom').value = k === 'all' ? '' : iso(a); $('dlTo').value = k === 'all' ? '' : iso(b);
  document.querySelectorAll('[data-dlp]').forEach(x => x.classList.toggle('on', x.dataset.dlp === k));
}
const dlList = () => { const f = $('dlFrom').value, t = $('dlTo').value; return orders.filter(o => { const d = String(o['Invoice Date'] || o['Timestamp'] || '').slice(0, 10); return (!f || d >= f) && (!t || d <= t); }); };
const dlTag = () => ($('dlFrom').value || $('dlTo').value) ? ($('dlFrom').value || 'start') + '_to_' + ($('dlTo').value || 'today') : 'all';
const isBadO = o => String(o['Order Status'] || '').trim() !== '';
const monthOf = o => String(o['Invoice Date'] || o['Timestamp'] || '').slice(0, 7) || 'Unknown';
const xl = async () => { if (!await ensure(() => window.XLSX, XLSX_SRC)) throw new Error('Excel library failed to load. Check internet.'); return window.XLSX; };
function sheetOf(X, rows, widths) { const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = (widths || rows[0].map(() => 16)).map(w => ({wch: w})); return ws; }
function groupBy(list, keyFn) { const m = new Map(); list.forEach(o => { const k = keyFn(o) || 'Unknown'; (m.get(k) || m.set(k, []).get(k)).push(o); }); return [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))); }
const r2 = n => Math.round(n * 100) / 100;

/* sheet builders: each returns [sheetName, rows, widths] */
function shOrders(list) { const NUMX = [...NUMC]; return ['Orders', [COLS, ...list.map(o => COLS.map(c => c === 'Net Profit' ? profitOf(o) : NUMX.includes(c) ? num(o[c]) : (o[c] == null ? '' : o[c])))], COLS.map(c => /URL|Address|Notes/.test(c) ? 34 : c === 'Customer Name' ? 22 : 15)]; }
function shGst(list) {
  const ok = list.filter(o => !isBadO(o)), head = ['Order ID', 'Invoice Date', 'Customer', 'State', 'HSN', 'GST %', 'Taxable value', 'CGST', 'SGST', 'IGST', 'Total GST', 'Invoice total'];
  const per = ok.map(o => { const d = invData(o); return [d.id, d.invDate, d.customer, d.state, d.hsn, d.rate, r2(d.taxable), r2(d.cg), r2(d.sg), r2(d.ig), r2(d.tax), r2(d.total)]; });
  const mon = groupBy(ok, monthOf).map(([m, l]) => { const ds = l.map(invData), s = k => r2(ds.reduce((a, d) => a + d[k], 0)); return [m, l.length, s('taxable'), s('cg'), s('sg'), s('ig'), s('tax'), s('total')]; });
  const tot = mon.reduce((a, r) => a.map((v, i) => i === 0 ? 'TOTAL' : r2(v + r[i])), ['', 0, 0, 0, 0, 0, 0, 0]);
  return [['GST Monthly', [['Month', 'Invoices', 'Taxable value', 'CGST', 'SGST', 'IGST', 'Total GST', 'Invoice total'], ...mon, tot, [], ['Cancelled / returned orders are left out.']], [14, 10, 16, 12, 12, 12, 14, 16]], ['GST Orders', [head, ...per], [26, 12, 22, 16, 9, 8, 14, 10, 10, 10, 11, 13]]];
}
function profitRow(k, l) { const good = l.filter(o => !isBadO(o)), bad = l.filter(isBadO); return [k, l.length, r2(good.reduce((a, o) => a + num(o['Sale Price']), 0)), r2(good.reduce((a, o) => a + num(o['Original Price']), 0)), r2(l.reduce((a, o) => a + profitOf(o), 0)), bad.length, r2(bad.reduce((a, o) => a + num(o['Loss Amount']), 0))]; }
function shProfit(list) {
  const h = n => [n, 'Orders', 'Revenue', 'Cost', 'Net profit', 'Cancel/Return orders', 'Loss'], w = [26, 9, 14, 14, 14, 20, 12];
  return [['Profit by Platform', [h('Platform'), ...groupBy(list, o => o['Platform']).map(([k, l]) => profitRow(k, l)), profitRow('TOTAL', list)], w],
    ['Profit by Month', [h('Month'), ...groupBy(list, monthOf).map(([k, l]) => profitRow(k, l))], w],
    ['Profit by SKU', [h('SKU'), ...groupBy(list, o => o['SKU ID']).map(([k, l]) => profitRow(k, l)).sort((a, b) => b[4] - a[4])], w]];
}
function shReturns(list) {
  const bad = list.filter(isBadO), head = ['Order ID', 'Invoice Date', 'Platform', 'SKU ID', 'Customer', 'Status', 'Reason', 'Notes', 'Return initiated', 'Return delivered', 'Loss Amount'];
  return [['Returns RTO Cancel', [head, ...bad.map(o => [o['Order ID'], String(o['Invoice Date'] || '').slice(0, 10), o['Platform'], o['SKU ID'], o['Customer Name'], o['Order Status'], o['Cancel Reason'] || '', o['Return Notes'] || '', String(o['Return Initiated Date'] || '').slice(0, 10), String(o['Return Delivered Date'] || '').slice(0, 10), num(o['Loss Amount'])])], [26, 12, 12, 18, 22, 16, 26, 26, 14, 14, 12]],
    ['Returns by Platform', [['Platform', 'Orders', 'Total loss'], ...groupBy(bad, o => o['Platform']).map(([k, l]) => [k, l.length, r2(l.reduce((a, o) => a + num(o['Loss Amount']), 0))])], [16, 10, 14]]];
}
async function shInventory() { const rows = await invFetchAll('inventory?select=*&order=serial_no.asc'); return ['Inventory', [['Serial No', 'SKU ID', 'Stock', 'Reorder Level', 'Image URL'], ...rows.map(r => [Number(r.serial_no), r.sku_id, r.stock_qty, invReOf(r), r.image_url || ''])], [10, 26, 10, 14, 50]]; }
async function shMoves() { const rows = await invFetchAll('stock_movements?select=*&order=created_at.desc,id.desc'); return ['Stock Movements', [['Date and Time', 'Invoice No', 'SKU ID', 'Previous', 'Change', 'Remaining', 'Type', 'Reason'], ...rows.map(r => [new Date(r.created_at).toLocaleString('en-IN'), r.invoice_no || '', r.sku_id, r.prev_stock, r.qty_change, r.new_stock, r.movement_type, r.note || ''])], [20, 20, 22, 10, 10, 10, 16, 36]]; }

async function dlBook(name, parts, emptyMsg) {   // parts: array of [sheetName, rows, widths]; downloads one .xlsx
  const flat = parts; if (!flat.length || flat.every(p => p[1].length <= 1)) return dlMsg(emptyMsg || 'Nothing to download for this selection.', true);
  const X = await xl(), wb = X.utils.book_new(); flat.forEach(p => X.utils.book_append_sheet(wb, sheetOf(X, p[1], p[2]), p[0].slice(0, 31))); X.writeFile(wb, name + '.xlsx'); dlMsg('Downloaded ' + name + '.xlsx'); toast('Download started');
}
const dlRun = async (fn) => { try { dlMsg('Preparing...'); await fn(); } catch (e) { if (e && (e.expired || e.authExpired)) return; dlMsg('Failed: ' + e.message, true); } };
const dlOrdersXlsx = () => dlRun(() => { const l = dlList(); return dlBook('SHYNWELL_Orders_' + dlTag(), [shOrders(l)], 'No orders in this date range.'); });
const dlOrdersCsv = () => dlRun(async () => { const l = dlList(); if (!l.length) return dlMsg('No orders in this date range.', true); downloadFile('SHYNWELL_Orders_' + dlTag() + '.csv', '\ufeff' + toCsv([COLS, ...l.map(o => COLS.map(c => c === 'Net Profit' ? profitOf(o) : (o[c] == null ? '' : o[c])))]), 'text/csv;charset=utf-8'); dlMsg('Orders CSV downloaded'); toast('Download started'); });
const dlGst = () => dlRun(() => dlBook('SHYNWELL_GST_Report_' + dlTag(), shGst(dlList()), 'No orders in this date range.'));
const dlProfit = () => dlRun(() => dlBook('SHYNWELL_Profit_Report_' + dlTag(), shProfit(dlList()), 'No orders in this date range.'));
const dlReturns = () => dlRun(() => dlBook('SHYNWELL_Returns_Report_' + dlTag(), shReturns(dlList()), 'No returned / RTO / cancelled orders in this date range.'));
const dlInventory = () => needAccess(() => dlRun(async () => dlBook('SHYNWELL_Inventory_' + iso(new Date()), [await shInventory()], 'Inventory is empty.')));
const dlMoves = () => needAccess(() => dlRun(async () => dlBook('SHYNWELL_Stock_Movements_' + iso(new Date()), [await shMoves()], 'No stock movements recorded yet.')));
const dlAcc = (which) => needAccess(() => dlRun(async () => { const s = await accSheets(); const pick = which === 'all' ? s : [s[which]]; return dlBook('SHYNWELL_' + (which === 'all' ? 'Accounts' : s[which][0].replace(/\s+/g, '_')) + '_' + iso(new Date()), pick, 'Nothing recorded yet.'); }));
const dlAll = () => needAccess(() => dlRun(async () => { const l = dlList(); dlMsg('Collecting everything...'); await dlBook('SHYNWELL_Complete_Backup_' + iso(new Date()), [shOrders(l), ...shGst(l), ...shProfit(l), ...shReturns(l), await shInventory(), await shMoves(), ...(await accSheets())]); }));
async function dlBills() {
  return dlRun(async () => {
    const l = dlList(); if (!l.length) return dlMsg('No orders in this date range.', true);
    if (!await ensure(() => window.JSZip, ZIP_SRC)) throw new Error('ZIP library failed to load. Check internet.');
    const zip = new JSZip(); let n = 0;
    await invTokens(l.map(o => o['Order ID']));
    for (const o of l) { dlMsg(`Building invoices ${++n} of ${l.length}...`); const doc = (await invoiceStored(o, true)).doc; zip.file(invFileName(o['Order ID']), doc.output('arraybuffer')); if (n % 10 === 0) await new Promise(r => setTimeout(r)); }
    dlMsg('Packing ZIP...'); const blob = await zip.generateAsync({type: 'blob', compression: 'DEFLATE'}), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'SHYNWELL_Invoices_' + dlTag() + '.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); dlMsg(`Downloaded ${l.length} invoice${l.length === 1 ? '' : 's'} (ZIP)`); toast('Invoices downloaded');
  });
}
function dlOneBill() {
  const id = $('dlOne').value.trim().toLowerCase(); if (!id) return dlMsg('Type an Order ID first.', true);
  const o = orders.find(x => String(x['Order ID']).trim().toLowerCase() === id); if (!o) return dlMsg('No order with that ID.', true);
  dlRun(() => downloadInvoice(o)).then(() => dlMsg('Invoice downloaded'));
}

/* ---------- Amar: spoken / typed download commands ---------- */
function amarRange(t) {
  const n = new Date(); let f = '', e = '';
  if (/this month/.test(t)) { f = iso(new Date(n.getFullYear(), n.getMonth(), 1)); e = iso(n); }
  else if (/last month/.test(t)) { f = iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)); e = iso(new Date(n.getFullYear(), n.getMonth(), 0)); }
  else if (/today/.test(t)) f = e = iso(n);
  $('dlFrom').value = f; $('dlTo').value = e; return f || e ? (f === e ? 'for today' : `for ${f} to ${e}`) : 'for all dates';
}
function amarDownload(t) {
  if (!/\b(download|export|backup|save|give me|get me|send me)\b|download center|download menu/.test(t)) return null;
  const R = () => amarRange(t), say = (what, fn, noDates) => { const r = R(); fn(); return {html: `Preparing your ${what}${noDates ? '' : ' ' + r}. It will download in a moment.`}; };
  if (/download (center|centre|menu|options)/.test(t)) { openDownloads(); return {html: 'Opened the Download Center. Pick any report, data file or the invoices from there.'}; }
  if (/\b(bills?|invoices?)\b/.test(t)) return say('invoices (ZIP of PDFs)', dlBills);
  if (/\b(everything|all data|full backup|complete backup|all reports|backup)\b/.test(t)) return say('complete backup (Excel)', dlAll);
  if (/\b(accounts?|credits?|debits?|balance)\b/.test(t)) return say('accounts file (credits, debits and balance)', () => dlAcc('all'), true);
  if (/\bgst|\btax\b/.test(t)) return say('GST report', dlGst);
  if (/\b(returns?|rto|cancel\w*)\b/.test(t)) return say('returns / RTO / cancel report', dlReturns);
  if (/\bprofit\b/.test(t) && /report|sheet|excel|download|export/.test(t)) return say('profit report', dlProfit);
  if (/movements?|stock history/.test(t)) return say('stock movement report', dlMoves, true);
  if (/\b(inventory|stock)\b/.test(t)) return say('inventory file', dlInventory, true);
  if (/\borders?\b|\bdata\b/.test(t) && /csv/.test(t)) return say('orders CSV', dlOrdersCsv);
  if (/\borders?\b|\bdata\b/.test(t) && /excel|xlsx|sheet/.test(t)) return say('orders Excel', dlOrdersXlsx);
  return null;
}
const stockReason = txt => { const el = $('invStockNote'); el.value = txt; el.focus(); };

/* ---------- Return photos: 1 = parcel before opening, 2 = parcel after opening (both compulsory for RTO / Customer Return) ---------- */
const RC = n => { const s = n === 1 ? '' : '2'; return {prev: 'rcImg' + s + 'Prev', pdf: 'rcImg' + s + 'Pdf', name: 'rcImg' + s + 'Name', cur: 'rcImg' + s + 'Cur', key: n === 1 ? 'Return Image URL' : 'Return Image 2 URL', inputs: ['rcImg' + s, 'rcImg' + s + 'Cam']}; };
function rcImgPicked(n, input) {
  const r = RC(n), f = input && input.files && input.files[0];
  if (f) { const pdf = isPdfFile(f); if (!pdf && !/^image\//i.test(f.type)) { toast('Choose a photo or a PDF.', true); input.value = ''; return; } if (pdf && f.size > 8 * 1024 * 1024) { toast('The PDF is too large (maximum 8 MB).', true); input.value = ''; return; } RC_FILES[n] = f; }
  const cur = RC_FILES[n], pv = $(r.prev), pd = $(r.pdf); $(r.name).textContent = cur ? cur.name : 'No file selected';
  if (pv.dataset.u) URL.revokeObjectURL(pv.dataset.u); pv.dataset.u = ''; pv.classList.add('hidden'); pv.removeAttribute('src'); pd.style.display = 'none';
  if (cur && isPdfFile(cur)) pd.style.display = 'flex'; else if (cur) { pv.dataset.u = URL.createObjectURL(cur); pv.src = pv.dataset.u; pv.classList.remove('hidden'); }
  r.inputs.forEach(id => { if (input && $(id) !== input) $(id).value = ''; }); $('rcErr').textContent = '';
}
function rcImgClear() { [1, 2].forEach(n => { RC_FILES[n] = null; RC(n).inputs.forEach(id => { $(id).value = ''; }); rcImgPicked(n, null); }); }
function rcImgSync() {
  const st = $('rcStatus').value, need = st === 'RTO' || st === 'Customer Return'; $('rcImgBox').classList.toggle('hidden', !need);
  [1, 2].forEach(n => { const r = RC(n), u = found && found[r.key], cur = $(r.cur);
    if (need && u && /^https:\/\//i.test(String(u))) { cur.innerHTML = 'On file: <a href="' + invEsc(encodeURI(u)) + '" target="_blank" rel="noopener noreferrer" class="underline" style="color:var(--cy)">View</a> (choose a new file to replace it)'; cur.classList.remove('hidden'); } else cur.classList.add('hidden'); });
}

/* ---------- pictures of the order (shown in Order lookup) ---------- */
function lookImagesRender() {
  if (!found) return; let box = $('lookImages');
  if (!box) { box = document.createElement('div'); box.id = 'lookImages'; box.className = 'lookimg'; $('delBtn').before(box); box.addEventListener('click', e => { const a = e.target.closest('a[data-i]'); if (!a) return; e.preventDefault(); openViewer(+a.dataset.i); }); }
  const sr = typeof supaRow !== 'undefined' && supaRow ? supaRow : {};
  LOOK_ITEMS = [['Invoice (marketplace)', sr.invoice_url || found['Invoice URL']], ['Packing cover with product', sr.packing_image_url || found['Packing Image URL']], ['Packed parcel', found['Packed Parcel Image URL']],
    ['Return 1: parcel before opening', found['Return Image URL']], ['Return 2: parcel after opening', found['Return Image 2 URL']]].filter(x => /^https:\/\//i.test(String(x[1] || '')));
  box.innerHTML = LOOK_ITEMS.length ? '<h4>Pictures and files</h4><div class="gal">' + LOOK_ITEMS.map(([l, u], i) => `<a href="${invEsc(u)}" data-i="${i}" target="_blank" rel="noopener noreferrer">${/\.pdf(\?|$)/i.test(u) ? '<div class="pdfth"><i class="fa-solid fa-file-pdf"></i></div>' : `<img class="th" loading="lazy" decoding="async" src="${invEsc(u)}" alt="${invEsc(l)}" onerror="this.outerHTML='<div class=pdfth><i class=\\'fa-solid fa-image\\'></i></div>'">`}<figcaption>${invEsc(l)}</figcaption></a>`).join('') + '</div>' : '';
  box.classList.toggle('hidden', !LOOK_ITEMS.length);
}
let LOOK_ITEMS = [], viewIdx = 0;
function openViewer(i) {
  if (!$('viewModal')) { const d = document.createElement('div'); d.id = 'viewModal'; d.className = 'modal'; d.innerHTML = '<div class="glass neon w-full vbox"><div class="dlhead"><h3 id="viewTitle" class="serif text-lg" style="flex:1"></h3><button class="mx" onclick="closeM(\'viewModal\')" aria-label="Close">&times;</button></div><div id="viewBody" class="vbody"></div><div class="dlmsg" style="display:flex;gap:8px;align-items:center"><button class="btn btn-ghost b flex-1" onclick="viewStep(-1)"><i class="fa-solid fa-chevron-left"></i>Previous</button><a id="viewOpen" class="btn btn-ghost y flex-none" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-up-right-from-square"></i>Open</a><button class="btn btn-ghost b flex-1" onclick="viewStep(1)">Next<i class="fa-solid fa-chevron-right"></i></button></div></div>'; document.body.appendChild(d); }
  viewIdx = (i + LOOK_ITEMS.length) % LOOK_ITEMS.length; const [l, u] = LOOK_ITEMS[viewIdx]; $('viewTitle').textContent = l; $('viewOpen').href = u;
  $('viewBody').innerHTML = /\.pdf(\?|$)/i.test(u) ? `<div class="pdfth" style="min-height:40vh"><i class="fa-solid fa-file-pdf"></i></div><p class="text-sm p-3 text-center" style="color:var(--mut)">This is a PDF. Tap Open to view it.</p>` : `<img src="${invEsc(u)}" alt="${invEsc(l)}" style="max-width:100%;max-height:68vh;margin:0 auto;display:block;border-radius:10px">`; openM('viewModal');
}
const viewStep = d => openViewer(viewIdx + d);

/* ---------- codes on the marketplace invoice: decoded once when the invoice is attached and stored with the order ---------- */
const JSQR_SRC = ['https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'];
async function decodeCodes(file) {
  const vals = new Set(); let src = null;
  try {
    if (/pdf/i.test(file.type) || /\.pdf$/i.test(file.name)) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pg = await (await pdfjsLib.getDocument({data: await file.arrayBuffer()}).promise).getPage(1), vp = pg.getViewport({scale: 2}); src = document.createElement('canvas'); src.width = vp.width; src.height = vp.height;
      await pg.render({canvasContext: src.getContext('2d'), viewport: vp}).promise;
    } else {
      const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height)); src = document.createElement('canvas'); src.width = Math.round(bmp.width * k); src.height = Math.round(bmp.height * k); src.getContext('2d').drawImage(bmp, 0, 0, src.width, src.height);
    }
  } catch (e) { return []; }
  if (window.BarcodeDetector) { try { (await new BarcodeDetector().detect(src)).forEach(x => x.rawValue && vals.add(String(x.rawValue))); } catch (e) {} }
  if (!vals.size && await ensure(() => window.jsQR, JSQR_SRC)) { try { const d = src.getContext('2d').getImageData(0, 0, src.width, src.height), q = jsQR(d.data, d.width, d.height, {inversionAttempts: 'attemptBoth'}); if (q && q.data) vals.add(q.data); } catch (e) {} }
  return [...vals].slice(0, 4).map(v => v.slice(0, 500));
}

/* ---------- Scan to search: the live camera reads barcodes, QR codes AND printed text (Order ID or customer name) ---------- */
let scanStream = null, scanTimerA = null, scanTimerB = null, scanBusyA = false, scanBusyB = false, scanDet = null, scanEnded = false, scanSeen = {};
const SCAN_FORMATS = ['qr_code', 'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'itf', 'codabar', 'upc_a', 'upc_e', 'data_matrix', 'pdf417', 'aztec'];
const normTxt = s => String(s || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF\s]/g, ' ').replace(/\s+/g, ' ').trim(), safeId = id => String(id).replace(/[^A-Za-z0-9_-]/g, '_');
const storedCodes = o => { try { const a = JSON.parse(o['Invoice QR'] || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; } };
const canon = x => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/[OQD]/g, '0').replace(/[IL|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2');   // OCR mixes up 0/O, 1/I/L, 5/S, 8/B, 2/Z
function editLE1(a, b) {   // are two strings at most one edit apart?
  if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false; let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1); return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}
const nums = t => [...String(t).matchAll(/\d[\d,]*\.?\d*/g)].map(m => parseFloat(m[0].replace(/,/g, ''))).filter(n => isFinite(n));
function dateForms(d) { const m = String(d || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return []; const [, y, mo, da] = m, n = x => String(+x); return [`${da}-${mo}-${y}`, `${da}/${mo}/${y}`, `${da}.${mo}.${y}`, `${n(da)}-${n(mo)}-${y}`, `${n(da)}/${n(mo)}/${y}`, `${y}-${mo}-${da}`, `${da}-${mo}-${y.slice(2)}`, `${da}/${mo}/${y.slice(2)}`]; }
function scanPick(texts) {   // Order ID (exact, look-alike or one misread character), then a QR we know, then a customer name (+ amount and date to pick the exact order)
  const T = texts.map(t => String(t || '')).filter(Boolean); if (!T.length) return null;
  const ids = orders.map(o => String(o['Order ID'] || '').trim()).filter(Boolean), nz = s => String(s).toLowerCase().trim(), all = T.join(' \n ');
  for (const t of T) { const tl = nz(t), hit = ids.find(id => tl === nz(id)) || ids.find(id => id.length >= 5 && tl.includes(nz(id))); if (hit) return {id: hit, kind: 'id'}; }
  const cText = canon(all), cIds = ids.map(id => [id, canon(id)]);
  const near = cIds.filter(([, c]) => c.length >= 8 && cText.includes(c)).sort((a, b) => b[1].length - a[1].length)[0]; if (near) return {id: near[0], kind: 'id'};   // the ID with spaces or look-alike letters
  const toks = [...new Set(all.split(/[^A-Za-z0-9_\-]+/).filter(x => x.length >= 6 && /\d/.test(x)).map(canon))];
  for (const tk of toks) { const h = cIds.find(([, c]) => c === tk) || cIds.find(([, c]) => c.length >= 10 && tk.length >= 9 && editLE1(c, tk)); if (h) return {id: h[0], kind: 'id'}; }   // look-alike letters, or one misread character in a long ID   // one misread character
  for (const t of T) { const m = t.match(/generated\/([A-Za-z0-9_-]+)_[0-9a-f]{24}\.pdf/i); if (m) { const o = orders.find(x => safeId(x['Order ID']).toLowerCase() === m[1].toLowerCase()); if (o) return {id: o['Order ID'], kind: 'qr'}; } }
  for (const t of T) { const tt = t.trim(); if (tt.length < 8) continue; const o = orders.find(x => storedCodes(x).some(c => c.trim() === tt || (c.length >= 12 && tt.includes(c)) || (tt.length >= 12 && c.includes(tt)))); if (o) return {id: o['Order ID'], kind: 'qr'}; }
  const text = normTxt(all), has = n => /[^\x00-\x7f]/.test(n) ? text.includes(n) : new RegExp('\\b' + n + '\\b').test(text);
  const hits = [...new Set(orders.map(o => normTxt(o['Customer Name'])).filter(n => n.length >= 4))].filter(n => has(n) || (n.split(' ').length >= 2 && n.split(' ').every(w => w.length >= 3 && has(w)))).sort((a, b) => b.length - a.length);
  if (hits.length) {
    const mine = orders.filter(x => normTxt(x['Customer Name']) === hits[0]), N = nums(all), lowAll = all.toLowerCase();
    if (mine.length > 1) {   // the same name on several orders: the amount and the date printed on the invoice tell which one
      const sc = mine.map(o => [o, (N.some(v => Math.abs(v - (parseFloat(o['Customer Price']) || parseFloat(o['Sale Price']) || -1)) < 0.011) ? 2 : 0) + (dateForms(o['Invoice Date']).some(f => lowAll.includes(f)) ? 2 : 0) + (o['SKU ID'] && lowAll.includes(String(o['SKU ID']).toLowerCase()) ? 1 : 0)]).sort((a, b) => b[1] - a[1]);
      if (sc[0][1] >= 2 && sc[0][1] > sc[1][1]) return {id: sc[0][0]['Order ID'], kind: 'name+details'};
    }
    return {name: mine[0] ? mine[0]['Customer Name'] : hits[0], kind: 'name'};
  }
  return null;
}
function scanFound(r) {
  if (scanEnded) return; scanEnded = true; if (navigator.vibrate) navigator.vibrate(60); closeScan(); $('searchId').value = r.id || r.name; searchOrder();
  if (r.unknown) toast('Scanned "' + r.id + '". No saved order matches it exactly, check the ID.', true);
}
const scanLive = t => { const e = $('scanLive'); if (e) e.textContent = t; };
function scanCanvas(vid, maxW, enhance) { const c = document.createElement('canvas'), k = Math.min(1, maxW / vid.videoWidth); c.width = Math.round(vid.videoWidth * k); c.height = Math.round(vid.videoHeight * k); const x = c.getContext('2d'); if (enhance) x.filter = 'grayscale(1) contrast(1.3)'; x.drawImage(vid, 0, 0, c.width, c.height); return c; }
async function scanTickA(vid) {   // barcodes and QR codes (fast)
  if (scanBusyA || !scanStream || !vid.videoWidth) return; scanBusyA = true;
  try {
    let vals = []; if (scanDet) vals = (await scanDet.detect(vid)).map(x => x.rawValue).filter(Boolean);
    else if (window.jsQR) { const c = scanCanvas(vid, 640), d = c.getContext('2d').getImageData(0, 0, c.width, c.height), q = jsQR(d.data, d.width, d.height, {inversionAttempts: 'dontInvert'}); if (q && q.data) vals = [q.data]; }
    if (vals.length) { const r = scanPick(vals); if (r) return scanFound(r); const raw = String(vals[0]).slice(0, 80); scanSeen[raw] = (scanSeen[raw] || 0) + 1; if (scanSeen[raw] >= 4) scanFound({id: raw, unknown: true}); }
  } catch (e) {} finally { scanBusyA = false; }
}
async function scanTickB(vid) {   // printed text: Order ID or customer name
  if (scanBusyB || !scanStream || !vid.videoWidth) return; scanBusyB = true;
  try { scanLive('Reading text...'); const w = await ocrWorker(), t = (await w.recognize(scanCanvas(vid, 1280, true))).data.text; if (!scanStream) return; const r = scanPick([t]); if (r) return scanFound(r); scanLive('Not found yet - hold steady on the Order ID, name or QR'); }
  catch (e) { scanLive('Text reader unavailable (check internet)'); } finally { scanBusyB = false; }
}
async function openScan() {
  openM('scanModal'); scanEnded = false; scanSeen = {}; const msg = $('scanMsg'), vid = $('scanVideo'), wrap = $('scanWrap'); scanLive('');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { wrap.classList.add('hidden'); msg.textContent = 'Live camera is not available in this browser. Use the photo option below.'; return; }
  wrap.classList.remove('hidden'); msg.textContent = 'Starting camera...';
  try { scanStream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}}, audio: false}); vid.srcObject = scanStream; await vid.play(); }
  catch (e) { wrap.classList.add('hidden'); msg.textContent = 'Camera not available (' + (e.name === 'NotAllowedError' ? 'permission denied' : e.message) + '). Use the photo option below.'; return; }
  msg.textContent = 'Point the camera at the barcode, QR code, Order ID or customer name on the invoice.';
  scanDet = null; if (window.BarcodeDetector) { try { const sup = await BarcodeDetector.getSupportedFormats(); scanDet = new BarcodeDetector({formats: SCAN_FORMATS.filter(f => sup.includes(f))}); } catch (e) { try { scanDet = new BarcodeDetector(); } catch (x) { scanDet = null; } } } else ensure(() => window.jsQR, JSQR_SRC);
  scanLive('Loading text reader...'); ocrWorker().catch(() => {});
  scanTimerA = setInterval(() => scanTickA(vid), 300); scanTimerB = setInterval(() => scanTickB(vid), 1500);
}
function closeScan() { clearInterval(scanTimerA); clearInterval(scanTimerB); scanTimerA = scanTimerB = null; if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; } $('scanVideo').srcObject = null; closeM('scanModal'); }
async function scanFromFile() {   // photo of the invoice / label: codes first, then the printed text
  const f = $('scanFile').files[0]; $('scanFile').value = ''; if (!f) return; const msg = $('scanMsg'); msg.textContent = 'Reading the image...'; scanEnded = false;
  try {
    const vals = await decodeCodes(f); let r = scanPick(vals); if (r) return scanFound(r);
    msg.textContent = 'Reading the printed text (a few seconds)...'; const text = await ocrImage(f, 1600); r = scanPick([text]); if (r) return scanFound(r);
    const toks = text.split(/[\s,;|:]+/).filter(x => x.length >= 8 && /\d/.test(x)); if (!toks.length && !vals.length) throw new Error('Could not find an Order ID, name or QR in the photo. Try a clearer, closer photo.');
    scanFound({id: (vals[0] || toks.sort((a, b) => b.length - a.length)[0]).slice(0, 80), unknown: true});
  } catch (e) { msg.textContent = e.message; }
}
