"use client";

import { Mafs, Coordinates, Plot, Theme, Point, Text } from "mafs";
import { createSafeFunction } from "@/lib/content/safeEval";
import { useMemo } from "react";
import type { VisualizationSpec } from "@/types/lesson";

const COLORS = [Theme.blue, Theme.red, Theme.green, Theme.orange, Theme.pink];

interface Props {
  spec: VisualizationSpec;
}

export function FunctionPlot({ spec }: Props) {
  const { xRange = [-5, 5], yRange = [-5, 5], functions = [], points = [] } =
    spec;

  const safeFunctions = useMemo(
    () =>
      functions.map((f, i) => ({
        fn: createSafeFunction(f.expression),
        color: f.color || COLORS[i % COLORS.length],
        label: f.label,
      })),
    [functions]
  );

  return (
    <Mafs
      viewBox={{ x: xRange as [number, number], y: yRange as [number, number] }}
      preserveAspectRatio={false}
      height={350}
      zoom
      pan
    >
      <Coordinates.Cartesian />
      {safeFunctions.map((sf, i) => (
        <Plot.OfX key={i} y={(x) => sf.fn(x)} color={sf.color} />
      ))}
      {points.map((pt, i) => (
        <Point key={`pt-${i}`} x={pt.x} y={pt.y} />
      ))}
      {safeFunctions
        .filter((sf) => sf.label)
        .map((sf, i) => (
          <Text
            key={`label-${i}`}
            x={xRange[1] - 1}
            y={sf.fn(xRange[1] - 1)}
            attach="e"
            size={12}
          >
            {sf.label!}
          </Text>
        ))}
    </Mafs>
  );
}
