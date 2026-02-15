/**
 * JMdict JSON版からひらがな辞書を自動構築するスクリプト
 * 使い方: npm run build:dict -w server
 *
 * GitHub上のJMdict JSON版を自動ダウンロードして
 * ひらがなのみの単語を抽出する
 */
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'dictionary.txt');
const CACHE_FILE = path.join(DATA_DIR, 'jmdict-cache.json.gz');

// JMdict simplified JSON from GitHub (maintained by scriptin)
const JMDICT_URL = 'https://github.com/scriptin/jmdict-simplified/releases/latest/download/jmdict-all-3.6.1.json.tgz';
// Alternative: direct JSON (smaller, just words)
const JMDICT_WORDS_URL = 'https://raw.githubusercontent.com/scriptin/jmdict-simplified/refs/heads/master/README.md';

const HIRAGANA_RE = /^[ぁ-ゔっゃゅょゎー]{2,15}$/;
const KATAKANA_RE = /^[ァ-ヴッャュョヮー]{2,15}$/;

function katakanaToHiragana(str: string): string {
  return str.replace(/[ァ-ヶ]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function httpsGet(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const request = (u: string) => {
      https.get(u, { headers: { 'User-Agent': 'scrabble-jp-dict-builder' } }, (res) => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (location) {
            request(location);
            return;
          }
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    };
    request(url);
  });
}

async function downloadAndExtractJMdict(): Promise<Set<string>> {
  // Try using cached file first
  if (fs.existsSync(CACHE_FILE)) {
    console.log('キャッシュファイルを使用します...');
    const compressed = fs.readFileSync(CACHE_FILE);
    const json = JSON.parse(zlib.gunzipSync(compressed).toString('utf-8'));
    return new Set(json as string[]);
  }

  // Get latest release info from GitHub API
  console.log('jmdict-simplified の最新リリースを確認中...');
  try {
    const apiData = await httpsGet('https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest');
    const release = JSON.parse(apiData.toString('utf-8'));

    // Find the jmdict-eng zip (smaller than tgz, and zip is easier to handle)
    const asset = (release.assets as any[]).find((a: any) =>
      a.name.startsWith('jmdict-eng-') && a.name.endsWith('.json.zip')
    );

    if (!asset) {
      throw new Error('jmdict-eng asset not found in release');
    }

    console.log(`ダウンロード中: ${asset.name} ...`);
    const zipData = await httpsGet(asset.browser_download_url);
    console.log(`ダウンロード完了: ${(zipData.length / 1024 / 1024).toFixed(1)} MB`);

    // Parse ZIP - find the JSON entry (simple ZIP parser for single file)
    const jsonContent = await extractJsonFromZip(zipData);
    const json = JSON.parse(jsonContent);
    const words = new Set<string>();

    for (const entry of json.words || []) {
      for (const kana of entry.kana || []) {
        const text = kana.text;
        if (!text) continue;
        if (HIRAGANA_RE.test(text)) {
          words.add(text);
        } else if (KATAKANA_RE.test(text)) {
          // カタカナ語もひらがなに変換して追加
          words.add(katakanaToHiragana(text));
        }
      }
    }

    // Cache the result
    const cacheData = zlib.gzipSync(JSON.stringify([...words]));
    fs.writeFileSync(CACHE_FILE, cacheData);
    console.log('キャッシュを保存しました');

    return words;
  } catch (e) {
    console.log(`GitHub download failed: ${e}`);
    console.log('フォールバック辞書を使用します');
    return buildFallbackDictionary();
  }
}

async function extractJsonFromZip(zipBuffer: Buffer): Promise<string> {
  // Simple ZIP extractor for a single JSON file
  // ZIP end of central directory record is at the end
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= 0; i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error('Invalid ZIP file');

  const centralDirOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
  // Read first central directory entry to get local header offset
  const localHeaderOffset = zipBuffer.readUInt32LE(centralDirOffset + 42);

  // Read local file header
  const sig = zipBuffer.readUInt32LE(localHeaderOffset);
  if (sig !== 0x04034b50) throw new Error('Invalid local file header');

  const compressionMethod = zipBuffer.readUInt16LE(localHeaderOffset + 8);
  const compressedSize = zipBuffer.readUInt32LE(localHeaderOffset + 18);
  const filenameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
  const extraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);

  const dataOffset = localHeaderOffset + 30 + filenameLen + extraLen;
  const compressedData = zipBuffer.subarray(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) {
    return compressedData.toString('utf-8');
  } else if (compressionMethod === 8) {
    return zlib.inflateRawSync(compressedData).toString('utf-8');
  } else {
    throw new Error(`Unsupported compression method: ${compressionMethod}`);
  }
}

function buildFallbackDictionary(): Set<string> {
  console.log('基本辞書を生成します...');
  const basicWords = [
    'あい', 'あう', 'あお', 'あか', 'あき', 'あく', 'あけ', 'あさ', 'あし', 'あせ',
    'あた', 'あつ', 'あて', 'あと', 'あな', 'あに', 'あね', 'あめ', 'あや', 'あゆ',
    'あら', 'あり', 'ある', 'あれ', 'あわ', 'いえ', 'いか', 'いき', 'いく', 'いけ',
    'いし', 'いす', 'いた', 'いち', 'いつ', 'いと', 'いな', 'いぬ', 'いね', 'いま',
    'いみ', 'いも', 'いや', 'いる', 'いれ', 'いろ', 'いわ', 'うえ', 'うお', 'うき',
    'うく', 'うけ', 'うさ', 'うし', 'うす', 'うそ', 'うた', 'うち', 'うつ', 'うで',
    'うに', 'うま', 'うみ', 'うめ', 'うら', 'うり', 'うる', 'うわ', 'えき', 'えさ',
    'えだ', 'えび', 'えり', 'おい', 'おか', 'おき', 'おく', 'おけ', 'おし', 'おす',
    'おそ', 'おち', 'おと', 'おに', 'おの', 'おび', 'おや', 'おり', 'おる', 'おれ',
    'かい', 'かう', 'かお', 'かき', 'かく', 'かげ', 'かさ', 'かし', 'かす', 'かぜ',
    'かた', 'かち', 'かつ', 'かど', 'かな', 'かに', 'かね', 'かば', 'かび', 'かぶ',
    'かべ', 'かま', 'かみ', 'かめ', 'かも', 'から', 'かり', 'かる', 'かれ', 'かわ',
    'きく', 'きし', 'きず', 'きた', 'きぬ', 'きば', 'きみ', 'きも', 'きり', 'きる',
    'きれ', 'くい', 'くき', 'くさ', 'くし', 'くず', 'くせ', 'くち', 'くつ', 'くに',
    'くび', 'くま', 'くみ', 'くも', 'くら', 'くり', 'くる', 'くれ', 'くろ', 'けが',
    'けし', 'けた', 'こい', 'こえ', 'こく', 'こけ', 'ここ', 'こし', 'こす', 'こと',
    'この', 'こま', 'こめ', 'これ', 'ころ', 'さい', 'さか', 'さき', 'さく', 'さけ',
    'さし', 'さす', 'さと', 'さば', 'さま', 'さめ', 'さら', 'さる', 'さわ', 'しお',
    'しか', 'しき', 'した', 'しに', 'しば', 'しま', 'しめ', 'しも', 'しる', 'しろ',
    'すい', 'すき', 'すく', 'すし', 'すず', 'すな', 'すね', 'すみ', 'する', 'せい',
    'せき', 'せと', 'せみ', 'せり', 'そう', 'そこ', 'そで', 'その', 'そば', 'そら',
    'それ', 'たい', 'たか', 'たき', 'たく', 'たけ', 'たこ', 'たち', 'たつ', 'たて',
    'たな', 'たに', 'たね', 'たば', 'たび', 'たま', 'ため', 'たら', 'たり', 'たる',
    'ちか', 'ちち', 'つい', 'つか', 'つき', 'つく', 'つけ', 'つち', 'つな', 'つの',
    'つば', 'つぶ', 'つぼ', 'つま', 'つめ', 'つゆ', 'つる', 'てき', 'てつ', 'てら',
    'てる', 'とい', 'とう', 'とき', 'とく', 'とげ', 'とし', 'との', 'とま', 'とめ',
    'とも', 'とら', 'とり', 'とる', 'どう', 'どこ', 'なお', 'なか', 'なき', 'なく',
    'なげ', 'なし', 'なす', 'なぜ', 'なつ', 'など', 'なな', 'なに', 'なべ', 'なま',
    'なみ', 'なめ', 'なら', 'なり', 'なる', 'なれ', 'なわ', 'にく', 'にし', 'にせ',
    'にわ', 'ぬい', 'ぬか', 'ぬき', 'ぬし', 'ぬの', 'ぬま', 'ぬる', 'ねこ', 'ねじ',
    'ねつ', 'ねる', 'のう', 'のき', 'のこ', 'のち', 'のど', 'のび', 'のみ', 'のむ',
    'のり', 'のる', 'はい', 'はう', 'はか', 'はく', 'はこ', 'はし', 'はず', 'はた',
    'はち', 'はつ', 'はて', 'はと', 'はな', 'はね', 'はは', 'はば', 'はま', 'はめ',
    'はや', 'はら', 'はり', 'はる', 'はれ', 'はん', 'ひか', 'ひき', 'ひく', 'ひげ',
    'ひざ', 'ひし', 'ひじ', 'ひた', 'ひと', 'ひな', 'ひび', 'ひま', 'ひめ', 'ひも',
    'ひら', 'ひる', 'ひれ', 'ひろ', 'ふう', 'ふか', 'ふき', 'ふく', 'ふさ', 'ふし',
    'ふじ', 'ふせ', 'ふた', 'ふち', 'ふで', 'ふと', 'ふな', 'ふね', 'ふみ', 'ふゆ',
    'ふり', 'ふる', 'ふれ', 'ふろ', 'へい', 'へこ', 'へた', 'へび', 'へや', 'へら',
    'へり', 'へる', 'ほう', 'ほか', 'ほし', 'ほそ', 'ほど', 'ほね', 'ほめ', 'ほら',
    'ほり', 'ほる', 'ほん', 'まい', 'まう', 'まえ', 'まき', 'まく', 'まさ', 'まし',
    'ます', 'また', 'まち', 'まつ', 'まと', 'まな', 'まね', 'まま', 'まめ', 'まゆ',
    'まり', 'まる', 'まれ', 'まわ', 'みえ', 'みき', 'みぎ', 'みこ', 'みず', 'みせ',
    'みそ', 'みち', 'みつ', 'みな', 'みね', 'みの', 'みみ', 'みや', 'みる', 'むき',
    'むく', 'むし', 'むす', 'むち', 'むね', 'むら', 'むり', 'むれ', 'めい', 'めし',
    'めす', 'もう', 'もえ', 'もく', 'もし', 'もち', 'もつ', 'もと', 'もの', 'もみ',
    'もも', 'もや', 'もり', 'もる', 'もれ', 'やく', 'やけ', 'やし', 'やす', 'やつ',
    'やど', 'やな', 'やね', 'やぶ', 'やま', 'やみ', 'やめ', 'やり', 'やる', 'ゆう',
    'ゆか', 'ゆき', 'ゆく', 'ゆげ', 'ゆず', 'ゆび', 'ゆめ', 'ゆみ', 'ゆり', 'ゆる',
    'ゆれ', 'よい', 'よう', 'よく', 'よこ', 'よし', 'よそ', 'よつ', 'よび', 'よぶ',
    'よめ', 'より', 'よる', 'よわ', 'らく', 'りく', 'るい', 'るす', 'れい', 'れき',
    'れつ', 'ろう', 'ろく', 'わか', 'わき', 'わく', 'わけ', 'わさ', 'わし', 'わた',
    'わな', 'わに', 'わら', 'わり', 'わる', 'われ', 'わん',
    // 3文字
    'あいだ', 'あいて', 'あおい', 'あかい', 'あかり', 'あがる', 'あける', 'あげる',
    'あさひ', 'あした', 'あせる', 'あそぶ', 'あたま', 'あたり', 'あつい', 'あてる',
    'あなた', 'あぶら', 'あまい', 'あまり', 'あらい', 'あらう', 'あらし', 'あるく',
    'いかり', 'いくつ', 'いくら', 'いける', 'いしき', 'いずみ', 'いずれ', 'いたい',
    'いちご', 'いつか', 'いつも', 'いとこ', 'いなか', 'いのち', 'いのる', 'いれる',
    'いろは', 'うえる', 'うかぶ', 'うける', 'うごく', 'うさぎ', 'うしろ', 'うすい',
    'うたう', 'うちわ', 'うつす', 'うつる', 'うなぎ', 'うなる', 'うまい', 'うまれ',
    'うめる', 'うらみ', 'うわさ', 'えがお', 'えがく', 'えらい', 'えらぶ', 'おかし',
    'おかず', 'おきる', 'おくる', 'おこす', 'おこる', 'おさえ', 'おそい', 'おそれ',
    'おちる', 'おつり', 'おとす', 'おとな', 'おどる', 'おなか', 'おのれ', 'おぼれ',
    'おまけ', 'おもい', 'おもう', 'おもて', 'おやつ', 'およぐ', 'おりる', 'おわり',
    'おんな', 'かえす', 'かえる', 'かがく', 'かがみ', 'かかる', 'かける', 'かげん',
    'かこむ', 'かさね', 'かざり', 'かぞく', 'かたい', 'かたち', 'かたな', 'かたる',
    'かなう', 'かなり', 'かなし', 'かばん', 'かぶる', 'かまう', 'からい', 'からす',
    'からだ', 'かりる', 'かるい', 'かわく', 'かわす', 'かわり', 'かわる',
    'きいろ', 'きかい', 'きけん', 'きざむ', 'きせつ', 'きそく', 'きたい', 'きつい',
    'きつね', 'きのう', 'きぶん', 'きほん', 'きまる', 'きもち', 'きもの', 'きよい',
    'きらい', 'きりん', 'きれい', 'きれる',
    'くさい', 'くさり', 'くすり', 'くだく', 'くもり', 'くらい', 'くらす', 'くるま',
    'くるみ', 'くれる', 'くろい', 'くわえ',
    'けしき', 'けむり', 'けもの', 'こいし', 'こえる', 'こおり', 'ここち', 'こころ',
    'こたえ', 'こだま', 'こちら', 'ことし', 'ことば', 'このは', 'このみ', 'こまか',
    'こまる', 'こめる', 'ころす', 'ころぶ', 'こわい', 'こわす',
    'さがす', 'さがる', 'さかな', 'さくら', 'ささえ', 'さしみ', 'さそう', 'さだめ',
    'さとう', 'さとる', 'さびる', 'さます', 'さむい', 'さめる', 'さわぐ', 'さわる',
    'しあい', 'しかく', 'しかし', 'しかた', 'しかる', 'しくみ', 'しげる', 'しごと',
    'しずか', 'しずく', 'しずむ', 'したい', 'したく', 'しのぶ', 'しばい', 'しぶい',
    'しぼる', 'しまい', 'しまう', 'しまる', 'しみる', 'しめす', 'しめる', 'しらべ',
    'しるし', 'しろい',
    'すがた', 'すきま', 'すぎる', 'すくう', 'すごい', 'すごす', 'すすむ', 'すすめ',
    'すずめ', 'すでに', 'すなお', 'すべて', 'すまい', 'すみれ', 'すわる',
    'せかい', 'せなか', 'せまい', 'せまる', 'せめる',
    'そそぐ', 'そだつ', 'そなえ', 'そまる', 'そめる', 'そろう',
    'たいら', 'たおす', 'たかい', 'たがい', 'たける', 'たしか', 'たすけ', 'たたく',
    'たたみ', 'たてる', 'たとえ', 'たのし', 'たのむ', 'たばこ', 'たぶん', 'たまご',
    'たまる', 'たより', 'たりる', 'たれる',
    'ちいき', 'ちかい', 'ちかく', 'ちから', 'ちがい', 'ちがう',
    'つかう', 'つかむ', 'つかれ', 'つくえ', 'つくす', 'つくる', 'つける', 'つたえ',
    'つつみ', 'つづく', 'つとめ', 'つなぐ', 'つぶす', 'つぼみ', 'つまり', 'つめる',
    'つもり', 'つよい', 'つらい', 'つれる',
    'てがみ', 'てらす', 'てんき',
    'とうふ', 'とおい', 'とおす', 'とおり', 'とかす', 'とくい', 'とける', 'とこや',
    'とじる', 'となり', 'とばす', 'とびら', 'とまる', 'とめる', 'ともに', 'とりい',
    'とれる', 'どうぐ', 'どうぞ',
    'なおす', 'なおる', 'ながい', 'ながす', 'ながめ', 'ながら', 'ながれ', 'なかま',
    'なかみ', 'なくす', 'なげく', 'なげる', 'なごむ', 'なさけ', 'なでる', 'ならう',
    'ならす', 'ならぶ', 'なれる',
    'にがい', 'にぎり', 'にくい', 'にげる', 'にもつ', 'にらむ', 'にんき',
    'ぬける', 'ぬすむ', 'ぬるい',
    'ねがう', 'ねがい', 'ねずみ', 'ねだん', 'ねばる', 'ねむい', 'ねむる', 'ねらう',
    'のこす', 'のこり', 'のせる', 'のぞく', 'のぞみ', 'のぞむ', 'のどか', 'のばす',
    'のびる', 'のぼる', 'のりば',
    'はいる', 'はえる', 'はかる', 'はこぶ', 'はさみ', 'はさむ', 'はしご', 'はしら',
    'はしる', 'はじめ', 'はずす', 'はずれ', 'はたけ', 'はなし', 'はなす', 'はなれ',
    'はねる', 'はまる', 'はやい', 'はらう', 'はるか', 'はれる',
    'ひかり', 'ひかる', 'ひくい', 'ひざし', 'ひたい', 'ひだり', 'ひつじ', 'ひとつ',
    'ひとり', 'ひなた', 'ひねる', 'ひびく', 'ひみつ', 'ひやす', 'ひらく', 'ひろい',
    'ひろう', 'ひろげ',
    'ふかい', 'ふくろ', 'ふさぐ', 'ふしぎ', 'ふせぐ', 'ふたつ', 'ふたり', 'ふだん',
    'ふとい', 'ふぶき', 'ふもと', 'ふやす', 'ふるい', 'ふるう', 'ふれる',
    'へいき', 'へいわ', 'へこむ', 'へらす',
    'ほえる', 'ほぐす', 'ほこり', 'ほしい', 'ほそい', 'ほとけ', 'ほどく', 'ほのか',
    'ほめる', 'ほんき',
    'まいる', 'まかす', 'まがる', 'まくら', 'まける', 'まこと', 'まさか', 'まざる',
    'まじめ', 'まずい', 'またぐ', 'まつり', 'まとめ', 'まなぶ', 'まぬけ', 'まねく',
    'まもる', 'まよう', 'まるい', 'まわす', 'まわり', 'まわる',
    'みえる', 'みかた', 'みがく', 'みせる', 'みちる', 'みつけ', 'みとめ', 'みなと',
    'みなみ', 'みのる', 'みまい', 'みやげ',
    'むかい', 'むかう', 'むかし', 'むける', 'むこう', 'むしろ', 'むすこ', 'むすぶ',
    'むすめ', 'むなし',
    'めがね', 'めくる', 'めぐみ', 'めぐる', 'めざす', 'めだつ', 'めまい',
    'もえる', 'もぐる', 'もたれ', 'もてる', 'もどす', 'もどる', 'もとめ', 'もみじ',
    'もらう', 'もれる',
    'やがて', 'やける', 'やさい', 'やさし', 'やすい', 'やすみ', 'やすむ', 'やせる',
    'やなぎ', 'やはり', 'やぶる', 'やめる',
    'ゆうき', 'ゆうべ', 'ゆかた', 'ゆがむ', 'ゆくえ', 'ゆする', 'ゆずる', 'ゆたか',
    'ゆだん', 'ゆでる', 'ゆびわ', 'ゆるい', 'ゆるす', 'ゆれる',
    'よあけ', 'よせる', 'よなか', 'よほう', 'よろこ', 'よわい', 'よわる',
    'らくだ', 'りかい', 'りくつ', 'りそう',
    'れいぎ', 'れきし',
    'ろうか',
    'わかい', 'わかす', 'わかめ', 'わかる', 'わかれ', 'わざと', 'わすれ', 'わたし',
    'わたす', 'わたる', 'わらう', 'われる',
    // 4文字以上
    'あいさつ', 'あいする', 'あおぞら', 'あかるい', 'あきらめ', 'あたえる', 'あたたか',
    'あたらし', 'あつかう', 'あつまる', 'あつめる', 'あぶない', 'あまえる', 'あやまる',
    'あらそう', 'あらため', 'ありがと', 'あるいは', 'いきもの', 'いただく', 'いちばん',
    'いっしょ', 'うけとる', 'うごかす', 'うしなう', 'うつくし', 'うまれる', 'うれしい',
    'おおきい', 'おおきな', 'おかえり', 'おこなう', 'おさまる', 'おしえる', 'おそらく',
    'おだやか', 'おちつく', 'おとうと', 'おどろく', 'おねがい', 'おぼえる', 'おもいで',
    'おもしろ', 'おやすみ', 'おりがみ', 'かいもの', 'かがやく', 'かくれる', 'かさなる',
    'かさねる', 'かしこい', 'かたかな', 'かたまり', 'かつどう', 'かならず', 'かなしい',
    'かなしみ', 'からだに', 'かわいい', 'かんがえ', 'かんたん', 'きこえる', 'きたない',
    'きびしい', 'きもちが', 'きらきら', 'くだもの', 'くちびる', 'くつした', 'くらべる',
    'くるしい', 'くわしい', 'けいかく', 'こうどう', 'こころみ', 'ことがら', 'こまかい',
    'ごちそう', 'さいしょ', 'さかさま', 'さびしい', 'さまざま', 'しあわせ', 'しずかな',
    'したがう', 'しつもん', 'しっかり', 'しばらく', 'しらべる', 'しんじる', 'すくない',
    'すばらし', 'せいかつ', 'そうだん', 'そだてる', 'それぞれ', 'それでは', 'それでも',
    'それなら', 'たいせつ', 'たおれる', 'たくさん', 'たしかに', 'たすける', 'たずねる',
    'ただいま', 'ただしい', 'たのしい', 'たのしみ', 'たのしむ', 'ちいさい', 'ちいさな',
    'ちかづく', 'つかまえ', 'つかれる', 'つたえる', 'つづける', 'つとめる', 'つながる',
    'つめたい', 'てつだう', 'できごと', 'とうとう', 'ところが', 'ところで', 'とどける',
    'ともだち', 'どうして', 'なかなか', 'ながめる', 'なくなる', 'なつかし', 'ならべる',
    'にぎやか', 'にんげん', 'ぬくもり', 'ねむたい', 'はげしい', 'はじまる', 'はじめて',
    'はたらく', 'はなれる', 'ひきだす', 'ひつよう', 'ひとびと', 'ひとりで', 'ひろがる',
    'ひろげる', 'ふくざつ', 'ふしぎな', 'ふたたび', 'ふるさと', 'ほとんど', 'ほんとう',
    'まいにち', 'まかせる', 'まちがい', 'まちがう', 'まっすぐ', 'まなざし', 'みじかい',
    'みつかる', 'みつける', 'みとめる', 'みなさま', 'みまもる', 'むかえる', 'むずかし',
    'めずらし', 'もちろん', 'もらえる', 'やさしい', 'やすらぎ', 'やっぱり', 'やわらか',
    'ゆうがた', 'ゆっくり', 'ゆるやか', 'よろこび', 'よろこぶ', 'よろしく', 'わすれる',
  ];
  return new Set(basicWords.filter(w => HIRAGANA_RE.test(w)));
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  console.log('辞書ビルドを開始します...');
  const words = await downloadAndExtractJMdict();

  const sorted = [...words].sort();
  fs.writeFileSync(OUTPUT_FILE, sorted.join('\n'), 'utf-8');
  console.log(`辞書生成完了: ${sorted.length} 語 → ${OUTPUT_FILE}`);
}

main().catch(console.error);
