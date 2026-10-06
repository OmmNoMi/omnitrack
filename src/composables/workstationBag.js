/**
 * The workstation is assembled from per-feature modules that share one `w` bag.
 * A module that needs something a *later* module defines reads it through
 * `lazy(w, name)`: a stand-in that resolves against the bag at call time, so
 * it works for functions, refs (`.value`) and reactive objects alike.
 */
export function lazy(w, name) {
  return new Proxy(function () {}, {
    get: (_, prop) => w[name][prop],
    set: (_, prop, value) => { w[name][prop] = value; return true; },
    apply: (_, thisArg, args) => w[name](...args),
  });
}
