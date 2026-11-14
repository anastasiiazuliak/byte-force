import * as THREE from 'three';
import { TIFFLoader } from 'three/addons/loaders/TIFFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
const textureLoader = new TIFFLoader();

const moonTex = await textureLoader.loadAsync("res/lroc_color.tif");
moonTex.colorSpace = THREE.SRGBColorSpace;
moonTex.anisotropy = maxAnisotropy;

const moonDispTex = await textureLoader.loadAsync("res/ldem_16.tif");
moonDispTex.anisotropy = maxAnisotropy;

moonTex.wrapS = THREE.RepeatWrapping;
moonTex.wrapT = THREE.ClampToEdgeWrapping;
moonDispTex.wrapS = THREE.RepeatWrapping;
moonDispTex.wrapT = THREE.ClampToEdgeWrapping;

moonTex.generateMipmaps = true;
moonTex.minFilter = THREE.LinearMipmapLinearFilter;
moonTex.magFilter = THREE.LinearFilter;

moonDispTex.generateMipmaps = true;
moonDispTex.minFilter = THREE.LinearMipmapLinearFilter;
moonDispTex.magFilter = THREE.LinearFilter;

const sphereGeometry = new THREE.IcosahedronGeometry(1, 48);
const material = new THREE.MeshStandardMaterial({
  map: moonTex,
  bumpMap: moonDispTex,
  bumpScale: 0.2,
  roughness: 0.9
});

const mesh = new THREE.Mesh(sphereGeometry, material);

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
directionalLight.position.set(10, 10, 10);

scene.add(directionalLight);
scene.add(ambientLight);
scene.add(mesh);

const uiScene = new THREE.Scene();
const uiCamera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
uiCamera.position.z = 2;

const previewGeometry = new THREE.PlaneGeometry(5, 2, 48, 48);
const previewMaterial = new THREE.MeshBasicMaterial();
const previewMesh = new THREE.Mesh(previewGeometry, previewMaterial);
previewGeometry.rotateX(Math.sin(-90));

const previewAmbientLight = new THREE.AmbientLight(0xffffff, 0.5);
uiScene.add(previewMesh);
uiScene.add(previewAmbientLight);

let pointAPos = null;
let pointBPos = null;
let activeTarget = 'A'; 
const markerMaterialA = new THREE.MeshBasicMaterial({ color: 0x0055ff });
const markerMaterialB = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const markerGeometry = new THREE.SphereGeometry(0.015, 16, 16);

const dotA = new THREE.Mesh(markerGeometry, markerMaterialA);
const dotB = new THREE.Mesh(markerGeometry, markerMaterialB);
dotA.visible = false;
dotB.visible = false;
mesh.add(dotA);
mesh.add(dotB);

function animate() {
  requestAnimationFrame(animate);

  renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  renderer.setScissorTest(false);
  renderer.render(scene, camera);

  const size = 200;
  const x = window.innerWidth - size;
  const y = 0;

  renderer.setViewport(x, y, size, size);
  renderer.setScissor(x, y, size, size);
  renderer.setScissorTest(true);

  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(uiScene, uiCamera);
  renderer.autoClear = true;
}

function focusTexture(texture, uvCenter, cropSize = 0.01) {
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(cropSize, cropSize);

  const offsetX = uvCenter.x - (cropSize / 2);
  const offsetY = uvCenter.y - (cropSize / 2);
  texture.offset.set(offsetX, offsetY);
  texture.needsUpdate = true;
}

function uvToCoords(uv) {
  const lon = (uv.x * 360) - 180;
  const lat = (0.5 - uv.y) * 180;
  return { lat, lon };
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let isDragging = false;
let pointerDownTime = 0;
let pointerDownX = 0;
let pointerDownY = 0;

window.addEventListener('mousedown', (e) => {
  isDragging = true;
  pointerDownTime = Date.now();
  pointerDownX = e.clientX;
  pointerDownY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const deltaX = e.clientX - pointerDownX;
  const deltaY = e.clientY - pointerDownY;

  pointerDownX = e.clientX;
  pointerDownY = e.clientY;

  const sensitivity = 0.005;
  mesh.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), deltaX * sensitivity);
  mesh.rotateOnAxis(new THREE.Vector3(1, 0, 0), deltaY * sensitivity);
});

window.addEventListener('mouseup', (e) => {
  isDragging = false;
  const clickDuration = Date.now() - pointerDownTime;
  const moveDistance = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);

  if (clickDuration < 250 && moveDistance < 5) {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    mesh.updateMatrixWorld(true);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
      const intersect = intersects[0];
      const localPoint = intersect.point.clone();
      mesh.worldToLocal(localPoint);
      const uv = intersect.uv;

      if (activeTarget === 'A') {
        pointAPos = localPoint;
        dotA.position.copy(localPoint);
        dotA.visible = true;
        console.log("Точка A встановлена");
        activeTarget = 'B';
      } else {
        pointBPos = localPoint;
        dotB.position.copy(localPoint);
        dotB.visible = true;
        console.log("Точка B встановлена");
        activeTarget = 'A';
      }

      if (uv) {
        const coords = uvToCoords(uv);
        console.log(`Координати (${activeTarget === 'B' ? 'A' : 'B'}): Широта = ${coords.lat.toFixed(2)}°, Довгота = ${coords.lon.toFixed(2)}°`);

        const mainTexture = mesh.material.map;
        const mainDispTex = mesh.material.bumpMap;

        if (mainTexture && mainDispTex) {
          const previewTexture = mainTexture.clone();
          const previewDispTex = mainDispTex.clone();

          focusTexture(previewTexture, uv);
          previewMesh.material.map = previewTexture;

          focusTexture(previewDispTex, uv);
          previewMesh.material.bumpMap = previewDispTex;

          previewMesh.material.needsUpdate = true;
        }
      }
    }
  }
});

let scale = 3;
window.addEventListener('wheel', (e) => {
  e.preventDefault();
  scale += e.deltaY * 0.001;
  camera.position.z = Math.min(Math.max(1.2, scale), 4);
}, { passive: false });

animate();
