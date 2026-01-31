import { vec3, vec2 } from "gl-matrix";

export class ObjMesh {

    buffer: GPUBuffer
    bufferLayout: GPUVertexBufferLayout
    v: vec3[]
    vt: vec2[]
    vn: vec3[]
    vertices: Float32Array
    vertexCount: number

    constructor() {
        this.v = [];
        this.vt = [];
        this.vn = [];
    }

    async initialize(device: GPUDevice, url: string) {
        await this.readFile(url);
        
        // Safety check: if read failed or file empty
        if (!this.vertices || this.vertices.length === 0) {
            console.error(`Mesh ${url} failed to load or is empty.`);
            this.vertexCount = 0;
            return;
        }

        this.vertexCount = this.vertices.length / 8; 

        const usage: GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;

        const descriptor: GPUBufferDescriptor = {
            size: this.vertices.byteLength,
            usage: usage,
            mappedAtCreation: true 
        };

        this.buffer = device.createBuffer(descriptor);

        new Float32Array(this.buffer.getMappedRange()).set(this.vertices);
        this.buffer.unmap();

        this.bufferLayout = {
            arrayStride: 32, 
            attributes: [
                {
                    shaderLocation: 0,
                    format: "float32x3",
                    offset: 0
                },
                {
                    shaderLocation: 1,
                    format: "float32x2",
                    offset: 12
                },
                {
                    shaderLocation: 2, 
                    format: "float32x3",
                    offset: 20
                }
            ]
        }
    }

    async readFile(url: string) {
        var result: number[] = [];

        const response: Response = await fetch(url);
        const blob: Blob = await response.blob();
        const file_contents = (await blob.text());
        const lines = file_contents.split("\n");

        lines.forEach((line) => {
            // Trim whitespace to prevent empty strings at start/end
            line = line.trim();
            if(line === "" || line.startsWith("#")) return;

            // Split by any amount of whitespace (tab, space, double space)
            const parts = line.split(/\s+/);
            const type = parts[0];

            if (type === "v") {
                this.read_vertex_data(parts);
            }
            else if (type === "vt") {
                this.read_texcoord_data(parts);
            }
            else if (type === "vn") {
                this.read_normal_data(parts);
            }
            else if (type === "f") {
                this.read_face_data(parts, result);
            }
        });

        this.vertices = new Float32Array(result);
    }

    read_vertex_data(components: string[]) {
        const new_vertex: vec3 = [
            Number(components[1]),
            Number(components[2]),
            Number(components[3])
        ];
        this.v.push(new_vertex);
    }

    read_texcoord_data(components: string[]) {
        const new_texcoord: vec2 = [
            Number(components[1]),
            Number(components[2])
        ];
        this.vt.push(new_texcoord);
    }

    read_normal_data(components: string[]) {
        const new_normal: vec3 = [
            Number(components[1]),
            Number(components[2]),
            Number(components[3])
        ];
        this.vn.push(new_normal);
    }

    read_face_data(parts: string[], result: number[]) {
        /*
           parts[0] is "f"
           parts[1] is v1...
        */
       const triangle_count = parts.length - 3; 
       for (var i = 0; i < triangle_count; i++) {
            this.read_corner(parts[1], result);
            this.read_corner(parts[2 + i], result);
            this.read_corner(parts[3 + i], result);
       }
    }

    read_corner(vertex_description: string, result: number[]) {
        const v_vt_vn = vertex_description.split("/");
        
        // 1. POSITION (Always exists in valid OBJ)
        // OBJ is 1-based, array is 0-based
        const vIdx = parseInt(v_vt_vn[0]) - 1;
        const v = this.v[vIdx];
        
        if (!v) {
            // Fallback to prevent crash if index is invalid
            result.push(0, 0, 0); 
        } else {
            result.push(v[0], v[1], v[2]);
        }
        
        // 2. TEXTURE COORDINATES (Optional)
        // Check if index 1 exists AND is not an empty string (e.g. "f 1//1")
        let vt: vec2 = [0, 0];
        if (v_vt_vn.length > 1 && v_vt_vn[1].length > 0) {
            const vtIdx = parseInt(v_vt_vn[1]) - 1;
            if (this.vt[vtIdx]) {
                vt = this.vt[vtIdx];
            }
        }
        result.push(vt[0], vt[1]);
        
        // 3. NORMALS (Optional)
        let vn: vec3 = [0, 0, 1]; // Default normal pointing Z+
        if (v_vt_vn.length > 2 && v_vt_vn[2].length > 0) {
            const vnIdx = parseInt(v_vt_vn[2]) - 1;
            if (this.vn[vnIdx]) {
                vn = this.vn[vnIdx];
            }
        }
        result.push(vn[0], vn[1], vn[2]);
    }
}