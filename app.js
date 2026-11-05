/* ============ CONFIG ============ */
const DEFAULT_URL = 'https://script.google.com/macros/s/AKfycbx4NzdgZp2v3a6ASZ7QJhkc0-SkxWUhHcejxbOXPPRrLkS_rlEEe6HK5BaDOqhP8b8gWA/exec';
const EXPECTED_VERSION = 'secure-neon-2026-11-04';   // the Code.gs version this page was built for
try { if (localStorage.getItem('shyn_url_ver') !== '4') { localStorage.removeItem('shyn_url'); localStorage.removeItem('shyn_inv_url'); localStorage.setItem('shyn_url_ver', '4'); } } catch (e) {}   // one-time: forget old saved script URLs so the URL in this file is used
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const getUrl = () => (lsGet('shyn_url') || DEFAULT_URL).trim();
/* Orders and inventory run in ONE script (tab "Inventory"), so both always use the same URL unless you paste another one with Cloud Config. */
const INV_SCRIPT_URL = DEFAULT_URL;
const getInvUrl = () => (lsGet('shyn_inv_url') || INV_SCRIPT_URL).trim();

const $ = id => document.getElementById(id);
const openM = id => $(id).classList.add('show'), closeM = id => $(id).classList.remove('show');
const money = n => 'Rs ' + (Number(n) || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const num = v => parseFloat(v) || 0;
let orders = [], found = null, charts = [], pendingFile = null, toastT;
function toast(msg, bad) { const t = $('toast'); t.textContent = msg; t.style.borderColor = bad ? '#ff6b81' : 'var(--em)'; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3500); }

/* ============ SECURITY HELPERS ============ */
/* Everything typed into the sign-in forms is cleaned first: no control characters, and for the username / e-mail no < > " ' ` & or spaces,
   so nothing that looks like markup can ever travel or be shown. The messages on this screen are always written with textContent. */
const cleanUser = v => String(v == null ? '' : v).replace(/[\u0000-\u001f<>"'`&\s]/g, '').toLowerCase().slice(0, 64);
const cleanEmail = v => String(v == null ? '' : v).replace(/[\u0000-\u001f<>"'`\s]/g, '').toLowerCase().slice(0, 254);
const cleanPw = v => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 128);   // a password is never displayed; it is hashed, so only control characters are dropped
const SHA_K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
function sha256(str) {   // same result as Apps Script Utilities.computeDigest(SHA_256, string) (UTF-8)
  const msg = new TextEncoder().encode(String(str)), l = msg.length, n = ((l + 9 + 63) >> 6) << 6, buf = new Uint8Array(n); buf.set(msg); buf[l] = 0x80;
  const dv = new DataView(buf.buffer); dv.setUint32(n - 8, Math.floor(l * 8 / 0x100000000)); dv.setUint32(n - 4, (l * 8) >>> 0);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19; const w = new Uint32Array(64);
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const x = w[i - 15], y = w[i - 2]; w[i] = (w[i - 16] + (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + w[i - 7] + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10))) | 0; }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) | 0;
      const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
const PW_ROUNDS = 400;   // must equal PW_ROUNDS in Code.gs
function pwHash(pw, salt) { let h = salt + '|' + pw; for (let i = 0; i < PW_ROUNDS; i++) h = sha256(h + '|' + salt); return h; }
function randHex(bytes) { const a = new Uint8Array(bytes); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); }
function deviceId() { let d = lsGet('shyn_dev'); if (!/^[a-f0-9]{32}$/.test(d || '')) { d = randHex(16); try { localStorage.setItem('shyn_dev', d); } catch (e) {} } return d; }
const sget = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const sset = (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} };
const SES_TOK = 'shyn_tok', SES_LAST = 'shyn_last', SES_ACT = 'shyn_act', SES_MSG = 'shyn_msg', LOCK_KEY = 'shyn_lock';
const authTok = () => sget(SES_TOK) || '';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtStamp(ms) { const d = new Date(ms), p = n => String(n).padStart(2, '0'); let h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${p(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}, ${p(h)}:${p(d.getMinutes())} ${ap}`; }
function lastLoginText() { let o = null; try { o = JSON.parse(sget(SES_LAST) || 'null'); } catch (e) {} if (!o || !o.at) return ''; return o.first ? 'Last Login: first sign-in' : 'Last Login: ' + fmtStamp(o.at); }
const fmtMS = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

/* ============ NETWORK ============ */
async function rawPost(url, body) {
  const ctl = 'AbortController' in window ? new AbortController() : null, to = ctl && setTimeout(() => ctl.abort(), 60000); let res;
  try { res = await fetch(url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined}); }
  catch (e) { throw new Error('Cannot reach the server. Check internet and the Web App URL.'); }
  finally { if (to) clearTimeout(to); }
  const txt = await res.text();
  try { return JSON.parse(txt); } catch (e) { throw new Error('Server sent a web page, not data. Use the /exec URL, set access to "Anyone", and deploy a New version.'); }
}
const PUBLIC_ACTS = new Set(['ping', 'loginChallenge', 'login', 'resetOtpSend', 'resetPassword']);
/* Every request carries the session token ("auth") and, when verified, the Gmail access token. The password is never part of any request. */
async function api(method, p) {
  const url = getUrl(); if (!url) return localApi(method, p);
  const body = {...p, deviceId: deviceId()};
  if (!PUBLIC_ACTS.has(p.action)) { const t = authTok(); if (t) body.auth = t; if (accToken()) body.token = accToken(); }
  const j = await rawPost(url, body);
  if (j && j.authExpired && !PUBLIC_ACTS.has(p.action)) { doLogout('Your session expired. Please sign in again.'); throw Object.assign(new Error('Session expired. Please sign in again.'), {authExpired: true}); }
  return j;
}

/* ============ SIGN-IN ============ */
let loginBusy = false, lockTimer = null, lastAct = Date.now(), idleT = null, beatT = null;
const lmsg = (t, bad) => { $('lerr').style.color = bad ? '#ff6b81' : 'var(--mut)'; $('lerr').textContent = t || ''; };
function togglePw() { const i = $('lp'); i.type = i.type === 'password' ? 'text' : 'password'; }
const lockLeftSec = () => Math.max(0, Math.ceil((Number(lsGet(LOCK_KEY) || 0) - Date.now()) / 1000));
function startLock(sec) { try { localStorage.setItem(LOCK_KEY, String(Date.now() + sec * 1000)); } catch (e) {} tickLock(); }
function tickLock() {   // mirrors the server lock (5 minutes after 5 wrong passwords in a row); the server enforces it either way
  clearInterval(lockTimer);
  const f = () => {
    const s = lockLeftSec(), box = $('lockBox'), btn = $('loginBtn');
    if (s > 0) { box.classList.add('on'); box.textContent = 'Too many failed attempts. Sign-in is locked. Try again in ' + fmtMS(s) + '.'; btn.disabled = true; $('lerr').textContent = ''; }
    else { box.classList.remove('on'); box.textContent = ''; btn.disabled = loginBusy; clearInterval(lockTimer); try { localStorage.removeItem(LOCK_KEY); } catch (e) {} }
  };
  f(); if (lockLeftSec() > 0) lockTimer = setInterval(f, 1000);
}
function loginFail(r) {
  if (r.locked) { startLock(r.retryAfterSec || 300); return; }
  lmsg(r.error || 'Username or password is incorrect.', true);
}
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault(); if (loginBusy || lockLeftSec() > 0) return;
  const user = cleanUser($('lu').value), pw = cleanPw($('lp').value); $('lu').value = user;
  if (!user || !pw) return lmsg('Enter your username and password.', true);
  loginBusy = true; $('loginBtn').disabled = true; lmsg('Checking...');
  try {
    if (!getUrl()) throw new Error('Sign-in needs the live Google Sheet connection (Apps Script URL).');
    const ch = await rawPost(getUrl(), {action: 'loginChallenge', deviceId: deviceId()});   // 1) one-time challenge
    if (!ch.success) return loginFail(ch);
    const proof = sha256(pwHash(pw, ch.salt) + '|' + ch.nonce);                              // 2) the password itself stays in this browser
    const r = await rawPost(getUrl(), {action: 'login', username: user, nonce: ch.nonce, proof, deviceId: deviceId()});
    if (!r.success) return loginFail(r);
    sset(SES_TOK, r.token); sset(SES_LAST, JSON.stringify({at: r.lastLoginAt || Date.now(), first: !!r.firstLogin})); sset(SES_ACT, String(Date.now())); sset('shyn_mail', r.maskedEmail || '');
    lastAct = Date.now(); lmsg(''); try { localStorage.removeItem(LOCK_KEY); } catch (x) {} enter();
  } catch (err) { lmsg(err.message, true); }
  finally { $('lp').value = ''; loginBusy = false; if (lockLeftSec() <= 0) $('loginBtn').disabled = false; }
});
function enter() { $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden'); window.scrollTo(0, 0); startIdle(); loadOrders(); greet(); setTimeout(() => invLoad(true), 0); }
function doLogout(msg) {   // ends the session on the server, wipes this tab's session data and reloads to the sign-in screen
  try { stopVoiceCall(); } catch (e) {}
  const t = authTok(); stopIdle();
  if (t && getUrl()) { try { fetch(getUrl(), {method: 'POST', keepalive: true, headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({action: 'logout', auth: t})}).catch(() => {}); } catch (e) {} }
  [SES_TOK, SES_LAST, SES_ACT, 'shyn_mail', 'shyn_acc', 'shyn_acc_exp', 'shyn_low_dismiss', 'shyn_in'].forEach(k => sset(k, null));
  if (msg) sset(SES_MSG, msg); sset('shyn_skip', '1'); location.reload();
}
function logout() { doLogout(''); }

/* ---- inactivity: signed out after 30 minutes without touching the page ---- */
const IDLE_MS = 30 * 60 * 1000, BEAT_MS = 4 * 60 * 1000;
function markAct() { const n = Date.now(); if (n - lastAct > 1000) { lastAct = n; sset(SES_ACT, String(n)); } }
function idleCheck() { if (authTok() && Date.now() - lastAct >= IDLE_MS) doLogout('You were signed out after 30 minutes of inactivity.'); }
async function beat() { if (!authTok() || Date.now() - lastAct > 6 * 60 * 1000) return; try { await api('POST', {action: 'keepAlive'}); } catch (e) {} }   // keeps the server session alive only while you are active
function startIdle() { stopIdle(); idleT = setInterval(idleCheck, 15000); beatT = setInterval(beat, BEAT_MS); }
function stopIdle() { clearInterval(idleT); clearInterval(beatT); }
['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(ev => addEventListener(ev, markAct, {passive: true, capture: true}));
document.addEventListener('visibilitychange', () => { if (!document.hidden) idleCheck(); });
/* a refreshed tab resumes only when the server still accepts the session token */
async function resumeSession() {
  const m = sget(SES_MSG); if (m) { sset(SES_MSG, null); lmsg(m, true); }
  tickLock();
  if (!authTok()) return;
  try {
    lastAct = Number(sget(SES_ACT)) || Date.now();
    if (Date.now() - lastAct >= IDLE_MS) return doLogout('You were signed out after 30 minutes of inactivity.');
    const r = await api('POST', {action: 'getOrders'});
    if (r && r.success) { orders = (r.orders || []).map(o => ({...o})); enter(); }
  } catch (e) { if (!e.authExpired) lmsg(e.message, true); }
  finally { document.documentElement.classList.remove('resuming'); }
}

/* ============ PASSWORD RESET (OTP) ============ */
let otpTick = null, otpEnd = 0, resendAt = 0;
function openForgot() { showStep(1); fmsg(''); ['fgNew', 'fgConf', 'otpIn'].forEach(i => $(i).value = ''); openM('forgotModal'); }
function closeForgot() { clearInterval(otpTick); ['fgNew', 'fgConf', 'otpIn'].forEach(i => $(i).value = ''); closeM('forgotModal'); }
function showStep(n) { [1, 2, 3].forEach(i => $('fs' + i).classList.toggle('hidden', i !== n)); }
function fmsg(t, bad) { $('fmsg').textContent = t; $('fmsg').style.color = bad ? '#ff6b81' : 'var(--em)'; }
/* Step 1: {action:'resetOtpSend', email, deviceId} -> always the same answer, so the admin address cannot be guessed. Max 10 codes per hour, 2 minutes between codes. */
async function sendOtp() {
  const email = cleanEmail($('fgEmail').value); $('fgEmail').value = email;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fmsg('Enter a valid email address.', true);
  const b = $('sendBtn'); b.disabled = true; $('resBtn').disabled = true; fmsg('Sending OTP...');
  try {
    const r = await api('POST', {action: 'resetOtpSend', email});
    if (!r.success) { if (r.retryAfterSec) resendAt = Date.now() + r.retryAfterSec * 1000; throw new Error(r.error || 'Could not send OTP'); }
    otpEnd = Date.now() + (r.expiresIn || 300) * 1000; resendAt = Date.now() + (r.cooldownSec || 120) * 1000;
    $('otpSent').textContent = r.message || 'OTP sent.'; $('otpIn').value = ''; $('verBtn').disabled = false; showStep(2); fmsg(''); $('otpIn').focus(); startTick();
  } catch (e) { fmsg(e.message, true); if (!$('fs2').classList.contains('hidden')) startTick(); }
  b.disabled = false;
}
let resetBusy = false, expShown = false;
function startTick() {
  clearInterval(otpTick); expShown = false;
  const f = () => {
    const left = Math.max(0, Math.round((otpEnd - Date.now()) / 1000)), w = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)), expired = left <= 0;
    $('otpTime').textContent = fmtMS(left);
    $('verBtn').disabled = expired || resetBusy; $('resBtn').disabled = w > 0; $('resBtn').textContent = w > 0 ? `Resend OTP (${fmtMS(w)})` : 'Resend OTP';
    if (expired && !expShown) { expShown = true; fmsg('OTP expired. Tap Resend OTP.', true); }
    if (expired && w <= 0) clearInterval(otpTick);
  };
  f(); otpTick = setInterval(f, 1000);
}
function otpInput() { const i = $('otpIn'); i.value = i.value.replace(/\D/g, '').slice(0, 6); }
/* Step 2: {action:'resetPassword', email, otp, newSalt, newVerifier}. The browser sends only the salted verifier of the new password, never the password. */
async function resetPw() {
  if ($('verBtn').disabled) return;
  const otp = $('otpIn').value, np = cleanPw($('fgNew').value), cp = cleanPw($('fgConf').value), email = cleanEmail($('fgEmail').value);
  if (otp.length !== 6) return fmsg('Enter the 6-digit OTP.', true);
  if (np.length < 8) return fmsg('The new password must be at least 8 characters.', true);
  if (!/[A-Za-z]/.test(np) || !/\d/.test(np)) return fmsg('Use at least one letter and one number.', true);
  if (np !== cp) return fmsg('The two passwords do not match.', true);
  resetBusy = true; $('verBtn').disabled = true; fmsg('Updating password...');
  try {
    const newSalt = randHex(16), newVerifier = pwHash(np, newSalt);
    const r = await api('POST', {action: 'resetPassword', email, otp, newSalt, newVerifier});
    if (!r.success) throw new Error(r.error || 'Could not reset the password');
    clearInterval(otpTick); ['fgNew', 'fgConf', 'otpIn'].forEach(i => $(i).value = '');
    $('fDone').textContent = r.message || 'Password updated successfully. Please log in with your new password.'; showStep(3); fmsg('');
    try { localStorage.removeItem(LOCK_KEY); } catch (e) {} tickLock();
  } catch (e) { fmsg(e.message, true); }
  finally { resetBusy = false; if (otpEnd > Date.now()) $('verBtn').disabled = false; }
}
/* ============ PWA: service worker + install button ============ */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('installBtn').classList.remove('hidden'); });
window.addEventListener('appinstalled', () => { installEvt = null; $('installBtn').classList.add('hidden'); toast('SHYNWELL app installed'); });
async function installApp() { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('installBtn').classList.add('hidden'); }
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

/* ============ DATA LAYER ============ */
function openConn() { $('urlIn').value = getUrl(); $('connMsg').textContent = ''; $('diagOut').classList.add('hidden'); openM('connModal'); }
async function saveUrl() {
  const u = $('urlIn').value.trim(), prev = getUrl();
  if (u && !/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) { $('connMsg').textContent = 'The URL must start with https://script.google.com/ and end with /exec'; $('connMsg').style.color = '#ff6b81'; return; }
  try { localStorage.setItem('shyn_url', u); } catch (e) {}
  if (!u) { $('connMsg').textContent = 'Demo mode on. Orders are stored in this browser only.'; loadOrders(); return; }
  $('connMsg').textContent = 'Testing...'; $('connMsg').style.color = 'var(--mut)';
  try {
    const r = await api('POST', {action: 'ping'});
    $('connMsg').textContent = 'Connected' + (r.version ? '. Script version: ' + r.version + (r.version === EXPECTED_VERSION ? ' (matches this page).' : ' (this page expects ' + EXPECTED_VERSION + ').') : '.'); $('connMsg').style.color = 'var(--em)';
    if (u !== prev) { toast('Script changed. Please sign in again.'); setTimeout(() => doLogout('The Google Sheet script was changed. Sign in again.'), 900); } else loadOrders();
  } catch (e) { $('connMsg').textContent = e.message; $('connMsg').style.color = '#ff6b81'; }
}
function resetUrl() { const prev = getUrl(); try { localStorage.removeItem('shyn_url'); } catch (e) {} $('urlIn').value = getUrl(); $('connMsg').textContent = 'Default URL restored.'; $('connMsg').style.color = 'var(--em)'; if (getUrl() !== prev) setTimeout(() => doLogout('The Google Sheet script was changed. Sign in again.'), 900); }

async function runDiag() {
  const out = $('diagOut'); out.classList.remove('hidden'); out.textContent = 'Running checks...\n';
  const log = (ok, msg) => { out.textContent += (ok ? 'PASS  ' : 'FAIL  ') + msg + '\n'; };
  const url = getUrl();
  out.textContent += 'Web App URL in use:\n' + url + '\n\n';
  try {
    const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'action=ping'), t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) {}
    log(j && j.success, j && j.success ? '1. Apps Script ping (version ' + (j.version || 'old - no version') + (j.version === EXPECTED_VERSION ? ', matches this page)' : ', this page expects ' + EXPECTED_VERSION + ')') : '1. Apps Script answered with a web page, not data (HTTP ' + r.status + '): ' + t.slice(0, 70).replace(/\s+/g, ' ') + ' -> set access to "Anyone" and deploy a New version');
  } catch (e) { log(false, '1. Apps Script is blocked from this site. Cause: access is not "Anyone", wrong/old URL, test (/dev) URL, or a network/ad blocker.'); }
  try { const r = await api('POST', {action: 'getOrders'}); log(r.success, '2. Sheet read (getOrders)' + (r.success ? ' - ' + (r.orders || []).length + ' orders' : ': ' + r.error)); }
  catch (e) { log(false, '2. Sheet read: ' + e.message); }
  const chk = async (label, path, hint) => {
    try { const r = await fetch(SUPA.url + path, {headers: supaHeaders()}); log(r.ok, label + ' (HTTP ' + r.status + ')' + (r.ok ? '' : ' ' + await supaErr(r) + ' -> ' + hint)); }
    catch (e) { log(false, label + ': Supabase unreachable'); }
  };
  await chk('3. Supabase table read', '/rest/v1/' + SUPA.table + '?select=id&limit=1', 'run supabase.sql (table + policies)');
  await chk('4. Column shipping_date', '/rest/v1/' + SUPA.table + '?select=shipping_date&limit=1', 'run supabase.sql (adds the column)');
  await chk('6. Inventory tables (inventory.sql)', '/rest/v1/inventory?select=serial_no&limit=1', 'run inventory.sql');
  await chk('8. Sync tables (sync.sql)', '/rest/v1/sync_log?select=id&limit=1', 'run sync.sql');
  try { const r = await fetch(SUPA.url + '/storage/v1/object/public/' + SUPA.bucket + '/_probe'), t = await r.text();
    log(!/bucket not found/i.test(t), '5. Storage bucket "' + SUPA.bucket + '" is public' + (/bucket not found/i.test(t) ? ' -> create it as PUBLIC (supabase.sql does this)' : '')); }
  catch (e) { log(false, '5. Storage unreachable'); }
  if (getInvUrl()) { try { const r = await invApi('ping'); log(r.success, '7. Inventory sheet script'); } catch (e) { log(false, '7. Inventory sheet script: ' + e.message); } }
  out.textContent += '\nAll PASS = ready. Send me any FAIL line.';
}
function localApi(method, p) {
  const db = JSON.parse(localStorage.getItem('shyn_orders') || '[]');
  const idx = id => db.map(x => String(x['Order ID']).toLowerCase()).lastIndexOf(String(id).toLowerCase());
  if (p.action === 'getOrders') return {success: true, orders: db};
  if (p.action === 'ping') return {success: true};
  if (p.action === 'searchOrder') { const i = idx(p.orderId); return i < 0 ? {success: false, error: 'Order not found'} : {success: true, order: db[i]}; }
  if (p.action === 'addOrder') {
    const profit = rowProfit(p.orderStatus, p.lossAmount, p.creditedPrice, p.salePrice, p.originalPrice);
    db.push({'Timestamp': new Date().toISOString().slice(0, 19).replace('T', ' '), 'Order ID': p.orderId, 'Platform': p.platform, 'Customer Name': p.customerName, 'State': p.state,
      'Full Address': p.address, 'Invoice Date': p.invoiceDate, 'Shipping Date': p.shippingDate, 'SKU ID': p.skuId, 'Payment Type': p.paymentType, 'Customer Price': num(p.customerPrice), 'CGST': num(p.cgst),
      'SGST': num(p.sgst), 'IGST': num(p.igst), 'Original Price': num(p.originalPrice), 'Sale Price': num(p.salePrice), 'Credited Price': num(p.creditedPrice), 'Net Profit': profit, 'Notes': p.notes});
    localStorage.setItem('shyn_orders', JSON.stringify(db)); return {success: true};
  }
  if (p.action === 'updateOrder') {
    const i = idx(p.orderId); if (i < 0) return {success: false, error: 'Order not found'};
    Object.assign(db[i], {'Original Price': num(p.originalPrice), 'Sale Price': num(p.salePrice), 'Credited Price': num(p.creditedPrice)});
    if (p.newOrderId !== undefined) Object.assign(db[i], {'Order ID': p.newOrderId, 'Customer Name': p.customerName, 'State': p.state, 'Full Address': p.address, 'Invoice Date': p.invoiceDate, 'Shipping Date': p.shippingDate,
      'SKU ID': p.skuId, 'Customer Price': num(p.customerPrice), 'CGST': num(p.cgst), 'SGST': num(p.sgst), 'IGST': num(p.igst), 'Notes': p.notes,
      'Order Status': p.orderStatus || '', 'Cancel Reason': p.cancelReason || '', 'Loss Amount': num(p.lossAmount), 'Platform': p.platform || db[i]['Platform'], 'Payment Type': p.paymentType || db[i]['Payment Type']});
    db[i]['Net Profit'] = profitOf(db[i]);
    localStorage.setItem('shyn_orders', JSON.stringify(db)); return {success: true};
  }
  if (['login', 'loginChallenge', 'resetOtpSend', 'resetPassword'].includes(p.action)) return {success: false, error: 'Sign-in and password reset need the live Google Sheet connection (Apps Script URL).'};
  return {success: false, error: 'Unknown action'};
}
async function loadOrders() {
  try { const r = await api('POST', {action: 'getOrders'}); orders = (r.orders || []).map(o => ({...o})); }
  catch (e) { toast(e.message, true); }
  $('orderCount').textContent = orders.length;
}

/* ============ ORDER FORM ============ */
function otherBox() { $('platformOther').classList.toggle('hidden', $('platform').value !== 'Others'); }
function liveA() { $('liveA').textContent = money($('salePrice').value - $('originalPrice').value); }
/* ---- Supabase (Storage + Database) ---- */
const SUPA = {
  url: 'https://gcjframqlnfijwjjyltc.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjamZyYW1xbG5maWp3amp5bHRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2MjIxODYsImV4cCI6MjEwNzE5ODE4Nn0.Jd4rKlXb2zj04ON2oWFqCeCWC4mFmSsGxgln4DlfZFI',
  bucket: 'invoices', table: 'invoices'
};
const supaHeaders = extra => ({apikey: SUPA.key, Authorization: 'Bearer ' + SUPA.key, ...extra});
const safeName = n => (n || 'file').replace(/[^\w.\-]+/g, '_');
async function supaErr(res) { try { const j = await res.json(); return j.message || j.error || res.statusText; } catch (e) { return res.statusText; } }
async function supaUpload(path, file) {
  const res = await fetch(`${SUPA.url}/storage/v1/object/${SUPA.bucket}/${path}`, {
    method: 'POST', headers: supaHeaders({'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false'}), body: file});
  if (!res.ok) throw new Error('Upload failed (' + path.split('/')[0] + '): ' + await supaErr(res));
  return `${SUPA.url}/storage/v1/object/public/${SUPA.bucket}/${path}`;
}
const DUP_MSG = 'This Order ID already exists!';
const dupErr = where => Object.assign(new Error(DUP_MSG + (where && where.length ? ' (found in ' + where.join(' & ') + ')' : '')), {dup: true});
async function supaInsert(row) {
  const res = await fetch(`${SUPA.url}/rest/v1/${SUPA.table}`, {
    method: 'POST', headers: supaHeaders({'Content-Type': 'application/json', Prefer: 'return=minimal'}), body: JSON.stringify(row)});
  if (!res.ok) {
    let j = {}; try { j = await res.json(); } catch (e) {}
    if (res.status === 409 || j.code === '23505') throw dupErr(['database']);   // unique index violation
    throw new Error('Database insert failed: ' + (j.message || res.statusText));
  }
}
/* Checks Supabase + Google Sheet; returns where the Order ID already exists (empty array = free to use) */
async function orderIdExists(id) {
  const where = [];
  try { if (await supaGetByOrder(id)) where.push('database'); } catch (e) {}
  try { const r = await api('POST', {action: 'searchOrder', orderId: id}); if (r && r.success) where.push('sheet'); } catch (e) {}
  return where;
}
function showDup(on) { $('orderIdMsg').textContent = on ? DUP_MSG : ''; $('orderId').style.borderColor = on ? '#ff6b81' : ''; }
$('orderId').addEventListener('input', () => showDup(false));
$('orderId').addEventListener('change', async () => { const id = $('orderId').value.trim(); if (id) showDup((await orderIdExists(id)).length > 0); });

/* ---- Attachment pickers + previews ---- */
const att = {inv: null, pack: null};
let synced = null, saving = false;   // synced = Supabase result kept so a Sheet retry never duplicates the DB row
const isPdfFile = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
function setAtt(kind, f) {
  if (!f) return; att[kind] = f; synced = null;
  const k = kind === 'inv' ? 'Inv' : 'Pack', img = $('att' + k + 'Img'), pdf = $('att' + k + 'Pdf'), pd = isPdfFile(f);
  $('att' + k + 'Box').classList.remove('hidden');
  $('att' + k + 'Name').textContent = f.name || 'Captured photo'; $('att' + k + 'Name').title = f.name || '';
  $('att' + k + 'Meta').textContent = (pd ? 'PDF' : 'Image') + ' - ' + fmtSize(f.size);
  img.classList.toggle('hidden', pd); pdf.classList.toggle('hidden', !pd); pdf.style.display = pd ? 'flex' : 'none';
  if (img.dataset.u) { URL.revokeObjectURL(img.dataset.u); img.dataset.u = ''; }
  if (!pd) { const u = URL.createObjectURL(f); img.src = u; img.dataset.u = u; }
}
function clearAtt(kind) {
  att[kind] = null; synced = null; const k = kind === 'inv' ? 'Inv' : 'Pack', img = $('att' + k + 'Img');
  $('att' + k + 'Box').classList.add('hidden'); $('att' + k + 'Pdf').style.display = 'none';
  if (img.dataset.u) { URL.revokeObjectURL(img.dataset.u); img.dataset.u = ''; } img.removeAttribute('src');
}
[['invFileIn', 'inv'], ['packGalIn', 'pack'], ['packCamIn', 'pack']].forEach(([id, kind]) =>
  $(id).addEventListener('change', e => { setAtt(kind, e.target.files[0]); e.target.value = ''; }));
function setBusy(on, label) {
  saving = on; $('saveBtn').disabled = on; $('saveTxt').textContent = on ? label : 'Save order';
  $('saveIco').className = on ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-cloud-arrow-up';
}

/* ---- Image compression: canvas -> JPEG under maxSizeKB. PDFs / non-images are returned untouched. ---- */
const MAX_PDF_MB = 5;   // PDFs cannot be canvas-compressed, so larger ones are rejected before upload
async function compressImage(file, maxSizeKB = 50) {
  if (!file || !String(file.type).startsWith('image/')) return file;
  const maxBytes = maxSizeKB * 1024;
  if (file.size <= maxBytes && file.type === 'image/jpeg') return file;           // already small enough
  let src;
  try { src = await createImageBitmap(file, {imageOrientation: 'from-image'}); }   // keeps phone-camera rotation correct
  catch (e) {
    src = await new Promise((ok, no) => { const im = new Image(), u = URL.createObjectURL(file);
      im.onload = () => { URL.revokeObjectURL(u); ok(im); }; im.onerror = () => { URL.revokeObjectURL(u); no(new Error('Could not read the image')); }; im.src = u; });
  }
  const toBlob = (c, q) => new Promise(res => c.toBlob(res, 'image/jpeg', q));
  let best = null, c = null;
  for (const maxSide of [1600, 1280, 1024, 800, 640, 480]) {                       // shrink the picture until a quality fits
    const k = Math.min(1, maxSide / Math.max(src.width, src.height));
    c = document.createElement('canvas'); c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(src, 0, 0, c.width, c.height);
    let lo = 0.3, hi = 0.85, fit = null;
    for (let i = 0; i < 6; i++) { const q = (lo + hi) / 2, b = await toBlob(c, q); if (!b) break; if (b.size <= maxBytes) { fit = b; lo = q; } else hi = q; }
    if (fit) { best = fit; break; }
  }
  if (!best) best = await toBlob(c, 0.3);                                          // smallest possible if nothing fit
  if (src.close) src.close();
  if (!best) return file;                                                          // canvas not supported: upload the original
  return new File([best], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', {type: 'image/jpeg', lastModified: Date.now()});
}

/* ---- Submit: validate -> Storage -> DB insert -> Google Sheet mirror ---- */
$('orderForm').addEventListener('submit', async e => {
  e.preventDefault(); if (saving) return;
  if (!att.inv || !att.pack) return toast('Please add both the invoice file and the packing photo', true);
  const secs = secSkus();
  const plat = $('platform').value === 'Others' ? ($('platformOther').value.trim() || 'Others') : $('platform').value;
  const p = {action: 'addOrder', platform: plat, orderId: $('orderId').value.trim(), customerName: $('customerName').value.trim(), state: $('state').value.trim(),
    address: $('address').value.trim(), invoiceDate: $('invoiceDate').value, shippingDate: $('shippingDate').value, skuId: $('skuId').value.trim(), paymentType: document.querySelector('[name=pay]:checked').value,
    customerPrice: $('customerPrice').value, cgst: $('cgst').value, sgst: $('sgst').value, igst: $('igst').value,
    originalPrice: $('originalPrice').value, salePrice: $('salePrice').value, creditedPrice: 0, notes: $('notes').value.trim(), secondarySkus: secs.join(', ')};
  try {
    let urls = synced && synced.orderId === p.orderId ? synced : null;
    if (!urls) {
      setBusy(true, 'Checking Order ID...');
      const where = await orderIdExists(p.orderId); if (where.length) throw dupErr(where);
      setBusy(true, 'Checking stock...');
      await invValidateSale(secs);
      setBusy(true, 'Compressing images...');
      for (const f of [att.inv, att.pack]) if (isPdfFile(f) && f.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`"${f.name}" is ${fmtSize(f.size)} - PDFs must be under ${MAX_PDF_MB} MB`);
      const [invFile, packFile] = await Promise.all([compressImage(att.inv, 50), compressImage(att.pack, 50)]);   // PDFs pass through unchanged
      setBusy(true, 'Uploading files...');
      const t = Date.now();
      const [invoice_url, packing_image_url] = await Promise.all([
        supaUpload(`bills/${t}_${safeName(invFile.name)}`, invFile),
        supaUpload(`packing/${t}_${safeName(packFile.name)}`, packFile)]);
      setBusy(true, 'Saving to database...');
      try {   // invoice row + stock deduction happen together in ONE database transaction
        await rpc('create_invoice_with_stock', {p_order_id: p.orderId, p_amount: num(p.customerPrice) || num(p.salePrice), p_tax: num(p.cgst) + num(p.sgst) + num(p.igst),
          p_shipping_date: p.shippingDate || null, p_invoice_url: invoice_url, p_packing_url: packing_image_url,
          p_primary_sku: p.skuId || null, p_secondary_skus: secs});   // primary SKU is stored for reference only; only secondary SKUs reduce stock
      } catch (e) {
        if (e.notSetUp && !secs.length) {   // inventory.sql not installed yet and no secondary SKUs: behave exactly like before
          await supaInsert({order_id: p.orderId, amount: num(p.customerPrice) || num(p.salePrice), tax: num(p.cgst) + num(p.sgst) + num(p.igst), shipping_date: p.shippingDate || null, invoice_url, packing_image_url});
        } else { try { await storageRemove([storagePathFromUrl(invoice_url), storagePathFromUrl(packing_image_url)]); } catch (x) {} throw e; }   // do not leave orphan files
      }
      urls = synced = {orderId: p.orderId, invoice_url, packing_image_url};
    }
    setBusy(true, 'Syncing to Google Sheet...');
    p.invoiceUrl = urls.invoice_url; p.packingImageUrl = urls.packing_image_url;
    const r = await api('POST', p); if (!r.success) throw new Error(r.error || 'Save failed');
    synced = null; toast('Order saved - files uploaded & synced');
    e.target.reset(); resetSecSkus(); invLoad(true).then(() => invMirrorSoon()); showDup(false); otherBox(); liveA(); clearPrev(); clearAtt('inv'); clearAtt('pack'); loadOrders();
  } catch (err) {
    if (err.dup) { showDup(true); $('orderId').focus(); return toast(err.message, true); }
    toast(synced ? 'Saved to Supabase, but Google Sheet failed: ' + err.message + ' - tap Save again to retry the sheet' : 'Could not save: ' + err.message, true);
  } finally { setBusy(false); }
});

/* ============ CAMERA / FILE / OCR ============ */
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(2) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
function pick(f) {
  if (!f) return; pendingFile = f; if (!att.inv) setAtt('inv', f);   // the scanned invoice is attached as the invoice file too
  $('prev').classList.remove('hidden'); $('prevName').textContent = f.name || 'Captured photo'; $('prevSize').textContent = fmtSize(f.size) + ' - ' + (f.type || 'file');
  $('scanMsg').textContent = 'Tap Read to extract details. This file is also attached as the invoice file.';
  const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  $('prevImg').classList.toggle('hidden', isPdf); $('prevPdf').classList.toggle('hidden', !isPdf); $('prevPdf').style.display = isPdf ? 'flex' : 'none';
  if (!isPdf) { if ($('prevImg').dataset.u) URL.revokeObjectURL($('prevImg').dataset.u); const u = URL.createObjectURL(f); $('prevImg').src = u; $('prevImg').dataset.u = u; }
}
$('camIn').addEventListener('change', e => { pick(e.target.files[0]); e.target.value = ''; });
$('fileIn').addEventListener('change', e => { pick(e.target.files[0]); e.target.value = ''; });
function clearPrev() { pendingFile = null; $('prev').classList.add('hidden'); }
const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); });
function shrink(file, max = 1800) {
  return new Promise(res => {
    const img = new Image(); img.onload = () => {
      const k = Math.min(3, 2200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = img.width * k; c.height = img.height * k; const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.filter = 'grayscale(1) contrast(1.25)'; cx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => res(b || file), 'image/jpeg', .9);
    }; img.onerror = () => res(file); img.src = URL.createObjectURL(file);
  });
}
async function parseFile() {
  if (!pendingFile) return; const f = pendingFile, msg = $('scanMsg'); msg.textContent = 'Reading invoice... this can take a few seconds.';
  try {
    let text = '';
    if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({data: await f.arrayBuffer()}).promise;
      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) { let ly = null; (await (await pdf.getPage(i)).getTextContent()).items.forEach(it => { const y = Math.round(it.transform[5]); text += (ly !== null && Math.abs(y - ly) > 3 ? '\n' : ' ') + it.str; ly = y; }); text += '\n'; }
    } else {
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
      text = (await Tesseract.recognize(await shrink(f), 'eng')).data.text;
    }
    $('ocrRaw').textContent = text.slice(0, 4000); const r = parseInvoice(text);
    msg.textContent = r.n ? `${r.layout ? r.layout + ' invoice detected. ' : ''}Filled ${r.n} field(s). Enter Original and Sale price manually, then verify.` : 'No details found. Please type them in.';
  } catch (e) { msg.textContent = 'Could not read this file. Please type the details in.'; }
}
const STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'].sort((a, b) => b.length - a.length);
const findState = s => STATES.find(x => new RegExp('\\b' + x.replace(/ /g, '\\s+') + '\\b', 'i').test(s || '')) || '';
function parseDateStr(s) {
  const p = x => String(x).padStart(2, '0'); let m = s.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${p(m[2])}-${p(m[1])}`;
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3})[a-z]*[\s,\-]+(\d{4})/);
  if (m) { const mi = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[2].toLowerCase()); if (mi >= 0) return `${m[3]}-${p(mi + 1)}-${p(m[1])}`; }
  return '';
}
function parseInvoice(raw) {
  const t = raw.replace(/\r/g, '').replace(/[ \t]+/g, ' '), one = t.replace(/\s+/g, ' ');
  let n = 0; const put = (id, v) => { if (v !== undefined && v !== null && String(v).trim() !== '') { $(id).value = String(v).trim(); n++; } };

  // ---- Layout detection (Meesho sheets often carry no "Meesho" word, so also use structure) ----
  const hasAmz = /\b\d{3}-\d{7}-\d{7}\b/.test(one), hasMee = /\b\d{12,20}_\d{1,2}\b/.test(one);
  const layout = /meesho|fashnear/i.test(one) ? 'Meesho' : (/amazon/i.test(one) || hasAmz) ? 'Amazon'
    : (hasMee || (/bill\s*to\s*\/\s*ship\s*to/i.test(one) && /purchase\s*order\s*no|if\s*undelivered/i.test(one))) ? 'Meesho'
    : /flipkart|\bOD\d{15,}/i.test(one) ? 'Flipkart' : '';
  if (layout) { $('platform').value = layout; otherBox(); n++; }

  // ---- Order ID ----
  let oid = '';
  if (layout === 'Amazon') oid = (one.match(/\b(\d{3}-\d{7}-\d{7})\b/) || [])[1];
  else if (layout === 'Meesho') oid = (one.match(/\b(\d{12,20}_\d{1,2})\b/) || one.match(/purchase\s*order\s*no\.?\s*[:#-]?\s*(\d{12,20})/i) || one.match(/sub\s*order\s*(?:no\.?|number|id)\s*[:#-]?\s*([A-Za-z0-9_-]{6,})/i) || [])[1];
  else if (layout === 'Flipkart') oid = (one.match(/\b(OD\d{15,})\b/) || [])[1];
  if (!oid) oid = (one.match(/\b(\d{3}-\d{7}-\d{7})\b/) || one.match(/order\s*(?:id|no\.?|number)\s*[:#-]?\s*([A-Za-z0-9_-]{6,})/i) || [])[1];
  put('orderId', oid);

  // ---- Invoice date. Meesho prints "Order Date  Invoice Date" as headers, then both values: take the 2nd ----
  const dts = x => [...x.matchAll(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/g)].map(m => parseDateStr(m[0])).filter(Boolean);
  const ii = one.search(/invoice\s*date/i); let ds = ii >= 0 ? dts(one.slice(ii + 12, ii + 100)) : [];
  if (/order\s*date\s*invoice\s*date/i.test(one) && ds.length > 1) ds = [ds[1]];
  const oi = one.search(/order\s*date/i);
  put('invoiceDate', ds[0] || (oi >= 0 ? dts(one.slice(oi, oi + 60))[0] : '') || dts(one)[0]);

  // ---- Customer name + delivery address (never the seller's "Sold by" / "return to" block) ----
  const blk = (re, len) => { const m = t.match(re); return m ? t.slice(m.index + m[0].length, m.index + m[0].length + len).replace(/^[\s:,\-]+/, '') : ''; };
  const CUT = /place\s*of\s*(?:supply|delivery)|sold\s*by|order\s*(?:no|number|id)|invoice\s*(?:no|number|date|details)|purchase\s*order|product\s*details|description|if\s*undelivered|gstin|pan\s*no|state\/ut\s*code|\bsku\b|\bawb\b|ship\s*date|delivery\s*station/i;
  let b = layout === 'Meesho' ? (blk(/bill\s*to\s*\/\s*ship\s*to\s*:?/i, 320) || blk(/customer\s*address\s*:?/i, 320))
    : (blk(/shipping\s*address\s*:?/i, 320) || blk(/ship\s*to\s*:?/i, 320) || blk(/billing\s*address\s*:?/i, 320) || blk(/bill\s*to\s*:?/i, 320));
  b = b.replace(/prepaid\s*:?\s*do\s*not\s*collect\s*cash/ig, ' ').split(CUT)[0].replace(/\s+IN\s*$/, '').trim();
  const dedupe = a => a.filter((w, k) => w && w.toLowerCase() !== (a[k - 1] || '').toLowerCase());
  const STOP = /^(?:h\.?\s?no\.?|hno|house|flat|door|plot|near|opp|street|road|apt|apartment|c\/o|d\.?no)$/i;
  const first = b.split('\n')[0].trim(); let name = '';
  if (b.includes('\n') && first.length > 2 && !/[\d,]/.test(first)) name = dedupe(first.replace(/[^A-Za-z .'\-]/g, '').split(/\s+/)).join(' ');
  else { const nm = []; for (const w of b.replace(/[\n,]/g, ' ').split(/\s+/).filter(Boolean)) { if (/\d/.test(w) || STOP.test(w) || /^[-\u2013]$/.test(w) || nm.length >= 4) break; nm.push(w.replace(/[^A-Za-z.'\-]/g, '')); } name = dedupe(nm).join(' '); }
  name = name.trim().slice(0, 40);
  if (name.length > 2) put('customerName', name);
  let addr = b.replace(/\s*\n\s*/g, ', ').replace(/\s+/g, ' ');
  if (name && addr.toLowerCase().startsWith(name.toLowerCase())) addr = addr.slice(name.length);
  put('address', addr.replace(/,\s*,/g, ',').replace(/\s+,/g, ',').replace(/^[\s,\-\u2013]+/, '').replace(/[\s,.]+$/, '').slice(0, 220));

  // ---- State: customer's address first, then Place of delivery/supply (never the seller's state) ----
  const pos = (one.match(/place\s*of\s*(?:delivery|supply)\s*:?\s*(.{0,40})/i) || [])[1];
  put('state', findState(b) || findState(pos));

  // ---- SKU + quantity ----
  const BAD = /^(size|color|colour|qty|quantity|description|order|hsn|price|free|total|id|no)$/i;
  let sku = '', qty = '';
  if (layout === 'Amazon') sku = (one.match(/\(\s*([A-Za-z0-9._\-]{3,30})\s*\)\s*HSN/i) || [])[1] || '';   // "B0XXXXXXXX ( SKU-CODE ) HSN:7117"
  const mh = one.match(/SKU\s+Size\s+Qty\s+Colou?r\s+Order\s*No\.?\s*([A-Za-z0-9._\-]{3,})\s+([A-Za-z0-9.\-]+(?:\s+Size)?)\s+(\d{1,3})\b/i);  // Meesho product row
  if (!sku && mh) { sku = mh[1]; qty = mh[3]; }
  if (!sku) { const m = one.match(/\bSKU\s*(?:ID|Code)?\s*[:\-]?\s*([A-Za-z0-9._\-]{3,})/i); if (m && !BAD.test(m[1])) sku = m[1]; }
  if (!sku) sku = (one.match(/\(\s*([A-Za-z0-9._\-]{3,30})\s*\)\s*HSN/i) || one.match(/\b([A-Z]{2,6}-[A-Z]{1,5}-\d{2,4}(?:-\d{1,4})*)\b/) || one.match(/\b(B0[A-Z0-9]{8})\b/) || [])[1] || '';
  put('skuId', sku);
  if (!qty && layout === 'Amazon') qty = (one.match(/[\d,]+\.\d{2}\s+(\d{1,3})\s+[^\d\s]{0,3}\s*[\d,]+\.\d{2}/) || [])[1] || '';   // unit price, qty, net amount
  if (!qty) qty = (one.match(/\bqty\.?\s*[:\-]?\s*(\d{1,3})\b/i) || [])[1] || '';

  // ---- Customer total price: last amount on the TOTAL row ("TOTAL: Rs6.67 Rs229.00", "Total Rs.4.37 Rs.150.00") ----
  const tm = [...one.matchAll(/(?:grand\s*total|invoice\s*value|total)\s*[:\-]?\s*((?:[^\d\s]{0,3}\s*[\d,]+\.\d{2}\s*){1,4})/gi)];
  if (tm.length) { const nums = tm[tm.length - 1][1].match(/[\d,]+\.\d{2}/g); put('customerPrice', nums[nums.length - 1].replace(/,/g, '')); }

  // ---- Tax breakdown: sum every line item so multi-row Meesho invoices add up ----
  ['cgst', 'sgst', 'igst'].forEach(k => {
    let tot = 0, hit = false;
    for (const m of one.matchAll(new RegExp(k + '[^\\d%]{0,14}(?:\\d+(?:\\.\\d+)?\\s*%)?[^\\d]{0,8}([\\d,]+\\.\\d{2})', 'gi'))) { tot += parseFloat(m[1].replace(/,/g, '')); hit = true; }
    if (hit) put(k, tot.toFixed(2));
  });

  // ---- Payment type ----
  if (/prepaid\s*:?\s*do\s*not\s*collect/i.test(one)) document.querySelector('[name=pay][value=Prepaid]').checked = true;
  else if (/cash\s*on\s*delivery|pay\s*on\s*delivery|\bcod\b/i.test(one)) document.querySelector('[name=pay][value=COD]').checked = true;
  else if (/prepaid|credit\s*card|debit\s*card|\bupi\b|net\s*banking|paid\s*online/i.test(one)) document.querySelector('[name=pay][value=Prepaid]').checked = true;

  // originalPrice and salePrice are intentionally NEVER filled: they must be typed manually.
  put('notes', `Scanned ${layout || ''} invoice - verify details.${qty ? ' Qty: ' + qty + '.' : ''}`.replace('  ', ' '));
  liveA(); return {n, layout};
}

/* ============ PROFIT RULE (same as Code.gs rowProfit_) ============ */
/* A cancelled / returned order (Order Status filled in) earns nothing and costs its Loss Amount; every other order earns (credited price, else sale price) minus original price. */
function rowProfit(status, loss, credited, sale, original) { if (String(status == null ? '' : status).trim() !== '') return -num(loss); return (num(credited) > 0 ? num(credited) : num(sale)) - num(original); }
const profitOf = o => rowProfit(o['Order Status'], o['Loss Amount'], o['Credited Price'], o['Sale Price'], o['Original Price']);
const isBadOrder = o => String(o['Order Status'] || '').trim() !== '';
function ensureOpt(id, v) { const s = $(id); v = String(v == null ? '' : v).trim(); if (!v) return; if (![...s.options].some(o => o.value === v)) { const o = document.createElement('option'); o.value = v; o.textContent = v; s.appendChild(o); } s.value = v; }
let lookStockSkus = 0;

/* ============ LOOKUP ============ */
const toDateInput = v => { v = String(v || '').trim(); let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
  m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
let supaRow = null;
async function supaGetByOrder(orderId) {
  const res = await fetch(`${SUPA.url}/rest/v1/${SUPA.table}?order_id=eq.${encodeURIComponent(orderId)}&select=*&order=created_at.desc&limit=1`, {headers: supaHeaders()});
  if (!res.ok) throw new Error(await supaErr(res)); return (await res.json())[0] || null;
}
async function supaUpdate(id, row) {
  const res = await fetch(`${SUPA.url}/rest/v1/${SUPA.table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: supaHeaders({'Content-Type': 'application/json', Prefer: 'return=representation'}), body: JSON.stringify(row)});
  if (!res.ok) throw new Error(await supaErr(res));
  if (!(await res.json()).length) throw new Error('no row updated (check the Supabase update policy)');
}
async function searchOrder() {
  const id = $('searchId').value.trim(); if (!id) return; $('lookMsg').textContent = 'Searching...';
  try {
    const r = await api('POST', {action: 'searchOrder', orderId: id});
    if (!r.success) { $('lookMsg').textContent = r.error || 'Order not found.'; $('lookBox').classList.add('hidden'); return; }
    found = r.order; $('lookMsg').textContent = '';
    { const e = invEsc, f = found;   // every value from the sheet is escaped before it is shown
      $('lookInfo').innerHTML = `<b style="color:var(--gd)">${e(f['Customer Name'])}</b> - ${e(f['Platform'])} (${e(f['Payment Type'])})<br>Order ${e(f['Order ID'])} | SKU ${e(f['SKU ID'])}${f['Secondary SKU IDs'] ? ' + ' + e(f['Secondary SKU IDs']) : ''}<br>${e(f['State'])} | Invoice ${e(f['Invoice Date'] || '-')} | Shipping ${e(f['Shipping Date'] || '-')}<br>Customer price ${money(f['Customer Price'])}<br>CGST ${e(f['CGST'])} | SGST ${e(f['SGST'])} | IGST ${e(f['IGST'])}${f['Order Status'] ? `<br><b style="color:#ff6b81">${e(f['Order Status'])}</b>${f['Cancel Reason'] ? ' - ' + e(f['Cancel Reason']) : ''}${Number(f['Loss Amount']) > 0 ? ' | Loss ' + money(f['Loss Amount']) : ''}` : ''}`; }
    const set = (i, v) => $(i).value = v ?? '';
    set('eOrderId', found['Order ID']); ensureOpt('ePlatform', found['Platform']); ensureOpt('ePay', found['Payment Type']); set('eCust', found['Customer Name']); set('eState', found['State']); set('eSku', found['SKU ID']); set('eAddr', found['Full Address']);
    set('eInvDate', toDateInput(found['Invoice Date'])); set('eShipDate', toDateInput(found['Shipping Date'])); set('ePrice', found['Customer Price']);
    set('eCgst', found['CGST']); set('eSgst', found['SGST']); set('eIgst', found['IGST']); set('eNotes', found['Notes']);
    $('uOrig').value = found['Original Price']; $('uSale').value = found['Sale Price']; $('uCred').value = found['Credited Price'] || '';
    rcFill(found); $('lookBox').classList.remove('hidden'); liveB(); loadSupaRow(found['Order ID']);
  } catch (e) { $('lookMsg').textContent = e.message; }
}
async function loadSupaRow(orderId) {
  supaRow = null; lookStockSkus = 0; const box = $('lookLinks'); box.classList.add('hidden'); box.innerHTML = ''; $('lookSkus').classList.add('hidden'); $('eSku').readOnly = false; $('eSku').title = '';
  try {
    supaRow = await supaGetByOrder(orderId); if (!supaRow) return;
    const link = (u, ic, t) => u && /^https:\/\//i.test(String(u)) ? `<a href="${invEsc(encodeURI(u))}" target="_blank" rel="noopener noreferrer" class="chip"><i class="fa-solid ${ic} mr-1"></i>${t}</a>` : '';
    box.innerHTML = link(supaRow.invoice_url, 'fa-file-invoice', 'View invoice') + link(supaRow.packing_image_url, 'fa-box-open', 'View packing file');
    box.classList.toggle('hidden', !box.innerHTML);
    try {
      const sk = await invFetchAll(`invoice_skus?invoice_id=eq.${encodeURIComponent(supaRow.id)}&select=*&order=is_primary.desc,id.asc`);
      lookStockSkus = sk.filter(x => !x.restored_at).length;
      if (sk.length) {
        $('lookSkus').textContent = 'Stock-reduced SKUs: ' + sk.map(x => x.sku_id + (x.restored_at ? ' [stock restored]' : '')).join(', ') + ' - they cannot be changed here. To change them, delete the order (stock is restored) and create it again.';
        $('lookSkus').classList.remove('hidden');
      }
    } catch (e) {}
  } catch (e) { /* lookup still works without the Supabase row */ }
}
function liveB() { const v = rowProfit($('rcStatus').value, $('rcLoss').value, $('uCred').value, $('uSale').value, $('uOrig').value); $('liveB').textContent = money(v); $('liveB').style.color = v < 0 ? '#ff6b81' : 'var(--em)'; }
async function updateOrder() {
  if (!found || saving) return;
  const v = i => $(i).value.trim(), oldId = found['Order ID'], newId = v('eOrderId');
  if (!newId) return toast('Order ID cannot be empty', true);
  let rc; try { rc = rcCollect(); } catch (e) { $('rcErr').textContent = e.message; $('rcBox').scrollIntoView({block: 'center', behavior: 'smooth'}); return toast(e.message, true); }
  if (newId.toLowerCase() !== String(oldId).toLowerCase()) { const w = await orderIdExists(newId); if (w.length) return toast(dupErr(w).message, true); }
  const p = {action: 'updateOrder', orderId: oldId, newOrderId: newId, platform: $('ePlatform').value, paymentType: $('ePay').value, customerName: v('eCust'), state: v('eState'), address: v('eAddr'), invoiceDate: $('eInvDate').value,
    shippingDate: $('eShipDate').value, skuId: v('eSku'), customerPrice: $('ePrice').value, cgst: $('eCgst').value, sgst: $('eSgst').value, igst: $('eIgst').value, notes: v('eNotes'),
    originalPrice: $('uOrig').value, salePrice: $('uSale').value, creditedPrice: $('uCred').value,
    orderStatus: rc.orderStatus, cancelReason: rc.cancelReason, lossAmount: rc.lossAmount};
  let restore = false;   // a cancelled / returned order that already took stock: ask before putting the stock back
  if (rc.orderStatus && !String(found['Order Status'] || '').trim() && lookStockSkus > 0)
    restore = confirm(`This order reduced the stock of ${lookStockSkus} SKU${lookStockSkus === 1 ? '' : 's'}.\n\nOK = put that stock back now (recommended when the parcel returns to you)\nCancel = keep the stock as it is`);
  saving = true; $('updBtn').disabled = true; $('updTxt').textContent = 'Saving...'; $('updIco').className = 'fa-solid fa-spinner fa-spin';
  try {
    const r = await api('POST', p); if (!r.success) throw new Error(r.error || 'Update failed');
    let warn = '', stockMsg = '';
    if (supaRow) {
      const base = {order_id: newId, amount: num(p.customerPrice) || num(p.salePrice), tax: num(p.cgst) + num(p.sgst) + num(p.igst), shipping_date: p.shippingDate || null};
      const rcCols = {order_status: rc.orderStatus || null, cancel_reason: rc.cancelReason || null, loss_amount: rc.lossAmount};
      const full = {...base, ...rcCols, platform: p.platform, payment_type: p.paymentType, customer_name: p.customerName, state: p.state, address: p.address, invoice_date: p.invoiceDate || null,
        primary_sku: p.skuId || null, customer_price: num(p.customerPrice), cgst: num(p.cgst), sgst: num(p.sgst), igst: num(p.igst), original_price: num(p.originalPrice), sale_price: num(p.salePrice),
        credited_price: num(p.creditedPrice), net_profit: rowProfit(rc.orderStatus, rc.lossAmount, p.creditedPrice, p.salePrice, p.originalPrice), notes: p.notes || null};
      const colErr = e => /column|schema cache/i.test(e.message);
      try { await supaUpdate(supaRow.id, full); }                                                     // every edited field is saved in Supabase too
      catch (e) {
        if (!colErr(e)) warn = ' - sheet updated, but Supabase failed: ' + e.message;
        else {
          try { await supaUpdate(supaRow.id, {...base, ...rcCols}); warn = ' - sheet updated; Supabase saved the status and loss only (run sync.sql for the other fields)'; }
          catch (e2) { if (!colErr(e2)) warn = ' - sheet updated, but Supabase failed: ' + e2.message; else { try { await supaUpdate(supaRow.id, base); warn = ' - sheet updated, but the status / loss were not saved in Supabase (run returns.sql)'; } catch (e3) { warn = ' - sheet updated, but Supabase failed: ' + e3.message; } } }
        }
      }
      if (restore) {
        try { const rs = await rpc('restore_invoice_stock', {p_order_id: newId}); stockMsg = rs && rs.restored ? ` - stock restored for ${rs.restored} SKU${rs.restored === 1 ? '' : 's'}` : ' - no stock needed restoring'; invLoad(true).then(() => invMirrorSoon()); }
        catch (e) { warn += ' - stock was NOT restored: ' + e.message; }
      }
    }
    toast('Order updated' + stockMsg + warn, !!warn); $('searchId').value = newId; loadOrders(); searchOrder();
  } catch (e) { toast(e.message, true); }
  finally { saving = false; $('updBtn').disabled = false; $('updTxt').textContent = 'Save / update changes'; $('updIco').className = 'fa-solid fa-floppy-disk'; }
}
/* ===== RETURN / CANCELLATION (Order Lookup) ===== */
const RC_STATUSES = ['Cancel', 'RTO', 'Customer Return'], RC_REASONS = ['Seller Issue', 'Pickup Associate Issue', 'Others'];
function rcToggle() {                            // show only the controls that apply to the chosen status
  const st = $('rcStatus').value;
  $('rcReasonBox').classList.toggle('hidden', st !== 'Cancel');
  $('rcOther').classList.toggle('hidden', !(st === 'Cancel' && $('rcReason').value === 'Others'));
  $('rcLossBox').classList.toggle('hidden', !st);
  $('rcErr').textContent = ''; liveB();
}
function rcFill(o) {                             // load the saved values of the opened order into the controls
  const st = String(o['Order Status'] || '').trim(), rs = String(o['Cancel Reason'] || '').trim();
  let reason = '', other = '';
  if (st === 'Cancel' && rs) {
    if (RC_REASONS.includes(rs)) reason = rs;
    else { reason = 'Others'; other = rs.replace(/^Others\s*-\s*/i, ''); }
  }
  $('rcStatus').value = RC_STATUSES.includes(st) ? st : ''; $('rcReason').value = reason; $('rcOther').value = other;
  const loss = parseFloat(o['Loss Amount']); $('rcLoss').value = loss > 0 ? loss : '';
  rcToggle();
}
function rcCollect() {                           // returns the three payload fields, or throws a readable validation error
  const st = $('rcStatus').value;
  if (!st) return {orderStatus: '', cancelReason: '', lossAmount: 0};      // normal order: everything cleared
  if (!RC_STATUSES.includes(st)) throw new Error('Choose a valid order status.');
  let reason = '';
  if (st === 'Cancel') {
    const r = $('rcReason').value;
    if (!RC_REASONS.includes(r)) throw new Error('Select a cancellation reason.');
    if (r === 'Others') {
      const t = $('rcOther').value.trim();
      if (!t) throw new Error('Please specify the cancellation reason.');
      if (t.length > 120) throw new Error('The reason is too long (maximum 120 characters).');
      reason = 'Others - ' + t;
    } else reason = r;
  }
  const raw = $('rcLoss').value.trim(); let loss = 0;
  if (raw !== '') {
    loss = Number(raw);
    if (!isFinite(loss) || loss < 0) throw new Error('Loss amount must be 0 or more.');
    if (loss > 10000000) throw new Error('Loss amount is too large.');
    loss = Math.round(loss * 100) / 100;
  }
  return {orderStatus: st, cancelReason: reason, lossAmount: loss};
}

/* ============ DELETE ORDER: 1) storage files  2) Supabase row  3) Google Sheet row ============ */
const storagePathFromUrl = u => { const m = String(u || '').match(/\/object\/public\/[^/]+\/(.+)$/); return m ? decodeURIComponent(m[1].split('?')[0]) : null; };
async function deleteOrder() {
  if (!found || saving) return;
  const orderId = found['Order ID'];
  if (!confirm(`Are you sure you want to permanently delete this order (Order ID: ${orderId})? This action cannot be undone.`)) return;
  saving = true; $('delBtn').disabled = true; $('delTxt').textContent = 'Deleting...'; $('delIco').className = 'fa-solid fa-spinner fa-spin';
  const warn = []; let stockMsg = '';
  try {
    let row = supaRow; if (!row) { try { row = await supaGetByOrder(orderId); } catch (e) {} }   // record holding the file URLs
    if (row) {
      try {   // stock goes back first; repeating this call never restores twice
        const rs = await rpc('restore_invoice_stock', {p_order_id: orderId});
        if (rs && rs.restored) stockMsg = ` - stock restored for ${rs.restored} SKU${rs.restored === 1 ? '' : 's'}`;
      } catch (e) { if (!e.notSetUp) throw new Error('Could not restore stock: ' + e.message + ' (nothing was deleted)'); }
      // 1) files in the bucket (bills/ and packing/)
      const paths = [row.invoice_url, row.packing_image_url].map(storagePathFromUrl).filter(Boolean);
      if (paths.length) {
        const r = await fetch(`${SUPA.url}/storage/v1/object/${SUPA.bucket}`, {method: 'DELETE', headers: supaHeaders({'Content-Type': 'application/json'}), body: JSON.stringify({prefixes: paths})});
        if (!r.ok) throw new Error('Could not delete the stored files: ' + await supaErr(r) + ' (nothing else was deleted)');
        if ((await r.json()).length < paths.length) warn.push('some files were not removed - add the storage delete policy');
      }
      // 2) database row
      const res = await fetch(`${SUPA.url}/rest/v1/${SUPA.table}?id=eq.${encodeURIComponent(row.id)}`, {method: 'DELETE', headers: supaHeaders({Prefer: 'return=representation'})});
      if (!res.ok) throw new Error('Database delete failed: ' + await supaErr(res));
      if (!(await res.json()).length) throw new Error('Database row was not deleted - add the table delete policy');
      supaRow = null;
    }
    // 3) Google Sheet row (uses your existing Apps Script URL through api())
    const sr = await api('POST', {action: 'deleteOrder', orderId: orderId});
    if (!sr.success && sr.status !== 'not_found') throw new Error('Deleted from Supabase, but the sheet failed: ' + (sr.error || 'unknown error') + '. Tap Delete Order again to retry.');
    toast(warn.length ? 'Order deleted' + stockMsg + ', but ' + warn.join('; ') : 'Order permanently deleted successfully' + stockMsg, !!warn.length);
    if (stockMsg) invLoad(true).then(() => invMirrorSoon());
    found = null; supaRow = null; $('lookBox').classList.add('hidden'); $('lookLinks').classList.add('hidden'); $('searchId').value = ''; $('lookMsg').textContent = ''; loadOrders();
  } catch (e) { toast(e.message, true); }
  finally { saving = false; $('delBtn').disabled = false; $('delTxt').textContent = 'Delete Order'; $('delIco').className = 'fa-solid fa-trash'; }
}

/* ===== INVENTORY START ===== */
let invRows = [], invImgTarget = null, invEditId = null, invBusy = false;
const invEsc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const notSetUpErr = () => Object.assign(new Error('Inventory is not set up yet - run inventory.sql in the Supabase SQL Editor first'), {notSetUp: true});
const isNotSetUp = (status, j) => status === 404 || !!(j && ['PGRST202', 'PGRST205', '42P01', '42883'].includes(j.code));

function invFriendly(m) {
  const [code, a, b, c] = String(m || '').split('|');
  switch (code) {
    case 'UNKNOWN_SKU': return `SKU "${a}" is not in Inventory. Add it on the Inventory page first.`;
    case 'INSUFFICIENT_STOCK': return `Not enough stock for ${a}: available ${b}, needed ${c}.`;
    case 'DUPLICATE_SKU': return `SKU "${a}" is entered twice in this invoice.`;
    case 'SKU_EXISTS': return `SKU "${a}" already exists in Inventory.`;
    case 'INVALID_SKU': case 'INVALID_QTY': case 'INVALID_ORDER': case 'NOT_FOUND': return a;
    default: return String(m || 'Unknown error');
  }
}
async function rpc(name, args) {
  const res = await fetch(`${SUPA.url}/rest/v1/rpc/${name}`, {method: 'POST', headers: supaHeaders({'Content-Type': 'application/json'}), body: JSON.stringify(args || {})});
  let j = null; try { j = await res.json(); } catch (e) {}
  if (!res.ok) {
    if (res.status === 409 || (j && j.code === '23505')) throw dupErr(['database']);
    if (isNotSetUp(res.status, j)) throw notSetUpErr();
    throw new Error(invFriendly(j && j.message ? j.message : res.statusText));
  }
  return j;
}
async function invFetchAll(path) {     // pages of 1000 so ALL rows come back
  const out = [], size = 1000;
  for (let from = 0; ; from += size) {
    const res = await fetch(`${SUPA.url}/rest/v1/${path}${path.includes('?') ? '&' : '?'}limit=${size}&offset=${from}`, {headers: supaHeaders()});
    if (!res.ok) { let j = null; try { j = await res.json(); } catch (e) {} if (isNotSetUp(res.status, j)) throw notSetUpErr(); throw new Error((j && j.message) || res.statusText); }
    const part = await res.json(); out.push(...part);
    if (part.length < size) break;
  }
  return out;
}
async function storageRemove(paths) {
  paths = (paths || []).filter(Boolean); if (!paths.length) return 0;
  const r = await fetch(`${SUPA.url}/storage/v1/object/${SUPA.bucket}`, {method: 'DELETE', headers: supaHeaders({'Content-Type': 'application/json'}), body: JSON.stringify({prefixes: paths})});
  if (!r.ok) throw new Error(await supaErr(r));
  return (await r.json()).length;
}

/* ---- view switch ---- */
function showView(v) {
  if (v === 'inv' && !accValid()) return needAccess(() => showView('inv'));     // Gmail OTP gate
  const inv = v === 'inv';
  $('billMain').classList.toggle('hidden', inv); $('invMain').classList.toggle('hidden', !inv);
  $('navBill').classList.toggle('active', !inv); $('navInv').classList.toggle('active', inv); closeInvPops();
  if (inv) invLoad(); window.scrollTo(0, 0);
}
/* Link options modal (behind the Gmail code) + inventory Download / Delete popovers */
function closeInvPops() { $('invDlPop').classList.remove('show'); $('invDelPop').classList.remove('show'); }
function openLinkOptions() { closeInvPops(); needAccess(() => openM('linkModal')); }
function linkGo(w) { closeM('linkModal'); if (!accValid()) return needAccess(() => linkGo(w)); if (w === 'cloud') openInvConn(); else if (w === 'sync') openSync(); else if (w === 'mig') openMig(); else openConn(); }
function invTogglePop(id, e) { e.stopPropagation(); const el = $(id), open = !el.classList.contains('show'); closeInvPops(); el.classList.toggle('show', open); }
document.addEventListener('click', e => { if (!e.target.closest('.popmenu')) closeInvPops(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeInvPops(); if ($('linkModal').classList.contains('show')) closeM('linkModal'); if ($('accModal').classList.contains('show')) accCancel(); } });

/* ---- load + render ---- */
async function invLoad(silent) {
  if (!silent) $('invMsg').textContent = 'Loading inventory...';
  try {
    invRows = await invFetchAll('inventory?select=*&order=serial_no.asc');
    $('skuList').innerHTML = invRows.map(r => `<option value="${invEsc(r.sku_id)}" label="Stock: ${r.stock_qty}${invIsLow(r) ? ' (LOW)' : ''}"></option>`).join('');
    lowBannerRender(); invRender(); $('invMsg').textContent = '';
  } catch (e) { if (!silent) $('invMsg').textContent = 'Could not load inventory: ' + e.message; }
}
/* reorder level: blank / missing / invalid = 1.  An item is LOW when stock <= its reorder level. */
const invReOf = r => { const n = Number(r && r.reorder_level); return !r || r.reorder_level == null || r.reorder_level === '' || !isFinite(n) || n < 0 ? 1 : n; };
const invIsLow = r => Number(r.stock_qty) <= invReOf(r);
const invFiltered = () => { const q = $('invSearch').value.trim().toLowerCase(); let rows = q ? invRows.filter(r => String(r.sku_id).toLowerCase().includes(q)) : invRows; if ($('invLowOnly') && $('invLowOnly').checked) rows = rows.filter(invIsLow); return rows; };

/* red banner under the top bar (both pages). Hidden again by "x" until a different set of items goes low. */
function lowBannerRender() {
  const box = $('lowBanner'); if (!box) return;
  const low = invRows.filter(invIsLow).sort((a, b) => Number(a.stock_qty) - Number(b.stock_qty)), sig = low.map(r => r.sku_id + ':' + r.stock_qty + ':' + invReOf(r)).join('|');
  let gone = ''; try { gone = sessionStorage.getItem('shyn_low_dismiss') || ''; } catch (e) {}
  box.dataset.sig = sig;
  if (!low.length || gone === sig) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  const out = low.filter(r => Number(r.stock_qty) <= 0).length, shown = low.slice(0, 8);
  box.innerHTML = `<div class="lowbar max-w-6xl mx-auto"><div class="flex items-start gap-3">
    <i class="fa-solid fa-triangle-exclamation lowico" aria-hidden="true"></i>
    <div class="flex-1 min-w-0"><p class="font-semibold text-sm"><b>Low stock</b> &ndash; ${low.length} item${low.length === 1 ? '' : 's'} at or below the reorder level${out ? `, <span style="color:#ff6b81">${out} out of stock</span>` : ''}</p>
      <div class="mt-1 break-words">${shown.map(r => `<span class="lowchip">${invEsc(r.sku_id)}: ${invEsc(r.stock_qty)} / ${invReOf(r)}</span>`).join('')}${low.length > shown.length ? `<span class="lowchip">+${low.length - shown.length} more</span>` : ''}</div></div>
    <div class="flex flex-col items-end gap-1.5 flex-none"><button class="chip" onclick="showView('inv')"><i class="fa-solid fa-boxes-stacked mr-1"></i>Open inventory</button>
      <button class="text-lg leading-none" style="color:#ff9aa9" aria-label="Hide this alert" title="Hide until another item goes low" onclick="lowDismiss()"><i class="fa-solid fa-xmark"></i></button></div></div></div>`;
  box.classList.remove('hidden');
}
function lowDismiss() { const box = $('lowBanner'); try { sessionStorage.setItem('shyn_low_dismiss', box.dataset.sig || ''); } catch (e) {} box.classList.add('hidden'); box.innerHTML = ''; }
async function invSetReorderBySku(sku, level) {    // needs sync.sql (inventory_set_reorder). Reads the serial number from the freshly loaded list
  const row = invRows.find(r => String(r.sku_id).trim().toLowerCase() === String(sku).trim().toLowerCase()); if (!row) throw new Error(`SKU "${sku}" not found`);
  try { await rpc('inventory_set_reorder', {p_serial: Number(row.serial_no), p_level: level}); }
  catch (e) { if (e.notSetUp) throw new Error('Reorder level needs the updated sync.sql: run it once in the Supabase SQL Editor.'); throw e; }
}
let invRT = null;
function invRenderSoon() { clearTimeout(invRT); invRT = setTimeout(invRender, 130); }
function invRender() {
  const rows = invFiltered(), total = invRows.length;
  $('invCount').textContent = total ? `${rows.length} of ${total} item${total === 1 ? '' : 's'}` : '';
  if (!rows.length) { $('invBody').innerHTML = `<tr><td colspan="6" class="p-6 text-center" style="color:var(--mut)">${total ? ($('invLowOnly') && $('invLowOnly').checked ? 'No low-stock items. Everything is above its reorder level.' : 'No SKU matches your search.') : 'No inventory items yet. Tap "Add Inventory Item".'}</td></tr>`; return; }
  const btn = (ic, t, fn, extra) => `<button class="chip" style="${extra || ''}" onclick="${fn}"><i class="fa-solid ${ic} mr-1"></i>${t}</button>`;
  $('invBody').innerHTML = rows.map(r => {
    const n = Number(r.serial_no), q = r.stock_qty, re = invReOf(r), low = invIsLow(r), col = low ? '#ff6b81' : 'var(--em)';
    const img = r.image_url ? `<img src="${invEsc(r.image_url)}" alt="" loading="lazy" class="rounded-lg object-cover" style="width:48px;height:48px">` : '<span class="text-xs" style="color:var(--mut)">No image</span>';
    const acts = (r.image_url ? btn('fa-eye', 'View', `invView(${n})`) + btn('fa-arrows-rotate', 'Change', `invPickImage(${n})`) : btn('fa-upload', 'Upload', `invPickImage(${n})`))
      + btn('fa-trash', 'Delete', `invDelete(${n})`, 'border-color:#ff6b81;color:#ff6b81');
    return `<tr class="${low ? 'invlow' : ''}" style="border-top:1px solid rgba(255,255,255,.08)"><td class="p-3">${n}</td><td class="p-3 font-semibold break-all">${invEsc(r.sku_id)}${low ? `<span class="lowbadge">${Number(q) <= 0 ? 'OUT OF STOCK' : 'LOW'}</span>` : ''}</td>
      <td class="p-3 whitespace-nowrap"><b style="color:${col}">${q}</b> <button class="chip ml-1" aria-label="Edit stock" onclick="invOpenStock(${n})"><i class="fa-solid fa-pen"></i></button></td>
      <td class="p-3 whitespace-nowrap" style="color:var(--cy)">${re}</td><td class="p-3">${img}</td><td class="p-3"><div class="flex flex-wrap gap-1.5">${acts}</div></td></tr>`;
  }).join('');
}

/* ---- add item ---- */
function invOpenAdd() { $('invNewSku').value = ''; $('invNewQty').value = '0'; $('invNewRe').value = '1'; $('invItemErr').textContent = ''; openM('invItemModal'); setTimeout(() => $('invNewSku').focus(), 50); }
const invValidSku = v => v.length >= 1 && v.length <= 64 && !/[\u0000-\u001f<>"]/.test(v);
const invValidQty = v => /^\d{1,7}$/.test(String(v).trim());
async function invSaveItem() {
  if (invBusy) return; const sku = $('invNewSku').value.trim(), qty = $('invNewQty').value.trim(), err = $('invItemErr');
  if (!invValidSku(sku)) return err.textContent = 'Enter a SKU ID (1 to 64 characters, no < > or quotes).';
  if (!invValidQty(qty)) return err.textContent = 'Stock must be a whole number, 0 or more.';
  if (invRows.some(r => String(r.sku_id).trim().toLowerCase() === sku.toLowerCase())) return err.textContent = `SKU "${sku}" already exists.`;
  const reRaw = $('invNewRe').value.trim(), reNew = reRaw === '' ? 1 : reRaw;   // blank = default 1
  if (!invValidQty(reNew)) return err.textContent = 'Reorder level must be a whole number, 0 or more.';
  invBusy = true; $('invItemBtn').disabled = true; err.textContent = '';
  try {
    await rpc('inventory_add_item', {p_sku: sku, p_qty: parseInt(qty, 10)});
    const lv = parseInt(reNew, 10); let reWarn = '';
    if (lv !== 1) { await invLoad(true); try { await invSetReorderBySku(sku, lv); } catch (e2) { reWarn = ' - but the reorder level was not saved: ' + e2.message; } }
    closeM('invItemModal'); toast('Inventory item added' + reWarn, !!reWarn); await invLoad(); invMirrorSoon();
  }
  catch (e) { err.textContent = e.message; }
  finally { invBusy = false; $('invItemBtn').disabled = false; }
}

/* ---- edit stock ---- */
function invOpenStock(n) {
  const r = invRows.find(x => Number(x.serial_no) === n); if (!r) return;
  invEditId = n; $('invStockSku').textContent = r.sku_id; $('invStockQty').value = r.stock_qty; $('invStockRe').value = invReOf(r); $('invStockNote').value = ''; $('invStockErr').textContent = ''; openM('invStockModal');
}
async function invSaveStock() {
  if (invBusy || invEditId == null) return; const qty = $('invStockQty').value.trim(), err = $('invStockErr');
  if (!invValidQty(qty)) return err.textContent = 'Stock must be a whole number, 0 or more.';
  const reRaw = $('invStockRe').value.trim(), reNew = reRaw === '' ? 1 : reRaw;   // blank = default 1
  if (!invValidQty(reNew)) return err.textContent = 'Reorder level must be a whole number, 0 or more.';
  const row = invRows.find(x => Number(x.serial_no) === invEditId), qtyNew = parseInt(qty, 10), lvNew = parseInt(reNew, 10);
  invBusy = true; $('invStockBtn').disabled = true; err.textContent = '';
  try {
    if (!row || Number(row.stock_qty) !== qtyNew) await rpc('inventory_set_stock', {p_serial: invEditId, p_qty: qtyNew, p_note: $('invStockNote').value.trim() || null});
    if (!row || invReOf(row) !== lvNew) { try { await rpc('inventory_set_reorder', {p_serial: invEditId, p_level: lvNew}); } catch (e) { if (e.notSetUp) throw new Error('Reorder level needs the updated sync.sql: run it once in the Supabase SQL Editor. (Stock was saved.)'); throw e; } }
    closeM('invStockModal'); toast('Stock updated'); await invLoad(); invMirrorSoon();
  }
  catch (e) { err.textContent = e.message; }
  finally { invBusy = false; $('invStockBtn').disabled = false; }
}

/* ---- images: upload / change / view ---- */
function invPickImage(n) { invImgTarget = n; $('invImgIn').click(); }
$('invImgIn').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f && invImgTarget != null) invUploadImage(invImgTarget, f); });
async function invUploadImage(n, file) {
  const row = invRows.find(r => Number(r.serial_no) === n); if (!row || invBusy) return;
  if (!String(file.type).startsWith('image/')) return toast('Please choose an image file', true);
  invBusy = true; let path = null;
  try {
    toast('Uploading image...');
    const f = await compressImage(file, 120);
    path = `inventory/${Date.now()}_${safeName(row.sku_id)}.jpg`;
    const url = await supaUpload(path, f);
    let old = null;
    try { old = await rpc('inventory_set_image', {p_serial: n, p_url: url, p_path: path}); }
    catch (e) { try { await storageRemove([path]); } catch (x) {} throw e; }          // nothing saved -> do not leave the new file behind
    if (old && old !== path) { try { await storageRemove([old]); } catch (x) {} }       // replaced image is removed from Storage
    toast('Image saved'); await invLoad(); invMirrorSoon();
  } catch (e) { toast('Image upload failed: ' + e.message, true); }
  finally { invBusy = false; }
}
function invView(n) { const r = invRows.find(x => Number(x.serial_no) === n); if (!r || !r.image_url) return; $('invViewSku').textContent = r.sku_id; $('invViewImg').src = r.image_url; openM('invViewModal'); }

/* ---- delete item (with confirmation) ---- */
async function invDelete(n) {
  const r = invRows.find(x => Number(x.serial_no) === n); if (!r || invBusy) return;
  if (!confirm(`Delete inventory item "${r.sku_id}" (stock ${r.stock_qty})${r.image_url ? ' and its image' : ''}? This cannot be undone.`)) return;
  invBusy = true;
  try {
    const path = await rpc('inventory_delete_item', {p_serial: n}); let note = '';
    if (path) { try { await storageRemove([path]); } catch (e) { note = ' (image file could not be removed from Storage)'; } }
    toast('Inventory item deleted' + note, !!note); await invLoad(); invMirrorDelete(r.sku_id);
  } catch (e) { toast(e.message, true); }
  finally { invBusy = false; }
}

/* ---- reports (CSV / XLSX) ---- */
function toCsv(rows) {
  const cell = v => { let t = v == null ? '' : String(v); if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  return rows.map(r => r.map(cell).join(',')).join('\r\n');
}
function downloadFile(name, content, mime) {
  const a = document.createElement('a'), u = URL.createObjectURL(new Blob([content], {type: mime}));
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
}
async function invExportStock(kind, full) {
  try {
    toast('Preparing stock report...');
    let rows = await invFetchAll('inventory?select=*&order=serial_no.asc');                // always fresh from Supabase
    if (!full && $('invFilteredOnly').checked) { const q = $('invSearch').value.trim().toLowerCase(); if (q) rows = rows.filter(r => String(r.sku_id).toLowerCase().includes(q)); }
    if (!rows.length) { toast('Inventory is empty - nothing to export', true); return false; }
    const head = ['Serial Number', 'SKU ID', 'Available Stock', 'Reorder Level', 'Product Image URL'], data = rows.map(r => [Number(r.serial_no), r.sku_id, r.stock_qty, invReOf(r), r.image_url || '']);
    const name = 'Inventory_Stock_Report_' + iso(new Date());
    if (kind === 'xlsx') {
      if (!await ensure(() => window.XLSX, ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'])) return toast('Excel library failed to load. Check internet.', true);
      const ws = XLSX.utils.aoa_to_sheet([head, ...data]); ws['!cols'] = [{wch: 14}, {wch: 26}, {wch: 16}, {wch: 14}, {wch: 60}];
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Stock'); XLSX.writeFile(wb, name + '.xlsx');
    } else downloadFile(name + '.csv', '\ufeff' + toCsv([head, ...data]), 'text/csv;charset=utf-8');
    toast(`Stock report downloaded (${rows.length} items)`); return true;
  } catch (e) { toast('Report failed: ' + e.message, true); return false; }
}
async function invExportMoves() {
  try {
    toast('Preparing movement report...');
    const rows = await invFetchAll('stock_movements?select=*&order=created_at.desc,id.desc');
    if (!rows.length) { toast('No stock movements recorded yet', true); return false; }
    const head = ['Date and Time', 'Invoice Number', 'SKU ID', 'Previous Stock', 'Quantity Added (+) / Sold (-)', 'Remaining Stock', 'Transaction Type', 'Note'];
    const data = rows.map(r => [new Date(r.created_at).toLocaleString('en-IN'), r.invoice_no || '', r.sku_id, r.prev_stock, r.qty_change, r.new_stock, r.movement_type, r.note || '']);
    downloadFile('Stock_Movements_Report_' + iso(new Date()) + '.csv', '\ufeff' + toCsv([head, ...data]), 'text/csv;charset=utf-8');
    toast(`Movement report downloaded (${rows.length} rows)`); return true;
  } catch (e) { toast('Report failed: ' + e.message, true); return false; }
}

/* ---- Download / Delete menus ---- */
function invDownload(kind) { closeInvPops(); return kind === 'stock' ? invExportStock('csv') : invExportMoves(); }
async function invDeleteData(kind) {
  closeInvPops(); if (invBusy) return;
  const label = kind === 'stock' ? 'Stock Report' : 'Stock Movement';
  const detail = kind === 'stock'
    ? `This permanently removes ALL inventory items (${invRows.length}: SKUs, stock quantities and product images) and empties the inventory sheet. A CSV backup is saved to your device first.`
    : 'This permanently removes the whole stock movement history (the log of every stock change). A CSV backup is saved to your device first.';
  if (!confirm(`Are you sure you want to delete ${label}? This action cannot be undone.\n\n${detail}`)) return;
  invBusy = true;
  try {
    const saved = kind === 'stock' ? await invExportStock('csv', true) : await invExportMoves();   // backup first - nothing is deleted if it fails or there is nothing to delete
    if (!saved) return;
    if (kind === 'stock') {
      const res = await rpc('inventory_delete_all'), warn = [], paths = (res && res.paths) || [];
      for (let i = 0; i < paths.length; i += 100) { try { await storageRemove(paths.slice(i, i + 100)); } catch (e) { warn.push('some image files were not removed'); break; } }
      if (getInvUrl()) { try { await invSheet('inv_replaceAll', {items: []}); } catch (e) { warn.push('the inventory sheet was not cleared: ' + e.message); } }
      toast(`Stock Report deleted (${res.count} item${res.count === 1 ? '' : 's'})` + (warn.length ? ' - but ' + warn.join('; ') : ''), !!warn.length);
      await invLoad();
    } else {
      const n = await rpc('stock_movements_delete_all');
      toast(`Stock Movement deleted (${n} record${n === 1 ? '' : 's'})`);
    }
  } catch (e) { toast('Delete failed: ' + e.message, true); }
  finally { invBusy = false; }
}

/* ---- Secondary SKU IDs on the billing form ---- */
function addSecSku(v) {
  const d = document.createElement('div'); d.className = 'flex gap-2';
  d.innerHTML = `<input class="inp sec-sku" list="skuList" placeholder="Secondary SKU ID" autocomplete="off"><button type="button" class="btn btn-ghost !px-3" aria-label="Remove this SKU ID" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
  if (v) d.firstChild.value = v; $('secSkuList').appendChild(d);
}
const secSkus = () => [...document.querySelectorAll('.sec-sku')].map(i => i.value.trim()).filter(Boolean);
function resetSecSkus() { $('secSkuList').innerHTML = ''; addSecSku(); }
resetSecSkus();

/* Checks the SECONDARY SKUs against live stock BEFORE any file is uploaded (the database repeats these checks atomically on save).
   The primary SKU is reference-only and is never checked or deducted. */
async function invValidateSale(secs) {
  const seen = new Set();
  for (const sku of secs) { const k = sku.toLowerCase(); if (seen.has(k)) throw new Error(`SKU "${sku}" is entered twice in the Secondary SKU IDs`); seen.add(k); }
  if (!secs.length) return;
  let rows; try { rows = await invFetchAll('inventory?select=sku_id,stock_qty'); } catch (e) { if (e.notSetUp) return; throw e; }
  const map = new Map(rows.map(r => [String(r.sku_id).trim().toLowerCase(), r]));
  for (const sku of secs) {
    const r = map.get(sku.toLowerCase());
    if (!r) throw new Error(`SKU "${sku}" is not in Inventory. Add it on the Inventory page first.`);
    if (r.stock_qty < 1) throw new Error(`Not enough stock for ${r.sku_id}: available ${r.stock_qty}, needed 1`);
  }
}
/* ===== INVENTORY END ===== */

/* ===== INVENTORY SHEET CONNECTION START ===== */
async function invApi(action, extra) {           // talks to the separate inventory Apps Script (never the billing script)
  const url = getInvUrl(); if (!url) throw new Error('The inventory sheet script URL is not set. Open the link icon in the top bar > Cloud Config and paste it.');
  let res; const same = url === getUrl(), body = {action, ...extra};
  if (same) { body.deviceId = deviceId(); if (authTok()) body.auth = authTok(); if (accToken()) body.token = accToken(); }
  try { res = await fetch(url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(body)}); }
  catch (e) { throw new Error('Cannot reach the inventory sheet script. The app is using a URL ending ...' + url.slice(-24) + ' - compare it with the link that works in your browser (link icon > Cloud Config > Change script URL).'); }
  const txt = await res.text(); let j;
  try { j = JSON.parse(txt); } catch (e) { throw new Error('The inventory script sent a web page, not data. Use the /exec URL, set access to "Anyone", and deploy a New version.'); }
  if (j && j.authExpired) { if (same) { doLogout('Your session expired. Please sign in again.'); throw Object.assign(new Error('Session expired. Please sign in again.'), {authExpired: true}); } throw new Error('The inventory script asks for a sign-in. Set REQUIRE_LOGIN_TOKEN = false and REQUIRE_ACCESS_TOKEN = false in it (transfer target), or use the merged Code.gs.'); }
  if (j && j.expired) { if (url === getUrl()) { accClear(); throw Object.assign(new Error('Verification expired. Open Inventory and enter the Gmail code again.'), {expired: true}); } throw new Error('The inventory script asks for a Gmail verification token. Set REQUIRE_ACCESS_TOKEN = false in it, or use the merged Code.gs.'); }
  return j;
}
async function invSheet(action, extra) { const r = await invApi(action, extra); if (!r.success) throw new Error(r.error || 'Request failed'); return r; }
const invSheetItem = x => ({serial_no: x.serial_no, sku_id: x.sku_id, stock_qty: x.stock_qty, image_url: x.image_url || '', reorder_level: invReOf(x)});   // Code.gs mails the owner when stock <= reorder_level
const icMsg = (t, bad) => { $('invConnMsg').textContent = t || ''; $('invConnMsg').style.color = bad ? '#ff6b81' : 'var(--mut)'; };
function icShow(step) { ['icA', 'icC'].forEach(i => $(i).classList.toggle('hidden', i !== step)); }
async function openInvConn() {
  icMsg(''); $('icLinkBox').innerHTML = ''; openM('invConnModal');
  if (!getInvUrl()) { $('icUrl').value = ''; return icShow('icA'); }
  icShow('icC'); invTest(true);
}
function invChangeUrl() { $('icUrl').value = getInvUrl(); icShow('icA'); icMsg(''); }
async function invSaveUrl() {
  const u = $('icUrl').value.trim();
  if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(u)) return icMsg('The URL must start with https://script.google.com/ and end with /exec', true);
  const prev = localStorage.getItem('shyn_inv_url'); icMsg('Testing...'); localStorage.setItem('shyn_inv_url', u);
  try { await invSheet('ping'); icMsg('Connected.'); icShow('icC'); invTest(true); invMirrorNow(); }
  catch (e) { if (prev) localStorage.setItem('shyn_inv_url', prev); else localStorage.removeItem('shyn_inv_url'); icMsg(e.message, true); }
}
async function invTest(quiet) {
  try { const r = await invSheet('inv_ping'); $('icInfo').textContent = `Connected to "${r.spreadsheetName}" - ${r.rows} item${r.rows === 1 ? '' : 's'} in the "${r.sheetName}" tab. ${r.version ? 'Script version: ' + r.version + (r.version === EXPECTED_VERSION ? ' (matches this page).' : ' (this page expects ' + EXPECTED_VERSION + ' - paste the latest Code.gs and deploy a New version).') : 'Script version: OLD - this URL (ends ...' + getInvUrl().slice(-12) + ') does not have the new Code.gs.'}`; if (!quiet) icMsg('Connection OK.'); }
  catch (e) { $('icInfo').textContent = ''; icMsg(e.message, true); }
}
async function invMailNow(kind) {                 // buttons in Cloud Config: ask Code.gs to send the neon mails right now
  icMsg(kind === 'daily' ? 'Sending the daily summary mail...' : kind === 'report' ? 'Sending the inventory report mail...' : 'Checking stock levels...');
  try { const r = await invSheet(kind === 'daily' ? 'mail_dailySummary' : kind === 'report' ? 'mail_inventoryReport' : 'mail_lowStockNow'); icMsg(r.message || 'Mail sent.'); toast(r.message || 'Mail sent'); }
  catch (e) { icMsg(e.message === 'Unknown action' ? 'The script this app talks to (URL ends ...' + getInvUrl().slice(-12) + ') does not know this action. It is not running the new Code.gs: use Test connection to see its version.' : e.message, true); }
}
async function invOpenSheet() {
  try { const r = await invSheet('inv_sheetUrl'); const a = document.createElement('a'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Tap here to open the inventory sheet'; a.style.color = 'var(--cy)'; a.className = 'underline'; $('icLinkBox').replaceChildren(a); }
  catch (e) { icMsg(e.message, true); }
}

/* automatic copy of app inventory -> inventory sheet (Supabase stays the source of truth because only it can deduct stock atomically) */
let invMirrorTimer = null;
function invMirrorSoon() { if (!getInvUrl()) return; clearTimeout(invMirrorTimer); invMirrorTimer = setTimeout(() => invMirrorNow(), 1200); }
async function invMirrorNow(manual) {
  const box = $('invSheetMsg');
  if (!getInvUrl()) { if (manual) { box.style.color = '#ff6b81'; box.textContent = 'Inventory sheet is not connected. Open the link icon in the top bar > Cloud Config.'; } return; }
  try {
    const rows = await invFetchAll('inventory?select=*&order=serial_no.asc');
    await invSheet('inv_upsert', {items: rows.map(invSheetItem)});
    box.style.color = 'var(--em)'; box.textContent = 'Inventory sheet updated ' + new Date().toLocaleTimeString('en-IN');
  } catch (e) { box.style.color = '#ff6b81'; box.textContent = 'Inventory sheet NOT updated: ' + e.message; }
}
async function invMirrorDelete(sku) { if (!getInvUrl()) return; try { await invSheet('inv_delete', {sku_id: sku}); $('invSheetMsg').style.color = 'var(--em)'; $('invSheetMsg').textContent = 'Inventory sheet updated ' + new Date().toLocaleTimeString('en-IN'); } catch (e) { $('invSheetMsg').style.color = '#ff6b81'; $('invSheetMsg').textContent = 'Item removed in the app, but NOT in the sheet: ' + e.message; } }

let icBusy = false;
async function invSyncToSheet() {                // exact copy: sheet rows that are not in the app are removed
  if (icBusy) return; icBusy = true;
  try {
    icMsg('Reading app inventory...');
    const rows = await invFetchAll('inventory?select=*&order=serial_no.asc');
    if (!confirm(`Replace EVERYTHING in the inventory sheet with the app inventory (${rows.length} item${rows.length === 1 ? '' : 's'})? Rows you typed only in the sheet will be removed.`)) return icMsg('Cancelled.');
    icMsg('Writing to the inventory sheet...');
    const r = await invSheet('inv_replaceAll', {items: rows.map(invSheetItem)});
    icMsg(`Done. ${r.written} item${r.written === 1 ? '' : 's'} written to the inventory sheet.`); toast('Inventory sheet updated'); invTest(true);
  } catch (e) { icMsg(e.message, true); }
  finally { icBusy = false; }
}
async function invSyncFromSheet() {
  if (icBusy) return; icBusy = true;
  try {
    icMsg('Reading the inventory sheet...');
    const [sheet, app] = await Promise.all([invSheet('inv_list'), invFetchAll('inventory?select=*&order=serial_no.asc')]);
    const byKey = new Map(app.map(r => [String(r.sku_id).trim().toLowerCase(), r])), adds = [], changes = [], reChanges = [], bad = [], seen = new Set();
    for (const x of sheet.items) {
      const sku = String(x.sku_id == null ? '' : x.sku_id).trim(); if (!sku) continue;
      const k = sku.toLowerCase();
      if (!invValidSku(sku) || seen.has(k) || !invValidQty(String(x.stock_qty))) { bad.push(sku); continue; }
      seen.add(k); const cur = byKey.get(k), q = parseInt(x.stock_qty, 10);
      const rv = x.reorder_level == null || x.reorder_level === '' ? null : Number(x.reorder_level), re = rv != null && isFinite(rv) && rv >= 0 && Math.floor(rv) === rv ? rv : null;
      if (!cur) adds.push({sku, q, re}); else { if (cur.stock_qty !== q) changes.push({row: cur, from: cur.stock_qty, to: q}); if (re != null && re !== invReOf(cur)) reChanges.push({row: cur, from: invReOf(cur), to: re}); }
    }
    if (!adds.length && !changes.length && !reChanges.length) return icMsg('Nothing to change - the app already matches the sheet.' + (bad.length ? ` (${bad.length} invalid row(s) skipped)` : ''));
    const lines = [...adds.slice(0, 5).map(a => `+ ${a.sku}: ${a.q}`), ...changes.slice(0, 5).map(c => `${c.row.sku_id}: ${c.from} -> ${c.to}`), ...reChanges.slice(0, 3).map(c => `${c.row.sku_id}: reorder level ${c.from} -> ${c.to}`)];
    if (!confirm(`Apply the inventory sheet to the app?\n\n${adds.length} new item(s), ${changes.length} stock change(s), ${reChanges.length} reorder-level change(s)${bad.length ? `, ${bad.length} invalid row(s) skipped` : ''}\n\n${lines.join('\n')}${adds.length + changes.length > 10 ? '\n...' : ''}\n\nStock changes overwrite the current app stock. Items missing from the sheet are NOT deleted.`)) return icMsg('Cancelled.');
    let ok = 0, fail = 0;
    for (const a of adds) { try { await rpc('inventory_add_item', {p_sku: a.sku, p_qty: a.q}); ok++; } catch (e) { fail++; } }
    for (const c of changes) { try { await rpc('inventory_set_stock', {p_serial: c.row.serial_no, p_qty: c.to, p_note: 'Synced from inventory sheet'}); ok++; } catch (e) { fail++; } }
    const needRe = [...adds.filter(a => a.re != null && a.re !== 1).map(a => ({sku: a.sku, to: a.re})), ...reChanges.map(c => ({sku: c.row.sku_id, to: c.to}))];
    if (needRe.length) { await invLoad(true); for (const t of needRe) { try { await invSetReorderBySku(t.sku, t.to); ok++; } catch (e) { fail++; } } }
    await invLoad(true); await invMirrorNow();   // refresh serial numbers in the sheet
    icMsg(`Applied ${ok} change${ok === 1 ? '' : 's'}${fail ? `, ${fail} failed` : ''}.`, !!fail); toast(fail ? 'Sync finished with errors' : 'App inventory updated from the sheet', !!fail); invTest(true);
  } catch (e) { icMsg(e.message, true); }
  finally { icBusy = false; }
}
/* ===== INVENTORY SHEET CONNECTION END ===== */

/* ===== GMAIL OTP ACCESS GATE START ===== */
/* Inventory and the Link options need a Gmail code. Tapping them first shows "Send Verification Code to registered Gmail?" with the last
   login time above it; the code is e-mailed ONLY after Proceed. Codes: max 10 per hour per session, strict 2 minutes between two codes. */
const ACC_KEY = 'shyn_acc', ACC_EXP = 'shyn_acc_exp';
const accToken = () => { const t = sget(ACC_KEY), e = Number(sget(ACC_EXP) || 0); return t && Date.now() < e ? t : ''; };
const accValid = () => !!accToken();
function accClear() { sset(ACC_KEY, null); sset(ACC_EXP, null); }
function accGuard(r) { if (r && r.expired) { accClear(); throw Object.assign(new Error('Verification expired. Verify again with the Gmail code.'), {expired: true}); } return r; }
let accNext = null, accEnd = 0, accResendAt = 0, accTimer = null, accBusy = false;
const accMsg = (t, bad) => { $('accMsg').textContent = t || ''; $('accMsg').style.color = bad ? '#ff6b81' : 'var(--mut)'; };
const accMsg1 = (t, bad) => { $('accMsg1').textContent = t || ''; $('accMsg1').style.color = bad ? '#ff6b81' : 'var(--mut)'; };
const accStep = n => { $('accStep1').classList.toggle('hidden', n !== 1); $('accStep2').classList.toggle('hidden', n !== 2); };
function needAccess(next) { if (accValid()) return next(); accNext = next; accOpen(); }   // run next() now if verified, otherwise ask first
function accOpen() {
  $('accOtp').value = ''; accMsg(''); accMsg1(''); $('accLast').textContent = lastLoginText(); $('accLast').classList.toggle('hidden', !lastLoginText());
  const m = sget('shyn_mail') || 'your registered Gmail'; $('accMail0').textContent = m; $('accMail').textContent = m; $('accGo').disabled = false;
  openM('accModal');
  if (accEnd > Date.now()) { accStep(2); accTick(); setTimeout(() => $('accOtp').focus(), 50); }   // a code is already on its way: no new mail is sent
  else { accStep(1); setTimeout(() => $('accGo').focus(), 50); }
}
function accCancel() { clearInterval(accTimer); accNext = null; closeM('accModal'); }
const accProceed = () => accSend(true);
function accTick() {
  clearInterval(accTimer);
  const step = () => {
    const left = Math.max(0, Math.round((accEnd - Date.now()) / 1000)), expired = left <= 0, wait = Math.max(0, Math.ceil((accResendAt - Date.now()) / 1000));
    $('accTime').textContent = fmtMS(left);
    $('accVerBtn').disabled = expired || accBusy;
    $('accResBtn').disabled = accBusy || wait > 0; $('accResBtn').textContent = wait > 0 ? `Resend OTP (${fmtMS(wait)})` : 'Resend OTP';
    if (expired && accEnd) { accMsg('The code expired. Tap Resend OTP.', true); accEnd = 0; }
    if (!accEnd && wait <= 0) clearInterval(accTimer);
  };
  step(); accTimer = setInterval(step, 1000);
}
async function accSend(fromConfirm) {
  if (accBusy) return;
  const say = fromConfirm ? accMsg1 : accMsg;
  if (!getUrl()) return say('No billing Google Sheet is linked, so no code can be emailed. Link it first.', true);
  accBusy = true; $('accGo').disabled = true; $('accResBtn').disabled = true; say('Sending the code to your Gmail...');
  try {
    const r = await api('POST', {action: 'accessOtpSend'});
    if (r.error === 'Unknown action') throw new Error('The script in use (ends ...' + getUrl().slice(-12) + ') is an old version without the Gmail code feature. Paste the new Code.gs there and deploy a New version.');
    if (!r.success) { if (r.retryAfterSec) { accResendAt = Date.now() + r.retryAfterSec * 1000; if (accEnd > Date.now()) accStep(2); } throw new Error(r.error || 'Could not send the code'); }
    accEnd = Date.now() + (r.expiresIn || 300) * 1000; accResendAt = Date.now() + (r.cooldownSec || 120) * 1000;
    const m = r.maskedEmail || 'your registered Gmail'; sset('shyn_mail', m); $('accMail').textContent = m; $('accOtp').value = ''; accStep(2);
    accMsg('Code sent. Check your Gmail.' + (r.sendsLeft != null ? ' (' + r.sendsLeft + ' more code' + (r.sendsLeft === 1 ? '' : 's') + ' allowed this hour)' : '')); setTimeout(() => $('accOtp').focus(), 50);
  } catch (e) { if (e.authExpired) return; say(e.message, true); }
  finally { accBusy = false; $('accGo').disabled = false; accTick(); }
}
function accInput() { const el = $('accOtp'); el.value = el.value.replace(/\D/g, '').slice(0, 6); if (el.value.length === 6) accVerify(); }
async function accVerify() {
  if (accBusy) return; const code = $('accOtp').value.trim();
  if (!/^\d{6}$/.test(code)) return accMsg('Enter the 6-digit code.', true);
  accBusy = true; $('accVerBtn').disabled = true; accMsg('Verifying...');
  try {
    const r = await api('POST', {action: 'accessOtpVerify', otp: code});
    if (!r.success) { accMsg(r.error || 'Invalid code', true); $('accOtp').value = ''; return; }
    sset(ACC_KEY, r.token); sset(ACC_EXP, String(Date.now() + (r.expiresInSec || 1800) * 1000 - 5000));
    clearInterval(accTimer); accEnd = 0; accResendAt = 0; closeM('accModal'); toast(`Verified. Access granted for ${Math.round((r.expiresInSec || 1800) / 60)} minutes.`);
    const n = accNext; accNext = null; if (n) n();
  } catch (e) { if (!e.authExpired) accMsg(e.message, true); }
  finally { accBusy = false; if (accEnd > Date.now()) $('accVerBtn').disabled = false; }
}
/* The mail's "Copy OTP Code" button opens this page with #copy=123456. The page only SHOWS that code with a Copy button (the tap is the user gesture
   a browser needs for the clipboard); it needs no sign-in and never sends the code anywhere. */
let copyCode = '';
function handleCopyHash() {
  const m = /^#copy=(\d{6})$/.exec(location.hash || ''); if (!m) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  copyCode = m[1]; $('copyCode').textContent = copyCode; $('copyMsg').textContent = ''; openM('copyModal');
}
async function copyNow() {
  try { await navigator.clipboard.writeText(copyCode); }
  catch (e) { const t = document.createElement('textarea'); t.value = copyCode; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (x) {} t.remove(); if (!ok) { $('copyMsg').style.color = '#ff6b81'; $('copyMsg').textContent = 'Could not copy automatically. Touch and hold the code to copy it.'; return; } }
  $('copyMsg').style.color = 'var(--em)'; $('copyMsg').textContent = 'Copied. Go back to SHYNWELL and paste it into the code box.';
}
/* ===== GMAIL OTP ACCESS GATE END ===== */


/* ===== SHEET-TO-SHEET TRANSFER START ===== */
const MG_CHUNK = 100, MG_SHOW_MAX = 1000;
let mgType = null, mgBusy = false, mgLog = [];
const mgSame = u => String(u || '').trim() === getUrl();                 // only the linked billing script receives the access token
const mgUrlOk = u => /^https:\/\/script\.google\.com\/.+\/exec$/.test(String(u || '').trim());
const mgTail = u => '...' + String(u || '').trim().slice(-18);
const mgEq = (a, b) => { if (a === b) return true; if (a == null || b == null) return false; const x = Number(a), y = Number(b); if (a !== '' && b !== '' && isFinite(x) && isFinite(y)) return x === y; return String(a).trim() === String(b).trim(); };
async function mgCall(url, action, extra) {
  url = String(url).trim(); const body = {action, ...extra}; if (mgSame(url)) { body.deviceId = deviceId(); if (authTok()) body.auth = authTok(); if (accToken()) body.token = accToken(); }
  let res; try { res = await fetch(url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(body)}); }
  catch (e) { throw new Error(`Cannot reach the script ${mgTail(url)}. Check internet and that it is deployed as a Web app for "Anyone".`); }
  const txt = await res.text(); let j;
  try { j = JSON.parse(txt); } catch (e) { throw new Error(`The script ${mgTail(url)} sent a web page, not data. Use the /exec URL and deploy a New version.`); }
  if (j && j.authExpired) { if (mgSame(url)) { doLogout('Your session expired. Please sign in again.'); throw Object.assign(new Error('Session expired. Please sign in again.'), {authExpired: true}); } throw new Error(`The script ${mgTail(url)} asks for a sign-in. Set REQUIRE_LOGIN_TOKEN = false and REQUIRE_ACCESS_TOKEN = false in that script (it is only a transfer target), deploy a New version, and try again.`); }
  if (j && j.expired) {
    if (mgSame(url)) { accClear(); throw Object.assign(new Error('Verification expired. Close this window and verify with the Gmail code again.'), {expired: true}); }
    throw new Error(`The script ${mgTail(url)} asks for a Gmail verification token. Set REQUIRE_ACCESS_TOKEN = false in that script (it is only a transfer target), deploy a New version, and try again.`);
  }
  if (j && j.error === 'Unknown action') throw Object.assign(new Error(`The script ${mgTail(url)} does not support transfers yet. Paste the updated script code and deploy a New version.`), {unsupported: true});
  if (j && j.success === false) throw new Error(j.error || 'The script refused the request');
  return j;
}
/* Old billing script (no code changes needed): its plain GET returns every row keyed by the sheet headers. Convert that to the transfer format. */
const MG_LEGACY = {'Platform': 'platform', 'Customer Name': 'customer_name', 'State': 'state', 'Full Address': 'address', 'Invoice Date': 'invoice_date', 'Shipping Date': 'shipping_date',
  'SKU ID': 'primary_sku', 'Secondary SKU IDs': 'secondary_skus', 'Payment Type': 'payment_type', 'Customer Price': 'customer_price', 'CGST': 'cgst', 'SGST': 'sgst', 'IGST': 'igst',
  'Original Price': 'original_price', 'Sale Price': 'sale_price', 'Credited Price': 'credited_price', 'Notes': 'notes', 'Order Status': 'order_status', 'Cancel Reason': 'cancel_reason',
  'Loss Amount': 'loss_amount', 'Invoice URL': 'invoice_url', 'Packing Image URL': 'packing_image_url', 'Timestamp': 'created_at'};
const MG_NUM = ['customer_price', 'cgst', 'sgst', 'igst', 'original_price', 'sale_price', 'credited_price', 'loss_amount'];
async function mgLegacyRead(url) {
  let res; try { res = await fetch(String(url).trim()); } catch (e) { throw new Error(`Cannot reach the script ${mgTail(url)}.`); }
  let j; try { j = JSON.parse(await res.text()); } catch (e) { throw new Error(`The script ${mgTail(url)} sent a web page, not data. Use the /exec URL.`); }
  const list = Array.isArray(j) ? j : (j && Array.isArray(j.orders) ? j.orders : null);
  if (!list) throw new Error(`The script ${mgTail(url)} did not return its orders. ` + ((j && j.error) || ''));
  const rows = []; let blank = 0;
  for (const o of list) {
    const id = String(o['Order ID'] == null ? '' : o['Order ID']).trim(); if (!id) { blank++; continue; }
    const r = {order_id: id};
    for (const h in MG_LEGACY) {
      let v = o[h]; if (v === '' || v == null) continue; const c = MG_LEGACY[h];
      if (MG_NUM.includes(c)) { v = parseFloat(v); if (isNaN(v)) continue; } else v = String(v);
      r[c] = v;
    }
    rows.push(r);
  }
  return {rows, dups: 0, blank};
}
const MG_TYPES = {
  inv: {
    label: 'Option A: Inventory Data', service: 'SHYNWELL inventory sheet', ping: 'inv_ping',
    key: r => syncKey(r.sku_id), id: r => r.sku_id, detail: r => 'Stock ' + r.stock_qty,
    read: async url => { const j = await mgCall(url, 'inv_list'); return {rows: j.items || [], dups: 0, blank: 0}; },
    check: r => { const sku = String(r.sku_id == null ? '' : r.sku_id).trim(); if (!sku) return 'No SKU ID'; if (!invValidSku(sku)) return 'Invalid SKU ID (1-64 characters, no < > or quotes)'; if (!invValidQty(String(r.stock_qty))) return `Stock must be a whole number, 0 or more (found "${r.stock_qty}")`; return ''; },
    changed: (s, d) => Number(s.stock_qty) !== Number(d.stock_qty) || (!!String(s.image_url || '').trim() && String(s.image_url).trim() !== String(d.image_url || '').trim()) || (s.reorder_level != null && d.reorder_level !== undefined && Number(s.reorder_level) !== Number(d.reorder_level)),
    send: (s, d) => ({serial_no: (s.serial_no !== '' && s.serial_no != null) ? s.serial_no : (d ? d.serial_no : ''), sku_id: d ? d.sku_id : String(s.sku_id).trim(), stock_qty: Number(s.stock_qty), image_url: String(s.image_url || '').trim() || (d ? String(d.image_url || '') : ''), ...(s.reorder_level != null && s.reorder_level !== '' ? {reorder_level: Number(s.reorder_level)} : {})}),
    write: (url, rows) => mgCall(url, 'inv_upsert', {items: rows}),
  },
  db: {
    label: 'Option B: Database / Full Records', service: 'SHYNWELL billing sheet', ping: 'ping',
    key: r => syncKey(r.order_id), id: r => r.order_id, detail: r => [r.customer_name, r.platform].filter(Boolean).join(' / '),
    read: async url => {
      try { const j = await mgCall(url, 'syncRead'); return {rows: j.rows || [], dups: j.duplicates || 0, blank: j.skipped || 0}; }
      catch (e) { if (!e.unsupported) throw e; return mgLegacyRead(url); }          // old script without transfer support: read it with its plain GET instead
    },
    check: r => String(r.order_id == null ? '' : r.order_id).trim() ? '' : 'No Order ID',
    changed: (s, d) => Object.keys(s).some(k => !['order_id', 'net_profit', 'created_at'].includes(k) && !mgEq(s[k], d[k])),
    send: s => { const o = {...s}; delete o.net_profit; return o; },       // the destination sheet recalculates Net Profit itself
    write: (url, rows) => mgCall(url, 'syncUpsertRows', {rows}),
  }
};
const mgMsg = (t, bad) => { $('mgStatus').textContent = t || ''; $('mgStatus').style.color = bad ? '#ff6b81' : 'var(--mut)'; };
function mgUi(on) { mgBusy = on; $('mgFwd').disabled = on; $('mgRev').disabled = on; $('mgSpin').classList.toggle('hidden', !on); }
function openMig() { openM('mgModal'); mgMsg('Ready.'); if (mgType) { $('mgStep1').classList.add('hidden'); $('mgStep2').classList.remove('hidden'); } else { $('mgStep1').classList.remove('hidden'); $('mgStep2').classList.add('hidden'); } }
function mgBack() { if (mgBusy) return; $('mgStep1').classList.remove('hidden'); $('mgStep2').classList.add('hidden'); }
function mgChoose(type) {
  mgType = type; $('mgTypeLbl').textContent = MG_TYPES[type].label;
  $('mgFrom').value = type === 'inv' ? getInvUrl() : getUrl();               // pre-filled with the active linked script; editable
  $('mgTo').value = ''; mgLog = []; $('mgSummary').textContent = ''; $('mgLogBox').classList.add('hidden'); mgMsg('Ready.'); $('mgBar').style.width = '0%';
  $('mgNote').textContent = type === 'inv' ? 'Rows are matched by SKU ID. Stock quantities in the destination are overwritten by the source. Nothing is ever deleted. Inventory sheet changes reach the app only through "Sync Inventory Sheet \u2192 App".'
    : 'Rows are matched by Order ID. Nothing is ever deleted. Empty values never overwrite existing data. Net Profit is recalculated by the destination sheet.';
  $('mgStep1').classList.add('hidden'); $('mgStep2').classList.remove('hidden');
}
const MG_LABEL = {added: 'Copied (new)', updated: 'Copied (updated)', unchanged: 'Up to date', skipped: 'Skipped', failed: 'Failed'};
function mgSummaryText(extra) {
  const c = k => mgLog.filter(e => e.result === k).length, a = c('added'), u = c('updated'), same = c('unchanged'), sk = c('skipped'), f = c('failed');
  return `Total processed: ${mgLog.length} | Copied: ${a + u} (${a} new, ${u} updated) | Up to date: ${same} | Skipped: ${sk} | Failed: ${f}${extra || ''}`;
}
function mgRender() {
  $('mgLogBox').classList.toggle('hidden', !mgLog.length);
  const f = $('mgFilter').value, pick = e => f === 'all' || (f === 'copied' && (e.result === 'added' || e.result === 'updated')) || (f === 'same' && e.result === 'unchanged') || (f === 'bad' && (e.result === 'skipped' || e.result === 'failed'));
  const rows = mgLog.map((e, i) => ({e, i})).filter(x => pick(x.e)), shown = rows.slice(0, MG_SHOW_MAX);
  const col = r => r === 'failed' ? '#ff6b81' : r === 'skipped' ? 'var(--gd)' : r === 'unchanged' ? 'var(--mut)' : 'var(--em)';
  $('mgBody').innerHTML = shown.map(({e, i}) => `<tr style="border-top:1px solid rgba(255,255,255,.07)"><td class="p-2">${i + 1}</td><td class="p-2 font-semibold break-all">${invEsc(e.id)}</td><td class="p-2 break-words">${invEsc(e.name)}</td><td class="p-2 whitespace-nowrap" style="color:${col(e.result)}">${invEsc(MG_LABEL[e.result] || e.result || '-')}</td><td class="p-2 break-words">${invEsc(e.reason)}</td></tr>`).join('')
    + (rows.length > shown.length ? `<tr><td colspan="5" class="p-2 text-center" style="color:var(--mut)">Showing the first ${MG_SHOW_MAX} of ${rows.length} rows</td></tr>` : '') + (!rows.length ? '<tr><td colspan="5" class="p-3 text-center" style="color:var(--mut)">No rows in this view.</td></tr>' : '');
}
async function mgSendChunk(T, dst, items) {      // one request per chunk; if it fails, retry row by row so only the bad row is marked failed
  try { await T.write(dst, items.map(i => i.payload)); for (const i of items) i.entry.result = i.kind; return; }
  catch (e) { if (e.expired) throw e; }
  let streak = 0, last = '';
  for (const it of items) {
    if (streak >= 2) { it.entry.result = 'failed'; it.entry.reason = last; continue; }   // the same error twice in a row: stop hammering the script
    try { await T.write(dst, [it.payload]); it.entry.result = it.kind; streak = 0; }
    catch (e) { if (e.expired) throw e; it.entry.result = 'failed'; it.entry.reason = e.message; last = e.message; streak++; }
  }
}
async function mgRun(dir) {
  if (mgBusy || !mgType) return;
  const T = MG_TYPES[mgType], from = $('mgFrom').value.trim(), to = $('mgTo').value.trim();
  if (!mgUrlOk(from)) return mgMsg('Enter a valid Source ("From") URL that ends in /exec.', true);
  if (!mgUrlOk(to)) return mgMsg('Enter a valid Destination ("To") URL that ends in /exec.', true);
  if (from === to) return mgMsg('Source and destination are the same script. Choose two different scripts.', true);
  const src = dir === 'fwd' ? from : to, dst = dir === 'fwd' ? to : from, name = dir === 'fwd' ? 'Forward (Source \u2192 Destination)' : 'Reverse (Destination \u2192 Source)';
  mgUi(true); mgLog = []; $('mgSummary').textContent = ''; $('mgBar').style.width = '0%'; mgRender();
  let sendList = [];
  try {
    mgMsg('Checking both scripts...');
    for (const [u, role] of [[src, 'source'], [dst, 'destination']]) { let pg = {}; try { pg = await mgCall(u, T.ping); } catch (e) { if (!e.unsupported) throw e; }   /* old script without ping: carry on */ if (pg.service && pg.service !== T.service) throw new Error(`The ${role} script is a "${pg.service}", but you chose ${T.label}. Use matching scripts.`); }
    mgMsg('Reading the source...'); const S = await T.read(src);
    mgMsg('Reading the destination...'); const D = await T.read(dst);
    const dmap = new Map(D.rows.map(r => [T.key(r), r])), pos = new Map(), plan = [];
    for (const r of S.rows) {
      const k = T.key(r), why = T.check(r), entry = {id: String(T.id(r) == null || T.id(r) === '' ? '(blank)' : T.id(r)), name: T.detail(r) || '', result: '', reason: ''};
      mgLog.push(entry);
      if (why) { entry.result = 'skipped'; entry.reason = why; continue; }
      if (pos.has(k)) { const prev = pos.get(k); prev.entry.result = 'skipped'; prev.entry.reason = 'Repeated ID in the source: a later row is used'; prev.kind = null; }
      const d = dmap.get(k), it = {entry, kind: null, payload: null};
      if (!d) { it.kind = 'added'; it.payload = T.send(r, null); } else if (T.changed(r, d)) { it.kind = 'updated'; it.payload = T.send(r, d); } else { entry.result = 'unchanged'; entry.reason = 'Already identical in the destination'; }
      pos.set(k, it); plan.push(it);
    }
    sendList = plan.filter(i => i.kind);
    const add = sendList.filter(i => i.kind === 'added').length, upd = sendList.length - add, same = plan.filter(i => !i.kind && i.entry.result === 'unchanged').length, skipped = mgLog.filter(e => e.result === 'skipped').length;
    mgRender();
    if (!sendList.length) { mgMsg('Nothing to copy.'); $('mgSummary').textContent = mgSummaryText(); return toast('Nothing to transfer - the destination already has everything', false); }
    if (!confirm(`${name}\nFrom ${mgTail(src)}  to  ${mgTail(dst)}\n\n- ${add} new row(s) will be added\n- ${upd} existing row(s) will be updated\n- ${same} already identical (not sent)\n- ${skipped} skipped (see the log)\n- Nothing is deleted${mgType === 'inv' ? '\n\nStock quantities in the destination will be overwritten by the source.' : ''}`)) { mgLog = []; mgRender(); return mgMsg('Cancelled.'); }
    for (let i = 0; i < sendList.length; i += MG_CHUNK) {
      mgMsg(`Writing to the destination... ${Math.min(i + MG_CHUNK, sendList.length)} / ${sendList.length}`); $('mgBar').style.width = Math.round(i / sendList.length * 100) + '%';
      await mgSendChunk(T, dst, sendList.slice(i, i + MG_CHUNK)); mgRender(); $('mgSummary').textContent = mgSummaryText();
    }
    $('mgBar').style.width = '100%';
    const failed = mgLog.filter(e => e.result === 'failed').length, copied = mgLog.filter(e => e.result === 'added' || e.result === 'updated').length;
    mgMsg(failed ? 'Finished with errors.' : 'Transfer complete.', !!failed); mgRender();
    $('mgSummary').textContent = mgSummaryText((S.dups ? ` | ${S.dups} repeated ID(s) in the source` : '') + (S.blank ? ` | ${S.blank} source row(s) without an ID not read` : ''));
    toast(`${name}: ${copied} copied, ${failed} failed, ${mgLog.filter(e => e.result === 'skipped').length} skipped (total ${mgLog.length})`, !!failed);
    if (mgType === 'db' && mgSame(dst)) loadOrders();
  } catch (e) {
    for (const it of sendList) if (!it.entry.result) { it.entry.result = 'failed'; it.entry.reason = 'Not sent: ' + e.message; }     // rows the error cut off
    mgMsg(e.message, true); mgRender(); $('mgSummary').textContent = mgLog.length ? mgSummaryText() : ''; toast('Transfer stopped: ' + e.message, true);
  } finally { mgUi(false); }
}
/* ===== SHEET-TO-SHEET TRANSFER END ===== */

/* ===== DATA SYNC (Supabase <-> billing Google Sheet) START ===== */
let syncBusy = false;
const SYNC_CHUNK = 100;                                   // rows per request (Apps Script accepts up to 500, Supabase function up to 500)
const SYNC_COLS = ['order_id', 'created_at', 'platform', 'customer_name', 'state', 'address', 'invoice_date', 'shipping_date', 'primary_sku', 'secondary_skus', 'payment_type',
  'customer_price', 'cgst', 'sgst', 'igst', 'original_price', 'sale_price', 'credited_price', 'net_profit', 'notes', 'order_status', 'cancel_reason', 'loss_amount', 'invoice_url', 'packing_image_url'];
const syncKey = v => String(v == null ? '' : v).trim().toLowerCase();    // the duplicate-proof key: Order ID ignoring case and spaces
const syncMsg = (t, bad) => { $('syncStatus').textContent = t || ''; $('syncStatus').style.color = bad ? '#ff6b81' : 'var(--mut)'; };
const syncBar = (done, total) => { $('syncBar').style.width = (total ? Math.min(100, Math.round(done / total * 100)) : 0) + '%'; };
function syncUi(on) { syncBusy = on; $('syncBtn1').disabled = on; $('syncBtn2').disabled = on; $('syncSpin').classList.toggle('hidden', !on); }
function syncErr(e) { return e && e.expired ? 'Verification expired. Close this window and verify with the Gmail code again.' : e && e.notSetUp ? 'Sync is not installed in Supabase yet. Run sync.sql in the Supabase SQL Editor first.' : (e && e.message) || 'Unknown error'; }
function syncShow(title, lines, bad) {
  $('syncResult').innerHTML = `<b style="color:${bad ? '#ff6b81' : 'var(--em)'}">${invEsc(title)}</b>` + lines.map(l => '<br>' + invEsc(l)).join('');
}
function sbRowForSheet(r) {                                // a Supabase row -> only the values that really exist
  const o = {};
  for (const c of SYNC_COLS) {
    const v = r[c]; if (v === null || v === undefined || v === '') continue;
    if (c === 'loss_amount' && Number(v) === 0) continue;  // 0 is the database default, so it means "not set"
    o[c] = v;
  }
  return o;
}
async function openSync() { syncMsg('Ready.'); syncBar(0, 0); $('syncResult').innerHTML = ''; openM('syncModal'); syncLoadLast(); }
async function syncLoadLast() {
  const box = $('syncLast'); box.textContent = '';
  try {
    const res = await fetch(`${SUPA.url}/rest/v1/sync_log?select=*&order=id.desc&limit=30`, {headers: supaHeaders()});
    if (!res.ok) return;
    const rows = await res.json(), line = (d, label) => { const r = rows.find(x => x.direction === d); return r ? `${label}: ${new Date(r.created_at).toLocaleString('en-IN')} - ${r.added} added, ${r.updated} updated${r.errors ? ', ' + r.errors + ' error(s)' : ''}` : `${label}: never`; };
    box.innerHTML = invEsc(line('supabase_to_sheet', 'Last Supabase \u2192 Sheets')) + '<br>' + invEsc(line('sheet_to_supabase', 'Last Sheets \u2192 Supabase'));
  } catch (e) {}
}
async function syncLog(direction, tot, total) {
  try { await rpc('sync_log_add', {p_direction: direction, p_total: total, p_added: tot.added, p_updated: tot.updated, p_unchanged: tot.unchanged, p_skipped: tot.skipped, p_errors: tot.errors || 0, p_note: null}); } catch (e) {}
  syncLoadLast();
}

/* Button 1: Supabase -> Google Sheet */
async function syncToSheet() {
  if (syncBusy) return;
  if (!getUrl()) return toast('Connect the billing Google Sheet first (link menu > Database Google Sheet)', true);
  syncUi(true); $('syncResult').innerHTML = '';
  try {
    syncMsg('Reading orders from Supabase...'); syncBar(0, 0);
    const sb = await invFetchAll('invoices?select=*&order=id.asc');
    syncMsg('Reading the Google Sheet...');
    const sheet = accGuard(await api('POST', {action: 'syncRead', token: accToken()}));
    if (!sheet.success) throw new Error(sheet.error || 'Could not read the Google Sheet. Update and redeploy Code.gs first.');
    const have = new Set(sheet.rows.map(r => syncKey(r.order_id))), seen = new Set(), rows = []; let skipped = 0;
    for (const r of sb) { const k = syncKey(r.order_id); if (!k || seen.has(k)) { skipped++; continue; } seen.add(k); rows.push(sbRowForSheet(r)); }
    if (!rows.length) { syncMsg('Supabase has no orders to copy.', true); return toast('Nothing to sync - Supabase has no orders', true); }
    const add = rows.filter(r => !have.has(syncKey(r.order_id))).length, upd = rows.length - add;
    const basic = sb.length && !('customer_name' in sb[0]);
    if (!confirm(`Copy ${rows.length} Supabase order(s) to Google Sheets?\n\n- ${add} new row(s) will be added\n- ${upd} existing row(s) will be checked and updated (only fields that have a value)\n- Nothing is deleted${skipped ? `\n- ${skipped} row(s) without a usable Order ID skipped` : ''}${basic ? '\n\nNote: sync.sql has not been run, so only the basic fields are copied.' : ''}`)) return syncMsg('Cancelled.');
    const tot = {added: 0, updated: 0, unchanged: 0, skipped, errors: 0};
    for (let i = 0; i < rows.length; i += SYNC_CHUNK) {
      syncMsg(`Writing to Google Sheets... ${Math.min(i + SYNC_CHUNK, rows.length)} / ${rows.length}`); syncBar(i, rows.length);
      const r = accGuard(await api('POST', {action: 'syncUpsertRows', token: accToken(), rows: rows.slice(i, i + SYNC_CHUNK)}));
      if (!r.success) throw new Error((r.error || 'The sheet rejected the data') + ` (after ${i} of ${rows.length} rows - safe to run again)`);
      tot.added += r.added || 0; tot.updated += r.updated || 0; tot.unchanged += r.unchanged || 0; tot.skipped += r.skipped || 0;
    }
    syncBar(1, 1); syncMsg('Done.');
    syncShow('Supabase \u2192 Google Sheets complete', [`${tot.added} added, ${tot.updated} updated, ${tot.unchanged} already up to date`, `${rows.length} order(s) processed${tot.skipped ? ', ' + tot.skipped + ' skipped' : ''}`]);
    toast(`Synced ${rows.length} orders to Google Sheets: ${tot.added} added, ${tot.updated} updated`);
    await syncLog('supabase_to_sheet', tot, rows.length); loadOrders();
  } catch (e) { syncMsg(syncErr(e), true); syncShow('Sync failed', [syncErr(e)], true); toast('Sync failed: ' + syncErr(e), true); }
  finally { syncUi(false); }
}

/* Button 2: Google Sheet -> Supabase */
async function syncFromSheet() {
  if (syncBusy) return;
  if (!getUrl()) return toast('Connect the billing Google Sheet first (link menu > Database Google Sheet)', true);
  syncUi(true); $('syncResult').innerHTML = '';
  try {
    syncMsg('Reading the Google Sheet...'); syncBar(0, 0);
    const sheet = accGuard(await api('POST', {action: 'syncRead', token: accToken()}));
    if (!sheet.success) throw new Error(sheet.error || 'Could not read the Google Sheet. Update and redeploy Code.gs first.');
    const rows = sheet.rows || [];
    if (!rows.length) { syncMsg('The sheet has no orders to import.', true); return toast('Nothing to sync - the sheet has no orders', true); }
    syncMsg('Reading orders from Supabase...');
    const known = new Set((await invFetchAll('invoices?select=order_id')).map(r => syncKey(r.order_id)));
    const add = rows.filter(r => !known.has(syncKey(r.order_id))).length, upd = rows.length - add, dup = sheet.duplicates || 0, blank = sheet.skipped || 0;
    if (!confirm(`Import ${rows.length} order(s) from Google Sheets into Supabase?\n\n- ${add} new order(s) will be created\n- ${upd} existing order(s) will be updated (only fields that have a value)\n- Nothing is deleted${dup ? `\n- ${dup} repeated Order ID(s) in the sheet: the newest row is used` : ''}${blank ? `\n- ${blank} sheet row(s) without an Order ID skipped` : ''}\n\nImported orders do not change inventory stock.`)) return syncMsg('Cancelled.');
    const tot = {added: 0, updated: 0, unchanged: 0, skipped: blank, errors: 0}, errs = [];
    for (let i = 0; i < rows.length; i += SYNC_CHUNK) {
      syncMsg(`Writing to Supabase... ${Math.min(i + SYNC_CHUNK, rows.length)} / ${rows.length}`); syncBar(i, rows.length);
      const r = await rpc('sync_upsert_invoices', {p_rows: rows.slice(i, i + SYNC_CHUNK)});
      tot.added += r.inserted || 0; tot.updated += r.updated || 0; tot.unchanged += r.unchanged || 0; tot.skipped += r.skipped || 0; tot.errors += r.errors || 0;
      for (const x of (r.error_list || [])) if (errs.length < 10) errs.push(`${x.order_id}: ${x.error}`);
    }
    syncBar(1, 1); syncMsg(tot.errors ? 'Finished with errors.' : 'Done.', !!tot.errors);
    syncShow(tot.errors ? 'Google Sheets \u2192 Supabase finished with errors' : 'Google Sheets \u2192 Supabase complete',
      [`${tot.added} created, ${tot.updated} updated, ${tot.unchanged} already up to date`, `${rows.length} order(s) processed${tot.skipped ? ', ' + tot.skipped + ' skipped' : ''}`, ...(tot.errors ? [`${tot.errors} row(s) failed:`, ...errs] : [])], !!tot.errors);
    toast(`Synced ${rows.length} orders to Supabase: ${tot.added} created, ${tot.updated} updated${tot.errors ? `, ${tot.errors} error(s)` : ''}`, !!tot.errors);
    await syncLog('sheet_to_supabase', tot, rows.length);
  } catch (e) { syncMsg(syncErr(e), true); syncShow('Sync failed', [syncErr(e)], true); toast('Sync failed: ' + syncErr(e), true); }
  finally { syncUi(false); }
}
/* ===== DATA SYNC END ===== */

/* ============ AMAR: ANALYTICS ENGINE ============ */
const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'], MN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const dOf = o => String(o['Invoice Date'] || o.Timestamp || '').slice(0, 10);
const mOf = o => dOf(o).slice(0, 7);
const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function stats(list) {   // cancelled / returned orders are not sales: they add only their loss to the profit
  const s = {n: list.length, bad: 0, revenue: 0, cost: 0, profit: 0, credited: 0, tax: 0, pending: 0, loss: 0};
  list.forEach(o => {
    s.profit += profitOf(o);
    if (isBadOrder(o)) { s.bad++; s.loss += num(o['Loss Amount']); return; }
    s.revenue += num(o['Sale Price']); s.cost += num(o['Original Price']); s.credited += num(o['Credited Price']); s.tax += num(o.CGST) + num(o.SGST) + num(o.IGST); if (!num(o['Credited Price'])) s.pending++;
  });
  const good = s.n - s.bad; s.margin = s.revenue ? s.profit / s.revenue * 100 : 0; s.roi = s.cost ? s.profit / s.cost * 100 : 0; s.avg = good ? s.profit / good : 0; return s;
}
const group = (list, keyFn) => { const g = {}; list.forEach(o => { const k = keyFn(o) || 'Unknown'; (g[k] = g[k] || []).push(o); }); return g; };
const B = x => `<b>${x}</b>`, tip = x => `<br><i class="tip">Action: ${x}</i>`;

function parseTime(t) {
  const now = new Date(), y = now.getFullYear(); let m;
  if ((m = t.match(/(\d{4})-(\d{2})-(\d{2})/))) return {from: m[0], to: m[0], label: m[0]};
  if ((m = t.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})\b/))) { const d = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; return {from: d, to: d, label: d}; }
  const mre = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  if ((m = t.match(new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + mre + '\\b(?:\\s+(\\d{4}))?')))) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3)), d = `${m[3] || y}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; return {from: d, to: d, label: m[1] + ' ' + MN[mi] + ' ' + (m[3] || y)};
  }
  if ((m = t.match(new RegExp('\\b' + mre + '\\b(?:\\s+(\\d{4}))?'))) && (m[1] !== 'may' || /\b(in|of|for|during)\s+may\b|may\s+\d{4}/.test(t))) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3)), yy = m[2] || y, p = `${yy}-${String(mi + 1).padStart(2, '0')}`; return {from: p + '-01', to: p + '-31', label: MN[mi] + ' ' + yy};
  }
  if (/today/.test(t)) return {from: iso(now), to: iso(now), label: 'today'};
  if (/yesterday/.test(t)) { const d = new Date(now - 864e5); return {from: iso(d), to: iso(d), label: 'yesterday'}; }
  if (/this month/.test(t)) { const p = iso(now).slice(0, 7); return {from: p + '-01', to: p + '-31', label: 'this month'}; }
  if (/last month/.test(t)) { const d = new Date(y, now.getMonth() - 1, 1), p = iso(d).slice(0, 7); return {from: p + '-01', to: p + '-31', label: 'last month'}; }
  if (/this week/.test(t)) return {from: iso(new Date(now - 6 * 864e5)), to: iso(now), label: 'the last 7 days'};
  if ((m = t.match(/last (\d+) days/))) return {from: iso(new Date(now - m[1] * 864e5)), to: iso(now), label: `the last ${m[1]} days`};
  if (/this year/.test(t)) return {from: y + '-01-01', to: y + '-12-31', label: 'this year'};
  return null;
}
const DIMS = [[/platform|marketplace|channel/, 'Platform', 'platform'], [/state|region|location/, 'State', 'state'], [/sku|product|item|design|selling/, 'SKU ID', 'SKU'],
  [/month|trend|timeline/, 'month', 'month'], [/payment|cod\b|prepaid/, 'Payment Type', 'payment type'], [/customer|buyer/, 'Customer Name', 'customer']];
const keyOf = dim => dim === 'month' ? mOf : o => o[dim];
const METRICS = {revenue: ['revenue', 'sales'], profit: ['profit', 'net profit'], margin: ['margin', 'profit margin'], roi: ['ROI', 'ROI'], cost: ['cost', 'cost'], n: ['orders', 'orders'], avg: ['avg profit/order', 'average profit per order'], credited: ['credited', 'credited amount'], tax: ['tax', 'GST collected']};
const fv = (k, v) => k === 'n' ? String(Math.round(v)) : (k === 'margin' || k === 'roi') ? v.toFixed(1) + '%' : money(v);

function detectMetric(t) {
  if (/margin/.test(t)) return 'margin'; if (/\broi\b|return on/.test(t)) return 'roi';
  if (/average|avg|mean|per order/.test(t)) return 'avg';
  if (/profit|earn|made|net|income|loss/.test(t)) return 'profit';
  if (/credited|received|bank|settle/.test(t)) return 'credited';
  if (/cost|spent|invest|purchase price|original/.test(t)) return 'cost';
  if (/\btax|gst/.test(t)) return 'tax';
  if (/best.?sell|how many|count|number of|orders?|units|most popular|demand/.test(t)) return 'n';
  if (/revenue|sales|sale|sold|turnover|business/.test(t)) return 'revenue';
  return null;
}
/* ---- AMAR: your own order data is answered locally (instant, exact); jewellery / styling / general questions go to Gemini through Code.gs, so the API key never reaches the browser ---- */
let amarModel = 'gemini-3.8-flash', amarHistory = [];
const AMAR_DATA_RE = /\b(orders?|profit|loss|sales?|revenue|margin|platforms?|states?|sku|cod|credit(ed)?|pending|reconcil\w*|reports?|charts?|graphs?|download|pdf|excel|xlsx|inventory|stock|customers?|month|today|week|highest|lowest|average|total|amazon|meesho|flipkart)\b|what can you do|^help$|^(hi|hello|hey)\b/i;
const escTxt = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function changeAmarModel(m) { amarModel = m; const i = $('modelIndicator'); if (i) i.textContent = m; toast('AMAR model: ' + m); }
function clearChatHistory() { if (!confirm('Clear AMAR chat?')) return; amarHistory = []; $('chat').innerHTML = ''; greet(); }
function fmtAI(t) {   // Gemini markdown -> the few tags cleanHtml allows (b, i, br)
  let s = escTxt(t);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*(?!\*)/g, '$1<i>$2</i>');
  s = s.replace(/^\s*[-*]\s+/gm, '&bull; ').replace(/^#{1,6}\s*(.+)$/gm, '<b>$1</b>').replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
  return s;
}
function askLocal(text, d, note) {
  let out; try { out = think(text); } catch (e) { out = {html: 'I hit a problem reading that. Try rephrasing the question.'}; }
  d.innerHTML = cleanHtml(out.html + (note ? `<br><i class="tip">${escTxt(note)}</i>` : '')); if (out.chart) out.chart(d); $('chat').scrollTop = 1e6;
}
async function ask(text, ai) {
  text = (text || '').trim(); if (!text) return; say(escTxt(text), true);
  const d = say('<span class="dots"><span></span><span></span><span></span></span>');
  if (!ai && AMAR_DATA_RE.test(text)) { setTimeout(() => askLocal(text, d), 450); return; }
  amarHistory.push({role: 'user', text});
  try {
    const j = await api('POST', {action: 'amarChat', model: amarModel, messages: amarHistory.slice(-10)});
    if (!j || !j.success || !j.text) throw new Error((j && (j.error || j.message)) || 'No answer from Gemini');
    amarHistory.push({role: 'model', text: j.text});
    d.innerHTML = cleanHtml(fmtAI(j.text)); $('chat').scrollTop = 1e6;
  } catch (e) {
    amarHistory.pop(); if (e && e.authExpired) return;
    askLocal(text, d, 'Gemini is not available right now (' + (e.message || 'error') + '), so this answer comes from your order data.');
  }
}
/* AMAR answers mix our own markup with values from your sheet, so every bubble is cleaned: only b, i, br, span and canvas survive, and no attribute except class (and canvas size). */
function cleanHtml(html) {
  const t = document.createElement('template'); t.innerHTML = String(html); const OK = {B: 1, I: 1, BR: 1, SPAN: 1, CANVAS: 1};
  const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType === 1) {
      if (!OK[c.tagName]) { c.replaceWith(document.createTextNode(c.textContent)); return; }
      [...c.attributes].forEach(a => { const ok = (a.name === 'class' && /^[\w\- ]*$/.test(a.value)) || (c.tagName === 'CANVAS' && (a.name === 'height' || a.name === 'style') && /^[\w:;. %-]*$/.test(a.value)); if (!ok) c.removeAttribute(a.name); });
      walk(c);
    } else if (c.nodeType !== 3) c.remove();
  });
  walk(t.content); return t.innerHTML;
}
function say(html, me) { const d = document.createElement('div'); d.className = 'bub ' + (me ? 'me' : 'bot'); d.innerHTML = cleanHtml(html); $('chat').appendChild(d); $('chat').scrollTop = 1e6; return d; }
function intro() {
  return `I'm ${B('AMAR &mdash; SHYNWELL Store &amp; Seller Assistant')}. I work directly on your live order sheet. My core capabilities:<br>&bull; ${B('Account &amp; Inventory Insights')}: sales, profit, SKU demand and restock signals<br>&bull; ${B('Platform Margin Analysis')}: Amazon vs Meesho vs Flipkart<br>&bull; ${B('Reconciliation &amp; Settlement Guidance')}: pending credits and payout follow-ups<br>&bull; ${B('Profit Optimization')}: pricing, COD risk and loss-making orders<br>Ask in plain words, request a chart, or say "PDF report" / "Excel report" for an instant download.`;
}
function greet() { if ($('chat').children.length) return; say(`Hello ARSHAD. ` + intro() + `<br>&bull; ${B('Gemini AI')}: jewellery care, styling and store advice. Tap ${B('Voice')} for a live voice call.`); }

/* ============ AMAR LIVE VOICE (Gemini Live) ============
   The browser asks Code.gs for a one-use, 1-minute token (the real API key stays in Script Properties) and talks to Gemini Live directly. */
const LIVE_MODEL = 'gemini-3.8-live';
const LIVE_PROMPT = 'You are AMAR, the voice assistant for SHYNWELL covering jewellery (founded by Arshad). Speak warmly, elegantly and concisely, in the language the person speaks. Keep each turn to 2-3 sentences. Help with jewellery advice, care of micro-gold plated items and store information.';
let liveWs = null, liveIn = null, liveOut = null, liveProc = null, liveStream = null, liveNext = 0, liveMuted = false, liveSrc = [], liveReady = false, liveTxIn = '', liveTxOut = '', liveBusy = false;
function vStatus(t, c) { const s = $('voiceStatus'), d = $('voiceDot'); if (s) s.textContent = t; if (d) d.style.background = c || 'var(--gd)'; }
function toggleVoiceLive() { if ($('amarVoicePanel').classList.contains('hidden')) startVoiceCall(); else stopVoiceCall(); }
function pcmToB64(f32, inRate) {
  const ratio = inRate / 16000, n = Math.floor(f32.length / ratio), out = new Int16Array(n);
  for (let i = 0; i < n; i++) { const a = Math.floor(i * ratio), b = Math.min(f32.length, Math.floor((i + 1) * ratio)); let s = 0, c = 0; for (let k = a; k < b; k++) { s += f32[k]; c++; } const v = Math.max(-1, Math.min(1, c ? s / c : f32[a] || 0)); out[i] = v < 0 ? v * 0x8000 : v * 0x7fff; }
  const by = new Uint8Array(out.buffer); let bin = ''; for (let i = 0; i < by.length; i += 0x8000) bin += String.fromCharCode.apply(null, by.subarray(i, i + 0x8000)); return btoa(bin);
}
function playPcm(b64) {
  if (!liveOut) return;
  try {
    const bin = atob(b64), by = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) by[i] = bin.charCodeAt(i);
    const i16 = new Int16Array(by.buffer), f = new Float32Array(i16.length); for (let i = 0; i < i16.length; i++) f[i] = i16[i] / (i16[i] < 0 ? 0x8000 : 0x7fff);
    const buf = liveOut.createBuffer(1, f.length, 24000); buf.getChannelData(0).set(f);
    const src = liveOut.createBufferSource(); src.buffer = buf; src.connect(liveOut.destination);
    const now = liveOut.currentTime; if (liveNext < now) liveNext = now + 0.04; src.start(liveNext); liveNext += buf.duration;
    liveSrc.push(src); src.onended = () => { const k = liveSrc.indexOf(src); if (k > -1) liveSrc.splice(k, 1); };
  } catch (e) {}
}
function stopPlayback() { liveSrc.forEach(s => { try { s.stop(); s.disconnect(); } catch (e) {} }); liveSrc = []; if (liveOut) liveNext = liveOut.currentTime; }
function liveCleanup() {
  liveReady = false;
  if (liveProc) { try { liveProc.disconnect(); } catch (e) {} liveProc.onaudioprocess = null; liveProc = null; }
  if (liveStream) { liveStream.getTracks().forEach(t => t.stop()); liveStream = null; }
  [liveIn, liveOut].forEach(c => { if (c && c.state !== 'closed') c.close().catch(() => {}); }); liveIn = liveOut = null; liveSrc = []; liveNext = 0;
}
function stopVoiceCall() {
  const ws = liveWs; liveWs = null; liveBusy = false; if (ws) { ws.onclose = ws.onerror = ws.onmessage = null; try { ws.close(); } catch (e) {} }
  liveCleanup(); const p = $('amarVoicePanel'); if (p) p.classList.add('hidden');
}
async function startVoiceCall() {
  if (liveBusy) return; liveBusy = true;
  const panel = $('amarVoicePanel'), orb = $('voiceOrb'); panel.classList.remove('hidden'); liveTxIn = liveTxOut = ''; $('voiceUserText').textContent = ''; $('voiceModelText').textContent = ''; liveMuted = false; $('voiceMuteTxt').textContent = 'Mute'; $('voiceMuteBtn').style.color = ''; vStatus('Connecting...');
  try {
    const AC = window.AudioContext || window.webkitAudioContext;   // created inside the tap so iPhones allow audio
    liveIn = new AC(); liveOut = new AC(); await Promise.all([liveIn.resume(), liveOut.resume()]);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser has no microphone access');
    liveStream = await navigator.mediaDevices.getUserMedia({audio: {channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true}});
    vStatus('Getting secure token...');
    const j = await api('POST', {action: 'amarLiveToken'});
    if (!j || !j.success || !j.token) throw new Error((j && (j.error || j.message)) || 'Could not get a voice token');
    if (!liveBusy) return;   // user ended the call meanwhile
    const ws = new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=' + encodeURIComponent(j.token));
    liveWs = ws;
    ws.onopen = () => { vStatus('Setting up live session...'); ws.send(JSON.stringify({setup: {model: 'models/' + LIVE_MODEL, generationConfig: {responseModalities: ['AUDIO'], speechConfig: {voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Zephyr'}}}}, systemInstruction: {parts: [{text: LIVE_PROMPT}]}, inputAudioTranscription: {}, outputAudioTranscription: {}}})); };
    ws.onmessage = async ev => {
      let msg; try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : await ev.data.text()); } catch (e) { return; }
      if (ws !== liveWs) return;
      if (msg.setupComplete) { liveReady = true; vStatus('Live. Speak now', 'var(--em)'); $('voiceModelText').textContent = 'Listening...'; }
      const sc = msg.serverContent; if (!sc) return;
      ((sc.modelTurn && sc.modelTurn.parts) || []).forEach(p => { if (p.inlineData && p.inlineData.data) { vStatus('AMAR speaking...', 'var(--cy)'); orb.classList.add('float'); playPcm(p.inlineData.data); } });
      if (sc.inputTranscription && sc.inputTranscription.text) { liveTxIn += sc.inputTranscription.text; $('voiceUserText').textContent = 'You: ' + liveTxIn; }
      if (sc.outputTranscription && sc.outputTranscription.text) { liveTxOut += sc.outputTranscription.text; $('voiceModelText').textContent = 'AMAR: ' + liveTxOut; }
      if (sc.interrupted) { stopPlayback(); vStatus('Listening...', 'var(--em)'); }
      if (sc.turnComplete) { liveTxIn = liveTxOut = ''; orb.classList.remove('float'); vStatus('Live. Speak now', 'var(--em)'); }
    };
    ws.onerror = () => { if (ws === liveWs) vStatus('Connection failed', '#ff6b81'); };
    ws.onclose = ev => { if (ws !== liveWs) return; liveWs = null; liveBusy = false; liveCleanup(); orb.classList.remove('float'); vStatus(ev && ev.reason ? 'Call ended: ' + ev.reason.slice(0, 60) : 'Call ended', 'var(--mut)'); };
    const src = liveIn.createMediaStreamSource(liveStream), rate = liveIn.sampleRate;
    liveProc = liveIn.createScriptProcessor(4096, 1, 1); src.connect(liveProc); liveProc.connect(liveIn.destination);
    liveProc.onaudioprocess = e => { if (!liveReady || liveMuted || !liveWs || liveWs.readyState !== 1) return; liveWs.send(JSON.stringify({realtimeInput: {audio: {data: pcmToB64(e.inputBuffer.getChannelData(0), rate), mimeType: 'audio/pcm;rate=16000'}}})); };
  } catch (err) {
    liveBusy = false; liveCleanup(); if (err && err.authExpired) return;
    vStatus((err && err.name === 'NotAllowedError') ? 'Microphone permission denied' : 'Voice error: ' + ((err && err.message) || 'failed').slice(0, 70), '#ff6b81');
  }
}
function toggleVoiceMute() { liveMuted = !liveMuted; $('voiceMuteTxt').textContent = liveMuted ? 'Unmute' : 'Mute'; $('voiceMuteBtn').style.color = liveMuted ? '#ff6b81' : ''; }

function think(text) {
  const t = text.toLowerCase().replace(/[?!,]/g, ' '), all = orders;
  if (/^(hi|hello|hey|namaste|salaam)\b/.test(t) && t.length < 20) return {html: 'Hello ARSHAD. What would you like to know about SHYNWELL today?'};
  if (/\b(thanks|thank you|shukriya)\b/.test(t)) return {html: 'Always happy to help. I am here whenever you need numbers.'};
  if (/who are you|your name|what can you do|capabilit|introduce|what do you do|^help$/.test(t)) return {html: intro()};
  if (/download|export|excel|xlsx|spreadsheet|pdf|report/.test(t) && !/chart|graph|margin|platform/.test(t)) {
    const x = /excel|xlsx|spreadsheet/.test(t), p = /pdf/.test(t) || !x;
    if (x) exportXlsx(); if (p) exportPdf();
    return {html: `Preparing your ${x && p ? 'Excel and PDF' : x ? 'Excel' : 'PDF'} report now, covering ${B(orders.length + ' orders')}.`};
  }
  if (!all.length) return {html: 'There are no orders yet. Add your first order and I can start analysing.'};

  // ---- filters ----
  let list = all, filt = [];
  const tr = parseTime(t); if (tr) { list = list.filter(o => dOf(o) >= tr.from && dOf(o) <= tr.to); filt.push(tr.label); }
  const uniq = k => [...new Set(all.map(o => String(o[k] || '')).filter(Boolean))].sort((a, b) => b.length - a.length);
  const hit = (k, minLen = 2) => uniq(k).filter(v => v.length >= minLen && new RegExp('(^|[^a-z0-9])' + v.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(t));
  const plats = hit('Platform'), states = hit('State'), skus = hit('SKU ID', 3);
  const cmp = plats.length > 1 || /\bvs\b|versus|compare|comparison/.test(t);
  if (plats.length) { list = list.filter(o => plats.includes(o.Platform)); filt.push(plats.join(' & ')); }
  if (states.length) { list = list.filter(o => states.includes(o.State)); filt.push(states.join(' & ')); }
  if (skus.length) { list = list.filter(o => skus.includes(o['SKU ID'])); filt.push('SKU ' + skus.join(', ')); }
  if (/\bcod\b/.test(t) && !/fail|rto|return|cancel/.test(t)) { list = list.filter(o => o['Payment Type'] === 'COD'); filt.push('COD'); }
  if (/prepaid/.test(t)) { list = list.filter(o => o['Payment Type'] === 'Prepaid'); filt.push('Prepaid'); }
  const where = filt.length ? ' for ' + filt.join(', ') : '';
  if (!list.length) return {html: `I found no orders${where}. Try a different date, state or platform.`};

  // ---- special intents ----
  if (/fail|rto|return|cancel/.test(t) && /cod|rate|rto|return|cancel|fail/.test(t)) {
    const base = list.filter(o => o['Payment Type'] === 'COD'), bad = base.filter(o => isBadOrder(o) || /rto|return|cancel|fail|refus/i.test(o.Notes || ''));
    if (!base.length) return {html: `No COD orders${where}.`};
    const rate = bad.length / base.length * 100, pend = base.filter(o => !num(o['Credited Price'])).length;
    return {html: `Among ${B(base.length + ' COD orders')}${where}, ${B(bad.length)} are cancelled / returned (order status or notes): a ${B(rate.toFixed(1) + '%')} failure rate. ${B(pend)} COD orders still have no credited amount.` + tip(rate > 15 ? 'COD failure is high. Confirm COD orders by phone/WhatsApp before dispatch and push prepaid with a small discount.' : 'COD risk looks healthy. Keep adding "RTO" or "Returned" in Notes so I can track failures accurately.')};
  }
  if (/\bhow\b.*(reconcil|settle)|settlement guide|reconciliation guide|what is reconciliation/.test(t)) return {html: guide(list)};
  if (/pending|not credited|uncredited|unsettled|reconcil|outstanding|settlement/.test(t)) {
    const p = list.filter(o => !isBadOrder(o) && !num(o['Credited Price'])), val = p.reduce((s, o) => s + num(o['Sale Price']), 0);
    if (!p.length) return {html: `Every order${where} is reconciled. No pending credits.`};
    const pg = Object.entries(group(p, o => o.Platform)).map(([k, v]) => `${k}: ${B(v.length)} (${money(v.reduce((s, o) => s + num(o['Sale Price']), 0))})`).join(' | ');
    const oldest = [...p].sort((a, b) => dOf(a).localeCompare(dOf(b))).slice(0, 5).map(o => `${o['Order ID']} (${dOf(o)}, ${o.Platform})`).join('<br>');
    return {html: `${B(p.length)} of ${list.length} orders${where} (${B((p.length / list.length * 100).toFixed(0) + '%')}) await credited-price reconciliation, about ${B(money(val))} in sales.<br>${pg}<br>Oldest pending:<br>${oldest}` + tip('Match these against each marketplace settlement report, then enter the credited amount in Order Lookup. Chase anything older than the platform payout window.')};
  }
  if (/loss|losing|negative/.test(t)) {
    const l = list.filter(o => profitOf(o) < 0).sort((a, b) => profitOf(a) - profitOf(b));
    return {html: l.length ? `${B(l.length)} order(s)${where} are at a loss, totalling ${B(money(l.reduce((s, o) => s + profitOf(o), 0)))}. Worst: ${l.slice(0, 3).map(o => `${o['Order ID']} (${money(profitOf(o))}, ${o.Platform})`).join('; ')}.` + tip('Check pricing and platform fees on these SKUs.') : `No loss-making orders${where}. Every order is in profit.`};
  }
  const wantsChart = /chart|graph|pie|plot|visual|share|breakdown|trend|distribution/.test(t);
  const dimHit = DIMS.find(d => d[0].test(t)) || null;
  let metric = detectMetric(t);
  if (/margin analysis|platform (margin|comparison|performance|report|wise)|compare (all )?platforms/.test(t) && !wantsChart) return platformReport(list, where);
  if (/inventory|stock|reorder|restock|sku (performance|insight)|slow.?moving/.test(t)) return inventoryReport(list, where);

  if (/summary|overview|insight|\bhow\b.*(business|doing|going)|status|snapshot|advice|suggest/.test(t) && !wantsChart && !dimHit) return overview(list, where);

  // ---- chart ----
  if (wantsChart) {
    const dim = dimHit ? dimHit[1] : 'Platform', m = metric && metric !== 'n' ? metric : (/share|split|distribution/.test(t) ? 'revenue' : (/profit/.test(t) ? 'profit' : 'revenue'));
    return makeChart(list, dim, m, /share|pie|distribution|split/.test(t) && dim !== 'month', where);
  }

  // ---- grouped / ranking / comparison ----
  const rank = /highest|top|best|most|lowest|least|worst|weakest|rank|which|biggest|max|min/.test(t), grouped = /\b(by|per|each|wise|across)\b/.test(t);
  if (dimHit && (rank || grouped || cmp) || (cmp && plats.length > 1)) {
    const dim = dimHit ? dimHit[1] : 'Platform', label = dimHit ? dimHit[2] : 'platform';
    if (!metric) metric = /selling|demand|popular/.test(t) ? 'n' : 'profit';
    const g = group(list, keyOf(dim)), rows = Object.entries(g).map(([k, v]) => ({k, s: stats(v)}));
    const low = /lowest|least|worst|weakest|min/.test(t), key = metric;
    rows.sort((a, b) => dim === 'month' && !rank ? a.k.localeCompare(b.k) : low ? a.s[key] - b.s[key] : b.s[key] - a.s[key]);
    const top = rows[0], more = rows.slice(0, 6).map(r => `${r.k}: ${B(fv(key, r.s[key]))} (${r.s.n} orders, margin ${r.s.margin.toFixed(1)}%, uncredited ${(r.s.pending / r.s.n * 100).toFixed(0)}%)`).join('<br>');
    let a = `${low ? 'Lowest' : 'Top'} ${label}${where}: ${B(top.k)} with ${B(fv(key, top.s[key]))} ${METRICS[key][1]}.<br>${more}`;
    if (cmp && rows.length > 1) { const best = [...rows].sort((x, y) => y.s.margin - x.s.margin)[0]; a += tip(`${best.k} earns the best margin (${best.s.margin.toFixed(1)}%). Push more stock and ads there. ` + sellerTips(list).join(' ')); }
    else if (dim === 'State') a += tip(`Run targeted ads and faster delivery in ${top.k}; check COD returns in the lowest states before spending.`);
    else if (dim === 'SKU ID') a += tip(`Keep ${top.k} well stocked and bundle it with slower SKUs.`);
    else { const st = sellerTips(list); a += tip(st.length ? st.join(' ') : `Double down on ${top.k}; review fees on the lower channels.`); }
    return {html: a};
  }

  // ---- single metric ----
  if (metric) {
    const s = stats(list); let a;
    if (metric === 'n') a = `${B(s.n + ' orders')}${where}, worth ${B(money(s.revenue))} in sales.`;
    else a = `${METRICS[metric][1][0].toUpperCase() + METRICS[metric][1].slice(1)}${where}: ${B(fv(metric, s[metric]))} across ${s.n} orders.`;
    a += `<br>Profit ${B(money(s.profit))} | margin ${B(s.margin.toFixed(1) + '%')} | ROI ${B(s.roi.toFixed(1) + '%')}`;
    if (s.pending) a += tip(`${s.pending} order(s) still have no credited amount. Reconcile them for exact profit.`);
    else if (s.margin < 15) a += tip('Margin is thin. Revisit cost price or raise the sale price on low-margin SKUs.');
    { const st = sellerTips(list); if (!/Action:/.test(a) && st.length) a += tip(st.join(' ')); }
    return {html: a};
  }
  // specific order / customer lookup by words
  const idHit = all.find(o => t.includes(String(o['Order ID']).toLowerCase()) || (String(o['Customer Name']).length > 3 && t.includes(String(o['Customer Name']).toLowerCase())));
  if (idHit) { const o = idHit; return {html: `Order ${B(o['Order ID'])}: ${o['Customer Name']}, ${o.State}, ${o.Platform} (${o['Payment Type']}), SKU ${o['SKU ID']}.<br>Sale ${money(o['Sale Price'])} | Cost ${money(o['Original Price'])} | Credited ${money(o['Credited Price'])} | Profit ${B(money(profitOf(o)))}.`}; }
  if (filt.length) { const s = stats(list); return {html: `${B(s.n + ' orders')}${where}: sales ${B(money(s.revenue))}, profit ${B(money(s.profit))}, margin ${B(s.margin.toFixed(1) + '%')}.`}; }
  return overview(all, '');
}
function guide(list) {
  const p = list.filter(o => !isBadOrder(o) && !num(o['Credited Price'])).length;
  return `${B('Reconciliation &amp; settlement guide')}:<br>1. Download the settlement/payment report from Amazon Seller Central, the Meesho supplier panel or Flipkart Seller Hub.<br>2. Match each Order ID to the amount actually credited to your bank.<br>3. Enter it as Credited Price in Order Lookup. ${B('Net Profit = Credited - Original Price')}.<br>4. Investigate gaps: returns, RTO, commission or shipping deductions.<br>You currently have ${B(p)} order(s) awaiting this.`;
}
function sellerTips(list) {
  const tips = [];
  Object.entries(group(list, o => o.Platform)).forEach(([k, v]) => {
    const s = stats(v), unc = v.length ? s.pending / v.length * 100 : 0, loss = v.filter(o => profitOf(o) < 0).length;
    if (v.length >= 3 && unc >= 25) tips.push(`Your uncredited rate on ${k} is ${unc.toFixed(0)}%. Follow up on settlements and check for returns or deductions.`);
    if (v.length >= 3 && s.margin < 12) tips.push(`${k} margin is only ${s.margin.toFixed(1)}%. Consider revising customer pricing or SKU packing costs.`);
    if (loss) tips.push(`${loss} loss-making ${k} order(s). Review fees and cost price.`);
  });
  return tips.slice(0, 3);
}
function platformReport(list, where) {
  const rows = Object.entries(group(list, o => o.Platform)).map(([k, v]) => ({k, s: stats(v)})).sort((a, b) => b.s.margin - a.s.margin);
  const lines = rows.map(r => `${B(r.k)}: ${r.s.n} orders | sales ${money(r.s.revenue)} | profit ${money(r.s.profit)} | margin ${r.s.margin.toFixed(1)}% | avg/order ${money(r.s.avg)} | uncredited ${(r.s.pending / r.s.n * 100).toFixed(0)}%`).join('<br>');
  const tp = sellerTips(list);
  return {html: `Platform margin analysis${where}:<br>${lines}` + tip(tp.length ? tp.join(' ') : `${rows[0].k} gives the best margin. Shift ad spend and stock there.`)};
}
function inventoryReport(list, where) {
  const from = iso(new Date(Date.now() - 30 * 864e5));
  const rows = Object.entries(group(list, o => o['SKU ID'])).map(([k, v]) => ({k, n: v.length, r30: v.filter(o => dOf(o) >= from).length, p: stats(v).profit})).sort((a, b) => b.r30 - a.r30 || b.n - a.n);
  const slow = rows.filter(r => r.r30 === 0).slice(0, 4).map(r => r.k);
  return {html: `SKU demand${where} (I only see order velocity, not stock counts):<br>${rows.slice(0, 6).map(r => `${B(r.k)}: ${r.n} orders (${r.r30} in last 30 days), profit ${money(r.p)}`).join('<br>')}` +
    tip(`Keep ${rows[0].k} well stocked and reorder early.${slow.length ? ' No sales in 30 days for ' + slow.join(', ') + ': consider a discount or bundle.' : ''}`)};
}
function overview(list, where) {
  const s = stats(list), pg = Object.entries(group(list, o => o.Platform)).map(([k, v]) => ({k, s: stats(v)})).sort((a, b) => b.s.profit - a.s.profit);
  const sg = Object.entries(group(list, o => o.State)).map(([k, v]) => ({k, s: stats(v)})).sort((a, b) => b.s.n - a.s.n);
  const kg = Object.entries(group(list, o => o['SKU ID'])).map(([k, v]) => ({k, n: v.length})).sort((a, b) => b.n - a.n);
  const cod = list.filter(o => o['Payment Type'] === 'COD').length / list.length * 100;
  let a = `Business snapshot${where}:<br>${B(s.n)} orders | sales ${B(money(s.revenue))} | profit ${B(money(s.profit))} | margin ${B(s.margin.toFixed(1) + '%')}<br>Best platform: ${B(pg[0].k)} (${money(pg[0].s.profit)} profit). Top state by orders: ${B(sg[0].k)}. Best-selling SKU: ${B(kg[0].k)} (${kg[0].n} orders). COD share: ${B(cod.toFixed(0) + '%')}.`;
  const tips = []; if (s.pending) tips.push(`reconcile ${s.pending} order(s) with no credited amount`); if (cod > 60) tips.push('COD share is high, so push prepaid offers to cut RTO risk'); if (s.margin < 15) tips.push('margin is thin, so review cost prices'); if (pg.length > 1) tips.push(`shift ad budget toward ${pg[0].k}`);
  sellerTips(list).forEach(x => tips.push(x.replace(/\.$/, ''))); return {html: a + (tips.length ? tip(tips.slice(0, 4).join('; ') + '.') : '')};
}
function makeChart(list, dim, metric, pie, where) {
  const g = group(list, keyOf(dim)), rows = Object.entries(g).map(([k, v]) => ({k, v: stats(v)[metric]})).sort((a, b) => dim === 'month' ? a.k.localeCompare(b.k) : b.v - a.v).slice(0, dim === 'month' ? 24 : 10);
  const title = `${METRICS[metric][1][0].toUpperCase() + METRICS[metric][1].slice(1)} by ${dim === 'month' ? 'month' : dim.toLowerCase()}${where}`;
  const pal = ['#00ff88', '#00e5ff', '#ffb703', '#a855f7', '#ff6b81', '#5eead4', '#f472b6', '#facc15', '#60a5fa', '#34d399'];
  return {html: `${B(title)}<canvas style="margin-top:8px" height="${pie ? 220 : 200}"></canvas>`, chart: async d => {
    if (!await ensure(() => window.Chart, ['https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'])) { d.insertAdjacentHTML('beforeend', '<br>The chart library could not load. Check your internet.'); return; }
    while (charts.length >= 6) { try { charts.shift().destroy(); } catch (e) {} }   // old charts are released
    const type = pie ? 'doughnut' : dim === 'month' ? 'line' : 'bar', labels = rows.map(r => r.k), data = rows.map(r => +r.v.toFixed(2));
    charts.push(new Chart(d.querySelector('canvas'), {type, data: {labels, datasets: [{label: title, data, backgroundColor: pie || type === 'bar' ? pal : 'rgba(0,255,136,.2)', borderColor: type === 'line' ? '#00ff88' : '#0a0a0f', borderWidth: type === 'line' ? 2 : 1, fill: type === 'line', tension: .35}]},
      options: {responsive: true, plugins: {legend: {display: pie, labels: {color: '#e8ecf4'}}}, scales: pie ? {} : {x: {ticks: {color: '#8a93a6'}, grid: {display: false}}, y: {ticks: {color: '#8a93a6'}, grid: {color: 'rgba(255,255,255,.07)'}}}}}));
  }};
}
function toggleAmar() { $('drawer').classList.toggle('open'); if ($('drawer').classList.contains('open')) { loadOrders(); greet(); } else stopVoiceCall(); }

/* ============ EXPORTS (with CDN fallbacks) ============ */
async function ensure(test, srcs) { if (test()) return true; for (const s of srcs) { try { await loadScript(s); if (test()) return true; } catch (e) {} } return false; }
const COLS = ['Timestamp', 'Order ID', 'Platform', 'Customer Name', 'State', 'Full Address', 'Invoice Date', 'Shipping Date', 'SKU ID', 'Secondary SKU IDs', 'Payment Type', 'Customer Price', 'CGST', 'SGST', 'IGST', 'Original Price', 'Sale Price', 'Credited Price', 'Net Profit', 'Order Status', 'Cancel Reason', 'Loss Amount', 'Notes', 'Invoice URL', 'Packing Image URL'];
const NUMC = ['Customer Price', 'CGST', 'SGST', 'IGST', 'Original Price', 'Sale Price', 'Credited Price', 'Net Profit', 'Loss Amount'];
async function exportXlsx() {
  if (!orders.length) return toast('No orders to export yet', true);
  if (!await ensure(() => window.XLSX, ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'])) return toast('Excel library failed to load. Check internet.', true);
  const L = c => XLSX.utils.encode_col(COLS.indexOf(c)), n = orders.length, last = n + 1, s = stats(orders);
  const rows = [COLS, ...orders.map(o => COLS.map(c => c === 'Net Profit' ? profitOf(o) : NUMC.includes(c) ? num(o[c]) : (o[c] == null ? '' : o[c])))];
  const ws = XLSX.utils.aoa_to_sheet(rows), tr = n + 3;
  const put = (r, c, v) => ws[XLSX.utils.encode_cell({r, c})] = v;
  put(tr - 1, 0, {t: 's', v: 'Total Revenue (Sale Price, cancelled / returned excluded)'}); put(tr - 1, 1, {t: 'n', f: `SUMPRODUCT((${L('Order Status')}2:${L('Order Status')}${last}="")*${L('Sale Price')}2:${L('Sale Price')}${last})`, v: s.revenue});
  put(tr, 0, {t: 's', v: 'Total Cost (Original Price)'}); put(tr, 1, {t: 'n', f: `SUMPRODUCT((${L('Order Status')}2:${L('Order Status')}${last}="")*${L('Original Price')}2:${L('Original Price')}${last})`, v: s.cost});
  put(tr + 1, 0, {t: 's', v: 'Total Net Profit'}); put(tr + 1, 1, {t: 'n', f: `SUM(${L('Net Profit')}2:${L('Net Profit')}${last})`, v: s.profit});
  ws['!ref'] = XLSX.utils.encode_range({r: 0, c: 0}, {r: tr + 1, c: COLS.length - 1});
  ws['!cols'] = COLS.map(c => ({wch: /URL|Address|Notes/.test(c) ? 34 : c === 'Customer Name' ? 22 : 15})); ws['!freeze'] = {xSplit: 0, ySplit: 1};
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  const sm = XLSX.utils.aoa_to_sheet([['SHYNWELL JEWELLERY - SALES REPORT'], ['Owner: ARSHAD'], [], ['Metric', 'Value'],
    ['Total Orders', {t: 'n', f: `COUNTA(Orders!B2:B${last})`, v: n}], ['Total Revenue', {t: 'n', f: `SUMPRODUCT((Orders!${L('Order Status')}2:${L('Order Status')}${last}="")*Orders!${L('Sale Price')}2:${L('Sale Price')}${last})`, v: s.revenue}],
    ['Total Cost', {t: 'n', f: `SUMPRODUCT((Orders!${L('Order Status')}2:${L('Order Status')}${last}="")*Orders!${L('Original Price')}2:${L('Original Price')}${last})`, v: s.cost}], ['Total Net Profit', {t: 'n', f: `SUM(Orders!${L('Net Profit')}2:${L('Net Profit')}${last})`, v: s.profit}]]);
  sm['!cols'] = [{wch: 28}, {wch: 20}]; XLSX.utils.book_append_sheet(wb, sm, 'Summary');
  XLSX.writeFile(wb, 'SHYNWELL_Report_' + iso(new Date()) + '.xlsx'); toast('Excel report downloaded');
}
async function exportPdf() {
  if (!orders.length) return toast('No orders to export yet', true);
  const ok = await ensure(() => window.jspdf, ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js']) &&
    await ensure(() => window.jspdf && new window.jspdf.jsPDF().autoTable, ['https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', 'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js']);
  if (!ok) return toast('PDF library failed to load. Check internet.', true);
  const doc = new window.jspdf.jsPDF({orientation: 'landscape', unit: 'pt', format: 'a4'}), W = doc.internal.pageSize.getWidth(), s = stats(orders), r = n => 'Rs ' + n.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  doc.setFillColor(10, 10, 15); doc.rect(0, 0, W, 78, 'F'); doc.setFillColor(255, 183, 3); doc.rect(0, 78, W, 3, 'F');
  doc.setTextColor(255, 183, 3); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text('SHYNWELL JEWELLERY - EXECUTIVE SALES REPORT', 36, 38);
  doc.setTextColor(0, 255, 136); doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.text('Generated for: Owner: ARSHAD   |   ' + new Date().toLocaleDateString('en-IN'), 36, 60);
  const cards = [['Total Orders', String(s.n), [0, 168, 90]], ['Total Revenue', r(s.revenue), [0, 150, 190]], ['Net Profit', r(s.profit), [214, 140, 0]]], cw = (W - 72 - 24) / 3;
  cards.forEach((c, i) => { const x = 36 + i * (cw + 12); doc.setFillColor(...c[2]); doc.roundedRect(x, 98, cw, 56, 8, 8, 'F'); doc.setTextColor(255); doc.setFontSize(10); doc.text(c[0], x + 14, 118); doc.setFontSize(17); doc.setFont('helvetica', 'bold'); doc.text(c[1], x + 14, 142); doc.setFont('helvetica', 'normal'); });
  const head = ['Date', 'Order ID', 'Platform', 'Customer', 'State', 'SKU', 'Pay', 'Cost', 'Sale', 'Credited', 'Net Profit', 'Status'];
  doc.autoTable({startY: 172, head: [head], theme: 'striped', margin: {left: 36, right: 36},
    body: orders.map(o => [dOf(o), o['Order ID'], o.Platform, o['Customer Name'], o.State, o['SKU ID'], o['Payment Type'], num(o['Original Price']).toFixed(2), num(o['Sale Price']).toFixed(2), num(o['Credited Price']).toFixed(2), profitOf(o).toFixed(2), o['Order Status'] || '-']),
    styles: {fontSize: 8, cellPadding: 4}, headStyles: {fillColor: [10, 10, 15], textColor: [255, 183, 3]}, alternateRowStyles: {fillColor: [236, 248, 242]},
    columnStyles: {7: {halign: 'right'}, 8: {halign: 'right'}, 9: {halign: 'right'}, 10: {halign: 'right', fontStyle: 'bold'}},
    didDrawPage: d => { doc.setFontSize(8); doc.setTextColor(120); doc.text('SHYNWELL - Premium Covering Jewellery | Page ' + doc.internal.getNumberOfPages(), 36, doc.internal.pageSize.getHeight() - 16); }});
  doc.save('SHYNWELL_Report_' + iso(new Date()) + '.pdf'); toast('PDF report downloaded');
}

/* Resume a signed-in tab (page refresh). Must be the LAST statement: enter() uses helpers that are declared further down this script. */
handleCopyHash(); resumeSession();
