import {Property, ReadOnlyProperty, SettingsBase} from "./base.js";
import {ComponentTypeEnum} from "./enum.js";

export class MapSettings extends SettingsBase {
    static Properties = {
        scale: Property.int("map_scale", 1)
            .setName("Scale")
            .setConstraints(1, 128)
            .setBreaks(ComponentTypeEnum.map),

        resolution: Property.int("map_resolution", 400)
            .setName("Resolution")
            .setConstraints(32, 4096)
            .setBreaks(ComponentTypeEnum.map)
    }

    static ReadOnlyProperties = {
        mapSize: ReadOnlyProperty.int().setName("Actual map dimension"),
    }

    static PropertiesDependencies = new Map([
        [this.Properties.resolution, [this.ReadOnlyProperties.mapSize]],
        [this.Properties.scale, [this.ReadOnlyProperties.mapSize]],
    ])

    get mapSize() {return this.scale * this.resolution;}
    get scale() {return this.config.scale;}
    get resolution() {return this.config.resolution;}
}