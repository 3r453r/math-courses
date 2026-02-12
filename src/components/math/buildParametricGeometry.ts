import { BufferGeometry, Float32BufferAttribute } from "three";
import { createSafeParametricSurface } from "@/lib/content/safeEval";

interface ParametricSurfaceSpec {
  xExpr: string;
  yExpr: string;
  zExpr: string;
  uRange: [number, number];
  vRange: [number, number];
}

export function buildParametricGeometry(
  ps: ParametricSurfaceSpec,
  resolution = 50
): BufferGeometry | null {
  try {
    const surfaceFn = createSafeParametricSurface(ps.xExpr, ps.yExpr, ps.zExpr);
    const positions: number[] = [];
    const indices: number[] = [];
    const [uMin, uMax] = ps.uRange;
    const [vMin, vMax] = ps.vRange;

    for (let i = 0; i <= resolution; i++) {
      for (let j = 0; j <= resolution; j++) {
        const u = uMin + (i / resolution) * (uMax - uMin);
        const v = vMin + (j / resolution) * (vMax - vMin);
        const [x, y, z] = surfaceFn(u, v);
        positions.push(
          isFinite(x) ? x : 0,
          isFinite(y) ? y : 0,
          isFinite(z) ? z : 0
        );
      }
    }

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const a = i * (resolution + 1) + j;
        const b = a + resolution + 1;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  } catch (e) {
    console.error("Failed to build parametric geometry:", e);
    return null;
  }
}
