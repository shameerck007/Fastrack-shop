"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "@/lib/actions/admin-products";
import ImageUploader from "@/components/ImageUploader";
import type { Category, Warehouse } from "@/types/database";

const UNITS = ["unit", "kg", "g", "L", "ml", "pack"];

export default function NewProductForm({
  categories,
  warehouses,
}: {
  categories: Category[];
  warehouses: Warehouse[];
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [variantLabel, setVariantLabel] = useState("1 unit");
  const [unit, setUnit] = useState("unit");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [stock, setStock] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name || !price || !stock || !categoryId || !warehouses[0]) {
      setError("Fill in all required fields.");
      return;
    }
    startTransition(async () => {
      try {
        await createProduct({
          categoryId,
          name,
          brand: brand || undefined,
          sku: sku || undefined,
          description: description || undefined,
          imageUrl: imageUrl || undefined,
          price: Number(price),
          compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
          variantLabel,
          unit,
          quantity: Number(quantity) || 1,
          stock: Number(stock),
          warehouseId: warehouses[0].id,
        });
        setImageUrl(null);
        setName("");
        setBrand("");
        setSku("");
        setDescription("");
        setPrice("");
        setCompareAtPrice("");
        setStock("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create product.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <ImageUploader value={imageUrl} onChange={setImageUrl} />

      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="SKU (optional)"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input
          placeholder="Variant label (e.g. 1 kg)"
          value={variantLabel}
          onChange={(e) => setVariantLabel(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          type="number"
          step="0.001"
          placeholder="Qty per unit"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.001"
          placeholder="Initial stock"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          step="0.01"
          placeholder="Price (SAR)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Compare-at price (optional)"
          value={compareAtPrice}
          onChange={(e) => setCompareAtPrice(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-blue-700 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add product"}
      </button>
    </form>
  );
}
