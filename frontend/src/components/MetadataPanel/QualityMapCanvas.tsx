import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { decodeBase64Bytes } from "../../lib/qualityClient";

interface Props {
  width: number;
  height: number;
  rgbaBase64: string;
  label: string;
}

/**
 * Renders backend-produced RGBA bytes without computing WCS, SNR, masks,
 * stretches, percentiles, or other scientific quantities.
 */
export default function QualityMapCanvas({
  width,
  height,
  rgbaBase64,
  label,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer | undefined;
    let geometry: THREE.PlaneGeometry | undefined;
    let material: THREE.ShaderMaterial | undefined;
    let texture: THREE.DataTexture | undefined;
    let observer: ResizeObserver | undefined;
    let disposed = false;
    let renderFrame: (() => void) | undefined;

    const contextLost = (event: Event) => {
      event.preventDefault();
      setError("The quality-view WebGL context was lost.");
    };
    const contextRestored = () => {
      if (!disposed && renderFrame && texture) {
        texture.needsUpdate = true;
        setError(null);
        renderFrame();
      }
    };

    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);

    try {
      setError(null);
      const context = canvas.getContext("webgl2", {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
      });
      if (!context) {
        throw new Error("WebGL2 is unavailable for the quality view.");
      }

      renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
      });
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      texture = new THREE.DataTexture(
        decodeBase64Bytes(rgbaBase64, width * height * 4),
        width,
        height,
        THREE.RGBAFormat,
        THREE.UnsignedByteType,
      );
      texture.flipY = false;
      texture.generateMipmaps = false;
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;

      geometry = new THREE.PlaneGeometry(2, 2);
      material = new THREE.ShaderMaterial({
        uniforms: { imageTexture: { value: texture } },
        vertexShader: `
          varying vec2 imageUv;
          void main() {
            imageUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,
        fragmentShader: `
          precision highp float;
          uniform sampler2D imageTexture;
          varying vec2 imageUv;
          void main() {
            gl_FragColor = texture2D(imageTexture, imageUv);
          }
        `,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });

      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(geometry, material));
      const camera = new THREE.Camera();

      renderFrame = () => {
        if (disposed || !renderer) return;
        const cssWidth = Math.max(1, canvas.clientWidth);
        const cssHeight = Math.max(1, canvas.clientHeight);
        renderer.setSize(cssWidth, cssHeight, false);
        renderer.render(scene, camera);
      };

      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(renderFrame);
        observer.observe(canvas);
      }
      window.addEventListener("resize", renderFrame);
      renderFrame();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Quality rendering failed.",
      );
    }

    return () => {
      disposed = true;
      observer?.disconnect();
      if (renderFrame) window.removeEventListener("resize", renderFrame);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      texture?.dispose();
      material?.dispose();
      geometry?.dispose();
      renderer?.dispose();
    };
  }, [width, height, rgbaBase64]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="block w-full rounded border border-[var(--ol-border)]"
        style={{
          aspectRatio: `${width} / ${height}`,
          backgroundColor: "#151923",
          backgroundImage:
            "repeating-conic-gradient(#151923 0% 25%, #242a36 0% 50%)",
          backgroundSize: "16px 16px",
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-[var(--ol-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}