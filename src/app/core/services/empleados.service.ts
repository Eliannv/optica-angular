import { Injectable, inject } from '@angular/core';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collectionData,
  query,
  where,
  orderBy
} from '@angular/fire/firestore';
import { 
  Auth,
  updatePassword,
  deleteUser as firebaseDeleteUser
} from '@angular/fire/auth';
import { Observable, from, map } from 'rxjs';
import { Usuario, RolUsuario } from '../models/usuario.model';

@Injectable({
  providedIn: 'root'
})
export class EmpleadosService {
  private firestore: Firestore = inject(Firestore);
  private auth: Auth = inject(Auth);

  /**
   * Obtener todos los empleados (solo operadores)
   */
  getEmpleados(): Observable<Usuario[]> {
    const empleadosRef = collection(this.firestore, 'usuarios');
    const q = query(
      empleadosRef,
      where('rol', '==', RolUsuario.OPERADOR)
    );
    
    // Ordenamos en cliente para evitar índice compuesto en Firestore
    return (collectionData(q, { idField: 'id' }) as Observable<Usuario[]>)
      .pipe(
        map(lista => lista.sort((a, b) => a.nombre.localeCompare(b.nombre)))
      );
  }

  /**
   * Obtener todos los usuarios (incluyendo administradores)
   */
  getTodosLosUsuarios(): Observable<Usuario[]> {
    const usuariosRef = collection(this.firestore, 'usuarios');
    const q = query(usuariosRef, orderBy('nombre', 'asc'));
    
    return collectionData(q, { idField: 'id' }) as Observable<Usuario[]>;
  }

  /**
   * Obtener un empleado por ID
   */
  getEmpleadoPorId(id: string): Observable<Usuario | null> {
    const empleadoRef = doc(this.firestore, `usuarios/${id}`);
    return from(getDoc(empleadoRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Usuario;
        }
        return null;
      })
    );
  }

  /**
   * Bloquear/desbloquear empleado
   */
  toggleEstadoEmpleado(id: string, activo: boolean): Promise<void> {
    const empleadoRef = doc(this.firestore, `usuarios/${id}`);
    return updateDoc(empleadoRef, { 
      activo,
      updatedAt: new Date()
    });
  }

  /**
   * Actualizar datos personales del empleado
   */
  actualizarEmpleado(id: string, datos: Partial<Usuario>): Promise<void> {
    const empleadoRef = doc(this.firestore, `usuarios/${id}`);
    return updateDoc(empleadoRef, {
      ...datos,
      updatedAt: new Date()
    });
  }

  /**
   * Asignar machine ID y sucursal al empleado
   */
  autorizarAcceso(id: string, machineId: string, sucursal: string = 'PASAJE'): Promise<void> {
    const empleadoRef = doc(this.firestore, `usuarios/${id}`);
    return updateDoc(empleadoRef, {
      machineId,
      sucursal,
      updatedAt: new Date()
    });
  }

  /**
   * Revocar acceso (eliminar machine ID)
   */
  revocarAcceso(id: string): Promise<void> {
    const empleadoRef = doc(this.firestore, `usuarios/${id}`);
    return updateDoc(empleadoRef, {
      machineId: null,
      sucursal: null,
      updatedAt: new Date()
    });
  }

  /**
   * Eliminar empleado de Firestore
   * NOTA: Esto NO elimina el usuario de Firebase Auth
   */
  eliminarEmpleado(id: string): Promise<void> {
    const empleadoRef = doc(this.firestore, `usuarios/${id}`);
    return deleteDoc(empleadoRef);
  }

  /**
   * Cambiar contraseña de un empleado
   * NOTA: Esto requiere que el empleado esté autenticado o usar Firebase Admin SDK
   * Por ahora solo actualiza si el empleado es el usuario actual
   */
  cambiarContrasena(nuevaContrasena: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      return Promise.reject(new Error('No hay usuario autenticado'));
    }
    return updatePassword(user, nuevaContrasena);
  }

  /**
   * Obtener el Machine ID actual de Electron
   */
  getMachineIdActual(): string | null {
    const electronApi = (window as any).electron;
    return electronApi?.machineId || null;
  }

  /**
   * Obtener la sucursal actual de Electron
   */
  getSucursalActual(): string {
    const electronApi = (window as any).electron;
    return electronApi?.sucursal || 'PASAJE';
  }

  /**
   * Verificar unicidad de correo electrónico
   */
  async existeEmail(email: string, excluirId?: string): Promise<boolean> {
    const usuariosRef = collection(this.firestore, 'usuarios');
    const q = query(usuariosRef, where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) return false;
    // Si hay resultados, verificar si alguno no es el usuario excluido
    return snap.docs.some(d => d.id !== excluirId);
  }

  /**
   * Verificar unicidad de cédula
   */
  async existeCedula(cedula: string, excluirId?: string): Promise<boolean> {
    const usuariosRef = collection(this.firestore, 'usuarios');
    const q = query(usuariosRef, where('cedula', '==', cedula));
    const snap = await getDocs(q);
    if (snap.empty) return false;
    return snap.docs.some(d => d.id !== excluirId);
  }
}
