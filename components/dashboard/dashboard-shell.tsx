"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { ClientDashboard } from "./client-dashboard";

export function DashboardShell() {
  return (
    <ErrorBoundary fallbackTitle="Dashboard encountered an error">
      <ClientDashboard />
    </ErrorBoundary>
  );
}
