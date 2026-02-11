/**
 * Componente para la creación y edición de historiales clínicos.
 *
 * ✅ ACTUALIZADO: Ahora soporta múltiples historiales clínicos por cliente.
 * Cada historial es un documento independiente con ID auto-generado.
 *
 * Este componente proporciona un formulario reactivo completo para gestionar el historial
 * clínico oftalmológico de los clientes, incluyendo:
 * - Datos de refracción ocular (esfera, cilindro, eje) para ambos ojos
 * - Agudeza visual sin corrección (AVSC) y con corrección (AVCC)
 * - Medidas del armazón (montura)
 * - Información del cliente
 * - Observaciones y datos del doctor
 *
 * Soporta dos modos de operación: crear (nuevo historial) y editar (historial existente).
 * 
 * Query params esperados:
 * - clienteId: ID del cliente (required)
 * - historialId: ID del historial a editar (optional, solo para modo edit)
 */

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom, debounceTime, distinctUntilChanged } from 'rxjs';
import Swal from 'sweetalert2';

import { HistorialClinicoService } from '../../../../core/services/historial-clinico.service';
import { ClientesService } from '../../../../core/services/clientes';
import { AuthService } from '../../../../core/services/auth.service';
import { RolUsuario } from '../../../../core/models/usuario.model';
import { Cliente } from '../../../../core/models/cliente.model';
import { EnterNextDirective } from '../../../../shared/directives/enter-next.directive';

type Mode = 'create' | 'edit' | 'view';

@Component({
  selector: 'app-crear-historial-clinico',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, EnterNextDirective],
  templateUrl: './crear-historial-clinico.html',
  styleUrl: './crear-historial-clinico.css'
})
export class CrearHistorialClinicoComponent implements OnInit {

  clienteId = '';
  historialId = ''; // ✅ NUEVO: ID del historial a editar (solo en modo edit)
  cliente: Cliente | null = null;

  loading = true;
  form!: FormGroup;
  clienteForm!: FormGroup;

  mode: Mode = 'create';
  existeHistorial = false; // ✅ DEPRECADO: Ya no se usa (mantener por compatibilidad)

  // Mensajes de advertencia para validación reactiva
  cedulaDuplicadaMsg = '';
  emailDuplicadoMsg = '';

  // Valores originales para detectar cambios reales
  cedulaOriginal = '';
  emailOriginal = '';

  // Estados de validación
  validandoCedula = false;
  validandoEmail = false;

  // ✅ NUEVO: Control de acceso para fecha/hora de chequeo
  esAdmin = false;
  esOperador = false;
  mostrarCampoFechaHora = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private historialSrv: HistorialClinicoService,
    private clientesSrv: ClientesService,
    private authService: AuthService
  ) {}

  /**
   * Inicializa el componente y configura los formularios reactivos.
   *
   * Crea dos formularios independientes: uno para el historial clínico (con campos
   * de refracción y medidas del armazón) y otro para datos del cliente. Carga el
   * cliente desde Firestore, determina el modo de operación (create/edit/view),
   * y si existe historial previo, pre-llena el formulario con esos datos.
   */
  async ngOnInit() {

    /* =========================
       FORM HISTORIAL CLÍNICO
       ========================= */
    this.form = this.fb.group({
      dp: [''],
      add: [''],

      odEsfera: [''],
      odCilindro: [''],
      odEje: [''],
      odAVSC: [''],
      odAVCC: [''],

      oiEsfera: [''],
      oiCilindro: [''],
      oiEje: [''],
      oiAVSC: [''],
      oiAVCC: [''],

      de: [''],
      altura: [''],
      color: [''],
      observacion: [''],

      doctor: [''],
      
      // Fecha y hora del chequeo médico
      fechaChequeo: [''],
      horaChequeo: [''],

      // Medidas del armazón (montura)
      armazonH: [''],
      armazonV: [''],
      armazonDM: [''],
      armazonP: [''],
      armazonTipo: ['']
    });

    /* =========================
       FORM CLIENTE
       ========================= */
    this.clienteForm = this.fb.group({
      nombres: [''],
      apellidos: [''],
      cedula: [''],
      email: [''],
      telefono: [''],
      pais: [''],
      provincia: [''],
      ciudad: [''],
      direccion: ['']
    });

    /* =========================
       CARGA DE DATOS
       ========================= */
    // ✅ NUEVO: Obtener clienteId de query params o route params (compatibilidad)
    this.clienteId = this.route.snapshot.queryParamMap.get('clienteId') || 
                      this.route.snapshot.paramMap.get('id') || '';
    
    if (!this.clienteId) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se especificó un cliente',
        confirmButtonText: 'Volver'
      });
      this.router.navigate(['/clientes/historial-clinico']);
      return;
    }

    // ✅ NUEVO: Obtener historialId de query params (opcional, solo para edición)
    this.historialId = this.route.snapshot.queryParamMap.get('historialId') || '';
    
    // Determinar modo: si hay historialId, es edición; si no, es creación
    this.mode = this.historialId ? 'edit' : 'create';

    // ✅ NUEVO: Verificar rol del usuario y determinar permisos
    const usuarioActual = this.authService.getCurrentUser();
    this.esAdmin = usuarioActual?.rol === RolUsuario.ADMINISTRADOR;
    this.esOperador = usuarioActual?.rol === RolUsuario.OPERADOR;
    // Campo visible SOLO para administrador
    this.mostrarCampoFechaHora = this.esAdmin;

    this.cliente = await firstValueFrom(
      this.clientesSrv.getClienteById(this.clienteId)
    );

    if (this.cliente) {
      this.clienteForm.patchValue(this.cliente);
      // Guardar valores originales para detectar cambios
      this.cedulaOriginal = this.cliente.cedula || '';
      this.emailOriginal = this.cliente.email || '';
    }

    // ✅ ACTUALIZADO: Si estamos en modo edición, cargar el historial específico
    if (this.mode === 'edit' && this.historialId) {
      const snap = await this.historialSrv.obtenerHistorialPorId(this.clienteId, this.historialId);
      if (snap.exists()) {
        this.existeHistorial = true;
        const historialData = snap.data();
        this.form.patchValue(historialData);
        
        // ✅ NUEVO: Si existe fechaHoraChequeo, convertir a fecha y hora separadas
        if (historialData?.['fechaHoraChequeo']) {
          const fecha = this.convertirTimestampAFechaHora(historialData['fechaHoraChequeo']);
          this.form.patchValue({
            fechaChequeo: fecha.fecha,
            horaChequeo: fecha.hora
          });
        }
        
        // ✅ NUEVO: En modo edición, operadores no pueden cambiar la fecha/hora
        if (this.esOperador && this.mostrarCampoFechaHora) {
          this.form.get('fechaChequeo')?.disable();
          this.form.get('horaChequeo')?.disable();
        }
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se encontró el historial solicitado',
          confirmButtonText: 'Volver'
        });
        this.router.navigate(['/clientes/historiales'], {
          queryParams: { clienteId: this.clienteId }
        });
        return;
      }
    } else {
      // ✅ NUEVO: Inicializar fecha y hora en modo creación
      const now = new Date();
      this.form.patchValue({
        fechaChequeo: this.formatDateForInput(now),
        horaChequeo: this.formatTimeForInput(now)
      });
      
      // ✅ NUEVO: Si es operador en modo creación, deshabilitar campos (auto-relleno, read-only)
      if (this.esOperador && this.mostrarCampoFechaHora) {
        this.form.get('fechaChequeo')?.disable();
        this.form.get('horaChequeo')?.disable();
      }
    }

    // Configurar validaciones reactivas para cédula y email
    this.setupValidacionesReactivas();

    this.loading = false;
  }

  /**
   * Formatea una fecha en formato 'YYYY-MM-DD' para el input date de HTML.
   */
  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Formatea una hora en formato 'HH:MM' para el input time de HTML.
   */
  private formatTimeForInput(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Convierte un timestamp de Firestore a objetos de fecha y hora separados.
   * @param timestamp Puede ser Date, Timestamp de Firestore, o número en ms
   * @returns Objeto con propiedades fecha (YYYY-MM-DD) y hora (HH:MM)
   */
  private convertirTimestampAFechaHora(timestamp: any): { fecha: string; hora: string } {
    let date: Date;
    
    // Manejar diferentes tipos de timestamp
    if (typeof timestamp?.toDate === 'function') {
      // Timestamp de Firestore
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      // Fallback a fecha actual
      date = new Date();
    }

    return {
      fecha: this.formatDateForInput(date),
      hora: this.formatTimeForInput(date)
    };
  }

  /**
   * Obtiene la fecha máxima permitida (hoy) en formato para el input date.
   */
  get fechaMaximaChequeo(): string {
    return this.formatDateForInput(new Date());
  }

  /**
   * Combina fecha y hora en un timestamp de Firestore.
   * Utilizado internamente antes de guardar el historial.
   */
  private obtenerTimestampChequeo(): Date {
    const fechaStr = this.form.get('fechaChequeo')?.value || '';
    const horaStr = this.form.get('horaChequeo')?.value || '00:00';

    if (!fechaStr) {
      return new Date();
    }

    const [year, month, day] = fechaStr.split('-').map(Number);
    const [hours, minutes] = horaStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0);
  }

  /**
   * Configura validaciones reactivas para cédula y email.
   * 
   * Escucha cambios en los campos de cédula y email del formulario de cliente,
   * y valida de forma asíncrona si ya existen en el sistema (en clientes o usuarios).
   * Solo valida si el valor cambió realmente respecto al original.
   */
  private setupValidacionesReactivas() {
    if (this.mode === 'view') return; // No validar en modo solo lectura
    
    // Variable para rastrear si el usuario ha tocado el campo
    let cedulaTocada = false;
    let emailTocado = false;

    // Validación reactiva de cédula
    const cedulaControl = this.clienteForm.get('cedula');
    
    // Detectar cuando el usuario hace focus en el campo
    cedulaControl?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(async (cedula: string) => {
        this.cedulaDuplicadaMsg = '';
        this.validandoCedula = false;
        
        if (!cedula || cedula.trim() === '') {
          cedulaTocada = false;
          return;
        }
        
        // Marcar que el usuario está interactuando con el campo
        cedulaTocada = true;
        
        // Solo validar si cambió respecto al original
        if (cedula.trim() === this.cedulaOriginal.trim()) {
          cedulaTocada = false;
          return;
        }
        
        console.log('🔍 Validando cédula:', cedula, 'Original:', this.cedulaOriginal);
        this.validandoCedula = true;
        
        try {
          const existe = await this.clientesSrv.existeCedula(cedula, this.clienteId);
          console.log('📋 Resultado validación cédula:', existe);
          if (existe) {
            this.cedulaDuplicadaMsg = 'Esta cédula ya existe en el sistema';
          }
        } catch (error) {
          console.error('❌ Error validando cédula:', error);
        } finally {
          this.validandoCedula = false;
        }
      });

    // Validación reactiva de email
    const emailControl = this.clienteForm.get('email');
    
    emailControl?.valueChanges
      .pipe(
        debounceTime(400),
        distinctUntilChanged()
      )
      .subscribe(async (email: string) => {
        this.emailDuplicadoMsg = '';
        this.validandoEmail = false;
        
        if (!email || email.trim() === '') {
          emailTocado = false;
          return;
        }
        
        // Marcar que el usuario está interactuando con el campo
        emailTocado = true;
        
        // Solo validar si cambió respecto al original
        if (email.trim().toLowerCase() === this.emailOriginal.trim().toLowerCase()) {
          emailTocado = false;
          return;
        }
        
        console.log('🔍 Validando email:', email, 'Original:', this.emailOriginal);
        this.validandoEmail = true;
        
        try {
          const existe = await this.clientesSrv.existeEmail(email, this.clienteId);
          console.log('📧 Resultado validación email:', existe);
          if (existe) {
            this.emailDuplicadoMsg = 'Este email ya existe en el sistema';
          }
        } catch (error) {
          console.error('❌ Error validando email:', error);
        } finally {
          this.validandoEmail = false;
        }
      });
  }

  /**
   * Guarda o actualiza el historial clínico y los datos del cliente.
   *
   * Antes de guardar, normaliza los campos vacíos (numéricos a 0, textos a 'N/A'),
   * valida que todos los campos obligatorios del armazón estén completos, y persiste
   * tanto el historial como los datos actualizados del cliente en Firestore.
   * Tras el guardado exitoso, navega de vuelta a la lista de historiales.
   */
  async guardar() {
    if (this.mode === 'view') return;

    const cedula = this.clienteForm.get('cedula')?.value || '';

    // Validar cédula (siempre obligatoria)
    if (!cedula || cedula.trim() === '') {
      await Swal.fire({
        icon: 'error',
        title: 'Cédula requerida',
        text: 'La cédula es un campo obligatorio'
      });
      return;
    }

    // Validar duplicados
    if (this.cedulaDuplicadaMsg || this.emailDuplicadoMsg) {
      await Swal.fire({
        icon: 'error',
        title: 'Datos duplicados',
        text: 'Existen datos duplicados. Por favor revisa cédula y email.'
      });
      return;
    }

    try {
      const data = this.form.getRawValue();

      // ✅ NUEVO: Convertir fecha y hora a timestamp
      const timestampChequeo = this.obtenerTimestampChequeo();
      data.fechaHoraChequeo = timestampChequeo;
      
      // Remover campos individuales de fecha/hora antes de guardar
      delete data.fechaChequeo;
      delete data.horaChequeo;

      // ✅ ACTUALIZADO: Usar crearHistorial() o actualizarHistorial() según el modo
      if (this.mode === 'create') {
        // Crear nuevo historial con ID auto-generado
        const nuevoHistorialId = await this.historialSrv.crearHistorial(this.clienteId, data);
        console.log('✅ Historial creado con ID:', nuevoHistorialId);
      } else if (this.mode === 'edit' && this.historialId) {
        // Actualizar historial existente
        await this.historialSrv.actualizarHistorial(this.clienteId, this.historialId, data);
        console.log('✅ Historial actualizado:', this.historialId);
      }

      // Actualizar datos del cliente
      await this.clientesSrv.updateCliente(
        this.clienteId,
        this.clienteForm.getRawValue() as Partial<Cliente>
      );

      await Swal.fire({
        icon: 'success',
        title: 'Guardado exitoso',
        text: `El historial clínico fue ${this.mode === 'create' ? 'creado' : 'actualizado'} correctamente.`,
        timer: 2000,
        showConfirmButton: false
      });

      // Navegar a la lista de historiales del cliente
      this.router.navigate(['/clientes/historiales'], {
        queryParams: { clienteId: this.clienteId }
      });

    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error?.message || 'Error al guardar',
        confirmButtonColor: '#d33'
      });
    }
  }

  /**
   * Cancela la operación y retorna a la lista de historiales del cliente.
   */
  cancelar() {
    this.router.navigate(['/clientes/historiales'], {
      queryParams: { clienteId: this.clienteId }
    });
  }

  /**
   * Verifica si el botón de guardar debe estar habilitado.
   */
  get puedeGuardar(): boolean {
    // Bloquear si cédula está vacía
    const cedula = this.clienteForm.get('cedula')?.value;
    if (!cedula || cedula.trim() === '') return false;
    
    // Bloquear si hay duplicados
    if (this.cedulaDuplicadaMsg || this.emailDuplicadoMsg) return false;
    
    // Bloquear si se está validando
    if (this.validandoCedula || this.validandoEmail) return false;
    
    return true;
  }

  /**
   * Verifica si el componente está en modo solo lectura.
   */
  get esView(): boolean { return this.mode === 'view'; }

  /**
   * Verifica si el componente está en modo edición.
   */
  get esEdit(): boolean { return this.mode === 'edit'; }

  /**
   * Verifica si el componente está en modo creación.
   */
  get esCreate(): boolean { return this.mode === 'create'; }
}
