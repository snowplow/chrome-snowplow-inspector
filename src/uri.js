/*
 * This is just a hack to adapt the jsonschema lib to work without a polyfill for the "url" lib.
 */

// https://nodejs.org/api/url.html#urlresolvefrom-to
export const resolve = (from, to) => {
  if (!to) return from;
  const resolved = new URL(to, new URL(from, "resolve://"));

  if (resolved.protocol === "resolve:") {
    const { pathname, search, hash } = resolved;
    return `${pathname}${search}${hash}`;
  }

  return resolved.toString();
};

export const parse = (uri) => new URL(uri);
