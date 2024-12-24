class Recorder {
  constructor() {
    this.records = [];
  }

  add(record) {
    this.records.push(record);
  }

  getRecords() {
    return [...this.records];
  }
}

module.exports = Recorder;
