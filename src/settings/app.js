import {AppSettingsBase, SettingsGroup} from "./base.js";
import {MapSettings} from "./map.js";
import {ScreenSettings} from "./screen.js";
import {MiniMapSettings} from "./miniMap.js";
import {CameraSettings} from "./camera.js";
import {RayCastingSettings} from "./rayCasting.js";
import {ReflectionSettings} from "./reflection.js";

/**
 * @extends {AppSettingsBase<AppSettings>}
 */
export class AppSettings extends AppSettingsBase {
    static Types = {
        camera: SettingsGroup.of(CameraSettings).setName("Camera"),
        rayCasting: SettingsGroup.of(RayCastingSettings).setName("Ray Casting"),
        reflection: SettingsGroup.of(ReflectionSettings).setName("Reflection"),
        screen: SettingsGroup.of(ScreenSettings).setName("Screen"),
        map: SettingsGroup.of(MapSettings).setName("Map"),
        miniMap: SettingsGroup.of(MiniMapSettings).setName("Mini Map"),
    }

    /** @returns {CameraSettings} */
    get camera() {return this.config.camera}
    /** @returns {RayCastingSettings} */
    get rayCasting() {return this.config.rayCasting}
    /** @returns {ReflectionSettings} */
    get reflection() {return this.config.reflection}
    /** @returns {MapSettings} */
    get map() {return this.config.map;}
    /** @returns {ScreenSettings} */
    get screen() {return this.config.screen;}
    /** @returns {MiniMapSettings} */
    get miniMap() {return this.config.miniMap;}
}