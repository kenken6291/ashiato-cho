/**
 * あしあと帳 — GAS バックエンド（Code.gs）
 * 行動・位置記録 / おもしろ記録（写真・動画・声・絵・URL）/ 会員認証 / Gemini 分析・自動キャプション
 * Gemini TTS / Google Earth Studio 用データ書き出し / タイムカプセル・あの日・ガチャ
 * 時間記録：「開始」「終了」をそれぞれ時刻として記録し、あとで差分（所要時間）を計算して保存
 *
 * 初回のみ：エディタで setup() を実行 → スクリプトプロパティに GEMINI_API_KEY を設定 → ウェブアプリとしてデプロイ
 * Gemini のモデルはスクリプトプロパティ GEMINI_MODEL / GEMINI_TTS_MODEL / GEMINI_TTS_VOICE で指定（setup() が初期値を入れます）
 * ※コードを変更したら「デプロイを管理 → 編集 → 新しいバージョン」で再デプロイしないと反映されません
 */

const APP_VERSION = 'v1.3.1';
const MAX_SPAN_MS = 7 * 86400000; // 1つの時間記録の最長（7日）
const MEDIA_TYPES = ['photo', 'video', 'audio', 'drawing', 'url'];
const MAX_MEDIA = 6;
const HASH_ROUNDS = 300; // 変更すると既存パスワードが通らなくなるので固定

const SH = { USERS: 'Users', LOGS: 'Logs', REPORTS: 'Reports', CONFIG: 'Config' };

const HEADERS = {
  Users: ['userId', 'email', 'nickname', 'salt', 'passwordHash', 'mustChange', 'status', 'failCount', 'lockUntil', 'onboarded', 'prefs', 'createdAt', 'lastLoginAt'],
  Logs: ['logId', 'userId', 'timestamp', 'dateKey', 'hour', 'lat', 'lng', 'accuracy', 'placeName', 'address', 'area', 'category', 'tags', 'note', 'photoFileId', 'createdAt', 'updatedAt', 'deleted', 'fun', 'media', 'capsuleUntil', 'capsuleOpenedAt', 'ai', 'kind', 'endAt', 'endDateKey', 'pairId', 'pairAt', 'pairDateKey', 'durationMin'],
  Reports: ['reportId', 'userId', 'period', 'rangeStart', 'rangeEnd', 'title', 'reportJson', 'script', 'audioFileId', 'createdAt'],
  Config: ['key', 'value', 'note']
};

const DEFAULT_CONFIG = [
  ['appName', 'あしあと帳', 'メール件名などに使うアプリ名'],
  ['appUrl', 'https://kenken6291.github.io/ashiato-cho/', 'メール本文に載せるURL'],
  ['sessionHours', '6', 'ログイン保持時間（時間・最大6）'],
  ['maxLoginFail', '5', 'ロックまでのログイン失敗回数'],
  ['lockMinutes', '15', 'ロック時間（分）'],
  ['scriptMaxChars', '700', '読み上げ原稿の最大文字数'],
  ['earthMaxStops', '12', 'Earth Studio 書き出しの最大滞在地数'],
  ['maxUploadMB', '100', '動画・音声1ファイルの上限（MB）'],
  ['videoLinkShare', 'TRUE', '動画を「リンクを知っている人のみ閲覧」にしてアプリ内再生する（FALSEなら15MB以下のみ再生）'],
  ['aiAutoCaption', 'TRUE', '写真・絵・声・動画にAIキャプションを自動で付ける']
];

/**
 * Gemini のモデル指定はスクリプトプロパティで行う（コード変更・シート編集なしで切り替え可能）
 *   GEMINI_MODEL      … 分析・キャプション・文字起こし用
 *   GEMINI_TTS_MODEL  … 音声合成（TTS）用
 *   GEMINI_TTS_VOICE  … TTSのボイス名
 * プロパティが空のときだけ下の既定値を使う
 */
const MODEL_PROPS = {
  text: { key: 'GEMINI_MODEL', def: 'gemini-2.5-flash' },
  tts: { key: 'GEMINI_TTS_MODEL', def: 'gemini-2.5-flash-preview-tts' },
  voice: { key: 'GEMINI_TTS_VOICE', def: 'Kore' }
};

function model_(kind) {
  const m = MODEL_PROPS[kind];
  const v = PropertiesService.getScriptProperties().getProperty(m.key);
  return v && String(v).trim() ? String(v).trim() : m.def;
}

const PERIOD_DAYS = { '1w': 7, '1m': 30, '3m': 91, '1y': 365, '2y': 730, '3y': 1095 };
const PERIOD_LABEL = { '1w': '1週間', '1m': '1か月', '3m': '四半期', '1y': '1年', '2y': '2年', '3y': '3年' };

/* =========================================================
 * エントリーポイント
 * ======================================================= */

function doGet(e) {
  return json_({ ok: true, app: cfg_('appName', 'あしあと帳'), version: APP_VERSION, time: new Date().toISOString() });
}

/**
 * フロントからは Content-Type: text/plain で POST（プリフライトを発生させない＝CORS回避）
 */
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(req.action || '');
    if (Object.prototype.hasOwnProperty.call(PUBLIC_API, action)) {
      out = PUBLIC_API[action](req);
    } else if (Object.prototype.hasOwnProperty.call(PRIVATE_API, action)) {
      const user = auth_(req.token);
      out = PRIVATE_API[action](req, user);
    } else {
      throw new Error('不明な操作です: ' + action);
    }
    out = Object.assign({ ok: true, version: APP_VERSION }, out || {});
  } catch (err) {
    out = { ok: false, error: (err && err.message) || String(err), code: (err && err.code) || '' };
  }
  return json_(out);
}

const PUBLIC_API = {
  ping: () => ({ app: cfg_('appName', 'あしあと帳') }),
  register: api_register,
  login: api_login,
  resetPassword: api_resetPassword,
  logout: api_logout
};

const PRIVATE_API = {
  me: api_me,
  changePassword: api_changePassword,
  updateProfile: api_updateProfile,
  savePrefs: api_savePrefs,
  markOnboarded: api_markOnboarded,
  reverseGeocode: api_reverseGeocode,
  addLog: api_addLog,
  listLogs: api_listLogs,
  updateLog: api_updateLog,
  deleteLog: api_deleteLog,
  getPhoto: api_getPhoto,
  analyze: api_analyze,
  listReports: api_listReports,
  tts: api_tts,
  exportEarth: api_exportEarth,
  startUpload: api_startUpload,
  addEventPair: api_addEventPair,
  getOpen: api_getOpen,
  getMedia: api_getMedia,
  enrichLog: api_enrichLog,
  listFun: api_listFun,
  memories: api_memories,
  gacha: api_gacha,
  capsules: api_capsules,
  openCapsule: api_openCapsule
};

/* =========================================================
 * 初期セットアップ（エディタから1回実行）
 * ======================================================= */

function setup() {
  const ss = ss_();
  Object.keys(HEADERS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const h = HEADERS[name];
    const lastCol = sh.getLastColumn();
    const cur = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    if (!cur.filter(Boolean).length) {
      sh.getRange(1, 1, 1, h.length).setValues([h]);
    } else {
      // v1.0.0 → v1.1.0 など、足りない列だけ右端に追加（既存データはそのまま）
      const missing = h.filter(x => cur.indexOf(x) < 0);
      if (missing.length) sh.getRange(1, cur.length + 1, 1, missing.length).setValues([missing]);
    }
    const width = Math.max(h.length, sh.getLastColumn());
    sh.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#DCEAE5');
    sh.setFrozenRows(1);
    // 日付文字列や数値が自動変換されないよう全列テキスト書式に
    sh.getRange(1, 1, sh.getMaxRows(), width).setNumberFormat('@');
  });
  const cfg = ss.getSheetByName(SH.CONFIG);
  const existing = cfg.getDataRange().getValues().map(r => String(r[0]));
  DEFAULT_CONFIG.forEach(r => { if (existing.indexOf(r[0]) < 0) cfg.appendRow(r); });

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PEPPER')) props.setProperty('PEPPER', Utilities.getUuid() + Utilities.getUuid());
  // モデル指定のスクリプトプロパティが無ければ初期値を入れておく（あとで書き換えて使う）
  Object.keys(MODEL_PROPS).forEach(k => {
    const m = MODEL_PROPS[k];
    if (!props.getProperty(m.key)) props.setProperty(m.key, m.def);
  });
  const root = rootFolder_();
  migrateSpans_(); // v1.2.0 の「計測」形式を「開始」「終了」の2件に変換

  const sheet1 = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1 && sheet1.getLastRow() === 0) ss.deleteSheet(sheet1);

  Logger.log('セットアップ完了。データ保存フォルダ: ' + root.getUrl());
  Logger.log('次にスクリプトプロパティへ GEMINI_API_KEY を設定してください。');
  Logger.log('使用モデル：GEMINI_MODEL=' + model_('text') + ' / GEMINI_TTS_MODEL=' + model_('tts') + ' / GEMINI_TTS_VOICE=' + model_('voice'));
}

/* =========================================================
 * 認証
 * ======================================================= */

function api_register(req) {
  const email = normEmail_(req.email);
  if (!isEmail_(email)) throw new Error('メールアドレスの形式が正しくありません。');
  const nickname = String(req.nickname || '').trim().slice(0, 20) || email.split('@')[0];

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (findUser_('email', email)) {
      throw new Error('このメールアドレスは登録済みです。「パスワードを忘れた」から仮パスワードを再発行できます。');
    }
    const temp = genTempPassword_();
    const salt = Utilities.getUuid();
    const now = nowIso_();
    appendObj_(SH.USERS, {
      userId: 'U' + Utilities.getUuid().replace(/-/g, '').slice(0, 16),
      email: email, nickname: nickname, salt: salt, passwordHash: hash_(temp, salt),
      mustChange: 'TRUE', status: 'active', failCount: '0', lockUntil: '', onboarded: 'FALSE',
      prefs: '{}', createdAt: now, lastLoginAt: ''
    });
    sendTempMail_(email, nickname, temp, false);
  } finally {
    lock.releaseLock();
  }
  return { message: email + ' に仮パスワードを送りました。メールを確認してログインしてください。' };
}

function api_login(req) {
  const email = normEmail_(req.email);
  const password = String(req.password || '');
  const generic = 'メールアドレスかパスワードが違います。';
  const u = findUser_('email', email);
  if (!u) throw new Error(generic);
  const o = u.obj;
  if (o.status !== 'active') throw new Error('このアカウントは利用停止中です。');

  const now = Date.now();
  const lockUntil = Number(o.lockUntil || 0);
  if (lockUntil > now) {
    const min = Math.ceil((lockUntil - now) / 60000);
    throw new Error('ログインの失敗が続いたため一時的にロックしています。約' + min + '分後にもう一度お試しください。');
  }

  if (hash_(password, o.salt) !== o.passwordHash) {
    const maxFail = Number(cfg_('maxLoginFail', '5'));
    const fail = Number(o.failCount || 0) + 1;
    if (fail >= maxFail) {
      o.failCount = '0';
      o.lockUntil = String(now + Number(cfg_('lockMinutes', '15')) * 60000);
      saveUser_(u);
      throw new Error('ログインに' + maxFail + '回失敗したため、' + cfg_('lockMinutes', '15') + '分間ロックしました。');
    }
    o.failCount = String(fail);
    saveUser_(u);
    throw new Error(generic + '（あと' + (maxFail - fail) + '回失敗するとロックされます）');
  }

  o.failCount = '0';
  o.lockUntil = '';
  o.lastLoginAt = nowIso_();
  saveUser_(u);

  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('sess_' + token, o.userId, sessionSec_());
  return { token: token, user: publicUser_(o) };
}

function api_resetPassword(req) {
  const email = normEmail_(req.email);
  const msg = '登録済みのメールアドレスであれば、新しい仮パスワードを送りました。メールを確認してください。';
  if (!isEmail_(email)) throw new Error('メールアドレスの形式が正しくありません。');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const u = findUser_('email', email);
    if (u && u.obj.status === 'active') {
      const temp = genTempPassword_();
      u.obj.salt = Utilities.getUuid();
      u.obj.passwordHash = hash_(temp, u.obj.salt);
      u.obj.mustChange = 'TRUE';
      u.obj.failCount = '0';
      u.obj.lockUntil = '';
      saveUser_(u);
      sendTempMail_(email, u.obj.nickname, temp, true);
    }
  } finally {
    lock.releaseLock();
  }
  return { message: msg };
}

function api_logout(req) {
  if (req.token) CacheService.getScriptCache().remove('sess_' + req.token);
  return {};
}

function api_me(req, u) {
  return { user: publicUser_(u.obj) };
}

function api_changePassword(req, u) {
  const current = String(req.current || '');
  const next = String(req.next || '');
  if (hash_(current, u.obj.salt) !== u.obj.passwordHash) throw new Error('現在のパスワード（仮パスワード）が違います。');
  const err = passwordPolicy_(next);
  if (err) throw new Error(err);
  if (next === current) throw new Error('新しいパスワードは現在のものと別にしてください。');
  u.obj.salt = Utilities.getUuid();
  u.obj.passwordHash = hash_(next, u.obj.salt);
  u.obj.mustChange = 'FALSE';
  saveUser_(u);
  return { user: publicUser_(u.obj), message: 'パスワードを変更しました。' };
}

function api_updateProfile(req, u) {
  const nickname = String(req.nickname || '').trim().slice(0, 20);
  if (!nickname) throw new Error('ニックネームを入力してください。');
  u.obj.nickname = nickname;
  saveUser_(u);
  return { user: publicUser_(u.obj) };
}

function api_savePrefs(req, u) {
  const s = JSON.stringify(req.prefs || {});
  if (s.length > 8000) throw new Error('設定データが大きすぎます。');
  u.obj.prefs = s;
  saveUser_(u);
  return { user: publicUser_(u.obj) };
}

function api_markOnboarded(req, u) {
  u.obj.onboarded = 'TRUE';
  saveUser_(u);
  return { user: publicUser_(u.obj) };
}

function auth_(token) {
  const fail = () => appErr_('ログインの有効期限が切れました。もう一度ログインしてください。', 'AUTH');
  if (!token) throw fail();
  const cache = CacheService.getScriptCache();
  const uid = cache.get('sess_' + token);
  if (!uid) throw fail();
  const u = findUser_('userId', uid);
  if (!u || u.obj.status !== 'active') throw fail();
  cache.put('sess_' + token, uid, sessionSec_()); // スライディング延長
  return u;
}

function hash_(password, salt) {
  const pepper = PropertiesService.getScriptProperties().getProperty('PEPPER') || '';
  let h = String(salt) + ':' + String(password) + ':' + pepper;
  for (let i = 0; i < HASH_ROUNDS; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + pepper, Utilities.Charset.UTF_8));
  }
  return h;
}

function genTempPassword_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  if (!/\d/.test(s)) s = s.slice(0, 9) + '7';
  if (!/[A-Za-z]/.test(s)) s = 'K' + s.slice(1);
  return s;
}

function passwordPolicy_(pw) {
  if (pw.length < 8) return 'パスワードは8文字以上にしてください。';
  if (pw.length > 64) return 'パスワードは64文字以内にしてください。';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'パスワードには英字と数字の両方を含めてください。';
  return '';
}

function sendTempMail_(email, nickname, temp, isReset) {
  const app = cfg_('appName', 'あしあと帳');
  const url = cfg_('appUrl', '');
  const subject = '【' + app + '】' + (isReset ? '仮パスワード再発行のお知らせ' : '仮パスワードのお知らせ');
  const body =
    nickname + ' さん\n\n' +
    (isReset ? app + ' の仮パスワードを再発行しました。\n' : app + ' にご登録いただきありがとうございます。\n') +
    '\n仮パスワード： ' + temp + '\n\n' +
    'ログインすると、ご自身のパスワードへの変更画面が表示されます。\n' +
    (url ? url + '\n' : '') +
    '\n※このメールに心当たりがない場合は破棄してください。\n';
  MailApp.sendEmail({ to: email, subject: subject, body: body, name: app });
}

function publicUser_(o) {
  return {
    userId: o.userId, email: o.email, nickname: o.nickname,
    mustChange: toBool_(o.mustChange), onboarded: toBool_(o.onboarded),
    prefs: parseJson_(o.prefs, {})
  };
}

/* =========================================================
 * 記録（Logs）
 * ======================================================= */

function api_addLog(req, u) {
  const obj = makeLogObj_(u, req.log || {});
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    appendObj_(SH.LOGS, obj);
    if (isEvent_(obj.kind)) {
      const t = table_(SH.LOGS);
      repairPairs_(t, u.obj.userId, [obj.category]);
      const hit = findInTable_(t, obj.logId);
      return { log: publicLog_(hit ? hit.obj : obj, { thumbs: true }), open: openStarts_(t, u.obj.userId) };
    }
  } finally {
    lock.releaseLock();
  }
  return { log: publicLog_(obj, { thumbs: true }) };
}

/** 1件分の記録データを組み立てる（保存はしない） */
function makeLogObj_(u, l) {
  const category = String(l.category || '').trim().slice(0, 20);
  if (!category) throw new Error('やったこと（カテゴリ）を選んでください。');
  const tz = tz_();
  const now = new Date();
  const ts = l.timestamp && !isNaN(new Date(l.timestamp)) ? new Date(l.timestamp) : now;
  if (ts.getTime() > now.getTime() + 5 * 60000) throw new Error('未来の時刻は記録できません。');
  const dateKey = validKey_(l.dateKey) ? l.dateKey : Utilities.formatDate(ts, tz, 'yyyy-MM-dd');
  const hour = validHour_(l.hour, ts);

  const lat = num_(l.lat), lng = num_(l.lng);
  const hasGeo = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  let placeName = String(l.placeName || '').slice(0, 80);
  let address = String(l.address || '').slice(0, 200);
  let area = String(l.area || '').slice(0, 60);
  if (hasGeo && !address) {
    try {
      const g = geocode_(lat, lng);
      placeName = placeName || g.placeName; address = g.address; area = area || g.area;
    } catch (e) { /* 住所が取れなくても記録は残す */ }
  }

  const logId = 'L' + Utilities.formatDate(now, tz, 'yyMMddHHmmss') + Math.floor(Math.random() * 9000 + 1000);
  let photoFileId = '';
  if (l.photo && /^data:image\//.test(String(l.photo))) {
    photoFileId = savePhoto_(u.obj.userId, logId, l.photo); // v1.0.0 互換
  }
  const media = saveMediaList_(u.obj.userId, logId, l.media);
  const fun = Math.max(0, Math.min(3, Math.floor(Number(l.fun) || 0)));
  const capsuleUntil = validKey_(l.capsuleUntil) && l.capsuleUntil > todayKey_() ? l.capsuleUntil : '';
  const tags = Array.isArray(l.tags) ? l.tags.map(t => String(t).slice(0, 20)).slice(0, 10) : [];
  const kind = isEvent_(l.kind) ? l.kind : 'point';
  return {
    logId: logId, userId: u.obj.userId, timestamp: ts.toISOString(), dateKey: dateKey, hour: String(hour),
    lat: hasGeo ? lat.toFixed(6) : '', lng: hasGeo ? lng.toFixed(6) : '',
    accuracy: num_(l.accuracy) !== null ? String(Math.round(num_(l.accuracy))) : '',
    placeName: placeName, address: address, area: area, category: category,
    tags: JSON.stringify(tags), note: String(l.note || '').slice(0, 500),
    photoFileId: photoFileId, createdAt: nowIso_(), updatedAt: '', deleted: 'FALSE',
    fun: String(fun), media: fitMediaJson_(media), capsuleUntil: capsuleUntil, capsuleOpenedAt: '', ai: '',
    kind: kind, endAt: '', endDateKey: '', pairId: '', pairAt: '', pairDateKey: '', durationMin: ''
  };
}

function api_listLogs(req, u) {
  const r = range_(req);
  return { logs: getUserLogs_(u.obj.userId, r.from, r.to, { thumbs: !!req.thumbs }), from: r.from, to: r.to };
}

function api_updateLog(req, u) {
  const f = req.fields || {};
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const hit = findLog_(req.logId, u.obj.userId);
    const cats = [hit.obj.category];
    const oldPairId = hit.obj.pairId;
    if (f.category !== undefined) {
      const c = String(f.category).trim().slice(0, 20);
      if (!c) throw new Error('カテゴリを空にはできません。');
      hit.obj.category = c;
    }
    if (f.note !== undefined) hit.obj.note = String(f.note).slice(0, 500);
    if (f.placeName !== undefined) hit.obj.placeName = String(f.placeName).slice(0, 80);
    if (Array.isArray(f.tags)) hit.obj.tags = JSON.stringify(f.tags.map(t => String(t).slice(0, 20)).slice(0, 10));
    if (f.fun !== undefined) hit.obj.fun = String(Math.max(0, Math.min(3, Math.floor(Number(f.fun) || 0))));
    if (f.start) setEventTime_(hit.obj, f.start);

    // 記録の種類を変える（その場の記録 ⇔ 開始 ⇔ 終了）
    if (f.kind !== undefined) {
      const k = isEvent_(f.kind) ? f.kind : 'point';
      if (k !== (hit.obj.kind || 'point')) {
        hit.obj.kind = k;
        if (k === 'point') { hit.obj.pairId = ''; hit.obj.pairAt = ''; hit.obj.pairDateKey = ''; hit.obj.durationMin = ''; }
      }
    }
    hit.obj.updatedAt = nowIso_();
    updateRow_(hit.t, hit.idx, hit.obj);

    const partner = oldPairId ? findInTable_(hit.t, oldPairId) : null;
    const partnerOk = partner && partner.obj.userId === u.obj.userId && !toBool_(partner.obj.deleted);

    if (f.removePartner && partnerOk) {
      // ペアの相手を消す（「開始だけ」「その場の記録」にしたとき）
      partner.obj.deleted = 'TRUE';
      partner.obj.updatedAt = nowIso_();
      updateRow_(hit.t, partner.idx, partner.obj);
    } else if (f.partner && isEvent_(hit.obj.kind)) {
      const want = hit.obj.kind === 'start' ? 'end' : 'start';
      if (partnerOk && partner.obj.kind === want) {
        // 既存の相手の時刻を直す
        setEventTime_(partner.obj, f.partner);
        partner.obj.category = hit.obj.category;
        partner.obj.updatedAt = nowIso_();
        updateRow_(hit.t, partner.idx, partner.obj);
      } else {
        // 相手がいないので新しく作る
        if (partnerOk) { partner.obj.deleted = 'TRUE'; updateRow_(hit.t, partner.idx, partner.obj); }
        const me = new Date(hit.obj.timestamp), other = new Date(f.partner.iso);
        const diff = want === 'end' ? other - me : me - other;
        if (isNaN(diff) || diff < 0) throw new Error('終了は開始より後にしてください。');
        if (diff > MAX_SPAN_MS) throw new Error('開始から終了までは7日以内にしてください。');
        const p = makeLogObj_(u, {
          category: hit.obj.category, kind: want, timestamp: other.toISOString(), dateKey: f.partner.dateKey, hour: f.partner.hour,
          lat: hit.obj.lat, lng: hit.obj.lng, placeName: hit.obj.placeName, address: hit.obj.address || '-', area: hit.obj.area
        });
        if (p.address === '-') p.address = '';
        p.logId = hit.obj.logId + (want === 'end' ? 'E' : 'S') + Math.floor(Math.random() * 90 + 10);
        appendObj_(SH.LOGS, p);
      }
    } else if (f.category !== undefined && partnerOk) {
      partner.obj.category = hit.obj.category; // 開始と終了のカテゴリはそろえる
      updateRow_(hit.t, partner.idx, partner.obj);
    }

    if (cats.indexOf(hit.obj.category) < 0) cats.push(hit.obj.category);
    const t = table_(SH.LOGS);
    repairPairs_(t, u.obj.userId, cats);
    const me = findInTable_(t, hit.obj.logId);
    const pair = me && me.obj.pairId ? findInTable_(t, me.obj.pairId) : null;
    return {
      log: publicLog_(me.obj, { thumbs: true }),
      partner: pair ? publicLog_(pair.obj, { thumbs: true }) : null,
      open: openStarts_(t, u.obj.userId)
    };
  } finally {
    lock.releaseLock();
  }
}

function setEventTime_(o, tm) {
  const d = new Date(tm.iso);
  if (isNaN(d)) throw new Error('時刻の形式が正しくありません。');
  if (d.getTime() > Date.now() + 5 * 60000) throw new Error('未来の時刻にはできません。');
  o.timestamp = d.toISOString();
  o.dateKey = validKey_(tm.dateKey) ? tm.dateKey : Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
  o.hour = String(validHour_(tm.hour, d));
}

function api_deleteLog(req, u) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const hit = findLog_(req.logId, u.obj.userId);
    hit.obj.deleted = 'TRUE';
    hit.obj.updatedAt = nowIso_();
    mediaOf_(hit.obj).forEach(m => {
      if (m.fileId) { try { DriveApp.getFileById(m.fileId).setTrashed(true); } catch (e) { } }
    });
    updateRow_(hit.t, hit.idx, hit.obj);
    if (isEvent_(hit.obj.kind)) {
      const t = table_(SH.LOGS);
      repairPairs_(t, u.obj.userId, [hit.obj.category]);
      return { logId: req.logId, open: openStarts_(t, u.obj.userId) };
    }
  } finally {
    lock.releaseLock();
  }
  return { logId: req.logId };
}

function api_getPhoto(req, u) {
  const hit = findLog_(req.logId, u.obj.userId);
  const m = mediaOf_(hit.obj).filter(x => x.type === 'photo')[0];
  if (!m) throw new Error('この記録には写真がありません。');
  return api_getMedia({ logId: req.logId, mediaId: m.id }, u);
}

function api_reverseGeocode(req) {
  const lat = num_(req.lat), lng = num_(req.lng);
  if (lat === null || lng === null) throw new Error('位置情報がありません。');
  return { place: geocode_(lat, lng) };
}

function geocode_(lat, lng) {
  const cache = CacheService.getScriptCache();
  const key = 'geo_' + lat.toFixed(4) + '_' + lng.toFixed(4);
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  const res = Maps.newGeocoder().setLanguage('ja').setRegion('jp').reverseGeocode(lat, lng);
  let out = { placeName: '', address: '', area: '' };
  if (res && res.status === 'OK' && res.results && res.results.length) {
    const r = res.results[0];
    const pick = type => {
      for (let i = 0; i < res.results.length; i++) {
        const comps = res.results[i].address_components || [];
        for (let j = 0; j < comps.length; j++) {
          if (comps[j].types.indexOf(type) >= 0) return comps[j].long_name;
        }
      }
      return '';
    };
    const pref = pick('administrative_area_level_1');
    const city = pick('locality');
    const ward = pick('ward');
    const town = pick('sublocality_level_2') || pick('sublocality_level_1');
    const cityWard = city + (ward && ward !== city ? ward : '');
    out.area = (pref + cityWard) || pref || '';
    out.placeName = [cityWard || pref, town].filter(Boolean).join(' ') || '';
    out.address = String(r.formatted_address || '').replace(/^日本、?\s*/, '').replace(/〒\d{3}-\d{4}\s*/, '').trim();
  }
  cache.put(key, JSON.stringify(out), 21600);
  return out;
}

function savePhoto_(userId, logId, dataUrl) {
  const m = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return '';
  const bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('写真が大きすぎます（8MBまで）。');
  const ext = m[1] === 'image/png' ? 'png' : 'jpg';
  const file = userFolder_(userId).createFile(Utilities.newBlob(bytes, m[1], logId + '.' + ext));
  return file.getId();
}

function getUserRawLogs_(userId, from, to) {
  const t = table_(SH.LOGS);
  const H = colIndex_(t.headers);
  const out = [];
  t.rows.forEach(row => {
    if (String(row[H.userId]) !== userId) return;
    if (toBool_(row[H.deleted])) return;
    const d = String(row[H.dateKey]);
    const k = String(row[H.kind] || '');
    if (to && d > to) {
      // 範囲内に始まり、範囲のあとに終わった「終了」記録は時間集計のために含める
      if (!(k === 'end' && row[H.pairDateKey] && String(row[H.pairDateKey]) <= to)) return;
    }
    if (from && d < from) return;
    out.push(rowToObj_(t.headers, row));
  });
  out.sort((a, b) => a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0);
  return out;
}

function getUserLogs_(userId, from, to, opts) {
  return getUserRawLogs_(userId, from, to).map(o => publicLog_(o, opts));
}

function findLog_(logId, userId) {
  const t = table_(SH.LOGS);
  const H = colIndex_(t.headers);
  for (let i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][H.logId]) === String(logId) && String(t.rows[i][H.userId]) === userId && !toBool_(t.rows[i][H.deleted])) {
      return { t: t, idx: i, obj: rowToObj_(t.headers, t.rows[i]) };
    }
  }
  throw new Error('記録が見つかりません。');
}

function publicLog_(o, opts) {
  opts = opts || {};
  const sealed = isSealed_(o);
  const all = mediaOf_(o);
  const media = sealed ? [] : all.map(m => publicMedia_(m, opts.thumbs));
  return {
    logId: o.logId, timestamp: String(o.timestamp), dateKey: String(o.dateKey), hour: Number(o.hour) || 0,
    lat: num_(o.lat), lng: num_(o.lng), accuracy: num_(o.accuracy),
    placeName: o.placeName || '', address: o.address || '', area: o.area || '',
    category: o.category || '', tags: sealed ? [] : parseJson_(o.tags, []), note: sealed ? '' : (o.note || ''),
    fun: Number(o.fun) || 0, media: media, mediaCount: all.length,
    ai: sealed ? {} : parseJson_(o.ai, {}),
    sealed: sealed, capsuleUntil: o.capsuleUntil || '', capsuleOpened: !!o.capsuleOpenedAt,
    kind: isEvent_(o.kind) ? o.kind : 'point',
    pairId: o.pairId || '', pairAt: o.pairAt || '', pairDateKey: o.pairDateKey || '',
    durationMin: o.durationMin !== '' && o.durationMin !== undefined ? Number(o.durationMin) : null,
    open: o.kind === 'start' && !o.pairId,
    hasPhoto: media.some(m => m.type === 'photo')
  };
}

/* =========================================================
 * 集計・Gemini 分析
 * ======================================================= */

function api_analyze(req, u) {
  const period = PERIOD_DAYS[req.period] ? req.period : '1w';
  const r = range_(Object.assign({}, req, { period: period }));
  const logs = getUserLogs_(u.obj.userId, r.from, r.to);
  if (!logs.length) throw new Error('この期間の記録がまだありません。まずは記録してみましょう。');

  const stats = stats_(logs, r.from, r.to);
  const notes = logs.filter(l => l.note).slice(-60).map(l => l.dateKey.slice(5) + ' ' + l.category + '：' + l.note.slice(0, 40));
  const funLogs = logs.filter(l => l.fun > 0 || l.media.length);
  const mediaCounts = {};
  funLogs.forEach(l => l.media.forEach(m => { mediaCounts[m.type] = (mediaCounts[m.type] || 0) + 1; }));
  stats.funCount = funLogs.length;
  stats.mediaCounts = mediaCounts;
  const funLines = funLogs.slice().sort((a, b) => b.fun - a.fun).slice(0, 30).map(l => {
    const bits = [l.note, l.ai && l.ai.caption].concat(l.media.map(m => m.caption || m.title || ''), l.media.map(m => m.transcript ? '声:' + m.transcript.slice(0, 60) : ''));
    return l.dateKey.slice(5) + ' ' + l.category + (l.fun ? ' ★' + l.fun : '') + '［' + l.media.map(m => m.type).join(',') + '］：' + bits.filter(Boolean).join(' / ').slice(0, 140);
  });
  const nickname = u.obj.nickname || 'あなた';
  const label = PERIOD_LABEL[period];

  const prompt = [
    'あなたは行動記録アプリ「あしあと帳」の振り返りアシスタントです。',
    'ユーザー（ニックネーム：' + nickname + '）の「' + label + '」（' + r.from + '〜' + r.to + '）の行動記録の集計とメモを読み、温かく前向きな振り返りを作ってください。',
    '記録にないことは断定しないこと。数字は集計に基づくこと。説教や医療的な助言はしないこと。',
    '',
    '【集計】',
    JSON.stringify(stats),
    '',
    '【メモ抜粋（日付 カテゴリ：内容）】',
    notes.length ? notes.join('\n') : '（メモなし）',
    '',
    '【おもしろ発見（★はおもしろ度、［］は写真/動画/声/絵/URLの種類）】',
    funLines.length ? funLines.join('\n') : '（なし）',
    '',
    '次のキーを持つJSONオブジェクトだけを出力してください。',
    '{"title":"20字以内の見出し","summary":"150〜250字のまとめ","highlights":["印象的なポイント（3〜5個、各40字以内）"],"funBest":"おもしろ発見のふりかえり（100字前後、なければ空文字）","timeUse":"何に何時間使っていたか、時間の使い方の傾向（100字前後。時間の記録がなければ空文字）","changes":"前半と後半を比べた変化（100字前後）","growth":"続けられていること・成長（100字前後）","nextIdea":"次の期間に試すと楽しそうなこと（80字前後）","script":"音声用の原稿"}',
    '',
    'scriptの条件：',
    '- そのまま音声合成に渡す読み上げ原稿の本文だけを書く。最初の一文から' + nickname + 'さんへの語りかけで始める。',
    '- 「読み上げてください」「以下がナレーションです」「ナレーション：」のような指示・前置き・見出し・話者名・ト書き・括弧書き・記号・絵文字・URLは一切入れない。',
    '- です・ます調で、ゆったり穏やかに。400〜600字。おもしろ発見があれば、そのうち1〜2個を楽しく紹介する。時間の記録があれば、何に多く時間を使ったかにもやさしく触れる（良い悪いの評価はしない）。',
    '- 数字は耳で聞いてわかりやすい言い方にする（例：「12件」→「12件」、「3.4km」→「およそ3キロ」）。'
  ].join('\n');

  const res = geminiJson_(model_('text'), prompt, 0.8);
  const report = {
    title: String(res.title || label + 'のあしあと').slice(0, 40),
    summary: String(res.summary || ''),
    highlights: Array.isArray(res.highlights) ? res.highlights.map(String).slice(0, 6) : [],
    funBest: String(res.funBest || ''),
    timeUse: String(res.timeUse || ''),
    changes: String(res.changes || ''),
    growth: String(res.growth || ''),
    nextIdea: String(res.nextIdea || ''),
    stats: stats
  };
  const script = clipScript_(sanitizeScript_(res.script || report.summary), Number(cfg_('scriptMaxChars', '700')));

  const obj = {
    reportId: 'R' + Utilities.formatDate(new Date(), tz_(), 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100),
    userId: u.obj.userId, period: period, rangeStart: r.from, rangeEnd: r.to,
    title: report.title, reportJson: JSON.stringify(report), script: script, audioFileId: '', createdAt: nowIso_()
  };
  appendObj_(SH.REPORTS, obj);
  return { report: publicReport_(obj) };
}

function api_listReports(req, u) {
  const t = table_(SH.REPORTS);
  const H = colIndex_(t.headers);
  const list = [];
  t.rows.forEach(row => {
    if (String(row[H.userId]) !== u.obj.userId) return;
    if (req.period && String(row[H.period]) !== req.period) return;
    list.push(publicReport_(rowToObj_(t.headers, row)));
  });
  list.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
  return { reports: list.slice(0, 20) };
}

function api_tts(req, u) {
  const hit = findReport_(req.reportId, u.obj.userId);
  if (hit.obj.audioFileId) {
    try {
      const bytes = DriveApp.getFileById(hit.obj.audioFileId).getBlob().getBytes();
      return { audio: Utilities.base64Encode(bytes), mimeType: 'audio/wav', cached: true };
    } catch (e) { /* ファイルが消えていたら作り直す */ }
  }
  const script = sanitizeScript_(hit.obj.script);
  if (!script) throw new Error('読み上げる原稿がありません。');

  const body = {
    contents: [{ parts: [{ text: script }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: model_('voice') } } }
    }
  };
  const resp = gemini_(model_('tts'), body);
  const parts = (((resp.candidates || [])[0] || {}).content || {}).parts || [];
  const part = parts.filter(p => p.inlineData && p.inlineData.data)[0];
  if (!part) throw new Error('音声データを受け取れませんでした。少し時間をおいてもう一度お試しください。');

  const mime = String(part.inlineData.mimeType || '');
  const raw = Utilities.base64Decode(part.inlineData.data);
  const rate = Number((mime.match(/rate=(\d+)/) || [])[1] || 24000);
  const bytes = /wav/i.test(mime) ? raw : pcmToWav_(raw, rate);

  const file = userFolder_(u.obj.userId).createFile(Utilities.newBlob(bytes, 'audio/wav', 'report_' + hit.obj.reportId + '.wav'));
  hit.obj.audioFileId = file.getId();
  updateRow_(hit.t, hit.idx, hit.obj);
  return { audio: Utilities.base64Encode(bytes), mimeType: 'audio/wav' };
}

function findReport_(reportId, userId) {
  const t = table_(SH.REPORTS);
  const H = colIndex_(t.headers);
  for (let i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][H.reportId]) === String(reportId) && String(t.rows[i][H.userId]) === userId) {
      return { t: t, idx: i, obj: rowToObj_(t.headers, t.rows[i]) };
    }
  }
  throw new Error('振り返りが見つかりません。');
}

function publicReport_(o) {
  const r = parseJson_(o.reportJson, {});
  return {
    reportId: o.reportId, period: o.period, periodLabel: PERIOD_LABEL[o.period] || o.period,
    rangeStart: o.rangeStart, rangeEnd: o.rangeEnd, title: o.title,
    summary: r.summary || '', highlights: r.highlights || [], funBest: r.funBest || '', timeUse: r.timeUse || '', changes: r.changes || '',
    growth: r.growth || '', nextIdea: r.nextIdea || '', script: o.script || '',
    hasAudio: !!o.audioFileId, createdAt: String(o.createdAt)
  };
}

function stats_(allLogs, from, to) {
  const logs = allLogs.filter(l => l.kind !== 'end'); // 開始と終了で二重に数えない
  const cat = {}, areas = {}, tags = {}, days = {};
  const hours = new Array(24).fill(0);
  const wd = [0, 0, 0, 0, 0, 0, 0];
  const wdName = ['日', '月', '火', '水', '木', '金', '土'];
  logs.forEach(l => {
    cat[l.category] = (cat[l.category] || 0) + 1;
    hours[l.hour] = (hours[l.hour] || 0) + 1;
    if (l.area) areas[l.area] = (areas[l.area] || 0) + 1;
    (l.tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; });
    days[l.dateKey] = (days[l.dateKey] || 0) + 1;
    wd[new Date(l.dateKey + 'T12:00:00Z').getUTCDay()]++;
  });
  const bands = { '早朝(5-8時)': 0, '午前(9-11時)': 0, '昼(12-13時)': 0, '午後(14-17時)': 0, '夜(18-22時)': 0, '深夜(23-4時)': 0 };
  hours.forEach((n, h) => {
    const k = h >= 5 && h <= 8 ? '早朝(5-8時)' : h <= 11 && h >= 9 ? '午前(9-11時)' : h >= 12 && h <= 13 ? '昼(12-13時)' : h >= 14 && h <= 17 ? '午後(14-17時)' : h >= 18 && h <= 22 ? '夜(18-22時)' : '深夜(23-4時)';
    bands[k] += n;
  });

  const mid = midDate_(from, to);
  const first = {}, second = {};
  logs.forEach(l => { const m = l.dateKey < mid ? first : second; m[l.category] = (m[l.category] || 0) + 1; });

  const top = (obj, n) => Object.keys(obj).sort((a, b) => obj[b] - obj[a]).slice(0, n).map(k => ({ name: k, count: obj[k] }));
  const weekday = {};
  wd.forEach((n, i) => { weekday[wdName[i]] = n; });

  return {
    total: logs.length,
    activeDays: Object.keys(days).length,
    periodDays: dayDiff_(from, to) + 1,
    distanceKm: Math.round(totalDistanceKm_(logs) * 10) / 10,
    categories: top(cat, 12),
    timeBands: bands,
    weekday: weekday,
    topAreas: top(areas, 8),
    tags: top(tags, 10),
    firstHalfTop: top(first, 5),
    secondHalfTop: top(second, 5),
    timeUse: timeUse_(allLogs, from, to)
  };
}

/** 期間内の「何に何時間」（範囲外にはみ出た分は切り取る） */
function timeUse_(logs, from, to) {
  const tz = tz_();
  const rs = Utilities.parseDate(from + ' 00:00:00', tz, 'yyyy-MM-dd HH:mm:ss').getTime();
  const re = Math.min(Date.now(), Utilities.parseDate(to + ' 23:59:59', tz, 'yyyy-MM-dd HH:mm:ss').getTime() + 1000);
  const min = {};
  let total = 0;
  logs.forEach(l => {
    // 「終了」記録に、ペアの「開始」時刻が入っている
    if (l.kind !== 'end' || !l.pairAt) return;
    const s = Math.max(rs, new Date(l.pairAt).getTime());
    const e = Math.min(re, new Date(l.timestamp).getTime());
    if (e <= s) return;
    const m = (e - s) / 60000;
    min[l.category] = (min[l.category] || 0) + m;
    total += m;
  });
  const days = dayDiff_(from, to) + 1;
  return {
    trackedHours: Math.round(total / 6) / 10,
    avgTrackedHoursPerDay: Math.round(total / days / 6) / 10,
    byCategory: Object.keys(min).sort((a, b) => min[b] - min[a]).map(k => ({ name: k, hours: Math.round(min[k] / 6) / 10, perDayMin: Math.round(min[k] / days) }))
  };
}

function totalDistanceKm_(logs) {
  const byDay = {};
  logs.forEach(l => { if (l.lat !== null && l.lng !== null) (byDay[l.dateKey] = byDay[l.dateKey] || []).push(l); });
  let sum = 0;
  Object.keys(byDay).forEach(d => {
    const arr = byDay[d];
    for (let i = 1; i < arr.length; i++) sum += haversineKm_(arr[i - 1].lat, arr[i - 1].lng, arr[i].lat, arr[i].lng);
  });
  return sum;
}

/**
 * TTS に渡す前の最終クリーニング：指示語・メタテキスト・記号を除去して「純粋な読み上げ原稿」にする
 */
function sanitizeScript_(s) {
  let t = String(s || '');
  t = t.replace(/```[a-zA-Z]*/g, '');
  t = t.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '');
  t = t.replace(/[*#`>_~|]/g, '');
  t = t.replace(/[（(\[［【〔][^）)\]］】〕]{0,40}[）)\]］】〕]/g, ''); // 括弧書き（ト書き）を除去
  t = t.replace(/^\s*(ナレーター|ナレーション|語り手|話者|読み手|スクリプト|原稿|台本|本文|Narrator|Speaker)\s*[:：]\s*/gim, '');
  t = t.replace(/https?:\/\/\S+/g, '');
  const meta = /(読み上げ(て|ます|る|用|原稿)|ナレーション(です|を|原稿|本文)|原稿(です|を|は|になります)|以下(が|は|の|に)|台本|スクリプト|音声(用|で読み))/;
  const sentences = t.match(/[^。！？!?\n]+[。！？!?]?|\n/g) || [];
  t = sentences.filter(x => !meta.test(x)).join('');
  t = t.replace(/^["'「『\s]+|["'」』\s]+$/g, '');
  t = t.replace(/[ \t　]{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
  return t;
}

function clipScript_(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'));
  return end > max * 0.5 ? cut.slice(0, end + 1) : cut;
}

function pcmToWav_(pcm, sampleRate) {
  const ch = 1, bits = 16;
  const byteRate = sampleRate * ch * bits / 8, blockAlign = ch * bits / 8, dataLen = pcm.length;
  const h = [];
  const str = s => { for (let i = 0; i < s.length; i++) h.push(s.charCodeAt(i)); };
  const u32 = v => { h.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255); };
  const u16 = v => { h.push(v & 255, (v >>> 8) & 255); };
  str('RIFF'); u32(36 + dataLen); str('WAVE');
  str('fmt '); u32(16); u16(1); u16(ch); u32(sampleRate); u32(byteRate); u16(blockAlign); u16(bits);
  str('data'); u32(dataLen);
  const header = h.map(b => (b > 127 ? b - 256 : b)); // GAS の Byte[] は符号付き
  return header.concat(pcm);
}

/* =========================================================
 * Google Earth Studio 用データ（KML + キーフレームJSON）
 * ======================================================= */

function api_exportEarth(req, u) {
  const period = PERIOD_DAYS[req.period] ? req.period : '1w';
  const r = range_(Object.assign({}, req, { period: period }));
  const pts = getUserLogs_(u.obj.userId, r.from, r.to).filter(l => l.lat !== null && l.lng !== null);
  if (!pts.length) throw new Error('この期間に位置情報つきの記録がありません。');

  const maxStops = Math.max(2, Number(cfg_('earthMaxStops', '12')));
  const map = {}, order = [];
  pts.forEach(l => {
    const key = l.lat.toFixed(3) + ',' + l.lng.toFixed(3); // 約100m単位でまとめる
    if (!map[key]) {
      map[key] = { key: key, latSum: 0, lngSum: 0, visits: 0, fun: 0, first: l.timestamp, place: l.placeName || l.area || '', cats: {}, notes: [] };
      order.push(key);
    }
    const s = map[key];
    s.latSum += l.lat; s.lngSum += l.lng; s.visits++;
    s.fun += (l.fun || 0) * 3 + l.media.length;
    l.media.forEach(m => { if ((m.caption || m.title) && s.notes.length < 3) s.notes.push(String(m.caption || m.title).slice(0, 30)); });
    s.cats[l.category] = (s.cats[l.category] || 0) + 1;
    if (l.note && s.notes.length < 3) s.notes.push(l.note.slice(0, 30));
    if (!s.place && (l.placeName || l.area)) s.place = l.placeName || l.area;
  });
  let stops = order.map(k => {
    const s = map[k];
    const topCat = Object.keys(s.cats).sort((a, b) => s.cats[b] - s.cats[a])[0];
    return { key: k, lat: s.latSum / s.visits, lng: s.lngSum / s.visits, visits: s.visits, score: s.visits + s.fun, first: s.first, place: s.place || '名もない場所', category: topCat, notes: s.notes, caption: '' };
  });
  if (stops.length > maxStops) {
    const keep = {};
    stops.slice().sort((a, b) => b.score - a.score).slice(0, maxStops).forEach(s => { keep[s.key] = true; }); // おもしろ発見のあった場所を優先
    stops = stops.filter(s => keep[s.key]);
  }

  // Gemini で各地点に短いキャプション（失敗したら地名を使う）
  try {
    const prompt = '行動記録の滞在地リストです。3D空撮動画のテロップに使う、各地点の短いキャプション（16字以内、です・ます不要、絵文字なし）を作ってください。\n' +
      stops.map((s, i) => i + ': ' + s.place + ' / よくしたこと:' + s.category + ' / 訪問' + s.visits + '回' + (s.notes.length ? ' / メモ:' + s.notes.join('、') : '')).join('\n') +
      '\n出力は [{"i":0,"caption":"..."}] 形式のJSON配列のみ。';
    const arr = geminiJson_(model_('text'), prompt, 0.7);
    (Array.isArray(arr) ? arr : []).forEach(c => { if (stops[c.i]) stops[c.i].caption = String(c.caption || '').slice(0, 20); });
  } catch (e) { /* キャプションなしでも書き出す */ }
  stops.forEach(s => { if (!s.caption) s.caption = s.place + '（' + s.category + '）'; });

  const title = cfg_('appName', 'あしあと帳') + ' ' + PERIOD_LABEL[period] + '（' + r.from + '〜' + r.to + '）';
  const center = centerOf_(stops);
  let maxDistKm = 0;
  stops.forEach(s => { maxDistKm = Math.max(maxDistKm, haversineKm_(center.lat, center.lng, s.lat, s.lng)); });
  const overviewRange = clamp_(maxDistKm * 1000 * 2.8, 2500, 2000000);

  const secPerStop = 5, fps = 30;
  const frames = stops.map((s, i) => {
    const prev = i > 0 ? stops[i - 1] : center;
    const next = stops[i + 1];
    const legKm = next ? haversineKm_(s.lat, s.lng, next.lat, next.lng) : (i > 0 ? haversineKm_(prev.lat, prev.lng, s.lat, s.lng) : 1);
    const range = Math.round(clamp_(legKm * 1000 * 0.6, 800, 30000));
    const heading = Math.round(i > 0 ? bearing_(prev.lat, prev.lng, s.lat, s.lng) : 0);
    const tilt = 60;
    const sec = (i + 1) * secPerStop;
    return {
      index: i + 1, seconds: sec, timecode: toTimecode_(sec), frame: sec * fps,
      caption: s.caption, place: s.place, category: s.category, visits: s.visits, firstVisit: s.first,
      lat: round6_(s.lat), lng: round6_(s.lng),
      camera: { heading: heading, tilt: tilt, rangeM: range, altitudeM: Math.round(range * Math.cos(tilt * Math.PI / 180)) }
    };
  });

  const keyframes = {
    format: 'ashiato-earth-keyframes/1',
    title: title, period: period, from: r.from, to: r.to, fps: fps, secondsPerStop: secPerStop,
    totalSeconds: (stops.length + 1) * secPerStop,
    overview: { seconds: 0, timecode: '00:00', lat: round6_(center.lat), lng: round6_(center.lng), camera: { heading: 0, tilt: 45, rangeM: Math.round(overviewRange), altitudeM: Math.round(overviewRange * Math.cos(45 * Math.PI / 180)) } },
    stops: frames
  };

  const route = pts.map(l => l.lng.toFixed(6) + ',' + l.lat.toFixed(6) + ',0');
  const kml = buildKml_(title, stops, frames, route, center, overviewRange);
  return { kml: kml, keyframes: keyframes, stops: frames };
}

function buildKml_(title, stops, frames, route, center, overviewRange) {
  const e = escXml_;
  const cdata = s => '<![CDATA[' + String(s).replace(/]]>/g, ']]&gt;') + ']]>';
  let k = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">\n<Document>\n' +
    '<name>' + e(title) + '</name>\n' +
    '<Style id="stop"><IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href></Icon></IconStyle><LabelStyle><scale>1.1</scale></LabelStyle></Style>\n' +
    '<Style id="route"><LineStyle><color>ff2fa7e3</color><width>4</width></LineStyle></Style>\n' +
    '<Folder><name>滞在地</name>\n';
  stops.forEach((s, i) => {
    k += '<Placemark><name>' + e((i + 1) + '. ' + s.caption) + '</name><styleUrl>#stop</styleUrl>' +
      '<TimeStamp><when>' + e(s.first) + '</when></TimeStamp>' +
      '<description>' + cdata(s.place + ' / ' + s.category + ' / 訪問 ' + s.visits + ' 回' + (s.notes.length ? '\n' + s.notes.join('\n') : '')) + '</description>' +
      '<Point><coordinates>' + s.lng.toFixed(6) + ',' + s.lat.toFixed(6) + ',0</coordinates></Point></Placemark>\n';
  });
  k += '</Folder>\n';
  if (route.length > 1) {
    k += '<Placemark><name>移動ルート</name><styleUrl>#route</styleUrl><LineString><tessellate>1</tessellate><coordinates>' + route.join(' ') + '</coordinates></LineString></Placemark>\n';
  }
  const lookAt = (lat, lng, heading, tilt, range) =>
    '<LookAt><longitude>' + lng.toFixed(6) + '</longitude><latitude>' + lat.toFixed(6) + '</latitude><altitude>0</altitude>' +
    '<heading>' + heading + '</heading><tilt>' + tilt + '</tilt><range>' + Math.round(range) + '</range><altitudeMode>relativeToGround</altitudeMode></LookAt>';
  k += '<gx:Tour><name>振り返りツアー</name><gx:Playlist>\n';
  k += '<gx:FlyTo><gx:duration>3</gx:duration><gx:flyToMode>bounce</gx:flyToMode>' + lookAt(center.lat, center.lng, 0, 45, overviewRange) + '</gx:FlyTo><gx:Wait><gx:duration>2</gx:duration></gx:Wait>\n';
  frames.forEach(f => {
    k += '<gx:FlyTo><gx:duration>4</gx:duration><gx:flyToMode>smooth</gx:flyToMode>' + lookAt(f.lat, f.lng, f.camera.heading, f.camera.tilt, f.camera.rangeM) + '</gx:FlyTo><gx:Wait><gx:duration>2</gx:duration></gx:Wait>\n';
  });
  k += '</gx:Playlist></gx:Tour>\n</Document>\n</kml>\n';
  return k;
}

/* =========================================================
 * 時間記録：「開始」「終了」はそれぞれ独立した記録。
 * 同じカテゴリの 開始→終了 をあとからペアにして、差分（分）を「終了」側に保存する。
 * ======================================================= */

function validKey_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function validHour_(h, d) { const n = Number(h); return (h !== null && h !== undefined && h !== '' && n >= 0 && n <= 23) ? Math.floor(n) : Number(Utilities.formatDate(d, tz_(), 'H')); }
function isEvent_(k) { return k === 'start' || k === 'end'; }

function findInTable_(t, logId) {
  const H = colIndex_(t.headers);
  for (let i = 0; i < t.rows.length; i++) {
    if (String(t.rows[i][H.logId]) === String(logId)) return { t: t, idx: i, obj: rowToObj_(t.headers, t.rows[i]) };
  }
  return null;
}

/**
 * 指定カテゴリの開始・終了をペアにし直す。
 * 時刻順に並べ、「終了」が来たら、それより前でまだペアのない一番新しい「開始」と組む（7日以内）。
 * 組めた「終了」には開始時刻と所要時間（分）を、「開始」には終了時刻を書き込む。
 */
function repairPairs_(t, userId, categories) {
  const H = colIndex_(t.headers);
  const want = {};
  (categories || []).forEach(c => { want[String(c)] = true; });
  const groups = {};
  t.rows.forEach((row, i) => {
    if (String(row[H.userId]) !== userId || toBool_(row[H.deleted])) return;
    const k = String(row[H.kind]);
    if (!isEvent_(k)) return;
    const c = String(row[H.category]);
    if (!want[c]) return;
    (groups[c] = groups[c] || []).push(i);
  });
  const ms = i => new Date(t.rows[i][H.timestamp]).getTime();
  Object.keys(groups).forEach(c => {
    const idxs = groups[c].sort((a, b) => (ms(a) - ms(b)) || (String(t.rows[a][H.kind]) === 'start' ? -1 : 1));
    const next = {};
    idxs.forEach(i => { next[i] = { pairId: '', pairAt: '', pairDateKey: '', durationMin: '' }; });
    const open = [];
    idxs.forEach(i => {
      if (String(t.rows[i][H.kind]) === 'start') { open.push(i); return; }
      while (open.length) {
        const s = open.pop();
        const diff = ms(i) - ms(s);
        if (diff < 0) continue;
        if (diff > MAX_SPAN_MS) { open.length = 0; break; } // それより前の開始はさらに古いので組まない
        const sr = t.rows[s], er = t.rows[i];
        next[s] = { pairId: String(er[H.logId]), pairAt: String(er[H.timestamp]), pairDateKey: String(er[H.dateKey]), durationMin: '' };
        next[i] = { pairId: String(sr[H.logId]), pairAt: String(sr[H.timestamp]), pairDateKey: String(sr[H.dateKey]), durationMin: String(Math.round(diff / 60000)) };
        break;
      }
    });
    idxs.forEach(i => {
      const row = t.rows[i];
      const n = next[i];
      if (String(row[H.pairId]) === n.pairId && String(row[H.pairAt]) === n.pairAt && String(row[H.pairDateKey]) === n.pairDateKey && String(row[H.durationMin]) === n.durationMin) return;
      row[H.pairId] = n.pairId; row[H.pairAt] = n.pairAt; row[H.pairDateKey] = n.pairDateKey; row[H.durationMin] = n.durationMin;
      t.sh.getRange(i + 2, 1, 1, t.headers.length).setValues([row.map(v => (v === null || v === undefined ? '' : String(v)))]);
    });
  });
}

/** まだ終了していない「開始」（7日以内） */
function openStarts_(t, userId) {
  const H = colIndex_(t.headers);
  const limit = Date.now() - MAX_SPAN_MS;
  const out = [];
  t.rows.forEach(row => {
    if (String(row[H.userId]) !== userId || toBool_(row[H.deleted])) return;
    if (String(row[H.kind]) !== 'start' || row[H.pairId]) return;
    if (new Date(row[H.timestamp]).getTime() < limit) return;
    out.push(publicLog_(rowToObj_(t.headers, row), { thumbs: false }));
  });
  return out.sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);
}

function api_getOpen(req, u) {
  return { open: openStarts_(table_(SH.LOGS), u.obj.userId) };
}

/** あとから追加：開始と終了をまとめて記録 */
function api_addEventPair(req, u) {
  const base = req.log || {};
  const st = req.start || {}, en = req.end || {};
  const s = new Date(st.iso), e = new Date(en.iso);
  if (isNaN(s) || isNaN(e)) throw new Error('時刻の形式が正しくありません。');
  if (e < s) throw new Error('終了は開始より後にしてください。');
  if (e - s > MAX_SPAN_MS) throw new Error('開始から終了までは7日以内にしてください。');
  const so = makeLogObj_(u, Object.assign({}, base, { kind: 'start', timestamp: s.toISOString(), dateKey: st.dateKey, hour: st.hour }));
  const eo = makeLogObj_(u, Object.assign({}, base, { kind: 'end', timestamp: e.toISOString(), dateKey: en.dateKey, hour: en.hour, media: [], photo: '' }));
  eo.logId = so.logId + 'E';
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    appendObj_(SH.LOGS, so);
    appendObj_(SH.LOGS, eo);
    const t = table_(SH.LOGS);
    repairPairs_(t, u.obj.userId, [so.category]);
    return { start: publicLog_(findInTable_(t, so.logId).obj, { thumbs: true }), end: publicLog_(findInTable_(t, eo.logId).obj, { thumbs: true }), open: openStarts_(t, u.obj.userId) };
  } finally {
    lock.releaseLock();
  }
}

/** v1.2.0 の「計測（span）」形式の行を、開始・終了の2件に変換する（setup から呼ばれる） */
function migrateSpans_() {
  const t = table_(SH.LOGS);
  const H = colIndex_(t.headers);
  if (H.kind === undefined) return;
  const touched = {};
  const adds = [];
  t.rows.forEach((row, i) => {
    if (String(row[H.kind]) !== 'span') return;
    const o = rowToObj_(t.headers, row);
    if (o.endAt) {
      const e = new Date(o.endAt);
      adds.push({
        logId: o.logId + 'E', userId: o.userId, timestamp: e.toISOString(), dateKey: o.endDateKey || Utilities.formatDate(e, tz_(), 'yyyy-MM-dd'),
        hour: Utilities.formatDate(e, tz_(), 'H'), category: o.category, tags: '[]', media: '[]', createdAt: nowIso_(), deleted: o.deleted || 'FALSE', fun: '0', kind: 'end'
      });
    }
    o.kind = 'start'; o.endAt = ''; o.endDateKey = '';
    updateRow_(t, i, o);
    (touched[o.userId] = touched[o.userId] || {})[o.category] = true;
  });
  adds.forEach(a => appendObj_(SH.LOGS, a));
  if (Object.keys(touched).length) {
    const t2 = table_(SH.LOGS);
    Object.keys(touched).forEach(uid => repairPairs_(t2, uid, Object.keys(touched[uid])));
    Logger.log('v1.2.0 の時間記録を開始・終了の形式に変換しました（' + adds.length + '件の終了を追加）。');
  }
}

/* =========================================================
 * おもしろ記録（写真・動画・声・絵・URL）
 * ======================================================= */

function mediaOf_(o) {
  const list = parseJson_(o.media, []);
  if (o.photoFileId && !list.some(m => m.fileId === o.photoFileId)) {
    list.unshift({ id: o.logId + '_p0', type: 'photo', fileId: o.photoFileId, mime: 'image/jpeg' });
  }
  return list;
}

function publicMedia_(m, withThumb) {
  const out = {};
  Object.keys(m).forEach(k => { if (k !== 'fileId' && k !== 'thumb') out[k] = m[k]; });
  out.hasFile = !!m.fileId;
  if (withThumb && m.thumb) out.thumb = m.thumb;
  return out;
}

function isSealed_(o) { return !!o.capsuleUntil && String(o.capsuleUntil) > todayKey_(); }

/** セル上限（5万字）を超えないよう、超えそうならサムネイルを後ろから外す */
function fitMediaJson_(media) {
  let s = JSON.stringify(media || []);
  for (let i = media.length - 1; i >= 0 && s.length > 45000; i--) {
    if (media[i].thumb) { delete media[i].thumb; s = JSON.stringify(media); }
  }
  for (let i = media.length - 1; i >= 0 && s.length > 45000; i--) {
    if (media[i].transcript) { media[i].transcript = media[i].transcript.slice(0, 200); s = JSON.stringify(media); }
  }
  return s;
}

function saveMediaList_(userId, logId, list) {
  const out = [];
  if (!Array.isArray(list)) return out;
  const folder = userFolder_(userId);
  list.slice(0, MAX_MEDIA).forEach((m, i) => {
    const type = String(m.type || '');
    if (MEDIA_TYPES.indexOf(type) < 0) return;
    const item = { id: logId + '_' + i, type: type, createdAt: nowIso_() };
    let file = null;
    if (type === 'url') {
      const url = String(m.url || '').trim();
      if (!/^https?:\/\/\S+$/i.test(url)) return;
      item.url = url.slice(0, 1000);
      item.title = String(m.title || '').slice(0, 200);
      const yt = ytId_(url);
      if (yt) { item.youtubeId = yt; item.image = 'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg'; }
    } else if (m.dataUrl) {
      file = saveDataUrl_(folder, item.id, String(m.dataUrl));
    } else if (m.fileId) {
      file = DriveApp.getFileById(String(m.fileId));
      if (!inFolder_(file, folder.getId())) throw new Error('アップロードしたファイルを確認できませんでした。');
      file.setName(item.id + extOf_(file.getMimeType()));
    } else {
      return;
    }
    if (file) {
      item.fileId = file.getId();
      item.mime = file.getMimeType();
      item.size = file.getSize();
      if (type === 'video' && toBool_(cfg_('videoLinkShare', 'TRUE'))) {
        try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); item.shared = true; } catch (e) { }
      }
    }
    if (m.thumb && /^data:image\/(jpeg|png|webp);base64,/.test(String(m.thumb)) && String(m.thumb).length < 14000) item.thumb = String(m.thumb);
    if (num_(m.durationSec) !== null) item.durationSec = Math.round(num_(m.durationSec));
    if (num_(m.w) !== null) { item.w = Math.round(num_(m.w)); item.h = Math.round(num_(m.h) || 0); }
    out.push(item);
  });
  return out;
}

function saveDataUrl_(folder, baseName, dataUrl) {
  const m = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+)(;[^,]*)?;base64,(.+)$/);
  if (!m) throw new Error('ファイルの形式を読み取れませんでした。');
  const mime = m[1];
  if (!/^(image|audio|video)\//.test(mime)) throw new Error('保存できないファイル形式です: ' + mime);
  const bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > 25 * 1024 * 1024) throw new Error('ファイルが大きすぎます（この方法では25MBまで）。');
  return folder.createFile(Utilities.newBlob(bytes, mime, baseName + extOf_(mime)));
}

function inFolder_(file, folderId) {
  const it = file.getParents();
  while (it.hasNext()) { if (it.next().getId() === folderId) return true; }
  return false;
}

function extOf_(mime) {
  const map = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic',
    'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/3gpp': '.3gp',
    'audio/webm': '.webm', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'audio/ogg': '.ogg', 'audio/mpeg': '.mp3', 'audio/wav': '.wav'
  };
  return map[String(mime).split(';')[0]] || '';
}

function ytId_(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

/**
 * 大きな動画・音声は、GASで Drive の「再開可能アップロード」セッションを作り、
 * ブラウザから Drive へ直接送る（GAS のリクエスト上限を回避）。
 * Origin を付けてセッションを作ると、そのオリジンからの PUT が CORS で許可される。
 */
function api_startUpload(req, u) {
  const mime = String(req.mimeType || '').split(';')[0];
  if (!/^(video|audio|image)\//.test(mime)) throw new Error('アップロードできない形式です: ' + mime);
  const size = Number(req.size || 0);
  const maxMB = Number(cfg_('maxUploadMB', '100'));
  if (!size || size > maxMB * 1024 * 1024) throw new Error('ファイルが大きすぎます（' + maxMB + 'MBまで）。');
  const origin = String(req.origin || '');
  if (!/^https?:\/\/[^\/\s]+$/.test(origin)) throw new Error('送信元を確認できませんでした。');
  const folder = userFolder_(u.obj.userId);
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,mimeType,size', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': mime,
      'X-Upload-Content-Length': String(size),
      Origin: origin
    },
    payload: JSON.stringify({ name: 'upload_' + Date.now() + extOf_(mime), parents: [folder.getId()], mimeType: mime }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('アップロードの準備に失敗しました（' + res.getResponseCode() + '）。');
  const h = res.getAllHeaders();
  const loc = h.Location || h.location;
  if (!loc) throw new Error('アップロード先を受け取れませんでした。');
  return { uploadUrl: loc };
}

function api_getMedia(req, u) {
  const hit = findLog_(req.logId, u.obj.userId);
  if (isSealed_(hit.obj)) throw new Error('このタイムカプセルはまだ開けられません。');
  const m = mediaOf_(hit.obj).filter(x => x.id === req.mediaId)[0];
  if (!m) throw new Error('ファイルが見つかりません。');
  if (m.type === 'url') return { media: publicMedia_(m, false) };
  const file = DriveApp.getFileById(m.fileId);
  const size = file.getSize();
  if (m.type === 'video' && (size > 15 * 1024 * 1024 || req.preferPreview)) {
    if (!m.shared) {
      try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {
        throw new Error('大きな動画はアプリ内で再生できません。Googleドライブで開いてください。');
      }
    }
    return { previewUrl: 'https://drive.google.com/file/d/' + m.fileId + '/preview', openUrl: file.getUrl() };
  }
  if (size > 25 * 1024 * 1024) return { openUrl: file.getUrl() };
  const blob = file.getBlob();
  return { dataUrl: 'data:' + String(blob.getContentType()).split(';')[0] + ';base64,' + Utilities.base64Encode(blob.getBytes()) };
}

/** AIによる自動キャプション・文字起こし・ページ情報取得（記録後にバックグラウンドで呼ばれる） */
function api_enrichLog(req, u) {
  const hit = findLog_(req.logId, u.obj.userId);
  const media = mediaOf_(hit.obj);
  const useAi = toBool_(cfg_('aiAutoCaption', 'TRUE')) && !!PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const model = model_('text');
  let changed = false;
  media.forEach(m => {
    if (m.ai || req.mediaId && m.id !== req.mediaId) return;
    try {
      if (m.type === 'url') {
        Object.assign(m, fetchUrlMeta_(m.url));
      } else if (useAi && m.fileId) {
        const file = DriveApp.getFileById(m.fileId);
        if (file.getSize() <= 15 * 1024 * 1024) {
          const blob = file.getBlob();
          const r = gemini_(model, {
            contents: [{ role: 'user', parts: [
              { inlineData: { mimeType: String(blob.getContentType()).split(';')[0], data: Utilities.base64Encode(blob.getBytes()) } },
              { text: enrichPrompt_(m.type, hit.obj) }
            ] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.6 }
          });
          const parts = (((r.candidates || [])[0] || {}).content || {}).parts || [];
          const j = parseJson_(parts.map(p => p.text || '').join('').replace(/^```(json)?/i, '').replace(/```$/, '').trim(), {});
          if (j.caption) m.caption = String(j.caption).slice(0, 40);
          if (j.transcript) m.transcript = String(j.transcript).slice(0, 800);
          if (Array.isArray(j.tags)) m.tags = j.tags.map(String).slice(0, 5);
        }
      }
      m.ai = true;
      delete m.aiError;
    } catch (e) {
      m.aiError = String(e.message || e).slice(0, 120);
    }
    changed = true;
  });
  if (changed) {
    const tags = {};
    media.forEach(m => (m.tags || []).forEach(t => { tags[t] = (tags[t] || 0) + 1; }));
    const first = media.filter(m => m.caption || m.title)[0];
    hit.obj.ai = JSON.stringify({ caption: first ? String(first.caption || first.title).slice(0, 40) : '', tags: Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 6) });
    hit.obj.media = fitMediaJson_(media);
    updateRow_(hit.t, hit.idx, hit.obj);
  }
  return { log: publicLog_(hit.obj, { thumbs: true }) };
}

function enrichPrompt_(type, o) {
  const ctx = '記録の状況：' + (o.category || '') + (o.placeName ? '／' + o.placeName : '') + (o.note ? '／メモ「' + String(o.note).slice(0, 60) + '」' : '');
  const tagRule = '"tags":["テーマタグを2〜4個（例：空、看板、生きもの、食べもの、建物、乗りもの、季節、人、音、ことば、アート）"]';
  if (type === 'audio') return '行動記録アプリで録音された声のメモです。' + ctx + '\n次のJSONだけを出力：{"transcript":"話している内容の書き起こし（言いよどみは整える、800字以内）","caption":"内容の要約（25字以内）",' + tagRule + '}';
  if (type === 'drawing') return '行動記録アプリで手描きされた絵です。' + ctx + '\n次のJSONだけを出力：{"caption":"何を描いたか、楽しい一言で（25字以内）",' + tagRule + '}';
  if (type === 'video') return '行動記録アプリで「面白い」と思って撮られた動画です。' + ctx + '\n次のJSONだけを出力：{"caption":"何が面白いのか（25字以内）",' + tagRule + '}';
  return '行動記録アプリで「面白い」と思って撮られた写真です。' + ctx + '\n次のJSONだけを出力：{"caption":"何が面白いのか、見つけた喜びが伝わる一言（25字以内）",' + tagRule + '}';
}

function fetchUrlMeta_(url) {
  const out = {};
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ashiato-cho/1.1)' } });
    if (res.getResponseCode() >= 400) return out;
    const html = res.getContentText().slice(0, 300000);
    const meta = prop => {
      const re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]*content=["\']([^"\']*)["\']', 'i');
      const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + prop + '["\']', 'i');
      const m = html.match(re1) || html.match(re2);
      return m ? decodeEntities_(m[1]).trim() : '';
    };
    const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    out.title = (meta('og:title') || (t ? decodeEntities_(t[1]).trim() : '')).slice(0, 200);
    out.desc = (meta('og:description') || meta('description')).slice(0, 300);
    out.siteName = meta('og:site_name').slice(0, 60);
    const img = meta('og:image');
    if (/^https:\/\//.test(img)) out.image = img.slice(0, 500);
  } catch (e) { }
  Object.keys(out).forEach(k => { if (!out[k]) delete out[k]; });
  return out;
}

function decodeEntities_(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/\s+/g, ' ');
}

/* ---------- あとで楽しむ仕組み ---------- */

/** おもしろ箱：写真・動画・声・絵・URL・★付き・タイムカプセルの一覧 */
function api_listFun(req, u) {
  const ok = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const raw = getUserRawLogs_(u.obj.userId, ok(req.from) ? req.from : '', ok(req.to) ? req.to : '');
  const type = String(req.type || 'all');
  let list = raw.filter(o => {
    const media = mediaOf_(o);
    const fun = Number(o.fun) || 0;
    if (type === 'capsule') return !!o.capsuleUntil;
    if (isSealed_(o)) return type === 'all';
    if (type === 'fun') return fun > 0;
    if (MEDIA_TYPES.indexOf(type) >= 0) return media.some(m => m.type === type);
    return fun > 0 || media.length > 0 || !!o.capsuleUntil;
  });
  if (req.sort === 'fun') list.sort((a, b) => (Number(b.fun) || 0) - (Number(a.fun) || 0) || mediaOf_(b).length - mediaOf_(a).length || (a.timestamp < b.timestamp ? 1 : -1));
  else list.reverse();
  const offset = Math.max(0, Number(req.offset) || 0), limit = Math.min(100, Math.max(1, Number(req.limit) || 48));
  return { items: list.slice(offset, offset + limit).map(o => publicLog_(o, { thumbs: true })), total: list.length };
}

/** あの日のあしあと：1〜3年前の今日・1か月前の今日 */
function api_memories(req, u) {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(String(req.today || '')) ? req.today : todayKey_();
  const p = today.split('-').map(Number);
  const key = (y, m, d) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCDate() !== d) return '';
    return dt.toISOString().slice(0, 10);
  };
  const targets = [
    { label: '1か月前の今日', key: key(p[1] === 1 ? p[0] - 1 : p[0], p[1] === 1 ? 12 : p[1] - 1, p[2]) },
    { label: '1年前の今日', key: key(p[0] - 1, p[1], p[2]) },
    { label: '2年前の今日', key: key(p[0] - 2, p[1], p[2]) },
    { label: '3年前の今日', key: key(p[0] - 3, p[1], p[2]) }
  ].filter(t => t.key);
  const want = {};
  targets.forEach(t => { want[t.key] = []; });
  getUserRawLogs_(u.obj.userId, '', '').forEach(o => { if (want[o.dateKey]) want[o.dateKey].push(o); });
  const groups = [];
  targets.forEach(t => {
    const arr = want[t.key];
    if (!arr.length) return;
    arr.sort((a, b) => ((Number(b.fun) || 0) + mediaOf_(b).length) - ((Number(a.fun) || 0) + mediaOf_(a).length));
    groups.push({ label: t.label, dateKey: t.key, count: arr.length, logs: arr.slice(0, 6).map(o => publicLog_(o, { thumbs: true })) });
  });
  return { groups: groups };
}

/** おもしろガチャ：過去のおもしろ記録をランダムに1つ */
function api_gacha(req, u) {
  const today = todayKey_();
  const raw = getUserRawLogs_(u.obj.userId, '', '').filter(o => o.dateKey < today && !isSealed_(o));
  let pool = raw.filter(o => (Number(o.fun) || 0) > 0 || mediaOf_(o).length);
  if (!pool.length) pool = raw;
  if (!pool.length) throw new Error('ガチャに入れる過去の記録がまだありません。明日また回してみてください。');
  // ★が多いほど出やすい
  const weighted = [];
  pool.forEach(o => { const w = 1 + (Number(o.fun) || 0) * 2 + Math.min(2, mediaOf_(o).length); for (let i = 0; i < w; i++) weighted.push(o); });
  const pick = weighted[Math.floor(Math.random() * weighted.length)];
  return { log: publicLog_(pick, { thumbs: true }), daysAgo: dayDiff_(pick.dateKey, today), poolSize: pool.length };
}

/** タイムカプセル：開封できるもの・封印中の数 */
function api_capsules(req, u) {
  const today = todayKey_();
  const raw = getUserRawLogs_(u.obj.userId, '', '').filter(o => o.capsuleUntil);
  const arrived = raw.filter(o => o.capsuleUntil <= today && !o.capsuleOpenedAt);
  const sealed = raw.filter(o => o.capsuleUntil > today);
  const next = sealed.map(o => o.capsuleUntil).sort()[0] || '';
  return { arrived: arrived.map(o => ({ logId: o.logId, dateKey: o.dateKey, capsuleUntil: o.capsuleUntil, category: o.category })), sealedCount: sealed.length, next: next };
}

function api_openCapsule(req, u) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const hit = findLog_(req.logId, u.obj.userId);
    if (isSealed_(hit.obj)) throw new Error('まだ開けられません（' + hit.obj.capsuleUntil + ' から）。');
    if (!hit.obj.capsuleOpenedAt) { hit.obj.capsuleOpenedAt = nowIso_(); updateRow_(hit.t, hit.idx, hit.obj); }
    return { log: publicLog_(hit.obj, { thumbs: true }), daysAgo: dayDiff_(hit.obj.dateKey, todayKey_()) };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================================
 * Gemini 呼び出し
 * ======================================================= */

function gemini_(model, body) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY が未設定です（GASのスクリプトプロパティ）。');
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = UrlFetchApp.fetch(url, {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key },
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code === 200) return JSON.parse(res.getContentText());
    if ((code === 429 || code >= 500) && attempt < 2) { Utilities.sleep(2000 * (attempt + 1)); continue; }
    let msg = res.getContentText();
    try { msg = JSON.parse(msg).error.message; } catch (e) { }
    throw new Error('Gemini APIエラー（' + code + '）：' + String(msg).slice(0, 200));
  }
}

function geminiJson_(model, prompt, temperature) {
  const resp = gemini_(model, {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: temperature || 0.7 }
  });
  const parts = (((resp.candidates || [])[0] || {}).content || {}).parts || [];
  const text = parts.map(p => p.text || '').join('').replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(text); } catch (e) { throw new Error('AIの応答を読み取れませんでした。もう一度お試しください。'); }
}

/* =========================================================
 * シート・ドライブ・共通ユーティリティ
 * ======================================================= */

function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function table_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」がありません。GASエディタで setup() を実行してください。');
  const values = sh.getDataRange().getValues();
  const headers = (values.shift() || []).map(String);
  return { sh: sh, headers: headers, rows: values };
}

function colIndex_(headers) {
  const m = {};
  headers.forEach((h, i) => { m[h] = i; });
  return m;
}

function rowToObj_(headers, row) {
  const o = {};
  headers.forEach((h, i) => { o[h] = row[i] === undefined ? '' : String(row[i]); });
  return o;
}

function objToRow_(headers, obj) {
  return headers.map(h => (obj[h] === undefined || obj[h] === null ? '' : String(obj[h])));
}

function appendObj_(name, obj) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('シート「' + name + '」がありません。setup() を実行してください。');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const row = objToRow_(headers, obj);
  const r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, row.length).setNumberFormat('@').setValues([row]);
}

function updateRow_(t, idx, obj) {
  t.sh.getRange(idx + 2, 1, 1, t.headers.length).setValues([objToRow_(t.headers, obj)]);
}

function findUser_(field, value) {
  const t = table_(SH.USERS);
  const ci = t.headers.indexOf(field);
  const v = field === 'email' ? normEmail_(value) : String(value);
  for (let i = 0; i < t.rows.length; i++) {
    const cell = field === 'email' ? normEmail_(t.rows[i][ci]) : String(t.rows[i][ci]);
    if (cell && cell === v) return { t: t, idx: i, obj: rowToObj_(t.headers, t.rows[i]) };
  }
  return null;
}

function saveUser_(u) { updateRow_(u.t, u.idx, u.obj); }

function cfg_(key, def) {
  if (!cfg_.cache) {
    cfg_.cache = {};
    try {
      const sh = ss_().getSheetByName(SH.CONFIG);
      if (sh) sh.getDataRange().getValues().slice(1).forEach(r => { if (r[0]) cfg_.cache[String(r[0])] = String(r[1]); });
    } catch (e) { }
  }
  const v = cfg_.cache[key];
  return v === undefined || v === '' ? def : v;
}

function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DRIVE_ROOT_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } }
  const f = DriveApp.createFolder('あしあと帳_data');
  props.setProperty('DRIVE_ROOT_ID', f.getId());
  return f;
}

function userFolder_(userId) {
  const root = rootFolder_();
  const it = root.getFoldersByName(userId);
  return it.hasNext() ? it.next() : root.createFolder(userId);
}

function range_(req) {
  const ok = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  if (ok(req.from) && ok(req.to)) return { from: req.from, to: req.to };
  const days = PERIOD_DAYS[req.period] || 7;
  const tz = tz_();
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 86400000);
  return { from: Utilities.formatDate(from, tz, 'yyyy-MM-dd'), to: Utilities.formatDate(to, tz, 'yyyy-MM-dd') };
}

function midDate_(from, to) {
  const a = new Date(from + 'T12:00:00Z').getTime(), b = new Date(to + 'T12:00:00Z').getTime();
  return new Date((a + b) / 2).toISOString().slice(0, 10);
}

function dayDiff_(from, to) {
  return Math.round((new Date(to + 'T12:00:00Z') - new Date(from + 'T12:00:00Z')) / 86400000);
}

function haversineKm_(lat1, lng1, lat2, lng2) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function bearing_(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * rad) * Math.cos(lat2 * rad);
  const x = Math.cos(lat1 * rad) * Math.sin(lat2 * rad) - Math.sin(lat1 * rad) * Math.cos(lat2 * rad) * Math.cos((lng2 - lng1) * rad);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

function centerOf_(stops) {
  const n = stops.length;
  return { lat: stops.reduce((s, p) => s + p.lat, 0) / n, lng: stops.reduce((s, p) => s + p.lng, 0) / n };
}

function toTimecode_(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

function escXml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function appErr_(msg, code) { const e = new Error(msg); e.code = code; return e; }
function tz_() { return Session.getScriptTimeZone() || 'Asia/Tokyo'; }
function todayKey_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function nowIso_() { return new Date().toISOString(); }
function normEmail_(s) { return String(s || '').trim().toLowerCase(); }
function isEmail_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function toBool_(v) { return v === true || String(v).toUpperCase() === 'TRUE'; }
function num_(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return isFinite(n) ? n : null; }
function round6_(n) { return Math.round(n * 1e6) / 1e6; }
function clamp_(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function sessionSec_() { return Math.min(21600, Math.max(600, Number(cfg_('sessionHours', '6')) * 3600)); }
function parseJson_(s, def) { try { return s ? JSON.parse(s) : def; } catch (e) { return def; } }

/* =========================================================
 * 管理者用（エディタから手動実行）
 * ======================================================= */

/** メールアドレスを指定してアカウントを利用停止／再開する */
function adminSetStatus(email, status) {
  const u = findUser_('email', email);
  if (!u) throw new Error('ユーザーが見つかりません: ' + email);
  u.obj.status = status || 'suspended';
  saveUser_(u);
  Logger.log(email + ' → ' + u.obj.status);
}

/** Gemini API キーとテキスト用モデル（GEMINI_MODEL）の動作確認 */
function testGemini() {
  Logger.log('GEMINI_MODEL = ' + model_('text'));
  const r = geminiJson_(model_('text'), '{"ok":true} というJSONだけを返してください。', 0);
  Logger.log(JSON.stringify(r));
}

/** TTS用モデル（GEMINI_TTS_MODEL）とボイス（GEMINI_TTS_VOICE）の動作確認：ドライブに test_tts.wav を作ります */
function testTts() {
  Logger.log('GEMINI_TTS_MODEL = ' + model_('tts') + ' / GEMINI_TTS_VOICE = ' + model_('voice'));
  const resp = gemini_(model_('tts'), {
    contents: [{ parts: [{ text: 'こんにちは。あしあと帳の音声テストです。' }] }],
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: model_('voice') } } } }
  });
  const parts = (((resp.candidates || [])[0] || {}).content || {}).parts || [];
  const part = parts.filter(p => p.inlineData && p.inlineData.data)[0];
  if (!part) throw new Error('音声データが返ってきませんでした。モデル名を確認してください。');
  const mime = String(part.inlineData.mimeType || '');
  const raw = Utilities.base64Decode(part.inlineData.data);
  const rate = Number((mime.match(/rate=(\d+)/) || [])[1] || 24000);
  const file = rootFolder_().createFile(Utilities.newBlob(/wav/i.test(mime) ? raw : pcmToWav_(raw, rate), 'audio/wav', 'test_tts.wav'));
  Logger.log('OK：' + file.getUrl());
}
