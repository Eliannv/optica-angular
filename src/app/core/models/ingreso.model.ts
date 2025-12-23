export interface Ingreso {
  id?: string; // ID de Firestore (auto-generado)
  proveedor: string; // Nombre del proveedor
  proveedorId?: string; // ID del proveedor (opcional, si existe en la BD)
  numeroFactura: string; // Número de factura del proveedor
  fecha: Date; // Fecha de la factura
  tipoCompra: 'CONTADO' | 'CREDITO'; // Tipo de compra
  observacion?: string; // Observaciones generales
  total?: number; // Total de la factura (puede calcularse automáticamente)
  estado?: 'BORRADOR' | 'FINALIZADO'; // Estado del ingreso
  createdAt?: any; // Timestamp de creación
  updatedAt?: any; // Timestamp de actualización
}

export interface DetalleIngreso {
  id?: string; // ID temporal (para manejo en UI antes de guardar)
  productoId?: string; // ID del producto (si existe)
  tipo: 'EXISTENTE' | 'NUEVO'; // Tipo de producto
  
  // Datos del producto (para nuevos o referencia)
  nombre: string;
  modelo?: string;
  color?: string;
  grupo?: string;
  codigo?: string; // Código de armazón
  
  // Datos del ingreso
  cantidad: number; // Cantidad comprada
  costoUnitario?: number; // Costo unitario
  observacion?: string; // Observación específica del producto
  
  // Datos completos para productos nuevos
  pvp1?: number; // Precio de venta
  stockInicial?: number; // Stock inicial (igual a cantidad para nuevos)
}
