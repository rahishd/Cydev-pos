"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: { date: string; sales: number }[];
}

export function SalesChart({ data }: Props) {
  const hasData = data.some((d) => d.sales > 0);

  return (
    <div className="h-52">
      {!hasData ? (
        <div className="flex h-full items-center justify-center text-sm text-text-muted">
          No sales data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `Rs ${v.toLocaleString()}`}
            />
            <Tooltip
              formatter={(value) => [`Rs ${Number(value).toLocaleString()}`, "Sales"]}
              contentStyle={{
                fontSize: 12,
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                boxShadow: "none",
              }}
            />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#2563eb"
              strokeWidth={1.5}
              fill="url(#salesGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
