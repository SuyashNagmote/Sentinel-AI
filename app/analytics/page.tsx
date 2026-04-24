import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export const metadata = {
  title: "Security Operations Center | Sentinel AI",
  description: "Real-time threat intelligence and platform metrics for Sentinel AI.",
};

export default function AnalyticsPage() {
  return (
    <div className="flex-1 bg-black min-h-[calc(100vh-64px)]">
      <div className="container mx-auto px-4 py-8">
        <AnalyticsDashboard />
      </div>
    </div>
  );
}
