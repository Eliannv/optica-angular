import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { SucursalContextService } from '../../../core/services/sucursal-context.service';
import { SucursalesService } from '../../../core/services/sucursales.service';
import { AuthService } from '../../../core/services/auth.service';
import { Sucursal } from '../../../core/models/sucursal.model';
import { SucursalSeleccionada, TODAS_LAS_SUCURSALES } from '../../../core/models/sucursal-constants';
import { RolUsuario } from '../../../core/models/usuario.model';

@Component({
  selector: 'app-selector-sucursal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sucursal-select-wrapper" *ngIf="mostrarSelector$ | async">

      <!-- Icono de sucursal -->
      <svg class="sucursal-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>

      <!-- Select nativo estilizado -->
      <select
        class="sucursal-select"
        [class.loading]="cargando"
        [ngModel]="sucursalIdSeleccionada"
        (ngModelChange)="onSucursalChange($event)"
        [disabled]="cargando">

        <option [value]="TODAS_SUCURSALES">Todas las sucursales</option>

        <option
          *ngFor="let s of sucursales$ | async"
          [value]="s.id">
          {{ s.nombre }}
        </option>

      </select>

      <!-- Spinner visible solo al cargar -->
      <span class="sucursal-spinner" *ngIf="cargando"></span>

      <!-- Flecha custom cuando no carga -->
      <svg *ngIf="!cargando" class="sucursal-chevron" xmlns="http://www.w3.org/2000/svg"
        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>

    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .sucursal-select-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0;
      height: 36px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0 0.6rem 0 0.65rem;
      transition: border-color 0.15s, box-shadow 0.15s;
    }

    .sucursal-select-wrapper:hover {
      border-color: var(--primary-color);
    }

    .sucursal-select-wrapper:focus-within {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.12);
    }

    .sucursal-icon {
      color: var(--text-secondary);
      flex-shrink: 0;
      pointer-events: none;
    }

    .sucursal-select {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: none;
      outline: none;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-primary);
      cursor: pointer;
      padding: 0 1.6rem 0 0.45rem;
      height: 36px;
      min-width: 0;
      width: 170px;
      letter-spacing: 0.01em;
    }

    .sucursal-select option {
      background: var(--bg-card);
      color: var(--text-primary);
    }

    .sucursal-select:disabled {
      cursor: wait;
      opacity: 0.6;
    }

    .sucursal-chevron {
      position: absolute;
      right: 0.55rem;
      color: var(--text-secondary);
      pointer-events: none;
      flex-shrink: 0;
    }

    .sucursal-spinner {
      position: absolute;
      right: 0.55rem;
      width: 13px;
      height: 13px;
      border: 2px solid var(--border-color);
      border-top-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @media (max-width: 680px) {
      .sucursal-select-wrapper {
        display: none;
      }
    }
  `]
})
export class SelectorSucursalComponent implements OnInit {
  private sucursalContext = inject(SucursalContextService);
  private sucursalesService = inject(SucursalesService);
  private authService = inject(AuthService);

  sucursales$!: Observable<Sucursal[]>;
  mostrarSelector$!: Observable<boolean>;

  sucursalIdSeleccionada: string = TODAS_LAS_SUCURSALES;
  nombreSucursalActual: string = 'Todas las sucursales';
  cargando: boolean = false;

  readonly TODAS_SUCURSALES = TODAS_LAS_SUCURSALES;

  ngOnInit(): void {
    this.sucursales$ = this.sucursalesService.getSucursalesActivas();

    this.mostrarSelector$ = new Observable(observer => {
      const usuario = this.authService.getCurrentUser();
      observer.next(usuario?.rol === RolUsuario.ADMINISTRADOR);
      observer.complete();
    });

    this.sucursalContext.getSucursalSeleccionada().subscribe(seleccion => {
      if (seleccion) {
        this.sucursalIdSeleccionada = seleccion.id;
        this.nombreSucursalActual = seleccion.nombre;
      }
    });
  }

  async onSucursalChange(sucursalId: string): Promise<void> {
    if (this.cargando) return;
    this.cargando = true;
    try {
      await this.sucursalContext.cambiarSucursal(sucursalId);
    } catch (error) {
      console.error('Error al cambiar sucursal:', error);
      const actual = this.sucursalContext.getSucursalActual();
      if (actual) this.sucursalIdSeleccionada = actual.id;
    } finally {
      this.cargando = false;
    }
  }
}