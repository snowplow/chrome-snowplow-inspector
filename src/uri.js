/**
 * This is just a hack to adapt the jsonschema lib to work without a polyfill for the "url" lib.
 */

/**
 * @see {@link https://nodejs.org/api/url.html#urlresolvefrom-to}
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
export const resolve = (from, to) => {
  if (!to) return from;
  if (to.startsWith("#")) return (from || "") + to;
  const resolved = new URL(to, new URL(from, "resolve://resolve/"));

  if (resolved.protocol === "resolve:") {
    const { pathname, search, hash } = resolved;
    return `${pathname}${search}${hash}`;
  }

  return resolved.toString();
};

/**
 * @param {string} uri
 * @returns {URL}
 */
export const parse = (uri) => new URL(uri);
