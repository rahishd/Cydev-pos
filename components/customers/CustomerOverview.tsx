"use client";

import { Card } from "@/components/ui/Card";

export function CustomerOverview({ customer }: { customer: any }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-semibold text-text-muted mb-1">Name</div>
            <div className="text-sm font-medium text-text">{customer.name}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-text-muted mb-1">Phone</div>
            <div className="text-sm font-medium text-text">{customer.phone || "-"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-text-muted mb-1">Email</div>
            <div className="text-sm font-medium text-text">{customer.email || "-"}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-text-muted mb-1">Address</div>
            <div className="text-sm font-medium text-text">{customer.address || "-"}</div>
          </div>
        </div>
      </Card>

      {customer.notes && (
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-muted mb-2">Notes</div>
          <div className="text-sm text-text">{customer.notes}</div>
        </Card>
      )}

      <Card className="p-4 text-xs text-text-muted">
        Member since {new Date(customer.createdAt).toLocaleDateString()}
      </Card>
    </div>
  );
}
