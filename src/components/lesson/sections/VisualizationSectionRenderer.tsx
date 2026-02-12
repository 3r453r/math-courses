"use client";

import { Suspense, lazy } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { VizErrorBoundary } from "@/components/math/VizErrorBoundary";
import { FunctionPlot } from "@/components/math/FunctionPlot";
import { ParametricPlot } from "@/components/math/ParametricPlot";
import { VectorFieldPlot } from "@/components/math/VectorFieldPlot";
import { GeometryPlot } from "@/components/math/GeometryPlot";
import type { VisualizationSection } from "@/types/lesson";

// Lazy-load heavy 3D components
const Surface3D = lazy(() =>
  import("@/components/math/Surface3D").then((m) => ({ default: m.Surface3D }))
);
const Manifold3D = lazy(() =>
  import("@/components/math/Manifold3D").then((m) => ({
    default: m.Manifold3D,
  }))
);
const TangentSpace3D = lazy(() =>
  import("@/components/math/TangentSpace3D").then((m) => ({
    default: m.TangentSpace3D,
  }))
);
const CoordinateTransform3D = lazy(() =>
  import("@/components/math/CoordinateTransform3D").then((m) => ({
    default: m.CoordinateTransform3D,
  }))
);

interface Props {
  section: VisualizationSection;
}

function VizLoading() {
  return (
    <div className="flex items-center justify-center h-64 bg-muted/30 rounded-lg">
      <p className="text-sm text-muted-foreground animate-pulse">
        Loading 3D visualization...
      </p>
    </div>
  );
}

export function VisualizationSectionRenderer({ section }: Props) {
  const { vizType, spec, caption, interactionHint } = section;

  function renderViz() {
    switch (vizType) {
      case "function_plot":
        return <FunctionPlot spec={spec} />;
      case "parametric_plot":
        return <ParametricPlot spec={spec} />;
      case "vector_field":
        return <VectorFieldPlot spec={spec} />;
      case "geometry":
        return <GeometryPlot spec={spec} />;
      case "3d_surface":
        return (
          <Suspense fallback={<VizLoading />}>
            <Surface3D spec={spec} />
          </Suspense>
        );
      case "manifold":
        return (
          <Suspense fallback={<VizLoading />}>
            <Manifold3D spec={spec} />
          </Suspense>
        );
      case "tangent_space":
        return (
          <Suspense fallback={<VizLoading />}>
            <TangentSpace3D spec={spec} />
          </Suspense>
        );
      case "coordinate_transform":
        return (
          <Suspense fallback={<VizLoading />}>
            <CoordinateTransform3D spec={spec} />
          </Suspense>
        );
      default:
        return (
          <Alert>
            <AlertTitle>Unsupported Visualization</AlertTitle>
            <AlertDescription>
              Visualization type &quot;{vizType}&quot; is not yet supported.
            </AlertDescription>
          </Alert>
        );
    }
  }

  return (
    <Card className="my-6">
      <CardContent className="pt-6">
        <VizErrorBoundary>{renderViz()}</VizErrorBoundary>
        <p className="text-sm text-center mt-3 text-muted-foreground">
          {caption}
        </p>
        {interactionHint && (
          <p className="text-xs text-center mt-1 text-muted-foreground/70 italic">
            {interactionHint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
