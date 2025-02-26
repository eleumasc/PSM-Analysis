"use strict";

function mayBeScore(value) {
  return typeof value === "number";
}

module.exports = mayBeScore;
