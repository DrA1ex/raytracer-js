import {Property, SettingsBase} from "./base.js";

export class CameraSettings extends SettingsBase {
    static Properties = {
        fov: Property.int("fov", 70)
            .setName("FOV").setDescription("Field of View")
            .setConstraints(30, 160),

        far: Property.int("far", 1000)
            .setName("Far").setDescription("Max visible distance")
            .setConstraints(10, 1e9),

        maxSpeed: Property.float("max_speed", 60)
            .setName("Speed")
            .setConstraints(0.1, 240),

        gamma: Property.float("gamma", 2.0)
            .setName("Gama")
            .setConstraints(0.1, 4.0),
    }

    get fov() {return this.config.fov;}
    get far() {return this.config.far;}
    get maxSpeed() {return this.config.maxSpeed;}
    get gamma() {return this.config.gamma;}
}