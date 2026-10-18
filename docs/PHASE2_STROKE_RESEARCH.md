# Phase 2 筆順・運筆データの調査記録

調査日: 2026-10-18。実際にHTTP取得して確認した公開資料のみ記録する。

## 結論

独立したライセンス付き運筆軌跡として、`littlefrog1973/writing-practice` の手録りJSONを確認した。データの出所、再利用条件、筆画の並び順・方向の意味を確認できる。原典の著者がタイ語教育の専門家であること、各文字が公的な筆順資料と照合済みであることは確認できていない。したがって、**標準筆順や「正しい筆順」としての採用は未検証**であり、資料の存在・構造確認と教材の教育的監修を分ける。

別系統の公開学習例 `amyggthe1/ggthai` のアニメーションと、少数の運筆の大筋を視覚比較した。これは正式な標準筆順資料との照合を意味しない。同サイトにある素材の再配布ライセンスは確認できなかったため、素材は当リポジトリにコピーしない。

利用する場合の範囲は「参考の運筆例」に限定し、画面に「標準筆順は未検証・専門家監修前」と明示する。学習者の筆順を正解・不正解として採点する根拠にはしない。未検証の軌跡を `validated` として登録しない。標準筆順の提供には、タイ語教育者による個別レビュー、または独立した信頼できる筆順教材との照合が引き続き必要。

## 手録りデータの出典と利用条件

対象リポジトリ: https://github.com/littlefrog1973/writing-practice

参照時の `main` HEAD: `8f2c0e84efb9224835eede55f32d61d4becde1c3`。以下の固定コミットURLを実際に取得し、いずれもHTTP 200を確認した。

| 資料                                                                                                                                                       | 確認した内容                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [README.md](https://github.com/littlefrog1973/writing-practice/blob/8f2c0e84efb9224835eede55f32d61d4becde1c3/README.md)                                    | 9〜10行に全137字をtouchscreenで手録りしたこと、37〜38行に `data/strokes/` がoriginal workでコード同様MITであることを明記 |
| [LICENSE](https://github.com/littlefrog1973/writing-practice/blob/8f2c0e84efb9224835eede55f32d61d4becde1c3/LICENSE)                                        | MIT、Copyright (c) 2026 littlefrog                                                                                       |
| [thai_consonants.json](https://github.com/littlefrog1973/writing-practice/blob/8f2c0e84efb9224835eede55f32d61d4becde1c3/data/strokes/thai_consonants.json) | 子音44字、49筆画、12,593点                                                                                               |
| [thai_vowels.json](https://github.com/littlefrog1973/writing-practice/blob/8f2c0e84efb9224835eede55f32d61d4becde1c3/data/strokes/thai_vowels.json)         | 母音・記号21項目、29筆画、2,457点。複合母音の読み方教材全体とは異なる                                                    |
| [stroke_recorder.gd](https://github.com/littlefrog1973/writing-practice/blob/8f2c0e84efb9224835eede55f32d61d4becde1c3/scripts/stroke_recorder.gd)          | touchscreen入力を順序付き点列として記録するauthoring処理                                                                 |
| [stroke_animator.gd](https://github.com/littlefrog1973/writing-practice/blob/8f2c0e84efb9224835eede55f32d61d4becde1c3/scripts/stroke_animator.gd)          | 保存した筆画・点の順に再生する処理                                                                                       |

READMEはコードのみを曖昧にMITとするのではなく、stroke data自体をMIT対象と明記している。フォントは別のOFLライセンスでありMIT対象とはしていない。手録りの背景に使われたSarabunフォントやGodot本体を取り込む必要はない。

### データの構造と描画順の意味

1セットのJSONは `{ char, set, name, strokes }` オブジェクトの配列。`strokes` の外側配列の順序が筆画順、各筆画の `[x, y]` 配列の順序が運筆方向。座標は描画領域全体を0〜1に正規化した値で、各文字の外接矩形への再正規化ではない。上付き・下付き記号の位置も意味を持つ。

README 529〜532行は「薄いreference glyphをfingerでtraceし、1 touchごとに1 stroke、子どもが書く順で記録」と説明する。549〜552行にはorder and directionがデータの目的と明記される。`stroke_recorder.gd` 6〜8行と実装の `_on_touch` / `_on_drag` / `_finish_stroke` はそれと整合する。

この経路はフォント輪郭の自動抽出や骨格推定ではなく、著者がフォントを見ながら手で入力した軌跡である。README 699〜700行の “Data is authored with the in-app Stroke Recorder (Step 3), not by hand.” はJSON座標を手編集しないという意味であり、9〜10行・37〜38行・recorder実装と合わせて読めば、手書き自体を否定する記述ではない。

ただし、手録りであることと正しい筆順であることは同義ではない。著者が母語話者／タイ語教師であるとの確証や、各文字を特定の公的教材に照合した記録は見つからなかった。

### Git履歴の整合性

[子音JSONの変更履歴](https://github.com/littlefrog1973/writing-practice/commits/main/data/strokes/thai_consonants.json) と [LICENSEの履歴](https://github.com/littlefrog1973/writing-practice/commits/main/LICENSE) をHTTP 200で確認した。

- `4aa9aab5d91743666bf8f90850a82ab0cf2fddf6`: 初期記録。commit説明は4文字をfinger記録し、データは再生成不能な手入力とする。
- `b5b21f6cad664d4683e553bc228e2e4b78ade46d`: 最初のThai子音10文字を記録。既存のก・ขに8文字を追加。
- `67c4031cae8ce1764d485f97f38ddd7ac3f62da5`: 残り34文字の子音を記録。
- `f8e60abbd3cbf86a009114df01fb0e6f2ef739da`: MITおよびフォントのライセンス区分を追加。

記録データの存在、recorderの実装、READMEのライセンス宣言は整合している。commitにAI共同著者がいるが、それを理由に手録りの確証や専門家監修を推測しない。

### ダウンロード内容の識別

固定コミットから取得したバイト列のSHA-256。後日の同一性検証用であり、教材内容の正確性を保証する値ではない。

| ファイル                            | SHA-256                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| `data/strokes/thai_consonants.json` | `9d8bc63e42c027ccae9c4e74dea0df13a53b0c0fb192f57b63beb59ce37abaad` |
| `data/strokes/thai_vowels.json`     | `d80d612185b0fcaad0d8771034a65fc93f9cccade8799349ed166758f11a1a29` |
| `LICENSE`                           | `1eb7b9ca5c16ad212de1766d2ff0d41f3186e491f734e1d3d7af5e99f767773a` |

全65項目に空の筆画がなく、全座標が有限数かつ0〜1内であることをスクリプトで確認した。構造検証であって筆順監修ではない。

### MITライセンス全文

再配布・派生データには著作権表示と許諾文を同梱する。原文:

```text
MIT License

Copyright (c) 2026 littlefrog

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 独立した公開学習例との比較

[amyggthe1/ggthai README](https://github.com/amyggthe1/ggthai/blob/main/README.md) と [PROJECT_LOG.md](https://github.com/amyggthe1/ggthai/blob/main/PROJECT_LOG.md) をHTTP 200で取得。PROJECT_LOGのOpen itemsは子音に “RianThai’s authored centrelines” を使用すると記す。RianThai原典へのURL、オープンライセンス、教育監修者の根拠までは確認できなかった。`kie/glyph.html` はHTTP 200で取得でき、以下4字のmetadataは `derived: false` だった。これはその著者の分類であり、当アプリで検証済みを意味しない。

比較に用いたGIFはいずれもHTTP 200、39フレーム。取得物と比較画像は `/tmp/thai-stroke-research/` のみに置いた。

| 文字 | 実際に参照した公開GIF URL                                                                                                                | littlefrogの軌跡と比較した運筆の大筋                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ก    | [01_kɔɔ_kài.gif](https://raw.githubusercontent.com/amyggthe1/ggthai/main/kie/glyph/thai_stroke_order/01_k%C9%94%C9%94_k%C3%A0i.gif)      | 左下から上がり、左肩・くちばしを経て上のアーチを回り、右下へ下りる一筆が一致 |
| ง    | [07*ŋɔɔ*ŋuu.gif](https://raw.githubusercontent.com/amyggthe1/ggthai/main/kie/glyph/thai_stroke_order/07_%C5%8B%C9%94%C9%94_%C5%8Buu.gif) | 頭の輪、右の縦、左上への払いの順が一致                                       |
| จ    | [08_cɔɔ_caan.gif](https://raw.githubusercontent.com/amyggthe1/ggthai/main/kie/glyph/thai_stroke_order/08_c%C9%94%C9%94_caan.gif)         | 輪を回り、下から右側を上がり、左上へ回る流れが一致                           |
| ม    | [33_mɔɔ_máa.gif](https://raw.githubusercontent.com/amyggthe1/ggthai/main/kie/glyph/thai_stroke_order/33_m%C9%94%C9%94_m%C3%A1a.gif)      | 上の輪、縦、下の輪、右下、右上の順が一致                                     |

**全44字が一致するという結論は出せない。** 例えば同サイトのmetadataはขとคを2画と説明するが、littlefrogでは1画になっている。異なる手書き慣習があり得るが、どちらかを標準の正解と決める根拠はここでは不足する。少数の公開例の類似は、公的な教育標準や専門家によるレビューの代わりにならない。

## 他の候補と不採用の理由

- [Hiswe/thailpha](https://github.com/Hiswe/thailpha): README・LICENSE・3字のSVGをHTTP 200で取得。MITであるが、`characters/c-ko-kai.svg` 等は塗りつぶす閉じた字形輪郭で、順序付きcenterlineではない。フォント由来輪郭を筆順に読み替えない。
- [timothytnm26/abugikha のextract-strokes.py](https://github.com/timothytnm26/abugikha/blob/main/packages/core/scripts/extract-strokes.py): HTTP 200。Noto Sans Thai Loopedを画像化しskeletonizeで推定する処理。ユーザーの方針により教材筆順には使わない。
- [EZThaiNui/ez-thai-with-nui](https://github.com/EZThaiNui/ez-thai-with-nui): README HTTP 200。stroke pathsは検証待ちで空と明記される。
- [thesisbytes/hito](https://github.com/thesisbytes/hito): README・NOTES HTTP 200。Thai44字の実筆順データは未収録。KanjiVG由来の仮名データをThaiに流用しない。
- `tomtomheylen/readthai`: GitHub・draw.js・imgWrite一覧HTTP 200。画像の明示ライセンスを確認できず、筆順素材として転用しない。

## 取得できなかった参照先

以下はHTTP proxyのCONNECT時に403となり本文を読めなかった。内容や利用条件の確認根拠にはしない。

- `https://www.thai-language.com/ref/writing`
- `https://www.thai-language.com/ref/consonants`
- `https://www.thai-language.com/id/131158`
- `https://www.rianthai.com/`
- `https://rianthai.wordpress.com/`
- `https://www.omniglot.com/writing/thai.htm`
- `https://www.thaialphabet.net/`
- `https://en.wikibooks.org/wiki/Thai/Alphabet`
- `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=thai%20stroke%20order`

GitHub REST APIのsearchもCONNECT 403。GitHub公開HTMLのrepository検索とraw.githubusercontent.com、npm registry検索は取得できた。GitHub HTML検索は短時間の多重取得時429もあり、検索語・並列数を調整した。npm検索では筆順データそのものを持つThai packageは確認できなかった。

## アプリへの取り込み

採用したのは上記4字の手録り記録、計841点のみ。`src/data/stroke-trajectories.json` に元の記録を保持し、`stroke-guides.ts` で全点の座標を1000倍してSVGへ変換する。点の省略、並べ替え、輪郭からの新たな軌跡推定は行わない。元データの各筆画はこの4字では各1本だが、標準の正解画数とは表示しない。

型名は `ReferenceStrokeGuide` とし、`verification: "source-checked"` による出典の確認と `standardStrokeVerified: false` による筆順未検証を併記する。著作権・許諾文は `public/licenses/ThaiWritingPractice-MIT.txt` に原文のまま同梱する。専門家監修後の標準筆順としての採否判断は未完了である。
