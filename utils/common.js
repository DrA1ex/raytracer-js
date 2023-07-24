export function degToRad(deg) {
    return Math.PI * deg / 180;
}

export async function loadImage(src) {
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.src = src;
        img.onload = () => {
            img.onload = null;
            img.onerror = null;
            resolve()
        };

        img.onerror = (e) => {
            alert(new Error(e.message ?? "Unable to load map"))
            reject()
        };
    });

    return img
}