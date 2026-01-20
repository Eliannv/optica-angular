import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-imprimir-caja-chica',
  standalone: false,
  templateUrl: './imprimir-caja-chica.html',
  styleUrls: ['./imprimir-caja-chica.css']
})
export class ImprimirCajaChicaComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);

  reporteCierreData: any = null;

  ngOnInit(): void {
    // Obtener los datos pasados desde la navegación
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    
    if (state?.reporteData) {
      this.reporteCierreData = state.reporteData;
      
      // Esperar a que se renderice y luego imprimir automáticamente
      setTimeout(() => {
        window.print();
      }, 500);
    } else {
      // Si no hay datos, volver atrás
      console.error('No hay datos de reporte para imprimir');
      this.volver();
    }
  }

  volver(): void {
    window.close(); // Intenta cerrar la ventana si fue abierta con window.open
    this.router.navigate(['/caja-chica']); // Si no puede cerrar, navega de vuelta
  }

  imprimir(): void {
    window.print();
  }
}
