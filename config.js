/**
 * あしあと帳 — 設定ファイル
 * GASのウェブアプリURLはここを書き換えるだけで切り替わります。
 * （アプリ内「設定 → 接続設定」から端末ごとに上書きすることもできます）
 */
window.APP_CONFIG = {
  APP_NAME: 'あしあと帳',
  VERSION: 'v1.6.0',
  GAS_URL: 'https://script.google.com/macros/s/AKfycbyrPkFgwJUoHEdlZF1oYJO-qeWaacN7n1DjupTAcw_58sUBxqKHlFLljFTHDNfrDDeC/exec',

  // 既定のGeminiモデル（画面で選んでいない時に使う）
  // 空文字 '' = 自動（汎用の最新モデル）
  GEMINI_MODEL: '',

  // 「設定 → AIモデル」の選択肢（value がAPIのモデルID）
  // 指定モデルに該当がない（廃止・未公開・名前違い）場合は
  // GAS側で汎用の最新モデルへ自動で切り替わる
  GEMINI_MODEL_OPTIONS: [
    { value: '',                  label: '自動モード（汎用の最新）' },
    { value: 'gemini-4-hydrogen', label: '4 Hydrogen（日々の暮らしをサポート）' },
    { value: 'gemini-4-neon',     label: '4 Neon（Deeper analysis）' },
    { value: 'gemini-4-carbon',   label: '4 Carbon（Code & complex work）' },
    { value: 'gemini-4-argon',    label: '4 Argon' },
    { value: 'gemini-3.8-flash',  label: '3.8 Flash' },
    { value: 'gemini-3.5-flash',  label: '3.5 Flash' }
  ]
};
