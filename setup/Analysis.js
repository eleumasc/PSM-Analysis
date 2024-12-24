"use strict";

const Recorder = require("./Recorder");

const setTimeout = global.setTimeout;
const clearTimeout = global.clearTimeout;

class Analysis {
  constructor(options) {
    this.notify = options.notify.bind(null);
    this.noise = new Set();
    this.recorder = null;
    this.recordingTimeout = undefined;
  }

  addRecord(record) {
    const { noise, recorder } = this;
    if (recorder) {
      if (record.type === "functionCall") {
        if (!noise.has(getFunctionCallRecordId(record))) {
          recorder.add(record);
        }
      } else {
        recorder.add(record);
      }
    } else {
      if (record.type === "functionCall") {
        noise.add(getFunctionCallRecordId(record));
      }
    }
  }

  startRecording() {
    this.recordingTimeout === undefined || clearTimeout(this.recordingTimeout);
    this.recorder || (this.recorder = new Recorder());
    this.recordingTimeout = setTimeout(() => {
      // this.notify({
      //   type: "recordingResult",
      //   records: this.recorder.getRecords(),
      // });
      console.log({
        type: "recordingResult",
        records: this.recorder.getRecords(),
      });
      this.recorder = null;
      this.recordingTimeout = undefined;
    }, 5000);
  }
}

function getFunctionCallRecordId(record) {
  const { loc } = record;
  return loc[0] + loc[1];
}

module.exports = Analysis;
