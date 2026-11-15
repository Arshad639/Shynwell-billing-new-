/* ============ ACCOUNTS: Credit (order-wise + platform-wise), Debit, Balance ============
   Stored in three tabs of your Google Sheet (Credits, Platform Credits, Debits) through Apps Script. Protected by the Gmail code like Inventory.
   Expected money from a platform = credited price (else sale price) of its orders that were not cancelled / returned.
   Received from a platform = its order-wise credits + its platform-wise credits.   Balance to receive = expected - received.
   Available balance = everything received - everything debited. */
(function () {
  const E = id => document.getElementById(id), lc = s => String(s || '').trim().toLowerCase(), esc = s => invEsc(s == null ? '' : s);
  const rnd = n => Math.round((Number(n) || 0) * 100) / 100, sum = (a, f) => rnd(a.reduce((t, x) => t + (Number(f(x)) || 0), 0));
  const inr = n => (n < 0 ? '-' : '') + '\u20B9' + Math.abs(Number(n) || 0).toLocaleString('en-IN', {maximumFractionDigits: 2});
  const today = () => new Date().toISOString().slice(0, 10);
  const A = {tab: 'credit', sub: 'order', q: '', rows: {credit: [], pcredit: [], debit: []}, loaded: false, built: false};
  const KINDS = {
    credit: {title: 'Order credit', id: 'Credit ID', fields: [['Order ID', 'text', 1], ['Platform', 'text', 1], ['Credit Date', 'date', 1], ['Expected Amount', 'number'], ['Status', 'status'], ['Credit Amount', 'number'], ['Notes', 'text']]},
    pcredit: {title: 'Platform credit', id: 'Credit ID', fields: [['Platform', 'text', 1], ['Credit Date', 'date', 1], ['Credit Amount', 'number', 1], ['Reference', 'text'], ['Notes', 'text']]},
    debit: {title: 'Debit', id: 'Debit ID', fields: [['Debit Date', 'date', 1], ['Amount', 'number', 1], ['Purpose', 'text', 1], ['Notes', 'text']]}
  };
  const STATUSES = ['Pending', 'Credited', 'Partial', 'Rejected'], BASE_PLAT = ['Amazon', 'Meesho', 'Flipkart', 'Others'];

  /* ---------- data ---------- */
  async function loadAll(force) {
    if (A.loaded && !force) return;
    for (const k of Object.keys(KINDS)) { const r = await api('POST', {action: 'acc_list', kind: k}); if (!r.success) throw Object.assign(new Error(r.error || 'Could not load accounts'), {expired: r.expired}); A.rows[k] = r.rows || []; }
    A.loaded = true;
  }
  async function reload() { A.loaded = false; await loadAll(true); render(); if (window._lookOrder) lookCreditsRender(window._lookOrder); }
  const platforms = () => {
    const seen = new Map(), add = p => { p = String(p || '').trim(); if (p && !seen.has(lc(p))) seen.set(lc(p), p); };
    BASE_PLAT.slice(0, 3).forEach(add); orders.forEach(o => add(o['Platform'])); A.rows.credit.forEach(r => add(r['Platform'])); A.rows.pcredit.forEach(r => add(r['Platform'])); add('Others'); return [...seen.values()];
  };
  const expectedOf = o => { if (String(o['Order Status'] || '').trim()) return 0; const c = parseFloat(o['Credited Price']); return c > 0 ? c : (parseFloat(o['Sale Price']) || 0); };
  const expectedBy = p => sum(orders.filter(o => lc(o['Platform']) === lc(p)), expectedOf);
  const receivedBy = p => ({ord: sum(A.rows.credit.filter(r => lc(r['Platform']) === lc(p)), r => r['Credit Amount']), plat: sum(A.rows.pcredit.filter(r => lc(r['Platform']) === lc(p)), r => r['Credit Amount'])});
  const totals = () => {
    const pl = platforms().map(p => { const rc = receivedBy(p), ex = expectedBy(p); return {p, ex, ord: rc.ord, plat: rc.plat, rec: rnd(rc.ord + rc.plat), bal: rnd(ex - rc.ord - rc.plat)}; });
    const ex = sum(pl, x => x.ex), rec = sum(pl, x => x.rec), deb = sum(A.rows.debit, r => r['Amount']);
    return {pl, ex, rec, deb, avail: rnd(rec - deb), pend: rnd(ex - rec)};
  };
  const byDate = (k, f) => [...A.rows[k]].sort((a, b) => String(b[f]).localeCompare(String(a[f])));
  const cls = n => n > 0 ? 'pos' : n < 0 ? 'neg' : '';

  /* ---------- screen ---------- */
  function build() {
    if (A.built) return; A.built = true;
    E('accMain').innerHTML = `<div class="accwrap">
      <div class="acchead"><h2 class="serif text-2xl"><i class="fa-solid fa-wallet mr-2" style="color:#14b8a6"></i>Accounts</h2><button class="btn btn-ghost" onclick="openDownloads()"><i class="fa-solid fa-download"></i><span>Download</span></button></div>
      <div class="dlseg" id="accTabs"><button type="button" data-t="credit">Credit</button><button type="button" data-t="debit">Debit</button><button type="button" data-t="balance">Balance</button></div>
      <div id="accSubWrap"></div><div id="accBody"></div></div>`;
    E('accTabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { A.tab = b.dataset.t; A.q = ''; render(); } });
    E('accMain').addEventListener('click', onClick); E('accMain').addEventListener('input', e => { if (e.target.id === 'accQ') { A.q = e.target.value; renderBody(); const q = E('accQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); } });
  }
  async function accLoad() {
    build(); render();
    try { E('accBody').innerHTML = '<p class="text-sm p-4" style="color:var(--mut)">Loading...</p>'; await loadAll(true); render(); } catch (e) { if (e.authExpired) return; E('accBody').innerHTML = `<p class="text-sm p-4" style="color:#ff6b81">${esc(e.message)}</p>`; }
  }
  function render() {
    if (!A.built) return;
    document.querySelectorAll('#accTabs [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === A.tab));
    E('accSubWrap').innerHTML = A.tab === 'credit' ? `<div class="dlseg two"><button type="button" data-s="order" class="${A.sub === 'order' ? 'on' : ''}">Order-wise</button><button type="button" data-s="platform" class="${A.sub === 'platform' ? 'on' : ''}">Platform-wise</button></div>` : '';
    renderBody();
  }
  const sumBox = (label, val, c, wide) => `<div class="${wide ? 'wide' : ''}"><small>${label}</small><b class="${c || ''}">${inr(val)}</b></div>`;
  const actBtns = (k, id) => `<span class="accact"><button class="chip" data-act="edit" data-k="${k}" data-id="${esc(id)}" aria-label="Edit"><i class="fa-solid fa-pen"></i></button><button class="chip" data-act="del" data-k="${k}" data-id="${esc(id)}" aria-label="Delete" style="border-color:#ff6b81;color:#ff6b81"><i class="fa-solid fa-trash"></i></button></span>`;
  function renderBody() {
    const b = E('accBody'); if (!b) return;
    if (A.tab === 'credit') b.innerHTML = A.sub === 'order' ? orderView() : platformView();
    else if (A.tab === 'debit') b.innerHTML = debitView(); else b.innerHTML = balanceView();
  }
  function orderView() {
    const q = lc(A.q), rows = byDate('credit', 'Credit Date').filter(r => !q || lc(r['Order ID']).includes(q) || lc(r['Platform']).includes(q) || lc(r['Status']).includes(q) || customerOf(r['Order ID']).includes(q));
    return `<div class="acctool"><input id="accQ" class="inp" placeholder="Search order ID, customer, platform or status" value="${esc(A.q)}"><button class="btn" data-act="add" data-k="credit"><i class="fa-solid fa-plus"></i>Add credit</button></div>
      <div class="accscroll"><table class="acctbl" style="min-width:760px"><thead><tr><th>Order ID</th><th>Platform</th><th>Credit date</th><th class="r">Amount</th><th>Status</th><th class="r">Credit amount</th><th>Actions</th></tr></thead><tbody>${
      rows.length ? rows.map(r => `<tr><td class="break-all"><b>${esc(r['Order ID'])}</b>${customerOf(r['Order ID']) ? `<br><small style="color:var(--mut)">${esc(customerName(r['Order ID']))}</small>` : ''}</td><td>${esc(r['Platform'])}</td><td class="whitespace-nowrap">${esc(r['Credit Date'])}</td><td class="r">${inr(r['Expected Amount'])}</td><td><span class="badge b-${esc(r['Status'])}">${esc(r['Status'])}</span></td><td class="r"><b class="pos">${inr(r['Credit Amount'])}</b></td><td>${actBtns('credit', r['Credit ID'])}</td></tr>`).join('')
      : `<tr><td colspan="7" class="p-6 text-center" style="color:var(--mut)">${A.rows.credit.length ? 'No credit matches your search.' : 'No credits yet. Tap "Add credit".'}</td></tr>`}</tbody></table></div>
      <div class="accsum">${sumBox('Expected (listed)', sum(rows, r => r['Expected Amount']))}${sumBox('Credited (listed)', sum(rows, r => r['Credit Amount']), 'pos')}</div>`;
  }
  const customerName = id => { const o = orders.find(x => lc(x['Order ID']) === lc(id)); return o ? o['Customer Name'] || '' : ''; };
  const customerOf = id => lc(customerName(id));
  function platformView() {
    const T = totals();
    return T.pl.map(x => {
      const rows = byDate('pcredit', 'Credit Date').filter(r => lc(r['Platform']) === lc(x.p));
      return `<section class="accplat"><h3><span>${esc(x.p)}</span><button class="btn btn-ghost" style="min-height:38px;padding:6px 12px;font-size:.8rem" data-act="add" data-k="pcredit" data-p="${esc(x.p)}"><i class="fa-solid fa-plus"></i>Add credit</button></h3>
        <div class="accscroll"><table class="acctbl" style="min-width:520px"><thead><tr><th>Credit date</th><th class="r">Credit amount</th><th>Reference</th><th>Notes</th><th>Actions</th></tr></thead><tbody>${
        rows.length ? rows.map(r => `<tr><td class="whitespace-nowrap">${esc(r['Credit Date'])}</td><td class="r"><b class="pos">${inr(r['Credit Amount'])}</b></td><td>${esc(r['Reference'])}</td><td>${esc(r['Notes'])}</td><td>${actBtns('pcredit', r['Credit ID'])}</td></tr>`).join('') : '<tr><td colspan="5" class="p-4 text-center" style="color:var(--mut)">No credits for this platform yet.</td></tr>'}</tbody></table></div>
        <div class="accsum">${sumBox('Platform credits', x.plat, 'pos')}${sumBox('Order-wise credits', x.ord, 'pos')}${sumBox('Total received', x.rec, 'pos')}${sumBox('Expected from orders', x.ex)}${sumBox(x.bal < 0 ? 'Received extra' : 'Platform balance to receive', Math.abs(x.bal), x.bal > 0 ? 'warn' : x.bal < 0 ? 'neg' : 'pos', true)}</div></section>`;
    }).join('') + `<section class="accplat"><h3><span>Overall</span></h3><div class="accsum">${sumBox('Total received', T.rec, 'pos')}${sumBox('Total expected', T.ex)}${sumBox('Overall balance to receive', T.pend, T.pend > 0 ? 'warn' : 'pos', true)}</div></section>`;
  }
  function debitView() {
    const T = totals(), rows = byDate('debit', 'Debit Date');
    return `<div class="acctool"><span class="text-sm" style="color:var(--mut);align-self:center">Money you spent or took out</span><button class="btn" data-act="add" data-k="debit"><i class="fa-solid fa-plus"></i>Add debit</button></div>
      <div class="accscroll"><table class="acctbl" style="min-width:560px"><thead><tr><th>Date</th><th class="r">Amount</th><th>Purpose</th><th>Notes</th><th>Actions</th></tr></thead><tbody>${
      rows.length ? rows.map(r => `<tr><td class="whitespace-nowrap">${esc(r['Debit Date'])}</td><td class="r"><b class="neg">${inr(r['Amount'])}</b></td><td>${esc(r['Purpose'])}</td><td>${esc(r['Notes'])}</td><td>${actBtns('debit', r['Debit ID'])}</td></tr>`).join('') : '<tr><td colspan="5" class="p-6 text-center" style="color:var(--mut)">No debits yet. Tap "Add debit".</td></tr>'}</tbody></table></div>
      <div class="accsum">${sumBox('Total credits received', T.rec, 'pos')}${sumBox('Total debits', T.deb, 'neg')}${sumBox('Balance (credits - debits)', T.avail, cls(T.avail), true)}</div>`;
  }
  function balanceView() {
    const T = totals();
    return `<div class="accscroll"><table class="acctbl" style="min-width:520px"><thead><tr><th>Platform</th><th class="r">Expected</th><th class="r">Received</th><th class="r">Balance to receive</th></tr></thead><tbody>${
      T.pl.map(x => `<tr><td><b>${esc(x.p)}</b></td><td class="r">${inr(x.ex)}</td><td class="r pos">${inr(x.rec)}</td><td class="r ${x.bal > 0 ? 'warn' : x.bal < 0 ? 'neg' : 'pos'}"><b>${inr(x.bal)}</b></td></tr>`).join('')}
      <tr style="background:rgba(255,255,255,.05)"><td><b>All platforms</b></td><td class="r"><b>${inr(T.ex)}</b></td><td class="r pos"><b>${inr(T.rec)}</b></td><td class="r ${T.pend > 0 ? 'warn' : 'pos'}"><b>${inr(T.pend)}</b></td></tr></tbody></table></div>
      <div class="accsum">${sumBox('Total received', T.rec, 'pos')}${sumBox('Total debits', T.deb, 'neg')}${sumBox('Available balance (credits - debits)', T.avail, cls(T.avail), true)}${sumBox('Still to receive from platforms', T.pend, T.pend > 0 ? 'warn' : 'pos', true)}</div>`;
  }

  /* ---------- add / edit / delete ---------- */
  function onClick(e) {
    const s = e.target.closest('[data-s]'), sw = E('accSubWrap'); if (s && sw && sw.contains(s)) { A.sub = s.dataset.s; A.q = ''; return render(); }
    const b = e.target.closest('[data-act]'); if (!b) return; const k = b.dataset.k, id = b.dataset.id;
    if (b.dataset.act === 'add') openEntry(k, null, b.dataset.p ? {Platform: b.dataset.p} : {});
    else if (b.dataset.act === 'edit') openEntry(k, A.rows[k].find(r => r[KINDS[k].id] === id));
    else if (b.dataset.act === 'del') delEntry(k, id);
  }
  function ensureModal() {
    if (E('accEntry')) return; const d = document.createElement('div'); d.id = 'accEntry'; d.className = 'modal';
    d.innerHTML = `<div class="glass neon w-full dlbox" style="max-width:30rem"><div class="dlhead"><h3 id="aeTitle" class="serif text-xl"></h3><button class="mx" onclick="closeM('accEntry')" aria-label="Close">&times;</button></div><div class="dlbody"><div id="aeFields" class="grid gap-3"></div><p id="aeErr" class="text-xs mt-3" style="color:#ff6b81;min-height:1.1em"></p></div>
      <div class="dlmsg" style="display:flex;gap:8px"><button class="btn btn-ghost flex-1" onclick="closeM('accEntry')">Cancel</button><button id="aeSave" class="btn btn-gold flex-1" onclick="accEntrySave()"><i class="fa-solid fa-floppy-disk"></i>Save</button></div></div>
      <datalist id="aeOrders"></datalist><datalist id="aePlats"></datalist><datalist id="aePurposes"><option value="Packaging"><option value="Shipping"><option value="Advertising"><option value="Purchase / Stock"><option value="Salary"><option value="Rent"><option value="Withdrawal"><option value="Other"></datalist>`;
    document.body.appendChild(d);
  }
  let editKind = '', editId = '';
  function openEntry(k, row, pre) {
    ensureModal(); editKind = k; editId = row ? row[KINDS[k].id] : ''; const K = KINDS[k], v = row || pre || {};
    E('aeTitle').textContent = (row ? 'Edit ' : 'Add ') + K.title.toLowerCase(); E('aeErr').textContent = '';
    E('aeOrders').innerHTML = orders.slice(0, 1500).map(o => `<option value="${esc(o['Order ID'])}" label="${esc((o['Customer Name'] || '') + ' - ' + (o['Platform'] || ''))}"></option>`).join(''); E('aePlats').innerHTML = platforms().map(p => `<option value="${esc(p)}">`).join('');
    E('aeFields').innerHTML = K.fields.map(([name, type, req]) => {
      const val = v[name] != null && v[name] !== '' ? v[name] : (type === 'date' && !row ? today() : type === 'status' && !row ? 'Pending' : ''), id = 'ae_' + name.replace(/\W/g, '');
      const lab = `<label class="lbl" for="${id}">${name}${req ? ' <span style="color:#ff6b81">*</span>' : ''}</label>`;
      if (type === 'status') return `<div>${lab}<select id="${id}" class="inp">${STATUSES.map(s => `<option${s === val ? ' selected' : ''}>${s}</option>`).join('')}</select></div>`;
      const list = name === 'Order ID' ? ' list="aeOrders"' : name === 'Platform' ? ' list="aePlats"' : name === 'Purpose' ? ' list="aePurposes"' : '';
      return `<div>${lab}<input id="${id}" class="inp" type="${type === 'number' ? 'number' : type}"${type === 'number' ? ' step="0.01" min="0" inputmode="decimal"' : ''}${list} maxlength="200" autocomplete="off" value="${esc(val)}"></div>`;
    }).join('');
    if (k === 'credit') { const oi = E('ae_OrderID'); oi.addEventListener('change', () => { const o = orders.find(x => lc(x['Order ID']) === lc(oi.value)); if (!o) return; if (!E('ae_Platform').value) E('ae_Platform').value = o['Platform'] || ''; if (!(parseFloat(E('ae_ExpectedAmount').value) > 0)) E('ae_ExpectedAmount').value = expectedOf(o) || parseFloat(o['Credited Price']) || parseFloat(o['Sale Price']) || ''; }); }
    openM('accEntry');
  }
  async function accEntrySave() {
    const K = KINDS[editKind], row = {}, err = E('aeErr'); err.textContent = '';
    for (const [name, type, req] of K.fields) { const el = E('ae_' + name.replace(/\W/g, '')); let v = el.value.trim(); if (req && !v) return err.textContent = name + ' is required.'; if (type === 'number' && v !== '' && !(Number(v) >= 0)) return err.textContent = name + ' must be 0 or more.'; row[name] = v; }
    const b = E('aeSave'); b.disabled = true;
    try { const r = await api('POST', {action: 'acc_save', kind: editKind, id: editId || undefined, row}); if (!r.success) throw new Error(r.error || 'Could not save'); closeM('accEntry'); toast(r.message || 'Saved'); await reload(); }
    catch (e) { if (!e.authExpired) err.textContent = e.message; }
    b.disabled = false;
  }
  async function delEntry(k, id) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    try { const r = await api('POST', {action: 'acc_delete', kind: k, id}); if (!r.success) throw new Error(r.error || 'Could not delete'); toast('Entry deleted'); await reload(); } catch (e) { if (!e.authExpired) toast(e.message, true); }
  }

  /* ---------- credits inside Order lookup ---------- */
  async function lookCreditsRender(orderId) {
    window._lookOrder = orderId; let box = E('lookCredits');
    if (!box) { box = document.createElement('div'); box.id = 'lookCredits'; box.className = 'lookcr'; E('delBtn').before(box); E('lookCredits').addEventListener('click', onClick); }
    const show = () => {
      const rows = A.rows.credit.filter(r => lc(r['Order ID']) === lc(orderId)), o = orders.find(x => lc(x['Order ID']) === lc(orderId)) || {};
      box.innerHTML = `<h4><span><i class="fa-solid fa-hand-holding-dollar mr-2"></i>Credits for this order</span><button class="chip" data-act="addo" aria-label="Add credit"><i class="fa-solid fa-plus mr-1"></i>Add</button></h4>${
        rows.length ? rows.map(r => `<div class="flex items-center justify-between gap-2 py-2" style="border-top:1px solid rgba(255,255,255,.08)"><div class="text-sm"><b class="pos">${inr(r['Credit Amount'])}</b> <span class="badge b-${esc(r['Status'])}">${esc(r['Status'])}</span><br><small style="color:var(--mut)">${esc(r['Credit Date'])} | ${esc(r['Platform'])} | expected ${inr(r['Expected Amount'])}</small></div>${actBtns('credit', r['Credit ID'])}</div>`).join('')
        : '<p class="text-xs" style="color:var(--mut)">No credit recorded for this order yet.</p>'}`;
      box.querySelector('[data-act=addo]').onclick = () => openEntry('credit', null, {'Order ID': orderId, Platform: o['Platform'] || '', 'Expected Amount': expectedOf(o) || ''});
    };
    if (A.loaded) return show();
    if (!accValid()) { box.innerHTML = '<h4><span><i class="fa-solid fa-hand-holding-dollar mr-2"></i>Credits for this order</span></h4><button class="btn btn-ghost w-full" id="lcShow"><i class="fa-solid fa-lock"></i>Show credits (Gmail code)</button>'; E('lcShow').onclick = () => needAccess(async () => { try { await loadAll(); show(); } catch (e) {} }); return; }
    box.innerHTML = '<p class="text-xs" style="color:var(--mut)">Loading credits...</p>'; try { await loadAll(); show(); } catch (e) { box.innerHTML = ''; }
  }

  /* ---------- Excel sheets for the Download Center ---------- */
  async function accSheets() {
    await loadAll(true); const T = totals();
    return [['Credits Order-wise', [['Credit ID', 'Order ID', 'Customer', 'Platform', 'Credit date', 'Expected amount', 'Status', 'Credit amount', 'Notes'], ...byDate('credit', 'Credit Date').map(r => [r['Credit ID'], r['Order ID'], customerName(r['Order ID']), r['Platform'], r['Credit Date'], r['Expected Amount'], r['Status'], r['Credit Amount'], r['Notes']])], [14, 24, 20, 14, 12, 14, 11, 14, 28]],
      ['Credits Platform-wise', [['Credit ID', 'Platform', 'Credit date', 'Credit amount', 'Reference', 'Notes'], ...byDate('pcredit', 'Credit Date').map(r => [r['Credit ID'], r['Platform'], r['Credit Date'], r['Credit Amount'], r['Reference'], r['Notes']])], [14, 16, 12, 14, 22, 28]],
      ['Debits', [['Debit ID', 'Date', 'Amount', 'Purpose', 'Notes'], ...byDate('debit', 'Debit Date').map(r => [r['Debit ID'], r['Debit Date'], r['Amount'], r['Purpose'], r['Notes']])], [14, 12, 14, 22, 28]],
      ['Balance', [['Platform', 'Expected', 'Order-wise credits', 'Platform credits', 'Total received', 'Balance to receive'], ...T.pl.map(x => [x.p, x.ex, x.ord, x.plat, x.rec, x.bal]), ['All platforms', T.ex, sum(T.pl, x => x.ord), sum(T.pl, x => x.plat), T.rec, T.pend], [], ['Total debits', T.deb], ['Available balance (credits - debits)', T.avail]], [34, 14, 18, 16, 14, 18]]];
  }
  async function accSummary() { await loadAll(); return {T: totals(), rows: A.rows}; }
  Object.assign(window, {accLoad, accEntrySave, lookCreditsRender, accSheets, accSummary});
})();
