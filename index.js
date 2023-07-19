import {Vector2} from "./utils/vector.js";
import * as ColorUtils from "./utils/color.js";

const fov = Math.PI * 70 / 180;
const traceSteps = 2000;
const length = 500;
const size = 400;
const reflectionCount = 1;

const bgCtx = document.getElementById("canvas").getContext('2d');
const ctx = document.getElementById("overlay").getContext('2d');
const prCtx = document.getElementById("projection").getContext("2d");

prCtx.scale(2, 2);

bgCtx.imageSmoothingEnabled = false;
bgCtx.lineWidth = 2
bgCtx.strokeStyle = 'black';
bgCtx.strokeRect(1, 1, size - 2, size - 2);

bgCtx.fillStyle = "gray";
bgCtx.fillRect(150, 125, 10, 225);
bgCtx.fillRect(250, 125, 10, 225);
bgCtx.fillRect(150, 340, 100, 10);

bgCtx.fillStyle = 'red';
bgCtx.fillRect(200, 200, 10, 25);

bgCtx.fillStyle = 'green';
bgCtx.fillRect(200, 150, 10, 25);

bgCtx.fillStyle = 'blue';
bgCtx.fillRect(200, 250, 10, 25);

const PixelData = bgCtx.getImageData(0, 0, size, size).data;

function trace(originX, originY, originAngle) {
    ctx.strokeStyle = 'pink';
    ctx.fillStyle = 'red';

    ctx.beginPath();
    ctx.fillStyle = 'red';
    ctx.rect(originX - 5, originY - 5, 10, 10);
    ctx.fill();

    const intersections = [];

    const originVector = new Vector2(originX, originY);
    const radOrigAngle = (Math.PI * originAngle / 180);

    const dt = (size / 2) / Math.tan(fov / 2);
    const step = size / traceSteps;

    for (let i = -traceSteps / 2; i <= traceSteps / 2; i++) {
        const angle = radOrigAngle + Math.atan(i * step / dt);
        const collision = emitLight(originVector, angle, [255, 255, 255], reflectionCount);

        if (collision) {
            const relAngle = angle - radOrigAngle;
            intersections.push({
                originX: collision.originX,
                originY: collision.originY,
                x: collision.x,
                y: collision.y,
                distance: Math.cos(relAngle) * collision.distance,
                colorData: collision.colorData,
                angle: relAngle
            });
        }
    }

    ctx.strokeStyle = 'blue';
    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + length * Math.cos(radOrigAngle - fov / 2), originY + length * Math.sin(radOrigAngle - fov / 2));
    ctx.lineTo(originX + length * Math.cos(radOrigAngle + fov / 2), originY + length * Math.sin(radOrigAngle + fov / 2));
    ctx.closePath();

    ctx.stroke();

    return intersections;
}

function emitLight(origin, angle, light, reflectionCount) {
    const angleVector = Vector2.fromAngle(angle);
    const xStep = angleVector.scaled(1 / angleVector.x).length();
    const yStep = angleVector.scaled(1 / angleVector.y).length();
    const direction = new Vector2(Math.sign(angleVector.x), Math.sign(angleVector.y));

    const position = new Vector2(Math.ceil(origin.x), Math.ceil(origin.y));
    const currentPath = new Vector2();

    let lastComponent = null;
    while (Math.min(currentPath.x, currentPath.y) < length) {
        if (currentPath.x + xStep < currentPath.y + yStep) {
            currentPath.x += xStep;
            position.x += direction.x;
            lastComponent = "x";
        } else {
            currentPath.y += yStep;
            position.y += direction.y;
            lastComponent = "y";
        }

        if (position.x < 0 || position.y < 0 || position.x >= size || position.y >= size) break;

        const pixelOffset = 4 * (position.x + position.y * size);
        const alpha = PixelData[pixelOffset + 3];
        if (alpha < 255) continue;

        const normal = getNormal(lastComponent, direction);
        const reflectedAngle = reflect(angleVector, normal);

        let reflection = null;
        if (reflectionCount > 0) {
            reflection = emitLight(position.delta(normal), Math.atan2(reflectedAngle.y, reflectedAngle.x), light, reflectionCount - 1);
        }

        const colorData = new Array(3);
        const kShadow = Math.sqrt(Math.abs(angleVector.dot(normal)));
        for (let i = 0; i < colorData.length; i++) {
            colorData[i] = PixelData[pixelOffset + i] * kShadow;
        }

        ColorUtils.mixColorMultiply(colorData, light);
        ColorUtils.shadeColor(light, -0.2);

        if (reflection) {
            const kReflection = Math.abs(reflectedAngle.dot(normal.perpendicular()));
            ColorUtils.mixColorAdd(colorData, reflection.colorData, kReflection);
        }

        return {
            originX: origin.x,
            originY: origin.y,
            x: position.x,
            y: position.y,
            distance: origin.distance(position),
            colorData
        };
    }

    return null;
}

function getNormal(lastComponent, direction) {
    if (lastComponent === "x") {
        return new Vector2(direction.x > 0 ? 1 : -1, 0);
    } else {
        return new Vector2(0, direction.y > 0 ? 1 : -1);
    }
}

function reflect(angleVector, normal) {
    return angleVector.delta(normal.scaled(2 * angleVector.dot(normal)));
}

function drawProjection(intersections) {
    const dt = (size / 2) / Math.tan(fov / 2);

    for (const {angle, distance, colorData} of intersections) {
        const x = size / 2 + size * (angle / fov);
        const height = 12 * dt / distance;

        prCtx.strokeStyle = `rgba(${colorData[0]}, ${colorData[1]}, ${colorData[2]}, ${10000 / distance}%)`;
        prCtx.beginPath();
        prCtx.moveTo(x, size / 2 - height);
        prCtx.lineTo(x, size / 2 + height);
        prCtx.stroke();
    }
}

let angle = 68.5;
let x = 164, y = 58;
let mouseLocked = false;
let changed = true;

document.onkeydown = (e) => {
    switch (e.key) {
        case  "ArrowUp":
        case "w":
            x += Math.cos(Math.PI * angle / 180) * 5;
            y += Math.sin(Math.PI * angle / 180) * 5;
            changed = true;
            break;

        case  "ArrowDown":
        case "s":
            x -= Math.cos(Math.PI * angle / 180) * 3;
            y -= Math.sin(Math.PI * angle / 180) * 3;
            changed = true;
            break;

        case  "ArrowLeft":
        case "a":
            x += Math.cos(Math.PI * (angle - 90) / 180) * 5;
            y += Math.sin(Math.PI * (angle - 90) / 180) * 5;
            changed = true;
            break;

        case  "ArrowRight":
        case "d":
            x += Math.cos(Math.PI * (angle + 90) / 180) * 5;
            y += Math.sin(Math.PI * (angle + 90) / 180) * 5;
            changed = true;
            break;
    }
}

document.onmousemove = (e) => {
    if (!mouseLocked) return;

    angle += e.movementX / 2;
    changed = true;
}

document.onmousedown = async () => {
    if (mouseLocked) return

    await document.body.requestPointerLock();
}

document.onpointerlockchange = (e) => {
    mouseLocked = !!document.pointerLockElement;
}

document.onpointerlockerror = (e) => {
    alert("Unable to lock pointer. Try again later");
}

function render() {
    if (changed) {
        ctx.clearRect(0, 0, size, size);
        const intersections = trace(~~x, ~~y, angle);

        prCtx.clearRect(0, 0, size, size);
        drawProjection(intersections);

        changed = false;
    }

    requestAnimationFrame(render);
}

render();