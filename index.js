import {Vector2} from "./utils/vector.js";
import * as ColorUtils from "./utils/color.js";

const Fov = Math.PI * 70 / 180;
const TraceSteps = 1000;
const TraceDistance = 10000;
const ScreenSize = 400;

const ReflectionCount = 1;
const SubReflectionCount = 3;
const ReflectionAngleSpread = Math.PI / 32;
const ReflectionEnergyLoss = 0.1;

const Gamma = 2.0;

const bgCtx = document.getElementById("canvas").getContext('2d');
const ctx = document.getElementById("overlay").getContext('2d');
const prCtx = document.getElementById("projection").getContext("2d");

prCtx.scale(2, 2);

bgCtx.imageSmoothingEnabled = false;
bgCtx.lineWidth = 2
bgCtx.strokeStyle = 'slategrey';
bgCtx.strokeRect(0, 0, ScreenSize, ScreenSize);

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

const PixelData = bgCtx.getImageData(0, 0, ScreenSize, ScreenSize).data;

let CameraAngle = 68.5;
let CameraX = 164, CameraY = 58;

let MouseLocked = false;
let Changed = true;

function trace(originVector, radOrigAngle) {
    const intersections = [];

    const dt = (ScreenSize / 2) / Math.tan(Fov / 2);
    const step = ScreenSize / TraceSteps;

    for (let i = -TraceSteps / 2; i <= TraceSteps / 2; i++) {
        const angle = radOrigAngle + Math.atan(i * step / dt);
        const collision = emitLight(originVector, angle, [255, 255, 255], ReflectionCount);

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

    return intersections;
}

function emitLight(origin, angle, light, reflectionCount, lastDistance = 0) {
    const angleVector = Vector2.fromAngle(angle);
    const xStep = angleVector.scaled(1 / angleVector.x).length();
    const yStep = angleVector.scaled(1 / angleVector.y).length();
    const direction = new Vector2(Math.sign(angleVector.x), Math.sign(angleVector.y));

    const position = new Vector2(Math.ceil(origin.x), Math.ceil(origin.y));
    const currentPath = new Vector2();

    let lastComponent = null;
    while (Math.min(currentPath.x, currentPath.y) < lastDistance + TraceDistance) {
        if (currentPath.x + xStep < currentPath.y + yStep) {
            currentPath.x += xStep;
            position.x += direction.x;
            lastComponent = "x";
        } else {
            currentPath.y += yStep;
            position.y += direction.y;
            lastComponent = "y";
        }

        if (position.x < 0 || position.y < 0 || position.x >= ScreenSize || position.y >= ScreenSize) break;

        const pixelOffset = 4 * (position.x + position.y * ScreenSize);
        const alpha = PixelData[pixelOffset + 3];
        if (alpha < 255) continue;

        const distance = origin.distance(position);
        const normal = getNormal(lastComponent, direction);
        const reflectedAngle = reflect(angleVector, normal);

        let reflectionColor = null;
        if (reflectionCount > 0) {
            reflectionColor = getRayReflection(position.delta(normal), reflectedAngle, light, reflectionCount, distance);
        }

        const colorData = new Array(3);
        const kDiffuse = Math.sqrt(Math.max(0, angleVector.dot(normal)));
        const kSpecular = Math.pow(Math.max(0, angleVector.dot(normal.perpendicular())), 2);
        for (let i = 0; i < colorData.length; i++) {
            const color = PixelData[pixelOffset + i] * (kDiffuse + kSpecular);
            colorData[i] = Math.min(255, Math.floor(color));
        }

        ColorUtils.mixColorMultiply(colorData, light);
        ColorUtils.shadeColor(light, -ReflectionEnergyLoss);

        if (reflectionColor) {
            const kReflection = Math.abs(reflectedAngle.dot(normal.perpendicular()));
            ColorUtils.mixColorAdd(colorData, reflectionColor, kReflection);
        }

        return {
            originX: origin.x,
            originY: origin.y,
            x: position.x,
            y: position.y,
            distance,
            colorData
        };
    }

    return null;
}

function getRayReflection(origin, angle, light, reflectionCount, distance) {
    const rAngle = Math.atan2(angle.y, angle.x);
    const originalLight = light.concat();

    let reflectionColor = null;
    for (let i = 0; i < SubReflectionCount; i++) {
        const lightCopy = originalLight.concat();
        const rayAngle = rAngle + ReflectionAngleSpread * (Math.random() - 0.5);
        const reflection = emitLight(origin, rayAngle, lightCopy, reflectionCount - 1, distance);

        if (!reflection) continue;

        if (!reflectionColor) {
            reflectionColor = reflection.colorData;
        } else {
            ColorUtils.mixColorLinear(reflectionColor, reflection.colorData, 0.5);
        }

        ColorUtils.mixColorLinear(light, lightCopy, 0.5);
    }

    return reflectionColor;
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
    const dt = (ScreenSize / 2) / Math.tan(Fov / 2);

    for (const {angle, distance, colorData} of intersections) {
        const x = ScreenSize / 2 + ScreenSize * (angle / Fov);
        const height = 12 * dt / distance;

        for (let i = 0; i < colorData.length; i++) {
            colorData[i] = 32 + 192 * Math.pow(colorData[i] / 255, 1 / Gamma);
        }

        prCtx.strokeStyle = `rgba(${colorData[0]}, ${colorData[1]}, ${colorData[2]}, ${TraceDistance / distance}%)`;
        prCtx.beginPath();
        prCtx.moveTo(x, ScreenSize / 2 - height);
        prCtx.lineTo(x, ScreenSize / 2 + height);
        prCtx.stroke();
    }
}

document.onkeydown = (e) => {
    switch (e.key) {
        case  "ArrowUp":
        case "w":
            CameraX += Math.cos(Math.PI * CameraAngle / 180) * 5;
            CameraY += Math.sin(Math.PI * CameraAngle / 180) * 5;
            Changed = true;
            break;

        case  "ArrowDown":
        case "s":
            CameraX -= Math.cos(Math.PI * CameraAngle / 180) * 3;
            CameraY -= Math.sin(Math.PI * CameraAngle / 180) * 3;
            Changed = true;
            break;

        case  "ArrowLeft":
        case "a":
            CameraX += Math.cos(Math.PI * (CameraAngle - 90) / 180) * 5;
            CameraY += Math.sin(Math.PI * (CameraAngle - 90) / 180) * 5;
            Changed = true;
            break;

        case  "ArrowRight":
        case "d":
            CameraX += Math.cos(Math.PI * (CameraAngle + 90) / 180) * 5;
            CameraY += Math.sin(Math.PI * (CameraAngle + 90) / 180) * 5;
            Changed = true;
            break;
    }
}

document.onmousemove = (e) => {
    if (!MouseLocked) return;

    CameraAngle += e.movementX / 2;
    Changed = true;
}

document.onmousedown = async () => {
    if (MouseLocked) return

    await document.body.requestPointerLock();
}

document.onpointerlockchange = (_) => {
    MouseLocked = !!document.pointerLockElement;
}

document.onpointerlockerror = (_) => {
    alert("Unable to lock pointer. Try again later");
}

function render() {
    if (Changed) {
        const radAngle = (Math.PI * CameraAngle / 180)

        ctx.clearRect(0, 0, ScreenSize, ScreenSize);
        ctx.strokeStyle = 'pink';
        ctx.fillStyle = 'red';

        ctx.beginPath();
        ctx.fillStyle = 'red';
        ctx.rect(~~CameraX - 5, ~~CameraY - 5, 10, 10);
        ctx.fill();

        ctx.strokeStyle = 'blue';
        ctx.beginPath();
        ctx.moveTo(CameraX, CameraY);
        ctx.lineTo(CameraX + TraceDistance * Math.cos(radAngle - Fov / 2), CameraY + TraceDistance * Math.sin(radAngle - Fov / 2));
        ctx.lineTo(CameraX + TraceDistance * Math.cos(radAngle + Fov / 2), CameraY + TraceDistance * Math.sin(radAngle + Fov / 2));
        ctx.closePath();

        ctx.stroke();

        const intersections = trace(new Vector2(~~CameraX, ~~CameraY), radAngle);

        prCtx.clearRect(0, 0, ScreenSize, ScreenSize);
        drawProjection(intersections);

        Changed = false;
    }

    requestAnimationFrame(render);
}

render();