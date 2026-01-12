export interface Producto {
  id?: string; // ID de Firestore (auto-generado)
  idInterno?: number; // ID incremental (1001, 1002, etc.)
  codigo: string; // Código de armazón (identificador para el trabajador)
  nombre: string;
  modelo?: string; // Modelo del producto
  color?: string; // Color del producto
  grupo?: string; // Grupo en texto (ej: GAFAS, LENTES DE CONTACTO)
  stock?: number;
  costo?: number; // Costo unitario
  pvp1?: number; // Precio de venta público
  iva?: number; // Porcentaje de IVA (ej: 15 para 15%)
  precioConIVA?: number; // Precio final con IVA incluido (usado en ventas)
  proveedor?: string; // Proveedor principal
  ingresoId?: string; // ID del ingreso/factura de donde proviene
  observacion?: string | null;
  
  // Campos opcionales (legacy - mantener para compatibilidad con datos existentes)
  nuevoCodigo?: string;
  genera?: number;
  unidad?: string;
  costos?: {
    caja?: string;
    unidad?: string;
  };
  datos?: {
    dato1?: string;
    dato2?: string;
  };
  precios?: {
    caja?: string;
    pvp1?: string;
    pvp2?: string;
    unidad?: string;
  };
  proveedores?: {
    principal?: string;
    secundario?: string;
    terciario?: string;
  };
  createdAt?: any;
  updatedAt?: any;
}
