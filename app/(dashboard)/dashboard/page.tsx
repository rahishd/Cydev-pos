import { Card } from "@/components/ui/Card";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-text">Dashboard</h1>
      <Card>
        <p className="text-sm text-text-muted">
          Dashboard metrics (today&apos;s sales, inventory value, low-stock
          alerts, etc.) will be built in a later step.
        </p>
      </Card>
    </div>
  );
}
