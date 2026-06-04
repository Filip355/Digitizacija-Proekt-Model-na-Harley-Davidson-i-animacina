import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const MODEL_PATH = '/models/ednakamjhjknera.glb';

const canvas = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = null;
scene.fog = new THREE.FogExp2(0x171d1f, 0.075);

const camera = new THREE.PerspectiveCamera(
  34,
  window.innerWidth / window.innerHeight,
  0.05,
  40,
);
camera.position.set(3, 1.8, 4);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.enablePan = false;
controls.target.set(0, 0.8, 0);
controls.update();

const clock = new THREE.Clock();
const loader = new GLTFLoader();

let mixer;
let model;
let followTarget;
let currentAction;
let activeActions = [];
let animationClips = [];
let cameraRotationDuration = 1;
let cameraFollowEnabled = true;
const fadedMeshes = [];

const followPosition = new THREE.Vector3();
const previousFollowPosition = new THREE.Vector3();
const smoothedLookTarget = new THREE.Vector3();
const smoothedCameraPosition = new THREE.Vector3();
const bikeDirection = new THREE.Vector3(0, 0, 1);
const sideDirection = new THREE.Vector3(1, 0, 0);

const CAMERA_DISTANCE = 7.2;
const CAMERA_TARGET_HEIGHT = -0.3;
const CAMERA_HEIGHT = 1.65;
const CAMERA_SMOOTHING = 0.11;
const VISIBLE_PART_DISTANCE = 5.5;
const FADE_PART_DISTANCE = 9;
const ANIMATION_START_TIME = 0;

// Soft studio lighting keeps attention on the bike without showing Blender lights/cameras.
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x2a3033, 2.1);
scene.add(hemisphereLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
keyLight.position.set(4, 5, 3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x87d8ff, 1.5);
rimLight.position.set(-4, 2.5, -3);
scene.add(rimLight);

// A simple contact shadow surface makes the bike feel grounded.
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(4, 96),
  new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.32 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.02;
floor.receiveShadow = true;
scene.add(floor);

controls.addEventListener('start', () => {
  cameraFollowEnabled = false;
});

function removeEmbeddedCamerasAndLights(root) {
  const unwantedObjects = [];

  root.traverse((object) => {
    if (object.isCamera || object.isLight) {
      unwantedObjects.push(object);
    }
  });

  unwantedObjects.forEach((object) => {
    object.parent?.remove(object);
  });
}

function prepareModel(root) {
  removeEmbeddedCamerasAndLights(root);

  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;

      if (object.material) {
        object.material = Array.isArray(object.material)
          ? object.material.map((material) => material.clone())
          : object.material.clone();
      }

      fadedMeshes.push(object);
    }
  });
}

function getFollowTarget(root) {
  return (
    root.getObjectByName('BIKE_TARGET') ||
    root.getObjectByName('Sketchfab_model') ||
    root
  );
}

function frameCameraOnBike() {
  if (!followTarget) {
    return;
  }

  followTarget.getWorldPosition(followPosition);
  previousFollowPosition.copy(followPosition);
  smoothedLookTarget.copy(followPosition);
  smoothedCameraPosition.set(
    followPosition.x,
    followPosition.y + CAMERA_HEIGHT,
    followPosition.z - CAMERA_DISTANCE,
  );

  camera.position.copy(smoothedCameraPosition);
  camera.near = 0.05;
  camera.far = 24;
  camera.updateProjectionMatrix();

  controls.target.copy(smoothedLookTarget);
  controls.minDistance = 1.8;
  controls.maxDistance = 7;
  controls.update();

  floor.position.set(followPosition.x, -0.02, followPosition.z);
  floor.scale.setScalar(1.25);
}

function playAnimation(animationNameOrIndex = 0) {
  if (!mixer || animationClips.length === 0) {
    console.warn('No animations are available on this GLB model.');
    return;
  }

  const clip =
    typeof animationNameOrIndex === 'number'
      ? animationClips[animationNameOrIndex]
      : THREE.AnimationClip.findByName(animationClips, animationNameOrIndex);

  if (!clip) {
    console.warn('Animation not found:', animationNameOrIndex);
    return;
  }

  activeActions.forEach((action) => action.stop());
  activeActions = [];

  const nextAction = mixer.clipAction(clip);
  nextAction.reset().fadeIn(0.25).play();
  cameraRotationDuration = Math.max(clip.duration, 0.001);

  if (currentAction && currentAction !== nextAction) {
    currentAction.fadeOut(0.25);
  }

  currentAction = nextAction;
  console.log('Playing animation:', clip.name || animationNameOrIndex);
}

function playAllAnimations() {
  if (!mixer || animationClips.length === 0) {
    console.warn('No animations are available on this GLB model.');
    return;
  }

  activeActions.forEach((action) => action.stop());
  activeActions = animationClips.map((clip) => {
    const action = mixer.clipAction(clip);
    action.reset().play();
    return action;
  });
  cameraRotationDuration = Math.max(
    ...animationClips.map((clip) => clip.duration),
    0.001,
  );
  mixer.setTime(ANIMATION_START_TIME);
  currentAction = activeActions[0];

  console.log(`Playing ${activeActions.length} GLB animations together.`);
}

function resumeBikeCameraFollow() {
  cameraFollowEnabled = true;
}

function setMaterialOpacity(material, opacity) {
  material.transparent = opacity < 0.98;
  material.opacity = opacity;
  material.depthWrite = opacity > 0.25;
}

function fadeBackgroundParts() {
  if (!followTarget) {
    return;
  }

  fadedMeshes.forEach((mesh) => {
    const isRoad =
      mesh.name === 'CurvedRoad' ||
      mesh.name === 'CenterLine' ||
      mesh.parent?.name === 'CurvedRoad' ||
      mesh.parent?.name === 'CenterLine';
    const meshPosition = mesh.getWorldPosition(new THREE.Vector3());
    const distanceFromBike = meshPosition.distanceTo(followPosition);

    let opacity = 1;

    if (isRoad) {
      opacity = 0.16;
    } else if (distanceFromBike > VISIBLE_PART_DISTANCE) {
      const fadeAmount = THREE.MathUtils.clamp(
        (distanceFromBike - VISIBLE_PART_DISTANCE) /
          (FADE_PART_DISTANCE - VISIBLE_PART_DISTANCE),
        0,
        1,
      );
      opacity = THREE.MathUtils.lerp(1, 0.015, fadeAmount);
    }

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => setMaterialOpacity(material, opacity));
    } else {
      setMaterialOpacity(mesh.material, opacity);
    }
  });
}

// Expose a beginner-friendly switcher in the browser console:
// playBikeAnimation(0) or playBikeAnimation("AnimationName")
window.playBikeAnimation = playAnimation;
window.playAllBikeAnimations = playAllAnimations;
window.resumeBikeCameraFollow = resumeBikeCameraFollow;

loader.load(
  MODEL_PATH,
  (gltf) => {
    model = gltf.scene;
    prepareModel(model);
    scene.add(model);
    followTarget = getFollowTarget(model);
    frameCameraOnBike();

    animationClips = gltf.animations;
    console.log('Animations:', animationClips.map((animation) => animation.name));

    if (animationClips.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      playAllAnimations();
    } else {
      console.warn('This GLB loaded correctly, but it does not contain animations.');
    }
  },
  (event) => {
    if (event.total > 0) {
      const progress = Math.round((event.loaded / event.total) * 100);
      console.log(`Loading model: ${progress}%`);
    }
  },
  (error) => {
    console.error('Could not load GLB model:', error);
  },
);

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  if (mixer) {
    mixer.update(delta);
  }

  // Follow the bike path and complete one 360-degree camera move over the
  // full built-in animation duration.
  if (followTarget && cameraFollowEnabled) {
    followTarget.getWorldPosition(followPosition);

    const movement = followPosition.clone().sub(previousFollowPosition);
    if (movement.lengthSq() > 0.0001) {
      bikeDirection.copy(movement.normalize());
      sideDirection.set(-bikeDirection.z, 0, bikeDirection.x).normalize();
    }

    const animationTime = mixer ? mixer.time % cameraRotationDuration : 0;
    const rotationProgress = animationTime / cameraRotationDuration;
    const desiredLookTarget = followPosition.clone();
    desiredLookTarget.y += CAMERA_TARGET_HEIGHT;

    const cameraAngle = rotationProgress * Math.PI * 2;
    const desiredCameraPosition = followPosition.clone();
    desiredCameraPosition
      .addScaledVector(bikeDirection, -Math.cos(cameraAngle) * CAMERA_DISTANCE)
      .addScaledVector(sideDirection, Math.sin(cameraAngle) * CAMERA_DISTANCE);
    desiredCameraPosition.y += CAMERA_HEIGHT;

    smoothedLookTarget.lerp(desiredLookTarget, CAMERA_SMOOTHING);
    smoothedCameraPosition.lerp(desiredCameraPosition, CAMERA_SMOOTHING);

    camera.position.copy(smoothedCameraPosition);
    controls.target.copy(smoothedLookTarget);
    camera.lookAt(smoothedLookTarget);
    previousFollowPosition.copy(followPosition);
    fadeBackgroundParts();
  }

  controls.update();
  renderer.render(scene, camera);
}

function handleResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', handleResize);

animate();
