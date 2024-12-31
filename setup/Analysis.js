"use strict";

const Array = require("./safe/Array");

const setTimeout = global.setTimeout;
const clearTimeout = global.clearTimeout;

class Analysis {
  constructor(options) {
    this.notify = options.notify.bind(null);
    this.savedRecords = new Array();
    this.recording = false;
    this.recordingTimeout = undefined;
  }

  addRecord(record) {
    if (this.recording) {
      this.savedRecords.push(record);
    }
  }

  startRecording() {
    this.recordingTimeout === undefined || clearTimeout(this.recordingTimeout);
    this.recording = true;
    this.recordingTimeout = setTimeout(() => {
      this.recording = false;
      this.recordingTimeout = undefined;
      // this.notify({
      //   type: "recordingResult",
      //   records: [...this.savedRecords],
      // });
      console.log({
        type: "recordingResult",
        records: [...this.savedRecords],
      });
    }, 5000);
  }

  stopRecording() {
    if (!this.recording) return;
    this.recordingTimeout === undefined || clearTimeout(this.recordingTimeout);
    this.recording = false;
    this.recordingTimeout = undefined;
    console.log({
      type: "recordingResult",
      records: [...this.savedRecords],
    });
    console.log(
      this.savedRecords.filter(
        ({ args }) => args && [...args].includes("Hg%4cvUz2^#{<~[?!Ch@")
      )
    );
  }
}

module.exports = Analysis;
