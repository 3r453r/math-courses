"use client";

import { useMemo } from "react";
import { DoubleSide } from "three";
import { Scene3D } from "./Scene3D";
import { buildParametricGeometry } from "./buildParametricGeometry";
import type { VisualizationSpec } from "@/types/lesson";

interface Props {
  spec: VisualizationSpec;
}

function ParametricMesh({ spec }: Props) {
  const geometry = useMemo(() => {
    if (!spec.parametricSurface) return null;
    return buildParametricGeometry(spec.parametricSurface);
  }, [spec.parametricSurface]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color="#6366f1"
        side={DoubleSide}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

export function Surface3D({ spec }: Props) {
  return (
    <Scene3D>
      <ParametricMesh spec={spec} />
    </Scene3D>
  );
}
