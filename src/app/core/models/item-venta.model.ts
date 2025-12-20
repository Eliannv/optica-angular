export interface ItemVenta {
  productoId: string;        // ✅ antes: armazonId
  nombre: string;            // ✅ para imprimir sin re-consultar
  tipo?: string;             // "Marco" | "Luna" | etc
  cantidad: number;
  precioUnitario: number;
  total: number;             // ✅ cantidad * precioUnitario
}
