export enum AlbedoType { CONSTANT = 0, TEXTURE = 1 }
export enum MaterialType { DIFFUSE = 0, DIELECTRIC = 1, EMISSIVE = 2 }

export interface MaterialProperties {
    albedoType?: AlbedoType;
    albedoColor?: [number, number, number];
    materialType?: MaterialType;
    roughness?: number;
    specular?: number;
    ior?: number;
    transmission?: number;
    emission?: [number, number, number];
    emissionStrength?: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
}

export class Material {
    texture: GPUTexture | null = null;
    view: GPUTextureView | null = null;
    sampler: GPUSampler | null = null;
    bindGroup: GPUBindGroup | null = null;
    properties: Required<MaterialProperties>;

    constructor(props?: MaterialProperties) {
        this.properties = {
            albedoType: AlbedoType.CONSTANT,
            albedoColor: [0.8, 0.8, 0.8],
            materialType: MaterialType.DIFFUSE,
            roughness: 0.8,
            specular: 0.5,
            ior: 1.5,
            transmission: 0.0,
            emission: [0, 0, 0],
            emissionStrength: 0.0,
            clearcoat: 0.0,
            clearcoatRoughness: 0.0,
            ...props
        };
    }

    async initializeConstant(device: GPUDevice, layout: GPUBindGroupLayout) {
        const [r, g, b] = this.properties.albedoColor;
        const imageData = new ImageData(new Uint8ClampedArray([r*255, g*255, b*255, 255]), 1, 1);
        const bitmap = await createImageBitmap(imageData);

        this.texture = device.createTexture({
            size: { width: 1, height: 1 },
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });

        device.queue.copyExternalImageToTexture({ source: bitmap }, { texture: this.texture }, { width: 1, height: 1 });

        this.view = this.texture.createView();
        this.sampler = device.createSampler({ magFilter: "nearest", minFilter: "nearest" });
        this.bindGroup = device.createBindGroup({
            layout,
            entries: [
                { binding: 0, resource: this.view },
                { binding: 1, resource: this.sampler }
            ]
        });
    }

    toGPUData(): Float32Array {
        const p = this.properties;
        return new Float32Array([
            ...p.albedoColor, p.albedoType,
            ...p.emission, p.emissionStrength,
            p.roughness, p.specular, p.ior, p.transmission,
            p.materialType, p.clearcoat, p.clearcoatRoughness, 0
        ]);
    }
}

export class MaterialManager {
    materials = new Map<string, Material>();
    materialBuffer: GPUBuffer | null = null;

    addMaterial(name: string, material: Material) { this.materials.set(name, material); }
    getMaterial(name: string) { return this.materials.get(name); }
    getMaterialIndex(name: string) {
        const idx = Array.from(this.materials.keys()).indexOf(name);
        return idx !== -1 ? idx : 0;
    }

    createGPUBuffer(device: GPUDevice): GPUBuffer {
        const count = Math.max(this.materials.size, 1);
        this.materialBuffer = device.createBuffer({
            size: count * 64,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        const data = new Float32Array(count * 16);
        Array.from(this.materials.values()).forEach((mat, i) => {
            data.set(mat.toGPUData(), i * 16);
        });
        device.queue.writeBuffer(this.materialBuffer, 0, data);
        return this.materialBuffer;
    }

    getMaterialNames() { return Array.from(this.materials.keys()); }
}