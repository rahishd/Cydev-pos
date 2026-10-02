"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import type { ProductsPageData, ProductWithRelations } from "@/app/(dashboard)/products/actions";
import {
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
  createCategory,
  createBrand,
} from "@/app/(dashboard)/products/actions";

// ---------- Form types ----------

interface VariantRow {
  id?: string;
  size: string;
  color: string;
  material: string;
  sku: string;
  purchasePrice: string;
  sellingPrice: string;
  quantity: string;
  minStockLevel: string;
}

interface FormState {
  name: string;
  sku: string;
  categoryId: string;
  brandId: string;
  supplierId: string;
  description: string;
  purchasePrice: string;
  sellingPrice: string;
  discountPrice: string;
  minStockLevel: string;
  status: "ACTIVE" | "INACTIVE";
  imageUrl: string;
  openingStock: string;
  variants: VariantRow[];
}

const emptyForm = (): FormState => ({
  name: "",
  sku: "",
  categoryId: "",
  brandId: "",
  supplierId: "",
  description: "",
  purchasePrice: "",
  sellingPrice: "",
  discountPrice: "",
  minStockLevel: "0",
  status: "ACTIVE",
  imageUrl: "",
  openingStock: "0",
  variants: [],
});

const blankVariant = (baseSku: string, idx: number, buyPrice: string, sellPrice: string): VariantRow => ({
  size: "",
  color: "",
  material: "",
  sku: baseSku ? `${baseSku}-${String(idx).padStart(3, "0")}` : "",
  purchasePrice: buyPrice,
  sellingPrice: sellPrice,
  quantity: "0",
  minStockLevel: "0",
});

// ---------- Sub-components ----------

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-text">{value.toLocaleString()}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
      {children}
    </div>
  );
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

// ---------- Main component ----------

export function ProductsClient({ data }: { data: ProductsPageData }) {
  const router = useRouter();

  // Local catalog state — updated optimistically on quick-create
  const [categories, setCategories] = useState(data.categories);
  const [brands, setBrands] = useState(data.brands);

  // Sync if server data changes (router.refresh)
  useEffect(() => { setCategories(data.categories); }, [data.categories]);
  useEffect(() => { setBrands(data.brands); }, [data.brands]);

  // Filters (client-side)
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ProductWithRelations | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Actions menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-actions-menu]")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ---------- Filtering ----------
  const filtered = data.products.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku.toLowerCase().includes(q)) return false;
    }
    if (filterCategory && p.categoryId !== filterCategory) return false;
    if (filterBrand && p.brandId !== filterBrand) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    return true;
  });

  // ---------- Drawer helpers ----------
  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setDrawerOpen(true);
  };

  const openEdit = useCallback((product: ProductWithRelations) => {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId ?? "",
      brandId: product.brandId ?? "",
      supplierId: product.supplierId ?? "",
      description: product.description ?? "",
      purchasePrice: String(product.purchasePrice),
      sellingPrice: String(product.sellingPrice),
      discountPrice: product.discountPrice ? String(product.discountPrice) : "",
      minStockLevel: String(product.minStockLevel),
      status: product.status,
      imageUrl: product.imageUrl ?? "",
      variants: product.variants.map((v) => ({
        id: v.id,
        size: v.size ?? "",
        color: v.color ?? "",
        material: v.material ?? "",
        sku: v.sku,
        purchasePrice: String(v.purchasePrice),
        sellingPrice: String(v.sellingPrice),
        quantity: String(v.quantity),
        minStockLevel: String(v.minStockLevel),
      })),
    });
    setFormError(null);
    setOpenMenuId(null);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = () => setDrawerOpen(false);

  // ---------- Variant helpers ----------
  const addVariant = () => {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        blankVariant(prev.sku, prev.variants.length + 1, prev.purchasePrice, prev.sellingPrice),
      ],
    }));
  };

  const setVariantField = (idx: number, field: keyof VariantRow, value: string) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === idx ? { ...v, [field]: value } : v)),
    }));
  };

  const removeVariant = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== idx),
    }));
  };

  // ---------- Quick-create category / brand ----------
  const quickCreateCategory = async () => {
    const name = window.prompt("New category name:");
    if (!name?.trim()) return;
    try {
      const cat = await createCategory(name.trim());
      setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({ ...prev, categoryId: cat.id }));
    } catch {
      alert("Failed to create category");
    }
  };

  const quickCreateBrand = async () => {
    const name = window.prompt("New brand name:");
    if (!name?.trim()) return;
    try {
      const brand = await createBrand(name.trim());
      setBrands((prev) => [...prev, brand].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((prev) => ({ ...prev, brandId: brand.id }));
    } catch {
      alert("Failed to create brand");
    }
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    if (!form.name.trim()) return setFormError("Product name is required.");
    if (!form.sku.trim()) return setFormError("SKU is required.");
    if (!form.purchasePrice || isNaN(+form.purchasePrice))
      return setFormError("Purchase price is required.");
    if (!form.sellingPrice || isNaN(+form.sellingPrice))
      return setFormError("Selling price is required.");

    for (const v of form.variants) {
      if (!v.sku.trim()) return setFormError("All variants must have a SKU.");
    }

    // If creating new product with no variants, use opening stock for default variant
    let variantsToSubmit = form.variants;
    if (!editing && form.variants.length === 0 && parseInt(form.openingStock) > 0) {
      variantsToSubmit = [
        {
          size: "",
          color: "",
          material: "",
          sku: `${form.sku.trim().toUpperCase()}-001`,
          purchasePrice: form.purchasePrice,
          sellingPrice: form.sellingPrice,
          quantity: form.openingStock,
          minStockLevel: form.minStockLevel,
        },
      ];
    }

    const input = {
      name: form.name.trim(),
      sku: form.sku.trim().toUpperCase(),
      categoryId: form.categoryId || undefined,
      brandId: form.brandId || undefined,
      supplierId: form.supplierId || undefined,
      description: form.description || undefined,
      purchasePrice: parseFloat(form.purchasePrice),
      sellingPrice: parseFloat(form.sellingPrice),
      discountPrice: form.discountPrice ? parseFloat(form.discountPrice) : undefined,
      minStockLevel: parseInt(form.minStockLevel) || 0,
      status: form.status,
      imageUrl: form.imageUrl || undefined,
      variants: variantsToSubmit.map((v) => ({
        id: v.id,
        size: v.size || undefined,
        color: v.color || undefined,
        material: v.material || undefined,
        sku: v.sku.trim().toUpperCase(),
        purchasePrice: parseFloat(v.purchasePrice) || parseFloat(form.purchasePrice),
        sellingPrice: parseFloat(v.sellingPrice) || parseFloat(form.sellingPrice),
        quantity: parseInt(v.quantity) || 0,
        minStockLevel: parseInt(v.minStockLevel) || 0,
      })),
    };

    setIsSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateProduct(editing.id, input);
      } else {
        await createProduct(input);
      }
      closeDrawer();
      router.refresh();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to save product.");
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- Toggle / Delete ----------
  const handleToggleStatus = async (id: string) => {
    setOpenMenuId(null);
    try {
      await toggleProductStatus(id);
      router.refresh();
    } catch {
      alert("Failed to update status.");
    }
  };

  const handleDelete = async (id: string) => {
    setOpenMenuId(null);
    if (!confirm("Delete this product? This cannot be undone.")) return;
    try {
      await deleteProduct(id);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete.");
    }
  };

  // ---------- Render ----------
  return (
    <>
      <div className="space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">Products</h1>
          <Button onClick={openAdd}>+ Add Product</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <StatTile label="Total Products" value={data.stats.total} />
          <StatTile label="Active" value={data.stats.active} />
          <StatTile label="Inactive" value={data.stats.inactive} />
          <StatTile label="Categories" value={data.stats.categories} />
          <StatTile label="Brands" value={data.stats.brands} />
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-40"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Select
            value={filterBrand}
            onChange={(e) => setFilterBrand(e.target.value)}
            className="w-40"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-36"
          >
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          {(search || filterCategory || filterBrand || filterStatus) && (
            <button
              onClick={() => { setSearch(""); setFilterCategory(""); setFilterBrand(""); setFilterStatus(""); }}
              className="text-xs text-text-muted hover:text-text"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table */}
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-zinc-50/70">
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Image</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Brand</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-text-muted">Variants</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-text-muted">
                    {search || filterCategory || filterBrand || filterStatus
                      ? "No products match your filters."
                      : "No products yet. Click \"+ Add Product\" to get started."}
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-border last:border-0 hover:bg-zinc-50/60"
                  >
                    {/* Image */}
                    <td className="px-4 py-3">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-9 w-9 rounded border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded border border-border bg-zinc-100 text-xs font-semibold text-text-muted">
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </td>

                    {/* Name + SKU */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-text">{product.name}</div>
                      <div className="font-mono text-xs text-text-muted">{product.sku}</div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 text-text-muted">
                      {product.category?.name ?? <span className="text-text-muted/50">—</span>}
                    </td>

                    {/* Brand */}
                    <td className="px-4 py-3 text-text-muted">
                      {product.brand?.name ?? <span className="text-text-muted/50">—</span>}
                    </td>

                    {/* Variants count */}
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                        {product._count.variants}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant={product.status === "ACTIVE" ? "success" : "default"}>
                        {product.status === "ACTIVE" ? "Active" : "Inactive"}
                      </Badge>
                    </td>

                    {/* Actions ⋮ */}
                    <td className="px-4 py-3 text-right">
                      <div className="relative inline-block" data-actions-menu>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === product.id ? null : product.id);
                          }}
                          className="rounded px-2 py-1 text-base text-text-muted hover:bg-zinc-100 hover:text-text"
                          aria-label="Actions"
                        >
                          ⋮
                        </button>
                        {openMenuId === product.id && (
                          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-surface py-1 shadow-lg">
                            <button
                              onClick={() => openEdit(product)}
                              className="w-full px-4 py-2 text-left text-sm text-text hover:bg-zinc-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleStatus(product.id)}
                              className="w-full px-4 py-2 text-left text-sm text-text hover:bg-zinc-50"
                            >
                              {product.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </button>
                            <div className="my-1 border-t border-border" />
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="w-full px-4 py-2 text-left text-sm text-danger hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>

        {/* Result count */}
        {data.products.length > 0 && (
          <p className="text-xs text-text-muted">
            Showing {filtered.length} of {data.products.length} products
          </p>
        )}
      </div>

      {/* Add / Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? `Edit: ${editing.name}` : "Add Product"}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={closeDrawer} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Saving…" : editing ? "Save Changes" : "Create Product"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">
              {formError}
            </div>
          )}

          {/* ── Basic Info ── */}
          <div>
            <SectionHeading>Basic Info</SectionHeading>
            <FormRow>
              <div>
                <Label htmlFor="f-name">Name *</Label>
                <Input
                  id="f-name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nike Air Max"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="f-sku">SKU *</Label>
                <Input
                  id="f-sku"
                  value={form.sku}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, sku: e.target.value.toUpperCase() }))
                  }
                  placeholder="NK-AM-001"
                  className="font-mono"
                />
              </div>

              {/* Category */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="f-category" className="mb-0">Category</Label>
                  <button
                    type="button"
                    onClick={quickCreateCategory}
                    className="text-xs text-accent hover:underline"
                  >
                    + New
                  </button>
                </div>
                <Select
                  id="f-category"
                  value={form.categoryId}
                  onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>

              {/* Brand */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor="f-brand" className="mb-0">Brand</Label>
                  <button
                    type="button"
                    onClick={quickCreateBrand}
                    className="text-xs text-accent hover:underline"
                  >
                    + New
                  </button>
                </div>
                <Select
                  id="f-brand"
                  value={form.brandId}
                  onChange={(e) => setForm((p) => ({ ...p, brandId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="f-supplier">Supplier</Label>
                <Select
                  id="f-supplier"
                  value={form.supplierId}
                  onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}
                >
                  <option value="">— None —</option>
                  {data.suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="f-status">Status</Label>
                <Select
                  id="f-status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, status: e.target.value as "ACTIVE" | "INACTIVE" }))
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </div>
            </FormRow>
            <div className="mt-3">
              <Label htmlFor="f-desc">Description</Label>
              <Textarea
                id="f-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
          </div>

          {/* ── Pricing & Stock ── */}
          <div>
            <SectionHeading>Pricing &amp; Stock</SectionHeading>
            <FormRow>
              <div>
                <Label htmlFor="f-pp">Purchase Price *</Label>
                <Input
                  id="f-pp"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.purchasePrice}
                  onChange={(e) => setForm((p) => ({ ...p, purchasePrice: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="f-sp">Selling Price *</Label>
                <Input
                  id="f-sp"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.sellingPrice}
                  onChange={(e) => setForm((p) => ({ ...p, sellingPrice: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="f-dp">Discount Price</Label>
                <Input
                  id="f-dp"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discountPrice}
                  onChange={(e) => setForm((p) => ({ ...p, discountPrice: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="f-ms">Min Stock Level</Label>
                <Input
                  id="f-ms"
                  type="number"
                  min="0"
                  value={form.minStockLevel}
                  onChange={(e) => setForm((p) => ({ ...p, minStockLevel: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </FormRow>

            {/* Current/Opening Stock */}
            <div className="mt-3">
              <Label htmlFor="f-os">
                {editing ? "Adjust Stock Level" : "Opening Stock"}
              </Label>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    id="f-os"
                    type="number"
                    min="0"
                    value={form.openingStock}
                    onChange={(e) => setForm((p) => ({ ...p, openingStock: e.target.value }))}
                    placeholder="0"
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    {editing ? "Adjust the opening/current stock level" : "Initial stock amount for the product"}
                  </p>
                </div>
                {editing && (
                  <div className="rounded-md border-2 border-accent/30 bg-accent/5 p-3">
                    <div className="text-xs text-text-muted">Variant Total</div>
                    <div className="mt-1 text-xl font-bold text-accent">
                      {form.variants.reduce((sum, v) => sum + (parseInt(v.quantity) || 0), 0)} units
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Variants ── */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <SectionHeading>
                Variants {form.variants.length > 0 && `(${form.variants.length})`}
              </SectionHeading>
              <button
                type="button"
                onClick={addVariant}
                className="text-xs font-medium text-accent hover:underline"
              >
                + Add Variant
              </button>
            </div>

            {form.variants.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-zinc-50 py-5 text-center text-xs text-text-muted">
                No variants added. A default variant will be created automatically.
              </p>
            ) : (
              <div className="space-y-3">
                {form.variants.map((v, idx) => {
                  const isExisting = Boolean(v.id);
                  return (
                    <div key={idx} className="rounded-md border border-border bg-zinc-50/60 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-text-muted">
                          {isExisting ? "Variant" : "New Variant"} #{idx + 1}
                          {isExisting && (
                            <span className="ml-2 font-normal text-text-muted/60">
                              (stock qty: {v.quantity})
                            </span>
                          )}
                        </span>
                        {!isExisting && (
                          <button
                            type="button"
                            onClick={() => removeVariant(idx)}
                            className="text-xs text-danger hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Size</Label>
                          <Input
                            value={v.size}
                            onChange={(e) => setVariantField(idx, "size", e.target.value)}
                            placeholder="42, M, XL…"
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Color</Label>
                          <Input
                            value={v.color}
                            onChange={(e) => setVariantField(idx, "color", e.target.value)}
                            placeholder="Black, Red…"
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">SKU *</Label>
                          <Input
                            value={v.sku}
                            onChange={(e) =>
                              setVariantField(idx, "sku", e.target.value.toUpperCase())
                            }
                            placeholder="SKU-001"
                            className="font-mono text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Buy Price</Label>
                          <Input
                            type="number"
                            value={v.purchasePrice}
                            onChange={(e) => setVariantField(idx, "purchasePrice", e.target.value)}
                            placeholder={form.purchasePrice || "0"}
                            className="text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Sell Price</Label>
                          <Input
                            type="number"
                            value={v.sellingPrice}
                            onChange={(e) => setVariantField(idx, "sellingPrice", e.target.value)}
                            placeholder={form.sellingPrice || "0"}
                            className="text-xs"
                          />
                        </div>
                        {!isExisting && (
                          <div>
                            <Label className="text-xs">Opening Qty</Label>
                            <Input
                              type="number"
                              min="0"
                              value={v.quantity}
                              onChange={(e) => setVariantField(idx, "quantity", e.target.value)}
                              placeholder="0"
                              className="text-xs"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Drawer>
    </>
  );
}
