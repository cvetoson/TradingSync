import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const SEGMENTS = [
  { value: 30, color: 0x4a7fb8 },
  { value: 20, color: 0xc8923e },
  { value: 15, color: 0x8d9748 },
  { value: 15, color: 0x8b6dab },
  { value: 10, color: 0xc1614a },
  { value: 10, color: 0x7a7a8c },
];

const GEARS = [
  { x: -0.47, z: -0.05, teeth: 24, tipR: 0.55, rootR: 0.43, hubR: 0.22, color: 0x4a7fb8, spin:  0.40 },
  { x:  0.47, z: -0.05, teeth: 22, tipR: 0.50, rootR: 0.40, hubR: 0.20, color: 0xc8923e, spin: -0.44 },
  { x: -0.20, z:  0.85, teeth: 19, tipR: 0.43, rootR: 0.33, hubR: 0.18, color: 0x8b6dab, spin: -0.50 },
  { x: -0.78, z:  1.10, teeth: 13, tipR: 0.30, rootR: 0.22, hubR: 0.13, color: 0xc1614a, spin:  0.74 },
  { x:  0.10, z: -0.60, teeth: 12, tipR: 0.27, rootR: 0.20, hubR: 0.13, color: 0x8d9748, spin:  0.80 },
  { x:  1.00, z: -0.30, teeth:  9, tipR: 0.20, rootR: 0.15, hubR: 0.10, color: 0xc8923e, spin:  1.05 },
  { x:  0.78, z:  0.55, teeth:  9, tipR: 0.20, rootR: 0.15, hubR: 0.10, color: 0x7a7a8c, spin:  1.05 },
];

function ringSegmentShape(rOut, rIn, a0, a1) {
  const shape = new THREE.Shape();
  const segs = 56;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = a0 + (a1 - a0) * t;
    if (i === 0) shape.moveTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
    else shape.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
  }
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = a1 + (a0 - a1) * t;
    shape.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
  }
  shape.closePath();
  return shape;
}

function makeGear({ teeth, tipR, rootR, thickness, hubR, hubH, boreR, color }) {
  const shape = new THREE.Shape();
  const pts = teeth * 4;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const phase = i % 4;
    const r = (phase < 2) ? tipR : rootR;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreR, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.014,
    bevelThickness: 0.014,
    bevelSegments: 2,
    curveSegments: 18,
  });
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness: 0.4 });
  const gear = new THREE.Mesh(geo, mat);
  gear.castShadow = true;
  gear.receiveShadow = true;

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(hubR, hubR * 1.02, hubH, 36),
    new THREE.MeshStandardMaterial({ color, metalness: 0.96, roughness: 0.32 })
  );
  hub.position.y = thickness + hubH / 2;
  hub.castShadow = true;
  gear.add(hub);

  const bolt = new THREE.Mesh(
    new THREE.CylinderGeometry(boreR * 1.5, boreR * 1.5, 0.05, 18),
    new THREE.MeshStandardMaterial({ color: 0x161618, metalness: 0.9, roughness: 0.42 })
  );
  bolt.position.y = thickness + hubH + 0.025;
  gear.add(bolt);

  return gear;
}

export default function PortfolioGears3D() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = () => container.clientWidth || 1;
    const height = () => container.clientHeight || 1;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width(), height());
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(38, width() / height(), 0.1, 100);
    camera.position.set(0, 4.4, 5.6);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.18));
    const key = new THREE.DirectionalLight(0xffe6c0, 1.55);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 25;
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6c8cff, 0.45);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    const warm = new THREE.DirectionalLight(0xff9c66, 0.32);
    warm.position.set(3, 1, -5);
    scene.add(warm);

    // contact shadow blob
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 512;
    const sctx = shadowCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(256, 256, 60, 256, 256, 256);
    grad.addColorStop(0, 'rgba(0,0,0,0.6)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = grad; sctx.fillRect(0, 0, 512, 512);
    const blobTex = new THREE.CanvasTexture(shadowCanvas);
    const blob = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 5),
      new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = -0.3;
    scene.add(blob);

    const assembly = new THREE.Group();
    assembly.scale.setScalar(0.72);
    scene.add(assembly);

    // outer ring
    const RING_OUTER = 2.2, RING_INNER = 1.7, RING_DEPTH = 0.32, SEG_GAP = 0.045;
    const total = SEGMENTS.reduce((s, x) => s + x.value, 0);
    let theta = Math.PI / 2;
    SEGMENTS.forEach(s => {
      const arc = (s.value / total) * Math.PI * 2 - SEG_GAP;
      const shape = ringSegmentShape(RING_OUTER, RING_INNER, theta, theta + arc);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: RING_DEPTH,
        bevelEnabled: true,
        bevelSize: 0.022, bevelThickness: 0.022, bevelSegments: 3,
        curveSegments: 28,
      });
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({
        color: s.color, metalness: 0.92, roughness: 0.38,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true; mesh.receiveShadow = true;
      assembly.add(mesh);

      for (const dir of [theta + 0.07, theta + arc - 0.07]) {
        const r = (RING_OUTER + RING_INNER) / 2 + 0.16;
        const screw = new THREE.Mesh(
          new THREE.CylinderGeometry(0.028, 0.028, 0.04, 14),
          new THREE.MeshStandardMaterial({ color: 0x1a1a1f, metalness: 0.95, roughness: 0.45 })
        );
        screw.position.set(Math.cos(dir) * r, RING_DEPTH + 0.02, -Math.sin(dir) * r);
        screw.castShadow = true;
        assembly.add(screw);
      }
      theta += arc + SEG_GAP;
    });

    // gears
    const gearMeshes = [];
    GEARS.forEach(g => {
      const gear = makeGear({
        teeth: g.teeth, tipR: g.tipR, rootR: g.rootR,
        thickness: 0.18, hubR: g.hubR, hubH: 0.08, boreR: 0.05,
        color: g.color,
      });
      gear.position.set(g.x, 0.02, g.z);
      gear.userData.spin = g.spin;
      assembly.add(gear);
      gearMeshes.push(gear);
    });

    // interaction
    let autoRot = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

    const onMouseMove = (e) => {
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onResize = () => {
      renderer.setSize(width(), height());
      camera.aspect = width() / height();
      camera.updateProjectionMatrix();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let raf;
    const animate = () => {
      const dt = clock.getDelta();
      autoRot += dt * 0.25;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;

      assembly.rotation.y = autoRot;
      assembly.rotation.x = mouse.y * -0.16;
      assembly.rotation.z = mouse.x * 0.12;
      assembly.position.y = Math.sin(performance.now() * 0.0006) * 0.04;

      gearMeshes.forEach(g => { g.rotation.y += g.userData.spin * dt; });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      scene.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      blobTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
