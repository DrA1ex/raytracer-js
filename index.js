import {Vector2} from "./utils/vector.js";
import * as ColorUtils from "./utils/color.js";
import {AppSettings} from "./settings/app.js";
import * as CommonUtils from "./utils/common.js";
import {Dialog, DialogPositionEnum, DialogTypeEnum} from "./ui/controls/dialog.js";
import {SettingsController} from "./ui/controllers/settings.js";
import {Button} from "./ui/controls/button.js";
import {Control} from "./ui/controls/base.js";
import {ComponentTypeEnum} from "./settings/enum.js";
import {RayTracer} from "./tracing.js";

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
let CurrentIteration = 1;

const RayTracerInstance = new RayTracer(Settings, PixelData);

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
        RayTracerInstance.mapData = PixelData;
    }

    if (force || diff.breaks.has(ComponentTypeEnum.miniMap)) {
        initCanvas(oCanvas, Settings.miniMap.resolution, Settings.screen.scale);
        bgCanvas.style.width = bgCanvas.style.height = Settings.miniMap.resolution + "px";
        oCtx.scale(Settings.screen.scale, Settings.screen.scale);
    }

    if (force || diff.breaks.has(ComponentTypeEnum.screen)) {
        initCanvas(prCanvas, Settings.screen.resolution, Settings.screen.scale);
        prCtx.scale(Settings.screen.scale, Settings.screen.scale);
    }

    RayTracerInstance.settings = Settings;
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

function drawProjection(intersections) {
    const screenResolution = Settings.screen.resolution;
    const fov = CommonUtils.degToRad(Settings.camera.fov);
    const far = Settings.camera.far;

    const gamma = Settings.camera.gamma;
    const dt = (screenResolution / 2) / Math.tan(fov / 2);

    prCtx.lineWidth = 1.5;

    for (const {angle, distance, colorData} of intersections) {
        const x = screenResolution / 2 + screenResolution * (angle / fov);
        const height = 12 * dt / distance;

        ColorUtils.gammaCorrection(colorData, gamma);

        prCtx.strokeStyle = ColorUtils.toHex(colorData, far / distance / 10);
        prCtx.beginPath();
        prCtx.moveTo(x, screenResolution / 2 - height);
        prCtx.lineTo(x, screenResolution / 2 + height);
        prCtx.stroke();
    }
}

function drawDebugProjection(intersections) {
    const screenResolution = Settings.screen.resolution;
    const far = Settings.camera.far;
    const gamma = Settings.camera.gamma;

    const radAngle = CommonUtils.degToRad(CameraAngle);

    prCtx.drawImage(mapImage, 0, 0, screenResolution, screenResolution);
    prCtx.fillStyle = "rgba(0,0,0,0.8)";
    prCtx.fillRect(0, 0, screenResolution, screenResolution);

    const mapScale = screenResolution / Settings.map.mapSize;

    for (const {origin, angle, colorData, distance, totalDistance, level} of RayTracerInstance.debug.reflectionRays) {
        const kDepth = (Settings.reflection.count + 2 - level) / (Settings.reflection.count + 1);
        const anchorSize = 6 * kDepth;
        const pos = angle.scale(distance)
            .add(origin).scaled(mapScale);

        ColorUtils.gammaCorrection(colorData, gamma);

        prCtx.lineWidth = 0.5 * kDepth;
        prCtx.fillStyle = prCtx.strokeStyle = ColorUtils.toHex(colorData, far / totalDistance / 10);
        prCtx.fillRect(pos.x - anchorSize / 2, pos.y - anchorSize / 2, anchorSize, anchorSize);

        prCtx.beginPath();
        prCtx.moveTo(origin.x * mapScale, origin.y * mapScale);
        prCtx.lineTo(pos.x, pos.y);
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

    const radAngle = CommonUtils.degToRad(CameraAngle);
    move(radAngle, delta);

    const position = new Vector2(CameraX, CameraY);

    drawMiniMap(radAngle);

    const shouldBuildProjection = Settings.rayCasting.accumulateLight || Changed;
    const intersections = shouldBuildProjection && RayTracerInstance.trace(position, radAngle);

    if (Settings.rayCasting.accumulateLight) {
        accumulateProjectionLight(intersections);
    } else if (Changed) {
        prCtx.clearRect(0, 0, Settings.screen.resolution, Settings.screen.resolution);
        if (!Settings.rayCasting.debug) {
            drawProjection(intersections);
        } else {
            drawDebugProjection(intersections);
        }
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
        CurrentIteration = 1;
    } else {
        prevStateData = prCtx.getImageData(0, 0, Settings.screen.screenSize, Settings.screen.screenSize).data;
    }

    drawProjection(intersections);

    const currentState = prCtx.getImageData(0, 0, Settings.screen.screenSize, Settings.screen.screenSize);
    const currentStateData = currentState.data;

    if (!Changed) {
        const factor = 1 / CurrentIteration;
        for (let i = 0; i < currentStateData.length; i += 4) {
            ColorUtils.mixColorLinearOffset(currentStateData, i, prevStateData, i, currentStateData, i, factor);
        }

        prCtx.putImageData(currentState, 0, 0);
    }

    CurrentIteration++;
}

render(performance.now());

loadingScreen.setVisibility(false);