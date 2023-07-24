import {Property, ReadOnlyProperty, SettingsBase} from "./base.js";
import {ComponentTypeEnum} from "./enum.js";

export class MiniMapSettings extends SettingsBase {
    static Properties = {
        resolution: Property.int("mm_resolution", 200)
            .setName("Resolution")
            .setConstraints(32, 4096)
            .setBreaks(ComponentTypeEnum.miniMap),

        coneDistance: Property.int("mm_cone_distance", 100)
            .setName("Cone length").setDescription("Camera cone length")
            .setConstraints(32, 4096),

        coneMinDistance: Property.int("mm_cone_min_distance", 20)
            .setName("Cone Min Length")
            .setConstraints(16, 4096),

        originSize: Property.int("mm_origin_size", 10)
            .setName("Origin Size")
            .setConstraints(1, 128),

        originMinSize: Property.int("mm_origin_min_size", 4)
            .setName("Origin Min Size")
            .setConstraints(1, 128),
    }

    get coneDistance() {return this.config.coneDistance;}
    get resolution() {return this.config.resolution;}
    get originSize() {return this.config.originSize;}

    get originMinSize() {return this.config.originMinSize;}
    get coneMinDistance() {return this.config.coneMinDistance;}
}