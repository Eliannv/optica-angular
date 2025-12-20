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
import { Observable, from, map, switchMap, of } from 'rxjs';
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
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      switchMap(credential => {
        // Obtener los datos del usuario desde Firestore
        return this.getUserData(credential.user.uid);
      }),
      map(userData => {
        if (!userData) {
          throw new Error('Usuario no encontrado en la base de datos');
        }
        if (!userData.activo) {
          throw new Error('Tu cuenta está inactiva. Contacta al administrador.');
        }
        return userData;
      })
    );
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
   */
  register(userData: {
    cedula: string;
    nombre: string;
    apellido: string;
    fechaNacimiento: string;
    email: string;
    password: string;
  }): Observable<Usuario> {
    return from(createUserWithEmailAndPassword(this.auth, userData.email, userData.password)).pipe(
      switchMap(credential => {
        // Crear el documento del usuario en Firestore
        const nuevoUsuario: Usuario = {
          id: credential.user.uid,
          nombre: `${userData.nombre} ${userData.apellido}`,
          email: userData.email,
          rol: RolUsuario.OPERADOR, // Siempre se registra como OPERADOR (rol 2)
          activo: true,
          createdAt: serverTimestamp()
        };

        const userDocRef = doc(this.firestore, `usuarios/${credential.user.uid}`);
        return from(setDoc(userDocRef, nuevoUsuario)).pipe(
          map(() => nuevoUsuario)
        );
      })
    );
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
}
