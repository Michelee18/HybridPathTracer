import { vec3, mat4 } from "gl-matrix";
import { Deg2Rad } from "./math";

export class Statue {

    position: vec3;
    eulers: vec3;
    scale: vec3;
    model: mat4;

    constructor(position: vec3, eulers: vec3, scale: vec3 = [1, 1, 1]) {
        this.position = position;
        this.eulers = eulers;
        this.scale = scale;
    }

    update() {
        this.model = mat4.create();
        
        // 1. Translate
        mat4.translate(this.model, this.model, this.position);
        
        // 2. Rotate (Order: Y -> Z -> X to match previous behavior)
        mat4.rotateY(this.model, this.model, Deg2Rad(this.eulers[1]));
        mat4.rotateZ(this.model, this.model, Deg2Rad(this.eulers[2]));
        mat4.rotateX(this.model, this.model, Deg2Rad(this.eulers[0]));

        // 3. Scale
        mat4.scale(this.model, this.model, this.scale);
    }

    get_model(): mat4 {
        return this.model;
    }
}