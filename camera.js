import {Vector2} from "./utils/vector.js";
import * as CommonUtils from "./utils/common.js";

const ControlKeys = {Left: 0b1, Up: 0b10, Right: 0b100, Down: 0b1000};

export class CameraControl {
    #node;

    settings;
    mapData;

    mouseLocked = false;
    controlKeys = 0;
    motionVector = new Vector2();

    cameraAngle = 56;
    cameraX = 138;
    cameraY = 42;

    changed = true;

    constructor(node) {
        this.#node = node;
    }

    reconfigure(settings, mapData) {
        this.settings = settings;
        this.mapData = mapData
    }

    setup() {
        document.onkeydown = (e) => {
            if (e.target.nodeName.toLowerCase() === "input") return;

            switch (e.key) {
                case  "ArrowUp":
                case "w":
                    this.controlKeys |= ControlKeys.Up;
                    break;

                case  "ArrowDown":
                case "s":
                    this.controlKeys |= ControlKeys.Down;
                    break;

                case  "ArrowLeft":
                case "a":
                    this.controlKeys |= ControlKeys.Left;
                    break;

                case  "ArrowRight":
                case "d":
                    this.controlKeys |= ControlKeys.Right;
                    break;
            }

            this.#updateCameraMotionVector();
        }

        document.onkeyup = (e) => {
            if (e.target.nodeName.toLowerCase() === "input") return;

            switch (e.key) {
                case  "ArrowUp":
                case "w":
                    this.controlKeys &= ~ControlKeys.Up;
                    break;

                case  "ArrowDown":
                case "s":
                    this.controlKeys &= ~ControlKeys.Down;
                    break;

                case  "ArrowLeft":
                case "a":
                    this.controlKeys &= ~ControlKeys.Left;
                    break;

                case  "ArrowRight":
                case "d":
                    this.controlKeys &= ~ControlKeys.Right;
                    break;
            }

            this.#updateCameraMotionVector();
        }

        this.#node.onmousemove = (e) => {
            if (!this.mouseLocked) return;

            this.cameraAngle += e.movementX / 2;
            this.changed = true;
        }

        this.#node.onmousedown = async (e) => {
            if (this.mouseLocked) return

            if (e.button === 0) {
                await this.#node.requestPointerLock();
            }
        }

        let initPosX;
        this.#node.ontouchstart = (e) => {
            initPosX = e.touches[0].clientX;
            this.mouseLocked = true;
        }
        this.#node.ontouchend = () => this.mouseLocked = false;
        this.#node.ontouchmove = (e) => {
            if (!this.mouseLocked) return;

            const movementX = e.touches[0].clientX - initPosX;
            this.cameraAngle += movementX / 2;
            initPosX = e.touches[0].clientX;

            this.changed = true;
        }

        this.#node.onwheel = (e) => {
            let key;
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                key = e.deltaX > 0 ? ControlKeys.Left : ControlKeys.Right;
            } else {
                key = e.deltaY > 0 ? ControlKeys.Up : ControlKeys.Down;
            }

            this.controlKeys |= key;
            this.#updateCameraMotionVector();

            setTimeout(() => {
                this.controlKeys &= ~key;
                this.#updateCameraMotionVector();
            }, 100);
        }

        document.onpointerlockchange = (_) => {
            this.mouseLocked = !!document.pointerLockElement;
        }

        document.onpointerlockerror = (_) => {
            alert("Unable to lock pointer. Try again later");
        }
    }

    move(delta) {
        const motionScalar = this.motionVector.normalize().lengthSquared();
        if (!motionScalar) return;

        const radAngle = CommonUtils.degToRad(this.cameraAngle);
        const motionAngle = this.motionVector.angle(Vector2.fromAngle(radAngle));
        const motionVector = Vector2.fromAngle(motionAngle)
            .scaled(motionScalar * this.settings.camera.maxSpeed * delta);

        const nextX = this.cameraX + motionVector.x;
        const nextY = this.cameraY + motionVector.y;

        if (nextX < 0 || nextY < 0
            || nextX >= this.settings.map.mapSize
            || nextY >= this.settings.map.mapSize) return;

        const pixelIndex = Math.round(nextX) + Math.round(nextY) * this.settings.map.mapSize;

        if (this.mapData[pixelIndex * 4 + 3] < 255) {
            this.cameraX = nextX
            this.cameraY = nextY;
        }
    }

    #updateCameraMotionVector() {
        if (this.controlKeys & ControlKeys.Up) {
            this.motionVector.x = 1;
        } else if (this.controlKeys & ControlKeys.Down) {
            this.motionVector.x = -1;
        } else {
            this.motionVector.x = 0;
        }

        if (this.controlKeys & ControlKeys.Left) {
            this.motionVector.y = 1;
        } else if (this.controlKeys & ControlKeys.Right) {
            this.motionVector.y = -1;
        } else {
            this.motionVector.y = 0;
        }
    }
}