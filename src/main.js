import "./style.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = `${import.meta.env.BASE_URL}models/ding.glb`;
const MODEL_NAME = "丁.glb";
const MODEL_BYTES = 69224448;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const ACTIVITY_META = {
  study: {
    label: "学习模式",
    description: "人物停留在课桌旁，保持专注学习状态，书页缓慢翻动。",
    note: "演示重点：静态人物模型结合教室场景与细微呼吸姿态，形成学习氛围。",
  },
  book: {
    label: "翻书模式",
    description: "翻页速度明显增强，镜头更聚焦人物与课桌上的书本互动。",
    note: "演示重点：通过程序化翻页和轻微前倾动作，增强“正在翻书”的视觉反馈。",
  },
  walk: {
    label: "走动模式",
    description: "人物沿教室通道往返移动，适合展示模型在空间中的浏览效果。",
    note: "演示重点：人物沿预设路径行走，并可启用镜头跟随进行演示。",
  },
};

const CAMERA_PRESETS = {
  overview: {
    label: "全景总览",
    position: new THREE.Vector3(10.6, 7.2, 11.2),
    target: new THREE.Vector3(0, 1.4, -0.8),
  },
  desk: {
    label: "课桌近景",
    position: new THREE.Vector3(3.7, 2.25, 1.9),
    target: new THREE.Vector3(0.12, 1.12, -1.5),
  },
  aisle: {
    label: "通道视角",
    position: new THREE.Vector3(7.6, 2.5, 6.0),
    target: new THREE.Vector3(0.8, 1.2, 1.2),
  },
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
  positionReadout: document.querySelector("#position-readout"),
  activityDescription: document.querySelector("#activity-description"),
  sceneNote: document.querySelector("#scene-note"),
  statFileSize: document.querySelector("#stat-file-size"),
  statTriangles: document.querySelector("#stat-triangles"),
  statMeshes: document.querySelector("#stat-meshes"),
  statMaterials: document.querySelector("#stat-materials"),
  statAnimation: document.querySelector("#stat-animation"),
  statScene: document.querySelector("#stat-scene"),
  activityButtons: document.querySelectorAll("[data-activity]"),
  cameraButtons: document.querySelectorAll("[data-camera]"),
  toggleAuto: document.querySelector("#toggle-auto"),
  toggleFollow: document.querySelector("#toggle-follow"),
  toggleGrid: document.querySelector("#toggle-grid"),
  toggleNight: document.querySelector("#toggle-night"),
  resetCamera: document.querySelector("#btn-reset-camera"),
  studyHome: document.querySelector("#btn-study-home"),
};

const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();

const state = {
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  resizeObserver: null,
  clock: new THREE.Timer(),
  cameraTransition: null,
  currentCameraLabel: CAMERA_PRESETS.overview.label,
  activity: "study",
  autoCycle: false,
  autoElapsed: 0,
  gridHelper: null,
  environment: {
    hemiLight: null,
    sunLight: null,
    pointLights: [],
    glowingPanels: [],
    windowMaterials: [],
    beamMaterials: [],
    boardFrame: null,
  },
  model: {
    anchor: null,
    motionPivot: null,
    assetRoot: null,
    contactShadow: null,
    ready: false,
    forwardOffset: Math.PI,
    stats: {
      meshes: 0,
      materials: 0,
      triangles: 0,
    },
  },
  classroom: {
    frontDesk: null,
    walkCurve: null,
    walkProgress: 0,
    frontDeskPosition: new THREE.Vector3(0, 0, -1.55),
    studyPosition: new THREE.Vector3(0.92, 0, -1.46),
  },
  book: {
    group: null,
    pages: [],
    rightCover: null,
  },
};

init();

function init() {
  dom.modelFileLabel.textContent = MODEL_NAME;
  dom.statFileSize.textContent = formatBytes(MODEL_BYTES);
  dom.statAnimation.textContent = "程序化翻页 + 路径走动";
  dom.statScene.textContent = "教室 9 套课桌";
  state.clock.connect(document);

  setupScene();
  buildClassroom();
  bindUi();
  setActivity("study", { withCamera: false });
  setCameraPreset("overview", true);
  applyEnvironment();
  animate();
  loadModel();
}

function setupScene() {
  state.scene = new THREE.Scene();
  state.scene.background = new THREE.Color(0xdceef2);
  state.scene.fog = new THREE.Fog(0xdceef2, 18, 34);

  const { clientWidth, clientHeight } = dom.sceneContainer;
  state.camera = new THREE.PerspectiveCamera(36, clientWidth / clientHeight, 0.1, 80);
  state.camera.position.copy(CAMERA_PRESETS.overview.position);

  state.renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  state.renderer.setSize(clientWidth, clientHeight);
  state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
  state.renderer.outputColorSpace = THREE.SRGBColorSpace;
  state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  state.renderer.toneMappingExposure = 1.0;
  dom.sceneContainer.appendChild(state.renderer.domElement);

  state.controls = new OrbitControls(state.camera, state.renderer.domElement);
  state.controls.enableDamping = true;
  state.controls.enablePan = true;
  state.controls.minDistance = 4;
  state.controls.maxDistance = 24;
  state.controls.maxPolarAngle = Math.PI / 2.05;
  state.controls.target.copy(CAMERA_PRESETS.overview.target);

  state.model.anchor = new THREE.Group();
  state.model.motionPivot = new THREE.Group();
  state.model.assetRoot = new THREE.Group();
  state.model.motionPivot.add(state.model.assetRoot);
  state.model.anchor.add(state.model.motionPivot);
  state.model.contactShadow = createContactShadow();
  state.model.anchor.add(state.model.contactShadow);
  state.scene.add(state.model.anchor);

  state.environment.hemiLight = new THREE.HemisphereLight(0xeaf5ff, 0xc98e56, 1.15);
  state.scene.add(state.environment.hemiLight);

  state.environment.sunLight = new THREE.DirectionalLight(0xfff2de, 1.5);
  state.environment.sunLight.position.set(7.5, 11, 4.5);
  state.scene.add(state.environment.sunLight);

  const fillLight = new THREE.DirectionalLight(0x9fd1da, 0.35);
  fillLight.position.set(-8, 4, 6);
  state.scene.add(fillLight);

  state.resizeObserver = new ResizeObserver(() => resizeRenderer());
  state.resizeObserver.observe(dom.sceneContainer);
  window.addEventListener("resize", resizeRenderer);
}

function buildClassroom() {
  const room = new THREE.Group();

  const woodTexture = createFloorTexture();
  const wallTexture = createWallTexture();
  const boardTexture = createBoardTexture();

  const floorMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0xe3d2b8,
    roughness: 0.88,
    metalness: 0.02,
  });
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallTexture,
    color: 0xf8f1e4,
    roughness: 0.96,
    metalness: 0.02,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0xc4a587,
    roughness: 0.85,
    metalness: 0.04,
  });
  const boardMaterial = new THREE.MeshStandardMaterial({
    map: boardTexture,
    roughness: 0.9,
    metalness: 0.02,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9ecf5,
    transparent: true,
    opacity: 0.42,
    emissive: new THREE.Color(0x8dd6e9),
    emissiveIntensity: 0.32,
    roughness: 0.04,
    metalness: 0.08,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(18, 5.8), wallMaterial);
  backWall.position.set(0, 2.9, -6);
  room.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 5.8), wallMaterial);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-9, 2.9, 0);
  room.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 5.8), wallMaterial);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.position.set(9, 2.9, 0);
  room.add(rightWall);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 12),
    new THREE.MeshStandardMaterial({
      color: 0xfaf7f0,
      roughness: 0.94,
      metalness: 0.01,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 5.8;
  room.add(ceiling);

  const trimBand = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.16, 0.26), trimMaterial);
  trimBand.position.set(0, 0.92, -5.92);
  room.add(trimBand);

  const boardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 2.7, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0x7d593d,
      roughness: 0.86,
      metalness: 0.05,
    }),
  );
  boardFrame.position.set(0, 2.75, -5.85);
  room.add(boardFrame);
  state.environment.boardFrame = boardFrame.material;

  const board = new THREE.Mesh(new THREE.PlaneGeometry(6.1, 2.2), boardMaterial);
  board.position.set(0, 2.75, -5.78);
  room.add(board);

  const podium = createTeacherDesk();
  podium.position.set(-4.2, 0, -4.75);
  room.add(podium);

  const deskPositions = [
    new THREE.Vector3(-3.4, 0, -1.55),
    new THREE.Vector3(0, 0, -1.55),
    new THREE.Vector3(3.4, 0, -1.55),
    new THREE.Vector3(-3.4, 0, 1.05),
    new THREE.Vector3(0, 0, 1.05),
    new THREE.Vector3(3.4, 0, 1.05),
    new THREE.Vector3(-3.4, 0, 3.65),
    new THREE.Vector3(0, 0, 3.65),
    new THREE.Vector3(3.4, 0, 3.65),
  ];

  deskPositions.forEach((position, index) => {
    const isFrontCenter = index === 1;
    const desk = createStudentDesk({ withBook: isFrontCenter });
    desk.position.copy(position);
    room.add(desk);

    if (isFrontCenter) {
      state.classroom.frontDesk = desk;
      const book = createBook();
      book.group.position.set(0.08, 0.83, 0.04);
      book.group.rotation.y = Math.PI * 0.08;
      desk.add(book.group);
      state.book = book;
    }
  });

  const rearShelf = createShelf();
  rearShelf.position.set(-7.4, 0, 4.8);
  room.add(rearShelf);

  const windows = createWindows(glassMaterial, trimMaterial);
  windows.position.set(8.8, 0, 0);
  room.add(windows);

  const walkwayCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(5.2, 0, 4.9),
      new THREE.Vector3(5.2, 0, -2.8),
      new THREE.Vector3(1.2, 0, -3.4),
      new THREE.Vector3(-4.8, 0, -2.5),
      new THREE.Vector3(-4.8, 0, 4.8),
      new THREE.Vector3(0.8, 0, 5.4),
    ],
    true,
    "catmullrom",
    0.08,
  );
  state.classroom.walkCurve = walkwayCurve;

  const walkPoints = walkwayCurve.getPoints(180);
  const walkLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(walkPoints),
    new THREE.LineDashedMaterial({
      color: 0x7fa8b2,
      dashSize: 0.35,
      gapSize: 0.18,
      transparent: true,
      opacity: 0.38,
    }),
  );
  walkLine.computeLineDistances();
  walkLine.position.y = 0.02;
  room.add(walkLine);

  state.gridHelper = new THREE.GridHelper(18, 18, 0x83a9b3, 0xb6c8ca);
  state.gridHelper.position.y = 0.015;
  state.gridHelper.visible = dom.toggleGrid.checked;
  const gridMaterials = Array.isArray(state.gridHelper.material)
    ? state.gridHelper.material
    : [state.gridHelper.material];
  gridMaterials.forEach((material) => {
    material.transparent = true;
    material.opacity = 0.3;
  });

  state.scene.add(room);
  state.scene.add(state.gridHelper);

  addCeilingLights(room);
}

function createStudentDesk({ withBook }) {
  const desk = new THREE.Group();

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0xc79c6a,
    roughness: 0.8,
    metalness: 0.05,
  });
  const darkWoodMaterial = new THREE.MeshStandardMaterial({
    color: 0x9c6e43,
    roughness: 0.82,
    metalness: 0.06,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x738188,
    roughness: 0.52,
    metalness: 0.36,
  });
  const fabricMaterial = new THREE.MeshStandardMaterial({
    color: 0x49636a,
    roughness: 0.88,
    metalness: 0.02,
  });

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.72), woodMaterial);
  top.position.y = 0.79;
  desk.add(top);

  const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.34, 0.04), darkWoodMaterial);
  frontPanel.position.set(0, 0.55, -0.32);
  desk.add(frontPanel);

  const legPositions = [
    [-0.57, 0.39, -0.27],
    [0.57, 0.39, -0.27],
    [-0.57, 0.39, 0.27],
    [0.57, 0.39, 0.27],
  ];
  legPositions.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.76, 0.05), metalMaterial);
    leg.position.set(x, y, z);
    desk.add(leg);
  });

  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.03, 0.03), metalMaterial);
  crossbar.position.set(0, 0.29, 0.27);
  desk.add(crossbar);

  const chair = new THREE.Group();
  chair.position.set(0, 0, 0.62);

  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.06, 0.48), fabricMaterial);
  chairSeat.position.y = 0.48;
  chair.add(chairSeat);

  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.06), fabricMaterial);
  chairBack.position.set(0, 0.86, 0.19);
  chair.add(chairBack);

  const chairLegs = [
    [-0.22, 0.24, -0.18],
    [0.22, 0.24, -0.18],
    [-0.22, 0.24, 0.18],
    [0.22, 0.24, 0.18],
  ];
  chairLegs.forEach(([x, y, z]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.48, 0.04), metalMaterial);
    leg.position.set(x, y, z);
    chair.add(leg);
  });

  desk.add(chair);

  const notebook = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.025, 0.22),
    new THREE.MeshStandardMaterial({
      color: withBook ? 0xebb36e : 0xffffff,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  notebook.position.set(0.18, 0.835, -0.02);
  notebook.rotation.y = Math.PI * 0.12;
  desk.add(notebook);

  return desk;
}

function createTeacherDesk() {
  const group = new THREE.Group();

  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x81583a,
    roughness: 0.85,
    metalness: 0.04,
  });
  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x64757d,
    roughness: 0.56,
    metalness: 0.28,
  });

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.85), woodMaterial);
  top.position.y = 0.82;
  group.add(top);

  const sidePanelLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.78, 0.82), woodMaterial);
  sidePanelLeft.position.set(-0.82, 0.39, 0);
  group.add(sidePanelLeft);

  const sidePanelRight = sidePanelLeft.clone();
  sidePanelRight.position.x = 0.82;
  group.add(sidePanelRight);

  const modestyPanel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), woodMaterial);
  modestyPanel.position.set(0, 0.46, -0.38);
  group.add(modestyPanel);

  const laptopBase = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.28), metalMaterial);
  laptopBase.position.set(0.22, 0.89, -0.06);
  group.add(laptopBase);

  const laptopScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.26, 0.02),
    new THREE.MeshStandardMaterial({
      color: 0x23343d,
      roughness: 0.5,
      metalness: 0.18,
      emissive: new THREE.Color(0x6bb2cd),
      emissiveIntensity: 0.14,
    }),
  );
  laptopScreen.position.set(0.22, 1.03, -0.18);
  laptopScreen.rotation.x = -1.1;
  group.add(laptopScreen);

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.05, 0.16, 18),
    new THREE.MeshStandardMaterial({
      color: 0xe9f4f5,
      roughness: 0.48,
      metalness: 0.05,
    }),
  );
  cup.position.set(-0.34, 0.91, 0.08);
  group.add(cup);

  return group;
}

function createShelf() {
  const shelf = new THREE.Group();
  const woodMaterial = new THREE.MeshStandardMaterial({
    color: 0x8f6540,
    roughness: 0.85,
    metalness: 0.04,
  });

  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.36), woodMaterial);
  frame.position.set(0, 0.8, 0);
  shelf.add(frame);

  const inner = new THREE.Mesh(
    new THREE.BoxGeometry(1.18, 1.4, 0.28),
    new THREE.MeshStandardMaterial({
      color: 0xf5ead6,
      roughness: 0.96,
      metalness: 0.02,
    }),
  );
  inner.position.set(0, 0.82, 0.02);
  shelf.add(inner);

  [-0.33, 0, 0.33].forEach((x, index) => {
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.46 + index * 0.06, 0.16),
      new THREE.MeshStandardMaterial({
        color: [0x688ca6, 0xd29255, 0x7b8c62][index],
        roughness: 0.8,
        metalness: 0.03,
      }),
    );
    book.position.set(x, 1.02, 0.06);
    shelf.add(book);
  });

  return shelf;
}

function createWindows(glassMaterial, trimMaterial) {
  const windows = new THREE.Group();

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: 0xb58e66,
    roughness: 0.82,
    metalness: 0.05,
  });

  [-3.2, 0, 3.2].forEach((z) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.55, 1.9), frameMaterial);
    frame.position.set(0, 3.0, z);
    windows.add(frame);

    const inner = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.18, 1.52), glassMaterial.clone());
    inner.position.set(-0.06, 3.0, z);
    windows.add(inner);
    state.environment.windowMaterials.push(inner.material);

    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.22, 0.08), trimMaterial);
    vertical.position.set(-0.02, 3.0, z);
    windows.add(vertical);

    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 1.56), trimMaterial);
    horizontal.position.set(-0.02, 3.0, z);
    windows.add(horizontal);

    const beam = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 2.1),
      new THREE.MeshBasicMaterial({
        color: 0xfdf0bf,
        transparent: true,
        opacity: 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beam.rotation.y = Math.PI / 2;
    beam.rotation.z = Math.PI / 5.2;
    beam.position.set(-1.65, 1.8, z);
    windows.add(beam);
    state.environment.beamMaterials.push(beam.material);
  });

  return windows;
}

function addCeilingLights(room) {
  const positions = [-4.8, 0, 4.8];
  positions.forEach((x) => {
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0xf8eee1,
      emissive: new THREE.Color(0xffe2af),
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.04,
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.5), panelMaterial);
    panel.position.set(x, 5.48, -0.1);
    room.add(panel);
    state.environment.glowingPanels.push(panelMaterial);

    const point = new THREE.PointLight(0xffe8bc, 0.48, 12, 2);
    point.position.set(x, 5.1, -0.1);
    room.add(point);
    state.environment.pointLights.push(point);
  });
}

function createBook() {
  const group = new THREE.Group();
  const paperTexture = createPaperTexture();

  const paperMaterial = new THREE.MeshStandardMaterial({
    color: 0xf6f0de,
    map: paperTexture,
    roughness: 0.94,
    metalness: 0.01,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
  });
  const coverMaterial = new THREE.MeshStandardMaterial({
    color: 0x35597c,
    roughness: 0.72,
    metalness: 0.04,
  });
  const spineMaterial = new THREE.MeshStandardMaterial({
    color: 0x203750,
    roughness: 0.74,
    metalness: 0.05,
  });

  const paperBlock = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.28), paperMaterial);
  paperBlock.position.y = 0.02;
  group.add(paperBlock);

  const leftCover = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.3), coverMaterial);
  leftCover.position.set(-0.1, 0.013, 0);
  leftCover.rotation.z = 0.04;
  group.add(leftCover);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.05, 0.3), spineMaterial);
  spine.position.y = 0.02;
  group.add(spine);

  const pages = [];
  for (let index = 0; index < 7; index += 1) {
    const pivot = new THREE.Group();
    pivot.position.set(0.01, 0.05 + index * 0.0025, 0);

    const page = new THREE.Mesh(
      new THREE.PlaneGeometry(0.19, 0.28, 1, 1),
      paperMaterial.clone(),
    );
    page.rotation.x = -Math.PI / 2;
    page.position.set(0.095, 0, 0);
    pivot.add(page);
    group.add(pivot);
    pages.push(pivot);
  }

  const rightCoverPivot = new THREE.Group();
  rightCoverPivot.position.set(0.01, 0.015, 0);
  const rightCover = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.3), coverMaterial);
  rightCover.position.set(0.1, 0, 0);
  rightCoverPivot.add(rightCover);
  group.add(rightCoverPivot);

  return {
    group,
    pages,
    rightCover: rightCoverPivot,
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
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.82), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  return shadow;
}

function loadModel() {
  setStatus("loading", "正在加载人物模型");
  dom.loadingText.textContent = "开始读取丁.glb...";
  updateProgress(0.06);

  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      prepareModel(gltf);
      setStatus("ready", "场景已准备就绪");
      dom.loadingText.textContent = "模型加载完成";
      updateProgress(1);
      window.setTimeout(() => {
        dom.loadingOverlay.classList.add("hidden");
      }, 320);
    },
    (event) => {
      const total = event.total || MODEL_BYTES;
      const progress = total > 0 ? event.loaded / total : 0;
      updateProgress(Math.min(progress, 0.98));
      dom.loadingText.textContent = `模型加载中 ${Math.round(progress * 100)}%`;
    },
    (error) => {
      console.error(error);
      setStatus("error", "模型加载失败");
      dom.loadingText.textContent = "模型读取失败，请检查资源路径";
      updateProgress(1);
    },
  );
}

function prepareModel(gltf) {
  const asset = gltf.scene;
  state.model.assetRoot.clear();
  state.model.assetRoot.add(asset);

  const anisotropy = state.renderer.capabilities.getMaxAnisotropy();
  const materials = new Set();
  let meshes = 0;
  let triangles = 0;

  asset.traverse((child) => {
    if (!child.isMesh) {
      return;
    }

    meshes += 1;
    triangles += child.geometry.index
      ? child.geometry.index.count / 3
      : child.geometry.attributes.position.count / 3;

    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.forEach((material) => {
      materials.add(material);

      if (material.map) {
        material.map.anisotropy = Math.min(8, anisotropy);
      }

      if (material.normalMap) {
        material.normalMap.anisotropy = Math.min(8, anisotropy);
      }

      if ("roughness" in material) {
        material.roughness = Math.max(0.44, material.roughness ?? 0.8);
      }

      if ("metalness" in material) {
        material.metalness = Math.min(material.metalness ?? 0.15, 0.32);
      }

      material.envMapIntensity = 0.78;
    });
  });

  state.model.stats.meshes = meshes;
  state.model.stats.materials = materials.size;
  state.model.stats.triangles = triangles;

  const initialBox = new THREE.Box3().setFromObject(asset);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = 1.72 / Math.max(initialSize.y, 0.001);
  asset.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(asset);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  asset.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

  const lookDirection = state.classroom.frontDeskPosition
    .clone()
    .sub(state.classroom.studyPosition)
    .normalize();
  state.model.anchor.position.copy(state.classroom.studyPosition);
  state.model.anchor.rotation.y = headingFromDirection(lookDirection);
  state.model.ready = true;

  dom.statTriangles.textContent = formatNumber(triangles);
  dom.statMeshes.textContent = formatNumber(meshes);
  dom.statMaterials.textContent = formatNumber(materials.size);
}

function bindUi() {
  dom.activityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActivity(button.dataset.activity, { withCamera: true });
    });
  });

  dom.cameraButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setCameraPreset(button.dataset.camera);
    });
  });

  dom.toggleAuto.addEventListener("change", (event) => {
    state.autoCycle = event.target.checked;
    state.autoElapsed = 0;
  });

  dom.toggleFollow.addEventListener("change", (event) => {
    if (event.target.checked && state.activity === "walk") {
      state.currentCameraLabel = "走动跟拍";
    }
  });

  dom.toggleGrid.addEventListener("change", (event) => {
    state.gridHelper.visible = event.target.checked;
  });

  dom.toggleNight.addEventListener("change", () => {
    applyEnvironment();
  });

  dom.resetCamera.addEventListener("click", () => {
    setCameraPreset("overview");
  });

  dom.studyHome.addEventListener("click", () => {
    setActivity("study", { withCamera: true });
  });
}

function setActivity(activity, options = {}) {
  state.activity = activity;
  state.autoElapsed = 0;

  const meta = ACTIVITY_META[activity];
  dom.activityDescription.textContent = meta.description;
  dom.sceneNote.textContent = meta.note;
  dom.modeReadout.textContent = meta.label;

  dom.activityButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.activity === activity);
  });

  if (options.withCamera) {
    if (activity === "study") {
      setCameraPreset("desk");
    } else if (activity === "book") {
      setCameraPreset("desk");
    } else {
      setCameraPreset("aisle");
    }
  }
}

function setCameraPreset(name, immediate = false) {
  const preset = CAMERA_PRESETS[name];
  if (!preset) {
    return;
  }

  dom.cameraButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.camera === name);
  });

  state.currentCameraLabel = preset.label;

  if (immediate) {
    state.camera.position.copy(preset.position);
    state.controls.target.copy(preset.target);
    return;
  }

  state.cameraTransition = {
    fromPosition: state.camera.position.clone(),
    fromTarget: state.controls.target.clone(),
    toPosition: preset.position.clone(),
    toTarget: preset.target.clone(),
    elapsed: 0,
    duration: 1.1,
  };
}

function applyEnvironment() {
  const isNight = dom.toggleNight.checked;

  if (isNight) {
    state.scene.background.set(0x10202b);
    state.scene.fog.color.set(0x162a34);
    state.renderer.toneMappingExposure = 0.82;
    state.environment.hemiLight.intensity = 0.36;
    state.environment.sunLight.intensity = 0.62;

    state.environment.pointLights.forEach((light) => {
      light.intensity = 1.9;
    });
    state.environment.glowingPanels.forEach((material) => {
      material.emissiveIntensity = 1.25;
    });
    state.environment.windowMaterials.forEach((material) => {
      material.opacity = 0.22;
      material.emissiveIntensity = 0.12;
    });
    state.environment.beamMaterials.forEach((material) => {
      material.opacity = 0.04;
    });
  } else {
    state.scene.background.set(0xdceef2);
    state.scene.fog.color.set(0xdceef2);
    state.renderer.toneMappingExposure = 1;
    state.environment.hemiLight.intensity = 1.15;
    state.environment.sunLight.intensity = 1.5;

    state.environment.pointLights.forEach((light) => {
      light.intensity = 0.48;
    });
    state.environment.glowingPanels.forEach((material) => {
      material.emissiveIntensity = 0.45;
    });
    state.environment.windowMaterials.forEach((material) => {
      material.opacity = 0.42;
      material.emissiveIntensity = 0.32;
    });
    state.environment.beamMaterials.forEach((material) => {
      material.opacity = 0.12;
    });
  }
}

function animate(timestamp) {
  requestAnimationFrame(animate);
  state.clock.update(timestamp);

  const delta = state.clock.getDelta();
  const elapsed = state.clock.getElapsed();

  if (state.autoCycle) {
    updateAutoCycle(delta);
  }

  updateBookAnimation(elapsed);
  updateCharacter(delta, elapsed);
  updateCamera(delta);
  updateLiveReadouts();

  state.controls.update();
  state.renderer.render(state.scene, state.camera);
}

function updateAutoCycle(delta) {
  state.autoElapsed += delta;
  if (state.autoElapsed < 8.5) {
    return;
  }

  state.autoElapsed = 0;
  const order = ["study", "book", "walk"];
  const currentIndex = order.indexOf(state.activity);
  const nextActivity = order[(currentIndex + 1) % order.length];
  setActivity(nextActivity, { withCamera: true });
}

function updateBookAnimation(elapsed) {
  if (!state.book.pages.length) {
    return;
  }

  const speed = state.activity === "book" ? 2.1 : state.activity === "study" ? 0.88 : 0.18;
  const intensity = state.activity === "book" ? 1 : state.activity === "study" ? 0.42 : 0.06;
  const cycle = elapsed * speed;

  state.book.pages.forEach((pivot, index) => {
    const pulse = 0.5 + 0.5 * Math.sin(cycle * Math.PI * 2 - index * 0.52);
    const turn = Math.pow(pulse, 1.65);
    pivot.rotation.z = -0.08 - turn * Math.PI * intensity;
  });

  state.book.rightCover.rotation.z =
    -0.05 - Math.sin(cycle * Math.PI * 2) * 0.1 * intensity;
}

function updateCharacter(delta, elapsed) {
  if (!state.model.ready) {
    return;
  }

  if (state.activity === "walk") {
    updateWalking(delta, elapsed);
    return;
  }

  const desiredPosition = state.classroom.studyPosition;
  state.model.anchor.position.lerp(desiredPosition, 1 - Math.exp(-delta * 3.8));

  const bookWorldPosition = state.book.group
    ? state.book.group.getWorldPosition(tempVectorA)
    : state.classroom.frontDeskPosition;
  const desiredDirection = bookWorldPosition.clone().sub(state.model.anchor.position).setY(0).normalize();
  const targetHeading = headingFromDirection(desiredDirection);
  state.model.anchor.rotation.y = dampAngle(state.model.anchor.rotation.y, targetHeading, 6.5, delta);

  const poseStrength = state.activity === "book" ? 1 : 0.46;
  state.model.motionPivot.position.y =
    0.04 + Math.sin(elapsed * (state.activity === "book" ? 3.2 : 1.65)) * 0.022 * poseStrength;
  state.model.motionPivot.rotation.x =
    -0.03 - Math.sin(elapsed * (state.activity === "book" ? 3.4 : 2.1)) * 0.05 * poseStrength;
  state.model.motionPivot.rotation.z =
    Math.sin(elapsed * 1.8) * 0.025 * poseStrength;
}

function updateWalking(delta, elapsed) {
  state.classroom.walkProgress = (state.classroom.walkProgress + delta * 0.055) % 1;

  const position = state.classroom.walkCurve.getPointAt(state.classroom.walkProgress);
  const tangent = state.classroom.walkCurve.getTangentAt(state.classroom.walkProgress).normalize();
  state.model.anchor.position.copy(position);
  state.model.anchor.rotation.y = dampAngle(
    state.model.anchor.rotation.y,
    headingFromDirection(tangent),
    9.5,
    delta,
  );

  state.model.motionPivot.position.y = 0.08 + Math.abs(Math.sin(elapsed * 6.1)) * 0.08;
  state.model.motionPivot.rotation.x = Math.sin(elapsed * 6.1) * 0.045;
  state.model.motionPivot.rotation.z = Math.sin(elapsed * 3.05) * 0.05;
}

function updateCamera(delta) {
  if (state.activity === "walk" && dom.toggleFollow.checked && state.model.ready) {
    const followOffset = tempVectorB.set(3.5, 2.4, 4.4).applyAxisAngle(
      WORLD_UP,
      state.model.anchor.rotation.y,
    );
    const desiredPosition = state.model.anchor.position.clone().add(followOffset);
    const desiredTarget = state.model.anchor.position.clone().add(new THREE.Vector3(0, 1.1, 0));

    state.camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 2.8));
    state.controls.target.lerp(desiredTarget, 1 - Math.exp(-delta * 3.2));
    state.currentCameraLabel = "走动跟拍";
    return;
  }

  if (!state.cameraTransition) {
    return;
  }

  state.cameraTransition.elapsed += delta;
  const progress = Math.min(state.cameraTransition.elapsed / state.cameraTransition.duration, 1);
  const eased = progress * progress * (3 - 2 * progress);

  state.camera.position.lerpVectors(
    state.cameraTransition.fromPosition,
    state.cameraTransition.toPosition,
    eased,
  );
  state.controls.target.lerpVectors(
    state.cameraTransition.fromTarget,
    state.cameraTransition.toTarget,
    eased,
  );

  if (progress >= 1) {
    state.cameraTransition = null;
  }
}

function updateLiveReadouts() {
  dom.cameraReadout.textContent = state.currentCameraLabel;
  dom.positionReadout.textContent = formatPosition(state.model.anchor.position);
}

function resizeRenderer() {
  const width = dom.sceneContainer.clientWidth;
  const height = dom.sceneContainer.clientHeight;

  if (!width || !height) {
    return;
  }

  state.camera.aspect = width / height;
  state.camera.updateProjectionMatrix();
  state.renderer.setSize(width, height);
}

function updateProgress(value) {
  dom.progressBar.style.transform = `scaleX(${THREE.MathUtils.clamp(value, 0, 1)})`;
}

function setStatus(stateName, text) {
  dom.statusBadge.dataset.state = stateName;
  dom.statusText.textContent = text;
}

function headingFromDirection(direction) {
  return Math.atan2(direction.x, direction.z) + state.model.forwardOffset;
}

function dampAngle(current, target, smoothing, delta) {
  const difference = THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
  return current + difference * (1 - Math.exp(-smoothing * delta));
}

function formatPosition(vector) {
  return `(${vector.x.toFixed(2)}, ${vector.z.toFixed(2)})`;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(1)} ${units[index]}`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function createFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");

  context.fillStyle = "#cfb189";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < 18; row += 1) {
    const y = row * 56;
    context.fillStyle = row % 2 === 0 ? "#dcb98c" : "#cda67c";
    context.fillRect(0, y, canvas.width, 48);
  }

  context.strokeStyle = "rgba(78, 52, 34, 0.14)";
  context.lineWidth = 2;
  for (let x = 0; x <= canvas.width; x += 128) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3.6, 2.4);
  return texture;
}

function createWallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#faf3e8");
  gradient.addColorStop(1, "#efe5d3");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(102, 122, 124, 0.08)";
  context.lineWidth = 4;
  for (let y = 48; y < canvas.height; y += 64) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBoardTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#35594f");
  gradient.addColorStop(1, "#203b34");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "rgba(255, 255, 255, 0.85)";
  context.font = "700 52px Noto Sans SC";
  context.fillText("Morning Study Session", 74, 96);
  context.font = "500 34px Noto Sans SC";
  context.fillText("1. 复习知识点", 84, 190);
  context.fillText("2. 翻阅笔记与教材", 84, 252);
  context.fillText("3. 教室场景走动展示", 84, 314);

  context.strokeStyle = "rgba(255, 255, 255, 0.16)";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(72, 128);
  context.lineTo(952, 128);
  context.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPaperTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");

  context.fillStyle = "#f7f0df";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(76, 109, 128, 0.18)";
  context.lineWidth = 3;
  for (let y = 78; y < canvas.height; y += 62) {
    context.beginPath();
    context.moveTo(44, y);
    context.lineTo(canvas.width - 44, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(211, 116, 92, 0.24)";
  context.beginPath();
  context.moveTo(94, 42);
  context.lineTo(94, canvas.height - 42);
  context.stroke();

  context.fillStyle = "rgba(47, 74, 83, 0.38)";
  context.font = "600 28px Noto Sans SC";
  context.fillText("课堂笔记", 122, 62);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  const gradient = context.createRadialGradient(128, 128, 12, 128, 128, 120);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.42)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return new THREE.CanvasTexture(canvas);
}
