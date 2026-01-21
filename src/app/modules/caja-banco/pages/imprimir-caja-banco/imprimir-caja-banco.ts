import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';
import { combineLatest } from 'rxjs';

@Component({
  selector: 'app-imprimir-caja-banco',
  standalone: false,
  templateUrl: './imprimir-caja-banco.html',
  styleUrls: ['./imprimir-caja-banco.css']
})
export class ImprimirCajaBancoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cajaBancoService = inject(CajaBancoService);
  private cajaChicaService = inject(CajaChicaService);
  private cdr = inject(ChangeDetectorRef);

  caja: CajaBanco | null = null;
  cajasChicas: CajaChica[] = [];
  movimientos: MovimientoCajaBanco[] = [];
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
    this.route.params.subscribe((params) => {
      const id = params['id'];
      if (!id) return;

      // Primero obtener la caja banco
      this.cajaBancoService.getCajaBancoById(id).subscribe(c => {
        this.caja = c;
        // Asociar movimientos antiguos y luego cargar ambas fuentes en conjunto
        this.cajaBancoService.asociarMovimientosAntiguos(id).then(() => {
          this.cargarDatosSincronizados(id);
        });
      });
    });
  }

  // Carga movimientos y cajas chicas en paralelo y calcula el resumen cuando ambos están listos
  cargarDatosSincronizados(id: string): void {
    if (!this.caja?.fecha) return;
    const fecha = this.caja.fecha instanceof Date ? this.caja.fecha : (this.caja.fecha as any).toDate?.() || new Date(this.caja.fecha);
    const year = fecha.getFullYear();
    const mes = fecha.getMonth();

    combineLatest([
      this.cajaBancoService.getMovimientosCajaBanco(id),
      this.cajaChicaService.getCajasChicasPorMes(year, mes)
    ]).subscribe(([movimientos, todasCajasChicas]) => {
      this.movimientos = movimientos || [];

      const cajaBancoDay = new Date(fecha);
      cajaBancoDay.setHours(0, 0, 0, 0);

      this.cajasChicas = (todasCajasChicas || []).filter(cc => {
        if (cc.estado !== 'CERRADA') return false;
        const cajaDia = new Date(cc.fecha instanceof Date ? cc.fecha : (cc.fecha as any).toDate?.() || new Date(cc.fecha));
        cajaDia.setHours(0, 0, 0, 0);
        return cajaDia.getTime() === cajaBancoDay.getTime();
      });

      // Calcular resumen cuando YA tenemos ambos conjuntos
      this.calcularResumen();
      this.datoCargado = true;
      // Asegurar que el DOM refleje los cambios antes de imprimir
      this.cdr.detectChanges();
      setTimeout(() => this.imprimir(), 1200);
    });
  }

  dateFrom(value: any): Date {
    if (!value) return new Date();
    if (typeof (value as any).toDate === 'function') {
      return (value as any).toDate();
    }
    if (value instanceof Date) return value;
    return new Date(value);
  }

  calcularResumen(): void {
    let ingresosCajasChicas = 0;
    let ingresosOtros = 0;
    let egresos = 0;
    
    // 1. Sumar ingresos de cajas chicas (ya están filtradas por estado CERRADA y mismo día en cargarCajasChicas)
    (this.cajasChicas || []).forEach(cc => {
      ingresosCajasChicas += Number(cc.monto_actual || 0);
    });
    
    // 2. Sumar movimientos de ingresos/egresos
    (this.movimientos || []).forEach(m => {
      if (m.tipo === 'INGRESO') {
        ingresosOtros += Number(m.monto || 0);
      } else if (m.tipo === 'EGRESO') {
        egresos += Number(m.monto || 0);
      }
    });
    
    this.resumen.ingresos_cajas_chicas = ingresosCajasChicas;
    this.resumen.ingresos_otros = ingresosOtros;
    this.resumen.total_ingresos = ingresosCajasChicas + ingresosOtros;
    this.resumen.total_egresos = egresos;
    this.resumen.cantidad_movimientos = (this.movimientos || []).length;
    
    // 3. Calcular saldo final: saldoInicial + totalIngresos - totalEgresos
    const saldoInicial = Number(this.caja?.saldo_inicial ?? 0);
    this.resumen.saldo_final = saldoInicial + this.resumen.total_ingresos - this.resumen.total_egresos;
  }

  imprimir(): void {
    window.print();
  }

  volver(): void {
    this.router.navigate(['/caja-banco']);
  }
}
