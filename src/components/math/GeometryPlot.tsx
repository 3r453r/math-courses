"use client";

import { Mafs, Coordinates, Point, Line, Circle, Polygon, Vector, Text, Theme } from "mafs";
import type { VisualizationSpec } from "@/types/lesson";

const COLOR_MAP: Record<string, string> = {
  blue: Theme.blue,
  red: Theme.red,
  green: Theme.green,
  orange: Theme.orange,
  pink: Theme.pink,
  indigo: Theme.indigo,
  yellow: Theme.yellow,
  purple: Theme.violet,
  violet: Theme.violet,
};

function resolveColor(color?: string, fallback = Theme.blue): string {
  if (!color) return fallback;
  return COLOR_MAP[color.toLowerCase()] ?? color; // allow raw hex/css colors too
}

interface Props {
  spec: VisualizationSpec;
}

export function GeometryPlot({ spec }: Props) {
  const { xRange = [-5, 5], yRange = [-5, 5], points = [], shapes = [], vectors = [] } =
    spec;

  return (
    <Mafs
      viewBox={{
        x: xRange as [number, number],
        y: yRange as [number, number],
      }}
      preserveAspectRatio="contain"
      height={350}
      zoom
      pan
    >
      <Coordinates.Cartesian />

      {/* Shapes: lines, circles, polygons */}
      {shapes?.map((shape, i) => {
        const color = resolveColor(shape.params.color as string | undefined);
        switch (shape.type) {
          case "line": {
            const p = shape.params as {
              from: [number, number];
              to: [number, number];
              segment?: boolean;
            };
            if (!p.from || !p.to) return null;
            // Use Line.ThroughPoints (infinite line) by default;
            // Line.Segment only when explicitly requested
            if (p.segment) {
              return (
                <Line.Segment
                  key={`shape-${i}`}
                  point1={p.from}
                  point2={p.to}
                  color={color}
                />
              );
            }
            return (
              <Line.ThroughPoints
                key={`shape-${i}`}
                point1={p.from}
                point2={p.to}
                color={color}
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
                key={`shape-${i}`}
                center={p.center}
                radius={p.radius}
                color={color}
              />
            );
          }
          case "polygon": {
            const p = shape.params as { vertices: [number, number][] };
            if (!p.vertices || p.vertices.length < 3) return null;
            return (
              <Polygon key={`shape-${i}`} points={p.vertices} color={color} />
            );
          }
          default:
            return null;
        }
      })}

      {/* Vectors */}
      {vectors?.map((v, i) => {
        const origin = v.origin as [number, number];
        const dir = v.direction as [number, number];
        const color = resolveColor(v.color);
        return (
          <Vector
            key={`vec-${i}`}
            tail={origin}
            tip={[origin[0] + dir[0], origin[1] + dir[1]]}
            color={color}
          />
        );
      })}

      {/* Points */}
      {points.map((pt, i) => (
        <Point
          key={`pt-${i}`}
          x={pt.x}
          y={pt.y}
          color={resolveColor(pt.color)}
        />
      ))}

      {/* Labels for vectors */}
      {vectors?.filter((v) => v.label).map((v, i) => {
        const origin = v.origin as [number, number];
        const dir = v.direction as [number, number];
        return (
          <Text
            key={`vlabel-${i}`}
            x={origin[0] + dir[0]}
            y={origin[1] + dir[1]}
            attach="e"
            size={12}
          >
            {v.label!}
          </Text>
        );
      })}

      {/* Labels for points */}
      {points.filter((pt) => pt.label).map((pt, i) => (
        <Text key={`plabel-${i}`} x={pt.x} y={pt.y} attach="e" size={12}>
          {pt.label!}
        </Text>
      ))}
    </Mafs>
  );
}
