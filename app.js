/* あしあと帳 — app.js（SPA） v1.1.0 */
(() => {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const VERSION = CFG.VERSION || 'v1.1.0';
  const APP_NAME = CFG.APP_NAME || 'あしあと帳';
  const LS = { token: 'ashiato.token', user: 'ashiato.user', gas: 'ashiato.gasUrl', queue: 'ashiato.queue' };

  const DEFAULT_CATS = [
    { label: 'おもしろ発見', emoji: '🤩' },
    { label: '仕事', emoji: '💼' }, { label: '散歩', emoji: '🚶' }, { label: '食事', emoji: '🍙' },
    { label: 'カフェ', emoji: '☕' }, { label: '買い物', emoji: '🛍️' }, { label: '運動', emoji: '🏃' },
    { label: '趣味', emoji: '🎨' }, { label: '人と会う', emoji: '🤝' }, { label: '移動', emoji: '🚃' },
    { label: '家のこと', emoji: '🏠' }, { label: '学び', emoji: '📚' }, { label: 'ひと休み', emoji: '🌿' }
  ];
  const MOODS = [{ v: '気分：晴れ', t: '☀️ 晴れ' }, { v: '気分：くもり', t: '⛅ くもり' }, { v: '気分：雨', t: '☔ 雨' }];
  const WITHS = ['ひとりで', '家族と', '友だちと', '仕事仲間と'];
  const PERIODS = [
    { id: '1w', label: '1週間', days: 7 }, { id: '1m', label: '1か月', days: 30 }, { id: '3m', label: '四半期', days: 91 },
    { id: '1y', label: '1年', days: 365 }, { id: '2y', label: '2年', days: 730 }, { id: '3y', label: '3年', days: 1095 }
  ];
  const MEDIA_ICON = { photo: '📷', video: '🎥', audio: '🎙', drawing: '✏️', url: '🔗' };
  const MEDIA_NAME = { photo: '写真', video: '動画', audio: '声メモ', drawing: '絵', url: 'URL' };
  const FUN_FILTERS = [
    { id: 'all', label: 'すべて' }, { id: 'fun', label: '★ おもしろ' }, { id: 'photo', label: '📷 写真' }, { id: 'video', label: '🎥 動画' },
    { id: 'audio', label: '🎙 声' }, { id: 'drawing', label: '✏️ 絵' }, { id: 'url', label: '🔗 URL' }, { id: 'capsule', label: '🔒 カプセル' }
  ];
  const MAX_MEDIA = 6;
  const DIRECT_MAX = 5 * 1024 * 1024;   // これ以下はGAS経由（base64）で送る
  const VIDEO_MAX = 100 * 1024 * 1024;  // 動画の上限（GAS Config の maxUploadMB と合わせる）
  const PALETTE = ['#2E6B5E', '#E3A72F', '#4C7A9F', '#B8432F', '#8A6FB0', '#5E9E6E', '#C97B3C', '#3E8E9E', '#9C6B57', '#6F7F3A', '#C2577C', '#7A8A8E'];
  const DRAW_COLORS = ['#1E2B33', '#2E6B5E', '#3E6FB0', '#E3A72F', '#B8432F', '#C2577C', '#7A5230'];
  const DRAW_SIZES = [3, 7, 14];
  const WD = ['日', '月', '火', '水', '木', '金', '土'];

  const EYE = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const state = {
    token: lsGet(LS.token),
    user: null,
    cats: [],
    gps: { status: 'idle' },
    attach: [],
    fun: 0,
    tags: new Set(),
    saving: false,
    tab: 'record',
    period: '1w',
    charts: {},
    historyDays: 30,
    logIndex: {},
    mediaCache: {},
    reports: [],
    audioUrl: null,
    editing: null,
    editFun: 0,
    detailId: null,
    funType: 'all',
    funOffset: 0,
    capsules: [],
    pendingShare: null,
    guideStep: 0,
    guideFirst: false
  };

  /* ================= ユーティリティ ================= */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }
  function safeJson(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2], 12); }
  function fmtDay(s, withYear) {
    const d = parseYmd(s);
    return (withYear ? d.getFullYear() + '年' : '') + (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WD[d.getDay()] + '）';
  }
  function fmtShort(s) { const d = parseYmd(s); return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate(); }
  function fmtTime(iso) { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fmtDur(sec) { sec = Math.round(sec || 0); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
  function fmtSize(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'; }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function haversineKm(a, b, c, d) {
    const R = 6371, r = Math.PI / 180, dl = (c - a) * r, dg = (d - b) * r;
    const x = Math.sin(dl / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dg / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  function catEmoji(label) { const c = state.cats.find(x => x.label === label); return c ? c.emoji : '📍'; }
  function starsText(n) { return n ? '★'.repeat(n) : ''; }
  function blobToDataUrl(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('ファイルを読み込めませんでした')); r.readAsDataURL(blob); });
  }
  function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return url; } }

  function toast(msg, type) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (type === 'err' ? ' err' : '');
    t.hidden = false;
    clearTimeout(toast.tm);
    toast.tm = setTimeout(() => { t.hidden = true; }, type === 'err' ? 5000 : 2800);
  }
  function loading(on, msg) {
    $('#loading-text').textContent = msg || '読み込み中…';
    $('#loading').hidden = !on;
  }
  async function withLoading(msg, fn) {
    loading(true, msg);
    try { return await fn(); } finally { loading(false); }
  }
  function setMsg(form, msg, type) {
    const el = $('.form-msg', form);
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'form-msg' + (type ? ' ' + type : '');
  }

  /* ================= API ================= */
  function getGasUrl() {
    const u = (lsGet(LS.gas) || CFG.GAS_URL || '').trim();
    return /XXXX/.test(u) ? '' : u;
  }

  async function api(action, data, opts) {
    data = data || {}; opts = opts || {};
    const url = getGasUrl();
    if (!url) throw new Error('サーバー（GAS）のURLが未設定です。「接続設定」から入力してください。');
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({}, data, { action: action, token: state.token || '' }))
      });
    } catch (e) {
      const err = new Error('サーバーにつながりません。電波の状態を確かめてください。');
      err.network = true;
      throw err;
    }
    let json;
    try { json = await res.json(); } catch (e) {
      throw new Error('サーバーの応答を読み取れません。GAS URL とデプロイ設定（アクセス：全員）を確かめてください。');
    }
    if (!json.ok) {
      if (json.code === 'AUTH' && !opts.noAuthRedirect) { clearSession(); showAuth(); }
      const err = new Error(json.error || 'エラーが起きました。');
      err.code = json.code;
      throw err;
    }
    return json;
  }

  /** 大きな動画・音声：GASで作ったアップロード先へ、ブラウザからGoogleドライブに直接送る */
  async function uploadResumable(blob, mime, onLoaded) {
    const s = await api('startUpload', { mimeType: mime, size: blob.size, origin: location.origin });
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', s.uploadUrl);
      xhr.upload.onprogress = e => { if (e.lengthComputable) onLoaded(e.loaded); };
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try { resolve(JSON.parse(xhr.responseText).id); } catch (e) { reject(new Error('アップロード結果を読み取れませんでした')); }
        } else reject(new Error('アップロードに失敗しました（' + xhr.status + '）'));
      };
      xhr.onerror = () => reject(new Error('ドライブへ直接送れませんでした'));
      xhr.send(blob);
    });
  }

  /* ================= 起動 ================= */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    $$('.ver-text').forEach(el => { el.textContent = APP_NAME + ' ' + VERSION; });
    readShareParams();
    setupEyes();
    bindAuth();
    bindApp();
    bindMedia();
    bindModals();
    registerSW();
    window.addEventListener('online', () => flushQueue(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.user && state.tab === 'record') {
        if (Date.now() - (state.gps.at || 0) > 180000) startGps();
      }
    });

    if (state.token) {
      try {
        const r = await api('me', {}, { noAuthRedirect: true });
        afterLogin(r.user);
        return;
      } catch (e) {
        const cached = safeJson(lsGet(LS.user));
        if (e.network && cached) { afterLogin(cached); toast('オフラインで開いています'); return; }
        clearSession();
      }
    }
    showAuth();
    if (!getGasUrl()) openConn();
  }

  /** ほかのアプリの「共有」からURLを受け取る（manifest の share_target） */
  function readShareParams() {
    const p = new URLSearchParams(location.search);
    const text = p.get('share_text') || '';
    const url = p.get('share_url') || (text.match(/https?:\/\/\S+/) || [])[0] || '';
    if (url) state.pendingShare = { url: url, title: (p.get('share_title') || text.replace(url, '')).trim().slice(0, 100) };
    if (p.has('share_url') || p.has('share_text') || p.has('share_title')) history.replaceState(null, '', location.pathname);
  }

  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => { });
    }
  }

  function showView(id) { $$('.view').forEach(v => { v.hidden = v.id !== id; }); window.scrollTo(0, 0); }

  function clearSession() {
    state.token = null; state.user = null;
    lsDel(LS.token); lsDel(LS.user);
  }

  /* ================= パスワード表示切替 ================= */
  function setupEyes() {
    $$('.eye').forEach(btn => {
      btn.innerHTML = EYE;
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = show ? EYE_OFF : EYE;
        btn.setAttribute('aria-label', show ? 'パスワードを隠す' : 'パスワードを表示');
      });
    });
  }
  function resetEyes(form) {
    $$('.pw-wrap input', form).forEach(i => { i.type = 'password'; });
    $$('.eye', form).forEach(b => { b.innerHTML = EYE; b.setAttribute('aria-label', 'パスワードを表示'); });
  }

  /* ================= 認証 ================= */
  function showAuth() { showView('view-auth'); setAuthMode('login'); }

  function setAuthMode(mode) {
    $$('.seg-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.auth === mode)));
    $$('[data-auth-form]').forEach(f => { f.hidden = f.dataset.authForm !== mode; setMsg(f, ''); });
  }

  function bindAuth() {
    $$('.seg-btn').forEach(b => b.addEventListener('click', () => setAuthMode(b.dataset.auth)));

    $('#form-login').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, btn = $('button[type=submit]', f);
      setMsg(f, ''); btn.disabled = true;
      try {
        const r = await api('login', { email: f.email.value.trim(), password: f.password.value }, { noAuthRedirect: true });
        state.token = r.token;
        lsSet(LS.token, r.token);
        f.password.value = ''; resetEyes(f);
        afterLogin(r.user);
      } catch (e) { setMsg(f, e.message, 'err'); }
      finally { btn.disabled = false; }
    });

    $('#form-register').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, btn = $('button[type=submit]', f);
      setMsg(f, ''); btn.disabled = true;
      try {
        const email = f.email.value.trim();
        const r = await api('register', { email: email, nickname: f.nickname.value.trim() }, { noAuthRedirect: true });
        f.reset();
        setAuthMode('login');
        $('#form-login').email.value = email;
        setMsg($('#form-login'), r.message, 'ok');
      } catch (e) { setMsg(f, e.message, 'err'); }
      finally { btn.disabled = false; }
    });

    $('#form-reset').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, btn = $('button[type=submit]', f);
      setMsg(f, ''); btn.disabled = true;
      try {
        const email = f.email.value.trim();
        const r = await api('resetPassword', { email: email }, { noAuthRedirect: true });
        setAuthMode('login');
        $('#form-login').email.value = email;
        setMsg($('#form-login'), r.message, 'ok');
      } catch (e) { setMsg(f, e.message, 'err'); }
      finally { btn.disabled = false; }
    });

    $('#form-change-forced').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, btn = $('button[type=submit]', f);
      const err = checkNewPassword(f.next.value, f.confirm.value);
      if (err) { setMsg(f, err, 'err'); return; }
      setMsg(f, ''); btn.disabled = true;
      try {
        const r = await api('changePassword', { current: f.current.value, next: f.next.value });
        f.reset(); resetEyes(f);
        afterLogin(r.user);
        toast('パスワードを変更しました');
      } catch (e) { setMsg(f, e.message, 'err'); }
      finally { btn.disabled = false; }
    });

    $$('[data-logout]').forEach(b => b.addEventListener('click', logout));
  }

  function checkNewPassword(next, confirm) {
    if (next !== confirm) return '確認用のパスワードが一致しません。';
    if (next.length < 8) return 'パスワードは8文字以上にしてください。';
    if (!/[A-Za-z]/.test(next) || !/\d/.test(next)) return '英字と数字を両方含めてください。';
    return '';
  }

  async function logout() {
    try { await api('logout', {}, { noAuthRedirect: true }); } catch (e) { }
    clearSession();
    showAuth();
  }

  function afterLogin(user) {
    state.user = user;
    lsSet(LS.user, JSON.stringify(user));
    if (user.mustChange) { showView('view-change'); return; }
    enterApp();
  }

  function enterApp() {
    showView('view-app');
    buildCats();
    renderChips();
    renderStars($('#rec-stars'), state.fun, v => { state.fun = v; });
    renderHello();
    switchTab('record');
    startGps();
    flushQueue(false);
    loadCapsules();
    loadMemories();
    if (state.pendingShare) {
      addAttach({ type: 'url', url: state.pendingShare.url, title: state.pendingShare.title });
      state.pendingShare = null;
      toast('共有されたページを添付しました。やったことを押すと記録されます');
    }
    if (!state.user.onboarded) openGuide(true);
  }

  /* ================= タブ ================= */
  function bindApp() {
    $$('.bottom-nav button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
    $('#btn-help').addEventListener('click', () => openGuide(false));
    $('#btn-guide2').addEventListener('click', () => openGuide(false));
    $('#btn-relocate').addEventListener('click', startGps);

    $('#cat-grid').addEventListener('click', ev => {
      const b = ev.target.closest('.cat');
      if (b) onCatTap(state.cats[Number(b.dataset.i)], b);
    });
    $('#btn-mic').addEventListener('click', toggleDictation);

    ['#today-list', '#history-list', '#fun-grid', '#fun-best', '#memories'].forEach(sel => $(sel).addEventListener('click', onLogClick));
    $('#btn-history-more').addEventListener('click', () => { state.historyDays += 30; loadHistory(); });

    // おもしろ箱
    $('#fun-filters').innerHTML = FUN_FILTERS.map(f => '<button type="button" role="tab" data-f="' + f.id + '">' + f.label + '</button>').join('');
    $('#fun-filters').addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      state.funType = b.dataset.f;
      loadFun(true);
    });
    $('#btn-fun-more').addEventListener('click', () => loadFun(false));
    $('#btn-gacha').addEventListener('click', runGacha);
    $('#capsule-banner').addEventListener('click', openNextCapsule);

    // 振り返り
    $('#period-tabs').innerHTML = PERIODS.map(p => '<button type="button" role="tab" data-p="' + p.id + '">' + p.label + '</button>').join('');
    $('#period-tabs').addEventListener('click', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      state.period = b.dataset.p;
      loadReview();
    });
    $('#btn-analyze').addEventListener('click', runAnalyze);
    $('#report-select').addEventListener('change', ev => {
      const r = state.reports.find(x => x.reportId === ev.target.value);
      if (r) renderReport(r);
    });
    $('#btn-earth').addEventListener('click', runEarth);

    // 設定
    $('#form-profile').addEventListener('submit', async ev => {
      ev.preventDefault();
      try {
        const r = await api('updateProfile', { nickname: ev.target.nickname.value.trim() });
        state.user = r.user; lsSet(LS.user, JSON.stringify(r.user));
        renderHello(); toast('ニックネームを保存しました');
      } catch (e) { toast(e.message, 'err'); }
    });
    $('#form-change').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target;
      const err = checkNewPassword(f.next.value, f.confirm.value);
      if (err) { setMsg(f, err, 'err'); return; }
      try {
        await api('changePassword', { current: f.current.value, next: f.next.value });
        f.reset(); resetEyes(f);
        setMsg(f, 'パスワードを変更しました。', 'ok');
      } catch (e) { setMsg(f, e.message, 'err'); }
    });
    $('#form-addcat').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target;
      const label = f.label.value.trim();
      if (!label) return;
      if (state.cats.some(c => c.label === label)) { toast('同じ名前のボタンがあります', 'err'); return; }
      const prefs = Object.assign({}, state.user.prefs || {});
      prefs.customCats = (prefs.customCats || []).concat([{ label: label, emoji: f.emoji.value.trim() || '📍' }]).slice(0, 20);
      await savePrefs(prefs);
      f.reset();
      toast('「' + label + '」を追加しました');
    });
    $('#custom-cats').addEventListener('click', async ev => {
      const b = ev.target.closest('button[data-label]');
      if (!b) return;
      const prefs = Object.assign({}, state.user.prefs || {});
      prefs.customCats = (prefs.customCats || []).filter(c => c.label !== b.dataset.label);
      await savePrefs(prefs);
    });
    $('#btn-flush').addEventListener('click', () => flushQueue(true));
  }

  function switchTab(name) {
    state.tab = name;
    $$('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + name; });
    $$('.bottom-nav button').forEach(b => {
      if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (name !== 'record') stopDictation();
    if (name === 'record') loadToday();
    if (name === 'history') { state.historyDays = 30; loadHistory(); }
    if (name === 'fun') loadFun(true);
    if (name === 'review') loadReview();
    if (name === 'settings') renderSettings();
  }

  /* ================= 記録 ================= */
  function renderHello() {
    const h = new Date().getHours();
    const greet = h < 5 ? 'こんばんは' : h < 11 ? 'おはようございます' : h < 17 ? 'こんにちは' : 'こんばんは';
    $('#hello-text').textContent = greet + '、' + (state.user.nickname || '') + 'さん';
    $('#today-text').textContent = fmtDay(ymd(new Date()), true);
  }

  function buildCats() {
    const custom = ((state.user && state.user.prefs && state.user.prefs.customCats) || []);
    state.cats = DEFAULT_CATS.concat(custom);
    $('#cat-grid').innerHTML = state.cats.map((c, i) =>
      '<button type="button" class="cat' + (i === 0 ? ' cat-fun' : '') + '" data-i="' + i + '"><span class="em" aria-hidden="true">' + esc(c.emoji) + '</span>' + esc(c.label) + '</button>'
    ).join('');
  }

  function renderChips() {
    $('#mood-chips').innerHTML = MOODS.map(m => '<button type="button" class="chip" aria-pressed="false" data-tag="' + esc(m.v) + '" data-group="mood">' + esc(m.t) + '</button>').join('');
    $('#with-chips').innerHTML = WITHS.map(w => '<button type="button" class="chip" aria-pressed="false" data-tag="' + esc(w) + '" data-group="with">' + esc(w) + '</button>').join('');
    $$('#mood-chips .chip, #with-chips .chip').forEach(ch => ch.addEventListener('click', () => {
      const on = ch.getAttribute('aria-pressed') !== 'true';
      $$('.chip[data-group="' + ch.dataset.group + '"]').forEach(o => { o.setAttribute('aria-pressed', 'false'); state.tags.delete(o.dataset.tag); });
      if (on) { ch.setAttribute('aria-pressed', 'true'); state.tags.add(ch.dataset.tag); }
    }));
  }

  /** ★3つの選択（同じ★をもう一度押すと0に戻る） */
  function renderStars(el, value, onChange) {
    el.innerHTML = [1, 2, 3].map(n => '<button type="button" class="star' + (n <= value ? ' on' : '') + '" data-n="' + n + '" aria-label="おもしろ度' + n + '" aria-pressed="' + (n <= value) + '">★</button>').join('') +
      '<span class="star-label">' + ['なし', 'ちょっと', 'かなり', 'すごく！'][value] + '</span>';
    el.onclick = ev => {
      const b = ev.target.closest('.star');
      if (!b) return;
      const n = Number(b.dataset.n);
      const v = n === value ? 0 : n;
      renderStars(el, v, onChange);
      onChange(v);
    };
  }

  function startGps() {
    if (!('geolocation' in navigator)) { state.gps = { status: 'unavailable' }; renderLoc(); return; }
    state.gps = { status: 'locating' };
    renderLoc();
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude, lng = pos.coords.longitude;
      state.gps = { status: 'ok', lat: lat, lng: lng, accuracy: Math.round(pos.coords.accuracy), at: Date.now() };
      renderLoc();
      try {
        const r = await api('reverseGeocode', { lat: lat, lng: lng });
        if (state.gps.lat === lat && r.place) { Object.assign(state.gps, r.place); renderLoc(); }
      } catch (e) { }
    }, err => {
      state.gps = { status: err.code === 1 ? 'denied' : 'error' };
      renderLoc();
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  function renderLoc() {
    const g = state.gps, card = $('#loc-card');
    card.classList.toggle('locating', g.status === 'locating');
    card.classList.toggle('bad', ['denied', 'error', 'unavailable'].includes(g.status));
    let main = '', sub = '';
    if (g.status === 'locating') { main = '現在地を取得しています…'; }
    else if (g.status === 'ok') {
      main = g.placeName || ('緯度 ' + g.lat.toFixed(4) + ' / 経度 ' + g.lng.toFixed(4));
      sub = (g.address ? g.address + '　' : '') + '誤差 約' + g.accuracy + 'm';
    } else if (g.status === 'denied') { main = '位置情報がオフになっています'; sub = '場所なしでも記録できます。ブラウザの設定で位置情報を許可すると自動で入ります。'; }
    else if (g.status === 'unavailable') { main = 'この端末では位置情報が使えません'; sub = '場所なしで記録されます。'; }
    else { main = '現在地を取得できませんでした'; sub = '↻ で取り直すか、場所なしで記録できます。'; }
    $('#loc-place').textContent = main;
    $('#loc-sub').textContent = sub;
  }

  function capsuleDate() {
    const days = Number($('#rec-capsule').value || 0);
    return days ? ymd(addDays(new Date(), days)) : '';
  }

  async function onCatTap(cat, btn) {
    if (!cat || state.saving) return;
    state.saving = true;
    stopDictation();
    stamp(btn);
    const now = new Date();
    const g = state.gps.status === 'ok' ? state.gps : {};
    const base = {
      timestamp: now.toISOString(), dateKey: ymd(now), hour: now.getHours(),
      lat: g.lat != null ? g.lat : null, lng: g.lng != null ? g.lng : null, accuracy: g.accuracy || null,
      placeName: g.placeName || '', address: g.address || '', area: g.area || '',
      category: cat.label, tags: Array.from(state.tags), note: $('#rec-note').value.trim(),
      fun: state.fun || (state.attach.length || cat.label === 'おもしろ発見' ? 1 : 0),
      capsuleUntil: capsuleDate()
    };
    const hasMedia = state.attach.length > 0;
    try {
      if (hasMedia) loading(true, 'おもしろを送っています…');
      const media = await prepareMedia(state.attach, pct => { $('#loading-text').textContent = '送っています… ' + pct + '%'; });
      if (hasMedia) $('#loading-text').textContent = '記録しています…';
      const r = await api('addLog', { log: Object.assign({}, base, { media: media }) });
      loading(false);
      toast(base.capsuleUntil ? '🔒 タイムカプセルに入れました（' + fmtShort(base.capsuleUntil) + 'に開けられます）' : cat.emoji + ' ' + cat.label + 'を記録しました');
      resetForm();
      prependToday(r.log);
      if (r.log.mediaCount) enrichLater(r.log.logId);
    } catch (e) {
      loading(false);
      if (e.network) await saveOffline(base);
      else toast(e.message + '（入力はそのまま残しています）', 'err');
    } finally {
      state.saving = false;
    }
    if (Date.now() - (state.gps.at || 0) > 180000) startGps();
  }

  async function saveOffline(base) {
    if (state.attach.some(a => a.type === 'video')) {
      toast('動画は電波のある場所で送ってください。入力はそのまま残しています', 'err');
      return;
    }
    try {
      const media = [];
      for (const a of state.attach) {
        if (a.type === 'url') media.push({ type: 'url', url: a.url, title: a.title || '' });
        else media.push({ type: a.type, dataUrl: a.dataUrl || await blobToDataUrl(a.blob), thumb: a.thumb || '', durationSec: a.durationSec || null });
      }
      const log = Object.assign({}, base, { media: media });
      if (!enqueue(log)) { toast('端末の保存領域が足りません。電波のある場所で送ってください（入力は残しています）', 'err'); return; }
      toast('電波がないので端末に一時保存しました。つながったら送ります');
      resetForm();
      prependToday(Object.assign({}, log, { logId: 'pending-' + Date.now(), pending: true, mediaCount: media.length, media: media.map(m => ({ type: m.type, thumb: m.thumb, url: m.url })) }));
    } catch (e) { toast(e.message, 'err'); }
  }

  async function prepareMedia(list, onPct) {
    const out = [];
    const total = list.reduce((s, a) => s + (a.blob ? a.blob.size : 0), 0) || 1;
    let done = 0;
    for (const a of list) {
      if (a.type === 'url') { out.push({ type: 'url', url: a.url, title: a.title || '' }); continue; }
      const base = { type: a.type, thumb: a.thumb || '', durationSec: a.durationSec || null, w: a.w || null, h: a.h || null };
      if (a.dataUrl) { out.push(Object.assign(base, { dataUrl: a.dataUrl })); continue; }
      if (a.blob.size <= DIRECT_MAX) {
        out.push(Object.assign(base, { dataUrl: await blobToDataUrl(a.blob) }));
      } else {
        try {
          const id = await uploadResumable(a.blob, a.mime, loaded => onPct(Math.min(99, Math.round((done + loaded) / total * 100))));
          out.push(Object.assign(base, { fileId: id }));
        } catch (e) {
          if (e.network) throw e;
          if (a.blob.size <= 20 * 1024 * 1024) out.push(Object.assign(base, { dataUrl: await blobToDataUrl(a.blob) }));
          else throw new Error(MEDIA_NAME[a.type] + 'を送れませんでした：' + e.message);
        }
      }
      done += a.blob.size;
      onPct(Math.min(99, Math.round(done / total * 100)));
    }
    return out;
  }

  function enrichLater(logId) {
    api('enrichLog', { logId: logId }).then(r => {
      updateLogEverywhere(r.log);
      const m = (r.log.media || []).find(x => x.caption || x.title);
      if (m && state.tab === 'record') toast('🤖 ' + (m.caption || m.title));
    }).catch(() => { });
  }

  function updateLogEverywhere(log) {
    state.logIndex[log.logId] = log;
    $$('.log[data-id="' + log.logId + '"]').forEach(li => { li.outerHTML = logHtml(log); });
    $$('.tile[data-id="' + log.logId + '"]').forEach(t => { t.outerHTML = tileHtml(log); });
    if (state.detailId === log.logId && !$('#modal-detail').hidden) renderDetail(log);
  }

  function stamp(btn) {
    const old = $('.stamp-mark', btn);
    if (old) old.remove();
    const m = document.createElement('span');
    m.className = 'stamp-mark';
    const d = new Date();
    m.innerHTML = '記録<br>' + (d.getMonth() + 1) + '.' + d.getDate();
    btn.appendChild(m);
    if (navigator.vibrate) navigator.vibrate(30);
    setTimeout(() => m.remove(), 1200);
  }

  function resetForm() {
    $('#rec-note').value = '';
    state.attach.forEach(a => { if (a.objUrl) URL.revokeObjectURL(a.objUrl); });
    state.attach = [];
    renderTray();
    state.tags.clear();
    $$('.chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
    state.fun = 0;
    renderStars($('#rec-stars'), 0, v => { state.fun = v; });
    $('#rec-capsule').value = '';
    $('#extras').open = false;
  }

  /* ---------- 話して入力（間が空いても聞き取り続ける） ---------- */
  const dict = { active: false, rec: null, stopAt: 0, fatal: '', lastFinal: '' };

  function toggleDictation() { if (dict.active) stopDictation(); else startDictation(); }

  function startDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('このブラウザは音声入力に対応していません。「声メモ」なら録音で残せます', 'err'); return; }
    $('#extras').open = true;
    dict.active = true; dict.fatal = ''; dict.stopAt = Date.now() + 5 * 60 * 1000;
    $('#btn-mic').classList.add('on');
    $('#btn-mic').setAttribute('aria-label', '話して入力を止める');
    const live = $('#dict-live');
    live.hidden = false;
    live.textContent = '聞き取り中…（話し終えたら 🗣 をもう一度押してください）';
    runDictation();
  }

  function runDictation() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'ja-JP';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    // Android Chrome は continuous で同じ文が重複しやすいので、短く区切って自動で再開する
    rec.continuous = !/Android/i.test(navigator.userAgent);
    dict.lastFinal = '';
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) addFinal(r[0].transcript); else interim += r[0].transcript;
      }
      $('#dict-live').textContent = interim ? '…' + interim : '聞き取り中…（間が空いても続けて聞いています）';
    };
    rec.onerror = e => {
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) dict.fatal = e.error;
    };
    rec.onend = () => {
      dict.rec = null;
      if (dict.active && !dict.fatal && Date.now() < dict.stopAt) {
        // 無音で止まっても、止めるボタンが押されるまで自動で聞き直す
        setTimeout(() => { if (dict.active && !dict.rec) runDictation(); }, 150);
      } else {
        if (dict.fatal) toast('マイクが使えません。ブラウザの設定でマイクを許可してください', 'err');
        else if (dict.active) toast('5分たったので音声入力を止めました');
        stopDictation();
      }
    };
    dict.rec = rec;
    try { rec.start(); } catch (e) {
      dict.rec = null;
      setTimeout(() => { if (dict.active && !dict.rec) runDictation(); }, 400);
    }
  }

  function addFinal(t) {
    t = String(t || '').trim();
    if (!t) return;
    let add = t;
    if (dict.lastFinal && t.indexOf(dict.lastFinal) === 0) add = t.slice(dict.lastFinal.length).trim();
    dict.lastFinal = t;
    if (!add) return;
    const ta = $('#rec-note');
    const v = ta.value;
    const sep = !v || /[\s、。！？!?]$/.test(v) ? '' : '、';
    ta.value = (v + sep + add).slice(0, 500);
  }

  function stopDictation() {
    const was = dict.active;
    dict.active = false;
    if (dict.rec) { try { dict.rec.stop(); } catch (e) { } }
    const b = $('#btn-mic');
    if (b) { b.classList.remove('on'); b.setAttribute('aria-label', '話して入力'); }
    const live = $('#dict-live');
    if (live) live.hidden = true;
    return was;
  }

  /* ================= おもしろの添付（写真・動画・声・絵・URL） ================= */
  function bindMedia() {
    $$('.fun-btns button').forEach(b => b.addEventListener('click', () => {
      if (state.attach.length >= MAX_MEDIA) { toast('添付は1回の記録につき' + MAX_MEDIA + 'つまでです', 'err'); return; }
      const t = b.dataset.add;
      if (t === 'photo') $('#in-photo').click();
      if (t === 'video') $('#in-video').click();
      if (t === 'audio') openVoice();
      if (t === 'drawing') openDraw();
      if (t === 'url') openUrl();
    }));
    $('#in-photo').addEventListener('change', onPhotoPick);
    $('#in-video').addEventListener('change', onVideoPick);
    $('#tray').addEventListener('click', ev => {
      const b = ev.target.closest('[data-rm]');
      if (!b) return;
      const a = state.attach.splice(Number(b.dataset.rm), 1)[0];
      if (a && a.objUrl) URL.revokeObjectURL(a.objUrl);
      renderTray();
    });
    bindVoice();
    bindDraw();
    $('#form-url').addEventListener('submit', ev => {
      ev.preventDefault();
      const f = ev.target;
      let url = f.url.value.trim();
      if (!/^https?:\/\//i.test(url) && /\./.test(url)) url = 'https://' + url;
      if (!/^https?:\/\/\S+$/i.test(url)) { toast('URLの形をご確認ください', 'err'); return; }
      addAttach({ type: 'url', url: url, title: f.title.value.trim() });
      closeModal('modal-url');
    });
    $('#btn-paste').addEventListener('click', async () => {
      try {
        const t = await navigator.clipboard.readText();
        const m = t.match(/https?:\/\/\S+/);
        $('#form-url').url.value = m ? m[0] : t.trim();
      } catch (e) { toast('貼り付けできませんでした。長押しで貼り付けてください', 'err'); }
    });
  }

  function addAttach(a) {
    if (state.attach.length >= MAX_MEDIA) { toast('添付は' + MAX_MEDIA + 'つまでです', 'err'); return false; }
    state.attach.push(a);
    renderTray();
    return true;
  }

  function renderTray() {
    const tray = $('#tray');
    tray.hidden = !state.attach.length;
    tray.innerHTML = state.attach.map((a, i) => {
      const vis = a.thumb ? '<img src="' + esc(a.thumb) + '" alt="">' : '<span class="tray-icon" aria-hidden="true">' + MEDIA_ICON[a.type] + '</span>';
      let info = MEDIA_NAME[a.type];
      if (a.type === 'url') info = hostOf(a.url);
      else if (a.durationSec) info += ' ' + fmtDur(a.durationSec);
      else if (a.blob) info += ' ' + fmtSize(a.blob.size);
      return '<li>' + vis + '<span class="tray-info">' + esc(info) + '</span><button type="button" class="tray-rm" data-rm="' + i + '" aria-label="' + esc(MEDIA_NAME[a.type]) + 'を外す">✕</button></li>';
    }).join('');
    $('#rec-hint').textContent = state.attach.length
      ? '添付できました。やったことを押すと、おもしろと一緒に記録されます'
      : 'やったことをタップすると、いまの場所で記録されます';
  }

  /* 写真 */
  async function onPhotoPick(ev) {
    const files = Array.from(ev.target.files || []);
    ev.target.value = '';
    for (const f of files) {
      if (state.attach.length >= MAX_MEDIA) { toast('添付は' + MAX_MEDIA + 'つまでです', 'err'); break; }
      try {
        const v = await imageVariants(f);
        addAttach({ type: 'photo', dataUrl: v.full, thumb: v.thumb, w: v.w, h: v.h });
      } catch (e) { toast(e.message, 'err'); }
    }
  }

  function loadImage(src) {
    return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('この写真は読み込めませんでした。別の写真をお試しください。')); img.src = src; });
  }
  function scaleToDataUrl(src, w0, h0, max, type, q) {
    const s = Math.min(1, max / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
    const ctx = c.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL(type, q);
  }
  async function imageVariants(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const w = img.naturalWidth, h = img.naturalHeight;
      return { full: scaleToDataUrl(img, w, h, 1600, 'image/jpeg', 0.82), thumb: scaleToDataUrl(img, w, h, 240, 'image/jpeg', 0.6), w: w, h: h };
    } finally { URL.revokeObjectURL(url); }
  }

  /* 動画 */
  async function onVideoPick(ev) {
    const file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > VIDEO_MAX) { toast('動画が大きすぎます（' + Math.round(VIDEO_MAX / 1048576) + 'MBまで）。短く切ってからお試しください', 'err'); return; }
    loading(true, '動画を読み込んでいます…');
    const meta = await videoMeta(file);
    loading(false);
    addAttach({ type: 'video', blob: file, mime: file.type || 'video/mp4', thumb: meta.thumb, durationSec: meta.duration, w: meta.w, h: meta.h });
  }

  function videoMeta(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      let done = false;
      const finish = out => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(out); };
      const timer = setTimeout(() => finish({ thumb: '', duration: isFinite(v.duration) ? v.duration : null }), 6000);
      v.muted = true; v.playsInline = true; v.preload = 'metadata';
      v.onloadedmetadata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch (e) { } };
      v.onseeked = () => {
        try {
          const thumb = scaleToDataUrl(v, v.videoWidth, v.videoHeight, 240, 'image/jpeg', 0.6);
          clearTimeout(timer);
          finish({ thumb: thumb, duration: v.duration, w: v.videoWidth, h: v.videoHeight });
        } catch (e) { clearTimeout(timer); finish({ thumb: '', duration: v.duration }); }
      };
      v.onerror = () => { clearTimeout(timer); finish({ thumb: '', duration: null }); };
      v.src = url;
    });
  }

  /* 声メモ（録音） */
  const voice = { rec: null, stream: null, chunks: [], blob: null, mime: '', t0: 0, timer: null, url: null };

  function bindVoice() {
    $('#btn-rec').addEventListener('click', () => { if (voice.rec && voice.rec.state === 'recording') stopRec(); else startRec(); });
    $('#btn-voice-attach').addEventListener('click', () => {
      if (!voice.blob) return;
      const dur = Math.round((voice.endAt - voice.t0) / 1000);
      addAttach({ type: 'audio', blob: voice.blob, mime: (voice.blob.type || 'audio/webm').split(';')[0], durationSec: dur });
      voice.blob = null;
      closeModal('modal-voice');
    });
  }

  function openVoice() {
    if (!navigator.mediaDevices || !window.MediaRecorder) { toast('このブラウザは録音に対応していません', 'err'); return; }
    stopDictation();
    resetVoiceUi();
    openModal('modal-voice');
  }

  function resetVoiceUi() {
    $('#rec-time').textContent = '0:00';
    const p = $('#rec-preview');
    p.pause(); p.removeAttribute('src'); p.hidden = true;
    if (voice.url) { URL.revokeObjectURL(voice.url); voice.url = null; }
    $('#btn-voice-attach').disabled = true;
    $('#btn-rec').classList.remove('recording');
    $('#btn-rec').setAttribute('aria-label', '録音をはじめる');
    voice.blob = null;
  }

  function pickAudioMime() {
    const list = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'];
    return list.find(m => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
  }

  async function startRec() {
    resetVoiceUi();
    try {
      voice.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) { toast('マイクが使えません。ブラウザの設定でマイクを許可してください', 'err'); return; }
    voice.mime = pickAudioMime();
    voice.chunks = [];
    voice.rec = new MediaRecorder(voice.stream, voice.mime ? { mimeType: voice.mime, audioBitsPerSecond: 64000 } : undefined);
    voice.rec.ondataavailable = e => { if (e.data && e.data.size) voice.chunks.push(e.data); };
    voice.rec.onstop = () => {
      voice.endAt = Date.now();
      clearInterval(voice.timer);
      if (voice.stream) voice.stream.getTracks().forEach(t => t.stop());
      voice.stream = null;
      if (voice.discard) { voice.discard = false; return; }
      voice.blob = new Blob(voice.chunks, { type: voice.rec.mimeType || voice.mime || 'audio/webm' });
      voice.url = URL.createObjectURL(voice.blob);
      const p = $('#rec-preview');
      p.src = voice.url; p.hidden = false;
      $('#btn-voice-attach').disabled = false;
      $('#btn-rec').classList.remove('recording');
      $('#btn-rec').setAttribute('aria-label', '録り直す');
    };
    voice.t0 = Date.now();
    voice.rec.start(1000);
    $('#btn-rec').classList.add('recording');
    $('#btn-rec').setAttribute('aria-label', '録音を止める');
    voice.timer = setInterval(() => {
      const sec = (Date.now() - voice.t0) / 1000;
      $('#rec-time').textContent = fmtDur(sec);
      if (sec >= 300) stopRec();
    }, 250);
  }

  function stopRec() { if (voice.rec && voice.rec.state === 'recording') voice.rec.stop(); }

  function cleanupVoice() {
    if (voice.rec && voice.rec.state === 'recording') { voice.discard = true; voice.rec.stop(); }
    clearInterval(voice.timer);
    if (voice.stream) { voice.stream.getTracks().forEach(t => t.stop()); voice.stream = null; }
    const p = $('#rec-preview');
    p.pause();
  }

  /* 絵 */
  const draw = { ctx: null, canvas: null, color: DRAW_COLORS[0], size: DRAW_SIZES[1], eraser: false, active: false, last: null, history: [], dirty: false, dpr: 1, w: 0, h: 0 };

  function bindDraw() {
    draw.canvas = $('#draw-canvas');
    $('#draw-colors').innerHTML = DRAW_COLORS.map((c, i) => '<button type="button" class="swatch' + (i === 0 ? ' on' : '') + '" data-c="' + c + '" style="background:' + c + '" aria-label="色' + (i + 1) + '"></button>').join('');
    $('#draw-sizes').innerHTML = DRAW_SIZES.map((s, i) => '<button type="button" class="size' + (i === 1 ? ' on' : '') + '" data-s="' + s + '" aria-label="太さ' + (i + 1) + '"><span style="width:' + (s + 4) + 'px;height:' + (s + 4) + 'px"></span></button>').join('');
    $('#draw-colors').addEventListener('click', ev => {
      const b = ev.target.closest('.swatch'); if (!b) return;
      draw.color = b.dataset.c; draw.eraser = false;
      $$('.swatch').forEach(x => x.classList.toggle('on', x === b));
      $('#draw-eraser').classList.remove('on');
    });
    $('#draw-sizes').addEventListener('click', ev => {
      const b = ev.target.closest('.size'); if (!b) return;
      draw.size = Number(b.dataset.s);
      $$('.size').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#draw-eraser').addEventListener('click', () => {
      draw.eraser = !draw.eraser;
      $('#draw-eraser').classList.toggle('on', draw.eraser);
    });
    $('#draw-undo').addEventListener('click', () => {
      const snap = draw.history.pop();
      if (snap) draw.ctx.putImageData(snap, 0, 0);
      draw.dirty = draw.history.length > 0;
    });
    $('#draw-clear').addEventListener('click', () => { snapshot(); fillWhite(); draw.dirty = false; });
    $('#btn-draw-attach').addEventListener('click', () => {
      if (!draw.dirty) { toast('まだ何も描かれていません'); return; }
      let full = draw.canvas.toDataURL('image/png');
      if (full.length > 2500000) full = draw.canvas.toDataURL('image/jpeg', 0.9);
      const thumb = scaleToDataUrl(draw.canvas, draw.canvas.width, draw.canvas.height, 240, 'image/jpeg', 0.6);
      addAttach({ type: 'drawing', dataUrl: full, thumb: thumb, w: draw.canvas.width, h: draw.canvas.height });
      closeModal('modal-draw');
    });

    const c = draw.canvas;
    const pos = e => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    c.addEventListener('pointerdown', e => {
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      snapshot();
      draw.active = true;
      draw.last = pos(e);
      strokeTo(draw.last, true);
    });
    c.addEventListener('pointermove', e => {
      if (!draw.active) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      evs.forEach(ce => strokeTo(pos(ce), false));
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => c.addEventListener(n, () => { draw.active = false; draw.last = null; }));
  }

  function snapshot() {
    if (!draw.ctx) return;
    draw.history.push(draw.ctx.getImageData(0, 0, draw.canvas.width, draw.canvas.height));
    if (draw.history.length > 20) draw.history.shift();
  }
  function fillWhite() {
    draw.ctx.save();
    draw.ctx.setTransform(1, 0, 0, 1, 0, 0);
    draw.ctx.fillStyle = '#ffffff';
    draw.ctx.fillRect(0, 0, draw.canvas.width, draw.canvas.height);
    draw.ctx.restore();
  }
  function strokeTo(p, dot) {
    const ctx = draw.ctx;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = draw.eraser ? '#ffffff' : draw.color;
    ctx.lineWidth = draw.eraser ? draw.size * 3 : draw.size;
    if (dot) {
      ctx.beginPath(); ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
    } else if (draw.last) {
      ctx.beginPath(); ctx.moveTo(draw.last.x, draw.last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    draw.last = p;
    draw.dirty = true;
  }

  function openDraw() {
    stopDictation();
    openModal('modal-draw');
    const box = $('.canvas-box');
    const w = Math.max(240, Math.floor(box.clientWidth));
    const h = Math.round(w * 0.75);
    draw.dpr = Math.min(2, window.devicePixelRatio || 1);
    draw.canvas.width = Math.round(w * draw.dpr);
    draw.canvas.height = Math.round(h * draw.dpr);
    draw.canvas.style.width = w + 'px';
    draw.canvas.style.height = h + 'px';
    draw.ctx = draw.canvas.getContext('2d');
    draw.ctx.setTransform(draw.dpr, 0, 0, draw.dpr, 0, 0);
    fillWhite();
    draw.history = []; draw.dirty = false; draw.eraser = false;
    $('#draw-eraser').classList.remove('on');
  }

  /* URL */
  function openUrl() {
    const f = $('#form-url');
    f.reset();
    openModal('modal-url');
    setTimeout(() => f.url.focus(), 50);
  }

  /* ================= 一覧表示 ================= */
  function thumbHtml(m) {
    if (m.thumb) return '<img src="' + esc(m.thumb) + '" alt="" loading="lazy">';
    if (m.type === 'url' && m.image) return '<img src="' + esc(m.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer">';
    return '<span class="ico" aria-hidden="true">' + MEDIA_ICON[m.type] + (m.durationSec ? '<small>' + fmtDur(m.durationSec) + '</small>' : '') + '</span>';
  }

  function logHtml(l) {
    state.logIndex[l.logId] = l;
    const place = l.placeName || l.area || (l.lat != null ? '位置のみ' : '場所なし');
    let body = '';
    if (l.sealed) {
      body = '<div class="sealed-line">🔒 タイムカプセル（' + fmtShort(l.capsuleUntil) + 'に開けられます）</div>';
    } else {
      const tags = (l.tags || []).map(t => '<span>' + esc(t) + '</span>').join('');
      const media = (l.media || []).slice(0, 5).map(m => '<span class="mthumb mt-' + m.type + '">' + thumbHtml(m) + '</span>').join('');
      const cap = l.ai && l.ai.caption ? '<div class="log-ai">🤖 ' + esc(l.ai.caption) + '</div>' : '';
      body = (media ? '<div class="log-media">' + media + '</div>' : '') + cap +
        (l.note ? '<div class="log-note">' + esc(l.note) + '</div>' : '') +
        (tags ? '<div class="log-tags">' + tags + '</div>' : '');
    }
    const acts = l.pending ? '<span class="muted small">送信待ち</span>' : '<button type="button" data-act="edit">直す</button>';
    return '<li class="log' + (l.pending ? ' pending' : '') + (l.fun ? ' is-fun' : '') + '" data-id="' + esc(l.logId) + '">' +
      '<div class="log-head"><span class="log-time">' + fmtTime(l.timestamp) + '</span>' +
      '<span class="log-cat">' + esc(catEmoji(l.category)) + ' ' + esc(l.category) + '</span>' +
      (l.fun ? '<span class="log-star" aria-label="おもしろ度' + l.fun + '">' + starsText(l.fun) + '</span>' : '') + '</div>' +
      '<div class="log-place">' + esc(place) + '</div>' + body +
      '<div class="log-actions">' + acts + '</div></li>';
  }

  function tileHtml(l) {
    state.logIndex[l.logId] = l;
    if (l.sealed) {
      return '<button type="button" class="tile sealed" data-id="' + esc(l.logId) + '"><span class="tile-vis"><span class="ico">🔒</span></span>' +
        '<span class="tile-cap">' + fmtShort(l.capsuleUntil) + 'に開封</span><span class="tile-date">' + fmtShort(l.dateKey) + 'に封印</span></button>';
    }
    const m = (l.media || [])[0];
    const vis = m ? thumbHtml(m) : '<span class="ico">' + esc(catEmoji(l.category)) + '</span>';
    const kinds = Array.from(new Set((l.media || []).map(x => MEDIA_ICON[x.type]))).join('');
    const cap = (l.ai && l.ai.caption) || (m && (m.caption || m.title)) || l.note || l.category;
    return '<button type="button" class="tile" data-id="' + esc(l.logId) + '">' +
      '<span class="tile-vis">' + vis + (kinds ? '<span class="tile-kinds">' + kinds + '</span>' : '') + (l.fun ? '<span class="tile-star">' + starsText(l.fun) + '</span>' : '') + '</span>' +
      '<span class="tile-cap">' + esc(String(cap).slice(0, 40)) + '</span>' +
      '<span class="tile-date">' + fmtShort(l.dateKey) + (l.placeName ? '・' + esc(l.placeName.split(' ').pop()) : '') + '</span></button>';
  }

  async function loadToday() {
    const list = $('#today-list');
    const today = ymd(new Date());
    try {
      const r = await api('listLogs', { from: today, to: today, thumbs: true });
      const pend = getQueue().filter(q => q.dateKey === today).map((q, i) => Object.assign({}, q, { logId: 'pending-' + i, pending: true, mediaCount: (q.media || []).length, media: (q.media || []).map(m => ({ type: m.type, thumb: m.thumb, url: m.url })) }));
      const logs = r.logs.concat(pend).sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);
      list.innerHTML = logs.map(logHtml).join('');
      toggleTodayEmpty(!logs.length);
    } catch (e) {
      if (!e.network) toast(e.message, 'err');
    }
  }
  function toggleTodayEmpty(empty) {
    const el = $('#today-empty');
    if (empty && !el) {
      $('#today-list').insertAdjacentHTML('afterend', '<p id="today-empty" class="trail-empty">まだ今日のあしあとはありません。上のボタンから最初の一歩をどうぞ。</p>');
    } else if (!empty && el) { el.remove(); }
  }
  function prependToday(l) {
    $('#today-list').insertAdjacentHTML('afterbegin', logHtml(l));
    toggleTodayEmpty(false);
  }

  async function loadHistory() {
    const box = $('#history-list');
    const to = new Date(), from = addDays(to, -(state.historyDays - 1));
    box.innerHTML = '<p class="muted">読み込んでいます…</p>';
    try {
      const r = await api('listLogs', { from: ymd(from), to: ymd(to), thumbs: true });
      if (!r.logs.length) {
        box.innerHTML = '<div class="empty">この' + state.historyDays + '日間の記録はありません。</div>';
        return;
      }
      const groups = {};
      r.logs.forEach(l => { (groups[l.dateKey] = groups[l.dateKey] || []).push(l); });
      const thisYear = new Date().getFullYear();
      box.innerHTML = Object.keys(groups).sort().reverse().map(d => {
        const arr = groups[d].sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);
        return '<div class="day-h"><span>' + fmtDay(d, parseYmd(d).getFullYear() !== thisYear) + '</span><span class="count">' + arr.length + '件</span></div>' +
          '<ol class="trail">' + arr.map(logHtml).join('') + '</ol>';
      }).join('');
    } catch (e) {
      box.innerHTML = '<div class="empty">' + esc(e.message) + '</div>';
    }
  }

  function onLogClick(ev) {
    const el = ev.target.closest('[data-id]');
    if (!el) return;
    const l = state.logIndex[el.dataset.id];
    if (!l || l.pending) return;
    const act = ev.target.closest('[data-act]');
    if (act && act.dataset.act === 'edit') { openEdit(l); return; }
    openDetail(l.logId);
  }

  function refreshLists() {
    if (state.tab === 'record') loadToday();
    if (state.tab === 'history') loadHistory();
    if (state.tab === 'fun') loadFun(true);
    if (state.tab === 'review') loadReview();
  }

  /* ================= くわしく見る（メディア再生） ================= */
  function openDetail(logId) {
    const l = state.logIndex[logId];
    if (!l) return;
    state.detailId = logId;
    renderDetail(l);
    openModal('modal-detail');
  }

  function renderDetail(l) {
    const box = $('#detail-body');
    const place = l.placeName || l.area || '場所なし';
    let html = '<h3 id="detail-title">' + esc(catEmoji(l.category)) + ' ' + esc(l.category) + '</h3>' +
      '<p class="muted small">' + fmtDay(l.dateKey, true) + ' ' + fmtTime(l.timestamp) + '｜' + esc(place) + '</p>';
    if (l.sealed) {
      html += '<div class="sealed-big"><span aria-hidden="true">🔒</span><p>' + fmtDay(l.capsuleUntil, true) + 'に開けられるタイムカプセルです。<br>それまで中身は見えません。</p></div>';
      box.innerHTML = html;
      $('#btn-detail-edit').hidden = true;
      return;
    }
    $('#btn-detail-edit').hidden = false;
    html += '<div class="field-row"><span class="field-label">おもしろ度</span><div class="stars" id="detail-stars"></div></div>';
    if (l.note) html += '<p class="detail-note">' + esc(l.note) + '</p>';
    if (l.ai && l.ai.tags && l.ai.tags.length) html += '<div class="log-tags">' + l.ai.tags.map(t => '<span>#' + esc(t) + '</span>').join('') + '</div>';
    if ((l.tags || []).length) html += '<div class="log-tags">' + l.tags.map(t => '<span>' + esc(t) + '</span>').join('') + '</div>';
    html += '<div class="media-list">' + (l.media || []).map(m => mediaBlockHtml(l, m)).join('') + '</div>';
    box.innerHTML = html;

    renderStars($('#detail-stars'), l.fun || 0, async v => {
      try {
        const r = await api('updateLog', { logId: l.logId, fields: { fun: v } });
        updateLogEverywhere(r.log);
      } catch (e) { toast(e.message, 'err'); }
    });
    // 画像は自動で大きく読み込む
    (l.media || []).forEach(m => { if (m.type === 'photo' || m.type === 'drawing') loadMedia(l, m); });
    box.onclick = ev => {
      const b = ev.target.closest('[data-mload]');
      if (b) { const m = l.media.find(x => x.id === b.dataset.mload); if (m) loadMedia(l, m, true); return; }
      const e2 = ev.target.closest('[data-enrich]');
      if (e2) {
        e2.disabled = true; e2.textContent = 'AIが見ています…';
        api('enrichLog', { logId: l.logId, mediaId: e2.dataset.enrich }).then(r => updateLogEverywhere(r.log)).catch(err => toast(err.message, 'err'));
      }
    };
  }

  function mediaBlockHtml(l, m) {
    const id = esc(m.id || '');
    const cap = m.caption ? '<p class="m-cap">🤖 ' + esc(m.caption) + '</p>' : '';
    const pending = (m.type !== 'url' && !m.ai && !m.aiError) ? '<p class="muted small">AIがひとことを準備中です</p>' : '';
    const retry = m.aiError ? '<button type="button" class="link-btn small" data-enrich="' + id + '">AIにもう一度見てもらう</button>' : '';
    if (m.type === 'url') {
      const img = m.image ? '<img src="' + esc(m.image) + '" alt="" referrerpolicy="no-referrer" loading="lazy">' : '';
      return '<a class="url-card" href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer">' + img +
        '<span class="url-body"><b>' + esc(m.title || hostOf(m.url)) + '</b>' +
        (m.desc ? '<span class="small muted">' + esc(m.desc.slice(0, 120)) + '</span>' : '') +
        '<span class="small url-host">🔗 ' + esc(m.siteName || hostOf(m.url)) + '</span></span></a>';
    }
    if (m.type === 'photo' || m.type === 'drawing') {
      return '<figure class="m-block" data-mid="' + id + '">' + (m.thumb ? '<img src="' + esc(m.thumb) + '" alt="' + MEDIA_NAME[m.type] + '">' : '<p class="muted small">読み込んでいます…</p>') + cap + pending + retry + '</figure>';
    }
    if (m.type === 'audio') {
      const tr = m.transcript ? '<details class="transcript"><summary>文字起こしを見る</summary><p>' + esc(m.transcript) + '</p></details>' : '';
      return '<div class="m-block" data-mid="' + id + '"><button type="button" class="btn btn-ghost" data-mload="' + id + '">▶ 声メモを聴く' + (m.durationSec ? '（' + fmtDur(m.durationSec) + '）' : '') + '</button>' + cap + tr + pending + retry + '</div>';
    }
    return '<div class="m-block" data-mid="' + id + '"><button type="button" class="video-poster" data-mload="' + id + '">' + (m.thumb ? '<img src="' + esc(m.thumb) + '" alt="">' : '') + '<span class="play">▶</span></button>' + cap + pending + retry + '</div>';
  }

  async function loadMedia(l, m, userAction) {
    const block = $('#detail-body [data-mid="' + CSS.escape(m.id) + '"]');
    if (!block) return;
    let r = state.mediaCache[m.id];
    if (!r) {
      try {
        if (userAction) block.classList.add('busy');
        r = await api('getMedia', { logId: l.logId, mediaId: m.id });
        if (r.dataUrl && r.dataUrl.length < 6000000) state.mediaCache[m.id] = r;
      } catch (e) { toast(e.message, 'err'); block.classList.remove('busy'); return; }
      block.classList.remove('busy');
    }
    if (state.detailId !== l.logId) return;
    const first = block.firstElementChild;
    if (m.type === 'photo' || m.type === 'drawing') {
      if (r.dataUrl) {
        const img = document.createElement('img');
        img.src = r.dataUrl; img.alt = MEDIA_NAME[m.type];
        if (first && first.tagName === 'IMG') first.replaceWith(img); else block.prepend(img);
      }
    } else if (m.type === 'audio') {
      if (r.dataUrl) {
        const a = document.createElement('audio');
        a.controls = true; a.src = r.dataUrl;
        first.replaceWith(a);
        a.play().catch(() => { });
      } else if (r.openUrl) first.outerHTML = '<a class="btn btn-ghost" href="' + esc(r.openUrl) + '" target="_blank" rel="noopener">ドライブで聴く</a>';
    } else if (m.type === 'video') {
      if (r.dataUrl) {
        const v = document.createElement('video');
        v.controls = true; v.playsInline = true; v.src = r.dataUrl;
        first.replaceWith(v);
        v.play().catch(() => { });
      } else if (r.previewUrl) {
        first.outerHTML = '<div class="video-frame"><iframe src="' + esc(r.previewUrl) + '" allow="autoplay; fullscreen" allowfullscreen title="動画"></iframe></div>' +
          '<p class="muted small">アップロード直後はドライブ側の処理で少し待つことがあります。<a href="' + esc(r.openUrl) + '" target="_blank" rel="noopener">ドライブで開く</a></p>';
      } else if (r.openUrl) first.outerHTML = '<a class="btn btn-ghost" href="' + esc(r.openUrl) + '" target="_blank" rel="noopener">ドライブで見る</a>';
    }
  }

  /* ================= おもしろ箱 ================= */
  async function loadFun(reset) {
    $$('#fun-filters button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.f === state.funType)));
    const grid = $('#fun-grid');
    if (reset) { state.funOffset = 0; grid.innerHTML = '<p class="muted">読み込んでいます…</p>'; }
    try {
      const r = await api('listFun', { type: state.funType, offset: state.funOffset, limit: 48 });
      const html = r.items.map(tileHtml).join('');
      if (reset) grid.innerHTML = html || '<div class="empty wide-empty">まだありません。<br>記録タブの 📷🎥🎙✏️🔗 から「おもしろい！」を集めましょう。</div>';
      else grid.insertAdjacentHTML('beforeend', html);
      state.funOffset += r.items.length;
      $('#btn-fun-more').hidden = state.funOffset >= r.total;
      $('#fun-count').textContent = r.total + '件のおもしろ' + (state.sealedInfo ? '｜' + state.sealedInfo : '');
    } catch (e) { grid.innerHTML = '<div class="empty wide-empty">' + esc(e.message) + '</div>'; }
  }

  /* ガチャ */
  async function runGacha() {
    const stage = $('#reveal-stage');
    $('#btn-reveal-again').hidden = true;
    $('#btn-reveal-open').hidden = true;
    stage.innerHTML = '<div class="gacha-ball" aria-hidden="true"><span></span></div><p class="reveal-wait">ガラガラ…</p>';
    openModal('modal-reveal');
    let r;
    try {
      [r] = await Promise.all([api('gacha'), new Promise(res => setTimeout(res, 1300))]);
    } catch (e) { closeModal('modal-reveal'); toast(e.message, 'err'); return; }
    showReveal(r.log, r.daysAgo + '日前のあなたが見つけたもの');
    $('#btn-reveal-again').hidden = false;
    $('#btn-reveal-again').onclick = runGacha;
  }

  function showReveal(l, headline) {
    state.logIndex[l.logId] = l;
    const m = (l.media || [])[0];
    const vis = m ? thumbHtml(m) : '<span class="ico">' + esc(catEmoji(l.category)) + '</span>';
    const cap = (l.ai && l.ai.caption) || (m && (m.caption || m.title)) || l.note || l.category;
    $('#reveal-stage').innerHTML = '<div class="reveal-card-in">' +
      '<p class="reveal-head">' + esc(headline) + '</p>' +
      '<div class="reveal-vis">' + vis + '</div>' +
      '<p class="reveal-cap">' + esc(cap) + '</p>' +
      '<p class="muted small">' + fmtDay(l.dateKey, true) + '｜' + esc(l.placeName || l.area || '') + (l.fun ? '｜' + starsText(l.fun) : '') + '</p></div>';
    const open = $('#btn-reveal-open');
    open.hidden = false;
    open.onclick = () => { closeModal('modal-reveal'); openDetail(l.logId); };
  }

  /* タイムカプセル */
  async function loadCapsules() {
    try {
      const r = await api('capsules');
      state.capsules = r.arrived;
      state.sealedInfo = r.sealedCount ? '封印中のタイムカプセル ' + r.sealedCount + '件（次は' + fmtShort(r.next) + '）' : '';
      renderCapsuleBanner();
    } catch (e) { }
  }
  function renderCapsuleBanner() {
    const b = $('#capsule-banner');
    const n = state.capsules.length;
    b.hidden = !n;
    if (n) b.innerHTML = '<span class="cb-ico" aria-hidden="true">🎁</span><span><b>タイムカプセルが' + n + '件届いています</b><br><span class="small">押すと開けられます</span></span>';
  }
  async function openNextCapsule() {
    const c = state.capsules[0];
    if (!c) return;
    $('#btn-reveal-again').hidden = true;
    $('#btn-reveal-open').hidden = true;
    $('#reveal-stage').innerHTML = '<div class="gacha-ball capsule" aria-hidden="true"><span></span></div><p class="reveal-wait">ふたを開けています…</p>';
    openModal('modal-reveal');
    try {
      const [r] = await Promise.all([api('openCapsule', { logId: c.logId }), new Promise(res => setTimeout(res, 1300))]);
      state.capsules.shift();
      renderCapsuleBanner();
      showReveal(r.log, r.daysAgo + '日前のあなたから届きました');
      if (state.capsules.length) { const again = $('#btn-reveal-again'); again.hidden = false; again.textContent = '次のカプセル'; again.onclick = openNextCapsule; }
    } catch (e) { closeModal('modal-reveal'); toast(e.message, 'err'); }
  }

  /* あの日のあしあと */
  async function loadMemories() {
    const box = $('#memories');
    try {
      const r = await api('memories', { today: ymd(new Date()) });
      if (!r.groups.length) { box.hidden = true; return; }
      box.innerHTML = '<p class="mem-h">あの日のあしあと</p><div class="mem-row">' + r.groups.map(g => {
        const l = g.logs[0];
        state.logIndex[l.logId] = l;
        const m = (l.media || [])[0];
        const vis = m ? thumbHtml(m) : '<span class="ico">' + esc(catEmoji(l.category)) + '</span>';
        const cap = (l.ai && l.ai.caption) || (m && (m.caption || m.title)) || l.note || (l.category + (l.placeName ? '・' + l.placeName : ''));
        return '<button type="button" class="mem-card" data-id="' + esc(l.logId) + '"><span class="mem-vis">' + vis + '</span>' +
          '<span class="mem-body"><b>' + esc(g.label) + '</b><span class="small">' + esc(String(cap).slice(0, 30)) + '</span>' +
          '<span class="small muted">' + fmtShort(g.dateKey) + '・' + g.count + '件</span></span></button>';
      }).join('') + '</div>';
      box.hidden = false;
    } catch (e) { box.hidden = true; }
  }

  /* ================= 編集 ================= */
  function openEdit(l) {
    if (l.sealed) { toast('タイムカプセルは開封日まで直せません'); return; }
    state.editing = l;
    state.editFun = l.fun || 0;
    const f = $('#form-edit');
    const labels = state.cats.map(c => c.label);
    if (labels.indexOf(l.category) < 0) labels.push(l.category);
    f.category.innerHTML = labels.map(x => '<option' + (x === l.category ? ' selected' : '') + '>' + esc(x) + '</option>').join('');
    f.placeName.value = l.placeName || '';
    f.note.value = l.note || '';
    renderStars($('#edit-stars'), state.editFun, v => { state.editFun = v; });
    $('#edit-when').textContent = fmtDay(l.dateKey, true) + ' ' + fmtTime(l.timestamp);
    openModal('modal-edit');
  }

  /* ================= 振り返り ================= */
  function periodRange(pid) {
    const p = PERIODS.find(x => x.id === pid) || PERIODS[0];
    const to = new Date();
    return { from: ymd(addDays(to, -(p.days - 1))), to: ymd(to), days: p.days, label: p.label };
  }

  async function loadReview() {
    $$('#period-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.p === state.period)));
    const r = periodRange(state.period);
    $('#range-text').textContent = fmtDay(r.from, true) + ' 〜 ' + fmtDay(r.to, true);
    $('#report').hidden = true;
    stopAudio();
    try {
      const res = await withLoading('記録を集めています…', () => api('listLogs', { from: r.from, to: r.to }));
      const empty = !res.logs.length;
      $('#review-empty').hidden = !empty;
      $('#review-body').hidden = empty;
      if (!empty) { renderStats(res.logs, r); renderCharts(res.logs, r); loadFunBest(r); }
    } catch (e) { toast(e.message, 'err'); }
    loadReports();
  }

  async function loadFunBest(r) {
    const panel = $('#fun-best-panel');
    try {
      const res = await api('listFun', { from: r.from, to: r.to, sort: 'fun', limit: 6 });
      const items = res.items.filter(x => !x.sealed);
      panel.hidden = !items.length;
      $('#fun-best').innerHTML = items.map(tileHtml).join('');
    } catch (e) { panel.hidden = true; }
  }

  function dayDistances(logs) {
    const byDay = {};
    logs.forEach(l => { if (l.lat != null && l.lng != null) (byDay[l.dateKey] = byDay[l.dateKey] || []).push(l); });
    const out = {};
    Object.keys(byDay).forEach(d => {
      const a = byDay[d].sort((x, y) => x.timestamp < y.timestamp ? -1 : 1);
      let s = 0;
      for (let i = 1; i < a.length; i++) s += haversineKm(a[i - 1].lat, a[i - 1].lng, a[i].lat, a[i].lng);
      out[d] = s;
    });
    return out;
  }

  function renderStats(logs, r) {
    const days = new Set(logs.map(l => l.dateKey)).size;
    const km = Object.values(dayDistances(logs)).reduce((a, b) => a + b, 0);
    const areas = new Set(logs.map(l => l.area).filter(Boolean)).size;
    const fun = logs.filter(l => l.fun > 0 || l.mediaCount > 0).length;
    const media = logs.reduce((s, l) => s + (l.mediaCount || 0), 0);
    const items = [
      ['記録', logs.length, '件'],
      ['記録した日', days + ' / ' + r.days, '日'],
      ['移動距離', km >= 100 ? Math.round(km) : km.toFixed(1), 'km'],
      ['訪れたエリア', areas, 'か所'],
      ['おもしろ発見', fun, '件'],
      ['写真・声・絵など', media, '個']
    ];
    $('#stats').innerHTML = items.map(i => '<div><dt>' + i[0] + '</dt><dd>' + i[1] + '<small>' + i[2] + '</small></dd></div>').join('');
  }

  function bucketMode(days) { return days <= 30 ? 'day' : days <= 91 ? 'week' : 'month'; }
  function bucketKey(dateKey, mode) {
    if (mode === 'day') return dateKey;
    if (mode === 'month') return dateKey.slice(0, 7);
    const d = parseYmd(dateKey);
    return ymd(addDays(d, -((d.getDay() + 6) % 7)));
  }
  function bucketLabel(key, mode) {
    if (mode === 'month') { const p = key.split('-'); return p[0].slice(2) + '/' + Number(p[1]); }
    const d = parseYmd(key);
    return (d.getMonth() + 1) + '/' + d.getDate() + (mode === 'week' ? '週' : '');
  }

  function mkChart(id, config) {
    if (typeof Chart === 'undefined') return;
    if (state.charts[id]) state.charts[id].destroy();
    state.charts[id] = new Chart($('#' + id), config);
  }

  function renderCharts(logs, r) {
    if (typeof Chart === 'undefined') { toast('グラフ部品を読み込めませんでした。通信状態をご確認ください。', 'err'); return; }
    const ink = cssVar('--ink'), muted = cssVar('--muted'), line = cssVar('--line');
    const moss = cssVar('--moss'), trail = cssVar('--trail');
    Chart.defaults.font.family = '"BIZ UDPGothic", system-ui, sans-serif';
    Chart.defaults.color = muted;
    const grid = { color: line };

    const cat = {};
    logs.forEach(l => { cat[l.category] = (cat[l.category] || 0) + 1; });
    const catKeys = Object.keys(cat).sort((a, b) => cat[b] - cat[a]);
    mkChart('ch-cat', {
      type: 'doughnut',
      data: {
        labels: catKeys.map(k => catEmoji(k) + ' ' + k),
        datasets: [{ data: catKeys.map(k => cat[k]), backgroundColor: catKeys.map((k, i) => PALETTE[i % PALETTE.length]), borderColor: cssVar('--surface'), borderWidth: 2 }]
      },
      options: {
        maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'right', labels: { color: ink, boxWidth: 12, padding: 8 } },
          tooltip: { callbacks: { label: c => c.label + '：' + c.parsed + '件（' + Math.round(c.parsed / logs.length * 100) + '%）' } }
        }
      }
    });

    const hours = new Array(24).fill(0);
    logs.forEach(l => { hours[l.hour] = (hours[l.hour] || 0) + 1; });
    mkChart('ch-hour', {
      type: 'bar',
      data: { labels: hours.map((_, h) => h + '時'), datasets: [{ label: '記録数', data: hours, backgroundColor: moss, borderRadius: 4 }] },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 8 } }, y: { beginAtZero: true, grid: grid, ticks: { precision: 0 } } }
      }
    });

    const mode = bucketMode(r.days);
    const keys = [];
    for (let d = parseYmd(r.from); ymd(d) <= r.to; d = addDays(d, 1)) {
      const k = bucketKey(ymd(d), mode);
      if (keys[keys.length - 1] !== k) keys.push(k);
    }
    const counts = {}, dist = {}, funs = {};
    logs.forEach(l => {
      const k = bucketKey(l.dateKey, mode);
      counts[k] = (counts[k] || 0) + 1;
      if (l.fun > 0 || l.mediaCount > 0) funs[k] = (funs[k] || 0) + 1;
    });
    const dd = dayDistances(logs);
    Object.keys(dd).forEach(d => { const k = bucketKey(d, mode); dist[k] = (dist[k] || 0) + dd[d]; });
    mkChart('ch-trend', {
      type: 'bar',
      data: {
        labels: keys.map(k => bucketLabel(k, mode)),
        datasets: [
          { type: 'bar', label: '記録数', data: keys.map(k => counts[k] || 0), backgroundColor: moss, borderRadius: 4, yAxisID: 'y', stack: 'a' },
          { type: 'bar', label: 'うち おもしろ', data: keys.map(k => funs[k] || 0), backgroundColor: cssVar('--shu'), borderRadius: 4, yAxisID: 'y', stack: 'b' },
          { type: 'line', label: '移動距離（km）', data: keys.map(k => Math.round((dist[k] || 0) * 10) / 10), borderColor: trail, backgroundColor: trail, pointRadius: keys.length > 40 ? 0 : 3, tension: .3, yAxisID: 'y1' }
        ]
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: ink, boxWidth: 12 } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } },
          y: { beginAtZero: true, grid: grid, ticks: { precision: 0 }, title: { display: true, text: '件' } },
          y1: { beginAtZero: true, position: 'right', grid: { display: false }, title: { display: true, text: 'km' } }
        }
      }
    });

    const area = {};
    logs.forEach(l => { const a = l.area || '（地名なし）'; area[a] = (area[a] || 0) + 1; });
    const aKeys = Object.keys(area).sort((a, b) => area[b] - area[a]).slice(0, 8);
    mkChart('ch-area', {
      type: 'bar',
      data: { labels: aKeys, datasets: [{ label: '記録数', data: aKeys.map(k => area[k]), backgroundColor: trail, borderRadius: 4 }] },
      options: {
        indexAxis: 'y', maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, grid: grid, ticks: { precision: 0 } }, y: { grid: { display: false }, ticks: { color: ink } } }
      }
    });
  }

  async function loadReports() {
    const sel = $('#report-select');
    try {
      const r = await api('listReports', { period: state.period });
      state.reports = r.reports;
      sel.hidden = !r.reports.length;
      sel.innerHTML = '<option value="">これまでの振り返り（' + r.reports.length + '件）</option>' +
        r.reports.map(x => '<option value="' + esc(x.reportId) + '">' + esc(x.createdAt.slice(0, 10)) + '　' + esc(x.title) + '</option>').join('');
    } catch (e) { sel.hidden = true; }
  }

  async function runAnalyze() {
    const r = periodRange(state.period);
    try {
      const res = await withLoading('AIが' + r.label + 'のあしあとを読んでいます…', () => api('analyze', { period: state.period, from: r.from, to: r.to }));
      renderReport(res.report);
      loadReports();
    } catch (e) { toast(e.message, 'err'); }
  }

  function renderReport(rep) {
    stopAudio();
    const box = $('#report');
    const hl = (rep.highlights || []).map(h => '<li>' + esc(h) + '</li>').join('');
    box.innerHTML =
      '<h4>' + esc(rep.title) + '</h4>' +
      '<p class="meta">' + esc(rep.periodLabel) + '｜' + esc(rep.rangeStart) + ' 〜 ' + esc(rep.rangeEnd) + '</p>' +
      '<p>' + esc(rep.summary) + '</p>' +
      (hl ? '<ul>' + hl + '</ul>' : '') +
      (rep.funBest ? '<div class="part"><b>おもしろ発見</b>' + esc(rep.funBest) + '</div>' : '') +
      (rep.changes ? '<div class="part"><b>変わってきたこと</b>' + esc(rep.changes) + '</div>' : '') +
      (rep.growth ? '<div class="part"><b>続いていること</b>' + esc(rep.growth) + '</div>' : '') +
      (rep.nextIdea ? '<div class="part"><b>次に試してみたいこと</b>' + esc(rep.nextIdea) + '</div>' : '') +
      '<div class="listen"><button type="button" class="btn btn-primary" id="btn-tts">🔊 音声で聴く</button>' +
      '<audio id="report-audio" controls preload="none" hidden></audio></div>';
    box.hidden = false;
    $('#btn-tts').addEventListener('click', () => playReport(rep));
  }

  async function playReport(rep) {
    const audio = $('#report-audio');
    try {
      const msg = rep.hasAudio ? '音声を読み込んでいます…' : '音声を作っています（30秒ほどかかります）…';
      const r = await withLoading(msg, () => api('tts', { reportId: rep.reportId }));
      rep.hasAudio = true;
      stopAudio();
      const bin = atob(r.audio);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      state.audioUrl = URL.createObjectURL(new Blob([bytes], { type: r.mimeType || 'audio/wav' }));
      audio.src = state.audioUrl;
      audio.hidden = false;
      audio.play().catch(() => { });
    } catch (e) { toast(e.message, 'err'); }
  }

  function stopAudio() {
    const a = $('#report-audio');
    if (a) { a.pause(); a.removeAttribute('src'); }
    if (state.audioUrl) { URL.revokeObjectURL(state.audioUrl); state.audioUrl = null; }
  }

  async function runEarth() {
    const r = periodRange(state.period);
    try {
      const res = await withLoading('滞在地をまとめています…', () => api('exportEarth', { period: state.period, from: r.from, to: r.to }));
      const base = 'ashiato_' + state.period + '_' + r.to;
      download(res.kml, base + '.kml', 'application/vnd.google-earth.kml+xml');
      setTimeout(() => download(JSON.stringify(res.keyframes, null, 2), base + '_keyframes.json', 'application/json'), 400);
      $('#earth-result').innerHTML =
        '<p class="small">' + esc(base) + '.kml と _keyframes.json を保存しました。カメラは次の順に回ります（1地点5秒、おもしろ発見のあった場所を優先）。</p>' +
        '<ol class="earth-stops">' + res.stops.map(s =>
          '<li><span class="tc">' + esc(s.timecode) + '</span><span><b>' + esc(s.caption) + '</b><br><span class="muted">' + esc(s.place) + '｜向き' + s.camera.heading + '°・傾き' + s.camera.tilt + '°・距離' + s.camera.rangeM + 'm</span></span></li>'
        ).join('') + '</ol>';
      $('#earth-result').hidden = false;
    } catch (e) { toast(e.message, 'err'); }
  }

  function download(text, name, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ================= 設定 ================= */
  function renderSettings() {
    const u = state.user;
    $('#set-email').textContent = 'ログイン中：' + u.email;
    $('#form-profile').nickname.value = u.nickname || '';
    const custom = (u.prefs && u.prefs.customCats) || [];
    $('#custom-cats').innerHTML = custom.length
      ? custom.map(c => '<li>' + esc(c.emoji) + ' ' + esc(c.label) + '<button type="button" data-label="' + esc(c.label) + '" aria-label="' + esc(c.label) + 'を消す">✕</button></li>').join('')
      : '<li class="muted small none">まだありません</li>';
    updateQueueText();
    $('#set-gas').textContent = '接続先：' + (getGasUrl() ? getGasUrl().replace(/(.{48}).+(.{8})$/, '$1…$2') : '未設定');
  }

  async function savePrefs(prefs) {
    try {
      const r = await api('savePrefs', { prefs: prefs });
      state.user = r.user;
      lsSet(LS.user, JSON.stringify(r.user));
      buildCats();
      renderSettings();
    } catch (e) { toast(e.message, 'err'); }
  }

  /* ================= オフライン送信待ち ================= */
  function getQueue() { return safeJson(lsGet(LS.queue)) || []; }
  function enqueue(log) {
    const q = getQueue();
    q.push(log);
    const ok = lsSet(LS.queue, JSON.stringify(q));
    updateQueueText();
    return ok;
  }
  function updateQueueText() {
    const n = getQueue().length;
    const el = $('#queue-text');
    if (el) el.textContent = n ? n + '件の記録が送信待ちです。' : '送信待ちの記録はありません。';
    const b = $('#btn-flush');
    if (b) b.disabled = !n;
  }
  async function flushQueue(verbose) {
    if (!state.token || flushQueue.busy) return;
    const q = getQueue();
    if (!q.length) return;
    flushQueue.busy = true;
    let sent = 0;
    try {
      while (q.length) {
        try {
          const r = await api('addLog', { log: q[0] });
          q.shift(); sent++;
          lsSet(LS.queue, JSON.stringify(q));
          if (r.log.mediaCount) api('enrichLog', { logId: r.log.logId }).catch(() => { });
        } catch (e) {
          if (e.network || e.code === 'AUTH') break;
          q.shift();
          lsSet(LS.queue, JSON.stringify(q));
        }
      }
    } finally { flushQueue.busy = false; }
    updateQueueText();
    if (sent) { toast('送信待ちだった' + sent + '件を送りました'); refreshLists(); }
    else if (verbose && q.length) toast('まだつながりません。あとでもう一度お試しください', 'err');
  }

  /* ================= モーダル ================= */
  function openModal(id) { $('#' + id).hidden = false; }
  function closeModal(id) {
    $('#' + id).hidden = true;
    if (id === 'modal-voice') cleanupVoice();
    if (id === 'modal-detail') {
      state.detailId = null;
      $$('#detail-body audio, #detail-body video').forEach(x => x.pause());
      $$('#detail-body iframe').forEach(x => x.remove());
    }
  }

  function bindModals() {
    $$('.modal').forEach(m => {
      m.addEventListener('click', ev => {
        if (ev.target === m || ev.target.closest('[data-close]')) {
          if (m.id === 'modal-guide') return finishGuide();
          if (m.id === 'modal-draw' && ev.target === m) return; // 描いている途中で背景を触っても閉じない
          closeModal(m.id);
        }
      });
    });
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      const open = $$('.modal').filter(m => !m.hidden).pop();
      if (!open) return;
      if (open.id === 'modal-guide') finishGuide(); else closeModal(open.id);
    });

    $('#btn-detail-edit').addEventListener('click', () => {
      const l = state.logIndex[state.detailId];
      closeModal('modal-detail');
      if (l) openEdit(l);
    });

    $('#form-edit').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, l = state.editing;
      try {
        const r = await withLoading('保存しています…', () => api('updateLog', { logId: l.logId, fields: { category: f.category.value, placeName: f.placeName.value.trim(), note: f.note.value.trim(), fun: state.editFun } }));
        closeModal('modal-edit');
        toast('記録を直しました');
        updateLogEverywhere(r.log);
      } catch (e) { toast(e.message, 'err'); }
    });
    $('#btn-edit-delete').addEventListener('click', async () => {
      const l = state.editing;
      if (!confirm(fmtTime(l.timestamp) + '「' + l.category + '」の記録を消しますか？添付した写真や声もゴミ箱に移ります。')) return;
      try {
        await withLoading('消しています…', () => api('deleteLog', { logId: l.logId }));
        closeModal('modal-edit');
        toast('記録を消しました');
        refreshLists();
      } catch (e) { toast(e.message, 'err'); }
    });

    $$('[data-open-conn]').forEach(b => b.addEventListener('click', openConn));
    $('#form-conn').addEventListener('submit', ev => {
      ev.preventDefault();
      const v = ev.target.url.value.trim();
      if (v && !/^https:\/\/script\.google(usercontent)?\.com\//.test(v)) { setMsg(ev.target, 'GASのウェブアプリURL（https://script.google.com/…/exec）を入れてください。', 'err'); return; }
      if (v) lsSet(LS.gas, v); else lsDel(LS.gas);
      closeModal('modal-conn');
      toast('接続先を保存しました');
      if (state.tab === 'settings' && state.user) renderSettings();
    });
    $('#btn-conn-test').addEventListener('click', async () => {
      const f = $('#form-conn');
      const v = f.url.value.trim() || CFG.GAS_URL;
      setMsg(f, '確かめています…');
      try {
        const res = await fetch(v, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'ping' }) });
        const j = await res.json();
        if (j.ok) setMsg(f, 'つながりました（サーバー ' + j.version + '）', 'ok'); else setMsg(f, j.error, 'err');
      } catch (e) { setMsg(f, 'つながりません。URLとデプロイ設定（アクセス：全員）を確かめてください。', 'err'); }
    });

    $('#guide-prev').addEventListener('click', () => { if (state.guideStep > 0) { state.guideStep--; renderGuide(); } });
    $('#guide-next').addEventListener('click', () => {
      if (state.guideStep < GUIDE.length - 1) { state.guideStep++; renderGuide(); } else finishGuide();
    });
  }

  function openConn() {
    const f = $('#form-conn');
    f.url.value = lsGet(LS.gas) || (getGasUrl() || '');
    setMsg(f, '');
    openModal('modal-conn');
  }

  /* ================= 使い方ガイド ================= */
  const GUIDE = [
    { big: '👣', h: 'あしあと帳へようこそ', p: 'どこで何をしたかを、ボタンひとつで残していくノートです。日記を書く時間がなくても、あしあとは自然にたまっていきます。' },
    { big: '👆', h: '記録はワンタップ', p: '「記録」タブで、やったことのボタンを押すだけ。場所と時刻は自動で入ります。ひとこと（🗣で話して入力）・気分は、つけたいときだけ。' },
    { big: '🤩', h: 'おもしろいものを見つけたら', p: '📷写真 🎥動画 🎙声メモ ✏️絵 🔗URL で添付してから、やったことのボタン（または「おもしろ発見」）を押します。AIがひとことを添え、声は文字にしてくれます。ほかのアプリの「共有」からURLを送ることもできます。' },
    { big: '🎁', h: 'あとで楽しむ仕掛け', p: '「おもしろ箱」でコレクションを眺めたり、ガチャで昔の発見を引いたり。タイムカプセルに入れた記録は、決めた日まで開けられません。記録タブには「1年前の今日」なども出てきます。' },
    { big: '📈', h: '期間を切り替えて振り返る', p: '「振り返り」タブで1週間から3年まで。グラフ、おもしろベスト、AIのまとめと音声ナレーションで振り返れます。' },
    { big: '🌏', h: '空から旅をたどる', p: '位置データを Google Earth Studio 用に書き出せます。おもしろ発見のあった場所をめぐる、3D空撮風の振り返り動画が作れます。' },
    { big: '📲', h: 'ホーム画面に置くと便利', p: 'ブラウザのメニューから「ホーム画面に追加」すると、アプリのようにすぐ開けます。電波がない場所での記録も、つながったときに自動で送られます（動画を除く）。' }
  ];

  function openGuide(first) {
    state.guideFirst = !!first;
    state.guideStep = 0;
    renderGuide();
    openModal('modal-guide');
  }
  function renderGuide() {
    const g = GUIDE[state.guideStep];
    $('#guide-slide').innerHTML = '<div class="guide-slide"><div class="big" aria-hidden="true">' + g.big + '</div><h3 id="guide-title">' + esc(g.h) + '</h3><p>' + esc(g.p) + '</p></div>';
    $('#guide-dots').innerHTML = GUIDE.map((_, i) => '<span class="' + (i === state.guideStep ? 'on' : '') + '"></span>').join('');
    $('#guide-prev').style.visibility = state.guideStep === 0 ? 'hidden' : 'visible';
    $('#guide-next').textContent = state.guideStep === GUIDE.length - 1 ? (state.guideFirst ? 'はじめる' : '閉じる') : '次へ';
  }
  async function finishGuide() {
    closeModal('modal-guide');
    if (state.guideFirst && state.user && !state.user.onboarded) {
      state.user.onboarded = true;
      lsSet(LS.user, JSON.stringify(state.user));
      try { await api('markOnboarded'); } catch (e) { }
    }
  }
})();
