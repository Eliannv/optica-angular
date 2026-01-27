/**
 * Servicio unificado para operaciones con archivos Excel usando ExcelJS.
 * 
 * === FUNCIONALIDADES ===
 * 1. PRODUCTOS: Importación y exportación de productos y plantillas de ingresos
 * 2. HISTORIAL CLÍNICO: Exportación de pedidos manteniendo formato original
 * 
 * === LIBRERÍA UTILIZADA ===
 * - ExcelJS: Librería unificada para todas las operaciones Excel
 *   Preserva formato original, ofrece APIs completas para lectura/escritura
 *   y mejor compatibilidad TypeScript que XLSX
 * 
 * === PRODUCTOS ===
 * Especializado en la importación de ingresos de productos desde plantillas Excel estandarizadas,
 * parseando automáticamente encabezados, productos y datos fiscales.
 * El formato de Excel esperado sigue una estructura específica documentada en el sistema,
 * con encabezados en filas fijas y productos a partir de la fila 6.
 *
 * Forma parte del módulo de inventario y se integra con el servicio de ingresos.
 */
import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { Producto } from '../models/producto.model';
import { DetalleIngreso } from '../models/ingreso.model';
import { HistoriaClinica } from '../models/historia-clinica.model';
import { Cliente } from '../models/cliente.model';

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
  estaDesactivado?: boolean; // Si el producto estaba desactivado, se debe reactivar
  stockActivoAnterior?: number; // Stock del producto desactivado que se va a sumar
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {

  constructor() { }

  /**
   * Importar productos desde Excel usando ExcelJS
   * Lee el archivo y retorna datos estructurados para preview
   */
  async importarProductos(file: File): Promise<DatosExcelImportacion> {
    try {
      console.log('📂 Iniciando importación de productos con ExcelJS...');
      
      const data = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(data);
      
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new Error('No se encontró la primera hoja de trabajo');
      }
      
      console.log('🗂️ Leyendo datos de la hoja:', worksheet.name);
      
      // Leer la fecha de la celda C4
      const celdaFecha = worksheet.getCell('C4');
      let fechaRaw: any = '';
      
      if (celdaFecha.value) {
        fechaRaw = celdaFecha.value;
      }
      
      console.log('📅 Celda C4:', celdaFecha.value);
      console.log('📅 Fecha extraída:', fechaRaw, typeof fechaRaw);
      const fecha = this.parsearFecha(fechaRaw);
      console.log('📅 Fecha final:', fecha);
      
      // Convertir worksheet a array de arrays para mantener compatibilidad
      const jsonData: string[][] = [];
      worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
        const rowData: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          // Convertir el valor de la celda a string
          const cellValue = cell.value;
          if (cellValue === null || cellValue === undefined) {
            rowData[colNumber - 1] = '';
          } else if (cellValue instanceof Date) {
            rowData[colNumber - 1] = cellValue.toLocaleDateString('es-ES');
          } else {
            rowData[colNumber - 1] = cellValue.toString();
          }
        });
        jsonData.push(rowData);
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
        const costoStr = (fila[5] || '').toString().replace('$', '').trim(); // F
        const costo = this.parsearNumero(costoStr);
        const pvp1Str = (fila[6] || '').toString().replace('$', '').trim(); // G (antes era F)
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
          costo: costo, // Ahora lee el costo del Excel
          grupo: 'GAFAS', // Valor por defecto
          observacion: ''
        });
      }

      return {
        proveedor,
        numeroFactura,
        fecha,
        productos
      };
      
    } catch (error) {
      console.error('❌ Error al procesar archivo Excel:', error);
      throw new Error('Error al procesar el archivo Excel: ' + error);
    }
  }

  // =====================================================================
  // MÉTODOS PARA PRODUCTOS - IMPORTACIÓN/EXPORTACIÓN CON EXCELJS
  // =====================================================================

  /**
   * Exporta una lista de productos a un archivo Excel usando ExcelJS.
   */
  async exportarProductos(productos: Producto[], nombreArchivo: string = 'productos'): Promise<void> {
    try {
      console.log('📦 Iniciando exportación de productos con ExcelJS...');

      // Crear nuevo workbook con ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('PRODUCTOS');

      // Configurar encabezados
      const headers = ['CANTIDAD', 'CÓDIGO SIST', 'PRODUCTO', 'DETALLE VARILLA', 'MATERIA / COLOR', 'COSTO', 'V/PUBLICO'];
      worksheet.addRow(headers);

      // Configurar estilo de encabezados
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Agregar datos de productos
      productos.forEach(producto => {
        worksheet.addRow([
          producto.stock || 0,
          producto.idInterno || '',
          producto.nombre || '',
          producto.modelo || '',
          producto.color || '',
          producto.costo ? `$ ${producto.costo.toFixed(2)}` : '$ 0.00',
          producto.pvp1 ? `$ ${producto.pvp1.toFixed(2)}` : '$ 0.00'
        ]);
      });

      // Configurar ancho de columnas
      worksheet.getColumn(1).width = 12; // CANTIDAD
      worksheet.getColumn(2).width = 15; // CÓDIGO SIST
      worksheet.getColumn(3).width = 30; // PRODUCTO
      worksheet.getColumn(4).width = 30; // DETALLE VARILLA
      worksheet.getColumn(5).width = 30; // MATERIA / COLOR
      worksheet.getColumn(6).width = 15; // COSTO
      worksheet.getColumn(7).width = 15; // V/PUBLICO

      // Generar y descargar archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${nombreArchivo}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      console.log('✅ Productos exportados exitosamente con ExcelJS');

    } catch (error) {
      console.error('❌ Error al exportar productos:', error);
      throw error;
    }
  }

  /**
   * Exportar plantilla vacía para importación
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
   * Utilidades privadas
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

  // =====================================================================
  // MÉTODOS PARA HISTORIAL CLÍNICO - EXPORTACIÓN DE PEDIDOS A EXCEL
  // =====================================================================

  /**
   * Exporta el historial clínico como pedido de Excel preservando formato original.
   * Utiliza ExcelJS para mantener todos los estilos, bordes y formatos de la plantilla.
   * 
   * @param cliente Información del cliente
   * @param historial Historial clínico con los datos a llenar
   */
  async exportarHistorialClinicoPedido(cliente: Cliente, historial: HistoriaClinica): Promise<void> {
    try {
      console.log('🚀 Iniciando exportación de historial clínico con ExcelJS...');
      
      // Cargar la plantilla original como ArrayBuffer
      const templateBuffer = await this.cargarPlantillaPedidoComoBuffer();
      
      // Crear workbook de ExcelJS desde el buffer
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(templateBuffer);
      
      // Obtener la primera hoja
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        throw new Error('No se encontró la hoja de trabajo en la plantilla');
      }
      
      console.log('✅ Plantilla de pedido cargada con ExcelJS');
      
      // Llenar los datos preservando formato
      this.llenarDatosHistorialClinico(worksheet, cliente, historial);
      
      // Generar el nombre del archivo
      const fecha = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).replace(/\//g, '-');
      
      const nombreCliente = this.limpiarNombreArchivoPedido(
        `${cliente.nombres} ${cliente.apellidos}`.trim()
      );
      
      const fileName = `pedido_${nombreCliente}_${fecha}.xlsx`;
      
      // Exportar con ExcelJS (preserva formato original)
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Descargar el archivo
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      console.log('✅ Pedido de historial clínico generado exitosamente');
      
    } catch (error) {
      console.error('❌ Error al exportar pedido de historial clínico:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al generar el archivo Excel: ${errorMessage}`);
    }
  }

  /**
   * Descarga la plantilla original de pedido sin modificar.
   * Utiliza fetch directo para preservar completamente el formato original.
   */
  async descargarPlantillaPedido(): Promise<void> {
    try {
      console.log('🔽 Iniciando descarga de plantilla de pedido original...');
      
      let blob: Blob | null = null;
      
      // Descargar archivo original vía fetch (preserva formato original)
      const rutasIntento = [
        '/formato_pedidos_michael.xlsx',           // Ruta absoluta desde public (dev)
        './formato_pedidos_michael.xlsx',         // Ruta relativa (Electron empaquetado)
        '../formato_pedidos_michael.xlsx',        // Ruta relativa (backup)
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

      // Crear link de descarga con el blob (preserva formato original)
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'formato_pedidos_michael.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Liberar la memoria del URL
      URL.revokeObjectURL(link.href);
      
      console.log('✅ Plantilla de pedido descargada exitosamente');
      
    } catch (error) {
      console.error('❌ Error al descargar plantilla de pedido:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`Error al descargar la plantilla: ${errorMessage}`);
    }
  }

  /**
   * Carga la plantilla de pedido como ArrayBuffer para ExcelJS.
   */
  private async cargarPlantillaPedidoComoBuffer(): Promise<ArrayBuffer> {
    const rutasIntento = [
      '/formato_pedidos_michael.xlsx',           // Ruta absoluta desde public (dev)
      './formato_pedidos_michael.xlsx',         // Ruta relativa (Electron empaquetado)
      '../formato_pedidos_michael.xlsx',        // Ruta relativa (backup)
    ];
    
    let ultimoError: Error | null = null;
    
    for (const ruta of rutasIntento) {
      try {
        console.log(`🔍 Cargando plantilla desde: ${ruta}`);
        const response = await fetch(ruta, { 
          method: 'GET',
          cache: 'no-cache' 
        });
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          
          if (arrayBuffer.byteLength > 0) {
            console.log(`✅ Plantilla cargada desde: ${ruta} (${arrayBuffer.byteLength} bytes)`);
            return arrayBuffer;
          }
        }
      } catch (error) {
        ultimoError = error as Error;
        console.log(`❌ Error cargando desde ${ruta}:`, ultimoError.message);
        continue;
      }
    }
    
    throw new Error(`No se pudo cargar la plantilla. Último error: ${ultimoError?.message || 'Desconocido'}`);
  }

  /**
   * Llena las celdas específicas del pedido usando ExcelJS preservando formato.
   */
  private llenarDatosHistorialClinico(worksheet: ExcelJS.Worksheet, cliente: Cliente, historial: HistoriaClinica): void {
    console.log('🎨 Llenando datos de historial clínico con ExcelJS...');
    
    // Fecha actual en D1
    const fechaActual = new Date().toLocaleDateString('es-ES');
    worksheet.getCell('D1').value = fechaActual;

    // OD - Ojo Derecho
    if (historial.odEsfera !== null && historial.odEsfera !== undefined) {
      worksheet.getCell('C3').value = historial.odEsfera;
    }

    if (historial.odCilindro !== null && historial.odCilindro !== undefined) {
      worksheet.getCell('D3').value = historial.odCilindro;
    }

    if (historial.odEje !== null && historial.odEje !== undefined) {
      worksheet.getCell('E3').value = historial.odEje;
    }

    // OI - Ojo Izquierdo
    if (historial.oiEsfera !== null && historial.oiEsfera !== undefined) {
      worksheet.getCell('C4').value = historial.oiEsfera;
    }

    if (historial.oiCilindro !== null && historial.oiCilindro !== undefined) {
      worksheet.getCell('D4').value = historial.oiCilindro;
    }

    if (historial.oiEje !== null && historial.oiEje !== undefined) {
      worksheet.getCell('E4').value = historial.oiEje;
    }

    // ADD en C5
    if (historial.add !== null && historial.add !== undefined) {
      worksheet.getCell('C5').value = historial.add;
    }

    // DP en H3
    if (historial.dp !== null && historial.dp !== undefined) {
      worksheet.getCell('H3').value = historial.dp;
    }

    // ALT (Altura) en H4
    if (historial.altura !== null && historial.altura !== undefined) {
      worksheet.getCell('H4').value = historial.altura;
    }

    // Medidas del armazón
    // H (Ancho del aro) en J2
    if (historial.armazonH !== null && historial.armazonH !== undefined) {
      worksheet.getCell('J2').value = historial.armazonH;
    }

    // V (Alto del aro) en J3
    if (historial.armazonV !== null && historial.armazonV !== undefined) {
      worksheet.getCell('J3').value = historial.armazonV;
    }

    // DM en J4
    if (historial.armazonDM !== null && historial.armazonDM !== undefined) {
      worksheet.getCell('J4').value = historial.armazonDM;
    }

    // P (Puente) en J5
    if (historial.armazonP !== null && historial.armazonP !== undefined) {
      worksheet.getCell('J5').value = historial.armazonP;
    }

    // DE (tipo de lente) en C6
    if (historial.de) {
      worksheet.getCell('C6').value = historial.de;
    }

    // Tipo de Armazón en L3
    if (historial.armazonTipo) {
      worksheet.getCell('L3').value = historial.armazonTipo;
    }

    // Nombre del cliente en Q4
    const nombreCompleto = `${cliente.nombres} ${cliente.apellidos}`.trim();
    if (nombreCompleto) {
      worksheet.getCell('Q4').value = nombreCompleto;
    }

    console.log('✅ Datos de historial clínico llenados exitosamente');
  }

  /**
   * Limpia el nombre del cliente para usarlo como nombre de archivo de pedido.
   */
  private limpiarNombreArchivoPedido(nombre: string): string {
    return nombre
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
