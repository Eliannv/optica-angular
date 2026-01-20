export interface Ingreso {
  id?: string; // ID de Firestore (auto-generado)
  idPersonalizado?: string; // ID secuencial de 10 dígitos (0000000001, etc)
  proveedor: string; // Nombre del proveedor
  proveedorId?: string; // ID del proveedor (opcional, si existe en la BD)
  numeroFactura: string; // Número de factura del proveedor
  fecha: Date; // Fecha de la factura
  tipoCompra: 'CONTADO' | 'CREDITO'; // Tipo de compra
  observacion?: string; // Observaciones generales
  descuento?: number; // Descuento aplicado a la factura
  flete?: number; // Costo de flete
  iva?: number; // Monto de IVA de la factura
  total?: number; // Total de la factura (subtotal + flete + IVA - descuento)
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
  codigo?: string; // Código de armazón / ID interno del sistema
  idInterno?: number; // ID interno incremental (para nuevos productos)
  
  // Datos del ingreso
  cantidad: number; // Cantidad comprada
  costoUnitario?: number; // Costo unitario
  observacion?: string; // Observación específica del producto
  
  // Datos completos para productos nuevos
  pvp1?: number; // Precio de venta
  iva?: number; // Porcentaje de IVA del producto (ej: 15 para 15%)
  stockInicial?: number; // Stock inicial (igual a cantidad para nuevos)
  
  // 🔹 NUEVO: Para productos desactivados que se reactivan
  estaDesactivado?: boolean; // Si el producto estaba desactivado
  stockActivoAnterior?: number; // Stock anterior que debe sumarse
}
