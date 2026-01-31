import { Renderer } from "../view/renderer";
import { Scene } from "../model/scene";
import { Material, AlbedoType, MaterialType } from "../view/material";
import $ from "jquery";

export class App {
    canvas: HTMLCanvasElement;
    renderer: Renderer;
    scene: Scene;

    keyLabel: HTMLElement | null = null;
    mouseXLabel: HTMLElement | null = null;
    mouseYLabel: HTMLElement | null = null;

    // Movement Settings
    private baseSpeed: number = 0.05;
    private sprintMultiplier: number = 3.0;
    private mouseSensitivity: number = 0.15;
    
    // Input State
    private keysPressed: { [code: string]: boolean } = {};
    private isLocked: boolean = false;
    
    // UI State
    currentObject: string = 'statue';
    materialUpdateInProgress: boolean = false;
    
    private lastFrameTime: number = performance.now();
    private frameCount: number = 0;
    private fpsUpdateInterval: number = 500; 
    private lastFpsUpdate: number = performance.now();
    private currentFps: number = 0;
    
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas);
        this.scene = new Scene();
        this.renderer.setScene(this.scene);

        // Initialize Input State
        this.keysPressed = {};

        // Bind Inputs
        $(document).on("keydown", (event) => this.handle_keypress(event));
        $(document).on("keyup", (event) => this.handle_keyrelease(event));
        
        // Pointer Lock Setup
        this.canvas.onclick = () => {
            if (!this.isLocked) {
                this.canvas.requestPointerLock();
            }
        }
        
        // Monitor Pointer Lock State changes
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === this.canvas;
            this.updateCursorStyle();
        });

        this.canvas.addEventListener("mousemove", (event: MouseEvent) => {
            this.handle_mouse_move(event);
        });
        
        this.setupEnhancedUI();
        this.updateCursorStyle();
    }

    updateCursorStyle() {
        if (this.isLocked) {
            this.canvas.style.cursor = 'none';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    setupEnhancedUI() {
        const style = document.createElement('style');
        style.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
            
            body, html { 
                margin: 0; padding: 0; width: 100vw; height: 100vh; 
                overflow: hidden; background: linear-gradient(135deg, #0a0a12 0%, #12121e 100%);
                font-family: 'Inter', sans-serif; color: white;
            }

            .main-layout {
                display: flex;
                width: 100vw;
                height: 100vh;
                padding: 32px;
                box-sizing: border-box;
                gap: 24px;
            }

            .canvas-section {
                flex: 1; 
                display: flex;
                flex-direction: column;
                gap: 20px;
            }

            .header-container {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }

            .main-title {
                color: #fff;
                font-size: 32px;
                font-weight: 800;
                line-height: 1.1;
                letter-spacing: -0.5px;
            }

            .title-accent {
                background: linear-gradient(135deg, #ff40a0 0%, #ff6b9d 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .canvas-centering-box {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(0,0,0,0.3);
                border-radius: 16px;
                border: 1px solid rgba(255,255,255,0.06);
                position: relative;
                overflow: hidden;
            }

            .canvas-centering-box::before {
                content: '';
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: radial-gradient(circle at 50% 50%, rgba(255, 64, 160, 0.08) 0%, transparent 70%);
                pointer-events: none;
            }

            #canvas-target {
                width: 800px; 
                height: 600px;
                background: #000;
                border: 2px solid rgba(255, 64, 160, 0.2);
                box-shadow: 0 30px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255, 64, 160, 0.15);
                border-radius: 8px;
                overflow: hidden;
                position: relative;
                z-index: 1;
            }

            .sidebar-section {
                width: 540px;
                display: flex;
                gap: 20px;
                flex-shrink: 0;
            }

            .sidebar-column {
                display: flex;
                flex-direction: column;
                gap: 20px;
                flex: 1;
                min-height: 0;
            }

            .panel {
                background: rgba(18, 18, 30, 0.9);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 16px;
                padding: 24px;
                display: flex;
                flex-direction: column;
                backdrop-filter: blur(20px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                transition: border-color 0.3s ease;
                min-height: 0;
            }

            .panel:hover {
                border-color: rgba(255, 64, 160, 0.15);
            }

            .panel-title {
                color: #fff;
                font-size: 12px;
                font-weight: 700;
                margin-bottom: 20px;
                text-transform: uppercase;
                letter-spacing: 1.2px;
                display: flex;
                align-items: center;
                gap: 8px;
                flex-shrink: 0;
            }

            .panel-title::before {
                content: '';
                width: 3px;
                height: 14px;
                background: linear-gradient(180deg, #ff40a0 0%, #ff6b9d 100%);
                border-radius: 2px;
            }

            .full-height { flex: 1; overflow: hidden; }
            
            /* FIXED: Changed to flex column to allow internal scrolling without cut-off */
            .half-height { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

            .scroll-content {
                flex: 1;
                overflow-y: auto;
                padding-right: 8px;
            }

            .custom-select { 
                width: 100%; 
                padding: 12px 14px; 
                background: rgba(10, 10, 20, 0.8); 
                border: 1px solid rgba(255, 255, 255, 0.1); 
                color: #eee; 
                border-radius: 8px; 
                margin-bottom: 16px; 
                font-size: 12px; 
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23ff40a0' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 14px center;
                padding-right: 40px;
            }

            .custom-select:hover {
                border-color: rgba(255, 64, 160, 0.3);
                background: rgba(15, 15, 25, 0.9);
            }

            .custom-select:focus {
                outline: none;
                border-color: #ff40a0;
                box-shadow: 0 0 0 3px rgba(255, 64, 160, 0.1);
            }

            .preset-button { 
                width: 100%; 
                padding: 12px; 
                background: rgba(20, 20, 35, 0.6); 
                border: 1px solid rgba(255, 255, 255, 0.1); 
                color: #ddd; 
                border-radius: 8px; 
                font-size: 11px; 
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .preset-button:hover { 
                background: linear-gradient(135deg, #ff40a0 0%, #ff6b9d 100%); 
                color: white; 
                border-color: transparent;
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(255, 64, 160, 0.3);
            }

            .preset-button:active {
                transform: translateY(0);
            }

            .reset-button {
                background: rgba(30, 30, 45, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }

            .reset-button:hover {
                background: rgba(50, 50, 70, 0.8);
                border-color: rgba(255, 255, 255, 0.15);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(255, 255, 255, 0.1);
            }

            .skybox-toggle {
                background: rgba(20, 20, 35, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #ddd;
                width: 100%;
                padding: 12px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-top: 12px;
                margin-bottom: 12px;
            }

            .skybox-toggle:hover {
                background: rgba(40, 40, 55, 0.8);
                border-color: rgba(255, 255, 255, 0.2);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(255, 255, 255, 0.15);
            }

            .skybox-toggle:active {
                transform: translateY(0);
            }
            
            .stat-row { 
                display: flex; 
                justify-content: space-between; 
                font-size: 12px; 
                margin-bottom: 10px; 
                font-family: 'JetBrains Mono', monospace;
                padding: 8px 12px;
                background: rgba(10, 10, 20, 0.4);
                border-radius: 6px;
                border-left: 2px solid rgba(255, 64, 160, 0.3);
            }

            .stat-label { 
                color: #999; 
                font-weight: 500;
            }

            .stat-value { 
                color: #ff40a0; 
                font-weight: 600;
            }

            .log-box {
                flex: 1; 
                font-family: 'JetBrains Mono', monospace; 
                font-size: 10px;
                color: #888; 
                overflow-y: auto; 
                line-height: 1.7;
                background: rgba(0, 0, 0, 0.3);
                padding: 12px;
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }

            .log-box .log-time {
                color: #ff40a0;
                font-weight: 600;
            }

            .log-box .log-ok {
                color: #4ade80;
            }

            .slider-group { 
                margin-bottom: 18px; 
            }

            .slider-header { 
                display: flex; 
                justify-content: space-between; 
                font-size: 11px; 
                margin-bottom: 8px; 
                color: #bbb;
                font-weight: 500;
            }

            .slider-value {
                color: #ff40a0;
                font-family: 'JetBrains Mono', monospace;
                font-weight: 600;
            }

            input[type=range] { 
                width: 100%; 
                height: 6px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 3px;
                outline: none;
                cursor: pointer;
                -webkit-appearance: none;
            }

            input[type=range]::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 16px;
                height: 16px;
                background: linear-gradient(135deg, #ff40a0 0%, #ff6b9d 100%);
                border-radius: 50%;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(255, 64, 160, 0.4);
                transition: transform 0.2s ease;
            }

            input[type=range]::-webkit-slider-thumb:hover {
                transform: scale(1.2);
            }

            input[type=range]::-moz-range-thumb {
                width: 16px;
                height: 16px;
                background: linear-gradient(135deg, #ff40a0 0%, #ff6b9d 100%);
                border-radius: 50%;
                cursor: pointer;
                border: none;
                box-shadow: 0 2px 8px rgba(255, 64, 160, 0.4);
            }

            .color-picker-group {
                display: flex; 
                align-items: center; 
                justify-content: space-between; 
                margin-bottom: 18px;
                padding: 12px;
                background: rgba(10, 10, 20, 0.4);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.06);
            }

            .color-picker-label {
                font-size: 11px;
                color: #bbb;
                font-weight: 500;
            }

            .custom-color-input {
                -webkit-appearance: none; 
                border: 2px solid rgba(255, 255, 255, 0.15); 
                width: 70px; 
                height: 36px; 
                background: none; 
                cursor: pointer; 
                border-radius: 8px; 
                padding: 0;
                transition: all 0.3s ease;
            }

            .custom-color-input:hover {
                border-color: #ff40a0;
                box-shadow: 0 0 0 3px rgba(255, 64, 160, 0.1);
            }

            .custom-color-input::-webkit-color-swatch { 
                border-radius: 6px; 
                border: none; 
            }

            .preset-grid { 
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                gap: 10px; 
                margin-bottom: 20px; 
            }

            .section-divider {
                height: 1px;
                background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
                margin: 20px 0;
            }
            
            .subtitle {
                font-size: 10px;
                color: #999;
                margin-bottom: 14px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 3px; }
            ::-webkit-scrollbar-thumb { background: rgba(255, 64, 160, 0.4); border-radius: 3px; }
            ::-webkit-scrollbar-thumb:hover { background: rgba(255, 64, 160, 0.6); }
        `;
        document.head.appendChild(style);

        document.body.innerHTML = ''; 
        const mainLayout = document.createElement('div');
        mainLayout.className = 'main-layout';
        document.body.appendChild(mainLayout);

        // --- LEFT SECTION ---
        const leftCol = document.createElement('div');
        leftCol.className = 'canvas-section';
        leftCol.innerHTML = `
            <div class="header-container">
                <div class="main-title">
                    <span class="title-accent">Hybrid</span><br>Path Tracer
                </div>
            </div>
            <div class="canvas-centering-box">
                <div id="canvas-target"></div>
            </div>
        `;
        mainLayout.appendChild(leftCol);
        
        const target = document.getElementById('canvas-target')!;
        target.appendChild(this.canvas);
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.canvas.style.width = '800px';
        this.canvas.style.height = '600px';

        // --- RIGHT SECTION ---
        const sideSection = document.createElement('div');
        sideSection.className = 'sidebar-section';
        mainLayout.appendChild(sideSection);

        const col1 = document.createElement('div');
        col1.className = 'sidebar-column';
        sideSection.appendChild(col1);
        this.buildMaterialPanel(col1);

        const col2 = document.createElement('div');
        col2.className = 'sidebar-column';
        sideSection.appendChild(col2);

        // FIXED: Added container for scrollable content
        const statsPanel = document.createElement('div');
        statsPanel.className = 'panel half-height';
        statsPanel.innerHTML = `
            <div class="panel-title">Visualization</div>
            <div class="scroll-content">
                <div id="settings-mount"></div>
                <div class="section-divider"></div>
                <div style="margin-top: 8px" id="stats-mount"></div>
            </div>
        `;
        col2.appendChild(statsPanel);

        const logsPanel = document.createElement('div');
        logsPanel.className = 'panel half-height';
        logsPanel.innerHTML = `
            <div class="panel-title">System Log</div>
            <div class="log-box">
                <span class="log-time">[00:01]</span> Engine Start...<br>
                <span class="log-time">[00:01]</span> WebGPU Context: <span class="log-ok">OK</span><br>
                <span class="log-time">[00:02]</span> BVH Structure Built<br>
                <span class="log-time">[00:02]</span> Ready for Path Tracing.
                <span class="log-time">[INFO]</span> Click canvas to control camera.
            </div>
        `;
        col2.appendChild(logsPanel);

        this.mountLogicElements();
    }

    buildMaterialPanel(parent: HTMLElement) {
        const panel = document.createElement('div');
        panel.className = 'panel full-height';
        panel.innerHTML = `<div class="panel-title">Materials</div>`;
        
        const scroll = document.createElement('div');
        scroll.className = 'scroll-content';
        panel.appendChild(scroll);

        // --- MODEL SELECTOR ---
        const modelSubtitle = document.createElement('div');
        modelSubtitle.className = 'subtitle';
        modelSubtitle.textContent = 'Active Geometry';
        scroll.appendChild(modelSubtitle);

        const modelSelect = document.createElement('select');
        modelSelect.className = 'custom-select';
        [
            { value: 'bunny', label: 'Model: Stanford Bunny' },
            { value: 'dragon', label: 'Model: Stanford Dragon' },
            { value: 'sphere', label: 'Model: Perfect Sphere' }
        ].forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.value;
            opt.textContent = m.label;
            modelSelect.appendChild(opt);
        });
        modelSelect.onchange = (e) => {
            const val = (e.target as HTMLSelectElement).value;
            this.renderer.setStatueModel(val);
            this.scene.set_statue_type(val);
        };
        scroll.appendChild(modelSelect);

        // --- OBJECT SELECTOR ---
        const objSubtitle = document.createElement('div');
        objSubtitle.className = 'subtitle';
        objSubtitle.textContent = 'Edit Object';
        scroll.appendChild(objSubtitle);

        const select = document.createElement('select');
        select.className = 'custom-select';
        [
            { value: 'statue', label: 'Object: Centerpiece' },
            { value: 'floor', label: 'Object: Floor' },
            { value: 'ceiling', label: 'Object: Ceiling' },
            { value: 'left', label: 'Object: Left Wall' },
            { value: 'right', label: 'Object: Right Wall' },
            { value: 'back', label: 'Object: Back Wall' },
            { value: 'light', label: 'Object: Light Source' }
        ].forEach(obj => {
            const opt = document.createElement('option');
            opt.value = obj.value; 
            opt.textContent = obj.label;
            select.appendChild(opt);
        });
        select.onchange = (e) => this.currentObject = (e.target as HTMLSelectElement).value;
        scroll.appendChild(select);

        const presetTitle = document.createElement('div');
        presetTitle.className = 'subtitle';
        presetTitle.textContent = 'Material Presets';
        scroll.appendChild(presetTitle);

        const grid = document.createElement('div');
        grid.className = 'preset-grid';
        [
            { preset: 'white', label: 'White' },
            { preset: 'gold', label: 'Gold' },
            { preset: 'silver', label: 'Silver' },
            { preset: 'chrome', label: 'Chrome' },
            { preset: 'glass', label: 'Glass' },
            { preset: 'diamond', label: 'Diamond' }
        ].forEach(p => {
            const btn = document.createElement('button');
            btn.className = 'preset-button';
            btn.textContent = p.label;
            btn.onclick = () => this.applyMaterialPreset(p.preset);
            grid.appendChild(btn);
        });
        scroll.appendChild(grid);

        const divider = document.createElement('div');
        divider.className = 'section-divider';
        scroll.appendChild(divider);

        // === SCENE SETTINGS (LIGHT) ===
        const lightTitle = document.createElement('div');
        lightTitle.className = 'subtitle';
        lightTitle.textContent = 'Scene Settings';
        scroll.appendChild(lightTitle);

        scroll.appendChild(this.createSlider('light-intensity', 'Light Strength', 0, 50, 1, 25.0, true, true));

        const lightDivider = document.createElement('div');
        lightDivider.className = 'section-divider';
        scroll.appendChild(lightDivider);

        // === CUSTOM MATERIAL SECTION ===
        const customTitle = document.createElement('div');
        customTitle.className = 'subtitle';
        customTitle.textContent = 'Custom Properties';
        scroll.appendChild(customTitle);

        const resetBtn = document.createElement('button');
        resetBtn.className = 'preset-button reset-button';
        resetBtn.style.marginBottom = '16px';
        resetBtn.textContent = 'Reset to White';
        resetBtn.onclick = () => this.resetToWhite();
        scroll.appendChild(resetBtn);

        const colorGroup = document.createElement('div');
        colorGroup.className = 'color-picker-group';
        colorGroup.innerHTML = `
            <span class="color-picker-label">Base Color</span>
            <input type="color" id="albedo-color" class="custom-color-input" value="#bababa">
        `;
        scroll.appendChild(colorGroup);

        const colorInput = colorGroup.querySelector('#albedo-color') as HTMLInputElement;
        colorInput.addEventListener('input', () => this.applyCustomMaterial());

        scroll.appendChild(this.createSlider('roughness', 'Roughness', 0, 1, 0.01, 0.5, true, false));
        scroll.appendChild(this.createSlider('specular', 'Specular', 0, 1, 0.01, 0.5, true, false));
        scroll.appendChild(this.createSlider('transmission', 'Transparency', 0, 1, 0.01, 0.0, true, false));
        scroll.appendChild(this.createSlider('ior', 'IOR', 1, 2.5, 0.01, 1.5, true, false));
        scroll.appendChild(this.createSlider('emission', 'Emission', 0, 20, 0.1, 0.0, true, false));

        parent.appendChild(panel);
    }

    mountLogicElements() {
        const settingsMount = document.getElementById('settings-mount')!;
        const statsMount = document.getElementById('stats-mount')!;

        const debugModeSelect = document.createElement('select');
        debugModeSelect.className = 'custom-select';
        [
            { value: 'raytraced', label: 'View: Path Traced' },
            { value: 'position', label: 'Buffer: Position' },
            { value: 'normal', label: 'Buffer: Normal' },
            { value: 'albedo', label: 'Buffer: Albedo' }
        ].forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.value; opt.textContent = m.label;
            debugModeSelect.appendChild(opt);
        });
        debugModeSelect.addEventListener('change', (e) => {
            this.renderer.setDebugMode((e.target as HTMLSelectElement).value as any);
        });
        settingsMount.appendChild(debugModeSelect);

        // === BOUNCE SLIDER ===
        // Added max bounces slider
        const bouncesContainer = document.createElement('div');
        bouncesContainer.className = 'slider-group';
        bouncesContainer.innerHTML = `
            <div class="slider-header">
                <span>Max Bounces</span>
                <span class="slider-value" id="bounces-value">4</span>
            </div>
            <input type="range" id="bounces-slider" min="0" max="16" step="1" value="4">
        `;
        const bouncesInput = bouncesContainer.querySelector('input')!;
        bouncesInput.oninput = (e) => {
            const val = parseInt((e.target as HTMLInputElement).value);
            document.getElementById('bounces-value')!.textContent = val.toString();
            this.renderer.setMaxBounces(val);
        };
        settingsMount.appendChild(bouncesContainer);

        // === SKYBOX TOGGLE BUTTON ===
        const skyboxToggle = document.createElement('button');
        skyboxToggle.id = 'skybox-toggle';
        skyboxToggle.className = 'skybox-toggle';
        skyboxToggle.textContent = 'Skybox: B&W';
        skyboxToggle.addEventListener('click', async () => {
            const currentMode = this.renderer.getSkyboxMode();
            const newMode = currentMode === 'bw' ? 'colored' : 'bw';
            
            await this.renderer.setSkyboxMode(newMode === 'colored');
            skyboxToggle.textContent = `Skybox: ${newMode === 'colored' ? 'Color' : 'B&W'}`;
        });
        settingsMount.appendChild(skyboxToggle);

        const statsTitle = document.createElement('div');
        statsTitle.className = 'subtitle';
        statsTitle.style.marginTop = '12px';
        statsTitle.textContent = 'Statistics';
        statsMount.appendChild(statsTitle);

        const createRow = (label: string, id: string) => {
            const r = document.createElement('div');
            r.className = 'stat-row';
            r.innerHTML = `<span class="stat-label">${label}</span><span class="stat-value" id="${id}">0</span>`;
            return r;
        }
        
        statsMount.appendChild(createRow('Samples', 'sample-counter-value'));
        statsMount.appendChild(createRow('FPS', 'fps-display'));
        statsMount.appendChild(createRow('Input', 'key-display'));
        statsMount.appendChild(createRow('Mouse X', 'mouse-x-display'));
        statsMount.appendChild(createRow('Mouse Y', 'mouse-y-display'));

        this.keyLabel = document.getElementById("key-display");
        this.mouseXLabel = document.getElementById("mouse-x-display");
        this.mouseYLabel = document.getElementById("mouse-y-display");
    }

    createSlider(id: string, label: string, min: number, max: number, step: number, val: number, liveUpdate: boolean = false, isLightSlider: boolean = false): HTMLElement {
        const container = document.createElement('div');
        container.className = 'slider-group';
        
        let displayValue = val.toFixed(2);
        if (isLightSlider || step === 1) {
            displayValue = val.toFixed(0);
        }
        
        container.innerHTML = `
            <div class="slider-header">
                <span>${label}</span>
                <span class="slider-value" id="${id}-value">${displayValue}</span>
            </div>
            <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">
        `;
        
        const input = container.querySelector('input')!;
        input.oninput = (e) => {
            const v = (e.target as HTMLInputElement).value;
            const numVal = parseFloat(v);
            
            if (isLightSlider || step === 1) {
                document.getElementById(`${id}-value`)!.textContent = numVal.toFixed(0);
                if (isLightSlider) this.updateLightIntensity();
            } else {
                document.getElementById(`${id}-value`)!.textContent = numVal.toFixed(2);
                if (liveUpdate) this.applyCustomMaterial();
            }
        };
        
        return container;
    }

    async resetToWhite() {
        if (this.materialUpdateInProgress) return;
        this.materialUpdateInProgress = true;
        
        try {
            (document.getElementById('albedo-color') as HTMLInputElement).value = '#bababa';
            (document.getElementById('roughness') as HTMLInputElement).value = '0.5';
            (document.getElementById('specular') as HTMLInputElement).value = '0.0';
            (document.getElementById('transmission') as HTMLInputElement).value = '0.0';
            (document.getElementById('ior') as HTMLInputElement).value = '1.5';
            (document.getElementById('emission') as HTMLInputElement).value = '0.0';
            
            document.getElementById('roughness-value')!.textContent = '0.50';
            document.getElementById('specular-value')!.textContent = '0.00';
            document.getElementById('transmission-value')!.textContent = '0.00';
            document.getElementById('ior-value')!.textContent = '1.50';
            document.getElementById('emission-value')!.textContent = '0.0';
            
            await this.renderer.updateObjectMaterial(this.currentObject, 'white', false);
        } catch(e) { 
            console.error(e); 
        } finally { 
            this.materialUpdateInProgress = false; 
        }
    }

    async applyMaterialPreset(presetName: string) {
        if (this.materialUpdateInProgress) return;
        this.materialUpdateInProgress = true;
        try { 
            await this.renderer.updateObjectMaterial(this.currentObject, presetName, false); 
        } catch(e) { 
            console.error(e); 
        } finally { 
            this.materialUpdateInProgress = false; 
        }
    }

    async applyCustomMaterial() {
        if (this.materialUpdateInProgress) return;
        this.materialUpdateInProgress = true;
        
        const hex = (document.getElementById('albedo-color') as HTMLInputElement).value;
        const r = parseInt(hex.slice(1,3), 16) / 255;
        const g = parseInt(hex.slice(3,5), 16) / 255;
        const b = parseInt(hex.slice(5,7), 16) / 255;

        const getVal = (id: string) => parseFloat((document.getElementById(id) as HTMLInputElement).value);
        
        const roughness = getVal('roughness');
        const specular = getVal('specular');
        const transmission = getVal('transmission');
        const ior = getVal('ior');
        const emission = getVal('emission');
        
        try {
            await this.renderer.applyCustomMaterialToObject(this.currentObject, {
                color: [r, g, b],
                roughness: roughness,
                specular: specular,
                ior: ior,
                transmission: transmission,
                emission: emission
            });
        } catch(e) { 
            console.error(e); 
        } finally { 
            this.materialUpdateInProgress = false; 
        }
    }

    async updateLightIntensity() {
        if (this.materialUpdateInProgress) return;
        this.materialUpdateInProgress = true;
        
        try {
            const intensity = parseFloat((document.getElementById('light-intensity') as HTMLInputElement).value);
            
            const newLightMaterial = new Material({
                albedoType: AlbedoType.CONSTANT,
                albedoColor: [0, 0, 0],
                materialType: MaterialType.EMISSIVE,
                roughness: 1.0,
                specular: 0.0,
                ior: 1.0,
                transmission: 0.0,
                emission: [1.0, 1.0, 1.0],
                emissionStrength: intensity,
                clearcoat: 0.0,
                clearcoatRoughness: 0.0
            });
            await newLightMaterial.initializeConstant(this.renderer.device, this.renderer.materialGroupLayout);
            
            this.renderer.materialManager.addMaterial('light', newLightMaterial);
            this.renderer.materialBuffer = this.renderer.materialManager.createGPUBuffer(this.renderer.device);
            await this.renderer.makeBindGroup();
            this.renderer.resetAccumulation();
            
        } catch(e) { 
            console.error("Error updating light:", e); 
        } finally { 
            this.materialUpdateInProgress = false; 
        }
    }

    async InitializeRenderer() {
        await this.renderer.Initialize();
    }

    run = () => {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        this.frameCount++;
        
        if (currentTime - this.lastFpsUpdate >= this.fpsUpdateInterval) {
            this.currentFps = Math.round((this.frameCount * 1000) / (currentTime - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
            
            const fpsDisplay = document.getElementById('fps-display');
            if (fpsDisplay) {
                fpsDisplay.textContent = this.currentFps.toString();
            }
        }
        
        this.processMovement();
        this.scene.update();
        this.renderer.render(this.scene.get_renderables());
        
        const sc = document.getElementById('sample-counter-value');
        if (sc) sc.textContent = this.renderer.frameCount.toString();
        
        requestAnimationFrame(this.run);
    }

    processMovement() {
        let forward = 0;
        let right = 0;

        const isSprint = this.keysPressed["ShiftLeft"] || this.keysPressed["ShiftRight"];
        const currentSpeed = this.baseSpeed * (isSprint ? this.sprintMultiplier : 1.0);

        if (this.keysPressed["KeyW"]) forward += currentSpeed;
        if (this.keysPressed["KeyS"]) forward -= currentSpeed;
        if (this.keysPressed["KeyD"]) right += currentSpeed;
        if (this.keysPressed["KeyA"]) right -= currentSpeed;

        if (forward !== 0 || right !== 0) {
            this.scene.move_player(forward, right);
        }
    }

    handle_keypress(event: JQuery.KeyDownEvent) {
        this.keysPressed[event.code] = true;
        if(this.keyLabel) this.keyLabel.innerText = event.code.replace('Key', '');
    }

    handle_keyrelease(event: JQuery.KeyUpEvent) {
        this.keysPressed[event.code] = false;
        
        const anyPressed = Object.values(this.keysPressed).some(k => k);
        if(!anyPressed && this.keyLabel) this.keyLabel.innerText = "None";
    }

    handle_mouse_move(event: MouseEvent) {
        if (!this.isLocked) {
            if(this.mouseXLabel) this.mouseXLabel.innerText = "Unlocked";
            if(this.mouseYLabel) this.mouseYLabel.innerText = "Unlocked";
            return;
        }

        if(this.mouseXLabel) this.mouseXLabel.innerText = Math.floor(event.clientX).toString();
        if(this.mouseYLabel) this.mouseYLabel.innerText = Math.floor(event.clientY).toString();
        
        this.scene.spin_player(
            event.movementX * this.mouseSensitivity, 
            event.movementY * this.mouseSensitivity
        );
    }
}