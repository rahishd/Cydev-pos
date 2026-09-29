<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Bag & Shoes Inventory Management System

## What this is

An internal web app for a bag & shoes retail shop to manage inventory, purchases, POS/sales, invoicing, customers, suppliers, expenses and reporting. Built for two roles: **Owner** (full access) and **Staff** (operational access). There is **no public customer-facing storefront** — this is a back-office tool only, used by shop staff on desktop/tablet/mobile.

Full requirements live in [`Bag_Shoes_Inventory_FRD_v1.pdf`](./Bag_Shoes_Inventory_FRD_v1.pdf) at the repo root. Section map for quick lookup:

1. User Roles · 2. Dashboard · 3. Product Management · 4. Product Variants · 5. Inventory Management · 6. Stock Count · 7. Purchase Management · 8. Supplier Management · 9. Sales/POS · 10. Invoice Management · 11. Sales Returns & Exchanges · 12. Customer Management · 13. Customer Credit · 14. Expense Management · 15. Profit Calculation · 16. Reports · 17. Low-Stock Management · 18. Search & Filtering · 19. User & Permission Management · 20. Audit Log · 21. System Settings · 22. Non-Functional Requirements · 23. V1 Scope Exclusions (barcode scanning/printing, AI forecasting, multi-branch, online store, SMS automation, loyalty program) · 24. Future Barcode Readiness (variants carry an optional `barcode` field even though scanning isn't built yet).

## Tech stack

- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS — custom, minimal design system (see below). No component library that imposes its own visual identity.
- **Database:** PostgreSQL, hosted on Neon, accessed via **Prisma** ORM (`prisma/schema.prisma`)
- **Auth:** Auth.js (NextAuth v5), credentials provider, bcrypt-hashed passwords, RBAC (Owner/Staff) enforced in middleware + server-side role checks — no third-party OAuth
- **File storage:** Vercel Blob, for product images and expense/purchase attachments
- **Deployment:** Vercel

## Design principles

The UI must look hand-built and purposeful, not like a default AI-generated scaffold:

- Small, self-owned set of UI primitives in `components/ui/` (Button, Input, Select, Table, Card, Badge, Modal, etc.) — do not pull in shadcn/ui, Material UI, or similar full design systems
- Restrained palette: neutral grays as the base, one accent color used sparingly for primary actions/status; avoid purple-gradient/glassmorphism defaults
- Flat surfaces, thin borders instead of heavy drop shadows, tight and consistent spacing scale
- Information-dense layouts appropriate for a back-office/retail tool (tables, filters, forms) over marketing-style whitespace
- No decorative icons/illustrations unless they carry real meaning (e.g. status indicators)

## Data model (summary)

Modeled fully in `prisma/schema.prisma` even where the UI isn't built yet, so later phases don't require schema churn:

`User` (OWNER/STAFF role) · `Category` · `Brand` · `Product` · `ProductVariant` (size/color/material, own SKU + prices + stock, optional `barcode`) · `Supplier` · `Purchase` + `PurchaseItem` · `StockMovement` (single source of truth for every inventory change: opening, purchase, sale, customer/supplier return, damage, loss, adjustment) · `StockCount` + `StockCountItem` · `Sale` + `SaleItem` · `Payment` · `Invoice` · `SaleReturn` · `Customer` + `CustomerCredit` · `Expense` + `ExpenseCategory` · `AuditLog` · `SystemSettings`.

## Workflow rules for agents working on this repo

- **Build incrementally, one module at a time.** The user explicitly wants to review and approve each feature area (products, inventory, purchases, POS, invoicing, returns, customers, expenses, reports, settings, audit log, etc.) before the next one is started. Do not build ahead of what's been agreed.
- Don't add features, polish, or abstractions beyond the current approved step.
- Profit calculations must use actual purchase cost of sold products/variants (FRD §15) — don't approximate with current/average price unless that's what's been asked for.
- All inventory quantity changes must go through `StockMovement` records, never a direct quantity edit — that table is the audit trail for stock.
