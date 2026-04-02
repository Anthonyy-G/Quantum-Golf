import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { LevelData, BallState, Player, ShadingMode } from '../game/types';
import { stepBall, isNearHole, isBallStopped, isBallFallen } from '../game/physics';
import {
  gouraudVertexShader, gouraudFragmentShader,
  phongVertexShader, phongFragmentShader,
  emissiveVertexShader, emissiveFragmentShader,
  ballVertexShader, ballFragmentShader,
} from '../game/shaders';

interface PlatformProps {
  position: [number, number, number];
  size: [number, number, number];
  shadingMode: ShadingMode;
  time: number;
}

function Platform({ position, size, shadingMode, time }: PlatformProps) {
  const uniforms = useRef({
    time: { value: time },
    baseColor: { value: new THREE.Color(0.08, 0.06, 0.18) },
    glowColor: { value: new THREE.Color(0.0, 0.9, 1.0) },
    intensity: { value: 0.6 },
  });

  return (
    <mesh position={position} receiveShadow>
      <boxGeometry args={[size[0], size[1], size[2]]} />
      <shaderMaterial
        vertexShader={emissiveVertexShader}
        fragmentShader={emissiveFragmentShader}
        uniforms={uniforms.current}
      />
    </mesh>
  );
}

interface WallProps {
  position: [number, number, number];
  size: [number, number, number];
}

function Wall({ position, size }: WallProps) {
  return (
    <mesh position={position}>
      <boxGeometry args={[size[0], size[1], size[2]]} />
      <meshStandardMaterial
        color={0x0a0525}
        emissive={new THREE.Color(0.0, 0.2, 0.4)}
        emissiveIntensity={0.5}
        transparent
        opacity={0.7}
      />
    </mesh>
  );
}

interface ObstacleMeshProps {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  pulseSpeed: number;
  pulseAmp: number;
  type: 'box' | 'cylinder';
  shadingMode: ShadingMode;
  time: number;
}

function ObstacleMesh({ position, size, color, pulseSpeed, pulseAmp, type, shadingMode, time }: ObstacleMeshProps) {
  const uniforms = useRef({
    time: { value: time },
    baseColor: { value: new THREE.Color(color) },
    emissiveStrength: { value: 0.3 },
    pulseAmp: { value: pulseAmp },
    pulseSpeed: { value: pulseSpeed },
    isObstacle: { value: true },
  });

  uniforms.current.time.value = time;

  const vs = shadingMode === 'phong' ? phongVertexShader : gouraudVertexShader;
  const fs = shadingMode === 'phong' ? phongFragmentShader : gouraudFragmentShader;

  return (
    <mesh position={position}>
      {type === 'box' ? (
        <boxGeometry args={[size[0], size[1], size[2], 4, 4, 4]} />
      ) : (
        <cylinderGeometry args={[size[0], size[0], size[1], 24, 4]} />
      )}
      <shaderMaterial
        vertexShader={vs}
        fragmentShader={fs}
        uniforms={uniforms.current}
      />
    </mesh>
  );
}

interface HoleMarkerProps {
  position: [number, number, number];
  time: number;
}

function HoleMarker({ position, time }: HoleMarkerProps) {
  const flagRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (flagRef.current) {
      flagRef.current.rotation.y = time * 2;
    }
  });

  return (
    <group position={position}>
      {/* Hole cup */}
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.35, 0.3, 0.15, 32]} />
        <meshStandardMaterial color={0x000000} emissive={new THREE.Color(0, 0.1, 0.2)} />
      </mesh>
      {/* Flag pole */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.0, 8]} />
        <meshStandardMaterial color={0xffffff} emissive={new THREE.Color(0.5, 0.5, 0.5)} />
      </mesh>
      {/* Flag */}
      <mesh ref={flagRef} position={[0.15, 0.8, 0]}>
        <boxGeometry args={[0.35, 0.22, 0.02]} />
        <meshStandardMaterial color={0xff00aa} emissive={new THREE.Color(0.8, 0, 0.5)} emissiveIntensity={0.8} />
      </mesh>
      {/* Glow ring */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.45, 32]} />
        <meshStandardMaterial color={0x00ff88} emissive={new THREE.Color(0, 1, 0.5)} emissiveIntensity={1.5} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

interface TeeMarkerProps {
  position: [number, number, number];
}

function TeeMarker({ position }: TeeMarkerProps) {
  return (
    <mesh position={[position[0], position[1] + 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.2, 0.32, 24]} />
      <meshStandardMaterial color={0xffff00} emissive={new THREE.Color(1, 1, 0)} emissiveIntensity={0.8} transparent opacity={0.6} />
    </mesh>
  );
}

interface BallMeshProps {
  ball: BallState;
  color: string;
  shadingMode: ShadingMode;
  time: number;
  isActive: boolean;
}

function BallMesh({ ball, color, shadingMode, time, isActive }: BallMeshProps) {
  const uniforms = useRef({
    ballColor: { value: new THREE.Color(color) },
    time: { value: time },
    usePhong: { value: shadingMode === 'phong' },
  });
  uniforms.current.time.value = time;
  uniforms.current.usePhong.value = shadingMode === 'phong';
  uniforms.current.ballColor.value.set(color);

  if (ball.isInHole) return null;

  return (
    <group position={ball.position}>
      <mesh>
        <sphereGeometry args={[0.22, 32, 32]} />
        <shaderMaterial
          vertexShader={ballVertexShader}
          fragmentShader={ballFragmentShader}
          uniforms={uniforms.current}
        />
      </mesh>
      {/* Active player highlight ring */}
      {isActive && (
        <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.25, 0.38, 24]} />
          <meshStandardMaterial
            color={color}
            emissive={new THREE.Color(color)}
            emissiveIntensity={1.5}
            transparent
            opacity={0.7}
          />
        </mesh>
      )}
    </group>
  );
}

interface AimArrowProps {
  position: [number, number, number];
  angle: number;
  power: number;
}

function AimArrow({ position, angle, power }: AimArrowProps) {
  const length = 0.5 + power * 2.5;
  const dx = Math.cos(angle) * length;
  const dz = Math.sin(angle) * length;

  const points = [
    new THREE.Vector3(0, 0.25, 0),
    new THREE.Vector3(dx, 0.25, dz),
  ];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <group position={position}>
      <line geometry={lineGeo}>
        <lineBasicMaterial color={0xffff00} linewidth={2} />
      </line>
    </group>
  );
}

interface SceneContentProps {
  level: LevelData;
  balls: BallState[];
  players: Player[];
  activeBallIdx: number;
  shadingMode: ShadingMode;
  aimAngle: number;
  aimPower: number;
  isAiming: boolean;
  levelRotation: number;
  onBallFinished: (playerIdx: number) => void;
  onBallFell: (playerIdx: number) => void;
  onStroke: (playerIdx: number) => void;
  onUpdateBalls: (balls: BallState[]) => void;
}

function SceneContent({
  level, balls, players, activeBallIdx, shadingMode,
  aimAngle, aimPower, isAiming, levelRotation,
  onBallFinished, onBallFell, onStroke, onUpdateBalls,
}: SceneContentProps) {
  const timeRef = useRef(0);
  const ballsRef = useRef(balls);
  ballsRef.current = balls;

  const restitution = level.physicsMode === 'bouncy' ? 0.78
    : level.physicsMode === 'low-gravity' ? 0.6 : 0.5;

  const gravity: [number, number, number] = level.physicsMode === 'low-gravity'
    ? [0, -3.5, 0] : [0, -9.8, 0];

  useFrame((_, delta) => {
    timeRef.current += delta;
    const dt = Math.min(delta, 0.033);

    const updated = ballsRef.current.map((ball, idx) => {
      if (ball.isInHole || !ball.isMoving) return ball;

      const result = stepBall(
        ball.position, ball.velocity, dt, gravity,
        level.platforms, level.walls,
        level.obstacles.map(o => ({ position: o.position, size: o.size })),
        restitution
      );

      let newBall = { ...ball, position: result.pos, velocity: result.vel };

      if (isNearHole(result.pos, level.holePosition)) {
        newBall = { ...newBall, isInHole: true, isMoving: false, velocity: [0, 0, 0] };
        onBallFinished(idx);
      } else if (isBallFallen(result.pos)) {
        newBall = {
          ...newBall,
          isMoving: false,
          position: [level.teePosition[0], level.teePosition[1] + 0.3, level.teePosition[2]],
          velocity: [0, 0, 0],
        };
        onBallFell(idx);
      } else if (isBallStopped(result.vel)) {
        newBall = { ...newBall, isMoving: false, velocity: [0, 0, 0] };
      }

      return newBall;
    });

    const changed = updated.some((b, i) =>
      b.position[0] !== ballsRef.current[i].position[0] ||
      b.isMoving !== ballsRef.current[i].isMoving ||
      b.isInHole !== ballsRef.current[i].isInHole
    );

    if (changed) onUpdateBalls(updated);
  });

  const time = timeRef.current;

  const activeBall = balls[activeBallIdx];

  return (
    <group rotation={[0, (levelRotation * Math.PI) / 2, 0]}>
      {/* Ambient + directional lights */}
      <ambientLight intensity={0.15} color={0x100830} />
      <pointLight position={[10, 8, 5]} intensity={1.8} color={0x00f5ff} distance={40} />
      <pointLight position={[-8, 6, -3]} intensity={1.2} color={0xbf00ff} distance={40} />

      {/* Platforms */}
      {level.platforms.map((p, i) => (
        <Platform key={i} position={p.position} size={p.size} shadingMode={shadingMode} time={time} />
      ))}

      {/* Walls */}
      {level.walls.map((w, i) => (
        <Wall key={i} position={w.position} size={w.size} />
      ))}

      {/* Obstacles */}
      {level.obstacles.map((o, i) => (
        <ObstacleMesh
          key={i}
          position={o.position}
          size={o.size}
          color={o.color}
          pulseSpeed={o.pulseSpeed}
          pulseAmp={o.pulseAmp}
          type={o.type}
          shadingMode={shadingMode}
          time={time}
        />
      ))}

      {/* Hole */}
      <HoleMarker position={level.holePosition} time={time} />

      {/* Tee */}
      <TeeMarker position={level.teePosition} />

      {/* Balls */}
      {balls.map((ball, idx) => (
        <BallMesh
          key={idx}
          ball={ball}
          color={players[idx].color}
          shadingMode={shadingMode}
          time={time}
          isActive={idx === activeBallIdx}
        />
      ))}

      {/* Aim arrow */}
      {isAiming && activeBall && !activeBall.isMoving && !activeBall.isInHole && (
        <AimArrow
          position={activeBall.position}
          angle={aimAngle}
          power={aimPower}
        />
      )}
    </group>
  );
}

interface GameSceneProps {
  level: LevelData;
  balls: BallState[];
  players: Player[];
  activeBallIdx: number;
  shadingMode: ShadingMode;
  aimAngle: number;
  aimPower: number;
  isAiming: boolean;
  levelRotation: number;
  onBallFinished: (playerIdx: number) => void;
  onBallFell: (playerIdx: number) => void;
  onStroke: (playerIdx: number) => void;
  onUpdateBalls: (balls: BallState[]) => void;
}

export function GameScene(props: GameSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 12, 16], fov: 50 }}
      style={{ width: '100vw', height: '100vh', background: '#050510' }}
      gl={{ antialias: true }}
    >
      <SceneContent {...props} />
      <OrbitControls
        enablePan={false}
        minDistance={8}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2.2}
      />
    </Canvas>
  );
}
