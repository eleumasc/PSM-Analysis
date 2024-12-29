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

  *yield(value) {
    this.leave();
    try {
      return yield value;
    } finally {
      this.enter();
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

  async await(value) {
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

module.exports = CallFlowTracker;
