import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';
import { CajaChica } from '../../../../core/models/caja-chica.model';

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

  resumen = {
    total_ingresos: 0,
    total_egresos: 0,
    saldo_final: 0,
    cantidad_movimientos: 0,
  };

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.year = Number(params['year']);
      this.month = Number(params['month']);
      const m0 = this.month - 1;
      if (isNaN(this.year) || isNaN(m0)) return;
      this.cajaBancoService.getCajasBancoPorMes(this.year, m0).subscribe((cajas) => this.cajasBanco = cajas || []);
      this.cajaBancoService.getMovimientosCajaBancoPorMes(this.year, m0).subscribe((movs) => {
        this.movimientos = movs || [];
        this.calcularResumen();
      });
      this.cajaChicaService.getCajasChicasPorMes(this.year, m0).subscribe((cc) => this.cajasChicas = cc || []);
      setTimeout(() => this.imprimir(), 0);
    });
  }

  calcularResumen(): void {
    let ingresos = 0;
    let egresos = 0;
    (this.movimientos || []).forEach(m => {
      if (m.tipo === 'INGRESO') ingresos += m.monto || 0;
      else egresos += m.monto || 0;
    });
    this.resumen.total_ingresos = ingresos;
    this.resumen.total_egresos = egresos;
    this.resumen.cantidad_movimientos = (this.movimientos || []).length;
    this.resumen.saldo_final = ingresos - egresos;
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
