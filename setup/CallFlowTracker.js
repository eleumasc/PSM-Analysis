"use strict";

class CallFlowTracker {
  constructor(options) {
    this.flowStart = options.flowStart.bind(null);
    this.flowEnd = options.flowEnd.bind(null);
    this.flowContinue = options.flowContinue.bind(null);
    this.height = 0;
    this.flowId = undefined;
    this.nextFlowId = 1;
  }

  requestNextFlowId() {
    if (this.height !== 0) {
      throw new Error(
        "Cannot request nextFlowID if height is greater than zero"
      );
    }
    return this.nextFlowId;
  }

  enter() {
    if (this.height === 0) {
      this.flowId = this.nextFlowId++;
      this.flowStart(this.flowId);
    }
    ++this.height;
  }

  continue(flowId) {
    if (this.height === 0) {
      this.flowId = flowId;
      this.flowContinue(this.flowId);
    }
    ++this.height;
  }

  leave() {
    --this.height;
    if (this.height === 0) {
      this.flowEnd(this.flowId);
      this.flowId = undefined;
    }
  }

  createAdvice() {
    return {
      enter: function () {
        this.enter();
      }.bind(this),

      leave: function () {
        this.leave();
      }.bind(this),

      yield: function* (value) {
        this.leave();
        try {
          return yield value;
        } finally {
          this.enter();
        }
      }.bind(this),

      yieldDelegate: function* (iterator) {
        for (;;) {
          const it = iterator.next();
          if (it.done) {
            return it.value;
          }
          yield* this.yield(it.value);
        }
      }.bind(this),

      await: async function (value) {
        this.flowEnd(this.flowId);
        const suspendedHeight = this.height;
        const suspendedFlowId = this.flowId;
        this.height = 0;
        this.flowId = undefined;
        try {
          return await value;
        } finally {
          this.height = suspendedHeight;
          this.flowId = suspendedFlowId;
          this.flowContinue(this.flowId);
        }
      }.bind(this),

      forAwaitOf: async function* (asyncIterator) {
        for (;;) {
          const it = await this.await(asyncIterator.next());
          if (it.done) {
            return it.value;
          }
          yield* this.yield(it.value);
        }
      }.bind(this),
    };
  }
}

module.exports = CallFlowTracker;
