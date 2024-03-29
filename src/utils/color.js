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
        const mixed =
            rgb1[index1 + 3] !== 0
                ? rgb1[index1 + i] - (rgb1[index1 + i] - rgb2[index2 + i]) * factor
                : rgb2[index1 + i];

        out[i + indexOut] = Math.max(0, Math.min(255, Math.floor(mixed)));
    }
}

export function mixColorAdd(rgbOut, rgbMixed, factor = 1) {
    for (let i = 0; i < 3; i++) {
        rgbOut[i] = Math.min(255, rgbOut[i] + rgbMixed[i] * factor);
    }
}

export function colorMultiply(rgbOut, factor) {
    for (let i = 0; i < 3; i++) {
        rgbOut[i] = Math.min(255, rgbOut[i] * factor);
    }
}

export function toHex(rgb, alpha = 1) {
    function _hex(c) {
        return Math.max(0, Math.min(255, Math.floor(c))).toString(16).padStart(2, "0");
    }

    return `#${_hex(rgb[0])}${_hex(rgb[1])}${_hex(rgb[2])}${_hex(alpha * 255)}`;
}

export function gammaCorrection(rgb, gamma) {
    for (let i = 0; i < rgb.length; i++) {
        rgb[i] = 32 + 192 * Math.pow(rgb[i] / 255, 1 / gamma);
    }
}