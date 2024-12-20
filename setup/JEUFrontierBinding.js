"use strict";

class JEUFrontierBinding {
  constructor(options) {
    this.enterJEU = options.enterJEU.bind(null);
    this.leaveJEU = options.leaveJEU.bind(null);
    this._enter = options.enter?.bind(null);
    this._leave = options.leave?.bind(null);
    this.depth = 0;
  }

  enter() {
    if (this.depth === 0) {
      this.enterJEU();
    }
    this._enter?.(...arguments);
    ++this.depth;
  }

  leave() {
    --this.depth;
    this._leave?.(...arguments);
    if (this.depth === 0) {
      this.leaveJEU();
    }
  }

  *yield(value) {
    this.leaveJEU();
    --this.depth;
    try {
      return yield value;
    } finally {
      ++this.depth;
      this.enterJEU();
    }
  }

  *yieldDelegate(delegate) {
    for (const value of delegate) {
      yield* this.yield(value);
    }
  }

  async await(value) {
    const savedDepth = this.depth;
    this.leaveJEU();
    this.depth = 0;
    try {
      return await value;
    } finally {
      this.depth = savedDepth;
      this.enterJEU();
    }
  }

  async *forAwaitOf(asyncIterator) {
    for (;;) {
      const it = await this.await(asyncIterator.next());
      if (it.done) {
        return it.value;
      }
      yield* this.yield(it.value);
    }
  }
}

module.exports = JEUFrontierBinding;
