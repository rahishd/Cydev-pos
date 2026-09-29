"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#e11d48", "#0891b2", "#71717a"];

interface Props {
  data: { method: string; amount: number }[];
}

export function PaymentMethodChart({ data }: Props) {
  const hasData = data.some((d) => d.amount > 0);

  if (!hasData) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-text-muted">
        No payment data yet
      </div>
    );
  }

  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="method"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`Rs ${Number(value).toLocaleString()}`, ""]}
            contentStyle={{
              fontSize: 12,
              border: "1px solid #e4e4e7",
              borderRadius: 6,
              boxShadow: "none",
            }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => <span style={{ fontSize: 11, color: "#71717a" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
