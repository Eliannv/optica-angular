import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { FacturasService } from '../../../../core/services/facturas';

@Component({
  selector: 'app-ver-factura',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ver-factura.html',
  styleUrl: './ver-factura.css'
})
export class VerFacturaComponent implements OnDestroy {
  factura: any = null;
  loading = true;

  private sub?: Subscription;

  constructor(private route: ActivatedRoute, private facturasSrv: FacturasService) {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.sub = this.facturasSrv.getFacturaById(id).subscribe(f => {
      this.factura = f;
      this.loading = false;
    });
  }

  reimprimir() {
    if (!this.factura) return;

    document.body.classList.add('print-ticket');

    setTimeout(() => {
      window.print();
      setTimeout(() => document.body.classList.remove('print-ticket'), 500);
    }, 0);
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    document.body.classList.remove('print-ticket');
  }
}

