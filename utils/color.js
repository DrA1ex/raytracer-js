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

/**
 *
 * @param {ArrayBufferLike} out
 * @param {Number} indexOut
 * @param {ArrayBufferLike} rgb1
 * @param {Number} index1
 * @param {ArrayBufferLike} rgb2
 * @param {Number} index2
 * @param {Number} [factor=0.5]
 */
export function mixColorLinearOffset(out, indexOut, rgb1, index1, rgb2, index2, factor = 0.5) {
    for (let i = 0; i < 3; i++) {
        const mixed = rgb1[index1 + i] - (rgb1[index1 + i] - rgb2[index2 + i]) * factor;
        out[i + indexOut] = Math.max(0, Math.min(255, Math.floor(mixed)));
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