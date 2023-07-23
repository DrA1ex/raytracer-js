import {DependantProperties, Property, ReadOnlyProperty, SettingsBase} from "./base.js";

export class RayCastingSettings extends SettingsBase {
    static Properties = {
        accumulateLight: Property.bool("accumulate_light", false)
            .setName("Accumulate light").setDescription("Iterative accumulate light (ray-tracing"),

        emissionRandomness: Property.float("emission_randomness", 1.0)
            .setName("Emission Randomness")
            .setConstraints(0.0, 10.0),

        traceSteps: Property.int("trace_steps", 1000)
            .setName("Tracing steps")
            .setConstraints(1, 1e5),

        traceDistance: Property.int("trace_distance", 10000)
            .setName("Tracing distance").setDescription("Max ray distance")
            .setConstraints(10, 1e9),

        debug: Property.bool("debug", false)
            .setName("Debug"),
    }

    static PropertiesDependencies = new Map([
        [this.Properties.debug, new DependantProperties([this.Properties.accumulateLight], {invert: true})],
    ])

    get debug() {return this.config.debug;}
    get accumulateLight() {return this.config.accumulateLight;}
    get emissionRandomness() {return this.config.emissionRandomness;}
    get traceSteps() {return this.config.traceSteps;}
    get traceDistance() {return this.config.traceDistance;}

    constructor(values) {
        super(values);

        if (this.debug === true) {
            this.config.accumulateLight = false
        }
    }
}