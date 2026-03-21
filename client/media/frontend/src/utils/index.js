export const formatDate = (date, format = 'Y-m-d H:i:s') => {
    date = new Date(date)

    const strs = {
        Y: date.getFullYear(),
        m: date.getMonth() + 1,
        d: date.getDate(),
        H: date.getHours(),
        i: date.getMinutes(),
        s: date.getSeconds()
    }
    let result = format
    for(let [key, value] of Object.entries(strs)) {
        result = result.replaceAll(key, value.toString().padStart(2, '0'))
    }
    return result
}

export const sha256 = async str => {
    const arr = new TextEncoder().encode(str);
    const buf = await window.crypto.subtle.digest('SHA-256', arr);
    return new Uint8Array(buf).toHex();
}