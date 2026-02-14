import { Tile } from 'shared/src/protocol.js';
import { TILE_DEFINITIONS, RACK_SIZE } from './tiles.js';

export class TileBag {
  private tiles: Tile[] = [];
  private nextId = 0;

  constructor() {
    this.init();
  }

  private init(): void {
    this.tiles = [];
    this.nextId = 0;
    for (const def of TILE_DEFINITIONS) {
      for (let i = 0; i < def.count; i++) {
        this.tiles.push({
          id: this.nextId++,
          char: def.char,
          points: def.points,
          isBlank: def.char === '',
        });
      }
    }
    this.shuffle();
  }

  private shuffle(): void {
    for (let i = this.tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tiles[i], this.tiles[j]] = [this.tiles[j], this.tiles[i]];
    }
  }

  draw(count: number): Tile[] {
    const drawn = this.tiles.splice(0, Math.min(count, this.tiles.length));
    return drawn;
  }

  drawToFill(currentCount: number): Tile[] {
    const needed = RACK_SIZE - currentCount;
    if (needed <= 0) return [];
    return this.draw(needed);
  }

  exchange(tilesToReturn: Tile[]): Tile[] {
    if (this.tiles.length < tilesToReturn.length) {
      throw new Error('袋のタイルが足りません');
    }
    const drawn = this.draw(tilesToReturn.length);
    // 返却タイルをブランク割り当てリセットして袋に戻す
    for (const t of tilesToReturn) {
      if (t.isBlank) {
        t.assignedChar = undefined;
      }
      this.tiles.push(t);
    }
    this.shuffle();
    return drawn;
  }

  remaining(): number {
    return this.tiles.length;
  }

  isEmpty(): boolean {
    return this.tiles.length === 0;
  }
}
