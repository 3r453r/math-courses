"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  height?: number;
}

export function Scene3D({ children, height = 400 }: Props) {
  return (
    <div
      style={{ height }}
      className="w-full rounded-lg overflow-hidden bg-muted/20"
    >
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Grid
          args={[10, 10]}
          cellSize={0.5}
          cellColor="#6b7280"
          sectionSize={1}
          sectionColor="#9ca3af"
          fadeDistance={15}
          infiniteGrid
        />
        {children}
        <OrbitControls enableDamping dampingFactor={0.1} />
      </Canvas>
    </div>
  );
}
