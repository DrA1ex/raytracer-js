import {DependantProperties, Property, ReadOnlyProperty, SettingsBase} from "./base.js";

export class RayCastingSettings extends SettingsBase {
    static Properties = {
        accumulateLight: Property.bool("accumulate_light", false)
            .setName("Accumulate light").setDescription("Iterative accumulate light (ray-tracing"),

        traceSteps: Property.int("trace_steps", 1000)
            .setName("Tracing steps")
            .setConstraints(1, 1e5),

        traceDistance: Property.int("trace_distance", 10000)
            .setName("Tracing distance").setDescription("Max ray distance")
            .setConstraints(10, 1e9),

        emissionRandomness: Property.float("emission_randomness", 1.0)
            .setName("Emission Randomness")
            .setConstraints(0.0, 10.0),

        debug: Property.bool("debug", false)
            .setName("Debug"),

        debugColor: Property.bool("debug_color", false)
            .setName("Debug Color").setDescription("Enable reflection color mixing logging (browser console)"),
    }

    static PropertiesDependencies = new Map([
        [this.Properties.debug, new DependantProperties([this.Properties.accumulateLight, this.Properties.debugColor], {
            invert: {
                [this.Properties.accumulateLight.key]: true,
                [this.Properties.debugColor.key]: false
            },
        })],
        [this.Properties.debugColor, new DependantProperties([this.Properties.traceSteps], {invert: true})],
    ])

    get accumulateLight() {return this.config.accumulateLight;}
    get emissionRandomness() {return this.config.emissionRandomness;}
    get traceSteps() {return this.config.traceSteps;}
    get traceDistance() {return this.config.traceDistance;}
    get debug() {return this.config.debug;}
    get debugColor() {return this.config.debugColor;}

    constructor(values) {
        super(values);

        if (this.debug) {
            this.config.accumulateLight = false
        } else {
            this.config.debugColor = false;
        }

        if (this.debugColor) {
            this.config.traceSteps = 1;
        }
    }
}