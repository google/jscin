// Copyright 2025 Google Inc. All Rights Reserved.

/**
 * @fileoverview A Trie for partial search.
 * @author Hung-Te Lin <hungte@gmail.com>
 */

export class Trie {
  constructor(data) {
    this.children = {};
  }

  _lookup(key, create) {
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

  _walk(callback) {
    if (!callback(this))
      return false;
    for (let c of Object.values(this.children)) {
      if (!c._walk(callback))
        return false;
    }
    return true;
  }

  add(key, data) {
    let next = this._lookup(key, true);
    next.data = data;
  }

  find(key) {
    return this._lookup(key, false);
  }

  get(key) {
    return this.find(key)?.data;
  }

  // collect and return all data below this node.
  below(hits) {
    if (!hits)
      hits = 100;
    let r = [];
    this._walk((node) => {
      if (r.length > hits)
        return false;
      else if (node.data)
        r.push(node.data);
      return true;
    });
    return r;
  }
}
