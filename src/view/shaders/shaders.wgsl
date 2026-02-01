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

struct GBufferOutput {
    @location(0) gPosition: vec4<f32>,
    @location(1) gNormal: vec4<f32>,   
    @location(2) gAlbedo: vec4<f32>,   
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
    
    
    let worldPosition = modelMatrix * vec4f(vertexPosition, 1.0);
    
    let normalMatrix = mat3x3<f32>(
        modelMatrix[0].xyz,
        modelMatrix[1].xyz,
        modelMatrix[2].xyz
    );
    let worldNormal = normalize(normalMatrix * vertexNormal);
    
    output.position = transformUBO.projection * transformUBO.view * worldPosition;
    output.texCoord = vertexTexCoord;
    output.worldPos = worldPosition.xyz;
    output.worldNormal = worldNormal;
    
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


    output.gPosition = vec4<f32>(worldPos, f32(materialIndex));
    output.gNormal = vec4<f32>(normalize(worldNormal), 0.0);
    let albedoSample = textureSample(myTexture, mySampler, texCoord);
    output.gAlbedo = albedoSample;

    return output;
}