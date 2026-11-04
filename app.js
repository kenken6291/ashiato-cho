/* あしあと帳 — app.js（SPA） v1.4.0 */
(() => {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const VERSION = CFG.VERSION || 'v1.4.0';
  const APP_NAME = CFG.APP_NAME || 'あしあと帳';
  const LS = { token: 'ashiato.token', user: 'ashiato.user', gas: 'ashiato.gasUrl', queue: 'ashiato.queue', mode: 'ashiato.mode', hist: 'ashiato.histView' };

  const DEFAULT_CATS = [
    { label: 'おもしろ発見', emoji: '🤩' },
    { label: '仕事', emoji: '💼' }, { label: '移動', emoji: '🚃' }, { label: '睡眠', emoji: '😴' },
    { label: '食事', emoji: '🍙' }, { label: 'テレビ', emoji: '📺' }, { label: 'スマホ', emoji: '📱' },
    { label: 'パソコン', emoji: '💻' }, { label: '運動', emoji: '🏃' }, { label: '雑談', emoji: '💬' },
    { label: '趣味', emoji: '🎨' }, { label: '読書', emoji: '📖' }, { label: '考え事', emoji: '🤔' },
    { label: '散歩', emoji: '🚶' }, { label: '家のこと', emoji: '🏠' }, { label: '買い物', emoji: '🛍️' },
    { label: '学び', emoji: '📚' }, { label: '人と会う', emoji: '🤝' }, { label: 'ひと休み', emoji: '🌿' }
  ];
  const POINT_ONLY = ['おもしろ発見']; // 開始・終了にせず、いつも「その場で記録」になるボタン
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
  const PALETTE = ['#2E6B5E', '#E3A72F', '#4C7A9F', '#B8432F', '#8A6FB0', '#5E9E6E', '#C97B3C', '#3E8E9E', '#9C6B57', '#6F7F3A', '#C2577C', '#7A8A8E', '#D08C9A', '#55707F', '#A0A040', '#7E5BA6', '#3F9C82', '#C8643B', '#6B8FC7'];
  const DRAW_COLORS = ['#1E2B33', '#2E6B5E', '#3E6FB0', '#E3A72F', '#B8432F', '#C2577C', '#7A5230'];
  const DRAW_SIZES = [3, 7, 14];
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const GEO_LABEL = { exact: '📍 地図で正確に', area: '🏙 市区町村まで', none: '🚫 場所は見せない' };
  const GEO_NOTE = { exact: '場所は地図で表示されます。', area: '場所は市区町村までの表示です。', none: '場所は表示されません。' };
  const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';

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
    open: [],
    recMode: lsGet('ashiato.mode') === 'point' ? 'point' : 'event',
    editMode: 'edit',
    todayLogs: [],
    guideStep: 0,
    guideFirst: false,
    histView: lsGet('ashiato.histView') === 'list' ? 'list' : 'cal',
    myCal: null,
    peopleCal: null,
    people: [],
    person: null,
    shares: [],
    editShare: null,
    extraCats: {}
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
  function catEmoji(label) { const c = state.cats.find(x => x.label === label); return c ? c.emoji : (state.extraCats[label] || '📍'); }
  /** 記録を索引に入れる（メモを持たない応答で、手元のメモを消さない） */
  function indexLog(l) {
    const old = state.logIndex[l.logId];
    if (old && old !== l && !('memos' in l) && old.memos) { l.memos = old.memos; l.memoCount = old.memoCount; }
    if (old && old._share && !l._share) l._share = old._share;
    state.logIndex[l.logId] = l;
    return l;
  }
  function fmtStamp(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return (d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() + '/' : '') + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function shiftMonth(ym, n) { const p = ym.split('-').map(Number); const d = new Date(p[0], p[1] - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function prefPrivateDefault() { return !!(state.user && state.user.prefs && state.user.prefs.privateDefault); }
  function updatePrivBadge() { $('#rec-priv-badge').hidden = !$('#rec-private').checked; }
  function starsText(n) { return n ? '★'.repeat(n) : ''; }
  function blobToDataUrl(blob) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('ファイルを読み込めませんでした')); r.readAsDataURL(blob); });
  }
  function fmtMin(m) {
    m = Math.round(m || 0);
    const h = Math.floor(m / 60), mm = m % 60;
    return h ? h + '時間' + (mm ? mm + '分' : '') : mm + '分';
  }
  function toLocalInput(d) { return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function fromLocalInput(v) { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; }
  function timeObj(d) { return { iso: d.toISOString(), dateKey: ymd(d), hour: d.getHours() }; }
  function dayStartMs(key) { const d = parseYmd(key); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function catColor(label) {
    const i = state.cats.findIndex(c => c.label === label);
    if (i >= 0) return PALETTE[i % PALETTE.length];
    let h = 0; for (const ch of String(label)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return PALETTE[h % PALETTE.length];
  }
  /** 「終了」記録（開始時刻つき）を日ごとに切り分けて分数を集計 → { 'YYYY-MM-DD': { カテゴリ: 分 } } */
  function minutesByDay(logs, fromMs, toMs) {
    const out = {};
    logs.forEach(l => {
      if (l.kind !== 'end' || !l.pairAt) return;
      let s = Math.max(fromMs, new Date(l.pairAt).getTime());
      const e = Math.min(toMs, new Date(l.timestamp).getTime());
      while (s < e) {
        const d = new Date(s);
        const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
        const k = ymd(d);
        (out[k] = out[k] || {})[l.category] = (out[k][l.category] || 0) + (Math.min(e, next) - s) / 60000;
        s = Math.min(e, next);
      }
    });
    return out;
  }
  function sumByCat(byDay) {
    const t = {};
    Object.values(byDay).forEach(day => Object.keys(day).forEach(c => { t[c] = (t[c] || 0) + day[c]; }));
    return t;
  }
  function dt(iso, ref) {
    const d = new Date(iso);
    return (ref && ymd(d) !== ymd(new Date(ref)) ? (d.getMonth() + 1) + '/' + d.getDate() + ' ' : '') + fmtTime(iso);
  }
  /** 開始・終了の表示文 */
  function eventText(l) {
    if (l.kind === 'start') return '▶ 開始 ' + fmtTime(l.timestamp) + (l.pairAt ? '　→ ' + dt(l.pairAt, l.timestamp) + ' 終了' : '　（終了待ち）');
    if (l.kind === 'end') return '■ 終了 ' + fmtTime(l.timestamp) + (l.pairAt ? '　（' + dt(l.pairAt, l.timestamp) + 'から ' + fmtMin(l.durationMin) + '）' : '　（開始の記録なし）');
    return fmtTime(l.timestamp);
  }
  function openFor(label) { return state.open.find(o => o.category === label); }
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
    renderMode();
    loadOpen();
    $('#rec-private').checked = prefPrivateDefault();
    updatePrivBadge();
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
    $('#btn-mic').addEventListener('click', () => toggleDictation());
    $('#rec-private').addEventListener('change', updatePrivBadge);
    $$('.mode-seg button').forEach(b => b.addEventListener('click', () => {
      state.recMode = b.dataset.mode;
      lsSet(LS.mode, state.recMode);
      renderMode();
    }));
    $('#open-list').addEventListener('click', ev => {
      const b = ev.target.closest('button[data-act]');
      if (!b) return;
      const o = state.open.find(x => x.logId === b.dataset.id);
      if (!o) return;
      if (b.dataset.act === 'end') endCategory(o.category);
      else openEdit(o);
    });
    $('#btn-add-event').addEventListener('click', () => openNewEvent());
    $('#today-time').addEventListener('click', ev => {
      const seg = ev.target.closest('[data-id]');
      if (seg && state.logIndex[seg.dataset.id] && !state.logIndex[seg.dataset.id].pending) openEdit(state.logIndex[seg.dataset.id]);
    });

    ['#today-list', '#fun-grid', '#fun-best', '#memories'].forEach(sel => $(sel).addEventListener('click', onLogClick));
    $('#history-list').addEventListener('click', ev => {
      const seg = ev.target.closest('.seg[data-id]');
      if (seg) { const l = state.logIndex[seg.dataset.id]; if (l) openEdit(l); return; }
      onLogClick(ev);
    });
    $('#btn-history-more').addEventListener('click', () => { state.historyDays += 30; loadHistory(); });
    $$('.view-seg button').forEach(b => b.addEventListener('click', () => setHistView(b.dataset.hv)));

    // みんな（公開してもらったあしあと）
    $('#people-list').addEventListener('click', ev => {
      const b = ev.target.closest('[data-share]');
      if (!b) return;
      const p = state.people.find(x => x.shareId === b.dataset.share);
      if (p) openPerson(p);
    });
    $('#btn-people-back').addEventListener('click', loadPeople);
    $('#btn-goto-share').addEventListener('click', () => {
      switchTab('settings');
      setTimeout(() => $('#share-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    });

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
    bindShares();
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
    if (name === 'history') setHistView(state.histView);
    if (name === 'people') loadPeople();
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
      '<button type="button" class="cat' + (i === 0 ? ' cat-fun' : '') + (openFor(c.label) ? ' is-open' : '') + '" data-i="' + i + '"><span class="em" aria-hidden="true">' + esc(c.emoji) + '</span>' + esc(c.label) + '</button>'
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

  async function onCatTap(cat, btn, opts) {
    opts = opts || {};
    if (!cat || state.saving) return;
    const asEvent = (opts.forceEvent || state.recMode === 'event') && POINT_ONLY.indexOf(cat.label) < 0;
    // 開始中なら「終了」、そうでなければ「開始」
    const eventKind = asEvent ? (openFor(cat.label) ? 'end' : 'start') : '';
    state.saving = true;
    stopDictation();
    if (btn) stamp(btn, eventKind);
    const now = new Date();
    const g = state.gps.status === 'ok' ? state.gps : {};
    const base = {
      timestamp: now.toISOString(), dateKey: ymd(now), hour: now.getHours(),
      lat: g.lat != null ? g.lat : null, lng: g.lng != null ? g.lng : null, accuracy: g.accuracy || null,
      placeName: g.placeName || '', address: g.address || '', area: g.area || '',
      category: cat.label, tags: Array.from(state.tags), note: $('#rec-note').value.trim(),
      fun: state.fun || (state.attach.length || cat.label === 'おもしろ発見' ? 1 : 0),
      capsuleUntil: capsuleDate(),
      private: $('#rec-private').checked
    };
    if (asEvent) base.kind = eventKind;
    const hasMedia = state.attach.length > 0;
    try {
      if (hasMedia) loading(true, 'おもしろを送っています…');
      const media = await prepareMedia(state.attach, pct => { $('#loading-text').textContent = '送っています… ' + pct + '%'; });
      if (hasMedia) $('#loading-text').textContent = '記録しています…';
      const r = await api('addLog', { log: Object.assign({}, base, { media: media }) });
      loading(false);
      resetForm();
      if (asEvent) {
        if (r.open) { state.open = r.open; renderOpen(); }
        if (eventKind === 'start') toast('▶ ' + cat.emoji + ' ' + cat.label + ' 開始 ' + fmtTime(r.log.timestamp));
        else if (r.log.pairAt) toast('■ ' + cat.emoji + ' ' + cat.label + ' 終了 ' + fmtTime(r.log.timestamp) + '（' + fmtMin(r.log.durationMin) + '）');
        else toast('■ ' + cat.label + ' 終了を記録しました（対応する開始が見つかりません。「＋ あとから追加」で開始を入れられます）');
        loadToday();
      } else {
        toast(base.capsuleUntil ? '🔒 タイムカプセルに入れました（' + fmtShort(base.capsuleUntil) + 'に開けられます）' : cat.emoji + ' ' + cat.label + 'を記録しました');
        prependToday(r.log);
      }
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
      if (base.kind === 'start') { state.open.unshift(Object.assign({}, log, { logId: 'pending-' + Date.now(), pending: true, open: true })); renderOpen(); }
      if (base.kind === 'end') { const o = openFor(base.category); if (o) { state.open = state.open.filter(x => x !== o); renderOpen(); } }
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

  function updateLogEverywhere(log, opts) {
    indexLog(log);
    $$('.log[data-id="' + log.logId + '"]').forEach(li => { li.outerHTML = logHtml(log, { num: Number(li.dataset.num) || 0 }); });
    $$('.tile[data-id="' + log.logId + '"]').forEach(t => { t.outerHTML = tileHtml(log); });
    if (!(opts && opts.skipDetail) && state.detailId === log.logId && !$('#modal-detail').hidden) renderDetail(log);
  }

  function stamp(btn, eventKind) {
    const old = $('.stamp-mark', btn);
    if (old) old.remove();
    const m = document.createElement('span');
    m.className = 'stamp-mark';
    const d = new Date();
    m.innerHTML = (eventKind === 'start' ? '開始' : eventKind === 'end' ? '終了' : '記録') + '<br>' + pad(d.getHours()) + ':' + pad(d.getMinutes());
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
    $('#rec-private').checked = prefPrivateDefault();
    updatePrivBadge();
    $('#extras').open = false;
  }

  /* ---------- 時間記録（開始・終了をそれぞれ記録） ---------- */
  function renderMode() {
    $$('.mode-seg button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.mode === state.recMode)));
    updateHint();
  }
  function updateHint() {
    const el = $('#rec-hint');
    if (!el) return;
    if (state.attach.length) el.textContent = '添付できました。やったことを押すと、おもしろと一緒に記録されます';
    else if (state.recMode === 'event') el.textContent = '1回押すと「開始」、もう一度押すと「終了」の時刻を記録します。いくつ同時に開始していても大丈夫です（🤩おもしろ発見はその場の記録）';
    else el.textContent = 'やったことをタップすると、いまの時刻と場所で記録されます';
  }

  async function loadOpen() {
    try {
      const r = await api('getOpen');
      state.open = r.open.concat(state.open.filter(o => o.pending));
      renderOpen();
    } catch (e) { }
  }

  /** 開始中のリストと、ボタンの「開始中」表示 */
  function renderOpen() {
    const box = $('#open-box');
    box.hidden = !state.open.length;
    $('#open-list').innerHTML = state.open.map(o => {
      indexLog(o);
      const d = new Date(o.timestamp);
      const when = (ymd(d) !== ymd(new Date()) ? (d.getMonth() + 1) + '/' + d.getDate() + ' ' : '') + fmtTime(o.timestamp);
      return '<li style="--cat-color:' + catColor(o.category) + '"><span class="ol-name">' + esc(catEmoji(o.category)) + ' ' + esc(o.category) + '</span>' +
        '<span class="ol-time">' + when + ' 開始' + (o.pending ? '（送信待ち）' : '') + '</span>' +
        (o.pending ? '' : '<button type="button" class="ol-btn ol-end" data-act="end" data-id="' + esc(o.logId) + '">■ 終了</button><button type="button" class="ol-btn" data-act="edit" data-id="' + esc(o.logId) + '">✎</button>') + '</li>';
    }).join('');
    $$('.cat').forEach(b => {
      const c = state.cats[Number(b.dataset.i)];
      const o = c && openFor(c.label);
      b.classList.toggle('is-open', !!o);
      if (o) b.dataset.since = fmtTime(o.timestamp) + '〜'; else delete b.dataset.since;
    });
  }

  function endCategory(label) {
    const cat = state.cats.find(c => c.label === label) || { label: label, emoji: catEmoji(label) };
    const btn = $$('.cat').find(b => state.cats[Number(b.dataset.i)] && state.cats[Number(b.dataset.i)].label === label);
    onCatTap(cat, btn, { forceEvent: true });
  }

  /** 1日の帯グラフ（0〜24時） */
  function dayBarHtml(dateKey, logs) {
    const ds = dayStartMs(dateKey), de = ds + 86400000;
    const now = Date.now();
    const segs = logs.filter(l => l.kind === 'end' && l.pairAt).map(l => {
      const s = Math.max(ds, new Date(l.pairAt).getTime());
      const e = Math.min(de, new Date(l.timestamp).getTime());
      if (e <= s) return '';
      state.logIndex[l.logId] = state.logIndex[l.logId] || l;
      const left = (s - ds) / 864e3, width = Math.max(0.4, (e - s) / 864e3);
      const label = l.category + ' ' + dt(l.pairAt, l.timestamp) + '〜' + fmtTime(l.timestamp) + '（' + fmtMin(l.durationMin) + '）';
      return '<button type="button" class="seg" data-id="' + esc(l.logId) + '" style="left:' + left.toFixed(2) + '%;width:' + width.toFixed(2) + '%;background:' + catColor(l.category) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '"></button>';
    }).join('') + logs.filter(l => l.kind === 'start' && !l.pairAt).map(l => {
      const s = new Date(l.timestamp).getTime();
      if (s < ds || s >= de) return '';
      state.logIndex[l.logId] = state.logIndex[l.logId] || l;
      return '<button type="button" class="seg open-mark" data-id="' + esc(l.logId) + '" style="left:' + ((s - ds) / 864e3).toFixed(2) + '%;--c:' + catColor(l.category) + '" title="' + esc(l.category + ' ' + fmtTime(l.timestamp) + ' 開始（終了待ち）') + '" aria-label="' + esc(l.category + ' 開始 終了待ち') + '"></button>';
    }).join('');
    const nowMark = (now > ds && now < de) ? '<span class="now-mark" style="left:' + ((now - ds) / 864e3).toFixed(2) + '%"></span>' : '';
    return '<div class="daybar">' + segs + nowMark + '</div><div class="daybar-ticks"><span>0時</span><span>6</span><span>12</span><span>18</span><span>24</span></div>';
  }

  function renderTodayTime() {
    const box = $('#today-time');
    if (!box) return;
    const key = ymd(new Date());
    const logs = state.todayLogs;
    const byDay = minutesByDay(logs, dayStartMs(key), dayStartMs(key) + 86400000);
    const tot = byDay[key] || {};
    const cats = Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
    if (!cats.length) {
      box.innerHTML = dayBarHtml(key, logs) + '<p class="muted small">⏱「開始・終了」でボタンを押して開始、もう一度押して終了すると、その差が何に何時間使ったかとしてここに出てきます。押し忘れたときは「＋ あとから追加」で。</p>';
      return;
    }
    const sum = cats.reduce((a, c) => a + tot[c], 0);
    box.innerHTML = dayBarHtml(key, logs) + timeListHtml(tot, cats) +
      '<p class="muted small">今日の合計：' + fmtMin(sum) + '（帯をタップすると開始・終了の時刻を直せます）</p>';
  }

  function timeListHtml(tot, cats) {
    const max = tot[cats[0]] || 1;
    return '<ul class="time-list">' + cats.map(c =>
      '<li><span class="tl-name">' + esc(catEmoji(c)) + ' ' + esc(c) + '</span><span class="tl-bar"><i style="width:' + (tot[c] / max * 100).toFixed(1) + '%;background:' + catColor(c) + '"></i></span><span class="tl-val">' + fmtMin(tot[c]) + '</span></li>'
    ).join('') + '</ul>';
  }

  /* ---------- 話して入力（間が空いても聞き取り続ける）：記録のひとこと・メモの両方で使う ---------- */
  const dict = { active: false, rec: null, stopAt: 0, fatal: '', lastFinal: '', ta: null, btn: null, live: null, max: 500 };

  function recDictCfg() {
    return { ta: $('#rec-note'), btn: $('#btn-mic'), live: $('#dict-live'), max: 500, onStart: () => { $('#extras').open = true; } };
  }

  function toggleDictation(cfg) {
    cfg = cfg || recDictCfg();
    if (dict.active) {
      const same = dict.btn === cfg.btn;
      stopDictation();
      if (same) return;
    }
    startDictation(cfg);
  }

  function startDictation(cfg) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('このブラウザは音声入力に対応していません。「声メモ」なら録音で残せます', 'err'); return; }
    if (cfg.onStart) cfg.onStart();
    dict.active = true; dict.fatal = ''; dict.stopAt = Date.now() + 5 * 60 * 1000;
    dict.ta = cfg.ta; dict.btn = cfg.btn; dict.live = cfg.live; dict.max = cfg.max || 500;
    if (dict.btn) { dict.btn.classList.add('on'); dict.btn.setAttribute('aria-label', '話して入力を止める'); }
    if (dict.live) { dict.live.hidden = false; dict.live.textContent = '聞き取り中…（話し終えたら 🗣 をもう一度押してください）'; }
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
      if (dict.live) dict.live.textContent = interim ? '…' + interim : '聞き取り中…（間が空いても続けて聞いています）';
    };
    rec.onerror = e => {
      if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(e.error)) dict.fatal = e.error;
    };
    rec.onend = () => {
      dict.rec = null;
      if (dict.active && !dict.fatal && Date.now() < dict.stopAt && dict.ta && dict.ta.isConnected) {
        // 無音で止まっても、止めるボタンが押されるまで自動で聞き直す
        setTimeout(() => { if (dict.active && !dict.rec) runDictation(); }, 150);
      } else {
        if (dict.fatal) toast('マイクが使えません。ブラウザの設定でマイクを許可してください', 'err');
        else if (dict.active && Date.now() >= dict.stopAt) toast('5分たったので音声入力を止めました');
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
    if (!t || !dict.ta) return;
    let add = t;
    if (dict.lastFinal && t.indexOf(dict.lastFinal) === 0) add = t.slice(dict.lastFinal.length).trim();
    dict.lastFinal = t;
    if (!add) return;
    const ta = dict.ta;
    const v = ta.value;
    const sep = !v || /[\s、。！？!?]$/.test(v) ? '' : '、';
    ta.value = (v + sep + add).slice(0, dict.max);
  }

  function stopDictation() {
    const was = dict.active;
    dict.active = false;
    if (dict.rec) { try { dict.rec.stop(); } catch (e) { } }
    if (dict.btn) { dict.btn.classList.remove('on'); dict.btn.setAttribute('aria-label', '話して入力'); }
    if (dict.live) dict.live.hidden = true;
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
    updateHint();
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

  function logHtml(l, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    indexLog(l);
    const ro = !!l._share;
    const place = l.placeName || l.area || (l.lat != null ? '位置のみ' : '場所なし');
    let body = '';
    if (l.sealed) {
      body = '<div class="sealed-line">🔒 タイムカプセル（' + fmtShort(l.capsuleUntil) + 'に開けられます）</div>';
    } else {
      const tags = (l.tags || []).map(t => '<span>' + esc(t) + '</span>').join('');
      const media = (l.media || []).slice(0, 5).map(m => '<span class="mthumb mt-' + m.type + '">' + thumbHtml(m) + '</span>').join('');
      const cap = l.ai && l.ai.caption ? '<div class="log-ai">🤖 ' + esc(l.ai.caption) + '</div>' : '';
      const memos = l.memos || [];
      const memo = memos.length ? '<div class="log-memo">📝 ' + esc(memos[memos.length - 1].text.slice(0, 80)) + (memos.length > 1 ? '<span class="muted">（ほか' + (memos.length - 1) + '件）</span>' : '') + '</div>' : '';
      body = (media ? '<div class="log-media">' + media + '</div>' : '') + cap +
        (l.note ? '<div class="log-note">' + esc(l.note) + '</div>' : '') + memo +
        (tags ? '<div class="log-tags">' + tags + '</div>' : '');
    }
    const isEv = l.kind === 'start' || l.kind === 'end';
    let acts = '';
    if (l.pending) acts = '<span class="muted small">送信待ち</span>';
    else if (!ro) {
      acts = (l.kind === 'start' && !l.pairAt ? '<button type="button" data-act="end">■ 終了する</button>' : '') +
        (l.sealed ? '' : '<button type="button" data-act="memo">📝 メモ</button>') +
        '<button type="button" data-act="edit">' + (isEv ? '時刻を直す' : '直す') + '</button>';
    }
    const cls = ' ev-' + (l.kind || 'point') + (l.kind === 'start' && !l.pairAt ? ' is-open' : '') + (l.kind === 'end' && !l.pairAt ? ' is-orphan' : '');
    return '<li class="log' + (l.pending ? ' pending' : '') + (l.fun ? ' is-fun' : '') + (ro ? ' is-shared' : '') + cls + '" data-id="' + esc(l.logId) + '"' + (opts.num ? ' data-num="' + opts.num + '"' : '') + (isEv ? ' style="--cat-color:' + catColor(l.category) + '"' : '') + '>' +
      '<div class="log-head">' + (opts.num ? '<span class="log-num" aria-label="地図の' + opts.num + '番">' + opts.num + '</span>' : '') +
      '<span class="log-cat">' + esc(catEmoji(l.category)) + ' ' + esc(l.category) + '</span>' +
      '<span class="log-time">' + esc(isEv ? eventText(l) : fmtTime(l.timestamp)) + '</span>' +
      (l.fun ? '<span class="log-star" aria-label="おもしろ度' + l.fun + '">' + starsText(l.fun) + '</span>' : '') +
      (l.private ? '<span class="log-priv">🙈 自分だけ</span>' : '') +
      (l.memoCount ? '<span class="log-mc" aria-label="メモ' + l.memoCount + '件">📝' + l.memoCount + '</span>' : '') + '</div>' +
      '<div class="log-place">' + esc(place) + '</div>' + body +
      (acts ? '<div class="log-actions">' + acts + '</div>' : '') + '</li>';
  }

  function tileHtml(l) {
    indexLog(l);
    if (l.sealed) {
      return '<button type="button" class="tile sealed" data-id="' + esc(l.logId) + '"><span class="tile-vis"><span class="ico">🔒</span></span>' +
        '<span class="tile-cap">' + fmtShort(l.capsuleUntil) + 'に開封</span><span class="tile-date">' + fmtShort(l.dateKey) + 'に封印</span></button>';
    }
    const m = (l.media || [])[0];
    const vis = m ? thumbHtml(m) : '<span class="ico">' + esc(catEmoji(l.category)) + '</span>';
    const kinds = Array.from(new Set((l.media || []).map(x => MEDIA_ICON[x.type]))).join('') + (l.memoCount ? '📝' : '');
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
      state.todayLogs = r.logs;
      list.innerHTML = logs.map(logHtml).join('');
      toggleTodayEmpty(!logs.length);
      renderTodayTime();
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
      const byDay = minutesByDay(r.logs, dayStartMs(ymd(from)), Date.now());
      Object.keys(byDay).forEach(d => { groups[d] = groups[d] || []; });
      const thisYear = new Date().getFullYear();
      box.innerHTML = Object.keys(groups).sort().reverse().map(d => {
        const arr = groups[d].sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);
        const mins = byDay[d] || {};
        const total = Object.values(mins).reduce((a, b) => a + b, 0);
        const top = Object.keys(mins).sort((a, b) => mins[b] - mins[a]).slice(0, 3).map(c => catEmoji(c) + fmtMin(mins[c])).join('　');
        return '<div class="day-h"><span>' + fmtDay(d, parseYmd(d).getFullYear() !== thisYear) + '</span><span class="count">' + arr.length + '件' + (total ? '・計測 ' + fmtMin(total) : '') + '</span></div>' +
          (total ? '<div class="day-time">' + dayBarHtml(d, r.logs) + '<p class="small muted">' + esc(top) + '</p></div>' : '') +
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
    if (act && !l._share) {
      if (act.dataset.act === 'edit') { openEdit(l); return; }
      if (act.dataset.act === 'end') { endCategory(l.category); return; }
      if (act.dataset.act === 'memo') { openDetail(l.logId, { memo: true }); return; }
    }
    openDetail(l.logId);
  }

  function refreshLists() {
    if (state.tab === 'record') loadToday();
    if (state.tab === 'history') { if (state.histView === 'cal' && state.myCal) calLoad(state.myCal); else loadHistory(); }
    if (state.tab === 'fun') loadFun(true);
    if (state.tab === 'review') loadReview();
  }

  /* ================= くわしく見る（メディア再生） ================= */
  function openDetail(logId, opts) {
    const l = state.logIndex[logId];
    if (!l) return;
    state.detailId = logId;
    renderDetail(l);
    openModal('modal-detail');
    if (opts && opts.memo) {
      setTimeout(() => {
        const ta = $('#memo-new');
        if (ta) { ta.scrollIntoView({ block: 'center' }); ta.focus(); }
      }, 80);
    }
  }

  function renderDetail(l) {
    const box = $('#detail-body');
    const ro = !!l._share;
    const place = l.placeName || l.area || '場所なし';
    let html = '<h3 id="detail-title">' + esc(catEmoji(l.category)) + ' ' + esc(l.category) + '</h3>' +
      '<p class="muted small">' + fmtDay(l.dateKey, true) + ' ' + fmtTime(l.timestamp) + '｜' + esc(place) +
      (l.private ? '｜🙈 自分だけ' : '') + (ro ? '｜見るだけ' : '') + '</p>';
    if (l.kind === 'start' || l.kind === 'end') html += '<p class="small detail-ev">' + esc(eventText(l)) + '</p>';
    if (l.sealed) {
      html += '<div class="sealed-big"><span aria-hidden="true">🔒</span><p>' + fmtDay(l.capsuleUntil, true) + 'に開けられるタイムカプセルです。<br>それまで中身は見えません。</p></div>';
      box.innerHTML = html;
      $('#btn-detail-edit').hidden = true;
      return;
    }
    $('#btn-detail-edit').hidden = ro;
    html += ro
      ? (l.fun ? '<p class="log-star detail-star" aria-label="おもしろ度' + l.fun + '">' + starsText(l.fun) + '</p>' : '')
      : '<div class="field-row"><span class="field-label">おもしろ度</span><div class="stars" id="detail-stars"></div></div>';
    if (l.note) html += '<p class="detail-note">' + esc(l.note) + '</p>';
    if (l.ai && l.ai.tags && l.ai.tags.length) html += '<div class="log-tags">' + l.ai.tags.map(t => '<span>#' + esc(t) + '</span>').join('') + '</div>';
    if ((l.tags || []).length) html += '<div class="log-tags">' + l.tags.map(t => '<span>' + esc(t) + '</span>').join('') + '</div>';
    html += '<div class="media-list">' + (l.media || []).map(m => mediaBlockHtml(l, m, ro)).join('') + '</div>';
    html += memoSectionHtml(l, ro);
    box.innerHTML = html;

    if (!ro) {
      renderStars($('#detail-stars'), l.fun || 0, async v => {
        try {
          const r = await api('updateLog', { logId: l.logId, fields: { fun: v } });
          updateLogEverywhere(r.log);
        } catch (e) { toast(e.message, 'err'); }
      });
    }
    // 画像は自動で大きく読み込む
    (l.media || []).forEach(m => { if (m.type === 'photo' || m.type === 'drawing') loadMedia(l, m); });
    box.onclick = ev => {
      const b = ev.target.closest('[data-mload]');
      if (b) { const m = l.media.find(x => x.id === b.dataset.mload); if (m) loadMedia(l, m, true); return; }
      const e2 = ev.target.closest('[data-enrich]');
      if (e2 && !ro) {
        e2.disabled = true; e2.textContent = 'AIが見ています…';
        api('enrichLog', { logId: l.logId, mediaId: e2.dataset.enrich }).then(r => updateLogEverywhere(r.log)).catch(err => toast(err.message, 'err'));
        return;
      }
      if (ro) return;
      const cur = state.logIndex[l.logId] || l;
      const mic = ev.target.closest('#btn-memo-mic');
      if (mic) { toggleDictation({ ta: $('#memo-new'), btn: mic, live: $('#memo-live'), max: 1000 }); return; }
      const add = ev.target.closest('[data-memo-add]');
      if (add) { addMemo(cur, add); return; }
      const li = ev.target.closest('li[data-memo]');
      if (!li) return;
      if (ev.target.closest('[data-memo-edit]')) startMemoEdit(cur, li);
      else if (ev.target.closest('[data-memo-del]')) delMemo(cur, li.dataset.memo);
      else if (ev.target.closest('[data-memo-save]')) saveMemoEdit(cur, li);
      else if (ev.target.closest('[data-memo-cancel]')) rerenderMemos(cur);
    };
  }

  /* ---------- メモ（あとから書き足す・直す・消す） ---------- */
  function memoSectionHtml(l, ro) {
    const memos = l.memos || [];
    let h = '<section class="memo-sec" aria-label="メモ"><h4>📝 あとからのメモ' + (memos.length ? '（' + memos.length + '）' : '') + '</h4>';
    h += memos.length
      ? '<ul class="memo-list">' + memos.map(m => memoItemHtml(m, ro)).join('') + '</ul>'
      : '<p class="muted small">' + (ro ? 'メモはありません。' : 'まだメモはありません。あとで思い出したこと、その後どうなったかなどを書き足せます。') + '</p>';
    if (!ro) {
      h += '<div class="memo-add"><div class="note-row"><textarea id="memo-new" rows="3" maxlength="1000" placeholder="例：このあと友だちに話したら、同じお店を知っていた"></textarea>' +
        '<button type="button" class="icon-btn" id="btn-memo-mic" aria-label="話して入力">🗣</button></div>' +
        '<p class="dict-live small" id="memo-live" hidden></p>' +
        '<button type="button" class="btn btn-primary small-btn" data-memo-add>＋ メモを書き足す</button></div>';
    }
    return h + '</section>';
  }

  function memoItemHtml(m, ro) {
    return '<li data-memo="' + esc(m.memoId) + '"><p class="memo-text">' + esc(m.text) + '</p>' +
      '<div class="memo-meta"><span>' + fmtStamp(m.createdAt) + (m.updatedAt ? '（' + fmtStamp(m.updatedAt) + ' に直した）' : '') + '</span>' +
      (ro ? '' : '<span class="memo-btns"><button type="button" data-memo-edit>✎ 直す</button><button type="button" data-memo-del class="del">消す</button></span>') + '</div></li>';
  }

  function rerenderMemos(l) {
    const sec = $('#detail-body .memo-sec');
    if (!sec || state.detailId !== l.logId) return;
    if (dict.active && dict.ta && sec.contains(dict.ta)) stopDictation();
    sec.outerHTML = memoSectionHtml(l, !!l._share);
  }

  function applyMemos(l, memos) {
    l.memos = memos;
    l.memoCount = memos.length;
    rerenderMemos(l);
    updateLogEverywhere(l, { skipDetail: true });
    [state.myCal].forEach(c => {
      if (!c) return;
      c.monthLogs.forEach(x => { if (x.logId === l.logId) { x.memos = memos; x.memoCount = memos.length; } });
    });
  }

  async function addMemo(l, btn) {
    const ta = $('#memo-new');
    const text = ta.value.trim();
    if (!text) { toast('メモを入れてください', 'err'); ta.focus(); return; }
    stopDictation();
    btn.disabled = true;
    try {
      const r = await api('addMemo', { logId: l.logId, text: text });
      applyMemos(l, r.memos);
      toast('📝 メモを書き足しました');
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; }
  }

  function startMemoEdit(l, li) {
    const m = (l.memos || []).find(x => x.memoId === li.dataset.memo);
    if (!m) return;
    li.innerHTML = '<textarea class="memo-edit" rows="4" maxlength="1000" aria-label="メモを直す">' + esc(m.text) + '</textarea>' +
      '<div class="memo-meta"><span></span><span class="memo-btns"><button type="button" data-memo-cancel>やめる</button><button type="button" data-memo-save class="save">保存</button></span></div>';
    const ta = $('textarea', li);
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }

  async function saveMemoEdit(l, li) {
    const text = $('textarea', li).value.trim();
    if (!text) { toast('メモが空です。消すときは「消す」を押してください', 'err'); return; }
    try {
      const r = await api('updateMemo', { memoId: li.dataset.memo, text: text });
      applyMemos(l, r.memos);
      toast('メモを直しました');
    } catch (e) { toast(e.message, 'err'); }
  }

  async function delMemo(l, memoId) {
    if (!confirm('このメモを消しますか？')) return;
    try {
      const r = await api('deleteMemo', { memoId: memoId });
      applyMemos(l, r.memos);
      toast('メモを消しました');
    } catch (e) { toast(e.message, 'err'); }
  }

  function mediaBlockHtml(l, m, ro) {
    const id = esc(m.id || '');
    const cap = m.caption ? '<p class="m-cap">🤖 ' + esc(m.caption) + '</p>' : '';
    const pending = (!ro && m.type !== 'url' && !m.ai && !m.aiError) ? '<p class="muted small">AIがひとことを準備中です</p>' : '';
    const retry = (!ro && m.aiError) ? '<button type="button" class="link-btn small" data-enrich="' + id + '">AIにもう一度見てもらう</button>' : '';
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
        r = l._share
          ? await api('sharedMedia', { shareId: l._share, logId: l.logId, mediaId: m.id })
          : await api('getMedia', { logId: l.logId, mediaId: m.id });
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
    indexLog(l);
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
        indexLog(l);
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
  function openEdit(l, opts) {
    opts = opts || {};
    if (l.sealed) { toast('タイムカプセルは開封日まで直せません'); return; }
    if (l.pending) { toast('送信待ちの記録は、送られてから直せます'); return; }
    state.editMode = 'edit';
    state.editing = l;
    state.editFun = l.fun || 0;
    const f = $('#form-edit');
    fillCategorySelect(f, l.category, l.kind === 'start' || l.kind === 'end');
    f.placeName.value = l.placeName || '';
    f.note.value = l.note || '';
    f.private.checked = !!l.private;
    $('#edit-memo-hint').hidden = false;
    renderStars($('#edit-stars'), state.editFun, v => { state.editFun = v; });
    const isEv = l.kind === 'start' || l.kind === 'end';
    const hasPartner = isEv && !!l.pairId && !!l.pairAt;
    $('#edit-title').textContent = '記録を直す';
    $('#edit-when').textContent = isEv ? l.category + '：' + eventText(l) : fmtDay(l.dateKey, true) + ' ' + fmtTime(l.timestamp);
    $('#te-type-row').hidden = false;
    f.addType.querySelector('option[value=point]').hidden = false;
    f.addType.value = hasPartner ? 'both' : (isEv ? l.kind : 'point');
    f.main.value = toLocalInput(new Date(l.timestamp));
    f.partner.value = hasPartner ? toLocalInput(new Date(l.pairAt)) : '';
    $('#btn-edit-delete').hidden = false;
    syncTimeEdit();
    openModal('modal-edit');
  }

  function openNewEvent(dateKey) {
    state.editMode = 'new';
    state.editing = null;
    state.editFun = 0;
    const f = $('#form-edit');
    f.reset();
    f.private.checked = prefPrivateDefault();
    $('#edit-memo-hint').hidden = true;
    $('#edit-time').classList.remove('partner-first');
    let now = new Date();
    now.setSeconds(0, 0);
    now.setMinutes(Math.floor(now.getMinutes() / 5) * 5);
    if (typeof dateKey === 'string' && dateKey && dateKey !== ymd(now)) { now = parseYmd(dateKey); now.setHours(13, 0, 0, 0); } // カレンダーで選んだ日
    const cat = state.cats.find(c => POINT_ONLY.indexOf(c.label) < 0);
    fillCategorySelect(f, cat ? cat.label : '', true);
    $('#edit-title').textContent = 'あとから追加';
    $('#edit-when').textContent = (typeof dateKey === 'string' && dateKey ? fmtDay(dateKey, true) + '｜' : '') + '押し忘れた開始・終了を、時刻を指定して入れられます。';
    $('#te-type-row').hidden = false;
    f.addType.querySelector('option[value=point]').hidden = true;
    f.addType.value = 'both';
    f.main.value = toLocalInput(new Date(now.getTime() - 3600000));
    f.partner.value = toLocalInput(now);
    $('#btn-edit-delete').hidden = true;
    renderStars($('#edit-stars'), 0, v => { state.editFun = v; });
    syncTimeEdit();
    openModal('modal-edit');
  }

  function fillCategorySelect(f, current, spanOnly) {
    const labels = state.cats.map(c => c.label).filter(x => !spanOnly || POINT_ONLY.indexOf(x) < 0);
    if (current && labels.indexOf(current) < 0) labels.push(current);
    f.category.innerHTML = labels.map(x => '<option value="' + esc(x) + '"' + (x === current ? ' selected' : '') + '>' + esc(catEmoji(x)) + ' ' + esc(x) + '</option>').join('');
  }

  /** 選んだ種類から、この記録自体が 開始/終了/その場 のどれになるか */
  function thisKindFromForm() {
    const t = $('#form-edit').addType.value;
    if (state.editMode === 'new') return t === 'end' ? 'end' : 'start';
    if (t === 'both') return state.editing && state.editing.kind === 'end' ? 'end' : 'start';
    return t;
  }

  /** 時刻入力の表示を整え、開始〜終了の差（所要時間）を出す */
  function syncTimeEdit() {
    const f = $('#form-edit');
    const dur = $('#te-dur');
    dur.classList.remove('bad');
    const type = f.addType.value;
    const k = thisKindFromForm();
    const both = type === 'both';
    $('#te-main-label').textContent = k === 'start' ? '開始' : k === 'end' ? '終了' : '時刻';
    $('#te-partner-block').hidden = !both;
    $('#te-partner-label').textContent = k === 'end' ? '開始' : '終了';
    $('#edit-time').classList.toggle('partner-first', both && k === 'end'); // いつも「開始」を上に
    if (both && !f.partner.value) {
      // 相手の時刻が空なら、とりあえず1時間の幅で入れておく
      const m = fromLocalInput(f.main.value) || new Date();
      const d = k === 'start' ? new Date(Math.min(Date.now(), m.getTime() + 3600000)) : new Date(m.getTime() - 3600000);
      f.partner.value = toLocalInput(d);
    }
    const pair = timesFromForm();
    if (!pair.start || !pair.end) { dur.textContent = ''; return; }
    const m = (pair.end - pair.start) / 60000;
    if (m < 0) { dur.textContent = '終了が開始より前になっています'; dur.classList.add('bad'); return; }
    dur.textContent = '差：' + fmtMin(m);
  }

  /** フォームから開始・終了の時刻を読む（片方だけのときは null） */
  function timesFromForm() {
    const f = $('#form-edit');
    const main = fromLocalInput(f.main.value);
    const partner = $('#te-partner-block').hidden ? null : fromLocalInput(f.partner.value);
    if (thisKindFromForm() === 'end') return { main: main, partner: partner, start: partner, end: main };
    return { main: main, partner: partner, start: main, end: partner };
  }

  /* ================= カレンダー（自分の履歴・公開してもらった人の両方で使う） ================= */
  function setHistView(v) {
    state.histView = v === 'list' ? 'list' : 'cal';
    lsSet(LS.hist, state.histView);
    $$('.view-seg button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.hv === state.histView)));
    $('#history-cal').hidden = state.histView !== 'cal';
    $('#history-listwrap').hidden = state.histView !== 'list';
    if (state.histView === 'cal') {
      if (!state.myCal) state.myCal = createCal($('#history-cal'), { kind: 'mine' });
      calLoad(state.myCal);
    } else {
      state.historyDays = 30;
      loadHistory();
    }
  }

  function createCal(root, src) {
    const c = { root: root, src: src, month: ymd(new Date()).slice(0, 7), sel: ymd(new Date()), monthLogs: [], dayLogs: [], map: null, seq: 0, daySeq: 0 };
    root.innerHTML = '<div class="cal"></div><div class="cal-day"></div>';
    root.addEventListener('click', ev => onCalClick(c, ev));
    return c;
  }

  function resetCal(c, src) {
    c.src = src;
    c.month = ymd(new Date()).slice(0, 7);
    c.sel = ymd(new Date());
    c.monthLogs = []; c.dayLogs = [];
    c.seq++; c.daySeq++;
    removeCalMap(c);
    $('.cal', c.root).innerHTML = '';
    $('.cal-day', c.root).innerHTML = '';
  }

  async function calFetch(c, from, to, thumbs) {
    if (c.src.kind === 'mine') return (await api('listLogs', { from: from, to: to, thumbs: thumbs })).logs;
    const r = await api('sharedLogs', { shareId: c.src.shareId, from: from, to: to, thumbs: thumbs });
    Object.assign(state.extraCats, r.cats || {});
    return r.logs.map(l => { l._share = c.src.shareId; return l; });
  }

  function monthEnd(ym) { const p = ym.split('-').map(Number); return ym + '-' + pad(new Date(p[0], p[1], 0).getDate()); }

  async function calLoad(c) {
    const seq = ++c.seq;
    const box = $('.cal', c.root);
    if (!box.innerHTML) box.innerHTML = '<p class="muted">読み込んでいます…</p>';
    box.classList.add('busy');
    let logs;
    try {
      logs = await calFetch(c, c.month + '-01', monthEnd(c.month), false);
    } catch (e) {
      if (seq === c.seq) calError(c, e);
      return;
    } finally {
      if (seq === c.seq) box.classList.remove('busy');
    }
    if (seq !== c.seq) return;
    c.monthLogs = logs;
    const today = ymd(new Date());
    if (!c.sel || c.sel.slice(0, 7) !== c.month) {
      if (c.month === today.slice(0, 7)) c.sel = today;
      else {
        const days = logs.map(l => l.dateKey).filter(d => d.slice(0, 7) === c.month).sort();
        c.sel = days.length ? days[days.length - 1] : '';
      }
    }
    renderCalGrid(c);
    calLoadDay(c);
  }

  function calError(c, e) {
    if (e.code === 'SHARE_OFF' && c.src.kind === 'share') { toast(e.message, 'err'); loadPeople(); return; }
    $('.cal', c.root).innerHTML = '<div class="empty">' + esc(e.message) + '</div>';
  }

  function renderCalGrid(c) {
    const p = c.month.split('-').map(Number);
    const first = new Date(p[0], p[1] - 1, 1, 12);
    const ndays = new Date(p[0], p[1], 0).getDate();
    const today = ymd(new Date());
    const lastKey = monthEnd(c.month);
    const by = {};
    c.monthLogs.forEach(l => { (by[l.dateKey] = by[l.dateKey] || []).push(l); });
    const mins = minutesByDay(c.monthLogs, dayStartMs(c.month + '-01'), Math.min(Date.now(), dayStartMs(lastKey) + 86400000));
    let cells = WD.map((w, i) => '<span class="cal-wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + w + '</span>').join('');
    for (let i = 0; i < first.getDay(); i++) cells += '<span class="cal-cell blank" aria-hidden="true"></span>';
    let total = 0, active = 0, totalMin = 0;
    for (let d = 1; d <= ndays; d++) {
      const key = c.month + '-' + pad(d);
      const all = by[key] || [];
      const arr = all.filter(l => l.kind !== 'end'); // 開始と終了で二重に数えない
      const mm = mins[key] || {};
      let cats = Object.keys(mm).sort((a, b) => mm[b] - mm[a]);
      if (!cats.length) {
        const cnt = {};
        arr.forEach(l => { cnt[l.category] = (cnt[l.category] || 0) + 1; });
        cats = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
      }
      const n = arr.length;
      total += n; if (n) active++;
      totalMin += Object.values(mm).reduce((a, b) => a + b, 0);
      const lv = n === 0 ? 0 : n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4;
      const icons = (arr.some(l => l.mediaCount > 0) ? '📷' : '') + (arr.some(l => l.fun > 0) ? '★' : '') + (all.some(l => l.memoCount > 0) ? '📝' : '');
      const dow = (first.getDay() + d - 1) % 7;
      const dots = cats.slice(0, 3).map(x => '<i style="background:' + catColor(x) + '"></i>').join('');
      cells += '<button type="button" class="cal-cell lv' + lv + (key === today ? ' is-today' : '') + (key === c.sel ? ' is-sel' : '') + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '') + '" data-day="' + key + '"' +
        (key > today ? ' disabled' : '') + ' aria-label="' + p[1] + '月' + d + '日 ' + n + '件"' + (key === c.sel ? ' aria-pressed="true"' : '') + '>' +
        '<span class="cd-num">' + d + '</span>' + (n ? '<span class="cd-n">' + n + '</span>' : '') +
        '<span class="cd-dots">' + dots + '</span>' + (icons ? '<span class="cd-ic">' + icons + '</span>' : '') + '</button>';
    }
    const isNow = c.month >= today.slice(0, 7);
    $('.cal', c.root).innerHTML =
      '<div class="cal-nav"><button type="button" class="icon-btn" data-cal="prev" aria-label="前の月">‹</button>' +
      '<h3>' + p[0] + '年' + p[1] + '月</h3>' +
      '<button type="button" class="icon-btn" data-cal="next" aria-label="次の月"' + (isNow ? ' disabled' : '') + '>›</button>' +
      '<button type="button" class="btn btn-ghost small-btn" data-cal="today"' + (isNow && c.sel === today ? ' disabled' : '') + '>今日</button></div>' +
      '<p class="cal-sum small muted">この月：記録 ' + total + '件・' + active + '日' + (totalMin ? '・計測 ' + fmtMin(totalMin) : '') + '</p>' +
      '<div class="cal-grid">' + cells + '</div>' +
      '<div class="cal-legend small muted"><span>少</span><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i><span>多</span><span class="cl-ic">📷写真など ★おもしろ 📝メモ</span></div>';
  }

  function removeCalMap(c) { if (c.map) { try { c.map.remove(); } catch (e) { } c.map = null; } }

  async function calLoadDay(c) {
    const box = $('.cal-day', c.root);
    removeCalMap(c);
    const seq = ++c.daySeq;
    if (!c.sel) { box.innerHTML = '<p class="muted small cal-tip">日付をタップすると、その日のあしあとが見られます。</p>'; return; }
    box.innerHTML = '<div class="cd-panel"><div class="cd-head"><h3>' + fmtDay(c.sel, true) + '</h3></div><p class="muted">読み込んでいます…</p></div>';
    let logs;
    try { logs = await calFetch(c, c.sel, c.sel, true); } catch (e) {
      if (seq !== c.daySeq) return;
      if (e.code === 'SHARE_OFF') { calError(c, e); return; }
      box.innerHTML = '<div class="empty">' + esc(e.message) + '</div>';
      return;
    }
    if (seq !== c.daySeq) return;
    c.dayLogs = logs;
    renderCalDay(c);
  }

  function renderCalDay(c) {
    const d = c.sel, ro = c.src.kind !== 'mine';
    const box = $('.cal-day', c.root);
    removeCalMap(c);
    const logs = c.dayLogs;
    const shown = logs.filter(l => l.dateKey === d).sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);
    const nums = {};
    let n = 0;
    shown.forEach(l => { if (l.lat != null && l.lng != null && l.kind !== 'end') nums[l.logId] = ++n; });
    const byDay = minutesByDay(logs, dayStartMs(d), Math.min(Date.now(), dayStartMs(d) + 86400000));
    const tot = byDay[d] || {};
    const cats = Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
    const sum = cats.reduce((a, x) => a + tot[x], 0);
    const count = shown.filter(l => l.kind !== 'end').length;
    let html = '<div class="cd-panel"><div class="cd-head"><h3>' + fmtDay(d, true) + '</h3><span class="muted small">' + count + '件' + (sum ? '・計測 ' + fmtMin(sum) : '') + '</span></div>';
    if (!ro) html += '<button type="button" class="btn btn-ghost small-btn cd-add" data-cal="add">＋ この日に開始・終了を追加</button>';
    if (!shown.length && !cats.length) {
      html += '<p class="trail-empty">この日のあしあとはありません。</p>';
    } else {
      html += '<h4 class="cd-sub">時間の使い方</h4>' + dayBarHtml(d, logs) +
        (cats.length ? timeListHtml(tot, cats) : '<p class="muted small">開始・終了がそろった記録はありません。</p>');
      if (n) html += '<h4 class="cd-sub">行った場所</h4><div class="day-map" role="region" aria-label="この日の地図"></div><p class="muted small">地図の番号は、下の記録の番号と同じ順番です。</p>';
      html += '<h4 class="cd-sub">朝から順に</h4><ol class="trail">' + shown.map(l => logHtml(l, { num: nums[l.logId] })).join('') + '</ol>';
    }
    box.innerHTML = html + '</div>';
    if (n) drawDayMap(c, shown.filter(l => nums[l.logId]));
  }

  function onCalClick(c, ev) {
    const nav = ev.target.closest('[data-cal]');
    if (nav) {
      const a = nav.dataset.cal;
      if (a === 'prev' || a === 'next') { c.month = shiftMonth(c.month, a === 'prev' ? -1 : 1); calLoad(c); }
      else if (a === 'today') { c.sel = ymd(new Date()); c.month = c.sel.slice(0, 7); calLoad(c); }
      else if (a === 'add') openNewEvent(c.sel);
      return;
    }
    const day = ev.target.closest('[data-day]');
    if (day) {
      c.sel = day.dataset.day;
      $$('.cal-cell.is-sel', c.root).forEach(x => { x.classList.remove('is-sel'); x.removeAttribute('aria-pressed'); });
      day.classList.add('is-sel');
      day.setAttribute('aria-pressed', 'true');
      const t = $('[data-cal=today]', c.root);
      if (t) t.disabled = c.sel === ymd(new Date());
      calLoadDay(c);
      setTimeout(() => { const pnl = $('.cal-day', c.root); if (pnl && pnl.getBoundingClientRect().top > window.innerHeight * 0.75) pnl.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
      return;
    }
    const seg = ev.target.closest('.seg[data-id]');
    if (seg) {
      const l = state.logIndex[seg.dataset.id];
      if (l) { if (l._share) openDetail(l.logId); else openEdit(l); }
      return;
    }
    if (ev.target.closest('.day-map')) return;
    onLogClick(ev);
  }

  /** 地図（Leaflet＋OpenStreetMap）は使うときだけ読み込む */
  function ensureLeaflet() {
    if (window.L && window.L.map) return Promise.resolve();
    if (ensureLeaflet.p) return ensureLeaflet.p;
    ensureLeaflet.p = new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET + 'leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = LEAFLET + 'leaflet.js';
      js.onload = () => resolve();
      js.onerror = () => { ensureLeaflet.p = null; reject(new Error('地図を読み込めませんでした')); };
      document.head.appendChild(js);
    });
    return ensureLeaflet.p;
  }

  async function drawDayMap(c, pts) {
    const el = $('.day-map', c.root);
    if (!el) return;
    try { await ensureLeaflet(); } catch (e) {
      el.innerHTML = '<p class="muted small map-fail">地図を読み込めませんでした（通信状態をご確認ください）</p>';
      return;
    }
    if (!el.isConnected || el.dataset.drawn) return;
    el.dataset.drawn = '1';
    removeCalMap(c);
    const map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    const lls = pts.map(l => [l.lat, l.lng]);
    if (lls.length > 1) L.polyline(lls, { color: cssVar('--trail'), weight: 4, opacity: .9, dashArray: '6 8' }).addTo(map);
    pts.forEach((l, i) => {
      const icon = L.divIcon({ className: 'num-pin', html: '<span style="background:' + catColor(l.category) + '">' + (i + 1) + '</span>', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
      L.marker([l.lat, l.lng], { icon: icon, title: (i + 1) + '. ' + l.category, zIndexOffset: i })
        .addTo(map)
        .bindPopup('<b>' + (i + 1) + '. ' + esc(fmtTime(l.timestamp)) + ' ' + esc(catEmoji(l.category) + ' ' + l.category) + '</b>' + (l.placeName ? '<br>' + esc(l.placeName) : ''));
    });
    if (lls.length === 1) map.setView(lls[0], 15);
    else map.fitBounds(lls, { padding: [30, 30], maxZoom: 16 });
    c.map = map;
    setTimeout(() => { if (c.map === map) map.invalidateSize(); }, 80);
  }

  /* ================= みんな（自分に公開してくれている人） ================= */
  function showPeopleHome() {
    $('#people-home').hidden = false;
    $('#people-view').hidden = true;
    state.person = null;
    if (state.peopleCal) { state.peopleCal.seq++; state.peopleCal.daySeq++; removeCalMap(state.peopleCal); }
  }

  async function loadPeople() {
    showPeopleHome();
    window.scrollTo(0, 0);
    const ul = $('#people-list');
    ul.innerHTML = '<li class="muted">読み込んでいます…</li>';
    try {
      const r = await api('sharedWithMe');
      state.people = r.people;
      ul.innerHTML = r.people.length ? r.people.map(p => {
        const initial = Array.from(p.nickname || '？')[0];
        return '<li><button type="button" class="person" data-share="' + esc(p.shareId) + '">' +
          '<span class="avatar" style="background:' + catColor(p.nickname) + '" aria-hidden="true">' + esc(initial) + '</span>' +
          '<span class="p-body"><b>' + esc(p.nickname) + ' さん</b>' +
          '<span class="small muted">' + (p.lastDate ? '最近の記録：' + fmtDay(p.lastDate) + '｜この7日で ' + p.recent7 + '件' : 'まだ見られる記録がありません') + '</span></span>' +
          '<span class="p-go" aria-hidden="true">›</span></button></li>';
      }).join('') : '<li class="empty">まだ誰からも公開されていません。<br>家族や友人に、あなたの登録メールアドレス（' + esc(state.user.email) + '）を「あしあとを見せる相手」に入れてもらうと、ここに出てきます。</li>';
    } catch (e) { ul.innerHTML = '<li class="empty">' + esc(e.message) + '</li>'; }
  }

  function openPerson(p) {
    state.person = p;
    $('#people-home').hidden = true;
    $('#people-view').hidden = false;
    $('#pv-name').textContent = p.nickname + ' さんのあしあと';
    $('#pv-note').textContent = '見るだけで、書き込みはできません。' + (GEO_NOTE[p.geoLevel] || '');
    const src = { kind: 'share', shareId: p.shareId };
    if (!state.peopleCal) state.peopleCal = createCal($('#people-cal'), src);
    else resetCal(state.peopleCal, src);
    calLoad(state.peopleCal);
    window.scrollTo(0, 0);
  }

  /* ================= 公開相手の管理（設定） ================= */
  function bindShares() {
    $('#form-share-add').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, btn = $('button[type=submit]', f);
      setMsg(f, ''); btn.disabled = true;
      try {
        const r = await api('addShare', { email: f.email.value.trim(), label: f.label.value.trim(), group: f.group.value.trim(), geoLevel: f.geoLevel.value, notify: f.notify.checked });
        state.shares = r.shares;
        renderShares();
        const who = f.label.value.trim() || f.email.value.trim();
        f.reset();
        setMsg(f, who + ' さんに公開しました。' + (r.mailed ? 'お知らせメールも送りました。' : ''), 'ok');
      } catch (e) { setMsg(f, e.message, 'err'); }
      finally { btn.disabled = false; }
    });

    $('#share-list').addEventListener('click', async ev => {
      const row = ev.target.closest('[data-sid]');
      const g = ev.target.closest('[data-gall]');
      if (g) {
        const on = g.dataset.gall === 'on';
        const name = g.dataset.g || 'グループなし';
        if (!on && !confirm('「' + name + '」の全員への公開を止めますか？')) return;
        try {
          const r = await withLoading('切り替えています…', () => api('setGroupShare', { group: g.dataset.g, enabled: on }));
          state.shares = r.shares;
          renderShares();
          toast('「' + name + '」の全員' + (on ? 'に公開しました' : 'への公開を止めました'));
        } catch (e) { toast(e.message, 'err'); }
        return;
      }
      if (!row) return;
      const s = state.shares.find(x => x.shareId === row.dataset.sid);
      if (!s) return;
      if (ev.target.closest('[data-sedit]')) { openShareEdit(s); return; }
      const sw = ev.target.closest('[data-toggle]');
      if (sw) {
        const next = !s.enabled;
        sw.disabled = true;
        try {
          const r = await api('updateShare', { shareId: s.shareId, fields: { enabled: next } });
          Object.assign(s, r.share);
          renderShares();
          toast(shareName(s) + ' さん' + (next ? 'に公開しました' : 'への公開を止めました'));
        } catch (e) { toast(e.message, 'err'); sw.disabled = false; }
      }
    });

    $('#form-share-edit').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, s = state.editShare;
      if (!s) return;
      try {
        const r = await withLoading('保存しています…', () => api('updateShare', { shareId: s.shareId, fields: { label: f.label.value.trim(), group: f.group.value.trim(), geoLevel: f.geoLevel.value, enabled: f.enabled.checked } }));
        Object.assign(s, r.share);
        renderShares();
        closeModal('modal-share');
        toast('公開相手の設定を保存しました');
      } catch (e) { toast(e.message, 'err'); }
    });

    $('#btn-share-delete').addEventListener('click', async () => {
      const s = state.editShare;
      if (!s || !confirm(shareName(s) + ' さんを公開相手から外しますか？相手はすぐに見られなくなります。')) return;
      try {
        const r = await withLoading('外しています…', () => api('deleteShare', { shareId: s.shareId }));
        state.shares = r.shares;
        renderShares();
        closeModal('modal-share');
        toast('公開相手から外しました');
      } catch (e) { toast(e.message, 'err'); }
    });

    $('#pref-private-default').addEventListener('change', async ev => {
      const prefs = Object.assign({}, state.user.prefs || {});
      prefs.privateDefault = ev.target.checked;
      await savePrefs(prefs);
      $('#rec-private').checked = prefPrivateDefault();
      updatePrivBadge();
      toast(prefs.privateDefault ? '新しい記録は最初から「🙈 自分だけ」になります' : '新しい記録は最初から公開相手に見えます');
    });
  }

  function shareName(s) { return s.label || s.nickname || s.email; }

  async function loadShares() {
    const box = $('#share-list');
    box.innerHTML = '<p class="muted small">読み込んでいます…</p>';
    try {
      const r = await api('listShares');
      state.shares = r.shares;
      renderShares();
    } catch (e) { box.innerHTML = '<p class="muted small">' + esc(e.message) + '</p>'; }
  }

  function renderShares() {
    const list = state.shares || [];
    const box = $('#share-list');
    if (!list.length) { box.innerHTML = '<p class="muted small share-none">まだ誰にも公開していません。上の欄から相手を追加してください。</p>'; return; }
    const groups = {}, order = [];
    list.forEach(s => { const g = s.group || ''; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(s); });
    order.sort((a, b) => (a === '') - (b === ''));
    const on = list.filter(s => s.enabled).length;
    box.innerHTML = '<p class="share-sum">' + list.length + '人のうち <b>' + on + '人に公開中</b></p>' + order.map(g => {
      const arr = groups[g];
      const onN = arr.filter(s => s.enabled).length;
      return '<div class="sg"><div class="sg-h"><span class="sg-name">' + esc(g || 'グループなし') + '</span><span class="sg-count">' + arr.length + '人・公開中 ' + onN + '</span>' +
        '<span class="sg-btns"><button type="button" data-gall="on" data-g="' + esc(g) + '"' + (onN === arr.length ? ' disabled' : '') + '>全員に公開</button>' +
        '<button type="button" data-gall="off" data-g="' + esc(g) + '"' + (!onN ? ' disabled' : '') + '>全員止める</button></span></div>' +
        '<ul class="sh-list">' + arr.map(shareRowHtml).join('') + '</ul></div>';
    }).join('');
  }

  function shareRowHtml(s) {
    const name = shareName(s);
    const sub = [s.label && s.nickname ? s.nickname : '', s.email].filter(Boolean).join('・');
    const seen = s.lastViewedAt ? '最後に見た日 ' + fmtShort(ymd(new Date(s.lastViewedAt))) : 'まだ見ていません';
    return '<li class="sh-row' + (s.enabled ? '' : ' off') + '" data-sid="' + esc(s.shareId) + '">' +
      '<div class="sh-main"><b>' + esc(name) + '</b><span class="small muted">' + esc(sub) + '</span>' +
      '<span class="small sh-info">' + GEO_LABEL[s.geoLevel] + '｜' + seen + (s.viewerActive ? '' : '｜⚠ 相手のアカウントが使えません') + '</span></div>' +
      '<button type="button" class="switch" role="switch" aria-checked="' + s.enabled + '" data-toggle aria-label="' + esc(name) + ' さんへの公開">' +
      '<span class="sw-track"><span class="sw-knob"></span></span><span class="sw-text">' + (s.enabled ? '公開中' : '停止中') + '</span></button>' +
      '<button type="button" class="icon-btn sh-edit" data-sedit aria-label="' + esc(name) + ' さんの設定を直す">✎</button></li>';
  }

  function openShareEdit(s) {
    state.editShare = s;
    const f = $('#form-share-edit');
    $('#share-edit-who').textContent = (s.nickname || '') + '（' + s.email + '）';
    f.label.value = s.label || '';
    f.group.value = s.group || '';
    f.geoLevel.value = s.geoLevel || 'exact';
    f.enabled.checked = !!s.enabled;
    openModal('modal-share');
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
      const inRange = res.logs.filter(l => l.dateKey >= r.from && l.dateKey <= r.to); // 期間後に終わった「終了」は時間集計にだけ使う
      const empty = !res.logs.length;
      $('#review-empty').hidden = !empty;
      $('#review-body').hidden = empty;
      if (!empty) {
        const byDay = minutesByDay(res.logs, dayStartMs(r.from), Math.min(Date.now(), dayStartMs(r.to) + 86400000));
        const counted = inRange.filter(l => l.kind !== 'end'); // 開始と終了で二重に数えない
        renderStats(counted, r, byDay);
        renderTimeCharts(byDay, r);
        renderCharts(counted, r);
        loadFunBest(r);
      }
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

  function renderStats(logs, r, byDay) {
    const totalMin = Object.values(sumByCat(byDay || {})).reduce((a, b) => a + b, 0);
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
      ['写真・声・絵など', media, '個'],
      ['開始〜終了の合計', Math.round(totalMin / 6) / 10, '時間'],
      ['1日あたり', totalMin ? fmtMin(totalMin / r.days) : '0分', '']
    ];
    $('#stats').innerHTML = items.map(i => '<div><dt>' + i[0] + '</dt><dd>' + i[1] + '<small>' + i[2] + '</small></dd></div>').join('');
  }

  function renderTimeCharts(byDay, r) {
    const tot = sumByCat(byDay);
    const cats = Object.keys(tot).sort((a, b) => tot[b] - tot[a]);
    const sum = cats.reduce((a, c) => a + tot[c], 0);
    $('#time-trend-panel').hidden = !cats.length;
    $('#time-use-wrap').hidden = !cats.length;
    if (!cats.length) {
      $('#time-use-note').textContent = '⏱ この期間は開始・終了がそろった記録がありません。記録タブの「⏱ 開始・終了」で記録できます。';
      return;
    }
    $('#time-use-note').textContent = '合計 ' + fmtMin(sum) + '（1日平均 ' + fmtMin(sum / r.days) + '）';
    if (typeof Chart === 'undefined') return;
    const ink = cssVar('--ink'), line = cssVar('--line');
    $('#time-use-wrap').style.height = Math.max(180, cats.length * 34 + 40) + 'px';
    mkChart('ch-time', {
      type: 'bar',
      data: { labels: cats.map(c => catEmoji(c) + ' ' + c), datasets: [{ label: '時間', data: cats.map(c => Math.round(tot[c] / 6) / 10), backgroundColor: cats.map(catColor), borderRadius: 4 }] },
      options: {
        indexAxis: 'y', maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtMin(tot[cats[c.dataIndex]]) + '（1日平均 ' + fmtMin(tot[cats[c.dataIndex]] / r.days) + '・' + Math.round(tot[cats[c.dataIndex]] / sum * 100) + '%）' } } },
        scales: { x: { beginAtZero: true, grid: { color: line }, title: { display: true, text: '時間' } }, y: { grid: { display: false }, ticks: { color: ink } } }
      }
    });
    const mode = bucketMode(r.days);
    const keys = [];
    for (let d = parseYmd(r.from); ymd(d) <= r.to; d = addDays(d, 1)) {
      const k = bucketKey(ymd(d), mode);
      if (keys[keys.length - 1] !== k) keys.push(k);
    }
    const top = cats.slice(0, 6);
    const agg = {};
    Object.keys(byDay).forEach(d => {
      const k = bucketKey(d, mode);
      Object.keys(byDay[d]).forEach(c => {
        const name = top.indexOf(c) >= 0 ? c : 'その他';
        (agg[k] = agg[k] || {})[name] = (agg[k][name] || 0) + byDay[d][c];
      });
    });
    const series = top.concat(cats.length > 6 ? ['その他'] : []);
    mkChart('ch-time-trend', {
      type: 'bar',
      data: {
        labels: keys.map(k => bucketLabel(k, mode)),
        datasets: series.map(c => ({ label: c === 'その他' ? 'その他' : catEmoji(c) + c, data: keys.map(k => Math.round(((agg[k] || {})[c] || 0) / 6) / 10), backgroundColor: c === 'その他' ? cssVar('--line') : catColor(c), stack: 't' }))
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: ink, boxWidth: 12 } }, tooltip: { callbacks: { label: c => c.dataset.label + '：' + fmtMin(c.parsed.y * 60) } } },
        scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, autoSkipPadding: 10 } }, y: { stacked: true, beginAtZero: true, grid: { color: line }, title: { display: true, text: '時間' } } }
      }
    });
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
      (rep.timeUse ? '<div class="part"><b>時間の使い方</b>' + esc(rep.timeUse) + '</div>' : '') +
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
    $('#pref-private-default').checked = prefPrivateDefault();
    loadShares();
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
          const item = Object.assign({}, q[0]);
          const action = item._action || 'addLog';
          delete item._action;
          const r = await api(action, { log: item });
          if (r.open) { state.open = r.open; renderOpen(); }
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
      stopDictation();
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

    // 時刻の微調整ボタン
    $$('.te-quick').forEach(q => q.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-d]');
      if (!b) return;
      const input = $('#form-edit')[q.dataset.target];
      let d;
      if (b.dataset.d === 'now') d = new Date();
      else d = new Date((fromLocalInput(input.value) || new Date()).getTime() + Number(b.dataset.d) * 60000);
      input.value = toLocalInput(d);
      syncTimeEdit();
    }));
    ['main', 'partner'].forEach(n => $('#form-edit')[n].addEventListener('input', syncTimeEdit));
    $('#form-edit').addType.addEventListener('change', syncTimeEdit);

    $('#form-edit').addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = ev.target, l = state.editing;
      const tm = timesFromForm();
      if (!tm.main) { toast('時刻を入れてください', 'err'); return; }
      if (!$('#te-partner-block').hidden && !tm.partner) { toast('もう一方の時刻も入れてください', 'err'); return; }
      if (tm.start && tm.end && tm.end < tm.start) { toast('終了は開始より後にしてください', 'err'); return; }
      if (tm.main.getTime() > Date.now() + 60000 || (tm.partner && tm.partner.getTime() > Date.now() + 60000)) { toast('未来の時刻にはできません', 'err'); return; }
      const common = { category: f.category.value, placeName: f.placeName.value.trim(), note: f.note.value.trim(), fun: state.editFun, private: f.private.checked };
      try {
        if (state.editMode === 'new') {
          const t = f.addType.value;
          let r;
          if (t === 'both') {
            r = await withLoading('追加しています…', () => api('addEventPair', { log: common, start: timeObj(tm.start), end: timeObj(tm.end) }));
            toast(catEmoji(common.category) + ' ' + common.category + ' ' + fmtTime(tm.start.toISOString()) + '〜' + fmtTime(tm.end.toISOString()) + '（' + fmtMin((tm.end - tm.start) / 60000) + '）を追加しました');
          } else {
            const o = timeObj(tm.main);
            r = await withLoading('追加しています…', () => api('addLog', { log: Object.assign({}, common, { kind: t, timestamp: o.iso, dateKey: o.dateKey, hour: o.hour }) }));
            toast(common.category + 'の' + (t === 'start' ? '開始' : '終了') + 'を追加しました' + (t === 'end' && r.log.pairAt ? '（' + fmtMin(r.log.durationMin) + '）' : ''));
          }
          if (r.open) { state.open = r.open; renderOpen(); }
          closeModal('modal-edit');
          refreshLists();
          return;
        }
        const fields = common;
        const type = f.addType.value;
        const k = thisKindFromForm();
        if (toLocalInput(new Date(l.timestamp)) !== f.main.value) fields.start = timeObj(tm.main);
        if (k !== (l.kind || 'point')) fields.kind = k;
        if (type === 'both') {
          if (!l.pairId || fields.kind || toLocalInput(new Date(l.pairAt)) !== f.partner.value) fields.partner = timeObj(tm.partner);
        } else if (l.pairId) {
          const other = l.kind === 'start' ? '終了' : '開始';
          if (!confirm('ペアになっている「' + other + '」（' + dt(l.pairAt, l.timestamp) + '）の記録を消します。よろしいですか？')) return;
          fields.removePartner = true;
        }
        const r = await withLoading('保存しています…', () => api('updateLog', { logId: l.logId, fields: fields }));
        closeModal('modal-edit');
        const endLog = r.log.kind === 'end' ? r.log : r.partner;
        toast('直しました' + (endLog && endLog.pairAt ? '（差：' + fmtMin(endLog.durationMin) + '）' : ''));
        if (r.open) { state.open = r.open; renderOpen(); }
        if (fields.start || fields.partner || fields.kind || fields.removePartner || fields.category !== l.category || (fields.private !== !!l.private && l.pairId)) refreshLists(); else updateLogEverywhere(r.log);
      } catch (e) { toast(e.message, 'err'); }
    });
    $('#btn-edit-delete').addEventListener('click', async () => {
      const l = state.editing;
      if (!confirm(fmtTime(l.timestamp) + '「' + l.category + '」の記録を消しますか？添付した写真や声もゴミ箱に移ります。')) return;
      try {
        const r = await withLoading('消しています…', () => api('deleteLog', { logId: l.logId }));
        if (r.open) { state.open = r.open; renderOpen(); }
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
    { big: '⏱', h: '開始と終了を記録', p: '「⏱ 開始・終了」のまま、趣味・スマホ・睡眠などのボタンを押すと「開始」の時刻を記録。もう一度押すと「終了」の時刻を記録し、その差（何分使ったか）を自動で計算して残します。テレビとスマホのように同時に開始していても大丈夫です。' },
    { big: '✎', h: '時刻はあとから簡単に直せる', p: '一覧の「時刻を直す」や今日の帯グラフから、−15分・＋5分・いま などのボタンで開始・終了それぞれの時刻を直せます。差は自動で計算し直します。押し忘れたら「＋ あとから追加」で開始・終了を入れられます。' },
    { big: '👆', h: 'その場で記録も', p: '「📍 その場で記録」に切り替えると、時間を計らずに「いま、ここで何をしたか」だけ残せます。ひとこと（🗣で話して入力）・気分は、つけたいときだけ。' },
    { big: '🤩', h: 'おもしろいものを見つけたら', p: '📷写真 🎥動画 🎙声メモ ✏️絵 🔗URL で添付してから、やったことのボタン（または「おもしろ発見」）を押します。AIがひとことを添え、声は文字にしてくれます。ほかのアプリの「共有」からURLを送ることもできます。' },
    { big: '🎁', h: 'あとで楽しむ仕掛け', p: '「おもしろ箱」でコレクションを眺めたり、ガチャで昔の発見を引いたり。タイムカプセルに入れた記録は、決めた日まで開けられません。記録タブには「1年前の今日」なども出てきます。' },
    { big: '📝', h: 'あとからメモを書き足す', p: '記録をタップすると「くわしく見る」が開きます。下の「あとからのメモ」に、あとで思い出したことやその後のことを何度でも書き足せます（🗣で話して入力も）。書いたメモは直したり消したりできます。一覧の「📝 メモ」からもすぐ書けます。' },
    { big: '📅', h: 'カレンダーで見返す', p: '「履歴」タブのカレンダーでは、記録の多い日ほど色が濃くなります。日付をタップすると、その日の時間の使い方・地図（番号つき）・あしあとの順番が見られます。' },
    { big: '👪', h: '家族や友人にだけ見せる', p: '「設定 → あしあとを見せる相手」に会員のメールアドレスを登録すると、その人だけが「みんな」タブであなたのあしあとを見られます（見るだけ）。公開・非公開はスイッチひとつ。見せたくない記録は「🙈 自分だけ」にできます。' },
    { big: '📈', h: '何に何時間？を振り返る', p: '「振り返り」タブで1週間から3年まで。何に何時間使ったか、その移り変わり、おもしろベスト、AIのまとめと音声ナレーションで振り返れます。' },
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
