/* ============ ORDER FORM AUTOFILL + INVENTORY PRICES ============
   - State Tamil Nadu: CGST + SGST work, IGST is shown but switched off. Any other state: IGST works, CGST + SGST are switched off.
   - GST %: taken from the invoice; if it is missing it is calculated from the customer price and the GST amount (and the other way round).
   - Primary SKU found in the inventory: it is added to the secondary SKU list, so the stock is reduced.
   - Secondary SKUs: Original price and Sale price (for the chosen platform) are filled from the prices saved in the inventory. */
(function () {
  const E = id => document.getElementById(id), nv = id => { const v = parseFloat(E(id).value); return isFinite(v) ? v : 0; }, rnd = n => Math.round(n * 100) / 100;
  const lc = s => String(s || '').trim().toLowerCase();
  let PRICES = {};   // lower-case SKU -> {original, platforms: {name: price}}
  const priceOf = sku => PRICES[lc(sku)] || null;
  const platName = () => { const p = E('platform').value; if (p !== 'Others') return p; const o = E('platformOther'), t = o && (o.tagName === 'INPUT' ? o : o.querySelector('input')); return (t && t.value.trim()) || 'Others'; };
  const platPrice = (pr, name) => { const k = Object.keys(pr.platforms || {}).find(x => lc(x) === lc(name)); return k === undefined ? null : Number(pr.platforms[k]); };
  const isTN = s => /tamil\s*nadu|tamilnadu/i.test(String(s || '')) || /^\s*tn\s*$/i.test(String(s || ''));

  /* ---------- auto-filled values stay editable; a value you typed is never overwritten ---------- */
  const canFill = id => { const el = E(id); return !el.disabled && document.activeElement !== el && (el.value === '' || el.dataset.auto === '1'); };   // never touches the box you are typing in
  const setAuto = (id, v) => { const el = E(id); if (el.disabled) return; el.value = v; el.dataset.auto = '1'; };

  function stateMode() {
    const st = E('state').value.trim(), has = st !== '', tn = isTN(st);
    const set = (id, off) => { const el = E(id), box = el.parentElement; el.disabled = off; el.placeholder = off ? 'N/A' : ''; box.classList.toggle('gst-off', off); if (off) { el.value = ''; el.dataset.auto = ''; } };
    if (!has) { set('cgst', false); set('sgst', false); set('igst', false); return; }
    set('cgst', !tn); set('sgst', !tn); set('igst', tn);
  }
  function gstCalc() {
    const tn = isTN(E('state').value), price = nv('customerPrice'); if (price <= 0) return;
    if (tn) { if (nv('cgst') > 0 && nv('sgst') <= 0 && canFill('sgst')) setAuto('sgst', nv('cgst')); else if (nv('sgst') > 0 && nv('cgst') <= 0 && canFill('cgst')) setAuto('cgst', nv('sgst')); }
    const tax = tn ? nv('cgst') + nv('sgst') : nv('igst'), rate = nv('gstPercent');
    const taxAuto = tn ? (E('cgst').dataset.auto === '1' || E('sgst').dataset.auto === '1') : E('igst').dataset.auto === '1';
    if (tax > 0 && (rate <= 0 || E('gstPercent').dataset.auto === '1')) {   // GST % from the GST amount
      const base = price - tax;
      if (base > 0) { let g = tax / base * 100; const near = [0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28].find(s => Math.abs(s - g) <= 0.2); g = near !== undefined ? near : rnd(g); if (canFill('gstPercent')) setAuto('gstPercent', g); }
    } else if (rate > 0 && (tax <= 0 || taxAuto)) {                          // GST amount from the GST %
      const t = price - price / (1 + rate / 100);
      if (tn) { if (canFill('cgst')) setAuto('cgst', rnd(t / 2)); if (canFill('sgst')) setAuto('sgst', rnd(t / 2)); } else if (canFill('igst')) setAuto('igst', rnd(t));
    }
  }

  /* ---------- primary SKU -> secondary SKU, then prices ---------- */
  const secRows = () => [...document.querySelectorAll('#secSkuList .sec-sku')];
  function skuAuto() {
    const p = E('skuId').value.trim();
    secRows().forEach(i => { if (i.dataset.auto === '1' && lc(i.value) !== lc(p)) i.parentElement.remove(); });   // the primary SKU changed: drop the row that was added for the old one
    if (!secRows().length) addSecSku();
    const inv = p && typeof invRows !== 'undefined' && invRows.find(r => lc(r.sku_id) === lc(p));
    if (inv && !secRows().some(i => lc(i.value) === lc(p))) {
      let t = secRows().find(i => !i.value.trim()); if (!t) { addSecSku(); t = secRows().pop(); }
      t.value = inv.sku_id; t.dataset.auto = '1';
    }
    pricesAuto();
  }
  function pricesAuto() {
    const skus = secRows().map(i => i.value.trim()).filter(Boolean); if (!skus.length) return;
    const plat = platName(); let orig = 0, sale = 0, okO = true, okS = true;
    skus.forEach(s => { const pr = priceOf(s); if (!pr) { okO = okS = false; return; } if (pr.original > 0) orig += pr.original; else okO = false; const sp = platPrice(pr, plat); if (sp === null || !(sp > 0)) okS = false; else sale += sp; });
    if (okO && orig > 0 && canFill('originalPrice')) setAuto('originalPrice', rnd(orig));
    if (okS && sale > 0 && canFill('salePrice')) setAuto('salePrice', rnd(sale));
    if (typeof liveA === 'function') liveA();
  }
  function afterInvoiceParse() { stateMode(); gstCalc(); skuAuto(); }

  /* ---------- wiring ---------- */
  let skuT = null;
  const userEdit = e => { if (e.isTrusted && e.target && e.target.dataset) e.target.dataset.auto = ''; };
  let gstT = null; const gstSoon = () => { clearTimeout(gstT); gstT = setTimeout(gstCalc, 500); };   // wait until you pause typing
  ['customerPrice', 'cgst', 'sgst', 'igst', 'gstPercent', 'originalPrice', 'salePrice'].forEach(id => { const gst = /^(customerPrice|cgst|sgst|igst|gstPercent)$/.test(id);
    E(id).addEventListener('input', e => { userEdit(e); E(id).classList.remove('chk'); if (gst) gstSoon(); }); if (gst) E(id).addEventListener('change', () => { clearTimeout(gstT); gstCalc(); }); });
  E('state').addEventListener('input', () => { stateMode(); gstSoon(); });
  // a value the app filled in is replaced (not appended to) as soon as you start typing in that box
  ['customerPrice', 'cgst', 'sgst', 'igst', 'gstPercent', 'originalPrice', 'salePrice'].forEach(id => { const el = E(id);
    el.addEventListener('focus', () => { if (el.dataset.auto === '1') setTimeout(() => { try { el.select(); } catch (e) {} }, 0); });
    el.addEventListener('beforeinput', e => { if (el.dataset.auto === '1' && /^insert/.test(e.inputType || '')) { el.value = ''; el.dataset.auto = ''; } }); });
  E('skuId').addEventListener('input', () => { clearTimeout(skuT); skuT = setTimeout(skuAuto, 350); });
  E('skuId').addEventListener('change', skuAuto);
  E('platform').addEventListener('change', pricesAuto);
  const po = E('platformOther'); if (po) po.addEventListener('input', () => { clearTimeout(skuT); skuT = setTimeout(pricesAuto, 400); });
  E('secSkuList').addEventListener('input', e => { if (e.target.classList.contains('sec-sku')) { userEdit(e); clearTimeout(skuT); skuT = setTimeout(pricesAuto, 350); } });
  E('secSkuList').addEventListener('click', () => setTimeout(pricesAuto, 0));
  const form = E('skuId').closest('form'); if (form) form.addEventListener('reset', () => setTimeout(() => { form.querySelectorAll('[data-auto]').forEach(x => x.dataset.auto = ''); stateMode(); }, 0));
  stateMode();

  /* ---------- prices (stored in the SKU Prices tab of your sheet) ---------- */
  async function priceLoad() {
    try { const r = await api('POST', {action: 'price_list'}); if (!r || !r.success) return; PRICES = {}; Object.keys(r.prices || {}).forEach(k => PRICES[lc(k)] = r.prices[k]);
      if (typeof invRender === 'function') invRender(); pricesAuto(); } catch (e) {}
  }
  const money = n => 'Rs ' + (Number(n) || 0).toLocaleString('en-IN', {maximumFractionDigits: 2});
  function priceCell(sku) {
    const pr = priceOf(sku); if (!pr) return '<span class="pcell">Not set</span>';
    const pl = Object.keys(pr.platforms || {}), shown = pl.slice(0, 3).map(k => `${invEsc(k)} <b>${money(pr.platforms[k])}</b>`);
    return `<div class="pcell">Cost <b>${money(pr.original)}</b><br>${shown.join('<br>')}${pl.length > 3 ? `<br>+${pl.length - 3} more` : ''}</div>`;
  }
  const PRESETS = ['Amazon', 'Meesho', 'Flipkart'];
  function ensureModal() {
    if (E('priceModal')) return;
    const d = document.createElement('div'); d.id = 'priceModal'; d.className = 'modal';
    d.innerHTML = `<div class="glass neon w-full dlbox" style="max-width:30rem">
      <div class="dlhead"><h3 class="serif text-xl"><i class="fa-solid fa-tag" style="color:var(--gd)"></i>Prices</h3><button class="mx" onclick="closeM('priceModal')" aria-label="Close">&times;</button></div>
      <div class="dlbody">
        <p id="priceSku" class="font-semibold mb-3 break-all"></p>
        <label class="lbl" for="priceOrig">Original (cost) price (Rs)</label><input id="priceOrig" type="number" step="0.01" min="0" inputmode="decimal" class="inp mb-4">
        <div class="flex items-center justify-between mb-2"><label class="lbl" style="margin:0">Sale price by platform</label><button type="button" class="chip" onclick="priceAddRow()"><i class="fa-solid fa-plus mr-1"></i>Platform</button></div>
        <div id="priceRows" class="grid gap-2"></div>
        <p id="priceErr" class="text-xs mt-3" style="color:#ff6b81;min-height:1.1em"></p>
      </div>
      <div class="dlmsg" style="display:flex;gap:8px;align-items:center"><button class="btn btn-ghost flex-1" onclick="closeM('priceModal')">Cancel</button><button id="priceSaveBtn" class="btn btn-gold flex-1" onclick="priceSave()"><i class="fa-solid fa-floppy-disk"></i>Save prices</button></div>
    </div>`;
    document.body.appendChild(d);
  }
  function priceAddRow(name, price) {
    const box = E('priceRows'), preset = PRESETS.includes(name) ? name : (name ? '__o' : PRESETS[box.children.length] || '__o'), row = document.createElement('div'); row.className = 'prow';
    row.innerHTML = `<select class="inp prow-plat" aria-label="Platform">${PRESETS.map(p => `<option value="${p}">${p}</option>`).join('')}<option value="__o">Others</option></select>
      <input class="inp prow-price" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Sale price" aria-label="Sale price">
      <button type="button" class="btn btn-ghost !px-3" aria-label="Remove platform" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>
      <input class="inp prow-name hidden" maxlength="30" placeholder="Platform name" aria-label="Platform name">`;
    const sel = row.querySelector('.prow-plat'), nm = row.querySelector('.prow-name'); sel.value = preset;
    const sync = () => nm.classList.toggle('hidden', sel.value !== '__o'); sel.addEventListener('change', sync);
    if (name && preset === '__o') nm.value = name; if (price != null && price !== '') row.querySelector('.prow-price').value = price; sync(); box.appendChild(row);
  }
  let priceSkuNow = '';
  function priceOpen(n) {
    const r = invRows.find(x => Number(x.serial_no) === n); if (!r) return; ensureModal(); priceSkuNow = r.sku_id; E('priceSku').textContent = r.sku_id; E('priceErr').textContent = '';
    const pr = priceOf(r.sku_id); E('priceOrig').value = pr && pr.original ? pr.original : ''; E('priceRows').innerHTML = '';
    const pl = pr ? Object.keys(pr.platforms || {}) : []; if (pl.length) pl.forEach(k => priceAddRow(k, pr.platforms[k])); else PRESETS.forEach(p => priceAddRow(p, ''));
    openM('priceModal');
  }
  async function priceSave() {
    const err = E('priceErr'), orig = E('priceOrig').value.trim(), o = orig === '' ? 0 : Number(orig); err.textContent = '';
    if (!isFinite(o) || o < 0) return err.textContent = 'Original price must be 0 or more.';
    const plats = {};
    for (const row of E('priceRows').children) {
      const sel = row.querySelector('.prow-plat').value, name = (sel === '__o' ? row.querySelector('.prow-name').value : sel).trim(), v = row.querySelector('.prow-price').value.trim();
      if (!v && !name) continue; if (v === '') continue;
      if (!name) return err.textContent = 'Type the platform name for the "Others" row.'; const p = Number(v); if (!isFinite(p) || p < 0) return err.textContent = `Sale price for ${name} is not valid.`;
      plats[name] = p;
    }
    const b = E('priceSaveBtn'); b.disabled = true;
    try { const r = await api('POST', {action: 'price_set', sku: priceSkuNow, original: o, platforms: plats}); if (!r.success) throw new Error(r.error || 'Could not save');
      PRICES[lc(priceSkuNow)] = {original: o, platforms: plats}; closeM('priceModal'); toast('Prices saved'); invRender(); pricesAuto(); } catch (e) { if (!e.authExpired) err.textContent = e.message; }
    b.disabled = false;
  }

  /* ---------- checking what the invoice reader filled in ---------- */
  const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry', 'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep'];
  const ALIAS = {tn: 'Tamil Nadu', tamilnadu: 'Tamil Nadu', orissa: 'Odisha', pondicherry: 'Puducherry', 'new delhi': 'Delhi', uttaranchal: 'Uttarakhand', 'jammu kashmir': 'Jammu and Kashmir', 'jammu & kashmir': 'Jammu and Kashmir'};
  function canonState(s) {
    const n = String(s || '').toLowerCase().replace(/[^a-z& ]/g, ' ').replace(/\s+/g, ' ').trim(); if (!n) return '';
    if (ALIAS[n]) return ALIAS[n]; const ex = STATES.find(x => x.toLowerCase() === n); if (ex) return ex;
    return STATES.find(x => n.includes(x.toLowerCase())) || '';
  }
  const SLABS = [0, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];
  function invoiceOk() { return !!(E('orderId').value.trim() && nv('customerPrice') > 0 && E('invoiceDate').value && E('customerName').value.trim()); }
  function validateInvoice(r) {
    ['orderId', 'customerName', 'state', 'invoiceDate', 'customerPrice', 'skuId', 'address', 'gstPercent', 'cgst', 'sgst', 'igst'].forEach(i => E(i).classList.remove('chk'));
    const bad = [], flag = (id, why) => { E(id).classList.add('chk'); bad.push(why); }, price = nv('customerPrice');
    if (E('orderId').value.trim().length < 6) flag('orderId', 'Order ID');
    if (!(price > 0) || price > 500000) { flag('customerPrice', 'Customer price'); if (price > 500000) E('customerPrice').value = ''; }
    const nm = E('customerName').value.trim(); if (nm.length < 3 || !/[A-Za-z\u0B80-\u0BFF]{2}/.test(nm) || nm.length > 60) flag('customerName', 'Customer name');
    const d = E('invoiceDate').value, dt = new Date(d + 'T00:00:00'), now = Date.now(); if (!d || isNaN(dt) || dt > now + 86400000 * 2 || dt < now - 86400000 * 800) { flag('invoiceDate', 'Invoice date'); if (d) E('invoiceDate').value = ''; }
    const stRaw = E('state').value.trim(), st = canonState(stRaw); if (st) { if (st !== stRaw) E('state').value = st; stateMode(); } else flag('state', 'State');
    if (!E('skuId').value.trim()) flag('skuId', 'SKU'); if (E('address').value.trim().length < 10) flag('address', 'Address');
    const tn = isTN(E('state').value), tax = tn ? nv('cgst') + nv('sgst') : nv('igst'), rate = nv('gstPercent');
    if (tax > 0 && price > 0 && tax > price * 0.22) { ['cgst', 'sgst', 'igst'].forEach(i => { if (!E(i).disabled) E(i).value = ''; }); flag('gstPercent', 'GST amount'); }
    else if (tn && nv('cgst') > 0 && nv('sgst') > 0 && Math.abs(nv('cgst') - nv('sgst')) > 0.05) flag('sgst', 'CGST and SGST differ');
    if (rate > 0 && !SLABS.some(s => Math.abs(s - rate) < 0.01)) flag('gstPercent', 'GST %');
    else if (rate > 0 && tax > 0 && price > 0 && Math.abs(price - price / (1 + rate / 100) - tax) > Math.max(1.5, price * 0.03)) flag(tn ? 'cgst' : 'igst', 'GST amount does not match the GST %');
    return `Filled ${r.n} field(s) from the invoice. ` + (bad.length ? 'Please check the highlighted: ' + [...new Set(bad)].join(', ') + '.' : 'All key details look valid.') + ' Prices fill from your inventory when the SKU matches.';
  }
  Object.assign(window, {afterInvoiceParse, invoiceOk, validateInvoice, priceLoad, priceCell, priceOpen, priceSave, priceAddRow, priceOf});
})();
