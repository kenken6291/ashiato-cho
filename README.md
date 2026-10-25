# あしあと帳（ashiato-cho） v1.1.0

どこで何をしたかをスマホからワンタップで記録し、1週間〜3年の単位でグラフ・Gemini AI・音声（Gemini TTS）・Google Earth Studio の3D空撮で振り返るWebアプリです。

## v1.1.0 で追加したこと

- **おもしろ記録**：📷写真（複数）・🎥動画・🎙声メモ（録音）・✏️絵（手描き）・🔗関連ページのURL を、1回の記録に最大6つ添付。おもしろ度（★1〜3）。
- **AIのひとこと**：記録後にバックグラウンドで、写真・動画・絵にキャプションとテーマタグ、声メモに文字起こしと要約、URLにページの題名・説明・画像を自動で付けます。
- **話して入力（🗣）**：言葉の間が空いても止まらず聞き続けます。無音で認識が切れても自動で再開し、止めるボタンを押すか5分たつまで続きます。
- **あとで楽しむ仕組み**
  - おもしろ箱：集めたおもしろを種類別に眺めるコレクション画面
  - おもしろガチャ：過去のおもしろ記録をランダムに1つ引く（★が多いほど出やすい）
  - タイムカプセル：1週間後〜3年後まで中身を封印。開封日が来ると記録タブに届き、開封の演出つきで開けられる
  - あの日のあしあと：1か月前・1〜3年前の「今日」の記録を記録タブに表示
  - 振り返りの「おもしろベスト」、AI振り返りに「おもしろ発見」の項目、グラフに「うち おもしろ」
  - Earth Studio 書き出しで、おもしろ発見のあった場所を優先してカメラが回る
- **共有から記録**：ホーム画面に追加したあと、ブラウザやSNSアプリの「共有」→「あしあと帳」でURLをそのまま添付できます（Androidなど share_target 対応環境）。

---

## 1. 全体アーキテクチャ

```
[スマホ / PC ブラウザ]  GitHub Pages（index.html / style.css / app.js / config.js / sw.js）
        │  fetch POST（Content-Type: text/plain → プリフライトなし＝CORS回避）
        ▼
[GAS ウェブアプリ] Code.gs  doPost(action振り分け) / doGet(ヘルスチェック)
        ├─ スプレッドシート：Users / Logs / Reports / Config
        ├─ Google Drive「あしあと帳_data/<userId>/」：写真・動画・声メモ・絵・振り返り音声(wav)
        │     ※5MBを超える動画・声は、GASが作った「再開可能アップロード」先へブラウザから直接送信
        ├─ Maps（GAS組込）：逆ジオコーディング（緯度経度→地名・住所・エリア）
        ├─ MailApp：仮パスワードのメール送信
        └─ Gemini API：振り返り分析(JSON) / TTS音声 / Earth Studio用キャプション
```

| 画面 | 内容 |
|---|---|
| 認証 | ログイン／はじめて登録（仮パスワードをメール送信）／パスワードを忘れた（再発行）、全パスワード欄に目玉アイコン |
| パスワード強制変更 | 仮パスワードでログインすると必ずここへ遷移。変更するまでアプリに入れない |
| 記録 | GPS自動取得＋地名自動補完、カテゴリボタンを押す＝即記録（1タップ）。おもしろ添付（写真・動画・声・絵・URL）、ひとこと（話して入力）、おもしろ度、気分、だれと、タイムカプセルは任意。タイムカプセル到着・あの日のあしあとを表示 |
| 履歴 | 日付ごとのタイムライン（添付のサムネイル付き）、タップで再生・表示、修正・削除、30日ずつさかのぼり |
| おもしろ箱 | 種類別フィルタ（★／写真／動画／声／絵／URL／カプセル）、くわしく見る（写真拡大・声の再生と文字起こし・動画再生・URLカード）、ガチャ |
| 振り返り | 1週間／1か月／四半期／1年／2年／3年。カテゴリ比率・時間帯・記録数（うち おもしろ）と移動距離の推移・よく行くエリア、おもしろベスト、AI振り返り＋音声プレイヤー、Earth Studio 書き出し |
| 設定 | ニックネーム、パスワード変更、自分のボタン追加、送信待ち、使い方ガイド、接続設定（GAS URL）、ログアウト |

- 電波がない場所での記録は端末に一時保存され、つながったときに自動送信されます。
- フッターにバージョン（config.js の VERSION）を表示します。
- 初回ログイン時に使い方ガイドが開き、以後は「？」ボタンや設定からいつでも開けます。

---

## 2. スプレッドシート設計

`setup()` を実行すると以下4シートが自動作成されます（全列テキスト書式。日付文字列が勝手に日付型へ変換されるのを防ぐため）。

### Users
| 列 | 内容 |
|---|---|
| userId | `U` + 16桁 |
| email | 小文字で保存 |
| nickname | 表示名 |
| salt | ユーザーごとのソルト（UUID） |
| passwordHash | SHA-256（salt＋password＋pepper を300回反復） |
| mustChange | `TRUE` の間はパスワード変更画面へ強制遷移 |
| status | `active` / `suspended` |
| failCount | 連続ログイン失敗回数 |
| lockUntil | ロック解除時刻（ミリ秒） |
| onboarded | 使い方ガイドを見終えたか |
| prefs | 個人設定JSON（自分で追加したボタンなど） |
| createdAt / lastLoginAt | ISO日時 |

### Logs
| 列 | 内容 |
|---|---|
| logId | `L` + 日時 + 乱数 |
| userId | 所有者 |
| timestamp | ISO日時（UTC） |
| dateKey / hour | 端末のローカル日付 `YYYY-MM-DD` と時（0〜23） |
| lat / lng / accuracy | 緯度・経度・誤差(m) |
| placeName / address / area | 地名（市区＋町）・住所・エリア（都道府県＋市区） |
| category | やったこと（ボタン名） |
| tags | JSON配列（気分・だれと） |
| note | ひとこと |
| photoFileId | v1.0.0 の写真（v1.1.0 では media に統合して表示） |
| createdAt / updatedAt / deleted | 削除は論理削除（添付ファイルはゴミ箱へ） |
| fun | おもしろ度 0〜3 |
| media | 添付のJSON配列：id・type（photo/video/audio/drawing/url）・fileId・mime・size・thumb（小さなサムネイル）・durationSec・url・title・desc・image・caption・transcript・tags など |
| capsuleUntil | タイムカプセルの開封日（この日まで中身は返さない） |
| capsuleOpenedAt | 開封した日時 |
| ai | 記録全体のAIキャプションとタグ |

### Reports
| 列 | 内容 |
|---|---|
| reportId / userId / period | 期間ID（1w,1m,3m,1y,2y,3y） |
| rangeStart / rangeEnd | 対象期間 |
| title | 見出し |
| reportJson | summary / highlights / changes / growth / nextIdea / 集計 |
| script | 読み上げ原稿（メタテキスト除去済み） |
| audioFileId | 生成済みWAVのDrive ID（2回目以降は再生成せず再利用） |
| createdAt | 作成日時 |

### Config（key / value / note）
| key | 既定値 | 用途 |
|---|---|---|
| appName | あしあと帳 | メール件名など |
| appUrl | https://kenken6291.github.io/ashiato-cho/ | メール本文のURL |
| sessionHours | 6 | ログイン保持（CacheService上限が6時間） |
| maxLoginFail / lockMinutes | 5 / 15 | ロック設定 |
| scriptMaxChars | 700 | 読み上げ原稿の上限 |
| earthMaxStops | 12 | Earth Studio に書き出す滞在地の上限 |
| maxUploadMB | 100 | 動画・声1ファイルの上限（MB）。app.js の VIDEO_MAX と合わせる |
| videoLinkShare | TRUE | 動画を「リンクを知っている人のみ閲覧」にしてアプリ内で再生。FALSE なら15MB以下の動画だけアプリ内再生 |
| aiAutoCaption | TRUE | 写真・動画・絵・声のAIキャプション／文字起こしを自動で行う |

Gemini のモデルは Config シートではなく、**スクリプトプロパティ**で指定します（下表）。

### スクリプトプロパティ
| キー | 設定方法 |
|---|---|
| GEMINI_API_KEY | 手動で設定（必須） |
| GEMINI_MODEL | 分析・AIキャプション・声メモの文字起こしに使うモデル。setup() が初期値 `gemini-2.5-flash` を入れるので、使いたいモデル名に書き換え |
| GEMINI_TTS_MODEL | 振り返り音声（TTS）のモデル。初期値 `gemini-2.5-flash-preview-tts` |
| GEMINI_TTS_VOICE | TTSのボイス名。初期値 `Kore` |
| PEPPER | setup() が自動生成（変更しないこと） |
| DRIVE_ROOT_ID | setup() が自動生成 |
| SPREADSHEET_ID | 任意。スタンドアロンのGASで使う場合のみ |

---

## 3. セットアップ & デプロイ手順

### 3-1. スプレッドシートとGAS
1. Googleスプレッドシートを新規作成（名前例：あしあと帳DB）。
2. メニュー「拡張機能 → Apps Script」を開く。
3. `Code.gs` の中身をすべて置き換えて貼り付け、保存。
4. 左の歯車「プロジェクトの設定」→「appsscript.json をエディタで表示する」にチェック → `appsscript.json` を置き換え（タイムゾーンが Asia/Tokyo になります）。
5. 関数 `setup` を選んで「実行」→ 権限を承認（スプレッドシート・ドライブ・メール送信・外部通信）。
6. 「プロジェクトの設定 → スクリプト プロパティ」に `GEMINI_API_KEY` を追加。
   - キーは Google AI Studio（https://aistudio.google.com/apikey）で発行。
7. 「スクリプト プロパティ」の `GEMINI_MODEL` `GEMINI_TTS_MODEL` `GEMINI_TTS_VOICE` を、使いたいモデル名・声に書き換える。
8. 関数 `testGemini` を実行し、ログに `{"ok":true}` が出ればキーとテキスト用モデルはOK。
9. 関数 `testTts` を実行し、ドライブの「あしあと帳_data」に `test_tts.wav` ができればTTSモデルとボイスはOK。
10. Config シートの `appUrl` を実際の公開URLに直す。

### 3-2. ウェブアプリとしてデプロイ
1. 右上「デプロイ → 新しいデプロイ」→ 種類「ウェブアプリ」。
2. 次のユーザーとして実行：**自分**／アクセスできるユーザー：**全員**。
3. デプロイして表示される `https://script.google.com/macros/s/…/exec` をコピー。

> **Code.gs を直したら、必ず「デプロイを管理 → 鉛筆（編集）→ バージョン：新バージョン → デプロイ」をしてください。** 保存しただけでは公開中のURLに反映されません（URLは変わりません）。

### 3-3. GitHub Pages
1. GitHub にリポジトリ `ashiato-cho` を作成。
2. 次のファイルをリポジトリ直下に置く：
   `index.html` `style.css` `app.js` `config.js` `sw.js` `manifest.json` `icon.svg` `icon-192.png` `icon-512.png`
   （`gas/` フォルダはGAS用の控えなので、置いても置かなくても動作に影響しません）
3. `config.js` の `GAS_URL` を 3-2 でコピーしたURLに書き換える。
4. Settings → Pages → Branch: `main` / `(root)` で保存。
5. 数分後 `https://kenken6291.github.io/ashiato-cho/` で開けます。

GAS URL はアプリ内「接続設定」からも端末ごとに上書きでき、「接続を確かめる」で疎通確認できます。

### 3-4. 更新するとき
- フロントを更新したら `config.js` の `VERSION` と `sw.js` の `CACHE` 名を同じ番号に上げると、端末側のキャッシュが確実に入れ替わります。

### 3-5. v1.0.0 から v1.1.0 への更新手順
1. GASの `Code.gs` を置き換えて保存。
2. `setup` をもう一度実行（Logs シートの右端に fun / media / capsuleUntil / capsuleOpenedAt / ai の列が足され、Config に新しい項目が追加されます。既存データはそのまま）。
3. 新しい権限（外部への通信・ドライブ）の承認を求められたら許可。
4. **デプロイを管理 → 編集 → 新バージョン でデプロイ**（URLは変わりません）。
5. GitHub の `index.html` `style.css` `app.js` `config.js` `sw.js` `manifest.json` を置き換え。

---

## 4. Google Earth Studio で振り返り動画を作る

「振り返り」タブで期間を選び「Earth Studio 用データを書き出す」を押すと、2つのファイルが保存されます。

| ファイル | 中身 |
|---|---|
| `ashiato_<期間>_<日付>.kml` | 滞在地（最大12か所、約100m単位でまとめ、Geminiが短いキャプションを付与）、移動ルートの線、Google Earth で再生できる「振り返りツアー」 |
| `ashiato_<期間>_<日付>_keyframes.json` | 0秒の全体俯瞰＋地点ごと5秒間隔のキーフレーム表：タイムコード・フレーム番号（30fps）・緯度経度・カメラの向き（進行方向）・傾き・距離・高度 |

### 手順
1. パソコンの Chrome で Google Earth Studio（https://earth.google.com/studio/）を開き、Googleアカウントでログイン（初回は利用申請が必要な場合があります）。
2. 「Blank Project（空のプロジェクト）」を作成。長さはJSONの `totalSeconds`、フレームレートは30fpsに設定。
3. メニューの「ファイル → インポート → KML」でKMLを読み込むと、滞在地が「3Dトラックポイント」として並びます（ラベル付きの目印になり、動画にも表示できます）。
4. JSONの `overview` を0秒地点に置きます。検索欄に `緯度, 経度` を入れてその場所へ移動し、カメラターゲットをその地点に合わせて、`camera` の値（向き・傾き・距離）でキーフレームを打ちます。
5. 以降 `stops` の順に、`timecode` の位置へ再生ヘッドを動かし、同じようにキーフレームを打ちます。地点間の移動はEarth Studioが自動で滑らかにつなぎます。
   - 手早く作りたいときは、クイックスタートの「Point-to-Point（地点から地点へ）」に、JSONの順番どおり地点を入力してもOKです。
6. 右上「Render」で書き出し（連番画像または動画）。キャプションは `caption` をテロップとして編集ソフトで重ねると分かりやすくなります。
7. Gemini TTS の振り返り音声（Drive の `あしあと帳_data/<userId>/report_*.wav`）をBGMの下に敷くと、ナレーション付きの振り返り動画になります。

> KMLは Google Earth（Web／Pro）でも開けます。「振り返りツアー」を再生すると、Earth Studio を使わずにその場で空撮風の振り返りができます。
>
> Earth Studio のプロジェクトファイル（.esp）は形式が公開されていないため自動生成はせず、公式に読み込めるKMLと、手入力用のキーフレーム表を出力する方式にしています。

---

## 5. Gemini TTS のルール（実装済み）

- 分析プロンプトで「指示語・前置き・見出し・話者名・ト書き・括弧書き・記号・絵文字・URLを一切含めない、最初の一文から語りかけで始まる原稿本文のみ」を指定。
- さらに `sanitizeScript_()` で、「以下がナレーションです」「読み上げてください」「ナレーション：」などの文や、括弧書き・Markdown記号・絵文字を除去してから TTS に渡します。
- TTSの返却（PCM 24kHz/16bit）はGAS側でWAVヘッダーを付けて Drive に保存し、ブラウザの `<audio>` で直接再生します。

---

## 6. 管理用関数（GASエディタから実行）

- `adminSetStatus('mail@example.com', 'suspended')` … 利用停止（`'active'` で再開）
- `testGemini()` … APIキーとモデル名の確認

## 7. 制限・メモ

- Gmail（MailApp）の送信上限は無料アカウントで1日100通程度です。
- 逆ジオコーディングはGAS組込のMapsサービスを使用（座標単位で6時間キャッシュ）。1日の上限を超えた場合も、記録自体は緯度経度つきで保存されます。
- 写真は端末側で長辺1280pxのJPEGに縮小してから送信します。

---

## 8. おもしろ記録のしくみ（v1.1.0）

### 送信の流れ
- 写真（長辺1600pxに縮小）・絵・5MB以下の声や動画 → GAS経由で Drive に保存。
- 5MBを超える動画・声 → `startUpload` でGASが Drive の再開可能アップロード先を作り、ブラウザから Drive へ直接送信（GASのリクエスト上限を回避）。送信後、記録にファイルIDを結びつけます。直接送信がうまくいかない環境では、20MBまではGAS経由に自動で切り替えます。
- 記録が保存されたあと `enrichLog` が裏で動き、AIキャプション・文字起こし・ページ情報を付けます（15MB以下のファイルが対象）。終わると一覧が自動で更新されます。

### 再生・表示
- 写真・絵・声は、表示するときにGAS経由で取り出します（Driveは非公開のまま）。
- 動画は、15MB以下ならそのままアプリ内で再生。それより大きいものは Drive のプレビュー（iframe）で再生するため、`videoLinkShare` が TRUE のとき「リンクを知っている人のみ閲覧」に設定します。リンクは推測できない長いIDですが、気になる場合は FALSE にしてください（大きい動画はドライブで開く表示になります）。
- アップロード直後の大きい動画は、ドライブ側の変換が終わるまで再生できないことがあります。

### 話して入力（🗣）
- `continuous` モードで聞き続け、無音などで認識が切れても自動で再開します。止めるボタンか5分で終了。
- Android の Chrome は continuous で同じ文が重複しやすいため、短く区切って自動再開する方式に切り替え、重複も取り除いています。
- 長い話をそのまま残したいときは「🎙声メモ」で録音すると、AIが文字起こしと要約を付けます。

### オフライン時
- 写真・絵・声・URLの記録は端末に一時保存され、つながったときに自動送信されます（端末の保存容量しだい）。
- 動画は容量が大きいため一時保存せず、入力を残したまま「電波のある場所で送ってください」と案内します。

### タイムカプセル
- 封印中は、サーバーがメモ・添付・タグを返しません（一覧では🔒と開封日だけ表示）。場所・カテゴリはグラフ集計に使われます。
- 開封日以降に記録タブへ「届いています」と表示され、開封すると `capsuleOpenedAt` が記録されます。

---

## 9. v1.1.1：モデル指定をスクリプトプロパティへ

- `GEMINI_MODEL` / `GEMINI_TTS_MODEL` / `GEMINI_TTS_VOICE` をスクリプトプロパティで指定する方式に変更しました。
- スクリプトプロパティの変更は**再デプロイ不要**で、次のリクエストからすぐ反映されます。
- v1.1.0 から更新する場合：Code.gs を置き換えて `setup()` を実行すると、3つのプロパティに初期値が入ります。モデル名を書き換えてから、デプロイを管理 → 新バージョンでデプロイしてください。
- Config シートに残っている `geminiModel` `ttsModel` `ttsVoice` の行は使われなくなったので、削除してかまいません。
