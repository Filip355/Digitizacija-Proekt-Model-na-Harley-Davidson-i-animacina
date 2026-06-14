import * as THREE from 'three';
import {
  ORBIT_TC, LOOK_TC, ORBIT_SPEED, ORBIT_DISTANCE, ORBIT_HEIGHT, ORBIT_FOV,
  INTRO_ZOOM_IN_DUR, INTRO_HOLD_DUR, INTRO_ZOOM_OUT_DUR,
  INTRO_FAR_DIST, INTRO_CLOSE_DIST, INTRO_ANGLE, INTRO_HEIGHT, INTRO_FOV,
  CAMERA_TARGET_HEIGHT,
  state,
  followPosition, prevFollowPosition, smoothedOrbitCenter, smoothedLookTarget, desiredLook,
  smoothstep,
} from './state.js';

export function updateCamera(delta, { camera, controls }) {
  if (state.introPhase < 3) {
    state.introTimer += delta;

    if (state.introPhase === 0) {
      const t = smoothstep(Math.min(state.introTimer / INTRO_ZOOM_IN_DUR, 1));
      state.liveDistance = THREE.MathUtils.lerp(INTRO_FAR_DIST, INTRO_CLOSE_DIST, t);
      state.liveAngle    = INTRO_ANGLE;
      state.liveHeight   = INTRO_HEIGHT;
      state.liveFov      = INTRO_FOV;
      if (state.introTimer >= INTRO_ZOOM_IN_DUR) { state.introPhase = 1; state.introTimer = 0; }

    } else if (state.introPhase === 1) {
      state.liveDistance = INTRO_CLOSE_DIST;
      state.liveAngle    = INTRO_ANGLE;
      state.liveHeight   = INTRO_HEIGHT;
      state.liveFov      = INTRO_FOV;
      const speed = followPosition.distanceTo(prevFollowPosition) / Math.max(delta, 0.001);
      if (state.introTimer >= INTRO_HOLD_DUR || speed > 0.05) { state.introPhase = 2; state.introTimer = 0; }

    } else if (state.introPhase === 2) {
      const t = smoothstep(Math.min(state.introTimer / INTRO_ZOOM_OUT_DUR, 1));
      state.liveDistance = THREE.MathUtils.lerp(INTRO_CLOSE_DIST, ORBIT_DISTANCE, t);
      state.liveAngle    = INTRO_ANGLE;
      state.liveHeight   = THREE.MathUtils.lerp(INTRO_HEIGHT, ORBIT_HEIGHT, t);
      state.liveFov      = THREE.MathUtils.lerp(INTRO_FOV,    ORBIT_FOV,    t);
      if (state.introTimer >= INTRO_ZOOM_OUT_DUR) {
        state.introPhase   = 3;
        state.liveDistance = ORBIT_DISTANCE;
        state.liveHeight   = ORBIT_HEIGHT;
        state.liveFov      = ORBIT_FOV;
      }
    }

  } else {
    // Continuous smooth orbit — no cuts, no shot switching
    state.elapsedTime  += delta;
    state.liveAngle    += delta * ORBIT_SPEED;
    state.liveHeight    = ORBIT_HEIGHT + Math.sin(state.elapsedTime * 0.11) * 0.45;
    state.liveDistance  = ORBIT_DISTANCE;
    state.liveFov       = ORBIT_FOV;
  }

  // Framerate-independent exponential smoothing
  const orbitFactor = 1 - Math.exp(-delta / ORBIT_TC);
  const lookFactor  = 1 - Math.exp(-delta / LOOK_TC);

  smoothedOrbitCenter.lerp(followPosition, orbitFactor);
  desiredLook.set(followPosition.x, followPosition.y + CAMERA_TARGET_HEIGHT, followPosition.z);
  smoothedLookTarget.lerp(desiredLook, lookFactor);

  controls.target.copy(smoothedLookTarget);

  if (Math.abs(camera.fov - state.liveFov) > 0.02) {
    camera.fov = state.liveFov;
    camera.updateProjectionMatrix();
  }

  // controls.update() BEFORE camera.position.set() so it doesn't overwrite us
  controls.update();

  camera.position.set(
    smoothedOrbitCenter.x + Math.sin(state.liveAngle) * state.liveDistance,
    smoothedOrbitCenter.y + state.liveHeight,
    smoothedOrbitCenter.z + Math.cos(state.liveAngle) * state.liveDistance,
  );
  camera.lookAt(smoothedLookTarget);
}
