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
    mapImage.src = "./assets/map.svg";
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
    const {mapSize} = Settings.map;
    const {traceDistance} = Settings.rayCasting;

    const angleVector = Vector2.fromAngle(angle);
    const xStep = angleVector.scaled(1 / angleVector.x).length();
    const yStep = angleVector.scaled(1 / angleVector.y).length();
    const direction = new Vector2(Math.sign(angleVector.x), Math.sign(angleVector.y));

    const position = new Vector2(Math.ceil(origin.x), Math.ceil(origin.y));
    const currentPath = new Vector2();

    let lastComponent = null;
    while (Math.min(currentPath.x, currentPath.y) < lastDistance + traceDistance) {
        if (currentPath.x + xStep < currentPath.y + yStep) {
            currentPath.x += xStep;
            position.x += direction.x;
            lastComponent = "x";
        } else {
            currentPath.y += yStep;
            position.y += direction.y;
            lastComponent = "y";
        }

        if (position.x < 0 || position.y < 0
            || position.x >= mapSize
            || position.y >= mapSize) break;

        const pixelOffset = 4 * (position.x + position.y * mapSize);
        const alpha = PixelData[pixelOffset + 3];
        if (alpha < 255) continue;

        const distance = origin.distance(position);
        const normal = getNormal(lastComponent, direction);
        const reflectedAngle = angleVector.reflected(normal);

        let reflectionColor = null;
        if (reflectionCount > 0) {
            reflectionColor = getRayReflection(position.delta(normal), reflectedAngle, light, reflectionCount, distance);
        }

        const colorData = new Array(3);
        const kDiffuse = Math.max(0, angleVector.dot(normal));
        const kSpecular = Math.pow(Math.max(0, angleVector.dot(normal.perpendicular())), 4);
        for (let i = 0; i < colorData.length; i++) {
            const color = PixelData[pixelOffset + i] * (kDiffuse + kSpecular);
            colorData[i] = Math.min(255, Math.floor(color));
        }

        ColorUtils.mixColorMultiply(colorData, light);
        ColorUtils.shadeColor(light, -Settings.reflection.energyLoss);

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

function render() {
    const radAngle = (Math.PI * CameraAngle / 180)
    const position = new Vector2(Math.floor(CameraX), Math.floor(CameraY));

    drawMiniMap(radAngle);

    if (Settings.rayCasting.accumulateLight) {
        const intersections = trace(position, radAngle);
        accumulateProjectionLight(intersections);
    } else if (Changed) {
        const intersections = trace(position, radAngle);
        prCtx.clearRect(0, 0, Settings.screen.resolution, Settings.screen.resolution);
        drawProjection(intersections);
    }

    Changed = false;
    requestAnimationFrame(render);
}

function drawMiniMap(radAngle) {
    const resolution = Settings.miniMap.resolution;
    const fov = CommonUtils.degToRad(Settings.camera.fov);

    oCtx.clearRect(0, 0, resolution, resolution);
    oCtx.strokeStyle = 'pink';
    oCtx.fillStyle = 'red';

    const miniMapScale = resolution / Settings.map.resolution / Settings.map.scale;
    const x = Math.floor(CameraX * miniMapScale),
        y = Math.floor(CameraY * miniMapScale);
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

render();

loadingScreen.setVisibility(false);