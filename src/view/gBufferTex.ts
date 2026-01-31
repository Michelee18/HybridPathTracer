export class GBufferTexture {
  texture: GPUTexture;
  view: GPUTextureView;

  constructor(
    device: GPUDevice,
    width: number,
    height: number,
    format: GPUTextureFormat = 'rgba32float'
  ) {
    this.texture = device.createTexture({
      size: { width, height, depthOrArrayLayers: 1 },
      format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT |
             GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_SRC,
    });

    this.view = this.texture.createView();
  }
}
