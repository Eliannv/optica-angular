import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { CajaBanco, MovimientoCajaBanco } from '../../../../core/models/caja-banco.model';

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

  caja: CajaBanco | null = null;
  movimientos: MovimientoCajaBanco[] = [];
  resumen = {
    total_ingresos: 0,
    total_egresos: 0,
    saldo_final: 0,
    cantidad_movimientos: 0,
  };

  ngOnInit(): void {
    this.route.params.subscribe(async (params) => {
      const id = params['id'];
      if (!id) return;
      this.cajaBancoService.getCajaBancoById(id).subscribe((c) => {
        this.caja = c;
        this.resumen.saldo_final = c?.saldo_actual || 0;
      });
      this.cajaBancoService.getMovimientosCajaBanco(id).subscribe((movs) => {
        this.movimientos = movs || [];
        this.calcularResumen();
        // auto-abrir diálogo de impresión
        setTimeout(() => this.imprimir(), 0);
      });
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
    let ingresos = 0;
    let egresos = 0;
    (this.movimientos || []).forEach(m => {
      if (m.tipo === 'INGRESO') ingresos += m.monto || 0;
      else egresos += m.monto || 0;
    });
    this.resumen.total_ingresos = ingresos;
    this.resumen.total_egresos = egresos;
    this.resumen.cantidad_movimientos = (this.movimientos || []).length;
  }

  imprimir(): void {
    window.print();
  }

  volver(): void {
    this.router.navigate(['/caja-banco']);
  }
}
