interface Product {
  name: string;
  price: number;
  stock: number;
}

const products = new Map<string, Product>();

function key(name: string) {
  return name.toLowerCase().trim();
}

export function createProduct(name: string, price: number): string {
  if (products.has(key(name))) {
    return `El producto "${name}" ya existe`;
  }
  products.set(key(name), { name, price, stock: 0 });
  return `Creaste producto "${name}" con un precio de $${price}`;
}

export function addStock(name: string, qty: number): string {
  const product = products.get(key(name));
  if (!product) return `El producto "${name}" no existe`;
  product.stock += qty;
  return `Agregaste ${qty} unidades de "${product.name}"`;
}

export function sellStock(name: string, qty: number): string {
  const product = products.get(key(name));
  if (!product) return `El producto "${name}" no existe`;
  if (product.stock < qty) return `Stock insuficiente de "${product.name}". Stock actual: ${product.stock}`;
  product.stock -= qty;
  return `Vendiste ${qty} unidades de "${product.name}"`;
}

export function getReport(): string {
  if (products.size === 0) return "No tienes productos registrados";
  const lines = Array.from(products.values())
    .map((p) => `- ${p.name}: ${p.stock} unidades`)
    .join("\n");
  return `Tienes:\n${lines}`;
}
