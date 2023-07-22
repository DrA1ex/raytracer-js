import {Vector2} from "./utils/vector.js";
import * as ColorUtils from "./utils/color.js";
import {AppSettings} from "./settings/app.js";
import * as CommonUtils from "./utils/common.js";
import {Dialog, DialogPositionEnum, DialogTypeEnum} from "./ui/controls/dialog.js";
import {SettingsController} from "./ui/controllers/settings.js";
import {Button} from "./ui/controls/button.js";
import {Control} from "./ui/controls/base.js";
import {ComponentTypeEnum} from "./settings/enum.js";

let Settings = AppSettings.fromQueryParams();

const mapImage = new Image();
await new Promise((resolve, reject) => {
    // noinspection JSValidateTypes
    mapImage.src = new URL("/assets/map.svg", import.meta.url);
    mapImage.onload = () => {
        mapImage.onload = null;
        mapImage.onerror = null;
        resolve()
    };

    mapImage.onerror = (e) => {
        alert(new Error(e.message ?? "Unable to load map"))
        reject()
    };
});

const bgCanvas = document.getElementById("canvas");
const oCanvas = document.getElementById("overlay");
const prCanvas = document.getElementById("projection");

const bgCtx = bgCanvas.getContext('2d');
const oCtx = oCanvas.getContext('2d');
const prCtx = prCanvas.getContext("2d", {willReadFrequently: true});

bgCtx.imageSmoothingEnabled = false;
prCtx.imageSmoothingEnabled = false;

let PixelData;
let CameraAngle = 56;
let CameraX = 138, CameraY = 42;

const ControlKeys = {Left: 0b1, Up: 0b10, Right: 0b100, Down: 0b1000}
let CameraControlKeys = 0;
const CameraMotionVector = new Vector2();
const CameraMaxSpeed = 60;

let MouseLocked = false;
let Changed = true;

reconfigure(Settings, true);

const loadingScreen = Control.byId("loading-screen");
const settingsCtrl = new SettingsController(document.getElementById("settings-content"), this)
settingsCtrl.subscribe(this, SettingsController.RECONFIGURE_EVENT, (sender, data) => reconfigure(data));

const settingsDialog = Dialog.byId("settings", settingsCtrl.root);
settingsDialog.type = DialogTypeEnum.popover;
settingsDialog.position = DialogPositionEnum.right;

settingsCtrl.configure(Settings);

const bSettings = Button.byId("settings-button");
bSettings.setOnClick(() => {
    bSettings.setEnabled(false);
    settingsDialog.show();

    const rect = settingsDialog.dialogElement.getBoundingClientRect();
    prCanvas.style.left = `calc(max(10px, min(${rect.left}px - 20px - var(--size), 50% - var(--size)/2)))`;
})

settingsDialog.setOnDismissed(() => {
    prCanvas.style.left = "calc(50% - var(--size)/2)";
    bSettings.setEnabled(true);
})

function reconfigure(newSettings, force = false) {
    const diff = Settings.compare(newSettings);

    Settings = newSettings;
    updateUrl(Settings);

    if (force || diff.breaks.has(ComponentTypeEnum.map)) {
        initCanvas(bgCanvas, Settings.map.resolution, Settings.map.scale);

        bgCtx.drawImage(mapImage, 0, 0, Settings.map.mapSize, Settings.map.mapSize);
        bgCanvas.style.width = bgCanvas.style.height = Settings.miniMap.resolution + "px";

        PixelData = bgCtx.getImageData(0, 0, Settings.map.mapSize, Settings.map.mapSize).data;
    }

    if (force || diff.breaks.has(ComponentTypeEnum.miniMap)) {
        initCanvas(oCanvas, Settings.miniMap.resolution, Settings.screen.scale);
        bgCanvas.style.width = bgCanvas.style.height = Settings.miniMap.resolution + "px";
        oCtx.scale(Settings.screen.scale, Settings.screen.scale);
    }

    if (force || diff.breaks.has(ComponentTypeEnum.screen)) {
        initCanvas(prCanvas, Settings.screen.resolution, Settings.screen.scale);
        prCtx.scale(Settings.screen.scale, Settings.screen.scale);
        prCtx.lineWidth = Settings.screen.resolution * (Settings.screen.scale / Settings.camera.far);
    }

    Changed = true;
}

function updateUrl(newSettings) {
    const params = newSettings.toQueryParams();
    const url = new URL(window.location.pathname, window.location.origin);
    for (const param of params) {
        if (param.exportable) continue;

        url.searchParams.set(param.key, param.value ?? "");
    }

    const urlSearchParams = new URLSearchParams(window.location.search);
    const existingParams = Object.fromEntries(urlSearchParams.entries());
    if (existingParams.state) {
        url.searchParams.set("state", existingParams.state);
    }

    window.history.replaceState('', '', url);
}

function trace(originVector, radOrigAngle) {
    const intersections = [];
    const fov = CommonUtils.degToRad(Settings.camera.fov);
    const {traceSteps} = Settings.rayCasting;

    const dt = (Settings.screen.resolution / 2) / Math.tan(fov / 2);
    const step = Settings.screen.resolution / traceSteps;

    for (let i = -traceSteps / 2; i <= traceSteps / 2; i++) {
        const emissionRandom = Settings.rayCasting.accumulateLight
            ? Math.random() * Settings.rayCasting.emissionRandomness : 0;
        const currentStep = (i + emissionRandom) * step;
        const angle = radOrigAngle + Math.atan(currentStep / dt);
        const collision = emitLight(originVector, angle, [255, 255, 255], Settings.reflection.count);

        if (collision) {
            const relAngle = angle - radOrigAngle;
            intersections.push({
                distance: Math.cos(relAngle) * collision.distance,
                colorData: collision.colorData,
                angle: relAngle
            });
        }
    }

    return intersections;
}

function emitLight(origin, angle, light, reflectionCount, lastDistance = 0) {
    const traceDistance = Settings.rayCasting.traceDistance - lastDistance;
    const angleVector = Vector2.fromAngle(angle);

    const result = traceRay(origin, angleVector, traceDistance);
    if (!result) return null;

    const {pixelOffset, position, distance, normal} = result;

    const colorData = new Array(3);
    const kDiffuse = Math.max(0, angleVector.dot(normal));
    const kSpecular = Math.pow(Math.max(0, angleVector.dot(normal.perpendicular())), 4);
    for (let i = 0; i < colorData.length; i++) {
        const color = PixelData[pixelOffset + i] * (kDiffuse + kSpecular);
        colorData[i] = Math.min(255, Math.floor(color));
    }

    ColorUtils.mixColorMultiply(colorData, light);
    ColorUtils.shadeColor(light, -Settings.reflection.energyLoss);

    if (reflectionCount > 0) {
        const reflectedAngle = angleVector.reflected(normal);
        const reflectionColor = getRayReflection(position.delta(normal), reflectedAngle, light, reflectionCount, distance);

        const kReflection = Math.abs(reflectedAngle.dot(normal.perpendicular()));
        ColorUtils.mixColorAdd(colorData, reflectionColor, kReflection);
    }

    return {
        distance,
        colorData
    };
}

function traceRay(origin, angleVector, traceDistance) {
    const {mapSize} = Settings.map;
    const xStep = angleVector.scaled(1 / angleVector.x).length();
    const yStep = angleVector.scaled(1 / angleVector.y).length();
    const direction = new Vector2(Math.sign(angleVector.x), Math.sign(angleVector.y));

    const position = new Vector2(origin.x, origin.y);
    const currentPath = new Vector2(
        (direction.x > 0 ? Math.trunc(origin.x) - origin.x : origin.x - Math.trunc(origin.x)) * xStep,
        (direction.y > 0 ? Math.trunc(origin.y) - origin.y : origin.y - Math.trunc(origin.y)) * yStep,
    );

    let lastComponent = null;
    let distance = 0;
    while (Math.min(currentPath.x, currentPath.y) < traceDistance) {
        if (currentPath.x + xStep < currentPath.y + yStep) {
            position.x += direction.x;
            currentPath.x += xStep;
            distance = currentPath.x;
            lastComponent = "x";
        } else {
            position.y += direction.y;
            currentPath.y += yStep;
            distance = currentPath.y;
            lastComponent = "y";
        }

        if (position.x < 0 || position.y < 0
            || position.x >= mapSize
            || position.y >= mapSize) break;

        const pixelOffset = 4 * (Math.floor(position.x) + Math.floor(position.y) * mapSize);
        const alpha = PixelData[pixelOffset + 3];
        if (alpha < 255) continue;

        return {
            pixelOffset,
            position,
            distance,
            normal: getNormal(lastComponent, angleVector)
        }
    }

    return null;
}

function getRayReflection(origin, angle, light, reflectionCount, distance) {
    const {subStepCount} = Settings.reflection;
    const spread = CommonUtils.degToRad(Settings.reflection.spread);

    const rAngle = Math.atan2(angle.y, angle.x);
    const originalLight = light.concat();

    let reflectionColor = null;
    for (let i = 0; i < subStepCount; i++) {
        const lightCopy = originalLight.concat();
        const rayAngle = rAngle + spread * (Math.random() - 0.5);
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

function drawProjection(intersections) {
    const screenResolution = Settings.screen.resolution;
    const fov = CommonUtils.degToRad(Settings.camera.fov);
    const far = Settings.camera.far;
    const gamma = Settings.camera.gamma;

    const dt = (screenResolution / 2) / Math.tan(fov / 2);

    for (const {angle, distance, colorData} of intersections) {
        const x = screenResolution / 2 + screenResolution * (angle / fov);
        const height = 12 * dt / distance;

        for (let i = 0; i < colorData.length; i++) {
            colorData[i] = 32 + 192 * Math.pow(colorData[i] / 255, 1 / gamma);
        }

        prCtx.strokeStyle = ColorUtils.toHex(colorData, far / distance / 10);
        prCtx.beginPath();
        prCtx.moveTo(x, screenResolution / 2 - height);
        prCtx.lineTo(x, screenResolution / 2 + height);
        prCtx.stroke();
    }
}


function initCanvas(canvas, size, scale) {
    canvas.width = size * scale;
    canvas.height = size * scale;
    canvas.style.setProperty("--size", size + "px");
    canvas.style.width = "var(--size)";
    canvas.style.height = "var(--size)";
}

function updateCameraMotionVector() {
    if (CameraControlKeys & ControlKeys.Up) {
        CameraMotionVector.x = 1;
    } else if (CameraControlKeys & ControlKeys.Down) {
        CameraMotionVector.x = -1;
    } else {
        CameraMotionVector.x = 0;
    }

    if (CameraControlKeys & ControlKeys.Left) {
        CameraMotionVector.y = 1;
    } else if (CameraControlKeys & ControlKeys.Right) {
        CameraMotionVector.y = -1;
    } else {
        CameraMotionVector.y = 0;
    }
}

document.onkeydown = (e) => {
    if (e.target.nodeName.toLowerCase() === "input") return;

    switch (e.key) {
        case  "ArrowUp":
        case "w":
            CameraControlKeys |= ControlKeys.Up;
            break;

        case  "ArrowDown":
        case "s":
            CameraControlKeys |= ControlKeys.Down;
            break;

        case  "ArrowLeft":
        case "a":
            CameraControlKeys |= ControlKeys.Left;
            break;

        case  "ArrowRight":
        case "d":
            CameraControlKeys |= ControlKeys.Right;
            break;
    }

    updateCameraMotionVector();
}

document.onkeyup = (e) => {
    if (e.target.nodeName.toLowerCase() === "input") return;

    switch (e.key) {
        case  "ArrowUp":
        case "w":
            CameraControlKeys &= ~ControlKeys.Up;
            break;

        case  "ArrowDown":
        case "s":
            CameraControlKeys &= ~ControlKeys.Down;
            break;

        case  "ArrowLeft":
        case "a":
            CameraControlKeys &= ~ControlKeys.Left;
            break;

        case  "ArrowRight":
        case "d":
            CameraControlKeys &= ~ControlKeys.Right;
            break;
    }

    updateCameraMotionVector();
}

prCanvas.onmousemove = (e) => {
    if (!MouseLocked) return;

    CameraAngle += e.movementX / 2;
    Changed = true;
}

prCanvas.onmousedown = async () => {
    if (MouseLocked) return

    await prCanvas.requestPointerLock();
}

document.onpointerlockchange = (_) => {
    MouseLocked = !!document.pointerLockElement;
}

document.onpointerlockerror = (_) => {
    alert("Unable to lock pointer. Try again later");
}

let lastRenderTime = performance.now();

function render(timestamp) {
    const delta = Math.min(0.1, (timestamp - lastRenderTime) / 1000);
    lastRenderTime = timestamp;

    const radAngle = (Math.PI * CameraAngle / 180);
    move(radAngle, delta);

    const position = new Vector2(CameraX, CameraY);

    drawMiniMap(radAngle);

    if (Settings.rayCasting.accumulateLight) {
        const intersections = trace(position, radAngle);
        accumulateProjectionLight(intersections);
    } else if (Changed) {
        const intersections = trace(position, radAngle);
        prCtx.clearRect(0, 0, Settings.screen.resolution, Settings.screen.resolution);
        drawProjection(intersections);
    }

    Changed = CameraMotionVector.lengthSquared() > 0;
    requestAnimationFrame(render);
}

function move(radAngle, delta) {
    const motionScalar = CameraMotionVector.normalize().lengthSquared();
    if (!motionScalar) return;

    const motionAngle = CameraMotionVector.angle(Vector2.fromAngle(radAngle));
    const motionVector = Vector2.fromAngle(motionAngle)
        .scaled(motionScalar * CameraMaxSpeed * delta);

    const nextX = CameraX + motionVector.x;
    const nextY = CameraY + motionVector.y;

    if (nextX < 0 || nextY < 0
        || nextX >= Settings.map.mapSize
        || nextY >= Settings.map.mapSize) return;

    const pixelIndex = Math.round(nextX) + Math.round(nextY) * Settings.map.mapSize;

    if (PixelData[pixelIndex * 4 + 3] < 255) {
        CameraX = nextX
        CameraY = nextY;
    }
}

function drawMiniMap(radAngle) {
    const resolution = Settings.miniMap.resolution;
    const fov = CommonUtils.degToRad(Settings.camera.fov);

    oCtx.clearRect(0, 0, resolution, resolution);
    oCtx.strokeStyle = 'pink';
    oCtx.fillStyle = 'red';

    const miniMapScale = resolution / Settings.map.resolution / Settings.map.scale;
    const x = CameraX * miniMapScale,
        y = CameraY * miniMapScale;
    const coneDistance = Math.max(Settings.miniMap.coneMinDistance, Settings.miniMap.coneDistance * miniMapScale);
    const originSize = Math.max(Settings.miniMap.originMinSize, Settings.miniMap.originSize * miniMapScale);

    oCtx.beginPath();
    oCtx.fillStyle = 'red';
    oCtx.rect(x - originSize / 2, y - originSize / 2, originSize, originSize);
    oCtx.fill();

    oCtx.strokeStyle = 'blue';
    oCtx.beginPath();
    oCtx.moveTo(x, y);
    oCtx.lineTo(x + coneDistance * Math.cos(radAngle - fov / 2), y + coneDistance * Math.sin(radAngle - fov / 2));
    oCtx.lineTo(x + coneDistance * Math.cos(radAngle + fov / 2), y + coneDistance * Math.sin(radAngle + fov / 2));
    oCtx.closePath();

    oCtx.stroke();
}

function accumulateProjectionLight(intersections) {
    let prevStateData = null;

    if (Changed) {
        prCtx.clearRect(0, 0, Settings.screen.resolution, Settings.screen.resolution);
    } else {
        prevStateData = prCtx.getImageData(0, 0, Settings.screen.screenSize, Settings.screen.screenSize).data;
    }

    drawProjection(intersections);

    const currentState = prCtx.getImageData(0, 0, Settings.screen.screenSize, Settings.screen.screenSize);
    const currentStateData = currentState.data;

    if (!Changed) {
        for (let i = 0; i < currentStateData.length; i += 4) {
            ColorUtils.mixColorLinearOffset(currentStateData, i, prevStateData, i, currentStateData, i, 0.5);
        }

        prCtx.putImageData(currentState, 0, 0);
    }
}

render(performance.now());

loadingScreen.setVisibility(false);