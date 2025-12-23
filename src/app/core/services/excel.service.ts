import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Producto } from '../models/producto.model';
import { DetalleIngreso } from '../models/ingreso.model';

export interface DatosExcelImportacion {
  proveedor: string;
  numeroFactura: string;
  fecha: Date;
  productos: ProductoExcelPreview[];
}

export interface ProductoExcelPreview {
  // Datos del Excel
  cantidad: number;
  codigo: string;
  nombre: string;
  modelo: string;
  color: string;
  pvp1: number;
  
  // Campos editables por el usuario
  costo?: number;
  grupo?: string;
  observacion?: string;
  
  // Estado
  estado: 'EXISTENTE' | 'NUEVO';
  productoId?: string; // Si existe
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
   * 📤 Exportar productos a Excel
   */
  exportarProductos(productos: Producto[], nombreArchivo: string = 'productos'): void {
    // Preparar datos para exportar
    const datosExport = productos.map(p => ({
      'CÓDIGO': p.codigo || '',
      'NOMBRE': p.nombre || '',
      'MODELO': p.modelo || '',
      'COLOR': p.color || '',
      'GRUPO': p.grupo || '',
      'STOCK': p.stock || 0,
      'COSTO': p.costo ? `$ ${p.costo.toFixed(2)}` : '$ 0.00',
      'PVP': p.pvp1 ? `$ ${p.pvp1.toFixed(2)}` : '$ 0.00',
      'PROVEEDOR': p.proveedor || '',
      'OBSERVACIÓN': p.observacion || ''
    }));

    // Crear hoja de cálculo
    const worksheet = XLSX.utils.json_to_sheet(datosExport);
    
    // Ajustar ancho de columnas
    const columnWidths = [
      { wch: 15 }, // CÓDIGO
      { wch: 30 }, // NOMBRE
      { wch: 25 }, // MODELO
      { wch: 25 }, // COLOR
      { wch: 15 }, // GRUPO
      { wch: 10 }, // STOCK
      { wch: 12 }, // COSTO
      { wch: 12 }, // PVP
      { wch: 20 }, // PROVEEDOR
      { wch: 30 }, // OBSERVACIÓN
    ];
    worksheet['!cols'] = columnWidths;

    // Crear libro
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

    // Generar archivo y descargar
    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `${nombreArchivo}_${fecha}.xlsx`);
  }

  /**
   * 📤 Exportar plantilla vacía para importación
   */
  exportarPlantilla(): void {
    const plantilla = [
      ['', 'OPTICA MACIAS EL GUABO', '', '', '', ''],
      ['', 'PLANTILLA DE PRODUCTOS', '', '', '', ''],
      ['PROVEEDOR', 'NOMBRE_PROVEEDOR', '', 'FACT', '', ''],
      ['ENVIADA', 'DD/MM/YYYY', '', 'FACT/SISTEMA', 'NUM_FACTURA', ''],
      ['', '', '', '', '', ''],
      ['CANT', 'CODIGO', 'PRODUCTO', 'DETALLE VARILLA', 'MATERIA / COLOR', 'V/PUBLICO'],
      [1, '917', 'ACADEMIC', 'AC1031-51-18-146-C4', 'PASTA/AZUL', '$ 30'],
      [2, '918', 'ACADEMIC', 'AC1029-54-18-146-C4', 'PASTA/AZUL', '$ 30'],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(plantilla);
    
    // Aplicar estilos (colores de fondo)
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    
    // Ajustar ancho de columnas
    worksheet['!cols'] = [
      { wch: 8 },  // CANT
      { wch: 12 }, // CODIGO
      { wch: 25 }, // PRODUCTO
      { wch: 30 }, // DETALLE
      { wch: 30 }, // COLOR
      { wch: 12 }, // V/PUBLICO
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PLANTILLA');

    XLSX.writeFile(workbook, 'plantilla_importacion_productos.xlsx');
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
