import { vec3 } from "gl-matrix";

class Triangle {
    v0: vec3; v1: vec3; v2: vec3;
    centroid: vec3;
    materialIndex: number;

    constructor(v0: vec3, v1: vec3, v2: vec3, materialIndex: number = 0) {
        this.v0 = v0; this.v1 = v1; this.v2 = v2;
        this.materialIndex = materialIndex;
        this.centroid = vec3.scale(vec3.create(), vec3.add(vec3.create(), vec3.add(vec3.create(), v0, v1), v2), 1/3);
    }
}

class BVHNode {
    minCorner = vec3.fromValues(999999, 999999, 999999);
    maxCorner = vec3.fromValues(-999999, -999999, -999999);
    leftChild = 0;
    primitiveCount = 0;
}

export class BVHScene {
    triangles: Triangle[] = [];
    nodes: BVHNode[] = [];
    triangleIndices: number[] = [];
    nodesUsed = 0;
    triangleCount = 0;
    rootNodeIndex = 0;

    addTriangle(v0: vec3, v1: vec3, v2: vec3, materialIndex: number = 0) {
        this.triangles.push(new Triangle(v0, v1, v2, materialIndex));
        this.triangleCount++;
    }

    addTrianglesFromVertexBuffer(vertices: Float32Array, vertexCount: number, materialIndex: number = 0) {
        for (let i = 0; i < vertexCount; i += 3) {
            this.addTriangle(
                vec3.fromValues(vertices[i*8], vertices[i*8+1], vertices[i*8+2]),
                vec3.fromValues(vertices[(i+1)*8], vertices[(i+1)*8+1], vertices[(i+1)*8+2]),
                vec3.fromValues(vertices[(i+2)*8], vertices[(i+2)*8+1], vertices[(i+2)*8+2]),
                materialIndex
            );
        }
    }

    buildBVH(): number {
        if (!this.triangles.length) return 0;

        this.triangleIndices = Array.from({length: this.triangles.length}, (_, i) => i);
        this.nodes = Array.from({length: 2 * this.triangles.length - 1}, () => new BVHNode());

        const root = this.nodes[0];
        root.leftChild = 0;
        root.primitiveCount = this.triangles.length;
        this.nodesUsed = 1;
        this.rootNodeIndex = 0;

        this.updateBounds(0);
        this.subdivide(0);
        return this.rootNodeIndex;
    }

    private updateBounds(nodeIndex: number) {
        const node = this.nodes[nodeIndex];
        node.minCorner = vec3.fromValues(999999, 999999, 999999);
        node.maxCorner = vec3.fromValues(-999999, -999999, -999999);

        for (let i = 0; i < node.primitiveCount; i++) {
            const tri = this.triangles[this.triangleIndices[node.leftChild + i]];
            vec3.min(node.minCorner, node.minCorner, tri.v0);
            vec3.min(node.minCorner, node.minCorner, tri.v1);
            vec3.min(node.minCorner, node.minCorner, tri.v2);
            vec3.max(node.maxCorner, node.maxCorner, tri.v0);
            vec3.max(node.maxCorner, node.maxCorner, tri.v1);
            vec3.max(node.maxCorner, node.maxCorner, tri.v2);
        }
    }

    private subdivide(nodeIndex: number) {
        const node = this.nodes[nodeIndex];
        if (node.primitiveCount <= 2) return;

        const extent = vec3.sub(vec3.create(), node.maxCorner, node.minCorner);
        let axis = extent[1] > extent[0] ? 1 : 0;
        if (extent[2] > extent[axis]) axis = 2;

        let splitPos = node.minCorner[axis] + extent[axis] / 2;
        
        // SAH optimization
        if (extent[axis] > 0.0001) {
            let bestCost = Infinity;
            for (let bin = 1; bin < 8; bin++) {
                const testPos = node.minCorner[axis] + (extent[axis] * bin) / 8;
                let leftCount = 0, rightCount = 0;
                
                for (let i = 0; i < node.primitiveCount; i++) {
                    if (this.triangles[this.triangleIndices[node.leftChild + i]].centroid[axis] < testPos) leftCount++;
                    else rightCount++;
                }
                
                if (leftCount && rightCount) {
                    const cost = leftCount * rightCount;
                    if (cost < bestCost) {
                        bestCost = cost;
                        splitPos = testPos;
                    }
                }
            }
        }

        let leftCount = this.partition(node, axis, splitPos);

        // Fallbacks for degenerate cases
        if (!leftCount || leftCount === node.primitiveCount) {
            splitPos = node.minCorner[axis] + extent[axis] * 0.5;
            leftCount = this.partition(node, axis, splitPos);
        }
        
        if (!leftCount || leftCount === node.primitiveCount) {
            leftCount = Math.floor(node.primitiveCount / 2);
        }

        if (!leftCount || leftCount === node.primitiveCount) return;

        const leftChildIndex = this.nodesUsed++;
        const rightChildIndex = this.nodesUsed++;

        this.nodes[leftChildIndex].leftChild = node.leftChild;
        this.nodes[leftChildIndex].primitiveCount = leftCount;
        this.nodes[rightChildIndex].leftChild = node.leftChild + leftCount;
        this.nodes[rightChildIndex].primitiveCount = node.primitiveCount - leftCount;

        node.leftChild = leftChildIndex;
        node.primitiveCount = 0;

        this.updateBounds(leftChildIndex);
        this.updateBounds(rightChildIndex);
        this.subdivide(leftChildIndex);
        this.subdivide(rightChildIndex);
    }

    private partition(node: BVHNode, axis: number, splitPos: number): number {
        let i = node.leftChild;
        let j = i + node.primitiveCount - 1;

        while (i <= j) {
            if (this.triangles[this.triangleIndices[i]].centroid[axis] < splitPos) {
                i++;
            } else {
                [this.triangleIndices[i], this.triangleIndices[j]] = [this.triangleIndices[j], this.triangleIndices[i]];
                j--;
            }
        }
        return i - node.leftChild;
    }

    getNodeData(): Float32Array {
        const data = new Float32Array(this.nodesUsed * 8);
        for (let i = 0; i < this.nodesUsed; i++) {
            const n = this.nodes[i];
            const offset = i * 8;
            data.set([n.minCorner[0], n.minCorner[1], n.minCorner[2], n.leftChild, 
                      n.maxCorner[0], n.maxCorner[1], n.maxCorner[2], n.primitiveCount], offset);
        }
        return data;
    }

    getTriangleData(): Float32Array {
        const data = new Float32Array(this.triangles.length * 12);
        this.triangles.forEach((t, i) => {
            const o = i * 12;
            data.set([t.v0[0], t.v0[1], t.v0[2], 0, t.v1[0], t.v1[1], t.v1[2], 0, 
                      t.v2[0], t.v2[1], t.v2[2], t.materialIndex], o);
        });
        return data;
    }

    getTriangleIndicesData(): Float32Array {
        return Float32Array.from(this.triangleIndices);
    }
}