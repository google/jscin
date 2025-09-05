// Copyright 2025 Google Inc. All Rights Reserved.

/**
 * @fileoverview A Trie for partial search.
 * @author Hung-Te Lin <hungte@gmail.com>
 */

export class Trie {
  constructor() {
    this.children = {};
    this.data = undefined;
  }

  _lookup(key, create=false) {
    let next = this;
    for (let c of key) {
      let child = next.children[c];
      if (!child) {
        if (!create)
          return undefined;
        child = new Trie();
        next.children[c] = child;
      }
      next = child;
    }
    return next;
  }

  _walk(callback, key) {
    if (!callback(this, key))
      return false;
    for (const [k, v] of Object.entries(this.children)) {
      if (!v._walk(callback, key + k))
        return false;
    }
    return true;
  }

  add(key, data) {
    const node = this._lookup(key, true);
    node.set(data);
  }

  find(key) {
    return this._lookup(key);
  }

  isLeaf() {
    return Object.keys(this.children).length == 0;
  }

  get() {
    return this.data;
  }
  set(data) {
    this.data = data;
  }

  aggregate(aggregator) {
    this._walk((node, key) => {
      if (node.data)
        return aggregator(key, node.data);
      // continue searching.
      return true;
    }, '');
  }
}
