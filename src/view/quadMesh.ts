export class QuadMesh {
    buffer: GPUBuffer
    bufferLayout: GPUVertexBufferLayout
    vertices: Float32Array
    vertexCount: number

    constructor(device: GPUDevice){
        // FIXED: Changed from -0.5/+0.5 to -1.0/+1.0 to match getQuadTriangles()
        this.vertices = new Float32Array([
            // x,    y,    z,    u,   v,   nx,  ny,  nz
            -1.0, -1.0,  0.0,  0.0, 0.0,  0.0, 0.0, 1.0,  // bottom-left
             1.0, -1.0,  0.0,  1.0, 0.0,  0.0, 0.0, 1.0,  // bottom-right
             1.0,  1.0,  0.0,  1.0, 1.0,  0.0, 0.0, 1.0,  // top-right
            
            -1.0, -1.0,  0.0,  0.0, 0.0,  0.0, 0.0, 1.0,  // bottom-left
             1.0,  1.0,  0.0,  1.0, 1.0,  0.0, 0.0, 1.0,  // top-right
            -1.0,  1.0,  0.0,  0.0, 1.0,  0.0, 0.0, 1.0,  // top-left
        ]);

        this.vertexCount = 6;

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
            arrayStride: 32,
            attributes: [
                {
                    shaderLocation: 0,
                    offset: 0,
                    format: "float32x3"
                },
                {
                    shaderLocation: 1,
                    offset: 12,
                    format: "float32x2"
                },
                {
                    shaderLocation: 2,
                    offset: 20,
                    format: "float32x3"
                }
            ]
        };
    }
}