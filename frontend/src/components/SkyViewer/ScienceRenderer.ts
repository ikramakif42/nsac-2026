import {
  packRenderPlane,
  type RenderFrame,
  type RenderStyle,
} from "./renderFrame";
import {
  SCIENCE_FRAGMENT_SHADER,
  SCIENCE_VERTEX_SHADER,
} from "./scienceShaders";

const STRETCH_IDS = {
  linear: 0,
  sqrt: 1,
  log: 2,
  asinh: 3,
} as const;

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to allocate a WebGL shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const detail = gl.getShaderInfoLog(shader) || "Unknown compilation error";
    gl.deleteShader(shader);
    throw new Error(`WebGL shader compilation failed: ${detail}`);
  }
  return shader;
}

function colormapId(name: string): number {
  switch (name.toLowerCase()) {
    case "inferno":
      return 1;
    case "viridis":
      return 2;
    case "gray":
    case "grey":
    case "grayscale":
    case "greyscale":
    case "linear":
      return 0;
    default:
      throw new Error(`Unsupported display colormap: ${name}`);
  }
}

export class ScienceRenderer {
  private readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private uniforms = new Map<string, WebGLUniformLocation>();
  private uploadedFrame: RenderFrame | null = null;
  private uploadedDifference = false;
  private readonly canvas: HTMLCanvasElement;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "low-power",
    });
    if (!gl) {
      throw new Error("WebGL2 is unavailable. No substitute image is displayed.");
    }
    this.gl = gl;

    let vertex: WebGLShader | null = null;
    let fragment: WebGLShader | null = null;

    try {
      vertex = compileShader(gl, gl.VERTEX_SHADER, SCIENCE_VERTEX_SHADER);
      fragment = compileShader(gl, gl.FRAGMENT_SHADER, SCIENCE_FRAGMENT_SHADER);

      this.program = gl.createProgram();
      if (!this.program) throw new Error("Unable to allocate a WebGL program.");

      gl.attachShader(this.program, vertex);
      gl.attachShader(this.program, fragment);
      gl.linkProgram(this.program);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        throw new Error(
          `WebGL shader linking failed: ${
            gl.getProgramInfoLog(this.program) || "Unknown linking error"
          }`,
        );
      }

      for (const name of ["uPlane", "uStretch", "uColormap", "uDifference"]) {
        const location = gl.getUniformLocation(this.program, name);
        if (location === null) {
          throw new Error(`Missing WebGL uniform: ${name}`);
        }
        this.uniforms.set(name, location);
      }

      this.vao = gl.createVertexArray();
      this.texture = gl.createTexture();
      if (!this.vao || !this.texture) {
        throw new Error("Unable to allocate WebGL image resources.");
      }

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.DITHER);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    } catch (error) {
      this.dispose();
      throw error;
    } finally {
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    }
  }

  private uniform(name: string): WebGLUniformLocation {
    const result = this.uniforms.get(name);
    if (!result) throw new Error(`Unavailable WebGL uniform: ${name}`);
    return result;
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    const gl = this.gl;
    const limits = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const ratio = Number.isFinite(dpr) ? Math.max(1, Math.min(dpr, 2)) : 1;
    const width = Math.max(
      1,
      Math.min(limits[0], Math.round(cssWidth * ratio)),
    );
    const height = Math.max(
      1,
      Math.min(limits[1], Math.round(cssHeight * ratio)),
    );

    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  clear(): void {
    if (this.disposed || this.gl.isContextLost()) return;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(7 / 255, 11 / 255, 22 / 255, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  render(frame: RenderFrame, style: RenderStyle): void {
    if (this.disposed || this.gl.isContextLost()) {
      throw new Error("WebGL context is unavailable.");
    }

    const gl = this.gl;
    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    if (frame.width > maxTextureSize || frame.height > maxTextureSize) {
      throw new Error(
        `Image exceeds this device's ${maxTextureSize}px texture limit.`,
      );
    }

    const palette = colormapId(style.colormap);
    const stretch = STRETCH_IDS[style.stretch];
    if (stretch === undefined) throw new Error("Unsupported display stretch.");

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    if (
      frame !== this.uploadedFrame ||
      style.difference !== this.uploadedDifference
    ) {
      const packed = packRenderPlane(frame, style.difference);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RG32F,
        frame.width,
        frame.height,
        0,
        gl.RG,
        gl.FLOAT,
        packed,
      );
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        throw new Error(`WebGL texture upload failed (${error}).`);
      }
      this.uploadedFrame = frame;
      this.uploadedDifference = style.difference;
    }

    this.clear();
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform1i(this.uniform("uPlane"), 0);
    gl.uniform1i(this.uniform("uStretch"), stretch);
    gl.uniform1i(this.uniform("uColormap"), palette);
    gl.uniform1i(this.uniform("uDifference"), style.difference ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    const error = gl.getError();
    if (error !== gl.NO_ERROR) {
      throw new Error(`WebGL drawing failed (${error}).`);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.gl.deleteTexture(this.texture);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);

    this.texture = null;
    this.vao = null;
    this.program = null;
    this.uploadedFrame = null;
    this.uniforms.clear();
  }
}