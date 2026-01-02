import { Injectable, inject } from '@angular/core';
import { 
  Auth, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  authState,
  User as FirebaseUser
} from '@angular/fire/auth';
import { 
  Firestore, 
  collection, 
  doc, 
  getDoc,
  setDoc,
  query, 
  where, 
  getDocs,
  collectionData,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable, from, map, switchMap, of, tap } from 'rxjs';
import { Usuario, RolUsuario } from '../models/usuario.model';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth: Auth = inject(Auth);
  private firestore: Firestore = inject(Firestore);
  private router: Router = inject(Router);
  
  // Observable del estado de autenticación
  authState$ = authState(this.auth);
  
  // Usuario actual
  private currentUserData: Usuario | null = null;

  constructor() {
    // Cargar datos del usuario cuando cambie el estado de autenticación
    this.authState$.pipe(
      switchMap(user => {
        if (user) {
          return this.getUserData(user.uid);
        } else {
          this.currentUserData = null;
          return of(null);
        }
      })
    ).subscribe(userData => {
      this.currentUserData = userData;
    });
  }

  /**
   * Iniciar sesión con email y contraseña
   */
  login(email: string, password: string): Observable<Usuario> {
    // Verificar conexión a internet
    if (!navigator.onLine) {
      throw new Error('OFFLINE: No hay conexión a internet. Verifica tu red e intenta nuevamente.');
    }

    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(credential => {
        // Obtener los datos del usuario desde Firestore
        return this.getUserData(credential.user.uid);
      }),
      map(userData => {
        if (!userData) {
          throw new Error('Usuario no encontrado en la base de datos');
        }
        
        // Verificar si el usuario está bloqueado
        if (userData.activo === false && userData.rol === 2) {
          // Distinguir entre "sin autorización" y "bloqueado"
          // Si nunca ha tenido machineId, probablemente nunca fue autorizado
          if (!userData.machineId) {
            throw new Error('UNAUTHORIZED: Tu cuenta aún no ha sido autorizada por el administrador. Contacta al administrador para obtener acceso.');
          } else {
            throw new Error('BLOCKED: Tu cuenta ha sido bloqueada. Contacta al administrador para más información.');
          }
        }
        
        // 🔐 VALIDACIÓN DE SUCURSAL Y MACHINE ID (Nivel 2)
        this.validarAccesoSucursal(userData);
        
        return userData;
      })
    );
  }

  /**
   * Validar que el usuario tenga acceso a esta sucursal y machine ID
   */
  private validarAccesoSucursal(userData: Usuario): void {
    // Obtener datos de Electron (solo disponible en app empaquetada)
    const electronApi = (window as any).electron;
    
    if (!electronApi) {
      // En desarrollo (navegador), permitir acceso
      console.warn('⚠️ Ejecutando en modo desarrollo - validación de sucursal deshabilitada');
      return;
    }

    const sucursalActual = electronApi.sucursal || 'PASAJE';
    const machineIdActual = electronApi.machineId;

    // Validar sucursal
    if (userData.sucursal && userData.sucursal !== sucursalActual) {
      throw new Error(
        `Tu cuenta está asignada a la sucursal ${userData.sucursal}. ` +
        `No puedes iniciar sesión desde ${sucursalActual}.`
      );
    }

    // Validar machine ID
    if (userData.machineId && userData.machineId !== machineIdActual) {
      throw new Error(
        'Esta cuenta está autorizada para otra computadora. ' +
        'Contacta al administrador para autorizar este equipo.'
      );
    }

    // Log removido para producción: evitar mensajes en consola en la app de escritorio
    // Si necesitas depurar, reactivar este log temporalmente.
  }

  /**
   * Cerrar sesión
   */
  logout(): Observable<void> {
    return from(signOut(this.auth)).pipe(
      map(() => {
        this.currentUserData = null;
        this.router.navigate(['/login']);
      })
    );
  }

  /**
   * Recuperar contraseña
   */
  forgotPassword(email: string): Observable<void> {
    return from(sendPasswordResetEmail(this.auth, email));
  }

  /**
   * Registrar un nuevo usuario (siempre como empleado)
   *
   * Importante: evitamos lecturas a Firestore antes de estar autenticado.
   * Firebase Auth ya garantiza la unicidad del email.
   * La unicidad de "cedula" se puede validar luego de crear la cuenta,
   * ya autenticados, o con lógica de servidor si se desea 100% estricta.
   */
  register(userData: {
    cedula: string;
    nombre: string;
    apellido: string;
    fechaNacimiento: string;
    email: string;
    password: string;
  }): Observable<Usuario> {
    // Primero verificar si la cédula ya existe
    return from(this.verificarCedulaExistente(userData.cedula)).pipe(
      switchMap(cedulaExiste => {
        if (cedulaExiste) {
          throw new Error('La cédula ya está registrada en el sistema');
        }
        
        // Continuar con el registro normal
        return from(createUserWithEmailAndPassword(this.auth, userData.email, userData.password)).pipe(
          switchMap(credential => {
            // Datos provenientes de Electron (solo app de escritorio)
            const electronApi = (window as any).electron;
            const sucursalActual = electronApi?.sucursal || 'PASAJE';

            // Crear el documento del usuario en Firestore
            const nuevoUsuario: Usuario = {
              id: credential.user.uid,
              nombre: userData.nombre,
              apellido: userData.apellido,
              cedula: userData.cedula,
              fechaNacimiento: userData.fechaNacimiento,
              email: userData.email.toLowerCase(),
              rol: RolUsuario.OPERADOR, // Siempre se registra como OPERADOR (rol 2)
              activo: false, // Por defecto bloqueado hasta que admin desbloquee
              sucursal: sucursalActual,
              createdAt: serverTimestamp()
            };

            const userDocRef = doc(this.firestore, `usuarios/${credential.user.uid}`);
            return from(setDoc(userDocRef, nuevoUsuario)).pipe(
              map(() => nuevoUsuario)
            );
          })
        );
      })
    );
  }

  /**
   * Verificar si una cédula ya existe en el sistema (solo en usuarios)
   */
  private async verificarCedulaExistente(cedula: string): Promise<boolean> {
    const usuariosRef = collection(this.firestore, 'usuarios');
    const q = query(usuariosRef, where('cedula', '==', cedula));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  /**
   * Obtener datos del usuario desde Firestore
   */
  private getUserData(uid: string): Observable<Usuario | null> {
    const userDocRef = doc(this.firestore, `usuarios/${uid}`);
    return from(getDoc(userDocRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Usuario;
        }
        return null;
      })
    );
  }

  /**
   * Garantiza que currentUserData esté cargado; reutiliza caché si existe.
   */
  ensureUserData(uid: string): Observable<Usuario | null> {
    if (this.currentUserData?.id === uid) {
      return of(this.currentUserData);
    }

    return this.getUserData(uid).pipe(
      tap(user => this.currentUserData = user)
    );
  }

  /**
   * Obtener el usuario actual
   */
  getCurrentUser(): Usuario | null {
    return this.currentUserData;
  }

  /**
   * Verificar si el usuario es administrador
   */
  isAdmin(): boolean {
    return this.currentUserData?.rol === RolUsuario.ADMINISTRADOR;
  }

  /**
   * Verificar si el usuario es operador
   */
  isOperador(): boolean {
    return this.currentUserData?.rol === RolUsuario.OPERADOR;
  }

  /**
   * Verificar si hay un usuario autenticado
   */
  isAuthenticated(): boolean {
    return this.auth.currentUser !== null && this.currentUserData !== null;
  }

  /**
   * Obtener el UID del usuario actual
   */
  getCurrentUserId(): string | null {
    return this.auth.currentUser?.uid || null;
  }

  /**
   * Enviar email de recuperación de contraseña
   */
  async resetPassword(email: string): Promise<void> {
    // Verificar conexión a internet
    if (!navigator.onLine) {
      throw new Error('OFFLINE: No hay conexión a internet. Verifica tu red e intenta nuevamente.');
    }

    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error: any) {
      // Manejar errores específicos de Firebase
      if (error.code === 'auth/user-not-found') {
        throw new Error('No existe una cuenta con este correo electrónico.');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('El correo electrónico no es válido.');
      } else {
        throw new Error('Error al enviar el correo de recuperación. Intenta nuevamente.');
      }
    }
  }
}
