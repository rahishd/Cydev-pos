"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useState } from "react";
import { createStockMovement } from "@/app/(dashboard)/inventory/actions";
import { useSettings } from "@/components/providers/SettingsProvider";

/** Adding stock is always a manual adjustment; the other reasons only take stock away. */
const MOVEMENT_TYPES = [
  { value: "ADJUSTMENT", label: "Manual Adjustment" },
  { value: "DAMAGE", label: "Damage" },
  { value: "LOSS", label: "Loss" },
  { value: "SUPPLIER_RETURN", label: "Supplier Return" },
];

export function StockAdjustmentModal({
  isOpen,
  onClose,
  variantId,
  variantName,
  currentStock,
  onSuccess,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  variantId?: string;
  variantName?: string;
  currentStock?: number;
  onSuccess: () => void;
  userId?: string;
}) {
  const needsReason = Boolean(useSettings().inventory.requireAdjustmentReason);
  const [quantity, setQuantity] = useState("");
  const [type, setType] = useState("ADJUSTMENT");
  const [notes, setNotes] = useState("");
  const [isAdjustment, setIsAdjustment] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantId || !userId) return;
    if (needsReason && !notes.trim()) {
      setError("Please type a reason in the notes box (your Settings require one for every stock adjustment).");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const qty = isAdjustment ? -parseInt(quantity) : parseInt(quantity);
      await createStockMovement(variantId, type, qty, notes, userId);
      onSuccess();
      onClose();
      setQuantity("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Stock"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Product Info */}
        <div className="rounded-lg bg-zinc-50 p-3">
          <div className="text-sm font-medium text-text">{variantName}</div>
          <div className="text-xs text-text-muted">Current Stock: {currentStock}</div>
        </div>

        {/* Adjustment Type */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Adjustment Type</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsAdjustment(true)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isAdjustment
                  ? "bg-accent text-white"
                  : "border border-border text-text hover:bg-zinc-50"
              }`}
            >
              Decrease (−)
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdjustment(false);
                setType("ADJUSTMENT");
              }}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                !isAdjustment
                  ? "bg-accent text-white"
                  : "border border-border text-text hover:bg-zinc-50"
              }`}
            >
              Increase (+)
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Quantity</label>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            required
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">Reason</label>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {MOVEMENT_TYPES.filter((t) => isAdjustment || t.value === "ADJUSTMENT").map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">{needsReason ? "Notes (required)" : "Notes (Optional)"}</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={needsReason ? "Why is the stock being changed?" : "Add any additional notes..."}
            rows={3}
          />
        </div>

        {/* Error */}
        {error && <div className="text-sm text-danger">{error}</div>}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={loading || !quantity} className="flex-1">
            {loading ? "Saving..." : "Save Adjustment"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
