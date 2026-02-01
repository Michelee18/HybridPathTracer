import { vec3, mat4, glMatrix } from "gl-matrix";
export class Quad {
position: vec3;
rotation: vec3; // Added rotation (degrees)
scale: vec3;
model: mat4;

constructor(position: vec3, rotation: vec3 = [0, 0, 0], scale: vec3 = [1, 1, 1]) {
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.model = mat4.create();
    this.update();
}

update() {
    this.model = mat4.create();
    
    // 1. Translate
    mat4.translate(this.model, this.model, this.position);
    
    // 2. Rotate 
    mat4.rotateX(this.model, this.model, glMatrix.toRadian(this.rotation[0]));
    mat4.rotateY(this.model, this.model, glMatrix.toRadian(this.rotation[1]));
    mat4.rotateZ(this.model, this.model, glMatrix.toRadian(this.rotation[2]));

    // 3. Scale
    mat4.scale(this.model, this.model, this.scale); 
}

get_model(): mat4 {
    return this.model;
}
}