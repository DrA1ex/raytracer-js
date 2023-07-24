import {Vector2} from "./utils/vector.js";
import {AppSettings} from "./settings/app.js";
import * as CommonUtils from "./utils/common.js";
import {Dialog, DialogPositionEnum, DialogTypeEnum} from "./ui/controls/dialog.js";
import {SettingsController} from "./ui/controllers/settings.js";
import {Button} from "./ui/controls/button.js";
import {Control} from "./ui/controls/base.js";
import {ComponentTypeEnum} from "./settings/enum.js";
import {RayTracer} from "./tracing.js";
import {CameraControl} from "./camera.js";
import {MinimapRenderer, ProjectionRenderer} from "./render.js";

const MapImage = await CommonUtils.loadImage(new URL("/assets/map.svg", import.meta.url));

const bgCanvas = document.getElementById("canvas");
const oCanvas = document.getElementById("overlay");
const prCanvas = document.getElementById("projection");

let Settings = AppSettings.fromQueryParams();

let PixelData = new Uint8Array(0);
let LastRenderTime = performance.now();

const RayTracerInstance = new RayTracer();
const CameraCtrl = new CameraControl(prCanvas);
const RendererCtrl = new ProjectionRenderer(prCanvas, MapImage, RayTracerInstance);
const MinimapCtrl = new MinimapRenderer(oCanvas);


const bgCtx = bgCanvas.getContext('2d');
bgCtx.imageSmoothingEnabled = false;

reconfigure(Settings, true);
CameraCtrl.setup();

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
});

function reconfigure(newSettings, force = false) {
    const diff = Settings.compare(newSettings);

    Settings = newSettings;
    updateUrl(Settings);

    if (force || diff.breaks.has(ComponentTypeEnum.map)) {
        initCanvas(bgCanvas, Settings.map.resolution, Settings.map.scale);

        bgCtx.drawImage(MapImage, 0, 0, Settings.map.mapSize, Settings.map.mapSize);
        bgCanvas.style.width = bgCanvas.style.height = Settings.miniMap.resolution + "px";

        PixelData = bgCtx.getImageData(0, 0, Settings.map.mapSize, Settings.map.mapSize).data;
    }

    if (force || diff.breaks.has(ComponentTypeEnum.miniMap)) {
        initCanvas(oCanvas, Settings.miniMap.resolution, Settings.screen.scale);
        bgCanvas.style.width = bgCanvas.style.height = Settings.miniMap.resolution + "px";
    }

    if (force || diff.breaks.has(ComponentTypeEnum.screen)) {
        initCanvas(prCanvas, Settings.screen.resolution, Settings.screen.scale);
    }

    RayTracerInstance.reconfigure(Settings, PixelData);
    CameraCtrl.reconfigure(Settings, PixelData);
    RendererCtrl.reconfigure(Settings);
    MinimapCtrl.reconfigure(Settings);

    CameraCtrl.changed = true;
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


function initCanvas(canvas, size, scale) {
    canvas.width = size * scale;
    canvas.height = size * scale;
    canvas.style.setProperty("--size", size + "px");
    canvas.style.width = "var(--size)";
    canvas.style.height = "var(--size)";
}

function render(timestamp) {
    const delta = Math.min(0.1, (timestamp - LastRenderTime) / 1000);
    CameraCtrl.move(delta);

    const position = new Vector2(CameraCtrl.cameraX, CameraCtrl.cameraY);
    const radAngle = CommonUtils.degToRad(CameraCtrl.cameraAngle);

    if (CameraCtrl.changed) {
        MinimapCtrl.render(position, radAngle);
    }

    RendererCtrl.render(position, radAngle, CameraCtrl.changed);
    CameraCtrl.changed = CameraCtrl.motionVector.lengthSquared() > 0;

    LastRenderTime = timestamp;
    requestAnimationFrame(render);
}

render(performance.now());

loadingScreen.setVisibility(false);