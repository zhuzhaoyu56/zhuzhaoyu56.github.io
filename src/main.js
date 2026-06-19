import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = `${import.meta.env.BASE_URL}models/tank.glb`;
const MODEL_NAME = "tank.glb";
const MODEL_BYTES = 8_418_868;
const MODEL_TARGET_LENGTH = 5.6;
const MODEL_YAW_OFFSET = Math.PI;

const TEMP_A = new THREE.Vector3();
const TEMP_B = new THREE.Vector3();
const TEMP_C = new THREE.Vector3();
const TEMP_D = new THREE.Vector3();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const DAY_COLORS = {
  background: new THREE.Color(0x9bb8c7),
  fog: new THREE.Color(0x5d7481),
};

const NIGHT_COLORS = {
  background: new THREE.Color(0x081019),
  fog: new THREE.Color(0x0e1822),
};

const CAMERA_PRESETS = {
  hero: {
    label: "城市总览",
  },
  boulevard: {
    label: "街区侧视",
  },
  chase: {
    label: "跟车追踪",
  },
  tactical: {
    label: "战术俯视",
  },
};

const MODE_CONFIG = {
  manual: {
    label: "手动驾驶",
    description: "使用推力和转向控制履带小车在城市中心环形街区内移动，支持键盘 W / A / S / D 介入。",
    note: "当前推荐用于交互演示与教师答辩操作。",
    sceneNote: "手动模式下可直接驾驶履带车穿行城市中心，也可以配合追踪镜头展示底盘联动效果。",
  },
  patrol: {
    label: "城市巡航",
    description: "车辆自动沿城市中心环线巡航，持续展示路口、建筑群、中心广场和城市灯光氛围。",
    note: "适合自动播放与课程展示，系统会自动联动履带速度和镜头跟随。",
    sceneNote: "巡航模式会沿中心环线平滑移动，履带与轮组按路径速度自动驱动。",
  },
  inspection: {
    label: "定点展示",
    description: "车辆驻留在中央广场附近，通过低速原地转向演示履带差速、传感器感知与镜头细节观察。",
    note: "适合强调履带联动、灯光氛围和模型细节特写。",
    sceneNote: "定点展示模式会执行低速原地旋转，突出履带差速和传感器扫描效果。",
  },
};

const WHEEL_NAMES = {
  left: ["part_21", "part_12", "part_0", "part_13", "part_3", "part_14"],
  right: ["part_8", "part_6", "part_2", "part_7", "part_4", "part_10"],
};

const dom = {
  sceneContainer: document.querySelector("#scene-container"),
  loadingOverlay: document.querySelector("#loading-overlay"),
  loadingText: document.querySelector("#loading-text"),
  progressBar: document.querySelector("#progress-bar"),
  statusBadge: document.querySelector("#status-badge"),
  statusText: document.querySelector("#status-text"),
  modelFileLabel: document.querySelector("#model-file-label"),
  modeReadout: document.querySelector("#mode-readout"),
  cameraReadout: document.querySelector("#camera-readout"),
  speedReadout: document.querySelector("#speed-readout"),
  positionReadout: document.querySelector("#position-readout"),
  modeDescription: document.querySelector("#mode-description"),
  modeNote: document.querySelector("#mode-note"),
  sceneNote: document.querySelector("#scene-note"),
  modeButtons: document.querySelectorAll("[data-mode]"),
  cameraButtons: document.querySelectorAll("[data-camera]"),
  throttleRange: document.querySelector("#throttle-range"),
  throttleValue: document.querySelector("#throttle-value"),
  steerRange: document.querySelector("#steer-range"),
  steerValue: document.querySelector("#steer-value"),
  btnStop: document.querySelector("#btn-stop"),
  btnCenterVehicle: document.querySelector("#btn-center-vehicle"),
  btnResetCamera: document.querySelector("#btn-reset-camera"),
  toggleFollow: document.querySelector("#toggle-follow"),
  toggleNight: document.querySelector("#toggle-night"),
  toggleSensors: document.querySelector("#toggle-sensors"),
  toggleTraffic: document.querySelector("#toggle-traffic"),
  toggleGrid: document.querySelector("#toggle-grid"),
  statFileSize: document.querySelector("#stat-file-size"),
  statTriangles: document.querySelector("#stat-triangles"),
  statMeshes: document.querySelector("#stat-meshes"),
  statMaterials: document.querySelector("#stat-materials"),
  statScene: document.querySelector("#stat-scene"),
  statAnimation: document.querySelector("#stat-animation"),
  telemetrySpeed: document.querySelector("#telemetry-speed"),
  telemetryHeading: document.querySelector("#telemetry-heading"),
  telemetryLeftTrack: document.querySelector("#telemetry-left-track"),
  telemetryRightTrack: document.querySelector("#telemetry-right-track"),
  miniMap: document.querySelector("#mini-map"),
};

const state = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  resizeObserver: null,
  clock: new THREE.Clock(),
  mode: "manual",
  currentCamera: "hero",
  ui: {
    followCamera: true,
    nightMode: false,
    showSensors: true,
    showTraffic: true,
    showGrid: false,
  },
  environment: {
    sky: null,
    skyUniforms: null,
    hemiLight: null,
    sunLight: null,
    fillLight: null,
    plazaLight: null,
    starsMaterial: null,
    nightBlend: 0,
  },
  city: {
    group: null,
    routeCurve: null,
    routeLine: null,
    gridHelper: null,
    buildingCount: 0,
    lightCount: 0,
    windowMaterials: [],
    accentMaterials: [],
    billboardMaterials: [],
    lampBulbs: [],
    streetLights: [],
    trafficVehicles: [],
  },
  vehicle: {
    root: null,
    mount: null,
    modelRoot: null,
    contactShadow: null,
    heading: 0,
    speed: 0,
    leftTrackSpeed: 0,
    rightTrackSpeed: 0,
    throttle: 0,
    steer: 0,
    manualThrottle: 0,
    manualSteer: 0,
    routeDistance: 0,
    maxSpeed: 8.2,
    wheelRadius: 0.34,
    wheelSpin: {
      left: 0,
      right: 0,
    },
    trackMotion: {
      left: 0,
      right: 0,
    },
    wheelNodes: {
      left: [],
      right: [],
    },
    trackMaterials: {
      left: null,
      right: null,
    },
    sensorGroup: null,
    sensorSweep: null,
    sensorPulse: null,
    sensorHalo: null,
    ready: false,
    stats: {
      triangles: 0,
      meshes: 0,
      materials: 0,
    },
  },
  input: {
    keys: {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false,
      ArrowUp: false,
      ArrowLeft: false,
      ArrowDown: false,
      ArrowRight: false,
    },
  },
  miniMap: {
    ctx: null,
    ratio: 1,
    width: 0,
    height: 0,
  },
};

init();

function init() {
  dom.modelFileLabel.textContent = MODEL_NAME;
  dom.statFileSize.textContent = formatBytes(MODEL_BYTES);
  dom.statAnimation.textContent = "左右履带程序化滚动 + 12 轮组联动";

  setupScene();
  buildCityCenter();
  createVehicleSensorOverlay();
  bindUi();
  setMode("manual");
  setCameraPreset("hero");
  resetVehiclePose();
  animate();
  loadModel();
}

function setupScene() {
  state.scene = new THREE.Scene();
  state.scene.background = DAY_COLORS.background.clone();
  state.scene.fog = new THREE.Fog(DAY_COLORS.fog.clone(), 34, 96);

  const { clientWidth, clientHeight } = dom.sceneContainer;
  state.camera = new THREE.PerspectiveCamera(38, clientWidth / clientHeight, 0.1, 240);
  state.camera.position.set(24, 18, 24);

  state.renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  state.renderer.setSize(clientWidth, clientHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  state.renderer.shadowMap.enabled = true;
  state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.05;
  dom.sceneContainer.appendChild(state.renderer.domElement);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.dampingFactor = 0.06;
  state.controls.enablePan = true;
  state.controls.minDistance = 5;
  state.controls.maxDistance = 70;
  state.controls.maxPolarAngle = Math.PI / 2.02;
  state.controls.target.set(0, 2.5, 0);

  state.vehicle.root = new THREE.Group();
  state.vehicle.mount = new THREE.Group();
  state.vehicle.modelRoot = new THREE.Group();
  state.vehicle.mount.add(state.vehicle.modelRoot);
  state.vehicle.root.add(state.vehicle.mount);
  state.vehicle.contactShadow = createContactShadow();
  state.vehicle.root.add(state.vehicle.contactShadow);
  state.scene.add(state.vehicle.root);

  state.environment.hemiLight = new THREE.HemisphereLight(0xb6e2ff, 0x22303a, 1.25);
  state.scene.add(state.environment.hemiLight);

  state.environment.sunLight = new THREE.DirectionalLight(0xffefd4, 1.65);
  state.environment.sunLight.position.set(24, 32, 18);
  state.environment.sunLight.castShadow = true;
  state.environment.sunLight.shadow.mapSize.set(2048, 2048);
  state.environment.sunLight.shadow.camera.left = -44;
  state.environment.sunLight.shadow.camera.right = 44;
  state.environment.sunLight.shadow.camera.top = 44;
  state.environment.sunLight.shadow.camera.bottom = -44;
  state.environment.sunLight.shadow.camera.near = 6;
  state.environment.sunLight.shadow.camera.far = 120;
  state.scene.add(state.environment.sunLight);

  state.environment.fillLight = new THREE.DirectionalLight(0x7ec9ff, 0.38);
  state.environment.fillLight.position.set(-30, 18, -20);
  state.scene.add(state.environment.fillLight);

  state.environment.plazaLight = new THREE.PointLight(0x57d3ff, 0.0, 34, 2.0);
  state.environment.plazaLight.position.set(0, 4.8, 0);
  state.scene.add(state.environment.plazaLight);

  const { sky, uniforms, starsMaterial } = createSkyDome();
  state.environment.sky = sky;
  state.environment.skyUniforms = uniforms;
  state.environment.starsMaterial = starsMaterial;
  state.scene.add(sky);

  state.resizeObserver = new ResizeObserver(() => {
    resizeRenderer();
    resizeMiniMapCanvas();
  });
  state.resizeObserver.observe(dom.sceneContainer);
  window.addEventListener("resize", resizeRenderer);
}

function buildCityCenter() {
  const city = new THREE.Group();
  state.city.group = city;
  state.scene.add(city);

  const plazaAccentMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d2634,
    emissive: new THREE.Color(0x1aa7d7),
    emissiveIntensity: 0.42,
    roughness: 0.26,
    metalness: 0.55,
  });
  state.city.accentMaterials.push(plazaAccentMaterial);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({
      color: 0x111c26,
      roughness: 0.95,
      metalness: 0.02,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  city.add(ground);

  buildRoadNetwork(city);
  buildCentralPlaza(city, plazaAccentMaterial);
  buildBuildings(city);
  buildUrbanProps(city, plazaAccentMaterial);
  buildStreetlights(city);
  buildTraffic(city);
  buildRouteCurve(city);

  state.city.gridHelper = new THREE.GridHelper(96, 48, 0x3f98b8, 0x1a3544);
  state.city.gridHelper.position.y = 0.03;
  state.city.gridHelper.visible = false;
  city.add(state.city.gridHelper);

  dom.statScene.textContent = `${state.city.buildingCount} 栋建筑 · ${state.city.lightCount} 盏路灯`;
}

function buildRoadNetwork(city) {
  const roadMaterial = new THREE.MeshStandardMaterial({
    color: 0x202933,
    roughness: 0.94,
    metalness: 0.08,
  });
  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0xa3adb6,
    roughness: 0.88,
    metalness: 0.04,
  });
  const curbMaterial = new THREE.MeshStandardMaterial({
    color: 0x7f8a95,
    roughness: 0.82,
    metalness: 0.06,
  });
  const markMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8f8f2,
    emissive: new THREE.Color(0xe0dcc3),
    emissiveIntensity: 0.12,
    roughness: 0.78,
    metalness: 0.04,
  });
  const laneGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x49d7ff,
    transparent: true,
    opacity: 0.16,
  });

  const northSouthRoad = new THREE.Mesh(new THREE.BoxGeometry(14, 0.08, 92), roadMaterial);
  northSouthRoad.position.set(0, 0.04, 0);
  northSouthRoad.receiveShadow = true;
  city.add(northSouthRoad);

  const eastWestRoad = new THREE.Mesh(new THREE.BoxGeometry(92, 0.08, 14), roadMaterial);
  eastWestRoad.position.set(0, 0.04, 0);
  eastWestRoad.receiveShadow = true;
  city.add(eastWestRoad);

  const plazaApron = new THREE.Mesh(new THREE.BoxGeometry(26, 0.1, 26), sidewalkMaterial);
  plazaApron.position.set(0, 0.05, 0);
  plazaApron.receiveShadow = true;
  city.add(plazaApron);

  const sidewalkBlocks = [
    [-29, 0, 22, 0.06, 92],
    [29, 0, 22, 0.06, 92],
    [0, -29, 92, 0.06, 22],
    [0, 29, 92, 0.06, 22],
  ];
  for (const [x, z, w, h, d] of sidewalkBlocks) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), sidewalkMaterial);
    mesh.position.set(x, h / 2, z);
    mesh.receiveShadow = true;
    city.add(mesh);
  }

  const curbGeometries = [
    { geometry: new THREE.BoxGeometry(0.45, 0.16, 92), position: [7.4, 0.08, 0] },
    { geometry: new THREE.BoxGeometry(0.45, 0.16, 92), position: [-7.4, 0.08, 0] },
    { geometry: new THREE.BoxGeometry(92, 0.16, 0.45), position: [0, 0.08, 7.4] },
    { geometry: new THREE.BoxGeometry(92, 0.16, 0.45), position: [0, 0.08, -7.4] },
  ];
  for (const { geometry, position } of curbGeometries) {
    const curb = new THREE.Mesh(geometry, curbMaterial);
    curb.position.set(position[0], position[1], position[2]);
    curb.receiveShadow = true;
    city.add(curb);
  }

  for (let z = -38; z <= 38; z += 4) {
    if (Math.abs(z) < 10) {
      continue;
    }
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 1.7), markMaterial);
    dash.position.set(-2.2, 0.09, z);
    city.add(dash);

    const dashMirror = dash.clone();
    dashMirror.position.x = 2.2;
    city.add(dashMirror);
  }

  for (let x = -38; x <= 38; x += 4) {
    if (Math.abs(x) < 10) {
      continue;
    }
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.012, 0.28), markMaterial);
    dash.position.set(x, 0.09, -2.2);
    city.add(dash);

    const dashMirror = dash.clone();
    dashMirror.position.z = 2.2;
    city.add(dashMirror);
  }

  addCrosswalk(city, markMaterial, 0, -9.8, 0);
  addCrosswalk(city, markMaterial, 0, 9.8, 0);
  addCrosswalk(city, markMaterial, -9.8, 0, Math.PI / 2);
  addCrosswalk(city, markMaterial, 9.8, 0, Math.PI / 2);

  const laneGlow = new THREE.Mesh(
    new THREE.RingGeometry(13.6, 15.2, 96),
    laneGlowMaterial,
  );
  laneGlow.rotation.x = -Math.PI / 2;
  laneGlow.position.y = 0.1;
  city.add(laneGlow);
}

function addCrosswalk(city, material, x, z, rotationY) {
  const group = new THREE.Group();
  group.position.set(x, 0.095, z);
  group.rotation.y = rotationY;
  for (let index = -3; index <= 3; index += 1) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.01, 3.8), material);
    stripe.position.x = index * 1.25;
    group.add(stripe);
  }
  city.add(group);
}

function buildCentralPlaza(city, accentMaterial) {
  const plazaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(8.3, 8.7, 0.42, 48),
    new THREE.MeshStandardMaterial({
      color: 0x364554,
      roughness: 0.82,
      metalness: 0.1,
    }),
  );
  plazaBase.position.set(0, 0.21, 0);
  plazaBase.receiveShadow = true;
  city.add(plazaBase);

  const plazaPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(6.7, 7.1, 0.18, 48),
    new THREE.MeshStandardMaterial({
      color: 0x728291,
      roughness: 0.66,
      metalness: 0.12,
    }),
  );
  plazaPlate.position.set(0, 0.5, 0);
  city.add(plazaPlate);

  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.14, 16, 96), accentMaterial);
  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.y = 0.65;
  city.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.09, 16, 96), accentMaterial);
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.84;
  city.add(innerRing);

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 1.05, 4.4, 24),
    new THREE.MeshStandardMaterial({
      color: 0x0d1b28,
      emissive: new THREE.Color(0x0d78a7),
      emissiveIntensity: 0.24,
      roughness: 0.28,
      metalness: 0.76,
    }),
  );
  tower.position.y = 2.75;
  tower.castShadow = true;
  city.add(tower);

  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.82, 0), accentMaterial);
  crown.position.y = 5.42;
  crown.rotation.y = Math.PI / 4;
  city.add(crown);

  const plazaPulse = new THREE.Mesh(
    new THREE.RingGeometry(2.7, 3.1, 64),
    new THREE.MeshBasicMaterial({
      color: 0x76e6ff,
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  plazaPulse.rotation.x = -Math.PI / 2;
  plazaPulse.position.y = 0.72;
  city.add(plazaPulse);
  state.city.accentMaterials.push(plazaPulse.material);
}

function buildBuildings(city) {
  const placements = [
    [-28, -27, 8.6, 8.0, 20.0],
    [-20, -30, 6.2, 6.2, 15.0],
    [-34, -16, 7.2, 7.0, 24.0],
    [-18, -18, 6.0, 5.4, 12.0],
    [28, -27, 8.8, 8.4, 18.0],
    [20, -30, 5.8, 6.2, 13.0],
    [34, -18, 7.4, 6.8, 22.0],
    [18, -18, 6.2, 5.6, 11.5],
    [-28, 27, 8.8, 8.6, 21.0],
    [-19, 29, 5.8, 5.8, 14.0],
    [-35, 16, 7.0, 7.4, 23.5],
    [-18, 18, 6.2, 5.4, 13.0],
    [28, 27, 8.4, 8.2, 19.0],
    [20, 30, 5.8, 6.0, 12.0],
    [35, 18, 7.2, 7.2, 25.0],
    [18, 18, 6.1, 5.4, 14.0],
    [-11, -34, 5.0, 8.2, 14.0],
    [11, -34, 5.0, 8.2, 16.0],
    [-11, 34, 5.0, 8.2, 14.0],
    [11, 34, 5.0, 8.2, 16.0],
    [-34, -4, 7.0, 5.8, 18.5],
    [-34, 4, 6.6, 5.6, 16.0],
    [34, -4, 7.0, 5.8, 18.5],
    [34, 4, 6.6, 5.6, 16.0],
  ];

  for (const [x, z, width, depth, height] of placements) {
    const group = new THREE.Group();

    const podiumMaterial = createBuildingMaterial(0x213241, width, depth, 5.6);
    const towerMaterial = createBuildingMaterial(0x314556, width, depth, height);
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x89b3c9,
      emissive: new THREE.Color(0x234558),
      emissiveIntensity: 0.12,
      roughness: 0.34,
      metalness: 0.58,
    });

    const podium = new THREE.Mesh(new THREE.BoxGeometry(width + 0.9, 4.6, depth + 0.9), podiumMaterial);
    podium.position.y = 2.3;
    podium.castShadow = true;
    podium.receiveShadow = true;
    group.add(podium);

    const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), towerMaterial);
    tower.position.y = 4.6 + height / 2;
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(width * 0.44, 0.5, depth * 0.44), trimMaterial);
    roof.position.y = 4.6 + height + 0.4;
    group.add(roof);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 8), trimMaterial);
    antenna.position.y = 4.6 + height + 1.45;
    group.add(antenna);

    group.position.set(x, 0, z);
    city.add(group);
    state.city.buildingCount += 1;
  }
}

function createBuildingMaterial(color, width, depth, height) {
  const windowTexture = createWindowTexture();
  windowTexture.wrapS = THREE.RepeatWrapping;
  windowTexture.wrapT = THREE.RepeatWrapping;
  windowTexture.repeat.set(Math.max(2, width * 0.7), Math.max(3, height * 0.32));

  const material = new THREE.MeshStandardMaterial({
    color,
    map: windowTexture,
    emissive: new THREE.Color(0x5bcfff),
    emissiveMap: windowTexture,
    emissiveIntensity: 0.18,
    roughness: 0.42,
    metalness: 0.46,
  });

  state.city.windowMaterials.push(material);
  return material;
}

function buildUrbanProps(city, accentMaterial) {
  const planterMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b5d6d,
    roughness: 0.82,
    metalness: 0.1,
  });
  const treeTrunk = new THREE.MeshStandardMaterial({
    color: 0x76553c,
    roughness: 0.92,
    metalness: 0.02,
  });
  const treeLeaves = new THREE.MeshStandardMaterial({
    color: 0x3d7e66,
    roughness: 0.84,
    metalness: 0.04,
  });

  const planterPositions = [
    [-10.5, -10.5],
    [10.5, -10.5],
    [-10.5, 10.5],
    [10.5, 10.5],
    [0, -14],
    [14, 0],
    [0, 14],
    [-14, 0],
  ];
  for (const [x, z] of planterPositions) {
    const group = new THREE.Group();
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.55, 0.8, 18), planterMaterial);
    planter.position.y = 0.4;
    group.add(planter);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.8, 10), treeTrunk);
    trunk.position.y = 1.45;
    group.add(trunk);

    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), treeLeaves);
    canopy.position.y = 2.7;
    canopy.castShadow = true;
    group.add(canopy);

    group.position.set(x, 0, z);
    city.add(group);
  }

  const billboardData = [
    {
      position: new THREE.Vector3(-20, 4.5, -11),
      rotationY: Math.PI / 6,
      text: "CITY CORE DIGITAL TWIN",
    },
    {
      position: new THREE.Vector3(21, 4.2, 12),
      rotationY: -Math.PI / 7,
      text: "TRACKED VEHICLE LIVE UI",
    },
  ];
  for (const { position, rotationY, text } of billboardData) {
    const texture = createBillboardTexture(text);
    texture.anisotropy = Math.min(8, state.renderer.capabilities.getMaxAnisotropy());
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      toneMapped: false,
    });
    state.city.billboardMaterials.push(material);

    const panel = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 2.2), material);
    panel.position.copy(position);
    panel.rotation.y = rotationY;
    city.add(panel);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(7.45, 2.45, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x172531,
        emissive: new THREE.Color(0x204155),
        emissiveIntensity: 0.18,
        roughness: 0.34,
        metalness: 0.52,
      }),
    );
    frame.position.copy(position);
    frame.rotation.y = rotationY;
    city.add(frame);
  }

  const benchMaterial = new THREE.MeshStandardMaterial({
    color: 0x394956,
    roughness: 0.78,
    metalness: 0.14,
  });
  const benchWood = new THREE.MeshStandardMaterial({
    color: 0x8a6748,
    roughness: 0.9,
    metalness: 0.04,
  });

  const benchPositions = [
    [-6.8, -9.2, 0.16],
    [6.8, -9.2, -0.16],
    [-6.8, 9.2, -0.16],
    [6.8, 9.2, 0.16],
  ];

  for (const [x, z, rotOffset] of benchPositions) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.46), benchWood);
    seat.position.y = 0.62;
    bench.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.84, 0.16), benchWood);
    back.position.set(0, 1.0, -0.18);
    bench.add(back);

    const legA = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.74, 0.12), benchMaterial);
    legA.position.set(-0.9, 0.34, 0);
    bench.add(legA);

    const legB = legA.clone();
    legB.position.x = 0.9;
    bench.add(legB);

    bench.position.set(x, 0, z);
    bench.rotation.y = Math.atan2(z, x) + Math.PI / 2 + rotOffset;
    city.add(bench);
  }

  const guideArcs = [
    { radius: 11.5, width: 0.1, opacity: 0.28 },
    { radius: 13.8, width: 0.08, opacity: 0.18 },
  ];

  for (const { radius, width, opacity } of guideArcs) {
    const arc = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + width, 96),
      new THREE.MeshBasicMaterial({
        color: 0x58d7ff,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    arc.rotation.x = -Math.PI / 2;
    arc.position.y = 0.11;
    city.add(arc);
  }

  const beacon = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 14, 64), accentMaterial);
  beacon.rotation.x = Math.PI / 2;
  beacon.position.set(0, 3.85, 0);
  city.add(beacon);
}

function buildStreetlights(city) {
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x273743,
    roughness: 0.52,
    metalness: 0.58,
  });
  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8f6ff,
    emissive: new THREE.Color(0x73dfff),
    emissiveIntensity: 0.28,
    roughness: 0.18,
    metalness: 0.82,
  });

  const positions = [];
  for (const axis of [-12.6, 12.6]) {
    for (let z = -32; z <= 32; z += 12) {
      positions.push([axis, z, 0]);
    }
    for (let x = -32; x <= 32; x += 12) {
      positions.push([x, axis, Math.PI / 2]);
    }
  }

  for (const [x, z, rotationY] of positions) {
    const lamp = new THREE.Group();
    lamp.position.set(x, 0, z);
    lamp.rotation.y = rotationY;

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5.4, 12), poleMaterial);
    pole.position.y = 2.7;
    lamp.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMaterial);
    arm.position.set(0.72, 5.18, 0);
    lamp.add(arm);

    const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 18), bulbMaterial);
    lampHead.position.set(1.45, 5.14, 0);
    lamp.add(lampHead);
    state.city.lampBulbs.push(lampHead);

    const pointLight = new THREE.PointLight(0x6edfff, 0, 12, 2.0);
    pointLight.position.copy(lampHead.position);
    lamp.add(pointLight);
    state.city.streetLights.push(pointLight);
    state.city.lightCount += 1;

    city.add(lamp);
  }
}

function buildTraffic(city) {
  const trafficLanes = [
    createClosedCurve([
      [-34, -4.8],
      [-20, -4.8],
      [-12, -9.2],
      [12, -9.2],
      [20, -4.8],
      [34, -4.8],
      [34, -1.6],
      [20, -1.6],
      [12, -6.0],
      [-12, -6.0],
      [-20, -1.6],
      [-34, -1.6],
    ]),
    createClosedCurve([
      [-4.8, -34],
      [-4.8, -20],
      [-9.2, -12],
      [-9.2, 12],
      [-4.8, 20],
      [-4.8, 34],
      [-1.6, 34],
      [-1.6, 20],
      [-6.0, 12],
      [-6.0, -12],
      [-1.6, -20],
      [-1.6, -34],
    ]),
  ];

  const palette = [0xf8c35c, 0x7ae7ff, 0xff7d7d, 0xa9ff89, 0xe2f1ff, 0x9b8eff];
  const configs = [
    { lane: 0, progress: 0.03, speed: 0.013 },
    { lane: 0, progress: 0.28, speed: 0.011 },
    { lane: 0, progress: 0.64, speed: 0.0125 },
    { lane: 1, progress: 0.16, speed: 0.0145 },
    { lane: 1, progress: 0.42, speed: 0.0135 },
    { lane: 1, progress: 0.82, speed: 0.0128 },
  ];

  configs.forEach((config, index) => {
    const group = createTrafficVehicle(palette[index % palette.length]);
    city.add(group);
    state.city.trafficVehicles.push({
      group,
      curve: trafficLanes[config.lane],
      progress: config.progress,
      speed: config.speed,
    });
  });
}

function createTrafficVehicle(color) {
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(0.1),
    emissiveIntensity: 0.2,
    roughness: 0.34,
    metalness: 0.42,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x1b3040,
    emissive: new THREE.Color(0x56caff),
    emissiveIntensity: 0.12,
    roughness: 0.2,
    metalness: 0.6,
  });
  const lightMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff5c2,
    transparent: true,
    opacity: 0.86,
  });

  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 2.6), bodyMaterial);
  base.position.y = 0.5;
  base.castShadow = true;
  group.add(base);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.46, 1.1), glassMaterial);
  cabin.position.set(0, 0.92, -0.12);
  group.add(cabin);

  const headlightA = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.18), lightMaterial);
  headlightA.position.set(-0.42, 0.56, -1.27);
  group.add(headlightA);

  const headlightB = headlightA.clone();
  headlightB.position.x = 0.42;
  group.add(headlightB);

  return group;
}

function buildRouteCurve(city) {
  state.city.routeCurve = createClosedCurve([
    [0, 14.4],
    [10.4, 14.0],
    [15.0, 10.8],
    [15.8, 0],
    [15.0, -10.8],
    [10.4, -14.0],
    [0, -14.4],
    [-10.4, -14.0],
    [-15.0, -10.8],
    [-15.8, 0],
    [-15.0, 10.8],
    [-10.4, 14.0],
  ]);

  const points = state.city.routeCurve.getPoints(220);
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map((point) => point.clone().setY(0.12)),
  );
  const material = new THREE.LineDashedMaterial({
    color: 0x5ce0ff,
    dashSize: 0.85,
    gapSize: 0.42,
    transparent: true,
    opacity: 0.72,
  });
  const line = new THREE.LineLoop(geometry, material);
  line.computeLineDistances();
  city.add(line);
  state.city.routeLine = line;
}

function createVehicleSensorOverlay() {
  const group = new THREE.Group();
  group.position.y = 0.05;

  const ringTexture = createRadarTexture();
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 11.5),
    new THREE.MeshBasicMaterial({
      map: ringTexture,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  halo.rotation.x = -Math.PI / 2;
  group.add(halo);

  const sweep = new THREE.Mesh(
    new THREE.CircleGeometry(5.8, 48, 0, Math.PI * 0.28),
    new THREE.MeshBasicMaterial({
      color: 0x6fe8ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sweep.rotation.x = -Math.PI / 2;
  sweep.position.y = 0.01;
  group.add(sweep);

  const pulse = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 2.85, 64),
    new THREE.MeshBasicMaterial({
      color: 0x9ff4ff,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  pulse.rotation.x = -Math.PI / 2;
  pulse.position.y = 0.015;
  group.add(pulse);

  state.vehicle.sensorGroup = group;
  state.vehicle.sensorSweep = sweep;
  state.vehicle.sensorPulse = pulse;
  state.vehicle.sensorHalo = halo;
  state.vehicle.root.add(group);
}

function bindUi() {
  dom.cameraButtons.forEach((button) => {
    button.addEventListener("click", () => setCameraPreset(button.dataset.camera));
  });

  dom.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  dom.throttleRange.addEventListener("input", () => {
    state.vehicle.manualThrottle = Number(dom.throttleRange.value) / 100;
    updateRangeReadouts();
  });

  dom.steerRange.addEventListener("input", () => {
    state.vehicle.manualSteer = Number(dom.steerRange.value) / 100;
    updateRangeReadouts();
  });

  dom.btnStop.addEventListener("click", () => {
    setMode("manual");
    state.vehicle.manualThrottle = 0;
    state.vehicle.manualSteer = 0;
    dom.throttleRange.value = "0";
    dom.steerRange.value = "0";
    updateRangeReadouts();
  });

  dom.btnCenterVehicle.addEventListener("click", () => {
    setMode("manual");
    state.vehicle.manualThrottle = 0;
    state.vehicle.manualSteer = 0;
    dom.throttleRange.value = "0";
    dom.steerRange.value = "0";
    updateRangeReadouts();
    resetVehiclePose();
  });

  dom.btnResetCamera.addEventListener("click", () => setCameraPreset(state.currentCamera));

  dom.toggleFollow.addEventListener("change", () => {
    state.ui.followCamera = dom.toggleFollow.checked;
  });
  dom.toggleNight.addEventListener("change", () => {
    state.ui.nightMode = dom.toggleNight.checked;
  });
  dom.toggleSensors.addEventListener("change", () => {
    state.ui.showSensors = dom.toggleSensors.checked;
    state.vehicle.sensorGroup.visible = state.ui.showSensors;
  });
  dom.toggleTraffic.addEventListener("change", () => {
    state.ui.showTraffic = dom.toggleTraffic.checked;
    state.city.trafficVehicles.forEach(({ group }) => {
      group.visible = state.ui.showTraffic;
    });
    state.city.billboardMaterials.forEach((material) => {
      material.opacity = state.ui.showTraffic ? 1 : 0.25;
    });
  });
  dom.toggleGrid.addEventListener("change", () => {
    state.ui.showGrid = dom.toggleGrid.checked;
    if (state.city.gridHelper) {
      state.city.gridHelper.visible = state.ui.showGrid;
    }
  });

  document.addEventListener("keydown", (event) => handleKey(event, true));
  document.addEventListener("keyup", (event) => handleKey(event, false));

  resizeMiniMapCanvas();
  updateRangeReadouts();
}

function handleKey(event, pressed) {
  if (!(event.code in state.input.keys)) {
    return;
  }

  if (event.code.startsWith("Arrow")) {
    event.preventDefault();
  }

  state.input.keys[event.code] = pressed;
}

function loadModel() {
  const loader = new GLTFLoader();
  setStatus("loading", "开始加载履带小车模型");
  setLoadingProgress(0.05, "开始装载 tank.glb ...");

  loader.load(
    MODEL_URL,
    (gltf) => {
      const modelScene = gltf.scene;
      const fittedModel = normalizeAndScaleModel(modelScene);
      state.vehicle.modelRoot.add(fittedModel);
      fitVehicleShadow();
      indexDriveComponents(fittedModel);
      collectModelStats(fittedModel);
      setStatus("ready", "城市中心与履带小车已就绪");
      setLoadingProgress(1, "模型装载完成");
      dom.loadingOverlay.classList.add("hidden");
      state.vehicle.ready = true;
    },
    (event) => {
      const progress = event.total ? event.loaded / event.total : 0.28 + Math.min(0.62, event.loaded / MODEL_BYTES);
      setLoadingProgress(progress, `已载入 ${formatBytes(event.loaded)} / ${formatBytes(event.total || MODEL_BYTES)}`);
    },
    (error) => {
      console.error(error);
      setStatus("alert", "模型加载失败，请检查 tank.glb");
      dom.loadingText.textContent = "模型加载失败";
    },
  );
}

function normalizeAndScaleModel(modelScene) {
  const wrapper = new THREE.Group();
  wrapper.add(modelScene);

  modelScene.traverse((object) => {
    if (!object.isMesh) {
      return;
    }
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
  });

  const box = new THREE.Box3().setFromObject(modelScene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = MODEL_TARGET_LENGTH / Math.max(size.z, size.x, 0.001);

  modelScene.position.sub(center);
  modelScene.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(modelScene);
  modelScene.position.y -= scaledBox.min.y;
  modelScene.rotation.y = MODEL_YAW_OFFSET;

  return wrapper;
}

function fitVehicleShadow() {
  const box = new THREE.Box3().setFromObject(state.vehicle.modelRoot);
  const size = box.getSize(new THREE.Vector3());
  state.vehicle.contactShadow.scale.set(size.x * 0.92, size.z * 0.9, 1);
  state.vehicle.contactShadow.position.y = 0.03;
}

function indexDriveComponents(modelRoot) {
  const nodeMap = new Map();
  modelRoot.traverse((object) => {
    if (object.isMesh) {
      nodeMap.set(sanitizeNodeName(object.name), object);
    }
  });

  const leftTrack = nodeMap.get("track_L") || findTrackMesh(modelRoot, "L");
  const rightTrack = nodeMap.get("track_R") || findTrackMesh(modelRoot, "R");

  if (leftTrack) {
    state.vehicle.trackMaterials.left = applyTrackShader(leftTrack, "left");
  }
  if (rightTrack) {
    state.vehicle.trackMaterials.right = applyTrackShader(rightTrack, "right");
  }

  state.vehicle.wheelNodes.left = resolveWheelNodes(nodeMap, WHEEL_NAMES.left, "left", modelRoot);
  state.vehicle.wheelNodes.right = resolveWheelNodes(nodeMap, WHEEL_NAMES.right, "right", modelRoot);
}

function findTrackMesh(modelRoot, marker) {
  let match = null;
  modelRoot.traverse((object) => {
    if (match || !object.isMesh) {
      return;
    }
    const name = object.name.toLowerCase();
    if (name.includes("track") && name.includes(marker.toLowerCase())) {
      match = object;
    }
  });
  return match;
}

function resolveWheelNodes(nodeMap, names, side, modelRoot) {
  const nodes = names
    .map((name) => nodeMap.get(name))
    .filter(Boolean)
    .map((mesh) => ({
      mesh,
      baseRotation: mesh.rotation.x,
    }));

  if (nodes.length > 0) {
    return nodes;
  }

  const fallback = [];
  modelRoot.traverse((object) => {
    if (!object.isMesh || object.name.toLowerCase().includes("track")) {
      return;
    }
    if (!sanitizeNodeName(object.name).startsWith("part_")) {
      return;
    }
    if (side === "left" && object.position.x < -0.18 && object.position.y < 0.25) {
      fallback.push(object);
    }
    if (side === "right" && object.position.x > 0.18 && object.position.y < 0.25) {
      fallback.push(object);
    }
  });

  fallback.sort((a, b) => a.position.z - b.position.z);
  return fallback.slice(0, 6).map((mesh) => ({
    mesh,
    baseRotation: mesh.rotation.x,
  }));
}

function applyTrackShader(trackMesh, side) {
  trackMesh.geometry.computeBoundingBox();
  const box = trackMesh.geometry.boundingBox.clone();
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(0.01, size.y * 0.46);
  const straightHalf = Math.max(0.02, size.z * 0.5 - radius);

  const material = new THREE.MeshStandardMaterial({
    color: 0x3c434a,
    roughness: 0.9,
    metalness: 0.16,
    emissive: new THREE.Color(0x10161b),
    emissiveIntensity: 0.12,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTrackTime = { value: 0 };
    shader.uniforms.uTrackCenter = { value: new THREE.Vector2(center.y, center.z) };
    shader.uniforms.uTrackRadius = { value: radius };
    shader.uniforms.uTrackStraightHalf = { value: straightHalf };
    shader.uniforms.uTrackNightMix = { value: state.environment.nightBlend };

    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vLocalPosition;
        varying vec3 vObjectNormal;`,
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        vObjectNormal = normal;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vLocalPosition = position;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vLocalPosition;
        varying vec3 vObjectNormal;
        uniform float uTrackTime;
        uniform vec2 uTrackCenter;
        uniform float uTrackRadius;
        uniform float uTrackStraightHalf;
        uniform float uTrackNightMix;

        float getTrackCoord(vec2 yz) {
          float y = yz.x - uTrackCenter.x;
          float z = yz.y - uTrackCenter.y;
          float topLen = uTrackStraightHalf * 2.0;
          float bottomLen = topLen;

          if (z >= -uTrackStraightHalf && z <= uTrackStraightHalf && y >= 0.0) {
            return z + uTrackStraightHalf;
          }

          if (z > uTrackStraightHalf) {
            float angle = atan(-y, z - uTrackStraightHalf) + 1.57079632679;
            angle = clamp(angle, 0.0, 3.14159265359);
            return topLen + angle * uTrackRadius;
          }

          if (z >= -uTrackStraightHalf && z <= uTrackStraightHalf) {
            return topLen + 3.14159265359 * uTrackRadius + (uTrackStraightHalf - z);
          }

          float angle = atan(y, -z - uTrackStraightHalf) + 1.57079632679;
          angle = clamp(angle, 0.0, 3.14159265359);
          return topLen + 3.14159265359 * uTrackRadius + bottomLen + angle * uTrackRadius;
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float loopLength = max(0.001, 4.0 * uTrackStraightHalf + 6.28318530718 * uTrackRadius);
        float trackCoord = getTrackCoord(vLocalPosition.yz);
        float phase = fract((trackCoord / loopLength) * 26.0 - uTrackTime * 0.45);
        float pad = smoothstep(0.05, 0.2, phase) * (1.0 - smoothstep(0.58, 0.92, phase));
        float groove = 1.0 - smoothstep(0.0, 0.06, abs(fract(vLocalPosition.x * 6.0 + 0.5) - 0.5));
        float normalAccent = pow(1.0 - abs(normalize(vObjectNormal).y), 1.65);
        vec3 treadColor = mix(vec3(0.16, 0.18, 0.19), vec3(0.43, 0.45, 0.47), pad * 0.78 + groove * 0.14);
        treadColor += normalAccent * 0.08;
        treadColor += vec3(0.02, 0.05, 0.08) * uTrackNightMix * (0.2 + pad * 0.8);
        diffuseColor.rgb = mix(diffuseColor.rgb, treadColor, 0.92);`,
      );
  };

  material.customProgramCacheKey = () => `track-material-${side}`;
  trackMesh.material = material;
  return material;
}

function collectModelStats(modelRoot) {
  const stats = {
    triangles: 0,
    meshes: 0,
    materials: new Set(),
  };

  modelRoot.traverse((object) => {
    if (!object.isMesh) {
      return;
    }
    stats.meshes += 1;
    stats.materials.add(object.material.uuid);
    const position = object.geometry.getAttribute("position");
    if (!position) {
      return;
    }
    const index = object.geometry.getIndex();
    stats.triangles += index ? index.count / 3 : position.count / 3;
  });

  state.vehicle.stats.triangles = Math.round(stats.triangles);
  state.vehicle.stats.meshes = stats.meshes;
  state.vehicle.stats.materials = stats.materials.size;

  dom.statTriangles.textContent = formatNumber(state.vehicle.stats.triangles);
  dom.statMeshes.textContent = `${state.vehicle.stats.meshes}`;
  dom.statMaterials.textContent = `${state.vehicle.stats.materials}`;
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(state.clock.getDelta(), 0.05);
  const elapsed = state.clock.getElapsedTime();

  updateVehicle(delta, elapsed);
  updateTraffic(delta);
  updateSensors(elapsed);
  updateEnvironment(delta, elapsed);
  updateCamera(delta);
  updateHud();
  drawMiniMap();

  state.controls.update();
  state.renderer.render(state.scene, state.camera);
}

function updateVehicle(delta, elapsed) {
  const keyThrottle = (state.input.keys.KeyW || state.input.keys.ArrowUp ? 1 : 0)
    - (state.input.keys.KeyS || state.input.keys.ArrowDown ? 1 : 0);
  const keySteer = (state.input.keys.KeyD || state.input.keys.ArrowRight ? 1 : 0)
    - (state.input.keys.KeyA || state.input.keys.ArrowLeft ? 1 : 0);

  const throttleInput = clamp(state.vehicle.manualThrottle + keyThrottle * 0.92, -1, 1);
  const steerInput = clamp(state.vehicle.manualSteer + keySteer * 0.86, -1, 1);

  let leftTrackSpeed = 0;
  let rightTrackSpeed = 0;

  if (state.mode === "patrol" && state.city.routeCurve) {
    const routeLength = state.city.routeCurve.getLength();
    const patrolSpeed = 4.7;
    const nextDistance = (state.vehicle.routeDistance + patrolSpeed * delta) % routeLength;

    const previousPosition = state.city.routeCurve.getPointAt((state.vehicle.routeDistance % routeLength) / routeLength, TEMP_A);
    const position = state.city.routeCurve.getPointAt(nextDistance / routeLength, TEMP_B).clone();
    const tangent = state.city.routeCurve.getTangentAt(nextDistance / routeLength, TEMP_C).normalize();
    const previousHeading = state.vehicle.heading;

    state.vehicle.root.position.set(position.x, 0, position.z);
    state.vehicle.heading = Math.atan2(tangent.x, tangent.z);
    state.vehicle.root.rotation.y = state.vehicle.heading;
    state.vehicle.routeDistance = nextDistance;
    state.vehicle.speed = THREE.MathUtils.damp(state.vehicle.speed, patrolSpeed, 5, delta);

    const headingDelta = shortestAngleDelta(previousHeading, state.vehicle.heading) / Math.max(delta, 0.0001);
    leftTrackSpeed = patrolSpeed - headingDelta * 0.72;
    rightTrackSpeed = patrolSpeed + headingDelta * 0.72;

    TEMP_D.subVectors(position, previousPosition);
    if (TEMP_D.lengthSq() < 0.00001) {
      leftTrackSpeed = patrolSpeed;
      rightTrackSpeed = patrolSpeed;
    }
  } else if (state.mode === "inspection") {
    const spinRate = 0.72;
    state.vehicle.speed = THREE.MathUtils.damp(state.vehicle.speed, 0, 6, delta);
    state.vehicle.heading += spinRate * delta;
    state.vehicle.root.position.lerp(new THREE.Vector3(0, 0, 9.3), 1 - Math.exp(-delta * 4));
    state.vehicle.root.rotation.y = state.vehicle.heading;
    leftTrackSpeed = -1.4;
    rightTrackSpeed = 1.4;
  } else {
    const targetSpeed = throttleInput * state.vehicle.maxSpeed;
    state.vehicle.speed = THREE.MathUtils.damp(state.vehicle.speed, targetSpeed, Math.abs(targetSpeed) > Math.abs(state.vehicle.speed) ? 3.4 : 6.0, delta);

    const turnGain = 0.95 + Math.min(1.6, Math.abs(state.vehicle.speed) * 0.12);
    const headingRate = steerInput * turnGain;
    state.vehicle.heading += headingRate * delta;

    const forward = TEMP_A.set(Math.sin(state.vehicle.heading), 0, Math.cos(state.vehicle.heading));
    state.vehicle.root.position.addScaledVector(forward, state.vehicle.speed * delta);
    state.vehicle.root.position.x = clamp(state.vehicle.root.position.x, -18.5, 18.5);
    state.vehicle.root.position.z = clamp(state.vehicle.root.position.z, -18.5, 18.5);
    state.vehicle.root.rotation.y = state.vehicle.heading;

    leftTrackSpeed = state.vehicle.speed - headingRate * 1.35;
    rightTrackSpeed = state.vehicle.speed + headingRate * 1.35;
  }

  state.vehicle.leftTrackSpeed = leftTrackSpeed;
  state.vehicle.rightTrackSpeed = rightTrackSpeed;
  updateDriveAnimation(delta);

  const leanTarget = clamp((state.vehicle.rightTrackSpeed - state.vehicle.leftTrackSpeed) * -0.025, -0.1, 0.1);
  const pitchTarget = clamp(state.vehicle.speed * 0.015, -0.08, 0.08);
  state.vehicle.mount.rotation.z = THREE.MathUtils.damp(state.vehicle.mount.rotation.z, leanTarget, 6, delta);
  state.vehicle.mount.rotation.x = THREE.MathUtils.damp(state.vehicle.mount.rotation.x, -pitchTarget, 6, delta);
  state.vehicle.mount.position.y = 0.06 + Math.sin(elapsed * 4.6) * Math.min(0.03, Math.abs(state.vehicle.speed) * 0.003);
}

function updateDriveAnimation(delta) {
  state.vehicle.trackMotion.left += state.vehicle.leftTrackSpeed * delta;
  state.vehicle.trackMotion.right += state.vehicle.rightTrackSpeed * delta;
  state.vehicle.wheelSpin.left += (state.vehicle.leftTrackSpeed / state.vehicle.wheelRadius) * delta;
  state.vehicle.wheelSpin.right += (state.vehicle.rightTrackSpeed / state.vehicle.wheelRadius) * delta;

  for (const wheel of state.vehicle.wheelNodes.left) {
    wheel.mesh.rotation.x = wheel.baseRotation - state.vehicle.wheelSpin.left;
  }
  for (const wheel of state.vehicle.wheelNodes.right) {
    wheel.mesh.rotation.x = wheel.baseRotation - state.vehicle.wheelSpin.right;
  }

  const leftShader = state.vehicle.trackMaterials.left?.userData.shader;
  const rightShader = state.vehicle.trackMaterials.right?.userData.shader;
  if (leftShader) {
    leftShader.uniforms.uTrackTime.value = state.vehicle.trackMotion.left;
  }
  if (rightShader) {
    rightShader.uniforms.uTrackTime.value = state.vehicle.trackMotion.right;
  }
}

function updateTraffic(delta) {
  for (const traffic of state.city.trafficVehicles) {
    traffic.group.visible = state.ui.showTraffic;
    if (!state.ui.showTraffic) {
      continue;
    }

    traffic.progress = (traffic.progress + traffic.speed * delta * 14) % 1;
    const position = traffic.curve.getPointAt(traffic.progress, TEMP_A).clone();
    const tangent = traffic.curve.getTangentAt(traffic.progress, TEMP_B).normalize();

    traffic.group.position.set(position.x, 0, position.z);
    traffic.group.rotation.y = Math.atan2(tangent.x, tangent.z);
  }
}

function updateSensors(elapsed) {
  if (!state.vehicle.sensorGroup) {
    return;
  }

  state.vehicle.sensorGroup.visible = state.ui.showSensors;
  if (!state.ui.showSensors) {
    return;
  }

  state.vehicle.sensorSweep.rotation.z = elapsed * 1.6;
  const pulseScale = 1 + Math.sin(elapsed * 2.2) * 0.1;
  state.vehicle.sensorPulse.scale.setScalar(pulseScale);
  state.vehicle.sensorPulse.material.opacity = 0.28 + (Math.sin(elapsed * 2.2) * 0.5 + 0.5) * 0.18;
  state.vehicle.sensorHalo.material.opacity = 0.22 + (Math.cos(elapsed * 1.4) * 0.5 + 0.5) * 0.1;
}

function updateEnvironment(delta, elapsed) {
  state.environment.nightBlend = THREE.MathUtils.damp(
    state.environment.nightBlend,
    state.ui.nightMode ? 1 : 0,
    2.8,
    delta,
  );

  const blend = state.environment.nightBlend;
  state.scene.background.copy(DAY_COLORS.background).lerp(NIGHT_COLORS.background, blend);
  state.scene.fog.color.copy(DAY_COLORS.fog).lerp(NIGHT_COLORS.fog, blend);

  state.environment.hemiLight.intensity = THREE.MathUtils.lerp(1.25, 0.24, blend);
  state.environment.sunLight.intensity = THREE.MathUtils.lerp(1.65, 0.1, blend);
  state.environment.fillLight.intensity = THREE.MathUtils.lerp(0.38, 0.12, blend);
  state.environment.plazaLight.intensity = THREE.MathUtils.lerp(0.0, 1.6, blend);

  state.city.windowMaterials.forEach((material) => {
    material.emissiveIntensity = THREE.MathUtils.lerp(0.18, 0.92, blend);
  });
  state.city.accentMaterials.forEach((material) => {
    if (!("emissiveIntensity" in material)) {
      material.opacity = THREE.MathUtils.lerp(0.12, 0.4, blend);
      return;
    }
    material.emissiveIntensity = THREE.MathUtils.lerp(0.28, 1.25, blend);
  });
  state.city.billboardMaterials.forEach((material) => {
    material.opacity = state.ui.showTraffic ? THREE.MathUtils.lerp(0.86, 1, blend) : 0.25;
  });
  state.city.lampBulbs.forEach((bulb) => {
    bulb.material.emissiveIntensity = THREE.MathUtils.lerp(0.28, 1.7, blend);
  });
  state.city.streetLights.forEach((light) => {
    light.intensity = THREE.MathUtils.lerp(0, 1.1, blend);
  });

  if (state.environment.skyUniforms) {
    state.environment.skyUniforms.uNightMix.value = blend;
    state.environment.skyUniforms.uTime.value = elapsed;
  }
  if (state.environment.starsMaterial) {
    state.environment.starsMaterial.opacity = blend * 0.82;
  }

  const leftShader = state.vehicle.trackMaterials.left?.userData.shader;
  const rightShader = state.vehicle.trackMaterials.right?.userData.shader;
  if (leftShader) {
    leftShader.uniforms.uTrackNightMix.value = blend;
  }
  if (rightShader) {
    rightShader.uniforms.uTrackNightMix.value = blend;
  }
}

function updateCamera(delta) {
  const pose = getCameraPose(state.currentCamera);
  const smoothFactor = 1 - Math.exp(-delta * (state.currentCamera === "chase" || state.currentCamera === "tactical" ? 5.4 : 4.2));

  state.camera.position.lerp(pose.position, smoothFactor);
  state.controls.target.lerp(pose.target, smoothFactor);
}

function getCameraPose(name) {
  const vehiclePos = state.vehicle.root.position.clone();
  const heading = state.vehicle.heading;

  switch (name) {
    case "boulevard": {
      const target = state.ui.followCamera ? vehiclePos.clone().add(new THREE.Vector3(0, 1.4, 0)) : new THREE.Vector3(0, 1.6, 0);
      return {
        position: new THREE.Vector3(-27, 9.5, 19),
        target,
      };
    }
    case "chase": {
      const offset = new THREE.Vector3(0, 4.6, -10.5).applyAxisAngle(WORLD_UP, heading);
      return {
        position: vehiclePos.clone().add(offset),
        target: vehiclePos.clone().add(new THREE.Vector3(0, 1.7, 0)),
      };
    }
    case "tactical": {
      return {
        position: vehiclePos.clone().add(new THREE.Vector3(0, 24, 0.001)),
        target: vehiclePos.clone().add(new THREE.Vector3(0, 0.2, 0)),
      };
    }
    case "hero":
    default:
      return {
        position: new THREE.Vector3(25, 18, 24),
        target: state.ui.followCamera ? vehiclePos.clone().add(new THREE.Vector3(0, 1.4, 0)) : new THREE.Vector3(0, 2.5, 0),
      };
  }
}

function updateHud() {
  const speedKph = Math.abs(state.vehicle.speed * 3.6);
  const position = state.vehicle.root.position;

  dom.modeReadout.textContent = MODE_CONFIG[state.mode].label;
  dom.cameraReadout.textContent = CAMERA_PRESETS[state.currentCamera].label;
  dom.speedReadout.textContent = `${speedKph.toFixed(1)} km/h`;
  dom.positionReadout.textContent = `(${position.x.toFixed(1)}, ${position.z.toFixed(1)})`;

  dom.telemetrySpeed.textContent = `${speedKph.toFixed(1)} km/h`;
  dom.telemetryHeading.textContent = `${formatHeading(state.vehicle.heading)}°`;
  dom.telemetryLeftTrack.textContent = `${state.vehicle.leftTrackSpeed.toFixed(2)} m/s`;
  dom.telemetryRightTrack.textContent = `${state.vehicle.rightTrackSpeed.toFixed(2)} m/s`;
}

function drawMiniMap() {
  resizeMiniMapCanvas();
  const ctx = state.miniMap.ctx;
  if (!ctx) {
    return;
  }

  const width = state.miniMap.width;
  const height = state.miniMap.height;
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = "#081119";
  ctx.fillRect(0, 0, width, height);

  drawMiniMapGrid(ctx, width, height);
  drawMiniMapRoads(ctx, width, height);
  drawMiniMapRoute(ctx, width, height);
  drawMiniMapTraffic(ctx, width, height);
  drawMiniMapVehicle(ctx, width, height);

  ctx.strokeStyle = "rgba(88, 215, 255, 0.26)";
  ctx.lineWidth = 1;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  ctx.fillStyle = "rgba(230, 244, 255, 0.85)";
  ctx.font = "12px Orbitron, sans-serif";
  ctx.fillText("N", width - 20, 18);
}

function drawMiniMapGrid(ctx, width, height) {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  for (let step = 20; step < width; step += 20) {
    ctx.beginPath();
    ctx.moveTo(step, 0);
    ctx.lineTo(step, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, step);
    ctx.lineTo(width, step);
    ctx.stroke();
  }
}

function drawMiniMapRoads(ctx, width, height) {
  ctx.fillStyle = "#18232d";
  const vertical = worldToMiniMapRect(-7, -42, 14, 84, width, height);
  const horizontal = worldToMiniMapRect(-42, -7, 84, 14, width, height);
  ctx.fillRect(vertical.x, vertical.y, vertical.w, vertical.h);
  ctx.fillRect(horizontal.x, horizontal.y, horizontal.w, horizontal.h);

  ctx.fillStyle = "rgba(88, 215, 255, 0.08)";
  const plaza = worldToMiniMapRect(-13, -13, 26, 26, width, height);
  ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
}

function drawMiniMapRoute(ctx, width, height) {
  if (!state.city.routeCurve) {
    return;
  }

  const points = state.city.routeCurve.getPoints(120);
  ctx.strokeStyle = "rgba(88, 215, 255, 0.92)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  points.forEach((point, index) => {
    const mapped = worldToMiniMap(point.x, point.z, width, height);
    if (index === 0) {
      ctx.moveTo(mapped.x, mapped.y);
    } else {
      ctx.lineTo(mapped.x, mapped.y);
    }
  });
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMiniMapTraffic(ctx, width, height) {
  if (!state.ui.showTraffic) {
    return;
  }

  ctx.fillStyle = "rgba(255, 184, 92, 0.8)";
  state.city.trafficVehicles.forEach(({ group }) => {
    const mapped = worldToMiniMap(group.position.x, group.position.z, width, height);
    ctx.beginPath();
    ctx.arc(mapped.x, mapped.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawMiniMapVehicle(ctx, width, height) {
  const { x, y } = worldToMiniMap(state.vehicle.root.position.x, state.vehicle.root.position.z, width, height);
  const heading = state.vehicle.heading;
  const size = 7;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.fillStyle = "#a8fbff";
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.72, size * 0.86);
  ctx.lineTo(-size * 0.72, size * 0.86);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function resizeMiniMapCanvas() {
  const rect = dom.miniMap.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const targetWidth = Math.round(rect.width * ratio);
  const targetHeight = Math.round(rect.height * ratio);
  if (dom.miniMap.width === targetWidth && dom.miniMap.height === targetHeight) {
    return;
  }

  dom.miniMap.width = targetWidth;
  dom.miniMap.height = targetHeight;
  const ctx = dom.miniMap.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  state.miniMap.ctx = ctx;
  state.miniMap.ratio = ratio;
  state.miniMap.width = rect.width;
  state.miniMap.height = rect.height;
}

function resetVehiclePose() {
  state.vehicle.routeDistance = 0;
  state.vehicle.heading = 0;
  state.vehicle.speed = 0;
  state.vehicle.leftTrackSpeed = 0;
  state.vehicle.rightTrackSpeed = 0;
  state.vehicle.wheelSpin.left = 0;
  state.vehicle.wheelSpin.right = 0;
  state.vehicle.trackMotion.left = 0;
  state.vehicle.trackMotion.right = 0;
  state.vehicle.root.position.set(0, 0, 14.4);
  state.vehicle.root.rotation.y = 0;
  state.vehicle.mount.rotation.set(0, 0, 0);
}

function setMode(mode) {
  state.mode = mode;
  const config = MODE_CONFIG[mode];

  dom.modeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  dom.modeDescription.textContent = config.description;
  dom.modeNote.textContent = config.note;
  dom.sceneNote.textContent = config.sceneNote;

  if (mode === "patrol" && state.city.routeCurve) {
    const routeLength = state.city.routeCurve.getLength();
    const routeT = ((state.vehicle.routeDistance % routeLength) + routeLength) % routeLength / routeLength;
    const start = state.city.routeCurve.getPointAt(routeT, TEMP_A);
    const tangent = state.city.routeCurve.getTangentAt(routeT, TEMP_B).normalize();
    state.vehicle.root.position.set(start.x, 0, start.z);
    state.vehicle.heading = Math.atan2(tangent.x, tangent.z);
    state.vehicle.root.rotation.y = state.vehicle.heading;
    setStatus("ready", "城市巡航模式运行中");
  } else if (mode === "inspection") {
    setStatus("ready", "定点展示模式运行中");
  } else {
    setStatus("ready", "手动驾驶模式待命");
  }
}

function setCameraPreset(cameraName) {
  state.currentCamera = cameraName;
  dom.cameraButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.camera === cameraName);
  });
}

function updateRangeReadouts() {
  dom.throttleValue.textContent = `${Math.round(state.vehicle.manualThrottle * 100)}%`;
  dom.steerValue.textContent = `${Math.round(state.vehicle.manualSteer * 100)}%`;
}

function resizeRenderer() {
  const { clientWidth, clientHeight } = dom.sceneContainer;
  if (!clientWidth || !clientHeight) {
    return;
  }
  state.camera.aspect = clientWidth / clientHeight;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(clientWidth, clientHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
}

function setStatus(status, text) {
  dom.statusBadge.dataset.state = status;
  dom.statusText.textContent = text;
}

function setLoadingProgress(progress, text) {
  dom.progressBar.style.width = `${Math.round(clamp(progress, 0, 1) * 100)}%`;
  dom.loadingText.textContent = text;
}

function createSkyDome() {
  const uniforms = {
    uNightMix: { value: 0 },
    uTime: { value: 0 },
    uDayTop: { value: new THREE.Color(0x7eb6d6) },
    uDayBottom: { value: new THREE.Color(0xd5e5ee) },
    uNightTop: { value: new THREE.Color(0x07111a) },
    uNightBottom: { value: new THREE.Color(0x102134) },
  };

  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorldPosition;

      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uNightMix;
      uniform float uTime;
      uniform vec3 uDayTop;
      uniform vec3 uDayBottom;
      uniform vec3 uNightTop;
      uniform vec3 uNightBottom;
      varying vec3 vWorldPosition;

      void main() {
        float h = normalize(vWorldPosition).y * 0.5 + 0.5;
        vec3 dayColor = mix(uDayBottom, uDayTop, smoothstep(0.05, 0.95, h));
        vec3 nightColor = mix(uNightBottom, uNightTop, smoothstep(0.02, 0.96, h));

        float horizonGlow = pow(1.0 - abs(h - 0.46), 2.6);
        vec3 dayGlow = vec3(1.0, 0.84, 0.58) * horizonGlow * 0.12;
        vec3 nightGlow = vec3(0.22, 0.53, 0.74) * horizonGlow * 0.16;

        float pulse = sin(uTime * 0.08) * 0.5 + 0.5;
        vec3 color = mix(dayColor + dayGlow, nightColor + nightGlow * (0.7 + pulse * 0.3), uNightMix);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const sky = new THREE.Mesh(new THREE.SphereGeometry(170, 48, 32), skyMaterial);

  const starGeometry = new THREE.BufferGeometry();
  const starCount = 500;
  const positions = new Float32Array(starCount * 3);
  for (let index = 0; index < starCount; index += 1) {
    const radius = 118 + Math.random() * 20;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.6;
    positions[index * 3 + 0] = Math.cos(theta) * Math.sin(phi) * radius;
    positions[index * 3 + 1] = Math.cos(phi) * radius;
    positions[index * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
  }
  starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const starsMaterial = new THREE.PointsMaterial({
    color: 0xd6f2ff,
    size: 0.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  sky.add(new THREE.Points(starGeometry, starsMaterial));

  return {
    sky,
    uniforms,
    starsMaterial,
  };
}

function createContactShadow() {
  const texture = createShadowTexture();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  return mesh;
}

function createWindowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#233444";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gapX = 32;
  const gapY = 24;
  for (let y = 10; y < canvas.height - 10; y += gapY) {
    for (let x = 10; x < canvas.width - 10; x += gapX) {
      const active = (x + y) % 3 === 0;
      ctx.fillStyle = active ? "#7ddcff" : "#32475b";
      ctx.fillRect(x, y, 16, 10);
    }
  }

  return new THREE.CanvasTexture(canvas);
}

function createBillboardTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#071620");
  gradient.addColorStop(1, "#123345");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(88, 215, 255, 0.4)";
  ctx.lineWidth = 12;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  ctx.fillStyle = "#56d7ff";
  ctx.font = "700 48px Orbitron";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fillRect(36, 62, canvas.width - 72, 10);

  return new THREE.CanvasTexture(canvas);
}

function createRadarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const center = canvas.width / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, "rgba(88, 215, 255, 0.24)");
  gradient.addColorStop(0.5, "rgba(88, 215, 255, 0.08)");
  gradient.addColorStop(1, "rgba(88, 215, 255, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(130, 235, 255, 0.35)";
  ctx.lineWidth = 2;
  for (let radius = 70; radius <= 220; radius += 50) {
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(center, 0);
  ctx.lineTo(center, canvas.height);
  ctx.moveTo(0, center);
  ctx.lineTo(canvas.width, center);
  ctx.stroke();

  return new THREE.CanvasTexture(canvas);
}

function createShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 20, 128, 128, 110);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.6)");
  gradient.addColorStop(0.65, "rgba(0, 0, 0, 0.22)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return new THREE.CanvasTexture(canvas);
}

function createClosedCurve(points) {
  return new THREE.CatmullRomCurve3(
    points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    "catmullrom",
    0.08,
  );
}

function sanitizeNodeName(name) {
  return name.replaceAll(".", "");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function formatHeading(radians) {
  let degrees = THREE.MathUtils.radToDeg(radians) % 360;
  if (degrees < 0) {
    degrees += 360;
  }
  return Math.round(degrees);
}

function shortestAngleDelta(from, to) {
  let delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) {
    delta += Math.PI * 2;
  }
  return delta;
}

function worldToMiniMap(x, z, width, height) {
  const range = 44;
  const scale = Math.min(width, height) / (range * 2);
  return {
    x: width / 2 + x * scale,
    y: height / 2 + z * scale,
  };
}

function worldToMiniMapRect(x, z, w, d, width, height) {
  const p0 = worldToMiniMap(x, z, width, height);
  const p1 = worldToMiniMap(x + w, z + d, width, height);
  return {
    x: Math.min(p0.x, p1.x),
    y: Math.min(p0.y, p1.y),
    w: Math.abs(p1.x - p0.x),
    h: Math.abs(p1.y - p0.y),
  };
}
