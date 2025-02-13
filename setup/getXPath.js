"use strict";

function getXPath(node) {
  if (node.nodeType === Node.DOCUMENT_NODE) {
    return "/";
  }

  let result = [];
  while (node && node.nodeType !== Node.DOCUMENT_NODE) {
    if (node.nodeType === Node.ELEMENT_NODE && node.id) {
      result = `id(${node.id})` + result;
      break;
    }

    let index = 1;
    let sibling = node.previousSibling;

    while (sibling) {
      if (sibling.nodeName === node.nodeName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }

    let nodeName =
      node.nodeType === Node.ELEMENT_NODE
        ? node.nodeName.toLowerCase()
        : "text()";
    let part =
      (node.parentNode ? "/" : "") + nodeName + (index > 1 ? `[${index}]` : "");
    result = part + result;
    node = node.parentNode;
  }

  return result;
}

module.exports = getXPath;
