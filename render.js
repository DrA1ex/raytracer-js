import * as ColorUtils from "./utils/color.js";
import * as CommonUtils from "./utils/common.js";

export class ProjectionRenderer {
    #canvas;
    #ctx;
    #mapImage;
    #raytracer;

    #settings;

    currentIteration = 1;

    constructor(canvas, mapImage, raytracer) {
        this.#canvas = canvas;
        this.#ctx = canvas.getContext("2d", {willReadFrequently: true});

        this.#mapImage = mapImage;
        this.#raytracer = raytracer;
    }

    reconfigure(settings) {
        this.#settings = settings;
        this.#ctx.resetTransform();
        this.#ctx.scale(settings.screen.scale, settings.screen.scale);
    }

    render(position, radAngle, changed) {
        const shouldBuildProjection = this.#settings.rayCasting.accumulateLight || changed;
        const data = shouldBuildProjection && this.#raytracer.trace(position, radAngle);

        if (this.#settings.rayCasting.accumulateLight) {
            this.#accumulateProjectionLight(data, changed);
        } else if (changed) {
            this.#ctx.clearRect(0, 0, this.#settings.screen.resolution, this.#settings.screen.resolution);

            if (!this.#settings.rayCasting.debug) {
                this.#drawProjection(data);
            } else {
                this.#drawDebugProjection(this.#raytracer.debug.reflectionRays);
            }
        }
    }

    #drawProjection(intersections) {
        const screenResolution = this.#settings.screen.resolution;
        const fov = CommonUtils.degToRad(this.#settings.camera.fov);
        const far = this.#settings.camera.far;

        const gamma = this.#settings.camera.gamma;
        const dt = (screenResolution / 2) / Math.tan(fov / 2);

        this.#ctx.lineWidth = 1.5;

        for (const {angle, distance, colorData} of intersections) {
            const x = screenResolution / 2 + screenResolution * (angle / fov);
            const height = 12 * dt / distance;

            ColorUtils.gammaCorrection(colorData, gamma);

            this.#ctx.strokeStyle = ColorUtils.toHex(colorData, far / distance / 10);
            this.#ctx.beginPath();
            this.#ctx.moveTo(x, screenResolution / 2 - height);
            this.#ctx.lineTo(x, screenResolution / 2 + height);
            this.#ctx.stroke();
        }
    }

    #drawDebugProjection(reflectionRays) {
        const screenResolution = this.#settings.screen.resolution;
        const {far, gamma} = this.#settings.camera;

        this.#ctx.drawImage(this.#mapImage, 0, 0, screenResolution, screenResolution);
        this.#ctx.fillStyle = "rgba(0,0,0,0.8)";
        this.#ctx.fillRect(0, 0, screenResolution, screenResolution);

        const mapScale = screenResolution / this.#settings.map.mapSize;

        for (const {origin, angle, colorData, distance, totalDistance, level} of reflectionRays) {
            const kDepth = (this.#settings.reflection.count + 2 - level) / (this.#settings.reflection.count + 1);
            const anchorSize = 6 * kDepth;
            const pos = angle.scale(distance)
                .add(origin).scaled(mapScale);

            ColorUtils.gammaCorrection(colorData, gamma);

            this.#ctx.lineWidth = 0.5 * kDepth;
            this.#ctx.fillStyle = this.#ctx.strokeStyle = ColorUtils.toHex(colorData, far / totalDistance / 10);
            this.#ctx.fillRect(pos.x - anchorSize / 2, pos.y - anchorSize / 2, anchorSize, anchorSize);

            this.#ctx.beginPath();
            this.#ctx.moveTo(origin.x * mapScale, origin.y * mapScale);
            this.#ctx.lineTo(pos.x, pos.y);
            this.#ctx.stroke();
        }
    }

    #accumulateProjectionLight(data, changed) {
        let prevStateData = null;

        const {resolution, screenSize} = this.#settings.screen;

        if (changed) {
            this.#ctx.clearRect(0, 0, resolution, resolution);
            this.currentIteration = 1;
        } else {
            prevStateData = this.#ctx.getImageData(0, 0, screenSize, screenSize).data;
        }

        this.#drawProjection(data);

        const currentState = this.#ctx.getImageData(0, 0, screenSize, screenSize);
        const currentStateData = currentState.data;

        if (!changed) {
            const factor = 1 / this.currentIteration;
            for (let i = 0; i < currentStateData.length; i += 4) {
                ColorUtils.mixColorLinearOffset(currentStateData, i, prevStateData, i, currentStateData, i, factor);
            }

            this.#ctx.putImageData(currentState, 0, 0);
        }

        this.currentIteration++;
    }
}

export class MinimapRenderer {
    #canvas;
    #ctx;

    #settings;

    constructor(canvas) {
        this.#canvas = canvas;
        this.#ctx = canvas.getContext("2d", {willReadFrequently: true});
    }

    reconfigure(settings) {
        this.#settings = settings;
        this.#ctx.resetTransform();
        this.#ctx.scale(settings.screen.scale, settings.screen.scale);
    }

    render(origin, radAngle) {
        const resolution = this.#settings.miniMap.resolution;
        const fov = CommonUtils.degToRad(this.#settings.camera.fov);

        this.#ctx.clearRect(0, 0, resolution, resolution);
        this.#ctx.strokeStyle = 'pink';
        this.#ctx.fillStyle = 'red';

        const miniMapScale = resolution / this.#settings.map.resolution / this.#settings.map.scale;
        const x = origin.x * miniMapScale,
            y = origin.y * miniMapScale;
        const coneDistance = Math.max(this.#settings.miniMap.coneMinDistance, this.#settings.miniMap.coneDistance * miniMapScale);
        const originSize = Math.max(this.#settings.miniMap.originMinSize, this.#settings.miniMap.originSize * miniMapScale);

        this.#ctx.beginPath();
        this.#ctx.fillStyle = 'red';
        this.#ctx.rect(x - originSize / 2, y - originSize / 2, originSize, originSize);
        this.#ctx.fill();

        this.#ctx.strokeStyle = 'blue';
        this.#ctx.beginPath();
        this.#ctx.moveTo(x, y);
        this.#ctx.lineTo(x + coneDistance * Math.cos(radAngle - fov / 2), y + coneDistance * Math.sin(radAngle - fov / 2));
        this.#ctx.lineTo(x + coneDistance * Math.cos(radAngle + fov / 2), y + coneDistance * Math.sin(radAngle + fov / 2));
        this.#ctx.closePath();

        this.#ctx.stroke();
    }

}