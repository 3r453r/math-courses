"use client";

import { useMemo } from "react";
import { DoubleSide, Vector3 } from "three";
import { Scene3D } from "./Scene3D";
import { buildParametricGeometry } from "./buildParametricGeometry";
import type { VisualizationSpec } from "@/types/lesson";

interface Props {
  spec: VisualizationSpec;
}

function SurfaceMesh({ spec }: Props) {
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
        opacity={0.6}
      />
    </mesh>
  );
}

function TangentVectors({ spec }: Props) {
  const vectors = spec.vectors || [];

  return (
    <>
      {vectors.map((v, i) => {
        const origin = v.origin as [number, number, number];
        const dir = v.direction as [number, number, number];
        if (!origin || !dir || origin.length < 3 || dir.length < 3)
          return null;
        const len = Math.sqrt(dir[0] ** 2 + dir[1] ** 2 + dir[2] ** 2);
        if (len === 0) return null;
        return (
          <arrowHelper
            key={i}
            args={[
              new Vector3(...dir).normalize(),
              new Vector3(...origin),
              len,
              v.color || "#ef4444",
              len * 0.15,
              len * 0.1,
            ]}
          />
        );
      })}
    </>
  );
}

export function TangentSpace3D({ spec }: Props) {
  return (
    <Scene3D>
      <SurfaceMesh spec={spec} />
      <TangentVectors spec={spec} />
    </Scene3D>
  );
}
