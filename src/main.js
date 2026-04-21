import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const MODEL_URL = "/models/tracked_car.glb";
const MODEL_LABEL = "履带小车";
const FALLBACK_FILE_SIZE = 82111212;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const clock = new THREE.Clock();

const LOCAL_VIEW_OFFSETS = {
  iso: { forward: 1.6, up: 0.92, side: 1.45 },
  front: { forward: 1.9, up: 0.2, side: 0.02 },
  left: { forward: 0.02, up: 0.22, side: -1.9 },
  top: { forward: 0.01, up: 2.5, side: 0.01 },
};

const dom = {
  statusPill: document.querySelector("#status-pill"),
  statusText: document.querySelector("#status-text"),
  heroModelName: document.querySelector("#hero-model-name"),
  sceneContainer: document.querySelector("#scene-container"),
  viewerStage: document.querySelector("#viewer-stage"),
  viewerCaption: document.querySelector("#viewer-caption"),
  loadingPanel: document.querySelector("#loading-panel"),
  loadingText: document.querySelector("#loading-text"),
  progressFill: document.querySelector("#progress-fill"),
  selectionValue: document.querySelector("#selection-value"),
  selectionNote: document.querySelector("#selection-note"),
  statName: document.querySelector("#stat-name"),
  statStatus: document.querySelector("#stat-status"),
  statSize: document.querySelector("#stat-size"),
  statMeshes: document.querySelector("#stat-meshes"),
  statMaterials: document.querySelector("#stat-materials"),
  statTriangles: document.querySelector("#stat-triangles"),
  statVertices: document.querySelector("#stat-vertices"),
  statAnimations: document.querySelector("#stat-animations"),
  statDimensions: document.querySelector("#stat-dimensions"),
  modelTags: document.querySelector("#model-tags"),
  viewButtons: document.querySelectorAll("[data-view]"),
  resetButton: document.querySelector("#btn-reset-view"),
  fullscreenButton: document.querySelector("#btn-fullscreen"),
  runButton: document.querySelector("#btn-run"),
  pauseButton: document.querySelector("#btn-pause"),
  homeButton: document.querySelector("#btn-home"),
  clearTrailButton: document.querySelector("#btn-clear-trail"),
  speedSlider: document.querySelector("#speed-slider"),
  speedReadout: document.querySelector("#speed-readout"),
  steerSlider: document.querySelector("#steer-slider"),
  steerReadout: document.querySelector("#steer-readout"),
  toggleFollow: document.querySelector("#toggle-follow"),
  toggleTrail: document.querySelector("#toggle-trail"),
  toggleAutorotate: document.querySelector("#toggle-autorotate"),
  toggleWireframe: document.querySelector("#toggle-wireframe"),
  toggleGrid: document.querySelector("#toggle-grid"),
  toggleAxes: document.querySelector("#toggle-axes"),
  driveMode: document.querySelector("#drive-mode"),
  driveSpeed: document.querySelector("#drive-speed"),
  driveSteering: document.querySelector("#drive-steering"),
  driveHeading: document.querySelector("#drive-heading"),
  drivePosition: document.querySelector("#drive-position"),
  driveDistance: document.querySelector("#drive-distance"),
  hudMode: document.querySelector("#hud-mode"),
  hudSpeed: document.querySelector("#hud-speed"),
  hudHeading: document.querySelector("#hud-heading"),
  hudPosition: document.querySelector("#hud-position"),
  minimapCanvas: document.querySelector("#minimap-canvas"),
  missionReadout: document.querySelector("#mission-readout"),
  routeStatus: document.querySelector("#route-status"),
  routeHint: document.querySelector("#route-hint"),
  autonomyMode: document.querySelector("#autonomy-mode"),
  routeCount: document.querySelector("#route-count"),
  routeLength: document.querySelector("#route-length"),
  routeProgress: document.querySelector("#route-progress"),
  routeList: document.querySelector("#route-list"),
  executeRouteButton: document.querySelector("#btn-execute-route"),
  stopRouteButton: document.querySelector("#btn-stop-route"),
  clearRouteButton: document.querySelector("#btn-clear-route"),
  manualRouteButton: document.querySelector("#btn-manual-route"),
  removeWaypointButton: document.querySelector("#btn-remove-waypoint"),
  perimeterButton: document.querySelector("#btn-load-perimeter"),
  inspectButton: document.querySelector("#btn-load-inspect"),
  returnButton: document.querySelector("#btn-load-return"),
  timeSlider: document.querySelector("#time-slider"),
  timeReadout: document.querySelector("#time-readout"),
  toggleRain: document.querySelector("#toggle-rain"),
  toggleHeadlights: document.querySelector("#toggle-headlights"),
  toggleBeacon: document.querySelector("#toggle-beacon"),
  toggleLidar: document.querySelector("#toggle-lidar"),
  toggleCameraCone: document.querySelector("#toggle-camera-cone"),
  toggleRadar: document.querySelector("#toggle-radar"),
  batteryText: document.querySelector("#metric-battery-text"),
  batteryFill: document.querySelector("#metric-battery-fill"),
  signalText: document.querySelector("#metric-signal-text"),
  signalFill: document.querySelector("#metric-signal-fill"),
  motorText: document.querySelector("#metric-motor-text"),
  motorFill: document.querySelector("#metric-motor-fill"),
  tractionText: document.querySelector("#metric-traction-text"),
  tractionFill: document.querySelector("#metric-traction-fill"),
  computeText: document.querySelector("#metric-compute-text"),
  computeFill: document.querySelector("#metric-compute-fill"),
  systemStateText: document.querySelector("#system-state-text"),
  healthFill: document.querySelector("#metric-health-fill"),
  alertStrip: document.querySelector("#alert-strip"),
  eventLog: document.querySelector("#event-log"),
  logCaption: document.querySelector("#log-caption"),
};

const state = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  minimapContext: null,
  baseGroup: null,
  vehicleRig: null,
  floor: null,
  grid: null,
  axes: null,
  shadow: null,
  trailLine: null,
  trailMaterial: null,
  navGroup: null,
  navLine: null,
  navTargets: [],
  waypointMarkers: [],
  grassField: null,
  grassTufts: [],
  grassExclusionZones: [],
  envTarget: null,
  pmremGenerator: null,
  hemisphereLight: null,
  sunLight: null,
  streetLights: [],
  modelRoot: null,
  trackSystem: null,
  sensorRig: null,
  sensorSuite: null,
  rainSystem: null,
  pickTargets: [],
  selection: null,
  localBox: new THREE.Box3(),
  localSphere: new THREE.Sphere(),
  modelCenterLocal: new THREE.Vector3(),
  modelBaseRotation: new THREE.Euler(),
  fitDistance: 2.4,
  cameraTween: null,
  cameraFollowOffsetLocal: new THREE.Vector3(1.6, 0.92, 1.45),
  pointerDown: null,
  materialDefaults: new WeakMap(),
  fileSizeBytes: FALLBACK_FILE_SIZE,
  currentView: "iso",
  vehicleAxes: {
    forwardLocal: new THREE.Vector3(0, 0, 1),
    sideLocal: new THREE.Vector3(1, 0, 0),
    length: 1,
    width: 1,
    height: 1,
  },
  motion: {
    enabled: false,
    speed: 0,
    steering: 0,
    heading: 0,
    distance: 0,
    followCamera: true,
    showTrail: true,
    maxSpeed: 1.8,
    maxTurnRate: THREE.MathUtils.degToRad(84),
    maxPivotRate: THREE.MathUtils.degToRad(128),
    trailPoints: [new THREE.Vector3(0, 0.015, 0)],
  },
  mission: {
    editMode: false,
    autopilot: false,
    presetName: "手动",
    currentIndex: 0,
    waypoints: [],
  },
  environment: {
    timeOfDay: 14,
    rainEnabled: false,
    headlightsEnabled: false,
    beaconEnabled: true,
    lidarEnabled: true,
    cameraConeEnabled: true,
    radarEnabled: true,
  },
  diagnostics: {
    battery: 100,
    signal: 100,
    motorTemp: 36,
    traction: 95,
    compute: 18,
    health: 96,
    alerts: [],
    logs: [],
  },
  input: {
    forward: false,
    backward: false,
    left: false,
    right: false,
  },
};

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

init();

function init() {
  dom.heroModelName.textContent = MODEL_URL.split("/").pop();
  state.minimapContext = dom.minimapCanvas.getContext("2d");
  updateSliderReadouts();
  updateDriveUi();
  updateTelemetry();
  setupScene();
  bindUi();
  applyEnvironmentState(true);
  updateDiagnosticsPanel();
  renderMissionList();
  logEvent("系统初始化完成，等待加载模型。", "info");
  animate();
  loadModel();
}

function setupScene() {
  state.scene = new THREE.Scene();
  state.scene.fog = new THREE.Fog(0x08101d, 9, 26);

  const { clientWidth, clientHeight } = dom.sceneContainer;

  state.camera = new THREE.PerspectiveCamera(38, clientWidth / clientHeight, 0.01, 100);
  state.camera.position.set(2.35, 1.35, 2.55);

  state.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  state.renderer.setSize(clientWidth, clientHeight);
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.06;
  state.renderer.setClearColor(0x000000, 0);
  state.renderer.domElement.style.touchAction = "none";
  dom.sceneContainer.appendChild(state.renderer.domElement);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.08;
  state.controls.screenSpacePanning = true;
  state.controls.maxPolarAngle = Math.PI / 2.02;
  state.controls.minDistance = 0.4;
  state.controls.maxDistance = 16;
  state.controls.target.set(0, 0.25, 0);
  state.controls.autoRotate = false;
  state.controls.autoRotateSpeed = 0.9;

  state.pmremGenerator = new THREE.PMREMGenerator(state.renderer);
  state.envTarget = state.pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
  state.scene.environment = state.envTarget.texture;

  state.hemisphereLight = new THREE.HemisphereLight(0xdff8ff, 0x0c1422, 1.15);
  state.scene.add(state.hemisphereLight);

  state.sunLight = new THREE.DirectionalLight(0xfff3d5, 1.55);
  state.sunLight.position.set(2.8, 4.4, 3.2);
  state.scene.add(state.sunLight);

  state.baseGroup = new THREE.Group();
  state.scene.add(state.baseGroup);

  state.floor = new THREE.Mesh(
    new THREE.PlaneGeometry(86, 86),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: createGrassTexture(state.renderer),
      roughness: 1,
      metalness: 0,
    }),
  );
  state.floor.rotation.x = -Math.PI / 2;
  state.floor.position.y = 0;
  state.baseGroup.add(state.floor);
  state.navTargets.push(state.floor);

  state.grassField = new THREE.Mesh(
    new THREE.CircleGeometry(8.2, 96),
    new THREE.MeshStandardMaterial({
      color: 0x568b37,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0.9,
    }),
  );
  state.grassField.rotation.x = -Math.PI / 2;
  state.grassField.position.y = 0.002;
  state.baseGroup.add(state.grassField);

  buildBaseEnvironment();

  state.grid = new THREE.GridHelper(22, 44, 0x5ad2c3, 0x23364f);
  const gridMaterials = Array.isArray(state.grid.material)
    ? state.grid.material
    : [state.grid.material];
  gridMaterials.forEach((material) => {
    material.transparent = true;
    material.opacity = 0.34;
  });
  state.scene.add(state.grid);

  state.axes = new THREE.AxesHelper(0.8);
  state.axes.visible = false;
  state.scene.add(state.axes);

  state.vehicleRig = new THREE.Group();
  state.scene.add(state.vehicleRig);

  state.navGroup = new THREE.Group();
  state.scene.add(state.navGroup);

  state.navLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([]),
    new THREE.LineDashedMaterial({
      color: 0x59d39c,
      dashSize: 0.5,
      gapSize: 0.28,
      transparent: true,
      opacity: 0.9,
    }),
  );
  state.navLine.visible = false;
  state.navGroup.add(state.navLine);

  state.shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 48),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.2,
    }),
  );
  state.shadow.rotation.x = -Math.PI / 2;
  state.shadow.position.y = 0.002;
  state.vehicleRig.add(state.shadow);

  state.trailMaterial = new THREE.LineBasicMaterial({
    color: 0xffb14a,
    transparent: true,
    opacity: 0.82,
  });
  state.trailLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(state.motion.trailPoints),
    state.trailMaterial,
  );
  state.scene.add(state.trailLine);
  buildGrassTufts();
  createRainSystem();

  const resizeObserver = new ResizeObserver(() => {
    resizeRenderer();
  });
  resizeObserver.observe(dom.sceneContainer);

  state.renderer.domElement.addEventListener("pointerdown", (event) => {
    state.pointerDown = { x: event.clientX, y: event.clientY };
  });

  state.renderer.domElement.addEventListener("pointerup", (event) => {
    if (event.button !== 0 || !state.pointerDown) return;

    const deltaX = Math.abs(event.clientX - state.pointerDown.x);
    const deltaY = Math.abs(event.clientY - state.pointerDown.y);
    state.pointerDown = null;

    if (deltaX > 5 || deltaY > 5) return;
    if (state.mission.editMode || event.shiftKey) {
      if (tryAddWaypointFromPointer(event)) return;
    }
    pickMesh(event);
  });

  window.addEventListener("keydown", handleKeyboardShortcuts);
  window.addEventListener("keyup", handleKeyboardRelease);
}

function bindUi() {
  dom.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.view;
      if (!view) return;
      setView(view);
    });
  });

  dom.resetButton.addEventListener("click", () => {
    setView("iso");
  });

  dom.fullscreenButton.addEventListener("click", async () => {
    if (!document.fullscreenElement) {
      await dom.viewerStage.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  });

  dom.runButton.addEventListener("click", () => {
    state.motion.enabled = true;
    updateDriveUi();
  });

  dom.pauseButton.addEventListener("click", () => {
    state.motion.enabled = false;
    stopAutopilot("已暂停车辆与自动巡航。");
    updateDriveUi();
  });

  dom.homeButton.addEventListener("click", () => {
    resetVehiclePose(true);
  });

  dom.clearTrailButton.addEventListener("click", () => {
    clearTrail();
  });

  dom.executeRouteButton.addEventListener("click", () => {
    executeMissionRoute();
  });

  dom.stopRouteButton.addEventListener("click", () => {
    stopAutopilot("已停止自动巡航。");
  });

  dom.clearRouteButton.addEventListener("click", () => {
    clearMissionRoute(true);
  });

  dom.removeWaypointButton.addEventListener("click", () => {
    removeLastWaypoint();
  });

  dom.manualRouteButton.addEventListener("click", () => {
    state.mission.editMode = !state.mission.editMode;
    logEvent(state.mission.editMode ? "手动布点模式已开启。" : "手动布点模式已关闭。", "info");
    updateMissionUi();
  });

  dom.perimeterButton.addEventListener("click", () => {
    loadPresetMission("基地巡检");
  });

  dom.inspectButton.addEventListener("click", () => {
    loadPresetMission("仓储巡检");
  });

  dom.returnButton.addEventListener("click", () => {
    loadPresetMission("返航路线");
  });

  dom.speedSlider.addEventListener("input", () => {
    updateSliderReadouts();
    if (state.mission.autopilot) {
      stopAutopilot("手动速度输入覆盖自动巡航。");
    }
  });

  dom.steerSlider.addEventListener("input", () => {
    updateSliderReadouts();
    if (state.mission.autopilot) {
      stopAutopilot("手动转向输入覆盖自动巡航。");
    }
  });

  dom.toggleFollow.addEventListener("change", () => {
    state.motion.followCamera = dom.toggleFollow.checked;
  });

  dom.toggleTrail.addEventListener("change", () => {
    state.motion.showTrail = dom.toggleTrail.checked;
    state.trailLine.visible = dom.toggleTrail.checked;
  });

  dom.toggleAutorotate.addEventListener("change", () => {
    state.controls.autoRotate = dom.toggleAutorotate.checked;
    dom.viewerCaption.textContent = dom.toggleAutorotate.checked
      ? "自动旋转已开启，适合纯展示"
      : "已开启控制面板，可进行运动演示";
  });

  dom.toggleWireframe.addEventListener("change", () => {
    if (!state.modelRoot) return;

    state.modelRoot.traverse((object) => {
      if (!object.isMesh) return;
      forEachMaterial(object, (material) => {
        material.wireframe = dom.toggleWireframe.checked;
      });
    });
  });

  dom.toggleGrid.addEventListener("change", () => {
    state.grid.visible = dom.toggleGrid.checked;
  });

  dom.toggleAxes.addEventListener("change", () => {
    state.axes.visible = dom.toggleAxes.checked;
  });

  dom.timeSlider.addEventListener("input", () => {
    state.environment.timeOfDay = parseFloat(dom.timeSlider.value);
    applyEnvironmentState();
  });

  dom.toggleRain.addEventListener("change", () => {
    state.environment.rainEnabled = dom.toggleRain.checked;
    applyEnvironmentState();
    logEvent(dom.toggleRain.checked ? "雨天环境已启用。" : "雨天环境已关闭。", "info");
  });

  dom.toggleHeadlights.addEventListener("change", () => {
    state.environment.headlightsEnabled = dom.toggleHeadlights.checked;
    applyEnvironmentState();
  });

  dom.toggleBeacon.addEventListener("change", () => {
    state.environment.beaconEnabled = dom.toggleBeacon.checked;
    applyEnvironmentState();
  });

  dom.toggleLidar.addEventListener("change", () => {
    state.environment.lidarEnabled = dom.toggleLidar.checked;
    applyEnvironmentState();
  });

  dom.toggleCameraCone.addEventListener("change", () => {
    state.environment.cameraConeEnabled = dom.toggleCameraCone.checked;
    applyEnvironmentState();
  });

  dom.toggleRadar.addEventListener("change", () => {
    state.environment.radarEnabled = dom.toggleRadar.checked;
    applyEnvironmentState();
  });
}

function handleKeyboardShortcuts(event) {
  if (event.target instanceof HTMLInputElement) return;

  if (event.code === "Digit1") setView("iso");
  if (event.code === "Digit2") setView("front");
  if (event.code === "Digit3") setView("left");
  if (event.code === "Digit4") setView("top");

  if (event.code === "KeyW") {
    interruptAutopilotForManual();
    state.input.forward = true;
    state.motion.enabled = true;
  }
  if (event.code === "KeyS") {
    interruptAutopilotForManual();
    state.input.backward = true;
    state.motion.enabled = true;
  }
  if (event.code === "KeyA") {
    interruptAutopilotForManual();
    state.input.left = true;
    state.motion.enabled = true;
  }
  if (event.code === "KeyD") {
    interruptAutopilotForManual();
    state.input.right = true;
    state.motion.enabled = true;
  }

  if (event.code === "Space") {
    event.preventDefault();
    emergencyStop();
  }

  if (event.code === "KeyF") {
    dom.fullscreenButton.click();
  }

  if (event.code === "KeyR") {
    resetVehiclePose(true);
  }

  if (event.code === "KeyT") {
    dom.toggleTrail.checked = !dom.toggleTrail.checked;
    dom.toggleTrail.dispatchEvent(new Event("change"));
  }

  if (event.code === "KeyG") {
    dom.toggleFollow.checked = !dom.toggleFollow.checked;
    dom.toggleFollow.dispatchEvent(new Event("change"));
  }

  if (event.code === "KeyX") {
    dom.toggleWireframe.checked = !dom.toggleWireframe.checked;
    dom.toggleWireframe.dispatchEvent(new Event("change"));
  }

  updateDriveUi();
}

function handleKeyboardRelease(event) {
  if (event.code === "KeyW") state.input.forward = false;
  if (event.code === "KeyS") state.input.backward = false;
  if (event.code === "KeyA") state.input.left = false;
  if (event.code === "KeyD") state.input.right = false;
}

function loadModel() {
  setStatus("加载中", "loading");
  setLoadingProgress(0.02, "准备读取模型资源...");

  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      state.modelRoot = gltf.scene || gltf.scenes[0];
      state.modelRoot.userData.sourceName = state.modelRoot.name || "";
      state.modelRoot.name = MODEL_LABEL;
      state.vehicleRig.add(state.modelRoot);

      state.pickTargets = [];
      state.modelRoot.traverse((object) => {
        if (!object.isMesh) return;

        state.pickTargets.push(object);
        object.frustumCulled = true;

        forEachMaterial(object, (material) => {
          captureMaterialDefaults(material);
          material.envMapIntensity = 1.15;
          material.needsUpdate = true;
        });
      });

      normalizeModelPlacement();
      createSensorSuite();
      updateModelStats(gltf);
      clearTrail();
      setView("iso", false);
      setStatus("已加载", "ready");
      setLoadingProgress(1, "模型加载完成");
      dom.loadingPanel.classList.add("is-hidden");
      dom.viewerCaption.textContent = "已载入基地场景，可直接控制小车穿行道路与作业区";
      applyEnvironmentState(true);
      updateMissionUi();
      logEvent("模型与高级控制系统已就绪。", "success");
      updateTelemetry();
    },
    (event) => {
      if (!event) return;

      const total = event.total || state.fileSizeBytes || FALLBACK_FILE_SIZE;
      state.fileSizeBytes = total;
      const ratio = total ? Math.min(event.loaded / total, 0.98) : 0.15;
      setLoadingProgress(
        ratio,
        `正在加载 ${formatBytes(event.loaded)} / ${formatBytes(total)}`,
      );
    },
    (error) => {
      console.error(error);
      dom.loadingPanel.classList.remove("is-hidden");
      setLoadingProgress(1, "模型加载失败，请确认资源路径或控制台错误");
      setStatus("加载失败", "error");
      dom.statStatus.textContent = "加载失败";
      dom.viewerCaption.textContent = "资源未能正确加载";
    },
  );
}

function normalizeModelPlacement() {
  if (!state.modelRoot) return;

  const sourceBox = new THREE.Box3().setFromObject(state.modelRoot);
  const sourceCenter = sourceBox.getCenter(new THREE.Vector3());
  state.modelRoot.position.x -= sourceCenter.x;
  state.modelRoot.position.z -= sourceCenter.z;
  state.modelRoot.position.y -= sourceBox.min.y;

  state.localBox.setFromObject(state.modelRoot);
  state.localBox.getBoundingSphere(state.localSphere);
  state.modelCenterLocal.copy(state.localBox.getCenter(new THREE.Vector3()));
  state.modelBaseRotation.copy(state.modelRoot.rotation);
  state.fitDistance = Math.max(computeFitDistance(state.localSphere.radius), 1.4);

  const size = state.localBox.getSize(new THREE.Vector3());
  if (size.x >= size.z) {
    state.vehicleAxes.forwardLocal.set(1, 0, 0);
    state.vehicleAxes.sideLocal.set(0, 0, 1);
    state.vehicleAxes.length = size.x;
    state.vehicleAxes.width = size.z;
  } else {
    state.vehicleAxes.forwardLocal.set(0, 0, 1);
    state.vehicleAxes.sideLocal.set(1, 0, 0);
    state.vehicleAxes.length = size.z;
    state.vehicleAxes.width = size.x;
  }
  state.vehicleAxes.height = size.y;
  const footprint = Math.max(size.x, size.z);
  state.shadow.scale.setScalar(Math.max(0.6, footprint * 0.9));
  state.grassField.scale.setScalar(Math.max(1.1, footprint * 1.6));
  buildTrackSystem();
}

function updateModelStats(gltf) {
  if (!state.modelRoot) return;

  let meshCount = 0;
  let triangleCount = 0;
  let vertexCount = 0;
  let maxTextureSize = 0;
  const materialSet = new Set();
  const textureSet = new Set();

  state.modelRoot.traverse((object) => {
    if (!object.isMesh) return;
    meshCount += 1;

    const position = object.geometry?.getAttribute("position");
    if (position) {
      vertexCount += position.count;
      triangleCount += object.geometry.index ? object.geometry.index.count / 3 : position.count / 3;
    }

    forEachMaterial(object, (material) => {
      materialSet.add(material);
      ["map", "normalMap", "metalnessMap", "roughnessMap", "emissiveMap"].forEach((key) => {
        const texture = material[key];
        if (!texture || textureSet.has(texture)) return;
        textureSet.add(texture);
        const width = texture.image?.width || 0;
        const height = texture.image?.height || 0;
        maxTextureSize = Math.max(maxTextureSize, width, height);
      });
    });
  });

  const size = state.localBox.getSize(new THREE.Vector3());
  const tags = [];

  if (state.fileSizeBytes >= 50_000_000) tags.push("大体积模型");
  if (meshCount === 1) tags.push("单网格导出");
  if (triangleCount >= 1_000_000) tags.push("高面数");
  if (maxTextureSize >= 4096) tags.push("4K 贴图");
  if (!gltf.animations.length) tags.push("无动画");
  tags.push("已接入运动演示");
  tags.push("基地道路与建筑");
  tags.push("程序化草地");
  tags.push("动态履带");

  dom.statName.textContent = MODEL_LABEL;
  dom.statStatus.textContent = "已加载";
  dom.statSize.textContent = formatBytes(state.fileSizeBytes);
  dom.statMeshes.textContent = meshCount.toLocaleString("zh-CN");
  dom.statMaterials.textContent = materialSet.size.toLocaleString("zh-CN");
  dom.statTriangles.textContent = Math.round(triangleCount).toLocaleString("zh-CN");
  dom.statVertices.textContent = vertexCount.toLocaleString("zh-CN");
  dom.statAnimations.textContent = gltf.animations.length.toLocaleString("zh-CN");
  dom.statDimensions.textContent = `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m`;

  dom.modelTags.replaceChildren(
    ...tags.map((label) => {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = label;
      return tag;
    }),
  );

  dom.selectionNote.textContent =
    meshCount === 1
      ? "当前 GLB 导出为单网格结构，点击时会高亮整车。如需按履带、车体、机械臂分别交互，需要在 Blender 中拆成多个对象后重新导出。"
      : "模型包含多个网格对象，点击时可对单个部件进行高亮。";
}

function setView(viewName, animateTransition = true) {
  if (!state.modelRoot || !LOCAL_VIEW_OFFSETS[viewName]) return;

  state.currentView = viewName;
  updateViewButtons();

  const direction = getWorldViewDirection(viewName);
  const distance = state.fitDistance * (viewName === "top" ? 1.08 : 1);
  const nextTarget = getVehicleCenterWorld();
  const nextPosition = nextTarget.clone().addScaledVector(direction, distance);
  state.cameraFollowOffsetLocal.copy(getLocalViewDirection(viewName).multiplyScalar(distance));

  state.camera.near = Math.max(distance / 100, 0.01);
  state.camera.far = distance * 40;
  state.camera.updateProjectionMatrix();

  if (!animateTransition) {
    state.camera.position.copy(nextPosition);
    state.controls.target.copy(nextTarget);
    state.controls.update();
    return;
  }

  state.cameraTween = {
    fromPosition: state.camera.position.clone(),
    toPosition: nextPosition,
    fromTarget: state.controls.target.clone(),
    toTarget: nextTarget,
    startTime: performance.now(),
    duration: 560,
  };
}

function updateViewButtons() {
  dom.viewButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.currentView);
  });
}

function pickMesh(event) {
  if (!state.modelRoot || state.pickTargets.length === 0) return;

  state.scene.updateMatrixWorld(true);

  const rect = state.renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, state.camera);
  const hits = raycaster.intersectObjects(state.pickTargets, false);

  if (!hits.length) {
    selectMesh(null);
    return;
  }

  selectMesh(hits[0].object);
}

function selectMesh(mesh) {
  if (state.selection === mesh) return;

  highlightMesh(state.selection, false);
  state.selection = mesh;
  highlightMesh(mesh, true);
  dom.selectionValue.textContent = mesh ? getDisplayName(mesh) : "未选中";
}

function highlightMesh(mesh, active) {
  if (!mesh) return;

  forEachMaterial(mesh, (material) => {
    const defaults = captureMaterialDefaults(material);
    if (!("emissive" in material)) return;

    if (active) {
      material.emissive.set(0xff6b2c);
      material.emissiveIntensity = 0.55;
      return;
    }

    material.emissive.copy(defaults.emissive);
    material.emissiveIntensity = defaults.emissiveIntensity;
  });
}

function getDisplayName(object) {
  if (!object) return "未选中";

  const rawName = object.name?.trim();
  if (!rawName || /^node_\d+$/i.test(rawName)) {
    return `${MODEL_LABEL}主网格`;
  }
  return rawName;
}

function captureMaterialDefaults(material) {
  if (state.materialDefaults.has(material)) {
    return state.materialDefaults.get(material);
  }

  const defaults = {
    emissive: "emissive" in material ? material.emissive.clone() : new THREE.Color(0x000000),
    emissiveIntensity: material.emissiveIntensity ?? 1,
  };
  state.materialDefaults.set(material, defaults);
  return defaults;
}

function animate() {
  requestAnimationFrame(animate);

  const deltaTime = Math.min(clock.getDelta(), 0.05);

  if (state.cameraTween) {
    const elapsed = performance.now() - state.cameraTween.startTime;
    const t = Math.min(elapsed / state.cameraTween.duration, 1);
    const eased = easeInOutCubic(t);

    state.camera.position.lerpVectors(
      state.cameraTween.fromPosition,
      state.cameraTween.toPosition,
      eased,
    );
    state.controls.target.lerpVectors(
      state.cameraTween.fromTarget,
      state.cameraTween.toTarget,
      eased,
    );

    if (t >= 1) {
      state.cameraTween = null;
    }
  }

  updateVehicle(deltaTime);
  updateRainSystem(deltaTime);
  updateSensorSuite(deltaTime);
  updateDiagnostics(deltaTime);
  renderMinimap();
  state.controls.update();
  state.renderer.render(state.scene, state.camera);
}

function updateVehicle(deltaTime) {
  if (!state.modelRoot) return;

  const motion = state.motion;
  const controls = motion.enabled ? getControlTargets() : { speed: 0, steering: 0 };
  const targetSpeed = controls.speed;
  const targetSteering = controls.steering;

  motion.speed = THREE.MathUtils.damp(motion.speed, targetSpeed, 5.5, deltaTime);
  motion.steering = THREE.MathUtils.damp(motion.steering, targetSteering, 7.5, deltaTime);

  let yawDelta = 0;
  if (Math.abs(motion.speed) > 0.025) {
    const speedFactor = THREE.MathUtils.clamp(Math.abs(motion.speed) / motion.maxSpeed, 0, 1);
    yawDelta = motion.steering * motion.maxTurnRate * (0.35 + speedFactor * 0.65) * deltaTime;
  } else if (motion.enabled && Math.abs(motion.steering) > 0.05) {
    yawDelta = motion.steering * motion.maxPivotRate * deltaTime;
  }

  motion.heading += yawDelta;
  state.vehicleRig.rotation.y = motion.heading;

  const forwardDelta = getWorldForwardVector()
    .multiplyScalar(motion.speed * deltaTime);
  state.vehicleRig.position.add(forwardDelta);
  motion.distance += forwardDelta.length();

  updateBodyPosture(deltaTime);
  updateTrackMotion(deltaTime, yawDelta);
  updateTrail();
  followVehicleCamera(deltaTime);
  updateTelemetry();
  updateDriveUi();
}

function updateBodyPosture(deltaTime) {
  if (!state.modelRoot) return;

  const pitchTarget =
    state.modelBaseRotation.x -
    THREE.MathUtils.clamp(state.motion.speed / state.motion.maxSpeed, -1, 1) * 0.045;
  const rollTarget =
    state.modelBaseRotation.z - THREE.MathUtils.clamp(state.motion.steering, -1, 1) * 0.055;

  state.modelRoot.rotation.x = THREE.MathUtils.damp(
    state.modelRoot.rotation.x,
    pitchTarget,
    6,
    deltaTime,
  );
  state.modelRoot.rotation.z = THREE.MathUtils.damp(
    state.modelRoot.rotation.z,
    rollTarget,
    6,
    deltaTime,
  );

  state.shadow.material.opacity = 0.18 + Math.abs(state.motion.speed) * 0.035;
}

function followVehicleCamera(deltaTime) {
  if (!state.motion.followCamera || state.cameraTween || !state.modelRoot) return;

  const nextTarget = getVehicleCenterWorld();
  const desiredPosition = nextTarget
    .clone()
    .add(state.cameraFollowOffsetLocal.clone().applyAxisAngle(WORLD_UP, state.motion.heading));
  const alpha = 1 - Math.exp(-5.5 * deltaTime);
  state.controls.target.lerp(nextTarget, alpha);
  state.camera.position.lerp(desiredPosition, alpha);
}

function getEffectiveSpeedTarget() {
  if (state.input.forward && !state.input.backward) {
    return state.motion.maxSpeed * 0.88;
  }

  if (state.input.backward && !state.input.forward) {
    return -state.motion.maxSpeed * 0.66;
  }

  return parseFloat(dom.speedSlider.value);
}

function getEffectiveSteeringTarget() {
  if (state.input.left && !state.input.right) {
    return -1;
  }

  if (state.input.right && !state.input.left) {
    return 1;
  }

  return parseFloat(dom.steerSlider.value) / 100;
}

function getControlTargets() {
  if (state.mission.autopilot) {
    return getAutopilotTargets();
  }

  return {
    speed: getEffectiveSpeedTarget(),
    steering: getEffectiveSteeringTarget(),
  };
}

function updateDriveUi() {
  const mode = getDriveModeLabel();
  dom.driveMode.textContent = mode;
  dom.hudMode.textContent = mode;
  dom.runButton.classList.toggle("active", state.motion.enabled);
  dom.pauseButton.classList.toggle("active", !state.motion.enabled);
}

function getDriveModeLabel() {
  if (state.mission.autopilot) {
    return "自动执行";
  }

  if (state.motion.enabled) {
    const hasInput =
      Math.abs(getEffectiveSpeedTarget()) > 0.01 ||
      Math.abs(getEffectiveSteeringTarget()) > 0.01 ||
      Math.abs(state.motion.speed) > 0.02;
    return hasInput ? "运行中" : "就绪";
  }

  if (Math.abs(state.motion.speed) > 0.02) {
    return "减速中";
  }

  return "待机";
}

function updateSliderReadouts() {
  dom.speedReadout.textContent = `${parseFloat(dom.speedSlider.value).toFixed(2)} m/s`;
  dom.steerReadout.textContent = `${parseFloat(dom.steerSlider.value).toFixed(0)}%`;
}

function updateTelemetry() {
  const x = state.vehicleRig?.position.x || 0;
  const z = state.vehicleRig?.position.z || 0;
  const headingDegrees = THREE.MathUtils.radToDeg(state.motion.heading);
  const steeringPercent = state.motion.steering * 100;
  const speedText = `${state.motion.speed.toFixed(2)} m/s`;
  const steeringText = `${steeringPercent.toFixed(0)}%`;
  const headingText = `${headingDegrees.toFixed(1)}°`;
  const positionText = `(${x.toFixed(2)}, ${z.toFixed(2)})`;
  const distanceText = `${state.motion.distance.toFixed(2)} m`;

  dom.driveSpeed.textContent = speedText;
  dom.driveSteering.textContent = steeringText;
  dom.driveHeading.textContent = headingText;
  dom.drivePosition.textContent = positionText;
  dom.driveDistance.textContent = distanceText;
  dom.hudSpeed.textContent = speedText;
  dom.hudHeading.textContent = headingText;
  dom.hudPosition.textContent = positionText;
}

function updateTrail(force = false) {
  if (!state.trailLine) return;

  state.trailLine.visible = state.motion.showTrail;

  const point = new THREE.Vector3(state.vehicleRig.position.x, 0.015, state.vehicleRig.position.z);
  const lastPoint = state.motion.trailPoints[state.motion.trailPoints.length - 1];
  const hasMoved = !lastPoint || lastPoint.distanceToSquared(point) > 0.004;

  if (!force && !hasMoved) return;

  state.motion.trailPoints.push(point);
  if (state.motion.trailPoints.length > 1200) {
    state.motion.trailPoints.shift();
  }

  state.trailLine.geometry.dispose();
  state.trailLine.geometry = new THREE.BufferGeometry().setFromPoints(state.motion.trailPoints);
}

function clearTrail() {
  state.motion.trailPoints = [new THREE.Vector3(state.vehicleRig.position.x, 0.015, state.vehicleRig.position.z)];
  state.trailLine.geometry.dispose();
  state.trailLine.geometry = new THREE.BufferGeometry().setFromPoints(state.motion.trailPoints);
  state.trailLine.visible = state.motion.showTrail;
}

function emergencyStop() {
  state.motion.enabled = false;
  stopAutopilot("急停触发，自动巡航已退出。");
  dom.speedSlider.value = "0";
  dom.steerSlider.value = "0";
  updateSliderReadouts();
  updateDriveUi();
  logEvent("已执行急停。", "warning");
}

function resetVehiclePose(resetInputs = false) {
  state.motion.enabled = false;
  state.mission.autopilot = false;
  state.mission.currentIndex = 0;
  state.motion.speed = 0;
  state.motion.steering = 0;
  state.motion.heading = 0;
  state.motion.distance = 0;

  state.input.forward = false;
  state.input.backward = false;
  state.input.left = false;
  state.input.right = false;

  state.vehicleRig.position.set(0, 0, 0);
  state.vehicleRig.rotation.set(0, 0, 0);

  if (state.modelRoot) {
    state.modelRoot.rotation.copy(state.modelBaseRotation);
  }

  if (state.trackSystem?.tracks) {
    state.trackSystem.tracks.forEach((track) => {
      track.phase = 0;
      updateTrackLinks(track);
    });
  }

  if (resetInputs) {
    dom.speedSlider.value = "0";
    dom.steerSlider.value = "0";
    updateSliderReadouts();
  }

  clearTrail();
  updateMissionGeometry();
  updateMissionUi();
  updateDriveUi();
  updateTelemetry();
  if (state.modelRoot) {
    setView(state.currentView, false);
  }
  logEvent("车辆姿态已复位。", "info");
}

function getVehicleCenterWorld() {
  if (!state.modelRoot) {
    return new THREE.Vector3(0, 0.25, 0);
  }

  state.vehicleRig.updateMatrixWorld(true);
  return state.modelCenterLocal.clone().applyMatrix4(state.vehicleRig.matrixWorld);
}

function getLocalViewDirection(viewName) {
  const descriptor = LOCAL_VIEW_OFFSETS[viewName];
  return state.vehicleAxes.forwardLocal
    .clone()
    .multiplyScalar(descriptor.forward)
    .addScaledVector(WORLD_UP, descriptor.up)
    .addScaledVector(state.vehicleAxes.sideLocal, descriptor.side)
    .normalize();
}

function getWorldViewDirection(viewName) {
  return getLocalViewDirection(viewName).applyAxisAngle(WORLD_UP, state.motion.heading);
}

function getWorldForwardVector() {
  return state.vehicleAxes.forwardLocal.clone().applyAxisAngle(WORLD_UP, state.motion.heading);
}

function getWorldSideVector() {
  return state.vehicleAxes.sideLocal.clone().applyAxisAngle(WORLD_UP, state.motion.heading);
}

function buildBaseEnvironment() {
  state.grassExclusionZones = [];

  const asphaltMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createAsphaltTexture(state.renderer),
    roughness: 0.96,
    metalness: 0.04,
  });
  const concreteMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createConcreteTexture(state.renderer, "#8793a0", "#636d79"),
    roughness: 0.95,
    metalness: 0.02,
  });
  const lightConcreteMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createConcreteTexture(state.renderer, "#b5bcc5", "#7d8791"),
    roughness: 0.95,
    metalness: 0.02,
  });

  addGroundRect(state.baseGroup, 66, 7.2, 0, 0, 0.006, asphaltMaterial, 0.4);
  registerGrassExclusion(0, 0, 68, 9);
  addGroundRect(state.baseGroup, 6.4, 50, 14, -1, 0.006, asphaltMaterial, 0.18);
  registerGrassExclusion(14, -1, 8.4, 52);
  addGroundRect(state.baseGroup, 5.4, 24, -18, 9, 0.006, asphaltMaterial, -0.05);
  registerGrassExclusion(-18, 9, 7.4, 26);

  addGroundRect(state.baseGroup, 20, 14, -13, -13.5, 0.008, concreteMaterial);
  registerGrassExclusion(-13, -13.5, 22, 16, 0.8);
  addGroundRect(state.baseGroup, 22, 16, 18, 13, 0.008, lightConcreteMaterial, 0.1);
  registerGrassExclusion(18, 13, 24, 18, 0.8);
  addGroundRect(state.baseGroup, 14, 10, 4.5, 22, 0.008, concreteMaterial, 0.06);
  registerGrassExclusion(4.5, 22, 16, 12, 0.7);
  addGroundRect(state.baseGroup, 11, 9, 28, -18, 0.008, lightConcreteMaterial, -0.08);
  registerGrassExclusion(28, -18, 13, 11, 0.6);

  addRoadMarkings();
  addParkingMarkings(21.5, 12.8);
  addParkingMarkings(5.2, 22.2, Math.PI / 2);

  const adminMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createFacadeTexture(state.renderer, "#7a8796", "#b8d2f0", "#44515f"),
    roughness: 0.9,
    metalness: 0.06,
  });
  const warehouseMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createFacadeTexture(state.renderer, "#6a7278", "#98b1c8", "#3b434b"),
    roughness: 0.92,
    metalness: 0.06,
  });
  const serviceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: createFacadeTexture(state.renderer, "#7f7c6c", "#d5d8db", "#514c3f"),
    roughness: 0.9,
    metalness: 0.04,
  });

  addBuildingBlock({
    x: 18.5,
    z: 13,
    width: 18,
    depth: 12,
    height: 6.2,
    wallMaterial: adminMat,
    roofColor: 0x56606b,
    accentColor: 0x2c3746,
  });
  addBuildingBlock({
    x: -13,
    z: -13.4,
    width: 16,
    depth: 10,
    height: 4.8,
    wallMaterial: warehouseMat,
    roofColor: 0x494f56,
    accentColor: 0x2a2f35,
    canopy: true,
  });
  addBuildingBlock({
    x: 4.6,
    z: 22.4,
    width: 12,
    depth: 8,
    height: 3.9,
    wallMaterial: serviceMat,
    roofColor: 0x5a4f44,
    accentColor: 0x40372f,
  });
  addBuildingBlock({
    x: 28.5,
    z: -18.3,
    width: 7,
    depth: 6,
    height: 3.4,
    wallMaterial: adminMat,
    roofColor: 0x46515c,
    accentColor: 0x232c35,
  });

  addContainerStack(-3.5, 20.5, 0x316ea8, 3);
  addContainerStack(-1.8, 22.2, 0x4d9556, 2);
  addContainerStack(1.3, 20.1, 0xb27a2a, 2);
  addUtilityTank(-24.5, 15.5);
  addSecurityFence(70, 70, 2.8);
  addStreetLamp(-21, -8);
  addStreetLamp(-6, -8);
  addStreetLamp(8, -8);
  addStreetLamp(22, -8);
  addStreetLamp(22, 8);
  addStreetLamp(22, 22);
  addStreetLamp(-18, 16);
}

function buildGrassTufts() {
  const bladeGeometry = createGrassBladeGeometry();
  const bladeMaterial = new THREE.MeshLambertMaterial({
    color: 0x5e9d3f,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.94,
    vertexColors: true,
  });

  const secondaryMaterial = bladeMaterial.clone();
  const tuftCount = 1200;
  const dummy = new THREE.Object3D();
  const colors = [new THREE.Color(0x5a9637), new THREE.Color(0x6aa847), new THREE.Color(0x497f2d)];

  const tuftA = new THREE.InstancedMesh(bladeGeometry, bladeMaterial, tuftCount);
  const tuftB = new THREE.InstancedMesh(bladeGeometry, secondaryMaterial, tuftCount);

  tuftA.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tuftB.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  let built = 0;
  for (let attempt = 0; attempt < tuftCount * 6 && built < tuftCount; attempt += 1) {
    const x = THREE.MathUtils.randFloatSpread(78);
    const z = THREE.MathUtils.randFloatSpread(78);
    if (!canPlaceGrass(x, z)) continue;

    const scale = 0.7 + Math.random() * 1.35;
    const baseRotation = Math.random() * Math.PI * 2;

    dummy.position.set(x, 0.01, z);
    dummy.rotation.set(0, baseRotation, 0);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    tuftA.setMatrixAt(built, dummy.matrix);
    tuftA.setColorAt(built, colors[built % colors.length]);

    dummy.rotation.set(0, baseRotation + Math.PI / 2, 0);
    dummy.updateMatrix();
    tuftB.setMatrixAt(built, dummy.matrix);
    tuftB.setColorAt(built, colors[(built + 1) % colors.length]);
    built += 1;
  }

  tuftA.count = built;
  tuftB.count = built;
  state.grassTufts = [tuftA, tuftB];
  state.baseGroup.add(tuftA);
  state.baseGroup.add(tuftB);
}

function createGrassBladeGeometry() {
  const geometry = new THREE.PlaneGeometry(0.14, 0.42, 1, 5);
  const position = geometry.attributes.position;
  const color = [];

  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i) + 0.21;
    const ratio = THREE.MathUtils.clamp(y / 0.42, 0, 1);
    const taper = 1 - ratio * 0.75;
    position.setX(i, position.getX(i) * taper);
    position.setZ(i, Math.sin(ratio * Math.PI) * 0.04 * ratio);

    const bladeColor = new THREE.Color().lerpColors(
      new THREE.Color(0x3c6c24),
      new THREE.Color(0x8fd05a),
      ratio,
    );
    color.push(bladeColor.r, bladeColor.g, bladeColor.b);
  }

  geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createGrassTexture(renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(512, 420, 80, 512, 512, 620);
  gradient.addColorStop(0, "#5f9e3d");
  gradient.addColorStop(0.55, "#356a2b");
  gradient.addColorStop(1, "#1b3b18");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 24000; i += 1) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const w = 2 + Math.random() * 8;
    const h = 2 + Math.random() * 8;
    const tone = 34 + Math.floor(Math.random() * 70);
    ctx.fillStyle = `rgba(${tone}, ${88 + Math.floor(Math.random() * 90)}, ${26 + Math.floor(Math.random() * 30)}, ${0.08 + Math.random() * 0.16})`;
    ctx.fillRect(x, y, w, h);
  }

  for (let i = 0; i < 260; i += 1) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(115, 87, 44, ${0.02 + Math.random() * 0.05})`;
    ctx.arc(Math.random() * 1024, Math.random() * 1024, 8 + Math.random() * 20, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createAsphaltTexture(renderer) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#40454b";
  ctx.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 20000; i += 1) {
    const shade = 48 + Math.floor(Math.random() * 58);
    ctx.fillStyle = `rgba(${shade}, ${shade}, ${shade + 2}, ${0.06 + Math.random() * 0.18})`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2 + Math.random() * 6, 2 + Math.random() * 6);
  }

  for (let i = 0; i < 180; i += 1) {
    ctx.strokeStyle = `rgba(0, 0, 0, ${0.04 + Math.random() * 0.06})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 1024, Math.random() * 1024);
    ctx.lineTo(Math.random() * 1024, Math.random() * 1024);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createConcreteTexture(renderer, lightTone, darkTone) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = lightTone;
  ctx.fillRect(0, 0, 1024, 1024);

  for (let i = 0; i < 16000; i += 1) {
    ctx.globalAlpha = 0.03 + Math.random() * 0.08;
    ctx.fillStyle = darkTone;
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 4 + Math.random() * 14, 4 + Math.random() * 14);
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i <= 1024; i += 128) {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(1024, i);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createFacadeTexture(renderer, baseColor, windowColor, accentColor) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = accentColor;
  for (let row = 0; row < 12; row += 1) {
    ctx.fillRect(0, row * 84 + 4, 1024, 8);
  }

  for (let y = 54; y < 920; y += 120) {
    for (let x = 56; x < 960; x += 122) {
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x - 4, y - 4, 68, 46);
      ctx.fillStyle = windowColor;
      ctx.fillRect(x, y, 60, 38);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(x + 5, y + 5, 50, 4);
    }
  }

  ctx.fillStyle = "rgba(28, 32, 38, 0.9)";
  ctx.fillRect(452, 772, 120, 252);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(474, 798, 76, 18);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addGroundRect(group, width, depth, x, z, y, material, rotation = 0) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.set(-Math.PI / 2, rotation, 0);
  mesh.position.set(x, y, z);
  group.add(mesh);
  state.navTargets.push(mesh);
  return mesh;
}

function addRoadMarkings() {
  const markingMaterial = new THREE.MeshBasicMaterial({
    color: 0xf5e8a7,
    transparent: true,
    opacity: 0.9,
  });

  for (let x = -28; x <= 28; x += 6) {
    addGroundRect(state.baseGroup, 2.6, 0.18, x, 0, 0.011, markingMaterial);
  }

  for (let z = -20; z <= 20; z += 5.5) {
    addGroundRect(state.baseGroup, 0.18, 2.4, 14, z, 0.011, markingMaterial);
  }

  addGroundRect(state.baseGroup, 66, 0.18, 0, 3.35, 0.011, markingMaterial, 0);
  addGroundRect(state.baseGroup, 66, 0.18, 0, -3.35, 0.011, markingMaterial, 0);
}

function addParkingMarkings(x, z, rotation = 0) {
  const markingMaterial = new THREE.MeshBasicMaterial({
    color: 0xe7edf5,
    transparent: true,
    opacity: 0.8,
  });

  for (let i = -2; i <= 2; i += 1) {
    const stripe = addGroundRect(state.baseGroup, 0.16, 2.8, x + i * 2.7, z, 0.011, markingMaterial);
    stripe.rotation.z += rotation;
  }
}

function addBuildingBlock({ x, z, width, depth, height, wallMaterial, roofColor, accentColor, canopy = false }) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), wallMaterial);
  base.position.set(x, height / 2, z);
  state.baseGroup.add(base);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.8, 0.46, depth + 0.8),
    new THREE.MeshStandardMaterial({
      color: roofColor,
      roughness: 0.86,
      metalness: 0.08,
    }),
  );
  roof.position.set(x, height + 0.22, z);
  state.baseGroup.add(roof);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.2, 0.24, depth + 0.2),
    new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.92,
      metalness: 0.04,
    }),
  );
  trim.position.set(x, 0.12, z);
  state.baseGroup.add(trim);

  if (canopy) {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.52, 0.22, 2.2),
      new THREE.MeshStandardMaterial({
        color: 0x32363a,
        roughness: 0.9,
        metalness: 0.06,
      }),
    );
    awning.position.set(x, height * 0.58, z + depth * 0.52);
    state.baseGroup.add(awning);
  }
}

function addContainerStack(x, z, color, levels) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.8,
    metalness: 0.18,
  });

  for (let level = 0; level < levels; level += 1) {
    const container = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.25, 1.05), material);
    container.position.set(x, 0.65 + level * 1.28, z);
    state.baseGroup.add(container);
  }
}

function addUtilityTank(x, z) {
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 3.2, 28),
    new THREE.MeshStandardMaterial({
      color: 0xd7dde6,
      roughness: 0.82,
      metalness: 0.12,
    }),
  );
  body.rotation.z = Math.PI / 2;
  body.position.set(x, 1.2, z);
  state.baseGroup.add(body);

  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, 0.28, 2.2),
    new THREE.MeshStandardMaterial({
      color: 0x727c86,
      roughness: 0.92,
      metalness: 0.08,
    }),
  );
  stand.position.set(x, 0.14, z);
  state.baseGroup.add(stand);
}

function addSecurityFence(width, depth, spacing) {
  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x656d74,
    roughness: 0.92,
    metalness: 0.1,
  });
  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x808991,
    roughness: 0.9,
    metalness: 0.08,
  });

  const halfW = width / 2;
  const halfD = depth / 2;

  for (let x = -halfW; x <= halfW; x += spacing) {
    addFencePost(x, -halfD, postMaterial);
    addFencePost(x, halfD, postMaterial);
  }
  for (let z = -halfD + spacing; z < halfD; z += spacing) {
    addFencePost(-halfW, z, postMaterial);
    addFencePost(halfW, z, postMaterial);
  }

  addFenceRail(0, -halfD, width, 0.16, railMaterial);
  addFenceRail(0, halfD, width, 0.16, railMaterial);
  addFenceRail(-halfW, 0, depth, Math.PI / 2, railMaterial);
  addFenceRail(halfW, 0, depth, Math.PI / 2, railMaterial);
}

function addFencePost(x, z, material) {
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 0.18), material);
  post.position.set(x, 0.9, z);
  state.baseGroup.add(post);
}

function addFenceRail(x, z, length, rotation, material) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.08), material);
  rail.position.set(x, 1.2, z);
  rail.rotation.y = rotation;
  state.baseGroup.add(rail);
}

function addStreetLamp(x, z) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.11, 4.5, 14),
    new THREE.MeshStandardMaterial({
      color: 0x4f5965,
      roughness: 0.88,
      metalness: 0.2,
    }),
  );
  pole.position.set(x, 2.25, z);
  state.baseGroup.add(pole);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.08),
    pole.material,
  );
  arm.position.set(x + 0.36, 4.3, z);
  state.baseGroup.add(arm);

  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.14, 0.24),
    new THREE.MeshStandardMaterial({
      color: 0xf0e7b5,
      emissive: 0xc4ab60,
      emissiveIntensity: 0.7,
      roughness: 0.4,
      metalness: 0.04,
    }),
  );
  lamp.position.set(x + 0.72, 4.22, z);
  state.baseGroup.add(lamp);

  const light = new THREE.PointLight(0xf2d68c, 0.8, 9, 2);
  light.position.set(x + 0.72, 4.1, z);
  state.baseGroup.add(light);
  state.streetLights.push({ mesh: lamp, light });
}

function registerGrassExclusion(x, z, width, depth, padding = 0.4) {
  state.grassExclusionZones.push({
    minX: x - width / 2 - padding,
    maxX: x + width / 2 + padding,
    minZ: z - depth / 2 - padding,
    maxZ: z + depth / 2 + padding,
  });
}

function canPlaceGrass(x, z) {
  if (Math.abs(x) > 40 || Math.abs(z) > 40) return false;
  if (x > -3 && x < 6 && z > -4 && z < 5) return false;

  return !state.grassExclusionZones.some((zone) => {
    return x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ;
  });
}

function createRainSystem() {
  const count = 1400;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    positions[i * 3 + 0] = THREE.MathUtils.randFloatSpread(62);
    positions[i * 3 + 1] = Math.random() * 16 + 2;
    positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(62);
    speeds[i] = 12 + Math.random() * 8;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0x9fc7ff,
    size: 0.12,
    transparent: true,
    opacity: 0.0,
  });

  const points = new THREE.Points(geometry, material);
  points.visible = false;
  state.scene.add(points);

  state.rainSystem = { points, positions, speeds, count, material };
}

function updateRainSystem(deltaTime) {
  if (!state.rainSystem) return;

  const rain = state.rainSystem;
  rain.points.visible = state.environment.rainEnabled;
  rain.material.opacity = state.environment.rainEnabled ? 0.65 : 0;
  if (!state.environment.rainEnabled) return;

  for (let i = 0; i < rain.count; i += 1) {
    const index = i * 3;
    rain.positions[index + 1] -= rain.speeds[i] * deltaTime;
    rain.positions[index + 0] -= 1.5 * deltaTime;

    if (rain.positions[index + 1] < 0.1) {
      rain.positions[index + 0] = THREE.MathUtils.randFloatSpread(62);
      rain.positions[index + 1] = Math.random() * 14 + 6;
      rain.positions[index + 2] = THREE.MathUtils.randFloatSpread(62);
    }
  }

  rain.points.geometry.attributes.position.needsUpdate = true;
}

function createSensorSuite() {
  if (state.sensorRig) {
    state.vehicleRig.remove(state.sensorRig);
  }

  const rig = new THREE.Group();
  const height = Math.max(state.vehicleAxes.height * 0.82, 0.34);
  const topPosition = new THREE.Vector3(0, height, 0);
  const range = Math.max(state.vehicleAxes.length, state.vehicleAxes.width) * 3.2;

  const lidarRing = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 48 }, (_, index) => {
        const angle = (index / 48) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * 0.18, 0, Math.sin(angle) * 0.18);
      }),
    ),
    new THREE.LineBasicMaterial({ color: 0x59d39c, transparent: true, opacity: 0.9 }),
  );
  lidarRing.position.copy(topPosition);

  const lidarSweep = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(range * 0.25, 0, 0)]),
    new THREE.LineBasicMaterial({ color: 0x8affd8, transparent: true, opacity: 0.95 }),
  );
  lidarSweep.position.copy(topPosition);

  const coneHeight = Math.max(state.vehicleAxes.length * 0.8, 0.8);
  const cameraCone = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(state.vehicleAxes.width * 0.4, 0.24), coneHeight, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x85b4ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  cameraCone.position.copy(topPosition.clone().addScaledVector(state.vehicleAxes.forwardLocal, coneHeight * 0.45));
  alignObjectToAxes(cameraCone, WORLD_UP, state.vehicleAxes.forwardLocal.clone().multiplyScalar(-1));

  const radarPulse = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 64 }, (_, index) => {
        const angle = (index / 64) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle), 0.01, Math.sin(angle));
      }),
    ),
    new THREE.LineBasicMaterial({ color: 0xf5b14c, transparent: true, opacity: 0.36 }),
  );
  radarPulse.position.y = 0.03;

  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16),
    new THREE.MeshStandardMaterial({
      color: 0xf5b14c,
      emissive: 0xf58b2c,
      emissiveIntensity: 0.6,
      roughness: 0.45,
      metalness: 0.12,
    }),
  );
  beacon.position.copy(topPosition.clone().addScaledVector(WORLD_UP, 0.08));

  const beaconLight = new THREE.PointLight(0xff8c3a, 0.8, 6, 2);
  beaconLight.position.copy(beacon.position);

  const headlightLeft = new THREE.SpotLight(0xe8f0ff, 0, 16, THREE.MathUtils.degToRad(22), 0.4, 1.2);
  const headlightRight = headlightLeft.clone();
  const lightOffsetSide = Math.max(state.vehicleAxes.width * 0.22, 0.09);
  const lightOffsetForward = Math.max(state.vehicleAxes.length * 0.52, 0.3);
  const headlightHeight = Math.max(state.vehicleAxes.height * 0.38, 0.18);
  [headlightLeft, headlightRight].forEach((light, index) => {
    const sideSign = index === 0 ? -1 : 1;
    light.position.copy(
      state.vehicleAxes.forwardLocal.clone().multiplyScalar(lightOffsetForward)
        .addScaledVector(state.vehicleAxes.sideLocal, lightOffsetSide * sideSign)
        .addScaledVector(WORLD_UP, headlightHeight),
    );
    const target = new THREE.Object3D();
    target.position.copy(
      light.position.clone().add(state.vehicleAxes.forwardLocal.clone().multiplyScalar(6)),
    );
    rig.add(target);
    light.target = target;
    rig.add(light);
  });

  rig.add(lidarRing, lidarSweep, cameraCone, radarPulse, beacon, beaconLight);
  state.vehicleRig.add(rig);

  state.sensorRig = rig;
  state.sensorSuite = {
    lidarRing,
    lidarSweep,
    cameraCone,
    radarPulse,
    beacon,
    beaconLight,
    headlights: [headlightLeft, headlightRight],
    radarPhase: 0,
    lidarPhase: 0,
    beaconPhase: 0,
  };
  applyEnvironmentState(true);
}

function updateSensorSuite(deltaTime) {
  if (!state.sensorSuite) return;

  const sensors = state.sensorSuite;

  if (state.environment.lidarEnabled) {
    sensors.lidarPhase += deltaTime * 2.4;
    sensors.lidarSweep.rotation.y = sensors.lidarPhase;
  }

  if (state.environment.radarEnabled) {
    sensors.radarPhase = (sensors.radarPhase + deltaTime * 0.42) % 1;
    const scale = 0.2 + sensors.radarPhase * Math.max(state.vehicleAxes.length, state.vehicleAxes.width) * 4.8;
    sensors.radarPulse.scale.setScalar(scale);
    sensors.radarPulse.material.opacity = 0.42 * (1 - sensors.radarPhase);
  }

  if (state.environment.beaconEnabled) {
    sensors.beaconPhase += deltaTime * 7;
    const intensity = 0.45 + Math.max(0, Math.sin(sensors.beaconPhase)) * 1.25;
    sensors.beacon.material.emissiveIntensity = intensity;
    sensors.beaconLight.intensity = intensity * 1.3;
  }
}

function applyEnvironmentState(initial = false) {
  const env = state.environment;
  const hour = env.timeOfDay;
  const sunFactor = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));
  const duskFactor = 1 - sunFactor;

  dom.timeReadout.textContent = formatTimeOfDay(hour);

  if (state.hemisphereLight) {
    state.hemisphereLight.intensity = 0.35 + sunFactor * 1.1;
    state.hemisphereLight.color.setHSL(0.55, 0.45, 0.62 + sunFactor * 0.18);
    state.hemisphereLight.groundColor.setHSL(0.1, 0.35, 0.08 + sunFactor * 0.1);
  }

  if (state.sunLight) {
    state.sunLight.intensity = 0.2 + sunFactor * 1.85;
    state.sunLight.color.setHSL(0.11 - duskFactor * 0.04, 0.68, 0.5 + sunFactor * 0.18);
    const sunAngle = THREE.MathUtils.mapLinear(hour, 0, 24, -Math.PI * 0.3, Math.PI * 1.7);
    state.sunLight.position.set(Math.cos(sunAngle) * 10, 2 + sunFactor * 8, Math.sin(sunAngle) * 6);
  }

  state.scene.fog.color.setHSL(0.58, 0.33, 0.08 + sunFactor * 0.22);
  state.scene.fog.near = 8;
  state.scene.fog.far = env.rainEnabled ? 18 : 26 + sunFactor * 6;
  state.renderer.toneMappingExposure = 0.74 + sunFactor * 0.7 - (env.rainEnabled ? 0.08 : 0);

  state.streetLights.forEach(({ mesh, light }) => {
    const lampIntensity = duskFactor > 0.32 ? THREE.MathUtils.mapLinear(duskFactor, 0.32, 1, 0.1, 1.3) : 0;
    mesh.material.emissiveIntensity = lampIntensity * 0.9;
    light.intensity = lampIntensity * 1.2;
  });

  if (state.sensorSuite) {
    state.sensorSuite.lidarRing.visible = env.lidarEnabled;
    state.sensorSuite.lidarSweep.visible = env.lidarEnabled;
    state.sensorSuite.cameraCone.visible = env.cameraConeEnabled;
    state.sensorSuite.radarPulse.visible = env.radarEnabled;
    state.sensorSuite.beacon.visible = env.beaconEnabled;
    state.sensorSuite.beaconLight.visible = env.beaconEnabled;
    state.sensorSuite.headlights.forEach((light) => {
      light.intensity = env.headlightsEnabled ? 2.2 : 0;
      light.visible = env.headlightsEnabled;
    });
  }

  if (!initial) {
    updateMissionUi();
  }
}

function tryAddWaypointFromPointer(event) {
  if (!state.navTargets.length) return false;

  const rect = state.renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, state.camera);
  const hits = raycaster.intersectObjects(state.navTargets, false);
  if (!hits.length) return false;

  addMissionWaypoint(hits[0].point.clone());
  return true;
}

function addMissionWaypoint(point) {
  const waypoint = new THREE.Vector3(point.x, 0.02, point.z);
  state.mission.waypoints.push(waypoint);
  logEvent(`新增航点 ${state.mission.waypoints.length}: (${waypoint.x.toFixed(1)}, ${waypoint.z.toFixed(1)})`, "success");
  updateMissionGeometry();
  updateMissionUi();
}

function removeLastWaypoint() {
  if (!state.mission.waypoints.length) return;
  state.mission.waypoints.pop();
  if (state.mission.currentIndex >= state.mission.waypoints.length) {
    state.mission.currentIndex = Math.max(0, state.mission.waypoints.length - 1);
  }
  logEvent("已撤销最后一个航点。", "info");
  updateMissionGeometry();
  updateMissionUi();
}

function clearMissionRoute(logAction = false) {
  state.mission.autopilot = false;
  state.mission.editMode = false;
  state.mission.currentIndex = 0;
  state.mission.presetName = "手动";
  state.mission.waypoints = [];
  updateMissionGeometry();
  updateMissionUi();
  if (logAction) {
    logEvent("路线已清空。", "info");
  }
}

function loadPresetMission(name) {
  const presets = {
    基地巡检: [
      new THREE.Vector3(-24, 0.02, -17),
      new THREE.Vector3(18, 0.02, -17),
      new THREE.Vector3(18, 0.02, 15),
      new THREE.Vector3(-16, 0.02, 15),
    ],
    仓储巡检: [
      new THREE.Vector3(-13, 0.02, -12),
      new THREE.Vector3(4.5, 0.02, 22),
      new THREE.Vector3(18, 0.02, 13),
      new THREE.Vector3(28, 0.02, -18),
    ],
    返航路线: [new THREE.Vector3(0, 0.02, 0)],
  };

  state.mission.autopilot = false;
  state.mission.editMode = false;
  state.mission.currentIndex = 0;
  state.mission.presetName = name;
  state.mission.waypoints = (presets[name] || []).map((point) => point.clone());
  updateMissionGeometry();
  updateMissionUi();
  logEvent(`已加载预设任务：${name}。`, "success");
}

function executeMissionRoute() {
  if (!state.mission.waypoints.length) {
    logEvent("无可执行航点，请先添加或加载路线。", "warning");
    return;
  }

  state.mission.autopilot = true;
  state.mission.editMode = false;
  state.motion.enabled = true;
  state.mission.currentIndex = Math.min(state.mission.currentIndex, state.mission.waypoints.length - 1);
  updateMissionGeometry();
  updateMissionUi();
  logEvent(`自动巡航启动，任务：${state.mission.presetName}。`, "success");
}

function stopAutopilot(reason = "自动巡航已停止。") {
  if (!state.mission.autopilot) return;
  state.mission.autopilot = false;
  updateMissionGeometry();
  updateMissionUi();
  logEvent(reason, "info");
}

function interruptAutopilotForManual() {
  if (!state.mission.autopilot) return;
  stopAutopilot("检测到人工接管，自动巡航已退出。");
}

function getAutopilotTargets() {
  if (!state.mission.waypoints.length) {
    stopAutopilot("路线为空，自动巡航已退出。");
    return { speed: 0, steering: 0 };
  }

  const target = state.mission.waypoints[state.mission.currentIndex];
  const position = state.vehicleRig.position.clone();
  const delta = target.clone().sub(position);
  const distance = Math.hypot(delta.x, delta.z);

  if (distance < 1.1) {
    state.mission.currentIndex += 1;
    if (state.mission.currentIndex >= state.mission.waypoints.length) {
      stopAutopilot("任务完成，已到达最终航点。");
      return { speed: 0, steering: 0 };
    }
    logEvent(`已通过航点 ${state.mission.currentIndex}，前往下一点。`, "success");
    updateMissionGeometry();
    updateMissionUi();
    return getAutopilotTargets();
  }

  const targetHeading = Math.atan2(delta.x, delta.z);
  const headingError = normalizeAngle(targetHeading - state.motion.heading);
  const steering = THREE.MathUtils.clamp(headingError / 0.75, -1, 1);
  let speed = THREE.MathUtils.clamp(distance * 0.35, 0.35, state.motion.maxSpeed * 0.75);
  if (Math.abs(headingError) > 0.8) speed *= 0.45;
  if (state.environment.rainEnabled) speed *= 0.82;

  return { speed, steering };
}

function updateMissionGeometry() {
  state.waypointMarkers.forEach((marker) => {
    state.navGroup.remove(marker);
    marker.geometry.dispose();
    marker.material.dispose();
  });
  state.waypointMarkers = [];

  const points = state.mission.waypoints.map((point) => point.clone());
  state.navLine.geometry.dispose();
  state.navLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
  state.navLine.visible = points.length > 0;
  state.navLine.computeLineDistances();

  state.mission.waypoints.forEach((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.24, 0.18, 18),
      new THREE.MeshStandardMaterial({
        color: index === state.mission.currentIndex ? 0xf5b14c : 0x59d39c,
        emissive: index === state.mission.currentIndex ? 0x8c5217 : 0x165c45,
        emissiveIntensity: 0.65,
        roughness: 0.46,
        metalness: 0.08,
      }),
    );
    marker.position.set(point.x, 0.12, point.z);
    state.navGroup.add(marker);
    state.waypointMarkers.push(marker);
  });
}

function renderMissionList() {
  if (!dom.routeList) return;

  if (!state.mission.waypoints.length) {
    dom.routeList.innerHTML = '<div class="route-item"><div><strong>暂无航点</strong><span>可选择预设任务，或开启手动布点后点击地面添加。</span></div></div>';
    return;
  }

  dom.routeList.replaceChildren(
    ...state.mission.waypoints.map((point, index) => {
      const row = document.createElement("div");
      row.className = `route-item${index === state.mission.currentIndex ? " active" : ""}`;
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `航点 ${index + 1}`;
      const meta = document.createElement("span");
      meta.textContent = `X ${point.x.toFixed(1)} / Z ${point.z.toFixed(1)}`;
      info.append(title, meta);
      const stateText = document.createElement("span");
      stateText.textContent = index < state.mission.currentIndex ? "已通过" : index === state.mission.currentIndex ? "当前目标" : "待执行";
      row.append(info, stateText);
      return row;
    }),
  );
}

function updateMissionUi() {
  const routeLength = calculateRouteLength();
  dom.routeCount.textContent = `${state.mission.waypoints.length}`;
  dom.routeLength.textContent = `${routeLength.toFixed(1)} m`;
  dom.routeProgress.textContent = `${Math.min(state.mission.currentIndex, state.mission.waypoints.length)} / ${state.mission.waypoints.length}`;
  dom.routeStatus.textContent = state.mission.autopilot
    ? `执行中 · ${state.mission.presetName}`
    : state.mission.editMode
      ? "手动布点中"
      : state.mission.waypoints.length
        ? `待执行 · ${state.mission.presetName}`
        : "未规划";
  dom.autonomyMode.textContent = state.mission.autopilot
    ? "自动"
    : state.mission.editMode
      ? "布点"
      : "手动";
  dom.missionReadout.textContent = state.mission.autopilot ? "自动巡航" : state.mission.editMode ? "布点模式" : "手动控制";
  dom.routeHint.textContent = state.mission.editMode
    ? "点击场景地面继续添加航点，Shift+点击也可快速加点。"
    : "可加载预设任务，或开启“手动布点”后点击场景地面添加航点。";
  dom.executeRouteButton.classList.toggle("active", state.mission.autopilot);
  dom.stopRouteButton.classList.toggle("active", state.mission.autopilot);
  dom.manualRouteButton.classList.toggle("active", state.mission.editMode);
  renderMissionList();
}

function calculateRouteLength() {
  if (!state.mission.waypoints.length) return 0;

  let total = 0;
  let previous = state.vehicleRig.position.clone();
  state.mission.waypoints.forEach((point) => {
    total += previous.distanceTo(point);
    previous = point;
  });
  return total;
}

function updateDiagnostics(deltaTime) {
  const diagnostics = state.diagnostics;
  const speedFactor = THREE.MathUtils.clamp(Math.abs(state.motion.speed) / state.motion.maxSpeed, 0, 1);
  const steeringFactor = Math.abs(state.motion.steering);
  const distanceFactor = THREE.MathUtils.clamp(state.vehicleRig.position.length() / 40, 0, 1);

  const batteryDrain = (0.18 + speedFactor * 0.75 + (state.mission.autopilot ? 0.08 : 0)) * deltaTime;
  diagnostics.battery = THREE.MathUtils.clamp(
    diagnostics.battery - batteryDrain + (state.motion.speed < 0.05 && state.vehicleRig.position.length() < 3 ? 0.05 * deltaTime : 0),
    12,
    100,
  );
  diagnostics.signal = THREE.MathUtils.clamp(100 - distanceFactor * 24 - (state.environment.rainEnabled ? 12 : 0), 45, 100);
  diagnostics.motorTemp = THREE.MathUtils.clamp(
    diagnostics.motorTemp + (speedFactor * 2.8 + steeringFactor * 1.4 - 0.85) * deltaTime * 7,
    32,
    92,
  );
  diagnostics.traction = THREE.MathUtils.clamp(96 - (state.environment.rainEnabled ? 18 : 0) - steeringFactor * 10 - speedFactor * 5, 48, 99);
  diagnostics.compute = THREE.MathUtils.clamp(
    14 +
      (state.mission.autopilot ? 18 : 0) +
      (state.environment.rainEnabled ? 9 : 0) +
      (state.environment.lidarEnabled ? 8 : 0) +
      (state.environment.cameraConeEnabled ? 4 : 0) +
      (state.environment.radarEnabled ? 5 : 0),
    8,
    92,
  );
  diagnostics.health = THREE.MathUtils.clamp(
    100 -
      (100 - diagnostics.battery) * 0.25 -
      (100 - diagnostics.signal) * 0.2 -
      THREE.MathUtils.clamp((diagnostics.motorTemp - 60) * 1.2, 0, 30),
    38,
    100,
  );

  diagnostics.alerts = [];
  if (diagnostics.battery < 30) diagnostics.alerts.push({ text: "低电量", level: "danger" });
  if (diagnostics.signal < 65) diagnostics.alerts.push({ text: "链路衰减", level: "warning" });
  if (diagnostics.motorTemp > 72) diagnostics.alerts.push({ text: "电机温升", level: "danger" });
  if (diagnostics.traction < 70) diagnostics.alerts.push({ text: "低抓地风险", level: "warning" });
  if (state.environment.rainEnabled) diagnostics.alerts.push({ text: "雨天模式", level: "warning" });
  if (state.mission.autopilot) diagnostics.alerts.push({ text: "自动巡航中", level: "info" });

  updateDiagnosticsPanel();
}

function updateDiagnosticsPanel() {
  const diagnostics = state.diagnostics;
  setHealthMetric(dom.batteryFill, dom.batteryText, diagnostics.battery, `${diagnostics.battery.toFixed(0)}%`);
  setHealthMetric(dom.signalFill, dom.signalText, diagnostics.signal, `${diagnostics.signal.toFixed(0)}%`);
  setHealthMetric(dom.motorFill, dom.motorText, diagnostics.motorTemp, `${diagnostics.motorTemp.toFixed(0)}°C`, 95);
  setHealthMetric(dom.tractionFill, dom.tractionText, diagnostics.traction, `${diagnostics.traction.toFixed(0)}%`);
  setHealthMetric(dom.computeFill, dom.computeText, diagnostics.compute, `${diagnostics.compute.toFixed(0)}%`);
  setHealthMetric(dom.healthFill, dom.systemStateText, diagnostics.health, diagnostics.health > 82 ? "正常" : diagnostics.health > 62 ? "受限" : "告警");

  dom.alertStrip.replaceChildren(
    ...diagnostics.alerts.map((alert) => {
      const node = document.createElement("span");
      node.className = `alert-pill${alert.level === "danger" ? " danger" : ""}`;
      node.textContent = alert.text;
      return node;
    }),
  );

  if (!diagnostics.alerts.length) {
    const normal = document.createElement("span");
    normal.className = "alert-pill";
    normal.textContent = "全部子系统在线";
    dom.alertStrip.append(normal);
  }

  dom.eventLog.replaceChildren(
    ...diagnostics.logs.map((entry) => {
      const item = document.createElement("div");
      item.className = "log-item";
      const title = document.createElement("strong");
      title.textContent = entry.title;
      const body = document.createElement("span");
      body.textContent = `${entry.time} · ${entry.message}`;
      item.append(title, body);
      return item;
    }),
  );
}

function setHealthMetric(fillNode, textNode, value, label, max = 100) {
  const ratio = THREE.MathUtils.clamp(value / max, 0, 1);
  fillNode.style.width = `${ratio * 100}%`;
  fillNode.style.background =
    ratio > 0.66
      ? "linear-gradient(90deg, #59d39c, #9ef57e)"
      : ratio > 0.36
        ? "linear-gradient(90deg, #f5b14c, #ffd47a)"
        : "linear-gradient(90deg, #ff775f, #ffb29c)";
  textNode.textContent = label;
}

function logEvent(message, level = "info") {
  const titleMap = {
    info: "系统",
    success: "任务",
    warning: "提醒",
    error: "错误",
  };
  state.diagnostics.logs.unshift({
    title: titleMap[level] || "系统",
    message,
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
  });
  state.diagnostics.logs = state.diagnostics.logs.slice(0, 10);
  dom.logCaption.textContent = `${state.diagnostics.logs.length} 条记录`;
  updateDiagnosticsPanel();
}

function renderMinimap() {
  const ctx = state.minimapContext;
  if (!ctx) return;

  const width = dom.minimapCanvas.width;
  const height = dom.minimapCanvas.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#11202b";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 10; i += 1) {
    const offset = (i / 10) * width;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, offset);
    ctx.lineTo(width, offset);
    ctx.stroke();
  }

  drawMiniRect(ctx, 0, 0, 66, 7.2, "#4b545f");
  drawMiniRect(ctx, 14, -1, 6.4, 50, "#4b545f");
  drawMiniRect(ctx, -13, -13.5, 20, 14, "#79838f");
  drawMiniRect(ctx, 18, 13, 22, 16, "#8b96a3");
  drawMiniRect(ctx, 4.5, 22, 14, 10, "#7f8975");
  drawMiniRect(ctx, 28, -18, 11, 9, "#7d838d");

  if (state.mission.waypoints.length) {
    ctx.strokeStyle = "#59d39c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const vehiclePos = worldToMap(state.vehicleRig.position.x, state.vehicleRig.position.z, width, height);
    ctx.moveTo(vehiclePos.x, vehiclePos.y);
    state.mission.waypoints.forEach((point, index) => {
      const mapped = worldToMap(point.x, point.z, width, height);
      if (index === 0) ctx.lineTo(mapped.x, mapped.y);
      else ctx.lineTo(mapped.x, mapped.y);
    });
    ctx.stroke();

    state.mission.waypoints.forEach((point, index) => {
      const mapped = worldToMap(point.x, point.z, width, height);
      ctx.fillStyle = index === state.mission.currentIndex ? "#f5b14c" : "#59d39c";
      ctx.beginPath();
      ctx.arc(mapped.x, mapped.y, index === state.mission.currentIndex ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  const vehicle = worldToMap(state.vehicleRig.position.x, state.vehicleRig.position.z, width, height);
  ctx.save();
  ctx.translate(vehicle.x, vehicle.y);
  ctx.rotate(-state.motion.heading);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(7, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-7, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMiniRect(ctx, x, z, widthWorld, depthWorld, color) {
  const width = dom.minimapCanvas.width;
  const height = dom.minimapCanvas.height;
  const center = worldToMap(x, z, width, height);
  const size = worldSizeToMap(widthWorld, depthWorld, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(center.x - size.w / 2, center.y - size.h / 2, size.w, size.h);
}

function worldToMap(x, z, width, height) {
  const scale = 84;
  return {
    x: ((x + scale / 2) / scale) * width,
    y: height - ((z + scale / 2) / scale) * height,
  };
}

function worldSizeToMap(widthWorld, depthWorld, width, height) {
  const scale = 84;
  return {
    w: (widthWorld / scale) * width,
    h: (depthWorld / scale) * height,
  };
}

function formatTimeOfDay(hour) {
  const hours = Math.floor(hour);
  const minutes = Math.round((hour - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function buildTrackSystem() {
  if (state.trackSystem?.group) {
    state.vehicleRig.remove(state.trackSystem.group);
  }

  const group = new THREE.Group();
  const { forwardLocal, sideLocal, length, width, height } = state.vehicleAxes;
  const centerHeight = Math.max(height * 0.29, 0.14);
  const radius = THREE.MathUtils.clamp(height * 0.22, 0.08, 0.17);
  const straightHalf = Math.max(length * 0.33, radius * 1.22);
  const sideOffset = width * 0.46;
  const beltWidth = THREE.MathUtils.clamp(width * 0.12, 0.04, 0.065);
  const beltThickness = THREE.MathUtils.clamp(height * 0.055, 0.018, 0.04);
  const straightLen = straightHalf * 2;
  const perimeter = straightLen * 2 + 2 * Math.PI * radius;
  const linkCount = THREE.MathUtils.clamp(Math.round(perimeter / 0.05), 36, 72);
  const linkLength = perimeter / linkCount;

  const linkGeometry = new THREE.BoxGeometry(linkLength * 0.8, beltThickness, beltWidth);
  const linkMaterial = new THREE.MeshStandardMaterial({
    color: 0x20272f,
    roughness: 0.86,
    metalness: 0.32,
  });

  const capMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c232b,
    roughness: 0.78,
    metalness: 0.28,
  });

  const tracks = [-1, 1].map((sign) => {
    const mesh = new THREE.InstancedMesh(linkGeometry, linkMaterial, linkCount);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    group.add(mesh);

    const topRail = createTrackRail(sign, sideOffset, centerHeight + radius, straightHalf, beltThickness, beltWidth, capMaterial);
    const bottomRail = createTrackRail(sign, sideOffset, centerHeight - radius, straightHalf, beltThickness, beltWidth, capMaterial);
    const frontWheel = createTrackWheel(sign, sideOffset, centerHeight, straightHalf, radius, beltWidth, capMaterial);
    const rearWheel = createTrackWheel(sign, sideOffset, centerHeight, -straightHalf, radius, beltWidth, capMaterial);
    group.add(topRail, bottomRail, frontWheel, rearWheel);

    return {
      mesh,
      phase: 0,
      sign,
      sideOffset,
      centerHeight,
      radius,
      straightHalf,
      beltWidth,
      linkCount,
      perimeter,
      forwardLocal: forwardLocal.clone(),
      sideLocal: sideLocal.clone(),
    };
  });

  state.trackSystem = { group, tracks };
  state.vehicleRig.add(group);
  tracks.forEach((track) => updateTrackLinks(track));
}

function createTrackRail(sign, sideOffset, heightValue, straightHalf, beltThickness, beltWidth, material) {
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(straightHalf * 2 + beltThickness * 2, beltThickness * 0.9, beltWidth * 0.62),
    material,
  );
  const offset = state.vehicleAxes.sideLocal
    .clone()
    .multiplyScalar(sideOffset * sign)
    .addScaledVector(WORLD_UP, heightValue)
    .addScaledVector(state.vehicleAxes.forwardLocal, 0);
  rail.position.copy(offset);
  alignObjectToAxes(rail, state.vehicleAxes.forwardLocal, state.vehicleAxes.sideLocal.clone().multiplyScalar(sign));
  return rail;
}

function createTrackWheel(sign, sideOffset, centerHeight, forwardDistance, radius, beltWidth, material) {
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.76, radius * 0.76, beltWidth * 0.7, 28),
    material,
  );
  const offset = state.vehicleAxes.sideLocal
    .clone()
    .multiplyScalar(sideOffset * sign)
    .addScaledVector(WORLD_UP, centerHeight)
    .addScaledVector(state.vehicleAxes.forwardLocal, forwardDistance);
  wheel.position.copy(offset);
  const sideAxis = state.vehicleAxes.sideLocal.clone().multiplyScalar(sign).normalize();
  const forwardAxis = state.vehicleAxes.forwardLocal.clone().normalize();
  const upAxis = forwardAxis.clone().cross(sideAxis).normalize();
  alignObjectWithBasis(wheel, forwardAxis, sideAxis, upAxis);
  return wheel;
}

function updateTrackMotion(deltaTime, yawDelta) {
  if (!state.trackSystem?.tracks?.length) return;

  const yawRate = deltaTime > 0 ? yawDelta / deltaTime : 0;
  const halfTrackSpan = state.vehicleAxes.width * 0.5;
  const leftLinearSpeed = state.motion.speed - yawRate * halfTrackSpan;
  const rightLinearSpeed = state.motion.speed + yawRate * halfTrackSpan;

  state.trackSystem.tracks.forEach((track, index) => {
    const linearSpeed = index === 0 ? leftLinearSpeed : rightLinearSpeed;
    track.phase += linearSpeed * deltaTime;
    updateTrackLinks(track);
  });
}

function updateTrackLinks(track) {
  const dummy = new THREE.Object3D();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const side = track.sideLocal.clone().multiplyScalar(track.sign).normalize();
  const basis = new THREE.Matrix4();

  for (let i = 0; i < track.linkCount; i += 1) {
    const distance = (track.phase + (i / track.linkCount) * track.perimeter) % track.perimeter;
    const wrappedDistance = distance < 0 ? distance + track.perimeter : distance;
    const sample = sampleTrackPath(track, wrappedDistance);

    tangent.copy(sample.tangent).normalize();
    normal.copy(side).cross(tangent).normalize();
    basis.makeBasis(tangent, normal, side);
    basis.setPosition(sample.position);
    dummy.position.setFromMatrixPosition(basis);
    dummy.quaternion.setFromRotationMatrix(basis);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    track.mesh.setMatrixAt(i, dummy.matrix);
  }

  track.mesh.instanceMatrix.needsUpdate = true;
}

function sampleTrackPath(track, distance) {
  const straightLen = track.straightHalf * 2;
  const arcLen = Math.PI * track.radius;
  const centerY = track.centerHeight;
  let forwardOffset = 0;
  let heightOffset = centerY;
  let tangentForward = 1;
  let tangentUp = 0;

  if (distance < straightLen) {
    forwardOffset = -track.straightHalf + distance;
    heightOffset = centerY + track.radius;
    tangentForward = 1;
  } else if (distance < straightLen + arcLen) {
    const arcDistance = distance - straightLen;
    const angle = Math.PI / 2 - arcDistance / track.radius;
    forwardOffset = track.straightHalf + Math.cos(angle) * track.radius;
    heightOffset = centerY + Math.sin(angle) * track.radius;
    tangentForward = Math.sin(angle);
    tangentUp = -Math.cos(angle);
  } else if (distance < straightLen * 2 + arcLen) {
    const bottomDistance = distance - straightLen - arcLen;
    forwardOffset = track.straightHalf - bottomDistance;
    heightOffset = centerY - track.radius;
    tangentForward = -1;
  } else {
    const arcDistance = distance - straightLen * 2 - arcLen;
    const angle = -Math.PI / 2 + arcDistance / track.radius;
    forwardOffset = -track.straightHalf - Math.cos(angle) * track.radius;
    heightOffset = centerY + Math.sin(angle) * track.radius;
    tangentForward = Math.sin(angle);
    tangentUp = Math.cos(angle);
  }

  const position = track.sideLocal
    .clone()
    .multiplyScalar(track.sideOffset * track.sign)
    .addScaledVector(track.forwardLocal, forwardOffset)
    .addScaledVector(WORLD_UP, heightOffset);

  const tangent = track.forwardLocal
    .clone()
    .multiplyScalar(tangentForward)
    .addScaledVector(WORLD_UP, tangentUp);

  return { position, tangent };
}

function alignObjectToAxes(object, xAxis, zAxis) {
  const x = xAxis.clone().normalize();
  const z = zAxis.clone().normalize();
  const y = z.clone().cross(x).normalize();
  alignObjectWithBasis(object, x, y, z);
}

function alignObjectWithBasis(object, xAxis, yAxis, zAxis) {
  const matrix = new THREE.Matrix4().makeBasis(
    xAxis.clone().normalize(),
    yAxis.clone().normalize(),
    zAxis.clone().normalize(),
  );
  object.quaternion.setFromRotationMatrix(matrix);
}

function resizeRenderer() {
  if (!state.renderer || !state.camera) return;

  const { clientWidth, clientHeight } = dom.sceneContainer;
  if (!clientWidth || !clientHeight) return;

  state.camera.aspect = clientWidth / clientHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(clientWidth, clientHeight);

  if (state.modelRoot) {
    state.fitDistance = Math.max(computeFitDistance(state.localSphere.radius), 1.4);
    setView(state.currentView, false);
  }
}

function setLoadingProgress(progress, text) {
  const percentage = Math.max(0, Math.min(progress, 1)) * 100;
  dom.progressFill.style.width = `${percentage}%`;
  dom.loadingText.textContent = text;
}

function setStatus(text, mode) {
  dom.statusText.textContent = text;
  dom.statusPill.dataset.mode = mode;
  dom.statStatus.textContent = text;
}

function computeFitDistance(radius) {
  const verticalFov = THREE.MathUtils.degToRad(state.camera.fov);
  return (radius / Math.sin(verticalFov / 2)) * 1.08;
}

function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function forEachMaterial(mesh, callback) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.filter(Boolean).forEach(callback);
}

function formatBytes(bytes) {
  if (!bytes) return "-";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
