function decodeB64Thrift(b64, schema) {
    // Standard b64 decoding
    var bytes = atob(b64);
    // Types are tagged with a 1 byte identifier
    var types = ['end',null,null,'bool', 'byte', 'double',null,'i16',null,'i32',null,'i64','string','struct','map','set','list'];

    // we only decode structs
    var result = {};

    function intFromBytes(b) {
        // build big endian ints
        // would shift to line up, but int64 is too big for JS
        // parseInt handles this case and makes it fit as a double
        var r = '';

        for (var i = 0; i < b.length; i++) r += b.charCodeAt(i).toString(16);

        return parseInt(r, 16);
    }

    // compound types have an unknown size, so pass in all the remaining bytes
    // https://erikvanoosten.github.io/thrift-missing-specification/
    function getType(type, bytes) {
        var meta = 0;
        var size = 0;

        switch (type) {
        case 'bool':
            size = 1; break;
        case 'byte':
            size = 1; break;
        case 'double':
            throw new Error('double unimplemented');
        case 'i16':
            size = 2; break;
        case 'i32':
            size = 4; break;
        case 'i64':
            size = 8; break;
        case 'string':
            meta = 4; break;
        case 'struct':
            throw new Error('struct unimplemented');
        case 'map':
            throw new Error('map unimplemented');
        case 'set':
        case 'list':
            meta = 5; break;
        default:
            throw new Error('Unknown type: ' + type);
        }

        if (!meta) {
            var result = intFromBytes(bytes.slice(0, size));
            return [size, type === 'bool' ? ~~result : result];
        } else {
            var i;
            if (type === 'string') {
                // strings preceded by i32 length
                size = intFromBytes(bytes.slice(0, meta));
                size = 0;
                for (i = 0; i < meta; i++) {
                    size |= bytes.charCodeAt(i) << (8 * (meta - (i + 1)));
                }

                bytes = bytes.slice(meta, size + meta);
                return [size + meta, bytes];
            } else if (meta === 5) {
                // list or set
                // meta is 1 byte type ID + 4 byte number of elements
                type = types[bytes.charCodeAt(0)];
                size = 0;
                for (i = 1; i < meta; i++) {
                    size |= bytes.charCodeAt(i) << (8 * (meta - (i + 1)));
                }

                var vals = [];
                var totalSize = 0;

                for (i = 0; i < size; i++) {
                    var v = getType(type, bytes.slice(meta + totalSize));
                    totalSize += v[0];
                    vals.push(v[1]);
                }

                return [totalSize + meta, vals];
            }
        }
    }

    for (;;) {
        if (!bytes.length) break;

        var consumed = 0;
        var type = types[bytes.charCodeAt(consumed++)];

        if (type === 'end') break;

        var id = bytes.charCodeAt(consumed++);
        id = id << 8;
        id += bytes.charCodeAt(consumed++);

        var field = schema[id];
        if (!field) throw new Error('Unknown field: ' + id);

        var value = getType(type, bytes.slice(consumed));

        result[field] = value[1];

        consumed += value[0];

        bytes = bytes.slice(consumed);
    }

    return result;
}

// https://github.com/snowplow/snowplow/blob/master/2-collectors/thrift-schemas/collector-payload-1/src/main/thrift/collector-payload.thrift
var schema = {
    31337: 'schema',
    100: 'ipAddress',
    200: 'timestamp',
    210: 'encoding',
    220: 'collector',
    300: 'userAgent',
    310: 'refererUri',
    320: 'path',
    330: 'querystring',
    340: 'body',
    350: 'headers',
    360: 'contentType',
    400: 'hostname',
    410: 'networkUserId',
};


var bad = ({'line':'CwBkAAAADjQ5LjI1NS4xOTcuMTI2CgDIAAABXS/H68ALANIAAAAFVVRGLTgLANwAAAARc3NjLTAuOS4wLWtpbmVzaXMLASwAAAB5TW96aWxsYS81LjAgKE1hY2ludG9zaDsgSW50ZWwgTWFjIE9TIFggMTBfMTFfNikgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzU5LjAuMzA3MS4xMTUgU2FmYXJpLzUzNy4zNgsBQAAAAAIvaQsBSgAABWplPXB2JnVybD1odHRwcyUzQSUyRiUyRmJ0LXRlc3QuZmZ4Ymx1ZS5jb20uYXUlMkZsaWZlc3R5bGUlMkZoZWFsdGgtYW5kLXdlbGxuZXNzJTJGZW1wbG95ZXJzLWFyZS11bmRlcnBheWluZy0yNG0td29ya2Vycy1zdXBlcmFubnVhdGlvbi1yZXBvcnQtMjAxNjEyMDQtYnguaHRtbCZwYWdlPUVtcGxveWVycyUyMGFyZSUyMHVuZGVycGF5aW5nJTIwMi40bSUyMHdvcmtlcnMlMjBzdXBlcmFubnVhdGlvbiUzQSUyMHJlcG9ydCZ0dj1qcy0yLjUuMSZ0bmE9Y2YmYWlkPWJ0LXdlYiZwPXdlYiZ0ej1BdXN0cmFsaWElMkZTeWRuZXkmbGFuZz1lbi1VUyZjcz1VVEYtOCZmX3BkZj0xJmZfcXQ9MCZmX3JlYWxwPTAmZl93bWE9MCZmX2Rpcj0wJmZfZmxhPTEmZl9qYXZhPTAmZl9nZWFycz0wJmZfYWc9MCZyZXM9MjU2MHgxNDQwJmNkPTI0JmNvb2tpZT0xJmVpZD0zOWRiZTYzYi1mMzUzLTQwYzQtODYzZC0yYTYyNjA0NWRiNDQmZHRtPTE0OTk3Mzk5Nzg2NjgmdnA9MTUxNXg1NjEmZHM9MTUwMHg1MTQ0JnZpZD0xJnNpZD0wZGNmM2I5Yi02NDhkLTRmNzYtOWI1ZS1lZTczNzYwZGQ3YzYmZHVpZD02NDFhOTZkZWVlNjg1YjFjJmZwPTI3NDUzNTI4MjkmY3g9ZXlKelkyaGxiV0VpT2lKcFoyeDFPbU52YlM1emJtOTNjR3h2ZDJGdVlXeDVkR2xqY3k1emJtOTNjR3h2ZHk5amIyNTBaWGgwY3k5cWMyOXVjMk5vWlcxaEx6RXRNQzB3SWl3aVpHRjBZU0k2VzNzaWMyTm9aVzFoSWpvaWFXZHNkVHBoZFM1amIyMHVabUZwY21aaGVHMWxaR2xoTDIxbGRHRmtZWFJoTDJwemIyNXpZMmhsYldFdk1TMHdMVEFpTENKa1lYUmhJanA3SW5CaFoyVXVibUZ0WlNJNklrVnRjR3h2ZVdWeWN5QmhjbVVnZFc1a1pYSndZWGxwYm1jZ01pNDBiU0IzYjNKclpYSnpJSE4xY0dWeVlXNXVkV0YwYVc5dU9pQnlaWEJ2Y25RaUxDSndZV2RsTG1GemMyVjBTV1FpT2lKaWVDSXNJbkJoWjJVdVlYVjBhRzl5SWpvaVIzSmxkR05vWlc0Z1JuSnBaVzFoYm00aUxDSndZV2RsTG1GMWRHaHZjbVZrVUd4aGRHWnZjbTBpT2lKamNTSXNJbkJoWjJVdWNISnBiV0Z5ZVZSaFp5STZJbE41Wkc1bGVTQlNiMjl6ZEdWeWN5SXNJbkJoWjJVdWRHRm5jeUk2V3lKVGRXMXRaWElnWjNWcFpHVWlMQ0pCWkhacFkyVWdKaUJ6ZEhKaGRHVm5hV1Z6SWl3aVZHOXZiSE1nSmlCbmRXbGtaWE1pTENKRmJuWnBjbTl1YldWdWRDSXNJa2x1ZG1WemRHbHVaeUlzSWxGMVpXVnVjMnhoYm1RZ2NHOXNhWFJwWTNNaUxDSk5hVzVwYm1jZ0ppQnlaWE52ZFhKalpYTWlMQ0pTWlhObGNuWmxJRUpoYm1zZ2IyWWdRWFZ6ZEhKaGJHbGhJaXdpUjJGdFpYTWlMQ0pUYldGeWRIQm9iMjVsSUVGd2NITWlYU3dpY0dGblpTNTJhV1YzU1VRaU9pSmtOamszT0RJelpTMDNZMkppTFRSa09XTXRPRGxtWlMwek56VTNOalpoTldFelpETWlmWDFkZlEPAV4LAAAADwAAADlIb3N0OiBzZXJ2aWNlLWFuYWx5dGljcy10ZXN0LXYxLWNvbGxlY3RvcnMuZmZ4Ymx1ZS5jb20uYXUAAAARQ29ubmVjdGlvbjogY2xvc2UAAAAZWC1SZWFsLUlQOiA0OS4yNTUuMTk3LjEyNgAAAB9YLUZvcndhcmRlZC1Gb3I6IDQ5LjI1NS4xOTcuMTI2AAAARVgtRm9yd2FyZGVkLUhvc3Q6IHNlcnZpY2UtYW5hbHl0aWNzLXRlc3QtdjEtY29sbGVjdG9ycy5mZnhibHVlLmNvbS5hdQAAABVYLUZvcndhcmRlZC1Qb3J0OiA0NDMAAAAYWC1Gb3J3YXJkZWQtUHJvdG86IGh0dHBzAAAFfVgtT3JpZ2luYWwtVVJJOiAvaT9lPXB2JnVybD1odHRwcyUzQSUyRiUyRmJ0LXRlc3QuZmZ4Ymx1ZS5jb20uYXUlMkZsaWZlc3R5bGUlMkZoZWFsdGgtYW5kLXdlbGxuZXNzJTJGZW1wbG95ZXJzLWFyZS11bmRlcnBheWluZy0yNG0td29ya2Vycy1zdXBlcmFubnVhdGlvbi1yZXBvcnQtMjAxNjEyMDQtYnguaHRtbCZwYWdlPUVtcGxveWVycyUyMGFyZSUyMHVuZGVycGF5aW5nJTIwMi40bSUyMHdvcmtlcnMlMjBzdXBlcmFubnVhdGlvbiUzQSUyMHJlcG9ydCZ0dj1qcy0yLjUuMSZ0bmE9Y2YmYWlkPWJ0LXdlYiZwPXdlYiZ0ej1BdXN0cmFsaWElMkZTeWRuZXkmbGFuZz1lbi1VUyZjcz1VVEYtOCZmX3BkZj0xJmZfcXQ9MCZmX3JlYWxwPTAmZl93bWE9MCZmX2Rpcj0wJmZfZmxhPTEmZl9qYXZhPTAmZl9nZWFycz0wJmZfYWc9MCZyZXM9MjU2MHgxNDQwJmNkPTI0JmNvb2tpZT0xJmVpZD0zOWRiZTYzYi1mMzUzLTQwYzQtODYzZC0yYTYyNjA0NWRiNDQmZHRtPTE0OTk3Mzk5Nzg2NjgmdnA9MTUxNXg1NjEmZHM9MTUwMHg1MTQ0JnZpZD0xJnNpZD0wZGNmM2I5Yi02NDhkLTRmNzYtOWI1ZS1lZTczNzYwZGQ3YzYmZHVpZD02NDFhOTZkZWVlNjg1YjFjJmZwPTI3NDUzNTI4MjkmY3g9ZXlKelkyaGxiV0VpT2lKcFoyeDFPbU52YlM1emJtOTNjR3h2ZDJGdVlXeDVkR2xqY3k1emJtOTNjR3h2ZHk5amIyNTBaWGgwY3k5cWMyOXVjMk5vWlcxaEx6RXRNQzB3SWl3aVpHRjBZU0k2VzNzaWMyTm9aVzFoSWpvaWFXZHNkVHBoZFM1amIyMHVabUZwY21aaGVHMWxaR2xoTDIxbGRHRmtZWFJoTDJwemIyNXpZMmhsYldFdk1TMHdMVEFpTENKa1lYUmhJanA3SW5CaFoyVXVibUZ0WlNJNklrVnRjR3h2ZVdWeWN5QmhjbVVnZFc1a1pYSndZWGxwYm1jZ01pNDBiU0IzYjNKclpYSnpJSE4xY0dWeVlXNXVkV0YwYVc5dU9pQnlaWEJ2Y25RaUxDSndZV2RsTG1GemMyVjBTV1FpT2lKaWVDSXNJbkJoWjJVdVlYVjBhRzl5SWpvaVIzSmxkR05vWlc0Z1JuSnBaVzFoYm00aUxDSndZV2RsTG1GMWRHaHZjbVZrVUd4aGRHWnZjbTBpT2lKamNTSXNJbkJoWjJVdWNISnBiV0Z5ZVZSaFp5STZJbE41Wkc1bGVTQlNiMjl6ZEdWeWN5SXNJbkJoWjJVdWRHRm5jeUk2V3lKVGRXMXRaWElnWjNWcFpHVWlMQ0pCWkhacFkyVWdKaUJ6ZEhKaGRHVm5hV1Z6SWl3aVZHOXZiSE1nSmlCbmRXbGtaWE1pTENKRmJuWnBjbTl1YldWdWRDSXNJa2x1ZG1WemRHbHVaeUlzSWxGMVpXVnVjMnhoYm1RZ2NHOXNhWFJwWTNNaUxDSk5hVzVwYm1jZ0ppQnlaWE52ZFhKalpYTWlMQ0pTWlhObGNuWmxJRUpoYm1zZ2IyWWdRWFZ6ZEhKaGJHbGhJaXdpUjJGdFpYTWlMQ0pUYldGeWRIQm9iMjVsSUVGd2NITWlYU3dpY0dGblpTNTJhV1YzU1VRaU9pSmtOamszT0RJelpTMDNZMkppTFRSa09XTXRPRGxtWlMwek56VTNOalpoTldFelpETWlmWDFkZlEAAAAPWC1TY2hlbWU6IGh0dHBzAAAAYkFjY2VwdDogdGV4dC9odG1sLCBhcHBsaWNhdGlvbi94aHRtbCt4bWwsIGFwcGxpY2F0aW9uL3htbDtxPTAuOSwgaW1hZ2Uvd2VicCwgaW1hZ2UvYXBuZywgKi8qO3E9MC44AAAAIkFjY2VwdC1FbmNvZGluZzogZ3ppcCwgZGVmbGF0ZSwgYnIAAAAgQWNjZXB0LUxhbmd1YWdlOiBlbi1VUywgZW47cT0wLjgAAAFXQ29va2llOiBfc21fYXVfYz1pVlZHVldXREREUnM3SFdEMGY7IEFNQ1ZTX0JFQjVDOEExNTQ5MkRCNjAwQTRDOThCQyU0MEFkb2JlT3JnPTE7IEFNQ1ZfQkVCNUM4QTE1NDkyREI2MDBBNEM5OEJDJTQwQWRvYmVPcmc9LTE3OTIwNDI0OSU3Q01DSURUUyU3QzE3MzU4JTdDTUNNSUQlN0MyNzc3Mjg1MzQ0MjkwNjM2NDAxMzU0MTExMjcwMzc1NDE5Mjg1NCU3Q01DQUFNTEgtMTUwMDI1MjY2OSU3QzglN0NNQ0FBTUItMTUwMDI1MjY2OSU3Q05SWDM4V08wbjVCSDhUaC1ucUFHX0ElN0NNQ09QVE9VVC0xNDk5NjUyNzQ4cyU3Q05PTkUlN0NNQ0FJRCU3QzJCMEVENTg3MDUyQzA0QzgtNjAwMDAwQzEyMDAzMTdFOQAAABxVcGdyYWRlLUluc2VjdXJlLVJlcXVlc3RzOiAxAAAAhVVzZXItQWdlbnQ6IE1vemlsbGEvNS4wIChNYWNpbnRvc2g7IEludGVsIE1hYyBPUyBYIDEwXzExXzYpIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS81OS4wLjMwNzEuMTE1IFNhZmFyaS81MzcuMzYLAZAAAAAzc2VydmljZS1hbmFseXRpY3MtdGVzdC12MS1jb2xsZWN0b3JzLmZmeGJsdWUuY29tLmF1CwGaAAAAJDcyYzYxMzg4LTQ1NzktNGMwZi04NzkyLThmMWJkM2Y4YjNjMQt6aQAAAEFpZ2x1OmNvbS5zbm93cGxvd2FuYWx5dGljcy5zbm93cGxvdy9Db2xsZWN0b3JQYXlsb2FkL3RocmlmdC8xLTAtMAA=','errors':[{'level':'error','message':'error: Could not find schema with key iglu:au.com.fairfaxmedia/metadata/jsonschema/1-0-0 in any repository, tried:\n    level: \"error\"\n    repositories: [\"Iglu Central [HTTP]\",\"Iglu Client Embedded [embedded]\"]\n'}],'failure_tstamp':'2017-07-11T03:53:39.782Z'});
console.log(decodeB64Thrift(bad.line, schema), bad.errors);
