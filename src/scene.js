import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createScene() {
  const canvas = document.querySelector('#scene');

  const scene = new THREE.Scene();
  scene.fog   = new THREE.FogExp2(0x111820, 0.055);

  // Sky gradient backdrop
  const bgCanvas      = document.createElement('canvas');
  bgCanvas.width      = 2; bgCanvas.height = 512;
  const bgCtx         = bgCanvas.getContext('2d');
  const bgGrad        = bgCtx.createLinearGradient(0, 0, 0, 512);
  bgGrad.addColorStop(0.00, '#010306');
  bgGrad.addColorStop(0.25, '#04091a');
  bgGrad.addColorStop(0.55, '#091424');
  bgGrad.addColorStop(0.74, '#0e1822');
  bgGrad.addColorStop(0.88, '#180e08');
  bgGrad.addColorStop(1.00, '#221206');
  bgCtx.fillStyle     = bgGrad;
  bgCtx.fillRect(0, 0, 2, 512);
  scene.background    = new THREE.CanvasTexture(bgCanvas);

  const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.05, 90);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace  = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan     = false;
  controls.minDistance   = 1.8;
  controls.maxDistance   = 16;
  controls.target.set(0, 0.8, 0);
  controls.update();

  // Lighting
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3033, 2.1));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(4, 5, 3);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x87d8ff, 1.5);
  rimLight.position.set(-4, 2.5, -3);
  scene.add(rimLight);

  const backFill = new THREE.DirectionalLight(0xffe8cc, 1.0);
  backFill.position.set(0, 3, -5);
  scene.add(backFill);

  const clock = new THREE.Clock();

  return { scene, camera, renderer, controls, clock };
}
