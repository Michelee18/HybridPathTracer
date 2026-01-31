import shader from "./shaders/shaders.wgsl";
import screen_shader from "./shaders/screenShader.wgsl";
import raytracer_kernel from "./shaders/raytracerKernel.wgsl";
import { TriangleMesh } from "./triangleMesh";
import { mat4, vec3 } from "gl-matrix";
import { Material, MaterialManager, AlbedoType, MaterialType } from "./material";
import { RenderData } from "../model/definitions";
import { QuadMesh } from "./quadMesh";
import { ObjMesh } from "./obj_mesh";
import { GBufferTexture } from "./gBufferTex";
import { BVHScene } from "../bvhScene";
import { BlueNoise } from "../blueNoise";
import { CubeMapMaterial } from "../../cubeMaterial";

export class Renderer {
    canvas: HTMLCanvasElement;
    device: GPUDevice;
    context: GPUCanvasContext;
    
    // Pipelines & Layouts
    gBufferPipeline: GPURenderPipeline;
    screen_pipeline: GPURenderPipeline;
    intermediateComputePipeline: GPUComputePipeline;
    frameBindGroup: GPUBindGroup;
    screen_bind_group: GPUBindGroup;
    computeBindGroup: GPUBindGroup;
    materialGroupLayout: GPUBindGroupLayout;

    // Buffers
    uniformBuffer: GPUBuffer;
    objectBuffer: GPUBuffer;
    instanceMaterialBuffer: GPUBuffer;
    materialBuffer: GPUBuffer;
    computeParamsBuffer: GPUBuffer;
    accumulationBuffer: GPUBuffer;
    triangleNodeBuffer: GPUBuffer;
    triangleBuffer: GPUBuffer;
    triangleIndexBuffer: GPUBuffer;

    // Textures
    depthStencilView: GPUTextureView;
    depthStencilAttachment: GPURenderPassDepthStencilAttachment;
    gPosition: GBufferTexture;
    gNormal: GBufferTexture;
    gAlbedo: GBufferTexture;
    intermediateView: GPUTextureView;
    
    // Meshes
    quadMesh: QuadMesh;
    meshBunny: ObjMesh;
    meshDragon: ObjMesh;
    meshSphere: ObjMesh;
    boxMesh: ObjMesh;
    lightMesh: ObjMesh;
    
    // Materials
    materialManager: MaterialManager;
    objectMaterialMap: Map<string, number> = new Map();
    
    // Scene
    triangleBVH: BVHScene;
    blueNoise: BlueNoise;
    skybox: CubeMapMaterial;
    skyboxColored: CubeMapMaterial;
    currentSkybox: CubeMapMaterial;
    
    // State
    frameCount: number = 0;
    debugMode: number = 0;
    maxBounces: number = 4;
    private lastCameraTransform: Float32Array | null = null;
    private lastTransforms: Float32Array = new Float32Array(16 * 7);
    private activeMatrices: mat4[] = Array.from({length: 7}, () => mat4.create());
    private bvhNeedsRebuild: boolean = true;
    
    // New Feature State
    currentStatueMesh: string = 'bunny'; // bunny, dragon, sphere

    constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }
    setScene(scene: any) { /* scene reference */ }

    async Initialize() {
        await this.setupDevice();
        await this.createAssets();
        await this.createBVHAssets();
        await this.makePipelines();
        await this.makeBindGroups();
    }

    async setupDevice() {
        const adapter = await navigator.gpu?.requestAdapter() as GPUAdapter;
        this.device = await adapter.requestDevice({
            requiredLimits: { maxColorAttachmentBytesPerSample: 64 }
        }) as GPUDevice;
        
        this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;
        this.context.configure({ device: this.device, format: "bgra8unorm", alphaMode: "opaque" });
    }

    async createAssets() {
        // Depth buffer
        const depthBuffer = this.device.createTexture({
            size: { width: this.canvas.width, height: this.canvas.height, depthOrArrayLayers: 1 },
            format: "depth24plus-stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.depthStencilView = depthBuffer.createView();
        this.depthStencilAttachment = {
            view: this.depthStencilView, depthClearValue: 1.0, depthLoadOp: "clear",
            depthStoreOp: "store", stencilLoadOp: "clear", stencilStoreOp: "discard"
        };

        // G-Buffer
        this.gPosition = new GBufferTexture(this.device, this.canvas.width, this.canvas.height, "rgba32float");
        this.gNormal = new GBufferTexture(this.device, this.canvas.width, this.canvas.height, "rgba32float");
        this.gAlbedo = new GBufferTexture(this.device, this.canvas.width, this.canvas.height, "rgba8unorm");

        // Intermediate & accumulation
        const intermediate = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height, 1],
            format: "rgba16float",
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING
        });
        this.intermediateView = intermediate.createView();
        
        this.accumulationBuffer = this.device.createBuffer({
            size: this.canvas.width * this.canvas.height * 16,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        // Uniform buffers
        this.uniformBuffer = this.device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.objectBuffer = this.device.createBuffer({ size: 64 * 1024, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        this.instanceMaterialBuffer = this.device.createBuffer({ size: 4096, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        this.computeParamsBuffer = this.device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

        // Load assets
        this.blueNoise = new BlueNoise();
        await this.blueNoise.loadBlueNoise(this.device, "dist/img/bluenoise.png");

        this.skybox = new CubeMapMaterial();
        await this.skybox.initialize(this.device, [
            "dist/img/sky_back_bw.png", "dist/img/sky_front_bw.png",
            "dist/img/sky_left_bw.png", "dist/img/sky_right_bw.png",
            "dist/img/sky_top_bw.png", "dist/img/sky_bottom_bw.png"
        ]);

        this.skyboxColored = new CubeMapMaterial();
        await this.skyboxColored.initialize(this.device, [
            "dist/img/sky_back.png", "dist/img/sky_front.png",
            "dist/img/sky_left.png", "dist/img/sky_right.png",
            "dist/img/sky_top.png", "dist/img/sky_bottom.png"
        ]);
        this.currentSkybox = this.skybox;

        // Meshes
        this.quadMesh = new QuadMesh(this.device);
        
        this.meshBunny = new ObjMesh();
        await this.meshBunny.initialize(this.device, "dist/models/bunny.obj");
        
        this.meshDragon = new ObjMesh();
        await this.meshDragon.initialize(this.device, "dist/models/dragon_low.obj");
        
        this.meshSphere = new ObjMesh();
        await this.meshSphere.initialize(this.device, "dist/models/ico.obj");
        
        this.boxMesh = new ObjMesh();
        await this.boxMesh.initialize(this.device, "dist/models/box.obj");
        this.lightMesh = new ObjMesh();
        await this.lightMesh.initialize(this.device, "dist/models/box.obj");

        // Materials
        await this.setupMaterials();
    }

    async setupMaterials() {
        this.materialManager = new MaterialManager();
        this.materialGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} }
            ]
        });

        const createMat = async (name: string, props: any) => {
            const mat = new Material(props);
            await mat.initializeConstant(this.device, this.materialGroupLayout);
            this.materialManager.addMaterial(name, mat);
        };

        await createMat('statue', { albedoColor: [0.8, 0.7, 0.4], roughness: 0.2, specular: 0.6 });
        await createMat('white', { albedoColor: [0.73, 0.73, 0.73], roughness: 1.0, specular: 0.0 });
        await createMat('red', { albedoColor: [0.65, 0.05, 0.05], roughness: 1.0, specular: 0.0 });
        await createMat('green', { albedoColor: [0.12, 0.45, 0.15], roughness: 1.0, specular: 0.0 });
        await createMat('light', { materialType: MaterialType.EMISSIVE, emission: [1, 1, 1], emissionStrength: 25.0 });
        await createMat('gold', { albedoColor: [1.0, 0.766, 0.336], roughness: 0.15, specular: 0.95 });
        await createMat('silver', { albedoColor: [0.972, 0.960, 0.915], roughness: 0.05, specular: 0.97 });
        await createMat('chrome', { albedoColor: [0.9, 0.9, 0.9], roughness: 0.0, specular: 1.0 });
        await createMat('glass', { materialType: MaterialType.DIELECTRIC, ior: 1.5, transmission: 1.0, roughness: 0.02 });
        await createMat('diamond', { materialType: MaterialType.DIELECTRIC, ior: 2.4, transmission: 1.0, roughness: 0.0 });

        ['statue', 'floor', 'ceiling', 'back', 'left', 'right', 'light'].forEach((name, i) => {
            this.objectMaterialMap.set(name, this.getMaterialIndex(
                i === 0 ? 'statue' : i === 4 ? 'red' : i === 5 ? 'green' : i === 6 ? 'light' : 'white'
            ));
        });

        this.materialBuffer = this.materialManager.createGPUBuffer(this.device);
    }

    async createBVHAssets() {
        this.triangleNodeBuffer = this.device.createBuffer({ size: 30 * 1024 * 1024, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        this.triangleBuffer = this.device.createBuffer({ size: 30 * 1024 * 1024, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        this.triangleIndexBuffer = this.device.createBuffer({ size: 10 * 1024 * 1024, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
        await this.buildSceneBVH();
    }

    async buildSceneBVH() {
        this.triangleBVH = new BVHScene();
        const addMesh = (mesh: ObjMesh, mat: mat4, id: number) => {
            if (!mesh || !mesh.vertices) return;
            const v = mesh.vertices, count = mesh.vertexCount;
            const transformed = new Float32Array(v.length);
            for (let i = 0; i < count; i++) {
                const pos = vec3.transformMat4(vec3.create(), vec3.fromValues(v[i*8], v[i*8+1], v[i*8+2]), mat);
                transformed.set([pos[0], pos[1], pos[2], v[i*8+3], v[i*8+4], v[i*8+5], v[i*8+6], v[i*8+7]], i*8);
            }
            this.triangleBVH.addTrianglesFromVertexBuffer(transformed, count, id);
        };

        // Determine which mesh to use for ID 0 based on current selection
        let statueMesh = this.meshBunny;
        if (this.currentStatueMesh === 'dragon') statueMesh = this.meshDragon;
        if (this.currentStatueMesh === 'sphere') statueMesh = this.meshSphere;

        if (statueMesh?.vertices) addMesh(statueMesh, this.activeMatrices[0], 0);
        if (this.boxMesh?.vertices) {
            for (let i = 1; i <= 5; i++) addMesh(this.boxMesh, this.activeMatrices[i], i);
        }
        if (this.lightMesh?.vertices) addMesh(this.lightMesh, this.activeMatrices[6], 6);

        this.triangleBVH.buildBVH();
        this.device.queue.writeBuffer(this.triangleNodeBuffer, 0, this.triangleBVH.getNodeData());
        this.device.queue.writeBuffer(this.triangleBuffer, 0, this.triangleBVH.getTriangleData());
        this.device.queue.writeBuffer(this.triangleIndexBuffer, 0, this.triangleBVH.getTriangleIndicesData());
    }

    async makePipelines() {
        const frameLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} },
                { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
                { binding: 2, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } }
            ]
        });

        const materialLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} }
            ]
        });

        const computeLayout = this.device.createBindGroupLayout({
            entries: Array.from({length: 17}, (_, i) => ({
                binding: i,
                visibility: GPUShaderStage.COMPUTE,
                ...(i < 2 ? { texture: { sampleType: "unfilterable-float" } } :
                    i === 2 || i === 10 ? { texture: { sampleType: "float" } } :
                    i === 3 || i === 14 ? { sampler: { type: "filtering" } } :
                    i === 4 ? { storageTexture: { access: "write-only", format: "rgba16float" } } :
                    i === 11 ? { sampler: { type: "non-filtering" } } :
                    i === 13 ? { texture: { viewDimension: "cube" } } :
                    i === 5 || i === 15 ? { buffer: { type: "uniform" } } :
                    i === 9 ? { buffer: { type: "storage" } } :
                    { buffer: { type: "read-only-storage" } })
            }))
        });

        this.gBufferPipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [frameLayout, materialLayout] }),
            vertex: {
                module: this.device.createShaderModule({ code: shader }),
                entryPoint: "vs_main",
                buffers: [new TriangleMesh(this.device).bufferLayout]
            },
            fragment: {
                module: this.device.createShaderModule({ code: shader }),
                entryPoint: "fs_gbuffer",
                targets: [{ format: 'rgba32float' }, { format: 'rgba32float' }, { format: 'rgba8unorm' }]
            },
            primitive: { topology: "triangle-list" },
            depthStencil: { format: "depth24plus-stencil8", depthWriteEnabled: true, depthCompare: "less-equal" }
        });

        const screenLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} }
            ]
        });

        this.screen_pipeline = this.device.createRenderPipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [screenLayout] }),
            vertex: { module: this.device.createShaderModule({ code: screen_shader }), entryPoint: 'vert_main' },
            fragment: {
                module: this.device.createShaderModule({ code: screen_shader }),
                entryPoint: 'frag_main',
                targets: [{ format: "bgra8unorm" }]
            },
            primitive: { topology: "triangle-list" }
        });

        this.intermediateComputePipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({ bindGroupLayouts: [computeLayout] }),
            compute: { module: this.device.createShaderModule({ code: raytracer_kernel }), entryPoint: 'main' }
        });
    }

    async makeBindGroups() {
        const linearSampler = this.device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });

        this.frameBindGroup = this.device.createBindGroup({
            layout: this.gBufferPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: { buffer: this.objectBuffer } },
                { binding: 2, resource: { buffer: this.instanceMaterialBuffer } }
            ]
        });

        this.screen_bind_group = this.device.createBindGroup({
            layout: this.screen_pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: linearSampler },
                { binding: 1, resource: this.intermediateView }
            ]
        });

        this.computeBindGroup = this.device.createBindGroup({
            layout: this.intermediateComputePipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: this.gPosition.view },
                { binding: 1, resource: this.gNormal.view },
                { binding: 2, resource: this.gAlbedo.view },
                { binding: 3, resource: linearSampler },
                { binding: 4, resource: this.intermediateView },
                { binding: 5, resource: { buffer: this.computeParamsBuffer } },
                { binding: 6, resource: { buffer: this.triangleNodeBuffer } },
                { binding: 7, resource: { buffer: this.triangleBuffer } },
                { binding: 8, resource: { buffer: this.triangleIndexBuffer } },
                { binding: 9, resource: { buffer: this.accumulationBuffer } },
                { binding: 10, resource: this.blueNoise.view },
                { binding: 11, resource: this.blueNoise.sampler },
                { binding: 12, resource: { buffer: this.materialBuffer } },
                { binding: 13, resource: this.currentSkybox.view },
                { binding: 14, resource: this.currentSkybox.sampler },
                { binding: 15, resource: { buffer: this.uniformBuffer } },
                { binding: 16, resource: { buffer: this.instanceMaterialBuffer } }
            ]
        });
    }

    setDebugMode(mode: 'raytraced' | 'position' | 'normal' | 'albedo') {
        this.debugMode = ['raytraced', 'position', 'normal', 'albedo'].indexOf(mode);
        this.resetAccumulation();
    }
    
    setStatueModel(modelName: string) {
        if (this.currentStatueMesh !== modelName) {
            this.currentStatueMesh = modelName;
            this.bvhNeedsRebuild = true;
            this.resetAccumulation();
        }
    }

    setMaxBounces(val: number) {
        this.maxBounces = val;
        this.resetAccumulation();
    }

    resetAccumulation() {
        this.frameCount = 0;
        this.device.queue.writeBuffer(this.accumulationBuffer, 0, new Float32Array(this.canvas.width * this.canvas.height * 4));
    }

    cameraChanged(viewTransform: Float32Array): boolean {
        if (!this.lastCameraTransform) {
            this.lastCameraTransform = new Float32Array(viewTransform);
            return true;
        }
        for (let i = 0; i < 16; i++) {
            if (Math.abs(viewTransform[i] - this.lastCameraTransform[i]) > 0.0001) {
                this.lastCameraTransform.set(viewTransform);
                return true;
            }
        }
        return false;
    }

    async setSkyboxMode(useColored: boolean) {
        this.currentSkybox = useColored ? this.skyboxColored : this.skybox;
        await this.makeBindGroups();
        this.resetAccumulation();
    }

    getSkyboxMode(): 'bw' | 'colored' {
        return this.currentSkybox === this.skyboxColored ? 'colored' : 'bw';
    }

    async render(renderables: RenderData) {
        if (!this.device || !this.gBufferPipeline) return;

        // FIXED: Only apply jitter if we are path tracing (debugMode === 0).
        // If we are debugging G-Buffers (pos/normal/albedo), we want a stable image.
        const isRaytracing = this.debugMode === 0;
        const jitterX = isRaytracing ? (Math.random() - 0.5) * 2.0 / this.canvas.width : 0;
        const jitterY = isRaytracing ? (Math.random() - 0.5) * 2.0 / this.canvas.height : 0;

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, 800 / 600, 0.1, 100.0);
        projection[8] += jitterX;
        projection[9] += jitterY;

        if (this.cameraChanged(renderables.view_transform as Float32Array)) this.resetAccumulation();

        let transformChanged = false;
        for (let i = 0; i < 112; i++) {
            if (Math.abs(renderables.model_transforms[i] - this.lastTransforms[i]) > 0.0001) {
                transformChanged = true;
                break;
            }
        }

        if (transformChanged || this.bvhNeedsRebuild) {
            this.lastTransforms.set(renderables.model_transforms.subarray(0, 112));
            for (let i = 0; i < 7; i++) {
                mat4.copy(this.activeMatrices[i], renderables.model_transforms.slice(i * 16, (i + 1) * 16) as unknown as mat4);
            }
            await this.buildSceneBVH();
            this.resetAccumulation();
            this.bvhNeedsRebuild = false;
        }

        this.device.queue.writeBuffer(this.objectBuffer, 0, renderables.model_transforms);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, renderables.view_transform as ArrayBuffer);
        this.device.queue.writeBuffer(this.uniformBuffer, 64, projection as Float32Array);
        
        const invView = mat4.invert(mat4.create(), renderables.view_transform as unknown as mat4);
        const invProj = mat4.invert(mat4.create(), projection);
        this.device.queue.writeBuffer(this.uniformBuffer, 128, invView as Float32Array);
        this.device.queue.writeBuffer(this.uniformBuffer, 192, invProj as Float32Array);

        const materialIndices = new Uint32Array(7);
        ['statue', 'floor', 'ceiling', 'back', 'left', 'right', 'light'].forEach((name, i) => {
            materialIndices[i] = this.objectMaterialMap.get(name)!;
        });
        this.device.queue.writeBuffer(this.instanceMaterialBuffer, 0, materialIndices);

        this.frameCount++;
        const params = new ArrayBuffer(32);
        // Params struct layout:
        // u32: width, height, debugMode, frameCount (indices 0,1,2,3)
        // f32: jitterX, jitterY (indices 4,5)
        // u32: maxBounces (index 6 - originally padding1)
        // f32: padding2 (index 7)
        
        new Uint32Array(params).set([this.canvas.width, this.canvas.height, this.debugMode, this.frameCount]);
        new Float32Array(params, 16).set([jitterX, jitterY]);
        new Uint32Array(params, 24).set([this.maxBounces]);
        
        this.device.queue.writeBuffer(this.computeParamsBuffer, 0, params);

        const encoder = this.device.createCommandEncoder();

        // G-Buffer pass
        const gbufferPass = encoder.beginRenderPass({
            colorAttachments: [
                { view: this.gPosition.view, loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: -1 } },
                { view: this.gNormal.view, loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 0 } },
                { view: this.gAlbedo.view, loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 1 } }
            ],
            depthStencilAttachment: this.depthStencilAttachment
        });

        gbufferPass.setPipeline(this.gBufferPipeline);
        gbufferPass.setBindGroup(0, this.frameBindGroup);

        const materials = [
            this.materialManager.getMaterial('statue'),
            this.materialManager.getMaterial('white'),
            this.materialManager.getMaterial('white'),
            this.materialManager.getMaterial('white'),
            this.materialManager.getMaterial('red'),
            this.materialManager.getMaterial('green'),
            this.materialManager.getMaterial('light')
        ];

        // Determine which mesh to draw for index 0
        let statueMesh = this.meshBunny;
        if (this.currentStatueMesh === 'dragon') statueMesh = this.meshDragon;
        if (this.currentStatueMesh === 'sphere') statueMesh = this.meshSphere;

        const meshes = [statueMesh, this.boxMesh, this.boxMesh, this.boxMesh, this.boxMesh, this.boxMesh, this.lightMesh];

        meshes.forEach((mesh, i) => {
            gbufferPass.setVertexBuffer(0, mesh.buffer);
            gbufferPass.setBindGroup(1, materials[i]!.bindGroup);
            gbufferPass.draw(mesh.vertexCount, 1, 0, i);
        });

        gbufferPass.end();

        // Compute pass
        const computePass = encoder.beginComputePass();
        computePass.setPipeline(this.intermediateComputePipeline);
        computePass.setBindGroup(0, this.computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.canvas.width / 8), Math.ceil(this.canvas.height / 8), 1);
        computePass.end();

        // Screen pass
        const presentPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: "clear",
                storeOp: "store",
                clearValue: { r: 0, g: 0, b: 0, a: 1 }
            }]
        });
        presentPass.setPipeline(this.screen_pipeline);
        presentPass.setBindGroup(0, this.screen_bind_group);
        presentPass.draw(6);
        presentPass.end();

        this.device.queue.submit([encoder.finish()]);
    }

    getMaterialIndex(name: string): number { return this.materialManager.getMaterialIndex(name); }

    async updateObjectMaterial(objectName: string, materialName: string, rebuildBVH: boolean = true) {
        if (!this.materialManager.getMaterial(materialName)) return;
        this.objectMaterialMap.set(objectName, this.getMaterialIndex(materialName));
        if (rebuildBVH) this.bvhNeedsRebuild = true;
        this.resetAccumulation();
    }

    async applyCustomMaterialToObject(objectName: string, props: any) {
        const customMat = new Material({
            albedoColor: props.color,
            materialType: props.transmission > 0.5 ? MaterialType.DIELECTRIC : props.emission > 0.1 ? MaterialType.EMISSIVE : MaterialType.DIFFUSE,
            roughness: props.roughness,
            specular: props.specular,
            ior: props.ior,
            transmission: props.transmission,
            emission: props.emission > 0 ? props.color : [0, 0, 0],
            emissionStrength: props.emission
        });

        await customMat.initializeConstant(this.device, this.materialGroupLayout);
        this.materialManager.addMaterial(`custom_${objectName}_${Date.now()}`, customMat);
        this.materialBuffer = this.materialManager.createGPUBuffer(this.device);
        await this.makeBindGroups();
        await this.updateObjectMaterial(objectName, `custom_${objectName}_${Date.now()}`, false);
    }

    getAvailableMaterials(): string[] { return this.materialManager.getMaterialNames(); }
    getCurrentMaterialName(objectName: string): string | null {
        const index = this.objectMaterialMap.get(objectName);
        if (index === undefined) return null;
        for (const name of this.materialManager.getMaterialNames()) {
            if (this.getMaterialIndex(name) === index) return name;
        }
        return null;
    }
    getMaterialProperties(objectName: string): any {
        const name = this.getCurrentMaterialName(objectName);
        return name ? this.materialManager.getMaterial(name)?.properties : null;
    }
    
    // Alias for backwards compatibility
    async makeBindGroup() { return this.makeBindGroups(); }
}