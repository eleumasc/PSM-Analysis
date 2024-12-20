class Logger {
  constructor() {
    this.logRecords = [];
  }

  log(logRecord) {
    this.logRecords.push(logRecord);
  }

  getLogRecords() {
    return [...this.logRecords];
  }
}

module.exports = Logger;
