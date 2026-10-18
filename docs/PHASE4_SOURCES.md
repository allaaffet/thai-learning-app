# Phase 4 語彙・文法教材の照合記録

確認日：2026-10-18。参照した資料と、その資料から確認できる範囲を記録する。資料の一部分と一致していても、教材全体の正確性や専門家の監修完了は意味しない。今回の40語・8文法項目・8レッスンはすべてアプリ内で `unreviewed` として扱う。

## `wiktionary-ipa-phase4` — 40語の単語IPA

- 資料：[PyThaiNLP / lexicon-thai — Thai Wiktionary IPA corpus](https://github.com/PyThaiNLP/lexicon-thai/blob/f826bca74edafb281aa2bf7ecbb2ae38ec72fe63/G2P/wiktionary-11-2-2020.tsv)。固定コミット `f826bca74edafb281aa2bf7ecbb2ae38ec72fe63`。
- Phase 3で取得した同固定ファイルを今回も実読し、以下の40語の行を検索・照合した。TSVは780,958 bytes、SHA-256 `c76e217d1857a0fbe60d64a52f5a1eda5702e4fabe64843c4fb90548230607a2`。
- 同コミットの [G2P/README.md](https://github.com/PyThaiNLP/lexicon-thai/blob/f826bca74edafb281aa2bf7ecbb2ae38ec72fe63/G2P/README.md) はThai Wiktionary由来、CC BY-SA 3.0と明記。1,291 bytes、SHA-256 `7cd7f33bee22618b925c3c9fe40482b98694d50ac115d63ae8fad3b5347760eb`。
- 転記時は音素間の空白を除き、`/ /` を付けた。破擦音は既存教材と合わせて `t͡ɕ` を `tɕ`、`t͡ɕʰ` を `tɕʰ` と表記。音節境界の点は保持し、前後の空白を省いた。資料末尾の余分な境界点を採らない。
- 個々の語の少なくとも一つのIPAと照合した記録であり、Wiktionaryの最新本文、日本語訳、例文全体、すべての語義や語用論まで確認したものではない。

| ID                      | 語      | 採用したIPA     |
| ----------------------- | ------- | --------------- |
| person                  | คน      | /kʰon˧/         |
| i-male                  | ผม      | /pʰom˩˩˦/       |
| i-informal              | ฉัน     | /tɕʰan˩˩˦/      |
| you                     | คุณ     | /kʰun˧/         |
| he-she                  | เขา     | /kʰaw˩˩˦/       |
| we                      | เรา     | /raw˧/          |
| eat                     | กิน     | /kin˧/          |
| drink                   | ดื่ม    | /dɯːm˨˩/        |
| go                      | ไป      | /paj˧/          |
| come                    | มา      | /maː˧/          |
| have                    | มี      | /miː˧/          |
| be                      | เป็น    | /pen˧/          |
| stay                    | อยู่    | /juː˨˩/         |
| like                    | ชอบ     | /tɕʰɔːp̚˥˩/      |
| read                    | อ่าน    | /ʔaːn˨˩/        |
| rice                    | ข้าว    | /kʰaːw˥˩/       |
| water                   | น้ำ     | /naːm˦˥/        |
| home                    | บ้าน    | /baːn˥˩/        |
| cat                     | แมว     | /mɛːw˧/         |
| book                    | หนังสือ | /naŋ˩˩˦.sɯː˩˩˦/ |
| good                    | ดี      | /diː˧/          |
| big                     | ใหญ่    | /jaj˨˩/         |
| not                     | ไม่     | /maj˥˩/         |
| question-particle       | ไหม     | /maj˩˩˦/        |
| polite-male             | ครับ    | /kʰrap̚˦˥/       |
| polite-female-statement | ค่ะ     | /kʰaʔ˥˩/        |
| polite-female-question  | คะ      | /kʰaʔ˦˥/        |
| one                     | หนึ่ง   | /nɯŋ˨˩/         |
| two                     | สอง     | /sɔːŋ˩˩˦/       |
| animal-classifier       | ตัว     | /tua̯˧/          |
| book-classifier         | เล่ม    | /lem˥˩/         |
| already                 | แล้ว    | /lɛːw˦˥/        |
| ongoing                 | กำลัง   | /kam˧.laŋ˧/     |
| future                  | จะ      | /tɕaʔ˨˩/        |
| want                    | อยาก    | /jaːk̚˨˩/        |
| request                 | ขอ      | /kʰɔː˩˩˦/       |
| than                    | กว่า    | /kwaː˨˩/        |
| and                     | และ     | /lɛʔ˦˥/         |
| because                 | เพราะ   | /pʰrɔʔ˦˥/       |
| what                    | อะไร    | /ʔa˨˩.raj˧/     |

### 変種と学習用表記

- `ฉัน`・`เขา`・`ไหม`：資料に上昇調と高調の行がある。今回の語彙基本形では上昇調を選び、口語の変異を一律に誤りとしない。
- `ข้าว`・`น้ำ`：長母音・短母音の表記がある。独立した語の基本形として長母音を選ぶ。`ข้าว` は既存教材と同じ表記。
- `ค่ะ`：下降調・低調の行がある。基本練習では下降調を選び、`คะ` の高調と区別する。すべての場面の発話をこの高さへ固定する説明ではない。
- `ครับ`：辞書の `/kʰr/` の形を示す。日常会話の縮約・脱落の全容は扱わない。
- `หนังสือ`・`กำลัง`・`อะไร`：音節区切りは教材データへ個別指定する。Thai文字列を汎用の文字分割や正規化で並べ替えて作るものではない。
- 例文のIPAは、採用した単語IPAを単語境界の空白で組み合わせた**学習用の表記**。文全体の連続発話、リズム、弱化、音の変異を資料で照合した転記ではなく、例文の自然さも専門家監修前。資料の単語IPAを組み合わせた部分の出典・継承条件も維持する。

IPA抜粋の帰属・ライセンス・変更点は [Thai-IPA-ATTRIBUTION.txt](../public/licenses/Thai-IPA-ATTRIBUTION.txt) に記載する。TSV全体は同梱しない。日本語の説明・訳・例文は独立作成であり、原資料の日本語訳ではない。`A1` は本アプリの導入レベル分類で、公的なCEFR認定や試験との対応を保証しない。

## `ud-thai-grammar-phase4` — 文法機能の限定照合

- 資料：[Universal Dependencies — UD for Thai](https://github.com/UniversalDependencies/docs/blob/c1fd2a5bb6f3dfbbedfa1437104d651c358cffa8/_th/index.md)。固定コミット `c1fd2a5bb6f3dfbbedfa1437104d651c358cffa8` の `_th/index.md` をHTTP 200で取得し、実読。
- 2,728 bytes、SHA-256 `30418426e4d72ddef3f59e9bf1f776c3f66222b7d23415efa0c9f6ebbfdf29d1`。
- `Morphology / Tags` は `เป็น` をcopula、`กำลัง` をprogressive、`จะ` をfuture、`แล้ว` をperfectのauxiliaryとして記載。
- `Syntax / Core Arguments` は名詞主語・直接目的語をbare noun phraseと記載。`Non-verbal Clauses` に `เป็น` のcopula記述がある。
- この範囲を `basic-word-order`・`predicates-negation`・`time-aspect` の一部の説明の補助照合として紐付ける。

これはコーパスに統語注釈を付けるための資料である。**SVOのすべての条件、形容詞述語・否定の全用法、時制とアスペクトのすべての分析、初学者への説明全体を検証した資料ではない。** 特に `future` という資料の機能名を、`จะ` がすべての未来事象に必須であることや、日本語の未来形との一対一対応に読み替えない。教材は補助語・文脈による表現として独立して説明する。元資料の本文・例文は教材へ転載しない。

## `ud-thai-classifiers-phase4` — 数詞と類別詞

- [Universal Dependencies — Thai clf](https://github.com/UniversalDependencies/docs/blob/c1fd2a5bb6f3dfbbedfa1437104d651c358cffa8/_th/dep/clf.md)、同固定コミット `_th/dep/clf.md` をHTTP 200で取得・実読。21,338 bytes、SHA-256 `e355964b0f7de6e61269aaeb0090f2d31a85725c9e2f10e9fa85681a9a2ed20a`。
- 冒頭の名詞を数える際の類別詞の使用、名詞の意味分類に応じた類別詞の選択、および `แมว / สาม / ตัว` の例を確認。説明には本に対応する類別詞 `เล่ม` もある。
- [Thai NounType](https://github.com/UniversalDependencies/docs/blob/c1fd2a5bb6f3dfbbedfa1437104d651c358cffa8/_th/feat/NounType.md)、同固定コミット `_th/feat/NounType.md` もHTTP 200で取得・実読。3,786 bytes、SHA-256 `53db6fa2f74ec71ac99a4e5592c6766b548f211268a0e828f3cf0aaf0ef0685e`。
- `Head Noun + Numeral / Quantifier + Classifier` と、名詞修飾が基本的に後置されるという記述を確認。`numbers-classifiers` の基本語順、動物の `ตัว`、本の `เล่ม` の説明の補助照合とする。
- 元資料の議論ログに出てくる全ての例外や統語ラベルの論争を、そのまま初学者向けの規則にはしない。`1` の別語順、教材の個々の例文、全訳を照合したわけではない。本文・例文は転載しない。

## 未照合の範囲

以下は独立作成した教材案であり、今回アクセスできた資料だけで正しさを確認できていない。今後、信頼できる文法書と日本語・タイ語を扱う専門家による確認を優先する。

- 日本語訳、例文の自然さ、例文の全文IPA、単語ごとの文法的役割を含む指導内容。
- 代名詞の場面・立場・親しさによる使い分け、性別との関係、丁寧詞の語用論。
- `ไม่`・`ไหม`・`อะไร`・`ค่ะ`・`คะ` の文法説明全体。
- `อยาก`・`ขอ` の希望・依頼の構文と制約。
- `กว่า`・`และ`・`เพราะ` の比較・接続の説明全体。
- 語彙・文法の出題順序、レベル分類、問題の難易度、教育効果。

NIU / SEA Site、FSI教材、Wikibooks、Wikipediaの本文取得は、この環境ではHTTPS接続時のproxy CONNECT 403で不可。取得できなかった資料は教材の確認済み出典として登録しない。Wiktionaryについても最新単語ページの本文を直接確認したとは表現しない。

録音素材を新規に取得したわけではない。タイ語の音声確認には、利用可能な端末の合成音声を未監修の参考として用いる。IPAの照合を理由に、合成音声の発音・声調が確認済みとすることはない。
