# 教材の出典と確認状況

最終確認日：2026-10-18

## 現在の品質表示

第1〜5章の22レッスン、全44子音、32母音パターンの教材は **`unreviewed`（教材案・専門家レビュー前）** です。文字コードと文字名の限定照合はできましたが、IPA・声調・日本語訳・解説・練習用音節を信頼できる言語教育資料と突き合わせる工程は未完了です。操作できるアプリであることと、教材の監修完了は区別します。

`source-checked` は記載した出典との限定的な照合を意味します。専門家による監修済み、正確性の保証という意味には使用しません。現在 `source-checked` に設定したレッスン・子音・母音はありません。Phase 3の32語のうち30語は、固定版のIPA抽出資料と照合しましたが、語義や音節分析も含めた専門家監修は未完了です。4字の参考運筆例だけは出典の記録軌跡・利用条件を照合し、`source-checked` と `standardStrokeVerified: false` を併記しています。

## 実際に参照できた資料

### `unicode-16` — Unicode Consortium, Unicode 16.0 NamesList

- [公式GitHub上の NamesList.txt](https://raw.githubusercontent.com/unicode-org/unicodetools/main/unicodetools/data/ucd/16.0.0/NamesList.txt)
- HTTPS GET の結果：HTTP 200、2,030,616 bytes。取得日時：2026-10-18。
- 取得したファイルのSHA-256：`6a299e9259d07c2a941fdc967e2117e1246d56aa4e133caff86dfc0845715679`。ファイル先頭に `The Unicode Standard 16.0.0` と記載があることも確認しました。
- 該当箇所：Thai ブロック、U+0E01〜U+0E23 の対象10子音、U+0E30/U+0E32/U+0E34/U+0E35/U+0E38/U+0E39、U+0E48〜U+0E4B。
- 確認した事項：10子音の文字コードと公式英字名、今回使う6母音形のコードと名称、4声調記号のコードと名称。
- 確認していない事項：IPA、声調の実現、子音クラス、語義、用例の自然さ、教育上の説明の正確性。
- 独自の日本語説明を作成し、資料の本文・図版・音声はアプリに転載していません。確認対象は文字そのものと名称という事実情報です。
- 公式PDF `https://www.unicode.org/charts/PDF/U0E00.pdf` はこの環境からHTTP403でした。上記は同じUnicode Consortiumが管理するGitHubの一次資料です。

| 対象              | コードポイント  | Unicode名                                 |
| ----------------- | --------------- | ----------------------------------------- |
| ก                 | U+0E01          | THAI CHARACTER KO KAI                     |
| ข                 | U+0E02          | THAI CHARACTER KHO KHAI                   |
| ค                 | U+0E04          | THAI CHARACTER KHO KHWAI                  |
| ง                 | U+0E07          | THAI CHARACTER NGO NGU                    |
| จ                 | U+0E08          | THAI CHARACTER CHO CHAN                   |
| ด                 | U+0E14          | THAI CHARACTER DO DEK                     |
| ต                 | U+0E15          | THAI CHARACTER TO TAO                     |
| น                 | U+0E19          | THAI CHARACTER NO NU                      |
| ม                 | U+0E21          | THAI CHARACTER MO MA                      |
| ร                 | U+0E23          | THAI CHARACTER RO RUA                     |
| ะ / า             | U+0E30 / U+0E32 | SARA A / SARA AA                          |
| ิ / ี             | U+0E34 / U+0E35 | SARA I / SARA II                          |
| ุ / ู             | U+0E38 / U+0E39 | SARA U / SARA UU                          |
| ◌่ / ◌้ / ◌๊ / ◌๋ | U+0E48〜U+0E4B  | MAI EK / MAI THO / MAI TRI / MAI CHATTAWA |

点線の丸 `◌` は結合記号を見やすくする補助表示で、タイ語の綴りには含めません。

### `unicode-16-phase2` — Unicode 16.0による44子音と母音記号の追加照合

- 上記と同じ公式NamesListを2026-10-18にHTTPSで再取得し、SHA-256が同一であることを確認しました。
- 子音の対象：U+0E01〜U+0E2Eから、母音字のU+0E24 `ฤ`、U+0E26 `ฦ` を除いた全44字。コードと公式英字名を `alphabet.ts` の `unicodeName` に対応させています。
- 母音パターンに使う記号：U+0E30〜U+0E39、U+0E40〜U+0E44、U+0E47。用例に含む声調記号はU+0E48〜U+0E4Bです。32パターンという数はアプリの学習用分類で、Unicodeが32種類の母音を定義しているという意味ではありません。
- `ฤ`・`ฦ` の名前も参照しましたが、このアプリの44子音一覧には含めません。U+0E2F `ฯ` は省略記号として除外しています。
- 確認範囲は文字コードと公式Unicode名のみ。子音クラス、呼び名のIPA、例語の意味・声調、母音の長さ・組み合わせ・読み方の監修根拠には使いません。

追加教材の設計・検証上の制約は [PHASE2_CONTENT.md](PHASE2_CONTENT.md) に記録しています。

### `littlefrog-writing-practice` — 4字の参考運筆記録

- 出典：[littlefrog1973 / writing-practice](https://github.com/littlefrog1973/writing-practice)。参照コミットは `8f2c0e84efb9224835eede55f32d61d4becde1c3` に固定しています。
- [README](https://github.com/littlefrog1973/writing-practice/blob/8f2c0e84efb9224835eede55f32d61d4becde1c3/README.md)、[MIT LICENSE](https://github.com/littlefrog1973/writing-practice/blob/8f2c0e84efb9224835eede55f32d61d4becde1c3/LICENSE)、[子音の手録りJSON](https://github.com/littlefrog1973/writing-practice/blob/8f2c0e84efb9224835eede55f32d61d4becde1c3/data/strokes/thai_consonants.json)をHTTP 200で取得しました。READMEは手録りデータ自体もMIT対象と明記しています。
- 著作権表示は `Copyright (c) 2026 littlefrog`。許諾文を [ThaiWritingPractice-MIT.txt](../public/licenses/ThaiWritingPractice-MIT.txt) に同梱しています。
- アプリで使用するのは `ก`・`ง`・`จ`・`ม` の4字だけです。原記録の点と順序を保ち、座標の表示倍率を変えてSVGとして再生します。フォントの字形輪郭やAIの推測から軌跡を生成していません。
- 原子音JSONのSHA-256：`9d8bc63e42c027ccae9c4e74dea0df13a53b0c0fb192f57b63beb59ce37abaad`。これは取得物の識別用で、筆順の正確性を保証する値ではありません。
- `amyggthe1/ggthai` の公開アニメーションと、この4字の運筆の大筋を比較しました。比較先の再配布ライセンスは確認できなかったため、その素材はコピーしていません。少数の比較は教育標準・専門家レビューに代わりません。
- 確認した範囲：出典、MIT利用条件、人手の記録という説明、データ構造、点列の順序・方向、4字の参考例との大筋の比較。
- 未確認の範囲：著者がタイ語教育の専門家であること、正式な標準筆順との照合、運筆の教育的な正確性。`standardStrokeVerified` は4字とも `false` です。

画面には「参考の運筆例（専門家監修前）」「標準筆順は未検証」を表示します。書いた線を標準筆順として採点する根拠にはしません。他40子音と全母音の未確認アニメーションは提供しません。取得・比較・不採用候補の詳細は [PHASE2_STROKE_RESEARCH.md](PHASE2_STROKE_RESEARCH.md) に記録しています。

## 参照を試みたが取得できなかった資料

以下は**検証済みの根拠ではありません**。接続結果と、今後の照合候補としてのみ記録しています。レッスンの `sourceIds` には取得できたUnicode資料だけを紐づけています。

| 資料候補                                              | URL                                                                                   | この環境での結果                 | 今後の用途                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------ |
| Northern Illinois University, SEAsite Thai Characters | https://seasite.niu.edu/thai/Thai_Characters/Thai_Characters_Index.htm                | HTTPS tunnel HTTP403、本文未取得 | 子音・母音・発音説明の照合候補       |
| FSI Thai Basic Course の保存版                        | https://fsi-languages.yojik.eu/languages/oldfsi/languages/thai.html                   | HTTPS tunnel HTTP403、本文未取得 | 基礎音韻・教材順の照合候補           |
| Thai-language.com, consonants / vowels                | http://www.thai-language.com/ref/consonants / http://www.thai-language.com/ref/vowels | HTTP403、本文未取得              | 発音・子音クラス・母音の補助照合候補 |

資料に到達できなかったことを理由に、照合済みと見せたり、架空の監修者を追加したりしません。ネットワーク制約が変わったら、対象資料の該当記述を確認し、確認範囲と日付を記録します。

## 公開前の確認項目

1. タイ語教育の専門家が、字母名・初頭音・末子音・子音クラスを確認する。
2. 採用語の語義とIPA、5声調の表記を辞書・音韻資料で照合する。高調などの実現には話者差・時代差があるため、概略表記であることを維持する。
3. กา・ก่า・ก้า・ก๊า・ก๋า は条件を固定した比較用音節として確認し、全てを日常語の単語帳へ入れない。
4. 日本語話者向け説明、とくに有気・無気、/ŋ/、母音長、非開放末子音について誤解がないか確認する。
5. 短母音音節の /ʔ/ と声調が含まれる例を、音節全体として確認する。
6. 問題の正解だけでなく、誤答解説と前提知識の範囲も確認する。
7. `ฃ`・`ฅ` の廃用字、`ฑ` の語別の初頭音、低頻度母音の用例と比較用音節の説明を確認する。
8. 4字の参考運筆例を個別に監修し、標準筆順として扱えるかを検討する。ライセンス確認だけを筆順の検証としない。

音声素材は含めていません。将来追加するときは、独立した素材ID・出典・ライセンス・話者または合成音声の種別・検証状況を保存します。未確認の機械音声をネイティブ発音として表示しません。参考運筆例についても、出典との照合と標準筆順の監修を引き続き区別します。

## Phase 3の声調・IPA・合成音声

声調の基本対応はThai Linux Working Groupの固定版実装と独立実装を照合し、32語のうち30語のIPAはPyThaiNLPによるThai Wiktionary抽出資料と照合しました。個々の範囲・コミット・取得物のSHA・未照合の語は [PHASE3_SOURCES.md](PHASE3_SOURCES.md) に記録しています。IPA部分のCC BY-SA 3.0出典表示と変更内容は [Thai-IPA-ATTRIBUTION.txt](../public/licenses/Thai-IPA-ATTRIBUTION.txt) に同梱しました。

再配布可能な録音音声は取得できませんでした。原録音とMITを記した候補には実ファイルがなく、実ファイルのある別候補は音声の利用条件を確認できず、Wikimedia・FSI等は接続403でした。未確認素材は収録していません。

発音ラボと第4・5章の確認画面では、利用者の端末にタイ語の声がある場合に限りWeb Speech APIを使えます。全て「端末の合成音声（未監修）」と表示し、録音・ネイティブ発音・監修済み素材とは扱いません。声の名前と言語を表示し、端末内処理か音声提供元への通信があり得るかをAPI情報から示します。声のライセンスや音声ファイルをアプリへ転載する仕組みではなく、利用者の端末の音声サービスを呼び出します。

聞き分け3問は任意の練習で、XPや解放条件に使いません。タイ語の声がない場合は他言語で代用せず、利用不可を表示します。合成音声の発音・声調の正確性は未検証です。録音教材の整備・タイ語教育者による監修は引き続き残課題です。
