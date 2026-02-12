"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class VizErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Visualization error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Visualization Error</AlertTitle>
          <AlertDescription>
            This visualization could not be rendered. The specification may be
            malformed.
            <br />
            <code className="text-xs mt-1 block">
              {this.state.error?.message}
            </code>
          </AlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}
