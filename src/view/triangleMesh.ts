export class TriangleMesh {

    buffer: GPUBuffer
    bufferLayout: GPUVertexBufferLayout
    vertices: Float32Array  // ADD THIS
    vertexCount: number     // ADD THIS

    constructor(device: GPUDevice){
    
        // Array of 32bit floats: position (3), texCoord (2), normal (3)
        this.vertices = new Float32Array([  // CHANGED: store as this.vertices
            // x,    y,    z,    u,   v,   nx,  ny,  nz
             0.0,  0.0,  0.5,  0.5, 0.0,  1.0, 0.0, 0.0,  // vertex 0 (pointing right)
             0.0, -0.5, -0.5,  0.0, 1.0,  1.0, 0.0, 0.0,  // vertex 1
             0.0,  0.5, -0.5,  1.0, 1.0,  1.0, 0.0, 0.0,  // vertex 2
        ]);

        this.vertexCount = 3;  // ADD THIS

        const usage : GPUBufferUsageFlags = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
    
        const descriptor : GPUBufferDescriptor = {
            size: this.vertices.byteLength,
            usage: usage,
            mappedAtCreation: true
        };
    
        this.buffer = device.createBuffer(descriptor);

        new Float32Array(this.buffer.getMappedRange()).set(this.vertices);
        this.buffer.unmap();
    
        this.bufferLayout = {
            arrayStride: 32, // 8 floats * 4 bytes = 32 bytes
            attributes: [
                {
                    shaderLocation: 0, // position
                    offset: 0,
                    format: "float32x3"
                },
                {
                    shaderLocation: 1, // texCoord
                    offset: 12,
                    format: "float32x2"
                },
                {
                    shaderLocation: 2, // normal
                    offset: 20,
                    format: "float32x3"
                }
            ]
        };
    }
}