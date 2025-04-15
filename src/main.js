import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/Addons.js";
import gsap from "gsap";

// DOM elements
const canvas = document.querySelector("#canvas");
const heading = document.querySelector(".heading");

// Constants
const FOV = 25;
const PI = Math.PI;
const SEGMENTS = 64;
const CAMERA_POS = 9;
const PLANET_RADIUS = 1.3;
const ORBIT_RADIUS = 4.5;
const THROTTLE_DELAY = 800;

// Planet data
const PLANETS = [
  { name: "Venus", texture: "/earth/map.jpg" },
  { name: "Volcanic", texture: "/venus/map.jpg" },
  { name: "Csilla", texture: "/volcanic/color.png" },
  { name: "Earth", texture: "/csilla/color.png" },
];

// Setup
let width = window.innerWidth;
let height = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 100);
camera.position.z = CAMERA_POS;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(width, height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// State variables
let currIndex = 0;
let lastWheelTime = 0;
let isAnimating = false;
const spheres = new THREE.Group();
const planetMeshes = [];
const glowMaterials = [];

// Add lights
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(5, 3, 5);
dirLight.castShadow = true;
scene.add(dirLight);

// Texture loading utility
const loadTexture = (url) => {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    const texture = loader.load(url, () => {
      texture.colorSpace = THREE.SRGBColorSpace;
      resolve(texture);
    });
  });
};

// Initialize scene
async function initScene() {
  // Load environment
  const envLoader = new RGBELoader();
  const envTexture = await new Promise((resolve) => {
    envLoader.load(
      "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/symmetrical_garden_02_1k.hdr",
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = texture;
        resolve(texture);
      }
    );
  });
  
  scene.environment = envTexture;
  scene.background = envTexture;
  
  // Load planet textures in parallel
  const texturePromises = PLANETS.map(planet => loadTexture(planet.texture));
  const textures = await Promise.all(texturePromises);
  
  // Create planets
  textures.forEach((texture, i) => {
    const planetMat = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.1,
      envMapIntensity: 0.7,
    });
    
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_RADIUS, SEGMENTS, SEGMENTS),
      planetMat
    );
    
    // Position in orbit
    const angle = (2 * PI * i) / PLANETS.length;
    planet.position.set(
      ORBIT_RADIUS * Math.cos(angle),
      0,
      ORBIT_RADIUS * Math.sin(angle)
    );
    
    // Initial scale for animation
    planet.scale.set(0.01, 0.01, 0.01);
    
    // Self-rotation animation
    gsap.to(planet.rotation, {
      y: PI * 2,
      duration: 25 + i * 5,
      ease: "none",
      repeat: -1
    });
    
    // Store reference
    planetMeshes.push(planet);
    spheres.add(planet);
    
    // Create glow material
    const glowMat = planetMat.clone();
    glowMat.emissive = new THREE.Color(0x555555);
    glowMat.emissiveIntensity = 0.2;
    glowMaterials.push(glowMat);
  });
  
  // Add starfield background
  const bgTexture = await loadTexture("/stars.jpg");
  const background = new THREE.Mesh(
    new THREE.SphereGeometry(50, SEGMENTS, SEGMENTS),
    new THREE.MeshBasicMaterial({
      map: bgTexture,
      side: THREE.BackSide
    })
  );
  
  // Background rotation
  gsap.to(background.rotation, {
    y: PI * 2,
    ease: "none",
    duration: 500,
    repeat: -1
  });
  
  // Position and add to scene
  spheres.rotation.x = 0.1;
  spheres.position.y = -0.8;
  spheres.add(background);
  scene.add(spheres);
  
  // Initialize UI text
  heading.textContent = PLANETS[currIndex].name;
  
  // Start animations
  startIntroAnimation();
  
  // Add event listeners
  window.addEventListener("resize", handleResize);
  window.addEventListener("wheel", handleWheelMove);
  window.addEventListener("keydown", handleKeyPress);
}

// Intro animation
function startIntroAnimation() {
  // Scale up planets
  planetMeshes.forEach((planet, i) => {
    gsap.to(planet.scale, {
      x: 1, y: 1, z: 1,
      duration: 1.2,
      delay: 0.15 * i,
      ease: "elastic.out(1, 0.5)"
    });
  });
  
  // Camera animation
  gsap.from(camera.position, {
    z: CAMERA_POS + 5,
    duration: 2,
    ease: "power3.out",
    onComplete: () => {
      startCameraMovement();
      highlightPlanet(0);
    }
  });
  
  // Heading animation
  gsap.from(heading, {
    opacity: 0,
    y: -30,
    duration: 0.8,
    delay: 0.5,
    ease: "power2.out"
  });
}

// Subtle camera movement
function startCameraMovement() {
  const moveCamera = () => {
    gsap.to(camera.position, {
      x: Math.sin(Date.now() * 0.0001) * 0.3,
      y: Math.cos(Date.now() * 0.00015) * 0.3,
      duration: 2,
      ease: "power1.inOut",
      onComplete: moveCamera
    });
  };
  
  moveCamera();
}

// Add glow effect to active planet
function highlightPlanet(index) {
  planetMeshes.forEach((planet, i) => {
    if (i === index) {
      // Apply glow to active planet
      planet.material = glowMaterials[i];
      gsap.to(glowMaterials[i], {
        emissiveIntensity: 0.3,
        duration: 1.2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut"
      });
    } else {
      // Reset inactive planets
      gsap.killTweensOf(glowMaterials[i]);
      glowMaterials[i].emissiveIntensity = 0;
      planet.material = planetMeshes[i].material;
    }
  });
}

// Handle planet rotation
function rotateToPlanet(index) {
  if (isAnimating) return;
  isAnimating = true;
  
  // Calculate shortest rotation path
  const normalizedAngle = spheres.rotation.y % (PI * 2);
  const targetAngle = (PI / 2) * index;
  
  let rotationDelta = targetAngle - normalizedAngle;
  if (Math.abs(rotationDelta) > PI) {
    rotationDelta = rotationDelta > 0 ? rotationDelta - PI * 2 : rotationDelta + PI * 2;
  }
  
  // Camera zoom effect
  gsap.to(camera, {
    fov: FOV + 2,
    duration: 0.3,
    ease: "power1.in",
    onUpdate: () => camera.updateProjectionMatrix(),
    onComplete: () => {
      gsap.to(camera, {
        fov: FOV,
        duration: 0.5,
        ease: "power2.out",
        onUpdate: () => camera.updateProjectionMatrix()
      });
    }
  });
  
  // Rotate planets
  gsap.to(spheres.rotation, {
    y: spheres.rotation.y + rotationDelta,
    duration: 1,
    ease: "power2.inOut",
    onComplete: () => {
      isAnimating = false;
      highlightPlanet(index);
    }
  });
}

// Wheel event handler
function handleWheelMove(event) {
  const now = Date.now();
  if (now - lastWheelTime >= THROTTLE_DELAY && !isAnimating) {
    lastWheelTime = now;
    const direction = event.deltaY > 0 ? 1 : -1;
    
    // Update index
    const nextIndex = (currIndex + direction + PLANETS.length) % PLANETS.length;
    
    // Update heading
    gsap.to(heading, {
      opacity: 0,
      y: direction > 0 ? 30 : -30,
      duration: 0.3,
      ease: "power2.out",
      onComplete: () => {
        heading.textContent = PLANETS[nextIndex].name;
        gsap.to(heading, {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out"
        });
      }
    });
    
    currIndex = nextIndex;
    rotateToPlanet(currIndex);
  }
}

// Keyboard navigation
function handleKeyPress(event) {
  if (isAnimating) return;
  
  let direction = 0;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    direction = 1;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    direction = -1;
  }
  
  if (direction !== 0) {
    const nextIndex = (currIndex + direction + PLANETS.length) % PLANETS.length;
    
    // Update heading
    gsap.to(heading, {
      opacity: 0,
      y: direction > 0 ? 30 : -30,
      duration: 0.3,
      ease: "power2.out",
      onComplete: () => {
        heading.textContent = PLANETS[nextIndex].name;
        gsap.to(heading, {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out"
        });
      }
    });
    
    currIndex = nextIndex;
    rotateToPlanet(currIndex);
  }
}

// Handle window resize
function handleResize() {
  width = window.innerWidth;
  height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// Start everything
initScene();
animate();