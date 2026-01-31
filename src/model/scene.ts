import { vec3 } from "gl-matrix";
import { Camera } from "./camera";
import { object_types, RenderData} from "./definitions";
import { Statue } from "./model";

export class Scene {

    statues: Statue[]; 
    player: Camera;
    object_data: Float32Array;

    constructor() {
        this.statues = [];
        this.object_data = new Float32Array(16 * 1024); 


        // --- 0. The Statue (Center) ---
        this.statues.push(new Statue(
            [0, 0, -2.0],   
            [90, 0, 0],     
            [1.5, 1.5, 1.5] 
        ));

        // --- 1. Floor (White) ---
        this.statues.push(new Statue(
            [0, 0, -2.1],     
            [0, 0, 0],
            [2.0, 2.1, 0.1]   // Wide X/Y, Thin Z
        ));

        // --- 2. Ceiling (White) ---
        this.statues.push(new Statue(
            [0, 0, 2.1],      
            [0, 0, 0],
            [2.0, 2.1, 0.1]
        ));

        // --- 3. Back Wall (White) ---
        this.statues.push(new Statue(
            [2.0, 0, 0],     
            [0, 0, 0],
            [0.1, 2.0, 2.0]   // Thin X, Wide Y/Z
        ));

        // --- 4. Left Wall (Red) ---
        this.statues.push(new Statue(
            [0, 2.0, 0],     
            [0, 0, 0],
            [2.0, 0.1, 2.0]   // Wide X/Z, Thin Y
        ));

        // --- 5. Right Wall (Green) ---
        this.statues.push(new Statue(
            [0, -2.0, 0],      
            [0, 0, 0],
            [2.0, 0.1, 2.0]
        ));

        // --- 6. The Light (Ceiling) ---
        this.statues.push(new Statue(
            [0, 0, 2.09],      
            [0, 0, 0],
            [0.5, 0.5, 0.1]   
        ));

        // Camera
        this.player = new Camera(
            [-7.0, 0, 0.0], 0, 0
        );
    }

    set_statue_type(type: string) {
        
        const statue = this.statues[0];
        if (!statue) return;

        switch(type) {
            case 'bunny':
                statue.position = [0, 0, -2.0];
                statue.eulers = [90, 0, 0];
                statue.scale = [1.5, 1.5, 1.5];
                break;
            case 'dragon':
            
                statue.position = [0, 0, -0.9];
                statue.eulers = [90, 0, 140]; 
                statue.scale = [4.0, 4.0, 4.0]; 
                break;
            case 'sphere':
                statue.position = [0, 0, -1.0];
                statue.eulers = [0, 0, 0];
                statue.scale = [1.0, 1.0, 1.0];
                break;
        }
    }

    update() {
        let i = 0;
        this.statues.forEach((mesh) => {
            mesh.update();
            const model = mesh.get_model();
            for (let j = 0; j < 16; j++) {
                this.object_data[16 * i + j] = <number>model.at(j);
            }
            i++;
        });

        this.player.update();
    }

    get_player(): Camera {
        return this.player;
    }

    get_renderables(): RenderData {
        return {
            view_transform: this.player.get_view(),
            model_transforms: this.object_data,
            object_counts: {
                [object_types.TRIANGLE]: this.statues.length, 
                [object_types.QUAD]: 0,
            }
        }
    }

    spin_player(dX: number, dY: number) {
        this.player.eulers[2] -= dX;
        this.player.eulers[2] %= 360;
        this.player.eulers[1] = Math.min(89, Math.max(-89, this.player.eulers[1] - dY));
    }

    move_player(forwards_amount: number, right_amount: number) {
        vec3.scaleAndAdd(this.player.position, this.player.position, this.player.forward, forwards_amount);
        vec3.scaleAndAdd(this.player.position, this.player.position, this.player.right, right_amount);
    }
}