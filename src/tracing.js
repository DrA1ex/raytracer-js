import * as CommonUtils from "./utils/common.js";
import * as ColorUtils from "./utils/color.js";
import {Vector2} from "./utils/vector.js";

export class RayTracer {
    #settings;
    #mapData;

    debug = {
        reflectionRays: []
    };

    reconfigure(settings, mapData) {
        this.#settings = settings;
        this.#mapData = mapData;
    }

    /**
     * @param {Vector2} originVector
     * @param {Number} radOrigAngle
     * @returns {*[]}
     */
    trace(originVector, radOrigAngle) {
        this.debug.reflectionRays = [];
        const intersections = [];
        const fov = CommonUtils.degToRad(this.#settings.camera.fov);
        const {traceSteps} = this.#settings.rayCasting;

        const dt = (this.#settings.screen.resolution / 2) / Math.tan(fov / 2);
        const step = this.#settings.screen.resolution / traceSteps;

        const from = -Math.floor(traceSteps / 2);
        const to = Math.floor(traceSteps / 2);

        for (let i = from; i <= to; i++) {
            const emissionRandom = this.#settings.rayCasting.accumulateLight
                ? Math.random() * this.#settings.rayCasting.emissionRandomness : 0;
            const currentStep = (i + emissionRandom) * step;
            const angle = radOrigAngle + Math.atan(currentStep / dt);

            const ray = new Ray(originVector, Vector2.fromAngle(angle), this.#settings, this.#mapData);
            const result = this.#traceRay(ray);

            if (result) {
                const relAngle = angle - radOrigAngle;
                intersections.push({
                    distance: Math.cos(relAngle) * result.distance,
                    colorData: result.colorData,
                    angle: relAngle
                });
            }
        }

        return intersections;
    }

    /**
     * @param {Ray} ray
     */
    #traceRay(ray) {
        if (!ray.trace()) return null;

        const {
            origin, direction, energy, totalDistance, bounces,
            result: {colorData, normal, distance}
        } = ray;

        const debugData = {};
        if (this.#settings.rayCasting.debugColor) debugData.originalColor = colorData.slice(0, 3);

        const kDiffuse = Math.max(0, direction.dot(normal));
        const kSpecular = Math.pow(Math.max(0, direction.dot(normal.perpendicular())), this.#settings.reflection.shininess);
        for (let i = 0; i < colorData.length; i++) {
            const color = colorData[i] * (kDiffuse + kSpecular);
            colorData[i] = Math.min(255, Math.floor(color));
        }

        if (this.#settings.rayCasting.debugColor) debugData.computedColor = colorData.slice(0, 3);

        const reflectionData = this.#traceRay(ray);
        if (reflectionData) {
            const kReflection = Math.pow(Math.abs(ray.nextDirection.dot(normal.perpendicular())), this.#settings.reflection.shininess);
            ColorUtils.mixColorAdd(colorData, reflectionData.colorData, kReflection);
            ColorUtils.colorMultiply(colorData, energy);

            if (this.#settings.rayCasting.debug) debugData.kReflection = kReflection;
        }


        if (this.#settings.rayCasting.debug) {
            this.debug.reflectionRays.push({
                origin: origin,
                angle: direction,
                colorData: colorData,
                distance: distance,
                totalDistance: totalDistance,
                level: bounces
            });

            if (this.#settings.rayCasting.debugColor && reflectionData) {
                console.log(
                    `#${bounces} found: %c ████████ \t %c reflection: %c ████████ + %c ████████ -> %c ████████ %c`
                    + `(k = ${debugData.kReflection.toFixed(2)}, e = ${energy.toFixed(2)})`,
                    `color: rgb(${debugData.originalColor.join(",")})`,
                    `color: black`,
                    `color: rgb(${debugData.computedColor.join(",")})`,
                    `color: rgb(${reflectionData.colorData.join(",")})`,
                    `color: rgb(${colorData.join(",")})`,
                    `color: black`,
                );
            }
        }


        return {distance, colorData};
    }
}

class Ray {
    /** @type {AppSettings} */
    #settings;
    /** @type {Uint8Array} */
    #mapData;

    #maxDistance;
    #emissionLeft;
    #spread;

    origin;
    direction;

    nextOrigin = null;
    nextDirection = null;
    nextEnergy = null;

    bounces = 0;
    totalDistance = 0;
    energy = 1;

    result = {
        distance: -1,
        normal: null,
        colorData: null
    }

    /**
     * @param {Vector2} origin
     * @param {Vector2} direction
     * @param {AppSettings} settings
     * @param {Uint8Array} mapData
     */
    constructor(origin, direction, settings, mapData) {
        this.origin = origin;
        this.direction = direction;

        this.#settings = settings;
        this.#mapData = mapData;

        this.#maxDistance = settings.rayCasting.traceDistance;
        this.#emissionLeft = settings.reflection.count + 1;
        this.#spread = CommonUtils.degToRad(settings.reflection.spread);
    }

    trace() {
        const {mapSize} = this.#settings.map;

        this.#clear();

        if (this.#emissionLeft === 0) return false;
        if (this.nextOrigin) this.origin = this.nextOrigin;
        if (this.nextDirection) this.direction = this.nextDirection;
        if (this.nextEnergy !== null) this.energy = this.nextEnergy;

        this.#emissionLeft--;
        this.bounces++;

        const position = new Vector2(Math.floor(this.origin.x), Math.floor(this.origin.y));
        const traceDirection = new Vector2(Math.sign(this.direction.x), Math.sign(this.direction.y));

        const step = new Vector2(
            Math.abs(1 / this.direction.x),
            Math.abs(1 / this.direction.y)
        );

        const currentPath = new Vector2((
            traceDirection.x > 0 ? Math.trunc(this.origin.x) - this.origin.x
                : this.origin.x - Math.trunc(this.origin.x)) * step.x,
            (traceDirection.y > 0
                ? Math.trunc(this.origin.y) - this.origin.y
                : this.origin.y - Math.trunc(this.origin.y)) * step.y,
        );

        let distance = Math.min(currentPath.x, currentPath.y);
        let component = null;

        while (distance < this.#maxDistance) {
            component = currentPath.x + step.x < currentPath.y + step.y ? "x" : "y";
            if (component === "x") {
                position.x += traceDirection.x;
                currentPath.x += step.x;
                distance = currentPath.x;
            } else {
                position.y += traceDirection.y;
                currentPath.y += step.y;
                distance = currentPath.y;
            }

            if (
                position.x < 0 || position.y < 0
                || position.x >= mapSize || position.y >= mapSize
            ) break;

            const pixelOffset = 4 * (position.x + position.y * mapSize);
            const alpha = this.#mapData[pixelOffset + 3];
            if (alpha < 255) continue;

            this.result.distance = distance;
            this.result.normal = this.#getNormal(component, this.direction);
            this.result.colorData = this.#mapData.slice(pixelOffset, pixelOffset + 3);

            const reflected = this.direction.reflected(this.result.normal)
                .rotate(this.#spread * (Math.random() - 0.5));

            this.nextOrigin = position.sub(this.result.normal);
            this.nextDirection = reflected;

            this.#maxDistance -= distance;
            this.totalDistance += distance;
            this.nextEnergy = this.energy * (1 - this.#settings.reflection.energyLoss);

            return true;
        }

        return false;
    }

    #getNormal(lastComponent, direction) {
        if (lastComponent === "x") {
            return new Vector2(direction.x > 0 ? 1 : -1, 0);
        } else {
            return new Vector2(0, direction.y > 0 ? 1 : -1);
        }
    }

    #clear() {
        this.result.distance = -1;
        this.result.normal = null;
        this.result.colorData = null;
    }
}