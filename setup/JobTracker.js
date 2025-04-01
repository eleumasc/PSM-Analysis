"use strict";

const unbind = require("./util/unbind");

const $Function$$bind = unbind(Function.prototype.bind);

class JobTracker {
  constructor(options) {
    this.jobStart = $Function$$bind(options.jobStart, null);
    this.jobEnd = $Function$$bind(options.jobEnd, null);
    this.height = 0;
    this.jobId = undefined;
    this.nextJobId = 1;
  }

  enter(parentJobId) {
    if (this.height === 0) {
      this.jobId = this.nextJobId++;
      this.jobStart(this.jobId, parentJobId);
    }
    ++this.height;
  }

  leave() {
    --this.height;
    if (this.height === 0) {
      this.jobEnd(this.jobId);
      this.jobId = undefined;
    } else if (this.height < 0) {
      debugger; // this should not happen
    }
  }

  createAdvice() {
    return new Advice(this);
  }
}

class Advice {
  constructor(tracker) {
    this.tracker = tracker;
  }

  enter() {
    this.tracker.enter();
  }

  leave() {
    this.tracker.leave();
  }

  *yield(value) {
    const { tracker } = this;
    tracker.leave();
    try {
      return yield value;
    } finally {
      tracker.enter();
    }
  }

  *yieldDelegate(iterator) {
    for (;;) {
      const it = iterator.next();
      if (it.done) {
        return it.value;
      }
      yield* this.yield(it.value);
    }
  }

  await(value) {
    const { tracker } = this;
    const suspendedJobId = tracker.jobId;
    tracker.leave();
    return (async () => {
      try {
        const awaitedValue = await value;
        return () => {
          tracker.enter(suspendedJobId);
          return awaitedValue;
        };
      } catch (e) {
        return () => {
          tracker.enter(suspendedJobId);
          throw e;
        };
      }
    })();
  }

  forAwaitOf(asyncIterator) {
    return new ForAwaitOfIterable(asyncIterator, this.tracker);
  }
}

class ForAwaitOfIterable {
  constructor(asyncIterator, tracker) {
    this.asyncIterator = asyncIterator;
    this.tracker = tracker;
  }

  [Symbol.asyncIterator]() {
    return new ForAwaitOfIterator(this.asyncIterator, this.tracker);
  }
}

class ForAwaitOfIterator {
  constructor(asyncIterator, tracker) {
    this.asyncIterator = asyncIterator;
    this.tracker = tracker;
  }

  next() {
    const { asyncIterator, tracker } = this;
    const suspendedJobId = tracker.jobId;
    tracker.leave();
    return (async () => {
      try {
        const { done, value } = await asyncIterator.next();
        const awaitedValue = await value;
        return {
          get done() {
            tracker.enter(suspendedJobId);
            return done;
          },
          value: [awaitedValue],
        };
      } catch (e) {
        return {
          get done() {
            tracker.enter(suspendedJobId);
            throw e;
          },
          value: undefined,
        };
      }
    })();
  }
}

module.exports = JobTracker;
