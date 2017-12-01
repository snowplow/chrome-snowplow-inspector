function hash(bytes) {
    let hash = 5381;

    for (let i = 0; i < bytes.length; i++) {
        hash = ((hash << 5) + hash) + bytes.charCodeAt(i);
    }

    return String(hash);
}

export = {hash: hash};
