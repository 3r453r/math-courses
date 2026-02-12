"use client";

import { Mafs, Coordinates, Vector, Plot, Point, Theme } from "mafs";
import { createSafeVectorField } from "@/lib/content/safeEval";
import { useMemo } from "react";
import type { VisualizationSpec } from "@/types/lesson";

interface Props {
  spec: VisualizationSpec;
}

export function VectorFieldPlot({ spec }: Props) {
  const { xRange = [-3, 3], yRange = [-3, 3], vectors = [] } = spec;

  // If there's a fieldFunction with dx/dy expressions, use Plot.VectorField
  const fieldFn = useMemo(() => {
    if (spec.fieldFunction) {
      // fieldFunction may be like "([x,y]) => [-y, x]" or separate dx/dy
      // Try to parse as two expressions separated by comma patterns
      const match = spec.fieldFunction.match(
        /\[([^,\]]+),\s*([^\]]+)\]/
      );
      if (match) {
        try {
          const vf = createSafeVectorField(match[1].trim(), match[2].trim());
          return (xy: [number, number]): [number, number] => vf(xy[0], xy[1]);
        } catch {
          // Fall through to explicit vectors
        }
      }
    }
    return null;
  }, [spec.fieldFunction]);

  return (
    <Mafs
      viewBox={{
        x: xRange as [number, number],
        y: yRange as [number, number],
      }}
      preserveAspectRatio={false}
      height={350}
    >
      <Coordinates.Cartesian />
      {fieldFn && <Plot.VectorField xy={fieldFn} step={0.75} />}
      {vectors.map((v, i) => {
        const origin = v.origin as [number, number];
        const dir = v.direction as [number, number];
        return (
          <Vector
            key={i}
            tail={origin}
            tip={[origin[0] + dir[0], origin[1] + dir[1]]}
            color={v.color || Theme.blue}
          />
        );
      })}
      {spec.points?.map((pt, i) => (
        <Point key={`pt-${i}`} x={pt.x} y={pt.y} />
      ))}
    </Mafs>
  );
}
