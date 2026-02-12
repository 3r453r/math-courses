"use client";

import { Surface3D } from "./Surface3D";
import type { VisualizationSpec } from "@/types/lesson";

interface Props {
  spec: VisualizationSpec;
}

export function Manifold3D({ spec }: Props) {
  return <Surface3D spec={spec} />;
}
