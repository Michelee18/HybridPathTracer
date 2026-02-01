export class QuadMesh {
    buffer: GPUBuffer
    bufferLayout: GPUVertexBufferLayout
    vertices: Float32Array
    vertexCount: number

    constructor(device: GPUDevice){
        this.vertices = new Float32Array([
    
            -1.0, -1.0,  0.0,  0.0, 0.0,  0.0, 0.0, 1.0,  
             1.0, -1.0,  0.0,  1.0, 0.0,  0.0, 0.0, 1.0,  
             1.0,  1.0,  0.0,  1.0, 1.0,  0.0, 0.0, 1.0, 
            
            -1.0, -1.0,  0.0,  0.0, 0.0,  0.0, 0.0, 1.0,  
             1.0,  1.0,  0.0,  1.0, 1.0,  0.0, 0.0, 1.0,  
            -1.0,  1.0,  0.0,  0.0, 1.0,  0.0, 0.0, 1.0,  
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