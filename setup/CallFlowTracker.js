"use strict";

class CallFlowTracker {
  constructor(options) {
    this.flowStart = options.flowStart.bind(null);
    this.flowEnd = options.flowEnd.bind(null);
    this.height = 0;
    this.flowId = undefined;
    this.nextFlowId = 1;
  }

  enter() {
    if (this.height === 0) {
      this.flowId = this.nextFlowId++;
      this.flowStart(this.flowId);
    }
    ++this.height;
  }

  defer(flowId) {
    if (this.height === 0) {
      this.flowId = flowId;
      this.flowStart(this.flowId);
    }
    ++this.height;
  }

  leave() {
    --this.height;
    if (this.height === 0) {
      this.flowEnd(this.flowId);
      this.flowId = undefined;
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
    const suspendedFlowId = tracker.flowId;
    tracker.leave();
    return (async () => {
      try {
        const awaitedValue = await value;
        return () => {
          tracker.defer(suspendedFlowId);
          return awaitedValue;
        };
      } catch (e) {
        return () => {
          tracker.defer(suspendedFlowId);
          throw e;
        };
      }
    })();
  }

  async *forAwaitOf(asyncIterator) {
    return ForAwaitOfIterable(asyncIterator, this.tracker);
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
    const suspendedFlowId = tracker.flowId;
    tracker.leave();
    return (async () => {
      try {
        const { done, value } = await asyncIterator.next();
        const awaitedValue = await value;
        return {
          get done() {
            tracker.defer(suspendedFlowId);
            return done;
          },
          value: [awaitedValue],
        };
      } catch (e) {
        return {
          get done() {
            tracker.defer(suspendedFlowId);
            throw e;
          },
          value: undefined,
        };
      }
    })();
  }
}

module.exports = CallFlowTracker;
