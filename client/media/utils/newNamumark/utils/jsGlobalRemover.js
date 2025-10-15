const whitelistedFunctions = {
    Array: [
        'includes'
    ],
    String: [
        'indexOf',
        'lastIndexOf',
        'startsWith',
        'endsWith',
        'substring',
        'trim',
        'substr',
        'toString'
    ]
}
const laterProcess = ['Array'];

let tempProtos = {};
let tempObj = Object;
let tempProxy = Proxy;
for(let key of [...Object.getOwnPropertyNames(globalThis).filter(a => !laterProcess.includes(a)), ...laterProcess]) {
    const item = globalThis[key];
    if(typeof item !== 'function' || key === 'log') continue;
    if(['String', 'Array', 'Object', 'Number', 'BigInt'].includes(key)) {
        for(let protoKey of [...tempObj.getOwnPropertyNames(item.prototype)]) {
            // if(['caller', 'callee', 'arguments'].includes(protoKey)) continue;
            if(whitelistedFunctions[key]?.includes(protoKey)) continue;

            const proto = item.prototype[protoKey];
            if(typeof proto !== 'function') continue;
            tempObj.defineProperty(item.prototype, protoKey, {
                value: undefined
            });
        }
        tempObj.defineProperty(item.prototype, '__proto__', {
            value: undefined
        });
    }

    tempProtos[key] = item.prototype;
    item.prototype = undefined;
    globalThis[key] = undefined;
}

tempObj.defineProperty(tempProtos.Array, 'includes', {
    value: undefined
});
tempObj.defineProperty(globalThis, 'constructor', {
    value: undefined
});

const safeGlobal = new tempProxy(this, {
    has() {
        return true;
    },
    get(target, prop) {
        return target[prop] ?? undefined;
    }
});

tempObj = undefined;
tempProxy = undefined;
tempProtos = undefined;
globalThis = undefined;