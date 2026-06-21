import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const ThreeCanvas = ({ subjects = [], daysRemaining = 10, onSubjectClick, activeSubjectId }) => {
  const mountRef = useRef(null);
  const [hoveredSubject, setHoveredSubject] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current) return;

    // --- Scene Setup ---
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    
    const scene = new THREE.Scene();
    scene.background = null; // Transparent so the index.css background glow shows through

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 12, 18);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // --- Lights ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    // Point Light from the Sun
    const sunLight = new THREE.PointLight(0x00f2fe, 3, 50, 0.5);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // Directional helper light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // --- Starfield Background ---
    const starCount = 300;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      // Random positions inside a large sphere
      const r = 35 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      starPositions[i] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i + 2] = r * Math.cos(phi);
    }
    
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.15,
      transparent: true,
      opacity: 0.8
    });
    const starField = new THREE.Points(starGeometry, starMaterial);
    scene.add(starField);

    // --- The Central Sun (Exam Core) ---
    // Pulse animation factor based on days remaining
    const sunPulseSpeed = daysRemaining < 3 ? 0.05 : 0.02;
    const sunColor = daysRemaining < 3 ? 0xef4444 : 0x00f2fe;

    const sunGeo = new THREE.SphereGeometry(1.6, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({
      color: sunColor,
      transparent: true,
      opacity: 0.95
    });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunMesh);

    // Corona glow mesh
    const coronaGeo = new THREE.SphereGeometry(1.9, 32, 32);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: sunColor,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    scene.add(coronaMesh);

    // --- Planets (Subjects) ---
    const planetGroup = new THREE.Group();
    scene.add(planetGroup);

    // Visual mappings for subjects
    const meshesMap = [];
    const orbitLines = [];

    // Helper to interpolate between prep colors
    // 0% -> Red, 50% -> Orange/Yellow, 100% -> Green
    const getPrepColor = (rate) => {
      if (rate < 0.5) {
        // Red to Gold
        const r = 239 + Math.round((245 - 239) * (rate / 0.5));
        const g = 68 + Math.round((158 - 68) * (rate / 0.5));
        const b = 68 + Math.round((11 - 68) * (rate / 0.5));
        return (r << 16) + (g << 8) + b;
      } else {
        // Gold to Green
        const factor = (rate - 0.5) / 0.5;
        const r = 245 - Math.round((245 - 16) * factor);
        const g = 158 + Math.round((185 - 158) * factor);
        const b = 11 + Math.round((129 - 11) * factor);
        return (r << 16) + (g << 8) + b;
      }
    };

    subjects.forEach((subject, index) => {
      // Size proportional to difficulty/total chapters
      let size = 0.65;
      if (subject.difficulty === 'medium') size = 0.9;
      if (subject.difficulty === 'hard') size = 1.15;

      const total = subject.topics.length || 1;
      const comp = subject.completedTopics.length;
      const rate = comp / total;
      const pColor = getPrepColor(rate);

      // Planet geometry and material
      const planetGeo = new THREE.SphereGeometry(size, 32, 32);
      const planetMat = new THREE.MeshStandardMaterial({
        color: pColor,
        roughness: 0.3,
        metalness: 0.8,
        emissive: pColor,
        emissiveIntensity: 0.15 + (rate * 0.15), // glows brighter as progress completes
      });
      const planetMesh = new THREE.Mesh(planetGeo, planetMat);

      // Calculate unique orbit distance
      const distance = 4.5 + index * 2.8;

      // Initial angle spaced out
      const startAngle = (index / subjects.length) * Math.PI * 2 + Math.random() * 0.5;
      planetMesh.position.set(
        Math.cos(startAngle) * distance,
        0,
        Math.sin(startAngle) * distance
      );

      // Save metadata directly to the object for raycasting
      planetMesh.userData = {
        id: subject.id,
        name: subject.name,
        completionRate: rate * 100,
        distance: distance,
        angle: startAngle,
        speed: (0.015 / (index + 1)) * (subject.difficulty === 'hard' ? 1.5 : 1.0),
        size: size
      };

      // Add a Saturn-like futuristic glowing ring for some flavor
      if (index % 2 === 0) {
        const ringGeo = new THREE.RingGeometry(size * 1.3, size * 1.7, 30);
        const ringMat = new THREE.MeshBasicMaterial({
          color: pColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2.5;
        planetMesh.add(ringMesh);
      }

      planetGroup.add(planetMesh);
      meshesMap.push(planetMesh);

      // Draw Orbit Wire
      const orbitPoints = [];
      const steps = 64;
      for (let s = 0; s <= steps; s++) {
        const theta = (s / steps) * Math.PI * 2;
        orbitPoints.push(new THREE.Vector3(Math.cos(theta) * distance, 0, Math.sin(theta) * distance));
      }
      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMat = new THREE.LineBasicMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.15
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      scene.add(orbitLine);
      orbitLines.push(orbitLine);
    });

    // --- Interactive Mouse Events & Controls ---
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    const rotationPivot = new THREE.Group();
    scene.add(rotationPivot);
    // Reparent meshes and orbits to pivot for unified mouse rotation
    rotationPivot.add(planetGroup);
    orbitLines.forEach(line => rotationPivot.add(line));
    rotationPivot.add(sunMesh);
    rotationPivot.add(coronaMesh);

    // Mouse movement coordinates for raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      // 1. Scene Dragging
      if (isDragging) {
        const deltaMove = {
          x: e.clientX - previousMousePosition.x,
          y: e.clientY - previousMousePosition.y
        };

        rotationPivot.rotation.y += deltaMove.x * 0.005;
        rotationPivot.rotation.x += deltaMove.y * 0.005;
        // Limit X axis rotation to avoid flipping upside down
        rotationPivot.rotation.x = Math.max(-Math.PI / 4, Math.min(Math.PI / 4, rotationPivot.rotation.x));

        previousMousePosition = { x: e.clientX, y: e.clientY };
      }

      // 2. Raycasting / Hover Checks
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(planetGroup.children);

      if (intersects.length > 0) {
        const hoveredObj = intersects[0].object;
        setHoveredSubject({
          name: hoveredObj.userData.name,
          completion: hoveredObj.userData.completionRate
        });
        setTooltipPos({ x: e.clientX - rect.left + 15, y: e.clientY - rect.top + 15 });
        mountRef.current.style.cursor = 'pointer';
      } else {
        setHoveredSubject(null);
        mountRef.current.style.cursor = isDragging ? 'grabbing' : 'grab';
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
      if (mountRef.current) mountRef.current.style.cursor = 'grab';
    };

    const handleMouseClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(planetGroup.children);

      if (intersects.length > 0) {
        const clickedObj = intersects[0].object;
        if (onSubjectClick) {
          onSubjectClick(clickedObj.userData.id);
        }
      }
    };

    const domEl = mountRef.current;
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domEl.addEventListener('click', handleMouseClick);

    // Zooming using mouse scroll
    const handleWheel = (e) => {
      e.preventDefault();
      camera.position.z += e.deltaY * 0.015;
      camera.position.z = Math.max(10, Math.min(30, camera.position.z));
      camera.position.y = camera.position.z * 0.7; // Maintain perspective angle
    };
    domEl.addEventListener('wheel', handleWheel, { passive: false });

    // --- Animation Loop ---
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();
      
      // Rotate stars slowly
      starField.rotation.y = elapsedTime * 0.015;

      // Pulse the central Sun
      const sunScale = 1.0 + Math.sin(elapsedTime * (sunPulseSpeed * 100)) * 0.05;
      sunMesh.scale.set(sunScale, sunScale, sunScale);
      coronaMesh.scale.set(sunScale, sunScale, sunScale);
      coronaMesh.material.opacity = 0.1 + Math.sin(elapsedTime * (sunPulseSpeed * 100)) * 0.06;

      // Orbit and rotate planets
      meshesMap.forEach(planet => {
        // Orbit around Sun
        planet.userData.angle += planet.userData.speed;
        planet.position.x = Math.cos(planet.userData.angle) * planet.userData.distance;
        planet.position.z = Math.sin(planet.userData.angle) * planet.userData.distance;

        // Rotate on own axis
        planet.rotation.y += 0.02;

        // Visual feedback when active/selected
        if (activeSubjectId === planet.userData.id) {
          // Add a pulsing bounce
          planet.position.y = Math.sin(elapsedTime * 5) * 0.15 + 0.3;
          planet.material.emissiveIntensity = 0.45;
        } else {
          planet.position.y = 0;
          planet.material.emissiveIntensity = 0.15 + (planet.userData.completionRate / 100) * 0.15;
        }
      });

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationFrameId);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domEl.removeEventListener('click', handleMouseClick);
      domEl.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      
      if (domEl.contains(renderer.domElement)) {
        domEl.removeChild(renderer.domElement);
      }
      
      // Dispose materials & geometries
      starGeometry.dispose();
      starMaterial.dispose();
      sunGeo.dispose();
      sunMat.dispose();
      coronaGeo.dispose();
      coronaMat.dispose();
      
      meshesMap.forEach(mesh => {
        mesh.geometry.dispose();
        mesh.material.dispose();
        mesh.children.forEach(c => {
          c.geometry.dispose();
          c.material.dispose();
        });
      });

      orbitLines.forEach(line => {
        line.geometry.dispose();
        line.material.dispose();
      });
    };
  }, [subjects, daysRemaining, activeSubjectId, onSubjectClick]);

  return (
    <div ref={mountRef} style={{ width: '100%', height: '100%', position: 'relative', cursor: 'grab' }}>
      {/* 3D Tooltip Overlay */}
      {hoveredSubject && (
        <div 
          style={{
            position: 'absolute',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            backgroundColor: 'rgba(10, 10, 20, 0.9)',
            border: '1px solid var(--secondary)',
            boxShadow: 'var(--shadow-neon-cyan)',
            padding: '8px 12px',
            borderRadius: '8px',
            pointerEvents: 'none',
            zIndex: 10,
            transition: 'opacity 0.15s ease'
          }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '13px', color: '#fff' }}>
            {hoveredSubject.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Preparation: <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{hoveredSubject.completion.toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Control Instruction Overlay */}
      <div 
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '11px',
          color: 'var(--text-secondary)',
          pointerEvents: 'none',
          display: 'flex',
          gap: '12px'
        }}
      >
        <span>🖱️ Drag to Rotate Space</span>
        <span>|</span>
        <span>📜 Scroll to Zoom</span>
        <span>|</span>
        <span>🎯 Click Planet to Inspect</span>
      </div>
    </div>
  );
};

export default ThreeCanvas;
