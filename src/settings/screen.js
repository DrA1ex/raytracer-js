import {DependantProperties, Property, ReadOnlyProperty, SettingsBase} from "./base.js";
import {ComponentTypeEnum} from "./enum.js";

export class ScreenSettings extends SettingsBase {
    static Properties = {
        scale: Property.int("screen_scale")
            .setName("Scale")
            .setConstraints(1, 128)
            .setBreaks(ComponentTypeEnum.screen, ComponentTypeEnum.miniMap)
            .setExportable(false),

        resolution: Property.int("screen_resolution")
            .setName("Resolution")
            .setConstraints(480, 4096)
            .setBreaks(ComponentTypeEnum.screen)
            .setExportable(false)
    }

    static ReadOnlyProperties = {
        screenSize: ReadOnlyProperty.int().setName("Actual screen dimension"),
    }

    static PropertiesDependencies = new Map([
        [this.Properties.resolution, new DependantProperties([this.ReadOnlyProperties.screenSize])],
        [this.Properties.scale, new DependantProperties([this.ReadOnlyProperties.screenSize])],
    ])

    get screenSize() {return this.scale * this.resolution;}
    get scale() {return this.config.scale;}
    get resolution() {return this.config.resolution;}

    constructor(values) {
        super(values);

        const rect = document.body.getClientRects()[0];

        this.config.scale = values.scale ?? devicePixelRatio;
        const offset = 2 * parseFloat(getComputedStyle(document.body).fontSize);
        this.config.resolution = values.resolution ?? Math.min(rect.height, rect.width) - offset;
    }
}