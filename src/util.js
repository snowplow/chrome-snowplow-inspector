function hash(bytes) {
    var hash = 5381;

    for (var i = 0; i < bytes.length; i++) {
        hash = ((hash << 5) + hash) + bytes.charCodeAt(i);
    }

    return String(hash);
}

module.exports = {hash: hash};