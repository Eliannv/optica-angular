import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CajaChicaService } from '../../../../core/services/caja-chica.service';
import { CajaBancoService } from '../../../../core/services/caja-banco.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-abrir-caja',
  standalone: false,
  templateUrl: './abrir-caja.html',
  styleUrls: ['./abrir-caja.css']
})
export class AbrirCajaComponent implements OnInit, OnDestroy {
  private cajaChicaService = inject(CajaChicaService);
  private cajaBancoService = inject(CajaBancoService);
  private authService = inject(AuthService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);

  form!: FormGroup;
  cargando = false;
  error = '';
  maxFecha = '';
  // 🔹 Flag para evitar ejecuciones automáticas - solo se ejecuta si el usuario presiona el botón
  userInitiatedAction = false;
  
  // 🔹 Subject para destruir subscriptes cuando el componente se destruye
  private destroy$ = new Subject<void>();
  
  // 🔹 Flag para evitar ejecuciones duplicadas
  private procesando = false;

  ngOnInit(): void {
    this.inicializarFormulario();
    // 🔹 Resetear flag de acción para prevenir ejecuciones automáticas
    this.userInitiatedAction = false;
    // 🔹 Removido: Ahora permite abrir múltiples cajas chicas en el mismo día
    // this.validarCajaAbiertaHoy();
  }

  ngOnDestroy(): void {
    // 🔹 Destruir todos los subscriptes activos
    this.destroy$.next();
    this.destroy$.complete();
  }

  inicializarFormulario(): void {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    this.maxFecha = hoy.toISOString().split('T')[0];

    // 🔹 IMPORTANTE: Siempre limpiar localStorage cuando se inicializa el formulario
    // Esto previene que se ejecuten acciones automáticas no deseadas
    localStorage.removeItem('cajaChicaAbierta');

    this.form = this.formBuilder.group({
      fecha: [hoy, Validators.required], // Fecha actual, pero no editable en el HTML
      monto_inicial: ['', [Validators.required, Validators.min(0)]],
      observacion: ['']
    });
  }

  // 🔹 DEPRECATED: Removido para permitir múltiples cajas chicas en el mismo día
  /*
  validarCajaAbiertaHoy(): void {
    const cajaAbiertaId = localStorage.getItem('cajaChicaAbierta');
    if (cajaAbiertaId) {
      this.cajaChicaService.getCajaChicaById(cajaAbiertaId).subscribe({
        next: (caja) => {
          if (caja && caja.estado === 'ABIERTA') {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const fechaCaja = new Date(caja.fecha);
            fechaCaja.setHours(0, 0, 0, 0);
            
            if (fechaCaja.getTime() === hoy.getTime()) {
              Swal.fire({
                icon: 'warning',
                title: 'Caja ya abierta',
                text: `Ya existe una caja abierta hoy por ${caja.usuario_nombre}. Ciérrala primero.`,
                confirmButtonText: 'Ir a la caja',
                allowOutsideClick: false,
                allowEscapeKey: false
              }).then((result) => {
                if (result.isConfirmed) {
                  this.router.navigate(['/caja-chica/ver', cajaAbiertaId]);
                }
              });
            }
          } else {
            // La caja no existe o está cerrada, limpiar localStorage
            localStorage.removeItem('cajaChicaAbierta');
          }
        },
        error: () => {
          // Si hay error al obtener la caja, limpiar localStorage (caja no existe)
          localStorage.removeItem('cajaChicaAbierta');
        }
      });
    }
  }
  */

  abrirCaja(): void {
    // 🔹 CRÍTICO: Marcar que el usuario presionó el botón explícitamente
    this.userInitiatedAction = true;
    
    // Bloquear si ya está cargando
    if (this.cargando) return;
    
    // 🔹 IMPORTANTE: El usuario debe presionar explícitamente el botón
    // No permitir ejecuciones automáticas
    
    // Establecer cargando para bloquear el botón
    this.cargando = true;

    // Validar existencia de Caja Banco primero (async)
    this.cajaBancoService.existeAlMenosUnaCajaBanco()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (existe) => {
        if (!existe) {
          this.cargando = false; // Desbloquear botón
          
          // Obtener el rol del usuario actual
          const usuario = this.authService.getCurrentUser();
          const esAdmin = this.authService.isAdmin(); // rol id 1
          
          if (esAdmin) {
            // Para admin: mostrar opción de crear caja banco
            Swal.fire({
              icon: 'warning',
              title: 'Caja Banco requerida',
              text: 'Debe crear primero una Caja Banco antes de registrar una Caja Chica.',
              confirmButtonText: 'Ir a Caja Banco',
              showCancelButton: true,
              cancelButtonText: 'Volver',
              allowOutsideClick: false,
              allowEscapeKey: false
            }).then((result) => {
              if (result.isConfirmed) {
                // 🔹 Resetear flag cuando el usuario navega fuera
                this.userInitiatedAction = false;
                this.router.navigate(['/caja-banco']);
              } else {
                // 🔹 Resetear flag si el usuario cancela
                this.userInitiatedAction = false;
              }
            });
          } else {
            // Para operador: mensaje de contactar al administrador
            Swal.fire({
              icon: 'error',
              title: 'Caja Banco no disponible',
              text: 'No existe una Caja Banco creada. Contacte con el administrador para que la cree.',
              confirmButtonText: 'Aceptar',
              allowOutsideClick: false,
              allowEscapeKey: false
            }).then(() => {
              // 🔹 Resetear flag
              this.userInitiatedAction = false;
            });
          }
          return;
        }

        // Si existe Caja Banco, continuar con la validación del formulario
        // 🔹 Aquí es donde el usuario realmente abre la caja
        this.procederAbrirCaja();
        this.cargando = false; // Desbloquear después de procesar
      },
      error: (err) => {
        this.cargando = false; // Desbloquear en caso de error
        // 🔹 Resetear flag en error
        this.userInitiatedAction = false;
        console.error('Error al verificar existencia de Caja Banco:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error de validación',
          text: 'No se pudo verificar la existencia de una Caja Banco. Inténtelo nuevamente.',
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  private procederAbrirCaja(): void {
    // 🔹 CRÍTICO: Prevenir ejecuciones duplicadas
    if (this.procesando) {
      console.warn('Ya se está procesando la apertura de caja. Evitando ejecución duplicada.');
      return;
    }
    
    this.procesando = true;
    
    if (this.form.invalid) {
      this.procesando = false;
      Swal.fire({
        icon: 'error',
        title: 'Campos requeridos',
        text: 'Por favor completa todos los campos requeridos'
      });
      return;
    }

    // Validar que la fecha no sea futura
    const fechaSel = new Date(this.form.get('fecha')?.value);
    const hoyCmp = new Date();
    fechaSel.setHours(0,0,0,0);
    hoyCmp.setHours(0,0,0,0);
    if (fechaSel.getTime() > hoyCmp.getTime()) {
      this.procesando = false;
      Swal.fire({
        icon: 'warning',
        title: 'Fecha inválida',
        text: 'La fecha de apertura no puede ser posterior a hoy.'
      });
      return;
    }

    // Verificación rápida en localStorage (ayuda UX)
    const cajaAbiertaId = localStorage.getItem('cajaChicaAbierta');
    if (cajaAbiertaId) {
      this.procesando = false;
      Swal.fire({
        icon: 'error',
        title: 'Caja ya abierta',
        text: 'Ya existe una caja abierta para hoy'
      });
      return;
    }

    this.cargando = true;

    const usuario = this.authService.getCurrentUser();
    const montoParse = parseFloat(this.form.get('monto_inicial')?.value);

    // Obtener la fecha del formulario y normalizarla
    const fechaValue = this.form.get('fecha')?.value;
    let fecha: Date;

    // Manejar diferentes tipos de entrada (Date, string, null)
    if (fechaValue instanceof Date) {
      // Si ya es un Date, normalizarlo a medianoche
      fecha = new Date(fechaValue);
      fecha.setHours(0, 0, 0, 0);
    } else if (typeof fechaValue === 'string') {
      // Si es string (formato YYYY-MM-DD o DD/MM/YYYY)
      if (fechaValue.includes('-')) {
        const [year, month, day] = fechaValue.split('-');
        fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);
      } else if (fechaValue.includes('/')) {
        const [day, month, year] = fechaValue.split('/');
        fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0);
      } else {
        // Fallback: usar fecha actual
        fecha = new Date();
        fecha.setHours(0, 0, 0, 0);
      }
    } else {
      // Fallback: usar fecha actual si el valor es null o undefined
      fecha = new Date();
      fecha.setHours(0, 0, 0, 0);
    }

    const nuevaCaja = {
      fecha,
      monto_inicial: montoParse,
      monto_actual: montoParse,
      estado: 'ABIERTA' as const,
      usuario_id: usuario?.id,
      usuario_nombre: usuario?.nombre || 'Usuario Desconocido',
      observacion: this.form.get('observacion')?.value || ''
    };

    this.cajaChicaService.abrirCajaChica(nuevaCaja).then(
      (cajaId) => {
        this.cargando = false;
        this.procesando = false; // 🔹 Resetear flag de procesamiento
        localStorage.setItem('cajaChicaAbierta', cajaId);
        Swal.fire({
          icon: 'success',
          title: 'Caja abierta',
          text: `Caja chica abierta con $${montoParse.toFixed(2)}`,
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/caja-chica/ver', cajaId]);
        });
      },
      (error) => {
        this.cargando = false;
        this.procesando = false; // 🔹 Resetear flag de procesamiento
        console.error('Error al abrir caja:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: (error?.message) || 'No se pudo abrir la caja chica'
        });
      }
    );
  }

  volver(): void {
    this.router.navigate(['/caja-chica']);
  }

  get montoControl() {
    return this.form.get('monto_inicial');
  }
}
