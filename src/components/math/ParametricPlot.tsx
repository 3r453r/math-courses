"use client";

import { Mafs, Coordinates, Plot, Theme } from "mafs";
import { createSafeFunction } from "@/lib/content/safeEval";
import { useMemo } from "react";
import type { VisualizationSpec } from "@/types/lesson";

interface Props {
  spec: VisualizationSpec;
}

export function ParametricPlot({ spec }: Props) {
  const { xRange = [-5, 5], yRange = [-5, 5] } = spec;

  const parametric = useMemo(() => {
    if (spec.functions && spec.functions.length >= 2) {
      const xFn = createSafeFunction(spec.functions[0].expression);
      const yFn = createSafeFunction(spec.functions[1].expression);
      return { xFn, yFn, tRange: xRange as [number, number] };
    }
    return null;
  }, [spec.functions, xRange]);

  if (!parametric) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        Parametric plot requires at least two function expressions.
      </div>
    );
  }

  return (
    <Mafs
      viewBox={{
        x: xRange as [number, number],
        y: yRange as [number, number],
      }}
      preserveAspectRatio={false}
      height={350}
      zoom
      pan
    >
      <Coordinates.Cartesian />
      <Plot.Parametric
        xy={(t) => [parametric.xFn(t), parametric.yFn(t)]}
        t={parametric.tRange}
        color={Theme.blue}
      />
    </Mafs>
  );
}
