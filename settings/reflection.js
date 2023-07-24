import {Property, SettingsBase} from "./base.js";


export class ReflectionSettings extends SettingsBase {
    static Properties = {
        count: Property.int("reflection_count", 1)
            .setName("Count").setDescription("Maximum reflections for one ray beam")
            .setConstraints(0, 100),

        spread: Property.float("reflection_spread", 2.0)
            .setName("Spread").setDescription("Reflection beam spread in degrees")
            .setConstraints(0.0, 180.0),

        shininess: Property.float("reflection_shininess", 4)
            .setName("Shininess")
            .setConstraints(0.1, 256),

        energyLoss: Property.float("reflection_energy_loss", 0.1)
            .setName("Energy Loss")
            .setConstraints(0.0, 1.0),
    }

    get count() {return this.config.count;}
    get spread() {return this.config.spread;}
    get shininess() {return this.config.shininess;}
    get energyLoss() {return this.config.energyLoss;}
}