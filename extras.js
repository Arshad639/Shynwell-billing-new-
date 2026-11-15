/* ============ SHYNWELL extras: step popup, packing cover stock, desktop webcam capture, AMAR with all your data + charts ============ */
(function () {
  const E = id => document.getElementById(id), lc = s => String(s || '').trim().toLowerCase();
  const inr = n => (Number(n) < 0 ? '-' : '') + '\u20B9' + Math.abs(Number(n) || 0).toLocaleString('en-IN', {maximumFractionDigits: 2}), B = t => `<b>${t}</b>`, today = () => new Date().toISOString().slice(0, 10);

  /* ---------- every modal box: the neon border wraps the whole box, only the inside scrolls ---------- */
  document.querySelectorAll('.modal > .glass.neon').forEach(box => {
    if (box.classList.contains('dlbox') || box.classList.contains('vbox') || box.querySelector(':scope > .nsc')) return;
    box.style.overflow = ''; box.style.maxHeight = ''; const w = document.createElement('div'); w.className = 'nsc'; while (box.firstChild) w.appendChild(box.firstChild); box.appendChild(w);
  });

  /* ---------- save popup: Order saved -> Invoice generated -> Packing covers left, then it disappears ---------- */
  function stepPopup(labels) {
    const old = E('stepPop'); if (old) old.remove(); const el = document.createElement('div'); el.id = 'stepPop'; el.setAttribute('role', 'status');
    el.innerHTML = labels.map(() => '<div class="sp-row"><span class="sp-ic sp-wait"></span><span class="sp-tx"></span></div>').join(''); document.body.appendChild(el);
    const rows = [...el.querySelectorAll('.sp-row')]; rows.forEach((r, i) => { r.querySelector('.sp-tx').textContent = labels[i]; }); requestAnimationFrame(() => el.classList.add('in'));
    let timer = null; const set = (i, t, st) => { const r = rows[i]; if (!r) return; r.querySelector('.sp-tx').textContent = t || labels[i]; r.querySelector('.sp-ic').className = 'sp-ic sp-' + st; r.classList.toggle('bad', st === 'bad'); };
    return {ok: (i, t) => set(i, t, 'ok'), bad: (i, t) => set(i, t, 'bad'), end(ms) { clearTimeout(timer); timer = setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, ms || 2400); }};
  }
  async function coverAfterSave(p, sp) {
    try { const r = await api('POST', {action: 'cover_use', orderId: p.orderId, n: p.coversUsed}); if (!r.success) throw new Error(r.error || 'failed');
      sp.ok(2, 'Packing covers left: ' + r.balance + (r.balance <= 0 ? ' (add stock)' : r.balance <= 10 ? ' (running low)' : '')); if (E('invMain') && !E('invMain').classList.contains('hidden')) coverLoad(); }
    catch (e) { if (!e.authExpired) sp.bad(2, 'Cover stock not updated: ' + e.message); }
  }

  /* ---------- packing cover stock card in Inventory ---------- */
  let CV = {balance: 0, updated: '', rows: [], ready: false};
  function coverBuild() {
    if (E('coverCard')) return; const d = document.createElement('section'); d.id = 'coverCard'; d.className = 'covercard'; E('invMain').prepend(d);
    d.addEventListener('click', e => { const b = e.target.closest('[data-cv]'); if (!b) return; if (b.dataset.cv === 'hist') coverHistory(); else coverEdit(b.dataset.cv); });
  }
  async function coverLoad() {
    coverBuild(); const d = E('coverCard'); if (!CV.ready) d.innerHTML = '<p class="text-sm" style="color:var(--mut)">Loading packing cover stock...</p>';
    try { const r = await api('POST', {action: 'cover_list'}); if (!r.success) throw new Error(r.error || 'failed'); CV = {balance: r.balance, updated: r.updated, rows: r.rows || [], ready: true}; }
    catch (e) { if (e.authExpired) return; d.innerHTML = `<p class="text-sm" style="color:#ff6b81">Packing covers: ${esc(e.message)}</p>`; return; }
    const low = CV.balance <= 10, week = CV.rows.filter(r => r.change < 0 && r.date >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).reduce((a, r) => a - r.change, 0);
    d.innerHTML = `<div class="cvtop"><span class="cvic"><i class="fa-solid fa-box-open"></i></span><div class="cvnum"><small>Packing covers in stock</small><b class="${CV.balance <= 0 ? 'neg' : low ? 'warn' : 'pos'}">${CV.balance}</b></div>
      <div class="cvmeta"><div><small>Last updated</small><span>${esc(CV.updated || '-')}</span></div><div><small>Used in 7 days</small><span>${week}</span></div></div></div>
      ${low ? `<p class="cvwarn">${CV.balance <= 0 ? 'No covers left. Add stock.' : 'Running low. Add stock soon.'}</p>` : ''}
      <div class="cvbtns"><button class="btn btn-ghost" data-cv="add"><i class="fa-solid fa-plus"></i>Add stock</button><button class="btn btn-ghost y" data-cv="set"><i class="fa-solid fa-pen"></i>Set count</button><button class="btn btn-ghost b" data-cv="hist"><i class="fa-solid fa-clock-rotate-left"></i>History</button></div>`;
  }
  function modal(id, inner) { let d = E(id); if (!d) { d = document.createElement('div'); d.id = id; d.className = 'modal'; document.body.appendChild(d); } d.innerHTML = `<div class="glass neon w-full dlbox" style="max-width:30rem">${inner}</div>`; return d; }
  let cvMode = 'add';
  function coverEdit(mode) {
    cvMode = mode; modal('cvEdit', `<div class="dlhead"><h3 class="serif text-xl" style="flex:1"><i class="fa-solid fa-box-open" style="color:var(--gd)"></i> ${mode === 'add' ? 'Add packing covers' : 'Set cover count'}</h3><button class="mx" onclick="closeM('cvEdit')" aria-label="Close">&times;</button></div>
      <div class="dlbody"><p class="text-xs mb-3" style="color:var(--mut)">Now in stock: <b style="color:var(--gd)">${CV.balance}</b></p>
        <label class="lbl" for="cvQty">${mode === 'add' ? 'Covers to add' : 'Covers in stock now'}</label><input id="cvQty" type="number" min="0" step="1" inputmode="numeric" class="inp mb-3">
        <label class="lbl" for="cvDate">Date</label><input id="cvDate" type="date" class="inp mb-3" value="${today()}">
        <label class="lbl" for="cvWhy">Reason <span style="opacity:.7">(optional)</span></label><input id="cvWhy" class="inp" maxlength="120" placeholder="${mode === 'add' ? 'e.g. bought 500 from supplier' : 'e.g. stock count'}">
        <p id="cvErr" class="text-xs mt-3" style="color:#ff6b81;min-height:1.1em"></p></div>
      <div class="dlmsg" style="display:flex;gap:8px"><button class="btn btn-ghost flex-1" onclick="closeM('cvEdit')">Cancel</button><button id="cvSave" class="btn btn-gold flex-1"><i class="fa-solid fa-floppy-disk"></i>Save</button></div>`);
    E('cvSave').onclick = coverSave; openM('cvEdit');
  }
  async function coverSave() {
    const q = E('cvQty').value.trim(), v = Number(q), err = E('cvErr'); err.textContent = '';
    if (q === '' || !Number.isInteger(v) || v < 0) return err.textContent = 'Enter a whole number.'; if (!E('cvDate').value) return err.textContent = 'Choose a date.';
    const b = E('cvSave'); b.disabled = true;
    try { const r = await api('POST', {action: 'cover_adjust', mode: cvMode, value: v, date: E('cvDate').value, reason: E('cvWhy').value.trim()}); if (!r.success) throw new Error(r.error || 'Could not save'); closeM('cvEdit'); toast(`Packing covers in stock: ${r.balance}`); coverLoad(); }
    catch (e) { if (!e.authExpired) err.textContent = e.message; } b.disabled = false;
  }
  function coverHistory() {
    modal('cvHist', `<div class="dlhead"><h3 class="serif text-xl" style="flex:1">Packing cover history</h3><button class="mx" onclick="closeM('cvHist')" aria-label="Close">&times;</button></div><div class="dlbody"><div class="accscroll"><table class="acctbl" style="min-width:420px"><thead><tr><th>Date</th><th class="r">Change</th><th class="r">Balance</th><th>Reason</th></tr></thead><tbody>${
      CV.rows.length ? CV.rows.map(r => `<tr><td class="whitespace-nowrap">${esc(r.date)}</td><td class="r"><b class="${r.change < 0 ? 'neg' : 'pos'}">${r.change > 0 ? '+' : ''}${r.change}</b></td><td class="r">${r.balance}</td><td>${esc(r.reason)}</td></tr>`).join('') : '<tr><td colspan="4" class="p-4 text-center" style="color:var(--mut)">No changes yet.</td></tr>'}</tbody></table></div></div>`); openM('cvHist');
  }
  const esc = s => invEsc(s == null ? '' : s);

  /* ---------- desktop: the Camera buttons open the webcam ---------- */
  let camStream = null, camCb = null;
  function camOpen(cb) {
    camCb = cb; modal('camModal', `<div class="dlhead"><h3 class="serif text-xl" style="flex:1"><i class="fa-solid fa-camera" style="color:var(--gd)"></i> Camera</h3><button class="mx" id="camX" aria-label="Close">&times;</button></div>
      <div class="dlbody"><div class="scanwrap" style="aspect-ratio:4/3"><video id="camVideo" playsinline muted></video></div><p id="camMsg" class="text-xs mt-2" style="color:var(--mut)">Starting camera...</p></div>
      <div class="dlmsg" style="display:flex;gap:8px"><button class="btn btn-ghost flex-1" id="camCancel">Cancel</button><button class="btn flex-1" id="camSnap"><i class="fa-solid fa-camera"></i>Capture</button></div>`);
    E('camX').onclick = E('camCancel').onclick = camClose; E('camSnap').onclick = camSnap; openM('camModal');
    navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1920}}, audio: false}).then(s => { camStream = s; const v = E('camVideo'); v.srcObject = s; v.play(); E('camMsg').textContent = 'Point the camera and press Capture.'; })
      .catch(e => { E('camMsg').textContent = 'Camera not available (' + (e.name === 'NotAllowedError' ? 'permission denied' : e.message) + '). Use Files instead.'; });
  }
  function camClose() { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } camCb = null; closeM('camModal'); }
  function camSnap() {
    const v = E('camVideo'); if (!camStream || !v.videoWidth) return; const k = Math.min(1, 1920 / v.videoWidth), c = document.createElement('canvas'); c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    c.toBlob(b => { const cb = camCb; camClose(); if (cb && b) cb(new File([b], 'camera-' + Date.now() + '.jpg', {type: 'image/jpeg'})); }, 'image/jpeg', .9);
  }
  document.addEventListener('click', e => {
    const i = e.target; if (!i || i.tagName !== 'INPUT' || i.type !== 'file' || !i.hasAttribute('capture')) return;
    if (matchMedia('(pointer: coarse)').matches || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;   // phones use their own camera app
    e.preventDefault(); camOpen(f => { const dt = new DataTransfer(); dt.items.add(f); i.files = dt.files; i.dispatchEvent(new Event('change', {bubbles: true})); });
  }, true);

  /* ================= AMAR: all data, all reports, charts ================= */
  const PAL = ['#00ff88', '#00e5ff', '#ffb703', '#a855f7', '#ff6b81', '#5eead4', '#f472b6', '#facc15', '#60a5fa', '#34d399'];
  async function drawChart(d, spec) {
    const cv = d.querySelector('canvas.amchart'); if (!cv) return;
    if (!await ensure(() => window.Chart, ['https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'])) { cv.insertAdjacentHTML('afterend', '<br>The chart library could not load. Check your internet.'); cv.remove(); return; }
    while (charts.length >= 6) { try { charts.shift().destroy(); } catch (e) {} }
    const type = ['bar', 'line', 'pie', 'doughnut'].includes(spec.type) ? spec.type : 'bar', pie = type === 'pie' || type === 'doughnut', labels = (spec.labels || []).slice(0, 14).map(String);
    const series = (spec.series || []).slice(0, 4).map((s, i) => ({label: s.name || '', data: (s.values || []).slice(0, 14).map(v => +v || 0), backgroundColor: pie ? PAL : (type === 'line' ? PAL[i % 10] + '33' : PAL[i % 10]), borderColor: type === 'line' ? PAL[i % 10] : '#0a0a0f', borderWidth: type === 'line' ? 2 : 1, fill: type === 'line', tension: .35, borderRadius: type === 'bar' ? 6 : 0}));
    charts.push(new Chart(cv, {type, data: {labels, datasets: series}, options: {responsive: true, maintainAspectRatio: true, plugins: {legend: {display: pie || series.length > 1, labels: {color: '#e8ecf4', boxWidth: 12}}, title: {display: !!spec.title, text: spec.title || '', color: '#e8ecf4', font: {size: 13}}}, scales: pie ? {} : {x: {ticks: {color: '#8a93a6', maxRotation: 50}, grid: {display: false}}, y: {ticks: {color: '#8a93a6'}, grid: {color: 'rgba(255,255,255,.07)'}}}}}));
  }
  const chartTag = '<canvas class="amchart" height="220"></canvas>';
  async function reply(d, html, spec) { d.innerHTML = cleanHtml(html + (spec ? chartTag : '')); $('chat').scrollTop = 1e6; if (spec) { await drawChart(d, spec); $('chat').scrollTop = 1e6; } return true; }

  const bad = o => String(o['Order Status'] || '').trim() !== '', priceNum = (o, k) => parseFloat(o[k]) || 0, expected = o => bad(o) ? 0 : (priceNum(o, 'Credited Price') > 0 ? priceNum(o, 'Credited Price') : priceNum(o, 'Sale Price'));
  const grp = (list, f) => { const m = new Map(); list.forEach(o => { const k = f(o) || 'Unknown'; (m.get(k) || m.set(k, []).get(k)).push(o); }); return [...m.entries()]; };
  const sumOf = (l, f) => Math.round(l.reduce((a, o) => a + (Number(f(o)) || 0), 0) * 100) / 100;
  const gstOf = o => bad(o) ? 0 : priceNum(o, 'CGST') + priceNum(o, 'SGST') + priceNum(o, 'IGST');
  const mon = o => String(o['Invoice Date'] || o['Timestamp'] || '').slice(0, 7) || 'Unknown';

  async function ensureAcc(then) {   // accounts need the Gmail code; ask for it, then answer
    if (accValid()) return then(); return new Promise(res => { needAccess(async () => { res(await then()); }); });
  }
  async function accData() { return window.accSummary ? await accSummary() : null; }
  async function snapshot() {
    const L = orders, ok = L.filter(o => !bad(o)), S = {today: today(), note: 'amounts in INR'};
    S.orders = {count: L.length, active: ok.length, revenue: sumOf(ok, o => o['Sale Price']), cost: sumOf(ok, o => o['Original Price']), net_profit: sumOf(L, o => profitOf(o)), loss: sumOf(L.filter(bad), o => o['Loss Amount']), gst: sumOf(L, gstOf), pending_credit_orders: ok.filter(o => !(priceNum(o, 'Credited Price') > 0)).length};
    S.by_platform = grp(L, o => o['Platform']).map(([k, l]) => ({platform: k, orders: l.length, revenue: sumOf(l.filter(o => !bad(o)), o => o['Sale Price']), profit: sumOf(l, o => profitOf(o)), returns: l.filter(bad).length, loss: sumOf(l.filter(bad), o => o['Loss Amount']), expected: sumOf(l, expected)}));
    S.by_month = grp(L, mon).sort((a, b) => a[0].localeCompare(b[0])).slice(-18).map(([k, l]) => ({month: k, orders: l.length, revenue: sumOf(l.filter(o => !bad(o)), o => o['Sale Price']), profit: sumOf(l, o => profitOf(o)), gst: sumOf(l, gstOf)}));
    S.by_state = grp(L, o => o['State']).sort((a, b) => b[1].length - a[1].length).slice(0, 12).map(([k, l]) => ({state: k, orders: l.length, revenue: sumOf(l.filter(o => !bad(o)), o => o['Sale Price'])}));
    S.by_sku = grp(L, o => o['SKU ID']).sort((a, b) => b[1].length - a[1].length).slice(0, 30).map(([k, l]) => ({sku: k, orders: l.length, revenue: sumOf(l.filter(o => !bad(o)), o => o['Sale Price']), profit: sumOf(l, o => profitOf(o)), returns: l.filter(bad).length}));
    S.returns = {by_status: Object.fromEntries(grp(L.filter(bad), o => o['Order Status']).map(([k, l]) => [k, l.length])), by_reason: grp(L.filter(bad), o => String(o['Cancel Reason'] || '').replace(/^Others - /, 'Others')).map(([k, l]) => ({reason: k, count: l.length, loss: sumOf(l, o => o['Loss Amount'])})),
      recent: L.filter(bad).slice(-15).map(o => ({id: o['Order ID'], customer: o['Customer Name'], status: o['Order Status'], reason: o['Cancel Reason'], loss: priceNum(o, 'Loss Amount'), initiated: o['Return Initiated Date'], delivered: o['Return Delivered Date'], notes: o['Return Notes']}))};
    S.customers = grp(L, o => o['Customer Name']).sort((a, b) => b[1].length - a[1].length).slice(0, 15).map(([k, l]) => ({name: k, orders: l.length, spent: sumOf(l.filter(o => !bad(o)), o => o['Sale Price'])}));
    S.recent_orders = L.slice(-25).map(o => ({id: o['Order ID'], customer: o['Customer Name'], date: String(o['Invoice Date'] || '').slice(0, 10), platform: o['Platform'], state: o['State'], sku: o['SKU ID'], price: priceNum(o, 'Customer Price') || priceNum(o, 'Sale Price'), status: o['Order Status'] || 'normal', covers: o['Covers Used']}));
    if (typeof invRows !== 'undefined' && invRows.length) S.inventory = invRows.slice(0, 80).map(r => { const p = priceOf(r.sku_id); return {sku: r.sku_id, stock: Number(r.stock_qty), reorder_level: Number(r.reorder_level) || 0, original_price: p ? p.original : null, sale_prices: p ? p.platforms : null}; });
    if (CV.ready) S.packing_covers = {in_stock: CV.balance, last_updated: CV.updated, used_last_7_days: CV.rows.filter(r => r.change < 0 && r.date >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).reduce((a, r) => a - r.change, 0)};
    if (accValid() && window.accSummary) { try { const A = await accSummary(); S.accounts = {total_received: A.T.rec, total_expected: A.T.ex, total_debits: A.T.deb, available_balance: A.T.avail, still_to_receive: A.T.pend, by_platform: A.T.pl.map(x => ({platform: x.p, expected: x.ex, received: x.rec, balance: x.bal})), recent_debits: A.rows.debit.slice(-10), recent_credits: A.rows.credit.slice(-10), platform_credits: A.rows.pcredit.slice(-10)}; } catch (e) {} }
    let j = JSON.stringify(S); if (j.length > 60000) { S.recent_orders = S.recent_orders.slice(-8); S.inventory = (S.inventory || []).slice(0, 40); j = JSON.stringify(S); } return j.slice(0, 65000);
  }
  async function ensureInv() { if (typeof invRows !== 'undefined' && invRows.length) return true; try { await invLoad(true); } catch (e) {} return typeof invRows !== 'undefined' && invRows.length > 0; }

  /* each handler returns true when it answered */
  const H = {
    async covers(t, d) {
      if (!/\b(covers?|packing covers?|packaging|poly ?bags?)\b/.test(t)) return false;
      return ensureAcc(async () => { await coverLoad(); const r = CV.rows, use = r.filter(x => x.change < 0), day = {}; use.forEach(x => { day[x.date] = (day[x.date] || 0) - x.change; });
        const last = Object.keys(day).sort().slice(-14), tot30 = use.filter(x => x.date >= new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)).reduce((a, x) => a - x.change, 0), perDay = tot30 / 30, left = perDay > 0 ? Math.floor(CV.balance / perDay) : null;
        return reply(d, `Packing covers in stock: ${B(CV.balance)} (last updated ${B(CV.updated || '-')}).<br>Used in the last 30 days: ${B(tot30)} (about ${perDay.toFixed(1)} a day).${left !== null ? `<br>At this rate the stock lasts about ${B(left + ' days')}.` : ''}${CV.balance <= 10 ? '<br><span class="neg">Add stock soon.</span>' : ''}`, last.length ? {type: 'bar', title: 'Covers used per day', labels: last, series: [{name: 'Covers', values: last.map(k => day[k])}]} : null); });
    },
    async inventory(t, d) {
      const hasSku = typeof invRows !== 'undefined' && invRows.length ? invRows.find(r => new RegExp('(^|[^a-z0-9])' + String(r.sku_id).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(t)) : null;
      if (!hasSku && !/\b(stock|inventory|low stock|out of stock|restock|reorder|units?|price|prices|cost price|sale price|original price)\b/.test(t)) return false;
      if (!await ensureInv()) return reply(d, 'Your inventory is empty or could not be loaded. Open the Inventory tab once and try again.');
      if (hasSku) {
        const sku = hasSku.sku_id, p = priceOf(sku), mine = orders.filter(o => lc(o['SKU ID']) === lc(sku)), ok = mine.filter(o => !bad(o)), pl = p ? Object.entries(p.platforms || {}) : [];
        return reply(d, `${B(sku)}: ${B(hasSku.stock_qty)} in stock (reorder level ${hasSku.reorder_level || 0}).<br>Orders: ${B(mine.length)} (${mine.length - ok.length} returned / cancelled), profit ${B(inr(sumOf(mine, o => profitOf(o))))}.${p ? `<br>Cost price ${B(inr(p.original))}.<br>${pl.length ? pl.map(([k, v]) => `${k}: ${B(inr(v))} sale (margin ${p.original > 0 ? B(((v - p.original) / v * 100).toFixed(0) + '%') : '-'})`).join('<br>') : 'No platform sale prices saved.'}` : '<br>No prices saved for this SKU. Use the Prices button in Inventory.'}`,
          pl.length ? {type: 'bar', title: sku + ' sale price by platform', labels: pl.map(x => x[0]), series: [{name: 'Sale price', values: pl.map(x => x[1])}, {name: 'Cost price', values: pl.map(() => p.original)}]} : null);
      }
      const rows = invRows.map(r => ({sku: r.sku_id, n: Number(r.stock_qty) || 0, re: Number(r.reorder_level) || 0})), out = rows.filter(r => r.n <= 0), low = rows.filter(r => r.n > 0 && r.n <= r.re), tot = rows.reduce((a, r) => a + r.n, 0), val = rows.reduce((a, r) => { const p = priceOf(r.sku); return a + (p ? p.original * r.n : 0); }, 0);
      const top = [...rows].sort((a, b) => a.n - b.n).slice(0, 12);
      return reply(d, `Inventory: ${B(rows.length)} SKUs, ${B(tot)} units${val ? `, stock value at cost ${B(inr(val))}` : ''}.<br>Out of stock: ${out.length ? out.slice(0, 8).map(r => B(r.sku)).join(', ') : 'none'}.<br>Low stock: ${low.length ? low.slice(0, 8).map(r => `${B(r.sku)} (${r.n})`).join(', ') : 'none'}.`, {type: 'bar', title: 'Lowest stock first', labels: top.map(r => r.sku), series: [{name: 'Units', values: top.map(r => r.n)}, {name: 'Reorder level', values: top.map(r => r.re)}]});
    },
    async accounts(t, d) {
      if (!/\b(debits?|balance|received|expenses?|payouts?|settlements?|platform credits?|credits? (received|entries|list|balance|summary)|available|to receive|spent|accounts?)\b/.test(t)) return false;
      return ensureAcc(async () => { let A; try { A = await accData(); } catch (e) { return reply(d, 'I could not load the accounts: ' + esc(e.message)); } if (!A) return false; const T = A.T;
        return reply(d, `Accounts summary:<br>Total received ${B(inr(T.rec))} | expected ${B(inr(T.ex))} | still to receive ${B(inr(T.pend))}.<br>Debits ${B(inr(T.deb))} | available balance ${B(inr(T.avail))}.<br>${T.pl.filter(x => x.ex || x.rec).map(x => `${x.p}: received ${inr(x.rec)} of ${inr(x.ex)} (${x.bal >= 0 ? 'to receive ' + inr(x.bal) : 'extra ' + inr(-x.bal)})`).join('<br>')}`,
          {type: 'bar', title: 'Expected vs received by platform', labels: T.pl.filter(x => x.ex || x.rec).map(x => x.p), series: [{name: 'Expected', values: T.pl.filter(x => x.ex || x.rec).map(x => x.ex)}, {name: 'Received', values: T.pl.filter(x => x.ex || x.rec).map(x => x.rec)}]}); });
    },
    async returns(t, d) {
      if (!/\b(returns?|returned|rto|cancel\w*|refunds?)\b/.test(t)) return false;
      const L = orders, R = L.filter(bad); if (!R.length) return reply(d, 'There are no returned, RTO or cancelled orders.');
      const st = grp(R, o => o['Order Status']), rs = grp(R, o => String(o['Cancel Reason'] || 'No reason').replace(/^Others - /, 'Others')).sort((a, b) => b[1].length - a[1].length), pl = grp(R, o => o['Platform']);
      const wantReason = /reason|why|cause/.test(t);
      return reply(d, `${B(R.length)} of ${B(L.length)} orders were returned / cancelled (${B((R.length / L.length * 100).toFixed(1) + '%')}). Total loss ${B(inr(sumOf(R, o => o['Loss Amount'])))}.<br>${st.map(([k, l]) => `${k}: ${B(l.length)}`).join(' | ')}<br>Top reasons: ${rs.slice(0, 4).map(([k, l]) => `${k} (${l.length})`).join(', ')}.<br>By platform: ${pl.map(([k, l]) => `${k} ${l.length}`).join(', ')}.`,
        wantReason ? {type: 'doughnut', title: 'Return reasons', labels: rs.map(x => x[0]), series: [{name: 'Orders', values: rs.map(x => x[1].length)}]} : {type: 'bar', title: 'Returns and loss by platform', labels: pl.map(x => x[0]), series: [{name: 'Returns', values: pl.map(x => x[1].length)}, {name: 'Loss (Rs)', values: pl.map(x => sumOf(x[1], o => o['Loss Amount']))}]});
    },
    async gst(t, d) {
      if (!/\b(gst|cgst|sgst|igst|tax)\b/.test(t)) return false;
      const m = grp(orders.filter(o => !bad(o)), mon).sort((a, b) => a[0].localeCompare(b[0])).slice(-12); if (!m.length) return reply(d, 'There are no orders yet.');
      const tot = k => sumOf(m.flatMap(x => x[1]), o => o[k]);
      return reply(d, `GST collected (cancelled / returned orders left out): CGST ${B(inr(tot('CGST')))} | SGST ${B(inr(tot('SGST')))} | IGST ${B(inr(tot('IGST')))} = ${B(inr(tot('CGST') + tot('SGST') + tot('IGST')))}.<br>${m.slice(-4).map(([k, l]) => `${k}: ${inr(sumOf(l, gstOf))}`).join(' | ')}`, {type: 'bar', title: 'GST by month', labels: m.map(x => x[0]), series: [{name: 'CGST', values: m.map(x => sumOf(x[1], o => o['CGST']))}, {name: 'SGST', values: m.map(x => sumOf(x[1], o => o['SGST']))}, {name: 'IGST', values: m.map(x => sumOf(x[1], o => o['IGST']))}]});
    },
    async order(t, d) {
      const r = window.scanPick ? scanPick([t]) : null; if (!r || (r.kind === 'name' && /\b(top|best|most|highest|which customer|all customers)\b/.test(t))) return false;
      const list = r.id ? orders.filter(o => lc(o['Order ID']) === lc(r.id)) : orders.filter(o => lc(o['Customer Name']) === lc(r.name)); if (!list.length) return false;
      const one = o => `${B(o['Order ID'])} | ${esc(o['Customer Name'])} | ${esc(o['Platform'])} | ${esc(String(o['Invoice Date'] || '').slice(0, 10))}<br>State ${esc(o['State'] || '-')} | SKU ${esc(o['SKU ID'] || '-')} | price ${inr(priceNum(o, 'Customer Price') || priceNum(o, 'Sale Price'))} | GST ${inr(gstOf(o))} | profit ${B(inr(profitOf(o)))}<br>Status: ${B(bad(o) ? o['Order Status'] : 'normal')}${bad(o) ? ` (${esc(o['Cancel Reason'] || 'no reason')}${o['Return Notes'] ? ', ' + esc(o['Return Notes']) : ''}${o['Return Initiated Date'] ? ', initiated ' + esc(String(o['Return Initiated Date']).slice(0, 10)) : ''}${o['Return Delivered Date'] ? ', delivered ' + esc(String(o['Return Delivered Date']).slice(0, 10)) : ''})` : ''}${o['Covers Used'] ? ` | covers used ${o['Covers Used']}` : ''}`;
      return reply(d, (list.length > 1 ? `${B(list.length)} orders for ${B(esc(list[0]['Customer Name']))} (total ${inr(sumOf(list.filter(o => !bad(o)), o => o['Sale Price']))}):<br><br>` : '') + list.slice(0, 8).map(one).join('<br><br>') + (list.length > 8 ? '<br>...and more. Use Order lookup to open one.' : ''));
    }
  };
  async function amarRoute(text, d) {
    const t = lc(text); if (!t) return false;
    for (const k of ['covers', 'accounts', 'returns', 'gst', 'inventory', 'order']) { try { if (await H[k](t, d)) return true; } catch (e) { if (e && e.authExpired) return true; } }
    return false;
  }
  const amarWantsAI = text => { const w = lc(text).split(/\s+/).length; return w >= 11 || /\b(why|explain|compare|suggest|advice|should|analy[sz]e|trend|predict|forecast|improve|strategy|insight)\b/.test(lc(text)); };
  function splitChart(txt) {   // Gemini may end with: CHART: {json}
    const m = String(txt).match(/\n?\s*CHART:\s*(\{[\s\S]*\})\s*$/); if (!m) return {text: String(txt), spec: null};
    try { const s = JSON.parse(m[1]); if (s && Array.isArray(s.labels) && Array.isArray(s.series) && s.series.length) return {text: String(txt).slice(0, m.index).trim(), spec: s}; } catch (e) {} return {text: String(txt).slice(0, m.index).trim(), spec: null};
  }
  Object.assign(window, {stepPopup, coverAfterSave, coverLoad, amarRoute, amarWantsAI, amarSnapshot: snapshot, amarSplitChart: splitChart, amarDrawChart: drawChart});
})();
