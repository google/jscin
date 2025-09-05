// Copyright 2025 Google Inc. All Rights Reserved.

/**
 * @fileoverview A Trie for partial search.
 * @author Hung-Te Lin <hungte@gmail.com>
 */

export class Trie {
  constructor(data) {
    this.children = {};
    this.data = undefined;
  }

  _lookup(key, create, data) {
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
    if (create)
      next.set(data);
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
    this._lookup(key, true, data);
  }

  find(key) {
    return this._lookup(key, false);
  }

  get(key) {
    if (!key)
      return this.data;
    return this.find(key)?.data;
  }
  set(data) {
    this.data = data;
  }

  // collect and return all data below this node.
  below(limit) {
    if (!limit)
      limit = 100;
    let r = [];
    this._walk((node) => {
      if (r.length > limit)
        return false;
      else if (node.data)
        r.push(node.data);
      return true;
    });
    return r;
  }
}
