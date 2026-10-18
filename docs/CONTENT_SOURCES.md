# 教材の出典と確認状況

最終確認日：2026-10-18

## 現在の品質表示

第1章の全レッスンと10文字の教材は **`unreviewed`（教材案・専門家レビュー前）** です。文字コードと文字名の限定照合はできましたが、IPA・声調・日本語訳・解説・練習用音節を信頼できる言語教育資料と突き合わせる工程は未完了です。操作できるMVPであることと、教材の監修完了は区別します。

`source-checked` を今後使う場合も、その語は記載した出典との限定的な照合を意味します。専門家による監修済み、正確性の保証という意味には使用しません。現在 `source-checked` に設定したレッスンはありません。

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

音声・筆順素材は含めていません。将来追加するときは、独立した素材ID・出典・ライセンス・話者または合成音声の種別・検証状況を保存します。未確認の機械音声をネイティブ発音として表示しません。
