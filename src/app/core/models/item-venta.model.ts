export interface ItemVenta {
  productoId: string;      // ✅ antes: armazonId
  nombre: string;          // ✅ para imprimir
  tipo?: string;           // ✅ marco / luna / etc (opcional)
  cantidad: number;
  precioUnitario: number;
  total: number;           // ✅ cantidad * precioUnitario
}
