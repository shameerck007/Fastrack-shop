"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct } from "@/lib/actions/admin-products";
import type { Category, Warehouse } from "@/types/database";

export default function NewProductForm({
  categories,
  warehouses,
}: {
  categories: Category[];
  warehouses: Warehouse[];
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [variantLabel, setVariantLabel] = useState("1 unit");
  const [price, setPrice] = useState("");
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
          price: Number(price),
          variantLabel,
          stock: Number(stock),
          warehouseId: warehouses[0].id,
        });
        setName("");
        setBrand("");
        setPrice("");
        setStock("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create product.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-200 bg-white p-4">
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
        placeholder="Variant label (e.g. 1 kg)"
        value={variantLabel}
        onChange={(e) => setVariantLabel(e.target.value)}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
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
        step="0.001"
        placeholder="Initial stock"
        value={stock}
        onChange={(e) => setStock(e.target.value)}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="col-span-2 rounded-full bg-blue-700 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add product"}
      </button>
    </form>
  );
}
