import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Producto } from '../models/producto.model';
import { DetalleIngreso } from '../models/ingreso.model';

export interface DatosExcelImportacion {
  proveedor: string;
  numeroFactura: string;
  fecha: Date;
  productos: ProductoExcelPreview[];
  descuento?: number; // Descuento aplicado a la factura
  flete?: number; // Costo de envío/transporte
  iva?: number; // Monto total de IVA de la factura
}

export interface ProductoExcelPreview {
  // Datos del Excel
  cantidad: number;
  codigo: string; // CODIGO SIST (idInterno)
  nombre: string;
  modelo: string;
  color: string;
  pvp1: number;
  iva?: number; // Porcentaje de IVA editable (ej: 15)
  
  // Campos editables por el usuario
  costo?: number;
  grupo?: string;
  observacion?: string;
  
  // Estado
  estado: 'EXISTENTE' | 'NUEVO';
  productoId?: string; // Si existe  
  // Campos para productos existentes (cuando se reemplaza)
  stockAnterior?: number; // Stock anterior del producto
  proveedorAnterior?: string; // Proveedor anterior del producto
  pvp1Anterior?: number; // PVP1 anterior del producto
  idInterno?: number; // ID interno del producto existente
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {

  constructor() { }

  /**
   * 📥 Importar productos desde Excel
   * Lee el archivo y retorna datos estructurados para preview
   */
  async importarProductos(file: File): Promise<DatosExcelImportacion> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          
          // Leer la primera hoja
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          
          // Leer la fecha directamente de la celda C4
          const celdaFecha = firstSheet['C4'];
          let fechaRaw: any = '';
          
          if (celdaFecha) {
            // Si es una celda de tipo fecha (tipo 'd'), usar directamente el valor
            if (celdaFecha.t === 'd') {
              fechaRaw = celdaFecha.v; // Es un objeto Date
            } else if (celdaFecha.t === 'n') {
              // Si es numérico, es serial de Excel
              fechaRaw = celdaFecha.v;
            } else {
              // Si es texto, usar el texto formateado
              fechaRaw = celdaFecha.w || celdaFecha.v || '';
            }
          }
          
          console.log('📅 Celda C4:', celdaFecha);
          console.log('📅 Fecha extraída:', fechaRaw, typeof fechaRaw);
          const fecha = this.parsearFecha(fechaRaw);
          console.log('📅 Fecha final:', fecha);
          
          const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet, { 
            header: 1,
            raw: false,
            defval: ''
          });

          // Parsear datos del encabezado
          const proveedor = this.extraerValor(jsonData, 2, 2) || ''; // C3
          const numeroFactura = this.extraerValor(jsonData, 3, 4) || ''; // E4

          // Parsear productos (a partir de la fila 6, índice 5)
          const productos: ProductoExcelPreview[] = [];
          
          for (let i = 5; i < jsonData.length; i++) {
            const fila = jsonData[i];
            
            // Verificar que la fila tenga datos
            if (!fila || fila.length === 0) continue;
            
            const cantidad = this.parsearNumero(fila[0]); // A
            const codigo = (fila[1] || '').toString().trim(); // B
            const nombre = (fila[2] || '').toString().trim(); // C
            const modelo = (fila[3] || '').toString().trim(); // D
            const color = (fila[4] || '').toString().trim(); // E
            const pvp1Str = (fila[5] || '').toString().replace('$', '').trim(); // F
            const pvp1 = this.parsearNumero(pvp1Str);
            
            // Validar que al menos tenga nombre o código
            if (!nombre && !codigo) continue;
            
            productos.push({
              cantidad,
              codigo,
              nombre,
              modelo,
              color,
              pvp1,
              iva: 0,
              estado: 'NUEVO', // Se determinará después al verificar contra BD
              costo: 0,
              grupo: 'GAFAS', // Valor por defecto
              observacion: ''
            });
          }

          resolve({
            proveedor,
            numeroFactura,
            fecha,
            productos
          });
          
        } catch (error) {
          reject(new Error('Error al procesar el archivo Excel: ' + error));
        }
      };
      
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 📤 Exportar productos a Excel (sin grupo ni costo)
   */
  exportarProductos(productos: Producto[], nombreArchivo: string = 'productos'): void {
    // Preparar datos para exportar (sin GRUPO ni COSTO)
    const datosExport = productos.map(p => ({
      'CANTIDAD': p.stock || 0, // Stock del producto
      'CÓDIGO SIST': p.idInterno || '', // ID interno (código sistema)
      'PRODUCTO': p.nombre || '',
      'DETALLE VARILLA': p.modelo || '',
      'MATERIA / COLOR': p.color || '',
      'V/PUBLICO': p.pvp1 ? `$ ${p.pvp1.toFixed(2)}` : '$ 0.00'
    }));

    // Crear hoja de cálculo
    const worksheet = XLSX.utils.json_to_sheet(datosExport);
    
    // Ajustar ancho de columnas
    const columnWidths = [
      { wch: 10 }, // CANTIDAD
      { wch: 12 }, // CÓDIGO SIST
      { wch: 25 }, // PRODUCTO
      { wch: 30 }, // DETALLE VARILLA
      { wch: 30 }, // MATERIA / COLOR
      { wch: 12 }, // V/PUBLICO
    ];
    worksheet['!cols'] = columnWidths;

    // Crear libro
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'EXPORTACIÓN');

    // Generar archivo y descargar con nombre personalizado
    XLSX.writeFile(workbook, `${nombreArchivo}.xlsx`);
  }

  /**
   * 📤 Exportar plantilla vacía para importación
   * Descarga el archivo plantilla_importacion_productos.xlsx
   * Usa IPC en Electron, fetch en web
   */
  async exportarPlantilla(): Promise<void> {
    try {
      let blob: Blob | null = null;

      // Intentar usar IPC si estamos en Electron
      if ((window as any).electronAPI?.descargarPlantilla) {
        console.log('📦 Usando IPC de Electron para descargar plantilla');
        try {
          const resultado = await (window as any).electronAPI.descargarPlantilla();
          
          if (resultado.success && resultado.data) {
            // Convertir base64 a blob
            const binaryString = atob(resultado.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            blob = new Blob([bytes], { 
              type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            console.log(`✅ Archivo obtenido vía IPC (${blob.size} bytes)`);
          } else {
            console.log('❌ IPC retornó error:', resultado.error);
          }
        } catch (ipcError) {
          console.log('❌ Error usando IPC:', ipcError);
        }
      }

      // Si no se obtuvo vía IPC, intentar fetch con múltiples rutas
      if (!blob || blob.size === 0) {
        console.log('📡 Intentando fetch desde web');
        
        const rutasIntento = [
          '/plantilla_importacion_productos.xlsx',           // Ruta absoluta (dev)
          './plantilla_importacion_productos.xlsx',         // Ruta relativa (Electron empaquetado)
          '../plantilla_importacion_productos.xlsx',        // Ruta relativa (backup)
        ];
        
        let ultimoError: Error | null = null;
        
        // Intentar cada ruta
        for (const ruta of rutasIntento) {
          try {
            console.log(`🔍 Intentando descargar desde: ${ruta}`);
            const response = await fetch(ruta, { 
              method: 'GET',
              cache: 'no-cache' 
            });
            
            if (response.ok) {
              blob = await response.blob();
              
              // Validar que es un archivo válido
              if (blob.size > 0) {
                console.log(`✅ Archivo descargado correctamente desde: ${ruta} (${blob.size} bytes)`);
                break;
              }
            }
          } catch (error) {
            ultimoError = error as Error;
            console.log(`❌ Error intentando ${ruta}:`, ultimoError.message);
            continue;
          }
        }
        
        // Si no se encontró en ninguna ruta
        if (!blob || blob.size === 0) {
          throw new Error(`No se pudo descargar la plantilla desde ninguna ruta. Último error: ${ultimoError?.message || 'Desconocido'}`);
        }
      }

      // Crear link de descarga con el blob
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'plantilla_importacion_productos.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Liberar la memoria del URL
      URL.revokeObjectURL(link.href);
      
      console.log('✅ Plantilla descargada exitosamente');
    } catch (error) {
      console.error('Error al descargar plantilla:', error);
      throw new Error('No se pudo descargar la plantilla. Verifica que el archivo existe.');
    }
  }

  /**
   * 🔧 Utilidades privadas
   */
  private extraerValor(data: any[], fila: number, columna: number): string {
    if (data[fila] && data[fila][columna]) {
      return data[fila][columna].toString().trim();
    }
    return '';
  }

  private parsearNumero(valor: any): number {
    if (typeof valor === 'number') return valor;
    if (typeof valor === 'string') {
      const limpio = valor.replace(/[^0-9.-]/g, '');
      const numero = parseFloat(limpio);
      return isNaN(numero) ? 0 : numero;
    }
    return 0;
  }

  private parsearFecha(fechaRaw: any): Date {
    // Si no hay valor, retornar fecha actual
    if (!fechaRaw) {
      console.warn('⚠️ No hay fecha, usando fecha actual');
      return new Date();
    }

    // Si ya es un objeto Date, retornarlo directamente
    if (fechaRaw instanceof Date) {
      console.log('✅ Fecha ya es objeto Date:', fechaRaw);
      return fechaRaw;
    }

    // Si es un número, es la fecha serial de Excel (días desde 1/1/1900)
    if (typeof fechaRaw === 'number') {
      // Excel serial date: días desde 1899-12-30
      const excelEpoch = new Date(1899, 11, 30);
      const fecha = new Date(excelEpoch.getTime() + fechaRaw * 24 * 60 * 60 * 1000);
      console.log('✅ Fecha parseada desde serial Excel:', fecha);
      return fecha;
    }

    // Si es un string, intentar parsear DD/MM/YYYY o DD-MM-YYYY
    const fechaStr = fechaRaw.toString().trim();
    
    if (!fechaStr) {
      console.warn('⚠️ String vacío, usando fecha actual');
      return new Date();
    }

    // Intentar parsear DD/MM/YYYY o DD-MM-YYYY
    const separadores = ['/', '-'];
    for (const sep of separadores) {
      const partes = fechaStr.split(sep);
      if (partes.length === 3) {
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1; // Mes es 0-indexed
        const anio = parseInt(partes[2], 10);
        
        if (!isNaN(dia) && !isNaN(mes) && !isNaN(anio)) {
          const fecha = new Date(anio, mes, dia);
          console.log('✅ Fecha parseada desde string:', fecha);
          return fecha;
        }
      }
    }
    
    // Fallback: fecha actual
    console.warn('⚠️ No se pudo parsear la fecha, usando fecha actual');
    return new Date();
  }
}
