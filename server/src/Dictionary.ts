import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class Dictionary {
  private words: Set<string>;

  constructor() {
    this.words = new Set();
    this.load();
  }

  private load(): void {
    const dictPath = path.join(__dirname, '..', 'data', 'dictionary.txt');
    if (!fs.existsSync(dictPath)) {
      console.warn('辞書ファイルが見つかりません:', dictPath);
      return;
    }
    const content = fs.readFileSync(dictPath, 'utf-8');
    for (const line of content.split('\n')) {
      const word = line.trim();
      if (word) {
        this.words.add(word);
      }
    }
    console.log(`辞書読み込み完了: ${this.words.size} 語`);
  }

  isValid(word: string): boolean {
    return this.words.has(word);
  }

  get size(): number {
    return this.words.size;
  }
}
