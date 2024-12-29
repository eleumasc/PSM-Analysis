"use strict";

function getOrCreateMapEntry(map, key, valueFactory) {
  if (map.has(key)) {
    return map.get(key);
  } else {
    const value = valueFactory(key, map);
    map.set(key, value);
    return value;
  }
}

module.exports = getOrCreateMapEntry;
