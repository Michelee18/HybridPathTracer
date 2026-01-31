// cornellBox.ts
import { vec3 } from "gl-matrix";

export type BVHTriangle = {
    v0: vec3;
    v1: vec3;
    v2: vec3;
    material: string;
};

export function createCornellBox(size = 2.0): BVHTriangle[] {
    const s = size * 0.5;

    const tris: BVHTriangle[] = [];

    // Floor (white)
    tris.push(
        { v0: vec3.fromValues(-s, -s, 0), v1: vec3.fromValues(s, -s, 0), v2: vec3.fromValues(s, s, 0), material: "floor" },
        { v0: vec3.fromValues(-s, -s, 0), v1: vec3.fromValues(s, s, 0), v2: vec3.fromValues(-s, s, 0), material: "floor" }
    );

    // Ceiling (white)
    tris.push(
        { v0: vec3.fromValues(-s, -s, size), v1: vec3.fromValues(s, s, size), v2: vec3.fromValues(s, -s, size), material: "ceiling" },
        { v0: vec3.fromValues(-s, -s, size), v1: vec3.fromValues(-s, s, size), v2: vec3.fromValues(s, s, size), material: "ceiling" }
    );

    // Back wall (white)
    tris.push(
        { v0: vec3.fromValues(-s, s, 0), v1: vec3.fromValues(s, s, 0), v2: vec3.fromValues(s, s, size), material: "backWall" },
        { v0: vec3.fromValues(-s, s, 0), v1: vec3.fromValues(s, s, size), v2: vec3.fromValues(-s, s, size), material: "backWall" }
    );

    // Left wall (red)
    tris.push(
        { v0: vec3.fromValues(-s, -s, 0), v1: vec3.fromValues(-s, s, size), v2: vec3.fromValues(-s, s, 0), material: "leftWall" },
        { v0: vec3.fromValues(-s, -s, 0), v1: vec3.fromValues(-s, -s, size), v2: vec3.fromValues(-s, s, size), material: "leftWall" }
    );

    // Right wall (green)
    tris.push(
        { v0: vec3.fromValues(s, -s, 0), v1: vec3.fromValues(s, s, 0), v2: vec3.fromValues(s, s, size), material: "rightWall" },
        { v0: vec3.fromValues(s, -s, 0), v1: vec3.fromValues(s, s, size), v2: vec3.fromValues(s, -s, size), material: "rightWall" }
    );

    // Ceiling area light (2 triangles)
    const l = 0.5;
    const z = size - 0.01;

    tris.push(
        { v0: vec3.fromValues(-l, -l, z), v1: vec3.fromValues(l, -l, z), v2: vec3.fromValues(l, l, z), material: "areaLight" },
        { v0: vec3.fromValues(-l, -l, z), v1: vec3.fromValues(l, l, z), v2: vec3.fromValues(-l, l, z), material: "areaLight" }
    );

    return tris;
}
