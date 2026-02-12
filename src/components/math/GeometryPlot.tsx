"use client";

import { Mafs, Coordinates, Point, Line, Circle, Polygon, Theme } from "mafs";
import type { VisualizationSpec } from "@/types/lesson";

interface Props {
  spec: VisualizationSpec;
}

export function GeometryPlot({ spec }: Props) {
  const { xRange = [-5, 5], yRange = [-5, 5], points = [], shapes = [] } =
    spec;

  return (
    <Mafs
      viewBox={{
        x: xRange as [number, number],
        y: yRange as [number, number],
      }}
      preserveAspectRatio="contain"
      height={350}
    >
      <Coordinates.Cartesian />
      {shapes?.map((shape, i) => {
        switch (shape.type) {
          case "line": {
            const p = shape.params as {
              from: [number, number];
              to: [number, number];
            };
            if (!p.from || !p.to) return null;
            return (
              <Line.Segment
                key={i}
                point1={p.from}
                point2={p.to}
                color={Theme.blue}
              />
            );
          }
          case "circle": {
            const p = shape.params as {
              center: [number, number];
              radius: number;
            };
            if (!p.center || !p.radius) return null;
            return (
              <Circle
                key={i}
                center={p.center}
                radius={p.radius}
                color={Theme.blue}
              />
            );
          }
          case "polygon": {
            const p = shape.params as { vertices: [number, number][] };
            if (!p.vertices || p.vertices.length < 3) return null;
            return (
              <Polygon key={i} points={p.vertices} color={Theme.blue} />
            );
          }
          default:
            return null;
        }
      })}
      {points.map((pt, i) => (
        <Point key={`pt-${i}`} x={pt.x} y={pt.y} />
      ))}
    </Mafs>
  );
}
