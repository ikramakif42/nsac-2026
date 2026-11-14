import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { CubeRenderResponse } from "../../types/cubeRender";
import {
  frameIndex,
  MIN_FRAME_INTERVAL_MS,
  wheelPixels,
} from "./cubeModel";

export interface SceneHandle {
  setSlice(index: number): void;
  setStack(visible: boolean): void;
  resetCamera(): void;
  dispose(): void;
}

interface Options {
  host: HTMLDivElement;
  data: CubeRenderResponse;
  mode: "cube" | "sphere";
  initialIndex: number;
  onStep: (delta: number) => void;
  onError: (message: string) => void;
}

function textureFor(
  encoded: string,
  width: number,
  height: number,
): THREE.DataTexture {
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const texture = new THREE.DataTexture(
    bytes,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}

export function createThreeCubeScene(options: Options): SceneHandle {
  const { host, data, mode, onStep, onError } = options;
  const canvas = document.createElement("canvas");
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    mode === "cube"
      ? "Registered three-dimensional data cube. Drag to orbit; scroll or use arrow keys to scrub."
      : "Celestial image footprint. Drag to orbit; scroll or use arrow keys to scrub.",
  );
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";

  const context = canvas.getContext("webgl2", {
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  if (!context) throw new Error("WebGL2 is unavailable. The 2D viewer remains available.");

  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x030711, 1);
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.000001, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enableZoom = false;
  controls.enablePan = mode === "cube";

  const textures: THREE.DataTexture[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const planes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  let sphereMaterial: THREE.MeshBasicMaterial | null = null;
  let selected = frameIndex(options.initialIndex, data.frames.length);
  let showStack = false;
  let disposed = false;
  let animation = 0;
  let resizeObserver: ResizeObserver | null = null;

  const defaultPosition = new THREE.Vector3();
  const defaultTarget = new THREE.Vector3();
  const defaultUp = new THREE.Vector3(0, 1, 0);

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(animation);
    resizeObserver?.disconnect();
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("keydown", onKeyDown);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    controls.dispose();
    for (const texture of textures) texture.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    scene.clear();
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }

  function updateSlices() {
    if (mode === "sphere") {
      if (sphereMaterial) {
        sphereMaterial.map = textures[selected];
        sphereMaterial.needsUpdate = true;
      }
      return;
    }
    planes.forEach((plane, index) => {
      const active = index === selected;
      plane.visible = active || showStack;
      plane.material.opacity = active ? 1 : 0.12;
      plane.material.depthWrite = active;
      plane.renderOrder = active ? 2 : 1;
    });
  }

  function resetCamera() {
    camera.position.copy(defaultPosition);
    camera.up.copy(defaultUp);
    controls.target.copy(defaultTarget);
    controls.update();
  }

  let wheelAccumulator = 0;
  let wheelTime = Number.NEGATIVE_INFINITY;
  let lastScrub = Number.NEGATIVE_INFINITY;

  function onWheel(event: WheelEvent) {
    if (event.ctrlKey) return;
    event.preventDefault();
    const now = performance.now();
    if (now - wheelTime > 200) wheelAccumulator = 0;
    wheelTime = now;
    wheelAccumulator += wheelPixels(
      event.deltaY,
      event.deltaMode,
      Math.max(1, host.clientHeight),
    );
    wheelAccumulator = Math.max(-240, Math.min(240, wheelAccumulator));
  }

  function onKeyDown(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastScrub < MIN_FRAME_INTERVAL_MS) return;
    lastScrub = now;
    onStep(event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1);
  }

  function onContextLost(event: Event) {
    event.preventDefault();
    onError("The WebGL2 context was lost. Reload the 3D view or switch to 2D.");
  }

  try {
    for (const frame of data.frames) {
      textures.push(textureFor(
        frame.rgba_base64,
        data.texture_width,
        data.texture_height,
      ));
    }

    if (mode === "cube") {
      const geometry = new THREE.PlaneGeometry(data.cube.width, data.cube.height);
      geometries.push(geometry);
      textures.forEach((texture, index) => {
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
          alphaTest: 0.01,
          toneMapped: false,
        });
        materials.push(material);
        const plane = new THREE.Mesh(geometry, material);
        plane.position.z = data.cube.z_positions[index];
        planes.push(plane);
        scene.add(plane);
      });

      const box = new THREE.BoxGeometry(
        data.cube.width,
        data.cube.height,
        Math.max(
          0.04,
          data.cube.z_positions[data.cube.z_positions.length - 1] -
            data.cube.z_positions[0],
        ),
      );
      const edges = new THREE.EdgesGeometry(box);
      box.dispose();
      geometries.push(edges);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x63718b });
      materials.push(edgeMaterial);
      scene.add(new THREE.LineSegments(edges, edgeMaterial));
      defaultPosition.set(3.2, 2.2, 4.2);
    } else {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(data.sphere.positions, 3),
      );
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(data.sphere.uv, 2),
      );
      geometry.setIndex(data.sphere.indices);
      geometry.computeBoundingSphere();
      geometries.push(geometry);
      sphereMaterial = new THREE.MeshBasicMaterial({
        map: textures[selected],
        transparent: true,
        alphaTest: 0.01,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      materials.push(sphereMaterial);
      scene.add(new THREE.Mesh(geometry, sphereMaterial));

      const globeGeometry = new THREE.SphereGeometry(0.998, 48, 24);
      const globeMaterial = new THREE.MeshBasicMaterial({
        color: 0x10213b,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      });
      geometries.push(globeGeometry);
      materials.push(globeMaterial);
      scene.add(new THREE.Mesh(globeGeometry, globeMaterial));

      defaultTarget.fromArray(data.sphere.center);
      defaultUp.fromArray(data.sphere.north);
      const distance = Math.max(
        0.0001,
        3.2 * Math.sin(Math.min(data.sphere.angular_radius_rad, Math.PI / 2)),
      );
      defaultPosition.copy(defaultTarget).addScaledVector(
        defaultTarget.clone().normalize(),
        distance,
      );
      controls.minDistance = Math.max(0.00002, distance * 0.2);
      controls.maxDistance = 5;
    }

    updateSlices();
    resetCamera();

    resizeObserver = new ResizeObserver(() => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(host);
    renderer.setSize(
      Math.max(1, host.clientWidth),
      Math.max(1, host.clientHeight),
      false,
    );
    camera.aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
    camera.updateProjectionMatrix();

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("webglcontextlost", onContextLost);

    const render = (now: number) => {
      if (disposed) return;
      if (
        Math.abs(wheelAccumulator) >= 40 &&
        now - lastScrub >= MIN_FRAME_INTERVAL_MS
      ) {
        const direction = Math.sign(wheelAccumulator);
        wheelAccumulator -= direction * 40;
        lastScrub = now;
        onStep(direction);
      }
      controls.update();
      renderer.render(scene, camera);
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
  } catch (error) {
    dispose();
    throw error;
  }

  return {
    setSlice(index) {
      selected = frameIndex(index, data.frames.length);
      updateSlices();
    },
    setStack(visible) {
      showStack = visible;
      updateSlices();
    },
    resetCamera,
    dispose,
  };
}