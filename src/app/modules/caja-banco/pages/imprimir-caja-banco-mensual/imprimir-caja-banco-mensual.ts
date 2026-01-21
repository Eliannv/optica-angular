import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-imprimir-caja-banco-mensual',
  standalone: false,
  templateUrl: './imprimir-caja-banco-mensual.html',
  styleUrls: ['./imprimir-caja-banco-mensual.css']
})
export class ImprimirCajaBancoMensualComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cajaBancoService = inject(CajaBancoService);
  private cajaChicaService = inject(CajaChicaService);

  year = 0;
  month = 0; // 1-12 for display

  cajasBanco: CajaBanco[] = [];
  movimientos: MovimientoCajaBanco[] = [];
  cajasChicas: CajaChica[] = [];
  datoCargado = false;

  resumen = {
    total_ingresos: 0,
    total_egresos: 0,
    ingresos_cajas_chicas: 0,
    ingresos_otros: 0,
    saldo_final: 0,
    cantidad_movimientos: 0,
  };

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.year = Number(params['year']);
      this.month = Number(params['month']);
      const m0 = this.month - 1;
      if (isNaN(this.year) || isNaN(m0)) return;
      
      // Usar combineLatest para esperar a que TODOS los observables completen
      combineLatest([
        this.cajaBancoService.getCajasBancoPorMes(this.year, m0),
        this.cajaBancoService.getMovimientosCajaBancoPorMes(this.year, m0),
        this.cajaChicaService.getCajasChicasPorMes(this.year, m0)
      ]).subscribe(([cajas, movs, cc]) => {
        this.cajasBanco = cajas || [];
        this.movimientos = movs || [];
        this.cajasChicas = (cc || []).filter(c => c.estado === 'CERRADA');
        this.calcularResumen();
        this.datoCargado = true;
        // Ahora que tenemos todos los datos, esperamos 500ms para que Angular renderice el DOM y luego imprimimos
        setTimeout(() => this.imprimir(), 500);
      });
    });
  }

  calcularResumen(): void {
    let ingresosCajasChicas = 0;
    let ingresosOtros = 0;
    let egresos = 0;
    
    // 1. Sumar ingresos de cajas chicas CERRADAS
    (this.cajasChicas || []).forEach(cc => {
      ingresosCajasChicas += cc.monto_actual || 0;
    });
    
    // 2. Sumar movimientos de ingresos/egresos
    (this.movimientos || []).forEach(m => {
      if (m.tipo === 'INGRESO') {
        ingresosOtros += m.monto || 0;
      } else if (m.tipo === 'EGRESO') {
        egresos += m.monto || 0;
      }
    });
    
    this.resumen.ingresos_cajas_chicas = ingresosCajasChicas;
    this.resumen.ingresos_otros = ingresosOtros;
    this.resumen.total_ingresos = ingresosCajasChicas + ingresosOtros;
    this.resumen.total_egresos = egresos;
    this.resumen.cantidad_movimientos = (this.movimientos || []).length;
    
    // 3. Calcular saldo final basado en saldo inicial de cajas banco + ingresos - egresos
    let saldoInicial = 0;
    (this.cajasBanco || []).forEach(cb => {
      saldoInicial += cb.saldo_inicial || 0;
    });
    this.resumen.saldo_final = saldoInicial + this.resumen.total_ingresos - this.resumen.total_egresos;
  }

  dateFrom(value: any): Date {
    if (!value) return new Date();
    if (typeof (value as any).toDate === 'function') {
      return (value as any).toDate();
    }
    if (value instanceof Date) return value;
    return new Date(value);
  }

  imprimir(): void { window.print(); }
  volver(): void { this.router.navigate(['/caja-banco']); }
}
