struct Params {
  width: u32,
  height: u32,
  debugMode: u32,
  frameCount: u32,
  jitterX: f32,
  jitterY: f32,
  maxBounces: u32,
  padding2: f32,
};

struct Ray {
  origin: vec3<f32>,
  direction: vec3<f32>,
};

struct Material {
  albedoColor: vec3<f32>,
  albedoType: f32,
  emission: vec3<f32>,
  emissionStrength: f32,
  roughness: f32,
  specular: f32,
  ior: f32,
  transmission: f32,
  materialType: f32,
  clearcoat: f32,
  clearcoatRoughness: f32,
  padding: f32,
};

struct HitInfo {
  hit: bool,
  distance: f32,
  position: vec3<f32>,
  normal: vec3<f32>,
  albedo: vec3<f32>,
  emission: vec3<f32>,
  roughness: f32,
  specular: f32,
  ior: f32,
  transmission: f32,
  triangleIndex: i32,
  fromInside: bool,
};

struct BVHNode {
  minCorner: vec3<f32>,
  leftChild: f32,
  maxCorner: vec3<f32>,
  primitiveCount: f32,
};

struct Triangle {
  v0: vec3<f32>,
  padding0: f32,
  v1: vec3<f32>,
  padding1: f32,
  v2: vec3<f32>,
  materialIndex: f32,
};

struct CameraUniforms {
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
    viewInverse: mat4x4<f32>,
    projectionInverse: mat4x4<f32>
};

@group(0) @binding(0) var gPosition : texture_2d<f32>;
@group(0) @binding(1) var gNormal   : texture_2d<f32>;
@group(0) @binding(2) var gAlbedo   : texture_2d<f32>;
@group(0) @binding(3) var samp      : sampler;
@group(0) @binding(4) var outTex    : texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var<uniform> params : Params;
@group(0) @binding(6) var<storage, read> bvhNodes : array<BVHNode>;
@group(0) @binding(7) var<storage, read> triangles : array<Triangle>;
@group(0) @binding(8) var<storage, read> triangleIndices : array<f32>;
@group(0) @binding(9) var<storage, read_write> accumulationBuffer : array<vec4<f32>>;
@group(0) @binding(10) var blueNoiseTexture: texture_2d<f32>;
@group(0) @binding(11) var blueNoiseSampler: sampler;
@group(0) @binding(12) var<storage, read> materials : array<Material>;
@group(0) @binding(13) var skyboxTexture: texture_cube<f32>;
@group(0) @binding(14) var skyboxSampler: sampler;
@group(0) @binding(15) var<uniform> camera: CameraUniforms;
@group(0) @binding(16) var<storage, read> instanceMaterials : array<u32>;

fn wang_hash(seed: u32) -> u32 {
    var s = seed;
    s = (s ^ 61u) ^ (s >> 16u);
    s *= 9u;
    s = s ^ (s >> 4u);
    s *= 0x27d4eb2du;
    s = s ^ (s >> 15u);
    return s;
}

fn init_rng(pixel: vec2<u32>, frame: u32) -> u32 {
    var seed = pixel.x * 1973u + pixel.y * 9277u + frame * 26699u;
    seed = (seed ^ 61u) ^ (seed >> 16u);
    seed = seed * 9u;
    seed = seed ^ (seed >> 4u);
    seed = seed * 0x27d4eb2du;
    seed = seed ^ (seed >> 15u);
    return seed | 1u;
}

fn get_blue_noise(screenPos: vec2<u32>, frame: u32) -> vec3<f32> {
    let frameF = f32(frame);
    let screenP = vec2<f32>(screenPos);
    let wrappedFrame = frame % 16u;
   
    var seed1 = u32(floor(frameF / 16.0) + 10.0);
    var seed2 = u32(floor(frameF / 16.0) + 43.0);
    var seed3 = u32(floor(frameF / 16.0) + 19.0);
    
    let randomOffset1 = f32(wang_hash(seed1)) / 4294967296.0;
    let randomOffset2 = f32(wang_hash(seed2)) / 5784967513.0;
    let randomOffset3 = f32(wang_hash(seed3)) / 3924967692.0;

    let tileWrapped = vec2<f32>(f32(wrappedFrame % 4u), floor(f32(wrappedFrame) / 4.0)) * 128.0;
    let sampleCoords = (screenP % vec2<f32>(128.0)) + tileWrapped;
    let texSize = vec2<f32>(textureDimensions(blueNoiseTexture, 0));
    let uv = sampleCoords / texSize;

    var noiseValue = textureSampleLevel(blueNoiseTexture, blueNoiseSampler, uv, 0.0).rgb;
    
    noiseValue.r = (noiseValue.r + randomOffset1) % 1.0;
    noiseValue.g = (noiseValue.g + randomOffset2) % 1.0;
    noiseValue.b = (noiseValue.b + randomOffset3) % 1.0;

    return noiseValue;
}

fn rand(seed: ptr<function, u32>) -> f32 {
    *seed = wang_hash(*seed);
    return f32(*seed) / 4294967296.0;
}

fn random_unit_vector_wn(seed: ptr<function, u32>) -> vec3<f32> {
    let z = rand(seed) * 2.0 - 1.0;
    let a = rand(seed) * 2.0 * 3.14159265;
    let r = sqrt(max(0.0, 1.0 - z * z)); 
    let x = r * cos(a);
    let y = r * sin(a);
    return vec3<f32>(x, y, z);
}

fn sampleSkybox(direction: vec3<f32>) -> vec3<f32> {
    return textureSampleLevel(skyboxTexture, skyboxSampler, normalize(direction), 0.0).rgb;
}

fn hit_aabb(ray: Ray, node: BVHNode) -> f32 {
    let inverseDir = vec3<f32>(1.0) / ray.direction;
    let t1 = (node.minCorner - ray.origin) * inverseDir;
    let t2 = (node.maxCorner - ray.origin) * inverseDir;
    let tMin = min(t1, t2);
    let tMax = max(t1, t2);
    let t_min = max(max(tMin.x, tMin.y), tMin.z);
    let t_max = min(min(tMax.x, tMax.y), tMax.z);
    if (t_min > t_max || t_max < 0.0) { return 99999.0; }
    return t_min;
}

fn hit_triangle(ray: Ray, tri: Triangle, tMin: f32, tMax: f32, index: i32, fromInside: bool) -> HitInfo {
    var hit: HitInfo;
    hit.hit = false;
    hit.distance = 99999.0;
    hit.triangleIndex = -1;
    hit.fromInside = fromInside;
    
    let edge_ab = tri.v1 - tri.v0;
    let edge_ac = tri.v2 - tri.v0;
    let geometricNormal = normalize(cross(edge_ab, edge_ac));
    let ray_dot_normal = dot(ray.direction, geometricNormal);
    
    var n = geometricNormal;
    let hitFromFront = ray_dot_normal < 0.0;
    
    if (!hitFromFront && fromInside) {
        n = -geometricNormal;
        hit.fromInside = false;
    } else if (hitFromFront) {
        hit.fromInside = false;
    } else {
        n = -geometricNormal;
        hit.fromInside = true;
    }
    
    if (abs(ray_dot_normal) < 0.00001) { return hit; }

    var system_matrix = mat3x3<f32>(ray.direction, tri.v0 - tri.v1, tri.v0 - tri.v2);
    let denominator = determinant(system_matrix);
    if (abs(denominator) < 0.00001) { return hit; }

    system_matrix = mat3x3<f32>(ray.direction, tri.v0 - ray.origin, tri.v0 - tri.v2);
    let u = determinant(system_matrix) / denominator;
    if (u < 0.0 || u > 1.0) { return hit; }

    system_matrix = mat3x3<f32>(ray.direction, tri.v0 - tri.v1, tri.v0 - ray.origin);
    let v = determinant(system_matrix) / denominator;
    if (v < 0.0 || u + v > 1.0) { return hit; }

    system_matrix = mat3x3<f32>(tri.v0 - ray.origin, tri.v0 - tri.v1, tri.v0 - tri.v2);
    let t = determinant(system_matrix) / denominator;

    if (t > tMin && t < tMax) {
        hit.hit = true;
        hit.distance = t;
        hit.position = ray.origin + t * ray.direction;
        hit.normal = n;
        hit.triangleIndex = index;
        
        let objectID = u32(tri.materialIndex);
        var matIndex: u32 = 0u;
        if (objectID < arrayLength(&instanceMaterials)) {
            matIndex = instanceMaterials[objectID];
        }

        if (matIndex < arrayLength(&materials)) {
            let mat = materials[matIndex];
            hit.albedo = clamp(mat.albedoColor, vec3<f32>(0.001), vec3<f32>(0.999));
            hit.emission = mat.emission * mat.emissionStrength;
            hit.roughness = clamp(mat.roughness, 0.001, 1.0);
            hit.specular = clamp(mat.specular, 0.0, 1.0);
            hit.ior = clamp(mat.ior, 1.0, 3.0);
            hit.transmission = clamp(mat.transmission, 0.0, 1.0);
        } else {
            hit.albedo = vec3<f32>(1.0, 0.0, 1.0);
            hit.emission = vec3<f32>(0.0);
            hit.roughness = 0.8;
            hit.specular = 0.5;
            hit.ior = 1.5;
            hit.transmission = 0.0;
        }
    }
    return hit;
}

fn intersectBVH(ray: Ray, tMin: f32, tMax: f32, fromInside: bool) -> HitInfo {
    var closestHit: HitInfo;
    closestHit.hit = false;
    closestHit.triangleIndex = -1;
    closestHit.fromInside = fromInside;
    var nearestHit = tMax;
    
    if (arrayLength(&bvhNodes) == 0u) { return closestHit; }
    
    var node = bvhNodes[0];
    var stack: array<BVHNode, 64>;
    var stackLocation = 0u;
    var iterationCount = 0u;
    let maxIterations = 4096u; 
    
    while (true) {
        iterationCount += 1u;
        if (iterationCount > maxIterations) { return closestHit; }
        
        let primitiveCount = u32(node.primitiveCount);
        let contents = u32(node.leftChild);
        
        if (primitiveCount == 0u) {
            if (contents >= arrayLength(&bvhNodes) || contents + 1u >= arrayLength(&bvhNodes)) {
                if (stackLocation == 0u) { break; }
                stackLocation -= 1u;
                node = stack[stackLocation];
                continue;
            }
            var child1 = bvhNodes[contents];
            var child2 = bvhNodes[contents + 1u];
            var distance1 = hit_aabb(ray, child1);
            var distance2 = hit_aabb(ray, child2);
            
            if (distance1 > distance2) {
                let tempDist = distance1; distance1 = distance2; distance2 = tempDist;
                let tempChild = child1; child1 = child2; child2 = tempChild;
            }
            
            if (distance1 >= nearestHit) {
                 if (stackLocation == 0u) { break; }
                stackLocation -= 1u;
                node = stack[stackLocation];
                continue;
            }

            if (distance1 > nearestHit) {
                if (stackLocation == 0u) { break; }
                stackLocation -= 1u;
                node = stack[stackLocation];
            } else {
                node = child1;
                if (distance2 < nearestHit && stackLocation < 63u) {
                    stack[stackLocation] = child2;
                    stackLocation += 1u;
                }
            }
        } else {
            for (var i = 0u; i < primitiveCount; i++) {
                let lookupIndex = contents + i;
                if (lookupIndex >= arrayLength(&triangleIndices)) { continue; }
                let triIndex = u32(triangleIndices[lookupIndex]);
                if (triIndex >= arrayLength(&triangles)) { continue; }
                
                let hitResult = hit_triangle(ray, triangles[triIndex], tMin, nearestHit, i32(triIndex), fromInside);
                if (hitResult.hit && hitResult.distance < nearestHit) {
                    nearestHit = hitResult.distance;
                    closestHit = hitResult;
                }
            }
            if (stackLocation == 0u) { break; }
            stackLocation -= 1u;
            node = stack[stackLocation];
        }
    }
    return closestHit;
}

fn sampleGBuffer(pixelCoords: vec2<i32>) -> HitInfo {
    var hit: HitInfo;
    let position = textureLoad(gPosition, pixelCoords, 0);
    let normal = textureLoad(gNormal, pixelCoords, 0);
    let albedo = textureLoad(gAlbedo, pixelCoords, 0);
    
    hit.hit = position.w >= 0.0;
    hit.position = position.xyz;
    hit.normal = normalize(normal.xyz);
    hit.distance = 0.0;
    hit.triangleIndex = -1;
    hit.fromInside = false;
    
    if (hit.hit) {
        let matIndex = u32(position.w);
        if (matIndex < arrayLength(&materials)) {
            let mat = materials[matIndex];
            hit.albedo = clamp(mat.albedoColor, vec3<f32>(0.001), vec3<f32>(0.999));
            hit.emission = mat.emission * mat.emissionStrength;
            hit.roughness = clamp(mat.roughness, 0.001, 1.0);
            hit.specular = clamp(mat.specular, 0.0, 1.0);
            hit.ior = clamp(mat.ior, 1.0, 3.0);
            hit.transmission = clamp(mat.transmission, 0.0, 1.0);
        } else {
            hit.albedo = albedo.rgb;
            hit.emission = vec3<f32>(0.0);
            hit.roughness = 0.8;
            hit.specular = 0.5;
            hit.ior = 1.5;
            hit.transmission = 0.0;
        }
    }
    return hit;
}

fn schlick_fresnel(f0: f32, cosTheta: f32) -> f32 {
    return f0 + (1.0 - f0) * pow(1.0 - cosTheta, 5.0);
}

fn tracePath(seed: ptr<function, u32>, pixel: vec2<u32>, frame: u32, pixelCoords: vec2<i32>) -> vec3<f32> {
    var hit = sampleGBuffer(pixelCoords);
    let cameraPos = camera.viewInverse[3].xyz;
    var throughput = vec3<f32>(1.0);
    var radiance = vec3<f32>(0.0);
    var ray: Ray;

    if (!hit.hit) {
        let jitter = vec2<f32>(params.jitterX, params.jitterY);
        let uv = (vec2<f32>(pixelCoords) + 0.5 + jitter) / vec2<f32>(f32(params.width), f32(params.height));
        let ndc = uv * 2.0 - 1.0;
        let targetCoord = camera.projectionInverse * vec4<f32>(ndc.x, -ndc.y, 1.0, 1.0);
        let directionCam = normalize(targetCoord.xyz / targetCoord.w);
        let directionWorld = (camera.viewInverse * vec4<f32>(directionCam, 0.0)).xyz;
        return sampleSkybox(normalize(directionWorld));
    }

    radiance += hit.emission;
    // Use the dynamic bounce count from uniforms
    let maxBounces = params.maxBounces;
    let baseEpsilon = 0.001;

    for (var bounce = 0u; bounce < maxBounces; bounce++) {
        if (!hit.hit) {
            radiance += throughput * sampleSkybox(ray.direction);
            break;
        }
        
        var incomingDir: vec3<f32>;
        if (bounce == 0u) {
            incomingDir = normalize(hit.position - cameraPos);
        } else {
            incomingDir = ray.direction;
        }
        
        let entering = dot(incomingDir, hit.normal) < 0.0;
        let normal = select(-hit.normal, hit.normal, entering);
        let cosTheta = min(abs(dot(-incomingDir, normal)), 1.0);
        
        // Map specular directly to F0 (base reflectivity)
        // specular=0.0 -> F0=0.04 (4% like plastic/dielectric)
        // specular=1.0 -> F0=1.0 (100% perfect mirror)
        let F0 = mix(0.04, 1.0, hit.specular);
        let fresnel = schlick_fresnel(F0, cosTheta);
        
        var probSpecular = fresnel * (1.0 - hit.transmission);
        var probRefract = hit.transmission * (1.0 - fresnel);
        var probDiffuse = 1.0 - probSpecular - probRefract;
        
        let sum = probSpecular + probRefract + probDiffuse;
        if (sum > 0.0001) {
            probSpecular /= sum;
            probRefract /= sum;
            probDiffuse /= sum;
        } else {
            probDiffuse = 1.0;
        }
        
        if (bounce >= 3u) {
            let p = max(throughput.x, max(throughput.y, throughput.z));
            if (rand(seed) > p) { break; }
            throughput /= max(p, 0.001);
        }
        
        let roll = rand(seed);
        var newRayDir = vec3<f32>(0.0);
        var rayType = 0;
        
        if (roll < probSpecular) {
            rayType = 1;
            let perfectReflect = reflect(incomingDir, normal);
            let roughDir = normalize(normal + random_unit_vector_wn(seed));
            newRayDir = normalize(mix(perfectReflect, roughDir, hit.roughness * hit.roughness));
            throughput *= hit.albedo;
        } else if (roll < probSpecular + probRefract) {
            rayType = 2;
            let iorRatio = select(hit.ior, 1.0 / hit.ior, entering);
            let roughNormal = normalize(normal + random_unit_vector_wn(seed) * hit.roughness);
            var refractDir = refract(incomingDir, roughNormal, iorRatio);
            if (length(refractDir) < 0.1) { refractDir = reflect(incomingDir, normal); }
            newRayDir = normalize(refractDir);
            throughput *= vec3<f32>(1.0);
        } else {
            rayType = 0;
            let randDir = random_unit_vector_wn(seed);
            newRayDir = normalize(normal + randDir);
            throughput *= hit.albedo;
        }
        
        if (rayType != 2 && dot(newRayDir, normal) < 0.0) {
            newRayDir = -newRayDir;
        }

        if (!entering && rayType == 2) {
            let absorptionColor = vec3<f32>(1.0) - hit.albedo;
            throughput *= exp(-absorptionColor * hit.distance * 2.0);
        }
        
        ray.direction = newRayDir;
        let offsetScale = 1.0 + hit.distance * 0.1;
        if (rayType == 2 && dot(newRayDir, normal) < 0.0) {
            ray.origin = hit.position - normal * baseEpsilon * offsetScale;
        } else {
            ray.origin = hit.position + normal * baseEpsilon * offsetScale;
        }

        let isInside = (rayType == 2) && entering;
        hit = intersectBVH(ray, baseEpsilon, 1000.0, isInside);
        
        if (hit.hit) {
            radiance += throughput * hit.emission;
        }
    }
    
    return min(radiance, vec3<f32>(100.0));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
    if (gid.x >= params.width || gid.y >= params.height) { return; }
    let pixelCoords = vec2<i32>(i32(gid.x), i32(gid.y));
    let pixelIndex = gid.y * params.width + gid.x;
    var color: vec3<f32>;
    
    switch (params.debugMode) {
        case 1u: { let hit = sampleGBuffer(pixelCoords); color = hit.position * 0.5 + 0.5; }
        case 2u: { let hit = sampleGBuffer(pixelCoords); color = hit.normal * 0.5 + 0.5; }
        case 3u: { let hit = sampleGBuffer(pixelCoords); color = hit.albedo; }
        default: { 
            var seed = init_rng(vec2<u32>(gid.x, gid.y), params.frameCount);
            let newSample = tracePath(&seed, vec2<u32>(gid.x, gid.y), params.frameCount, pixelCoords);
            
            if (params.frameCount == 1u) {
                accumulationBuffer[pixelIndex] = vec4<f32>(newSample, 1.0);
            } else {
                let accumulated = accumulationBuffer[pixelIndex].rgb;
                let weight = 1.0 / f32(params.frameCount);
                color = mix(accumulated, newSample, weight);
                accumulationBuffer[pixelIndex] = vec4<f32>(color, 1.0);
            }
            color = accumulationBuffer[pixelIndex].rgb;
        }
    }
    textureStore(outTex, vec2<i32>(gid.xy), vec4<f32>(color, 1.0));
}