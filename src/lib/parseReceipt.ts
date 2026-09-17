export type ParsedReceiptRow = {
  name: string;
  qty: string | null;
  price: number | null;
  storeName: string | null;
  category: string | null;
};

// Expects lines of "name, qty, price, store" or "name, qty, price, store,
// category" (everything but name is optional). If a name itself contains
// commas, the trailing qty/price/store/category fields are still read off
// the end and everything before them is rejoined into the name.
export function parseReceiptText(text: string): ParsedReceiptRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: ParsedReceiptRow[] = [];

  for (const line of lines) {
    const parts = line.split(",").map((p) => p.trim());

    let name: string;
    let qtyRaw: string;
    let priceRaw: string;
    let storeRaw: string;
    let categoryRaw: string;

    if (parts.length >= 5) {
      categoryRaw = parts[parts.length - 1];
      storeRaw = parts[parts.length - 2];
      priceRaw = parts[parts.length - 3];
      qtyRaw = parts[parts.length - 4];
      name = parts.slice(0, parts.length - 4).join(", ");
    } else if (parts.length === 4) {
      [name, qtyRaw, priceRaw, storeRaw] = parts;
      categoryRaw = "";
    } else if (parts.length === 3) {
      [name, qtyRaw, priceRaw] = parts;
      storeRaw = "";
      categoryRaw = "";
    } else if (parts.length === 2) {
      [name, priceRaw] = parts;
      qtyRaw = "";
      storeRaw = "";
      categoryRaw = "";
    } else {
      name = parts[0];
      qtyRaw = "";
      priceRaw = "";
      storeRaw = "";
      categoryRaw = "";
    }

    if (!name || /^(item )?names?$/i.test(name)) continue;

    const priceNum = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, "")) : NaN;

    rows.push({
      name,
      qty: qtyRaw || null,
      price: Number.isFinite(priceNum) ? priceNum : null,
      storeName: storeRaw || null,
      category: categoryRaw || null,
    });
  }

  return rows;
}
