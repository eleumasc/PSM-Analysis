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
    ++this.depth;
    this._enter?.(...arguments);
  }

  leave() {
    this._leave?.(...arguments);
    --this.depth;
    if (this.depth === 0) {
      this.leaveJEU();
    }
  }

  *yield(value) {
    --this.depth;
    if (this.depth === 0) {
      this.leaveJEU();
    }
    try {
      return yield value;
    } finally {
      if (this.depth === 0) {
        this.enterJEU();
      }
      ++this.depth;
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
