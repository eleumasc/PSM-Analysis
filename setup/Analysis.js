"use strict";

const Logger = require("./Logger");

const setTimeout = global.setTimeout;
const clearTimeout = global.clearTimeout;

class Analysis {
  constructor(options) {
    this.notify = options.notify.bind(null);
    this.logger = null;
    this.still = false;
    this.stillTimeoutId = undefined;
    this.started = false;
  }

  log(logRecord) {
    this.logger?.log(logRecord);
  }

  start(loggingEnabled) {
    this.started = true;
    if (loggingEnabled) {
      this.logger = new Logger();
    }
    this.still = false;
    this._startStillTimeout();
  }

  enterJEU() {
    if (!this.started) return;
    if (!this.still) {
      this._clearStillTimeout();
    } else {
      this.notify({ type: "still-violation" });
    }
  }

  leaveJEU() {
    if (!this.started) return;
    if (!this.still) {
      this._startStillTimeout();
    }
  }

  _startStillTimeout() {
    this._clearStillTimeout();
    this.stillTimeoutId = setTimeout(() => {
      this.notify({
        type: "still",
        logRecords: this.logger?.getLogRecords(),
      });
      this.logger = null;
      this.still = true;
    }, 5000);
    this.notify(`started ${this.stillTimeoutId}`);
  }

  _clearStillTimeout() {
    if (this.stillTimeoutId === undefined) return;
    clearTimeout(this.stillTimeoutId);
    this.notify(`cleared ${this.stillTimeoutId}`);
    this.stillTimeoutId = undefined;
  }
}

module.exports = Analysis;
