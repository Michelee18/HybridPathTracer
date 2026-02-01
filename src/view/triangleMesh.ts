export class TriangleMesh {

    buffer: GPUBuffer
    bufferLayout: GPUVertexBufferLayout
    vertices: Float32Array 
    vertexCount: number     

    constructor(device: GPUDevice){
    
        
        this.vertices = new Float32Array([  
             0.0,  0.0,  0.5,  0.5, 0.0,  1.0, 0.0, 0.0,  
             0.0, -0.5, -0.5,  0.0, 1.0,  1.0, 0.0, 0.0,  
             0.0,  0.5, -0.5,  1.0, 1.0,  1.0, 0.0, 0.0, 
        ]);

        this.vertexCount = 3;  

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