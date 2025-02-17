"use strict";

function mayBeScore(value) {
  return typeof value === "number" && value % 1 === 0;
}

module.exports = mayBeScore;
