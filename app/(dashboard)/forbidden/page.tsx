import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function ForbiddenPage() {
  return (
    <Card className="mx-auto mt-10 max-w-md text-center">
      <h1 className="mb-1 text-lg font-semibold text-text">No access</h1>
      <p className="mb-4 text-sm text-text-muted">
        Your account doesn&apos;t have permission to open this page. Please ask the Owner to enable it.
      </p>
      <Link href="/dashboard" className="text-sm font-medium text-accent hover:underline">
        Back to dashboard
      </Link>
    </Card>
  );
}
