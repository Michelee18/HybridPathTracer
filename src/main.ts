import { App } from "./control/app";

const canvas = <HTMLCanvasElement>document.getElementById("gfx-main");
const app = new App(canvas);

app.InitializeRenderer().then(() => {
    console.log("Renderer initialized, starting render loop...");
    app.run();
});