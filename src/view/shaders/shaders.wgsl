struct TransformData {
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
};

struct ObjectData {
    model: array<mat4x4<f32>>,
};

struct InstanceMaterials {
    materialIndices: array<u32>,
};

@group(0) @binding(0) var<uniform> transformUBO: TransformData;
@group(0) @binding(1) var<storage, read> objects: ObjectData;
@group(0) @binding(2) var<storage, read> instanceMaterials: InstanceMaterials;

@group(1) @binding(0) var myTexture: texture_2d<f32>;
@group(1) @binding(1) var mySampler: sampler;

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texCoord: vec2f,
    @location(1) worldPos: vec3f,
    @location(2) worldNormal: vec3f,
    @location(3) @interpolate(flat) materialIndex: u32,
};

// MRT: write multiple render targets
struct GBufferOutput {
    @location(0) gPosition: vec4<f32>, // world position (xyz) + materialIndex (w)
    @location(1) gNormal: vec4<f32>,   // world normal (xyz) + unused (w)
    @location(2) gAlbedo: vec4<f32>,   // color/albedo (can be overridden by material system)
};

@vertex
fn vs_main(
    @builtin(instance_index) instanceId: u32,
    @location(0) vertexPosition: vec3f,
    @location(1) vertexTexCoord: vec2f,
    @location(2) vertexNormal: vec3f
) -> VertexOutput {
    var output: VertexOutput;
    
    let modelMatrix = objects.model[instanceId];
    
    // Calculate world position
    let worldPosition = modelMatrix * vec4f(vertexPosition, 1.0);
    
    // Transform normal to world space
    // Use the inverse transpose of the model matrix for normals
    // For uniform scaling, we can use the upper 3x3 of the model matrix
    let normalMatrix = mat3x3<f32>(
        modelMatrix[0].xyz,
        modelMatrix[1].xyz,
        modelMatrix[2].xyz
    );
    let worldNormal = normalize(normalMatrix * vertexNormal);
    
    // Transform to clip space for rasterization
    output.position = transformUBO.projection * transformUBO.view * worldPosition;
    output.texCoord = vertexTexCoord;
    output.worldPos = worldPosition.xyz;
    output.worldNormal = worldNormal;
    
    // Read material index from buffer
    output.materialIndex = instanceMaterials.materialIndices[instanceId];
    
    return output;
}

@fragment
fn fs_gbuffer(
    @location(0) texCoord: vec2<f32>,
    @location(1) worldPos: vec3<f32>,
    @location(2) worldNormal: vec3<f32>,
    @location(3) @interpolate(flat) materialIndex: u32
) -> GBufferOutput {
    var output: GBufferOutput;

    // Store material index in position.w
    // This allows the compute shader to look up the correct material
    output.gPosition = vec4<f32>(worldPos, f32(materialIndex));

    // Store world-space normal
    output.gNormal = vec4<f32>(normalize(worldNormal), 0.0);

    // Sample texture albedo (this can be overridden by material system in compute shader)
    let albedoSample = textureSample(myTexture, mySampler, texCoord);
    output.gAlbedo = albedoSample;

    return output;
}