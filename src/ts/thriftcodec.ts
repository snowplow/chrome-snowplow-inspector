// Types are tagged with a 1 byte identifier
const thriftTypes = [
    'end',
    null,
    'bool',
    'byte',
    'double',
    null,
    'i16',
    null,
    'i32',
    null,
    'i64',
    'string',
    'struct',
    'map',
    'set',
    'list',
];

const jsTypes: {[strResult: string]: string} = {
    '[object Array]': 'list',
    '[object Boolean]': 'bool',
    '[object Number]': 'i64',
    '[object Object]': 'struct',
    '[object String]': 'string',
    '[object Undefined]': 'byte',
};

// tslint:disable-next-line
// https://github.com/snowplow/snowplow/blob/master/2-collectors/thrift-schemas/collector-payload-1/src/main/thrift/collector-payload.thrift
const collectorPayloadSchema: {[fieldId: number]: string } = {
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

function decodeB64Thrift(b64: string, schema: {[fieldId: number]: string}): object {
    // Standard b64 decoding
    let bytes = atob(b64);
    // we only decode structs
    const result: {[fieldName: string]: string} = {};

    function intFromBytes(b: string): number {
        // build big endian ints
        // would shift to line up, but int64 is too big for JS
        // parseInt handles this case and makes it fit as a double
        let r = '';

        for (let i = 0, j; i < b.length; i++) {
            j = b.charCodeAt(i).toString(16);
            r += j.length & 1 ? '0' + j : j;
        }

        return parseInt(r, 16);
    }

    // compound types have an unknown size, so pass in all the remaining bytes
    // https://erikvanoosten.github.io/thrift-missing-specification/
    function getType(typeName: string | null, remainingBytes: string): [number, any] {
        let meta = 0;
        let size = 0;

        switch (typeName) {
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
            throw new Error('Unknown type: ' + typeName);
        }

        if (!meta) {
            const fieldValue = intFromBytes(remainingBytes.slice(0, size));
            return [size, typeName === 'bool' ? ~~fieldValue : fieldValue];
        } else {
            let i;
            if (typeName === 'string') {
                // strings preceded by i32 length
                size = intFromBytes(remainingBytes.slice(0, meta));
                size = 0;
                for (i = 0; i < meta; i++) {
                    size |= remainingBytes.charCodeAt(i) << (8 * (meta - (i + 1)));
                }

                remainingBytes = remainingBytes.slice(meta, size + meta);
                return [size + meta, remainingBytes];
            } else if (meta === 5) {
                // list or set
                // meta is 1 byte type ID + 4 byte number of elements
                typeName = thriftTypes[remainingBytes.charCodeAt(0)];
                size = 0;
                for (i = 1; i < meta; i++) {
                    size |= remainingBytes.charCodeAt(i) << (8 * (meta - (i + 1)));
                }

                const vals = [];
                let totalSize = 0;

                for (i = 0; i < size; i++) {
                    const v = getType(typeName, remainingBytes.slice(meta + totalSize));
                    totalSize += v[0];
                    vals.push(v[1]);
                }

                return [totalSize + meta, vals];
            }
        }

        // This should be unreachable
        return [0, null];
    }

    for (;;) {
        if (!bytes.length) {
            break;
        }

        let consumed = 0;
        const type = thriftTypes[bytes.charCodeAt(consumed++)];

        if (type === 'end') {
            break;
        }

        let id = bytes.charCodeAt(consumed++);
        id = id << 8;
        id += bytes.charCodeAt(consumed++);

        const field = schema[id];
        if (!field) {
            throw new Error('Unknown field: ' + id);
        }

        const value = getType(type, bytes.slice(consumed));

        result[field] = value[1];

        consumed += value[0];

        bytes = bytes.slice(consumed);
    }

    return result;
}

function encodeB64Thrift(obj: {[property: string]: any}, schema: {[fieldId: number]: string}): string {

    function intToBytes(value: number, size: number): string {
        let bytes = value.toString(16);
        while (bytes.length < size * 2) {
            bytes = '0' + bytes;
        }

        return bytes.replace(/(..)/g, '%$1');
    }

    function toBytes(thriftType: string, value: any) {
        let thriftField = '';

        switch (thriftType) {
        case 'string':
            thriftField += intToBytes(value.length, 4);
            thriftField += escape(unescape(encodeURIComponent(value)));
            break;
        case 'i64':
            thriftField += intToBytes(value, 8);
            break;
        case 'list':
            thriftField += intToBytes(thriftTypes.indexOf(jsTypes[Object.prototype.toString.call(value[0])]), 1);
            thriftField += intToBytes(value.length, 4);
            for (const i of value) {
                thriftField += toBytes(jsTypes[Object.prototype.toString.call(value[0])], value[i]);
            }
            break;
        default:
            throw new Error('Not Implemented');
        }
        return thriftField;
    }

    let result = '';

    for (const p in schema) {
        if (schema.hasOwnProperty(p)) {
            const skey = schema[p];

            if (obj.hasOwnProperty(skey)) {
                const type = jsTypes[Object.prototype.toString.call(obj[skey])];
                result += intToBytes(thriftTypes.indexOf(type), 1);
                result += intToBytes(~~p >> 8 & 255, 1) + intToBytes(~~p & 255, 1);
                result += toBytes(type, obj[skey]);
            }
        }
    }

    return btoa(unescape(result));
}

export = {
    decodeB64Thrift,
    encodeB64Thrift,
    schemas: {
        'collector-payload': collectorPayloadSchema,
    },
};
