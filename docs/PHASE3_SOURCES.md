# Phase 3 発音・声調資料の照合記録

確認日：2026-10-18。実際に取得・閲覧した資料、確認できた範囲と未確認の範囲を区別する。出典との照合は、タイ語教育の専門家による監修を意味しない。

## 声調規則の独立実装との照合

### `thai-tone-rules-phase3` — Thai Linux Working Group / thpronun

- 著者：`AUTHORS` に Theppitak Karoonboonyanan と記載。README は Metamedia Technology Co., Ltd. の支援を明記する。
- 参照コミット：`014cf525b6e3b8eca6267667e426c14f8c6ad2b5`。
- [README](https://github.com/tlwg/thpronun/blob/014cf525b6e3b8eca6267667e426c14f8c6ad2b5/README)、[AUTHORS](https://github.com/tlwg/thpronun/blob/014cf525b6e3b8eca6267667e426c14f8c6ad2b5/AUTHORS) と、[ToneFromWritten 関数](https://github.com/tlwg/thpronun/blob/014cf525b6e3b8eca6267667e426c14f8c6ad2b5/thortho/thcons.cxx#L97)、[対応テスト表](https://github.com/tlwg/thpronun/blob/014cf525b6e3b8eca6267667e426c14f8c6ad2b5/thortho/tests/test-thcons.cxx#L421) を取得した。
- 照合対象は「すでに解析した子音クラス・生死・母音長・声調記号から声調を決める対応関係」。未解析の文字列の分割、語義、IPA、例外綴り全般を保証する資料としては使わない。
- 原コードはGPLのソフトウェアであり、当アプリへのコード・表の転載や依存追加は行わない。音韻上の対応関係を読み、アプリの独立した実装と比較した。

確認した基本対応は以下のとおり。

| 条件                     | 中子音 | 高子音 | 低子音 |
| ------------------------ | ------ | ------ | ------ |
| 記号なし・生音節         | 平調   | 上昇調 | 平調   |
| 記号なし・死音節・短母音 | 低調   | 低調   | 高調   |
| 記号なし・死音節・長母音 | 低調   | 低調   | 下降調 |
| マイエーク `◌่`          | 低調   | 低調   | 下降調 |
| マイトー `◌้`            | 下降調 | 下降調 | 高調   |

同資料のテストには、中子音＋マイトリー `◌๊` の高調として、生音節だけでなく死音節の例も含む。したがって `โต๊ะ`・`จ๊ะ` のような音節を「死音節だからマイトリーは使えない」と扱わない。

**原実装を綴りの有効性判定としてそのまま使わない。** 原テストには高・低子音とマイトリー／マイチャッタワーの一般的でない組み合わせも `*` 付きで含まれる。アプリでは、規則表が声調値を返せることと、標準的な綴りとして扱えることを分ける。対象外や解析に不確実性がある入力には判定不能を返す。

### 補助照合 — thaiphon

- [5w0rdf15h/thaiphon](https://github.com/5w0rdf15h/thaiphon)、参照コミット `00d500aa66b0092048894d5b437da31b1b38936e`。
- [tone_matrix.py](https://github.com/5w0rdf15h/thaiphon/blob/00d500aa66b0092048894d5b437da31b1b38936e/src/thaiphon/tables/tone_matrix.py)、[README](https://github.com/5w0rdf15h/thaiphon/blob/00d500aa66b0092048894d5b437da31b1b38936e/README.md) を取得した。
- 記号なし・マイエーク・マイトーの対応は上の基本表と一致する。マイトリー／マイチャッタワーは中子音だけの組み合わせとして実装されている。
- 独立した学習者向けソフトウェアとの補助比較であり、文法書や公的な綴り標準の代替にはしない。コードは転載しない。
- 両資料は中子音＋マイチャッタワーの死音節にも値を持つ。アプリがこの入力を対象外とする場合、それは網羅性を抑えた実装上の制限であり、言語学的に「不可能」とは説明しない。

### 生死・先行子音・子音連続の限定確認

- thpronun の [parser.cxx 253行付近](https://github.com/tlwg/thpronun/blob/014cf525b6e3b8eca6267667e426c14f8c6ad2b5/parser/parser.cxx#L253) と [thcons.inl](https://github.com/tlwg/thpronun/blob/014cf525b6e3b8eca6267667e426c14f8c6ad2b5/thortho/thcons.inl) を確認した。末子音がないときは母音の短さ、あるときは /k/・/t/・/p/ の末子音クラスを使って死音節を区別している。長母音だけを見て生音節と決めない。
- thaiphon の [onset.py](https://github.com/5w0rdf15h/thaiphon/blob/00d500aa66b0092048894d5b437da31b1b38936e/src/thaiphon/derivation/onset.py)、[leaders.py](https://github.com/5w0rdf15h/thaiphon/blob/00d500aa66b0092048894d5b437da31b1b38936e/src/thaiphon/tables/leaders.py)、[o_leading.py](https://github.com/5w0rdf15h/thaiphon/blob/00d500aa66b0092048894d5b437da31b1b38936e/src/thaiphon/lexicons/o_leading.py) を確認した。`ห` に続く8字 `ง ญ น ม ย ร ล ว` の対象では実効クラスを高子音とし、`อย่า อยู่ อย่าง อยาก` の4語では発音する /j/ と声調計算に使う中子音クラスを区別している。
- 同 `onset.py` は真の子音連続で最初の子音のクラスを使う。アプリは `ปลา`・`ขวา`・`ความ` など、個別に解析を持つ例でのみこの関係を説明する。任意の二子音の綴りをすべて真の子音連続とみなしたり、原実装の全クラスタ一覧を教材の正解表へ転用したりしない。

## `wiktionary-ipa-phase3` — PyThaiNLP の Thai Wiktionary IPA 抽出

- [PyThaiNLP / lexicon-thai](https://github.com/PyThaiNLP/lexicon-thai)、参照コミット `f826bca74edafb281aa2bf7ecbb2ae38ec72fe63`。
- [G2P/README.md](https://github.com/PyThaiNLP/lexicon-thai/blob/f826bca74edafb281aa2bf7ecbb2ae38ec72fe63/G2P/README.md) は、Thai Wiktionaryから抽出したデータで、出典と同じ **CC BY-SA 3.0** と明記している。
- [wiktionary-11-2-2020.tsv](https://github.com/PyThaiNLP/lexicon-thai/blob/f826bca74edafb281aa2bf7ecbb2ae38ec72fe63/G2P/wiktionary-11-2-2020.tsv) をHTTP 200で取得。780,958 bytes、SHA-256 `c76e217d1857a0fbe60d64a52f5a1eda5702e4fabe64843c4fb90548230607a2`。
- READMEは1,291 bytes、SHA-256 `7cd7f33bee22618b925c3c9fe40482b98694d50ac115d63ae8fad3b5347760eb`。
- 元の単語ページではなく、上記固定コミットの抽出データを参照した。Wiktionaryの最新版の記述を直接確認したとは表示しない。
- TSV全体をアプリへ転載しない。以下の30語について、採用するIPAと声調が抽出データの少なくとも一つの表記に対応することを確認した。単語を区切った元データのスペースを除いた形を以下に示す。

| 語   | 確認したIPA                    |
| ---- | ------------------------------ |
| กา   | /kaː˧/                         |
| ขา   | /kʰaː˩˩˦/                      |
| คา   | /kʰaː˧/                        |
| กะ   | /kaʔ˨˩/                        |
| กิน  | /kin˧/                         |
| ขุด  | /kʰut̚˨˩/                       |
| คิด  | /kʰit̚˦˥/                       |
| มาก  | /maːk̚˥˩/                       |
| รัก  | /rak̚˦˥/                        |
| พูด  | /pʰuːt̚˥˩/                      |
| ข้าว | /kʰaːw˥˩/ と /kʰaw˥˩/ の両表記 |
| ข่าว | /kʰaːw˨˩/                      |
| ค่า  | /kʰaː˥˩/                       |
| ค้า  | /kʰaː˦˥/                       |
| ดี   | /diː˧/                         |
| ป่า  | /paː˨˩/                        |
| ป้า  | /paː˥˩/                        |
| โต๊ะ | /toʔ˦˥/                        |
| หนู  | /nuː˩˩˦/                       |
| หมา  | /maː˩˩˦/                       |
| อย่า | /jaː˨˩/                        |
| ปลา  | /plaː˧/                        |
| ขวา  | /kʰwaː˩˩˦/                     |
| ความ | /kʰwaːm˧/                      |
| หยุด | /jut̚˨˩/                        |
| ใหญ่ | /jaj˨˩/                        |
| อยู่ | /juː˨˩/                        |
| อยาก | /jaːk̚˨˩/                       |
| มา   | /maː˧/                         |
| ม้า  | /maː˦˥/                        |

`จ๊ะ`・`จ๋า` はこの抽出データに該当行がないため、この出典を紐づけない。`ข้าว` の母音長には複数の記載があるので、採用した形と変異の存在を注記する。

確認範囲は上記IPAの照合である。日本語訳、全ての用法、音節解析の例外、学習者への説明の適切さは未監修のため、教材全体の `verification` は `unreviewed` を維持する。CC BY-SA 3.0 の出典表記と変更点（区切りスペースの除去、IPAをスラッシュで囲む整形）を保存する。

## 録音音声の調査

音声の出所、話者、対象の発音、ファイルの存在、再配布条件は個別に確認する。「リポジトリのコードがMIT」という理由だけで、出所不明の第三者音声をMITとして取り込まない。

### 調査したが採用できない候補

| 候補                                                                                                                    | 実際に確認した内容                                                                                                                                                                                  | 不採用の理由                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [marcjulian/siangphasathai](https://github.com/marcjulian/siangphasathai/tree/86588e424404fc8b80a8df69adb4ef4ff3280a0b) | READMEはnative Thai studentによる録音と説明。`strings.xml` はMoh Suthasinyをvoice creditとして記載。MIT License、Copyright (c) 2016 marcjulian。Javaには5声調・長短母音の音声リソース名と対応がある | 固定コミットの実ファイルと全Git履歴を調べたが、参照される `res/raw` の音声自体が含まれていない。ファイルのない再生ボタンは作らない |
| [Noknokyung/Thai-tone-audio](https://github.com/Noknokyung/Thai-tone-audio)                                             | GitHub上に `01_correct.m4a` 等の音声ファイルがある。READMEは “Training Thai tone V1” のみ                                                                                                           | 利用許諾・話者・対象の語／発音の対応を確認できない                                                                                 |
| [omriaviam/thai-tones-audio-boxes-hebrew](https://github.com/omriaviam/thai-tones-audio-boxes-hebrew)                   | READMEと音声フォルダの存在を確認                                                                                                                                                                    | 再配布ライセンスと録音の出所が確認できない                                                                                         |
| [kaebmoo/thaiclock](https://github.com/kaebmoo/thaiclock)                                                               | READMEがGoogle Translate由来のsoundoftext生成音声と明記                                                                                                                                             | 人間の発音録音ではなく、音声素材自体の再利用条件も確認できない                                                                     |

### この環境から本文・音声を取得できなかった候補

以下はHTTPS接続時にHTTP 403（proxy CONNECT拒否）。内容の正確性・ライセンスを確認した資料には数えない。

- `https://www.thai-language.com/ref/tone-rules`
- `https://www.seasite.niu.edu/thai/language/tone_rules.htm`
- `https://en.wiktionary.org/wiki/มา`
- `https://commons.wikimedia.org/w/api.php` のThai音声のメタデータ取得
- `https://upload.wikimedia.org/` の音声ファイル
- `https://fsi-languages.yojik.eu/` のFSI Thai Basic Course本文・録音
- `https://huggingface.co/datasets/google/fleurs/raw/main/README.md`

発音資料が取得できなかった場合も、未確認の録音をネイティブ音声として表示したり、音声ファイルを架空のパスで登録したりしない。端末の音声合成を利用する場合は「端末の合成音声・声調や発音は未検証」と区別し、利用できるThai音声がない場合の非対応表示を用意する。
