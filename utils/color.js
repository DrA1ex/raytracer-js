export function mixColorLinear(rgbOut, rgbMixed, factor) {
    for (let i = 0; i < 3; i++) {
        const mixed = rgbOut[i] - (rgbOut[i] - rgbMixed[i]) * factor;
        rgbOut[i] = Math.max(0, Math.min(255, Math.floor(mixed)));
    }
}

export function mixColorMultiply(rgbOut, rgbMixed) {
    for (let i = 0; i < 3; i++) {
        rgbOut[i] = 255 * (rgbOut[i] / 255) * (rgbMixed[i] / 255);
    }
}

export function mixColorAdd(rgbOut, rgbMixed, factor = 1) {
    for (let i = 0; i < 3; i++) {
        rgbOut[i] = Math.min(255, rgbOut[i] + rgbMixed[i] * factor);
    }
}

export function shadeColor(rgbOut, factor) {
    for (let i = 0; i < 3; i++) {
        rgbOut[i] = rgbOut[i] * (1 + factor);
    }
}