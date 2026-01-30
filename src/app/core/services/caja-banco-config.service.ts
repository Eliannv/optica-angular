/**
 * Servicio para gestionar la configuración de cajas banco.
 * 
 * Maneja el modo de operación (automático/manual) y la lógica de 
 * cierre y apertura automática de cajas al cambio de mes.
 */
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ModoCajaBanco = 'automatico' | 'manual';

@Injectable({
  providedIn: 'root'
})
export class CajaBancoConfigService {
  private readonly STORAGE_KEY = 'caja_banco_modo';
  
  /** Subject que emite el modo actual de operación */
  private modoSubject: BehaviorSubject<ModoCajaBanco>;
  
  /** Observable público del modo de operación */
  public modo$: Observable<ModoCajaBanco>;

  constructor() {
    // Siempre iniciar en modo manual por defecto para evitar inconvenientes
    const modoInicial: ModoCajaBanco = 'manual';
    
    this.modoSubject = new BehaviorSubject<ModoCajaBanco>(modoInicial);
    this.modo$ = this.modoSubject.asObservable();
    
    // Guardar modo manual en localStorage
    localStorage.setItem(this.STORAGE_KEY, modoInicial);
  }

  /**
   * Obtiene el modo actual de operación
   */
  getModoActual(): ModoCajaBanco {
    return this.modoSubject.value;
  }

  /**
   * Verifica si está en modo automático
   */
  esAutomatico(): boolean {
    return this.modoSubject.value === 'automatico';
  }

  /**
   * Verifica si está en modo manual
   */
  esManual(): boolean {
    return this.modoSubject.value === 'manual';
  }

  /**
   * Cambia el modo de operación y lo persiste en localStorage
   */
  setModo(modo: ModoCajaBanco): void {
    this.modoSubject.next(modo);
    localStorage.setItem(this.STORAGE_KEY, modo);
    console.log(`🔄 Modo de Caja Banco cambiado a: ${modo.toUpperCase()}`);
  }

  /**
   * Alterna entre modo automático y manual
   */
  toggleModo(): ModoCajaBanco {
    const nuevoModo: ModoCajaBanco = this.esAutomatico() ? 'manual' : 'automatico';
    this.setModo(nuevoModo);
    return nuevoModo;
  }
}
