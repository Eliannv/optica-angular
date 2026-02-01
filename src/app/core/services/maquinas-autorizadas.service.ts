import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { MaquinaAutorizada } from '../models/maquina-autorizada.model';

@Injectable({
  providedIn: 'root',
})
export class MaquinasAutorizadasService {
  private collectionName = 'maquinas_autorizadas';

  constructor(private firestore: Firestore) {}

  /**
   * Obtener todas las máquinas autorizadas
   */
  getMaquinasAutorizadas(): Observable<MaquinaAutorizada[]> {
    const colRef = collection(this.firestore, this.collectionName);
    return collectionData(colRef, { idField: 'id' }).pipe(
      map((maquinas: any[]) =>
        maquinas.map((m) => this.convertirTimestamps(m))
      )
    );
  }

  /**
   * Obtener máquinas de una sucursal específica
   */
  getMaquinasPorSucursal(sucursal: string): Observable<MaquinaAutorizada[]> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(colRef, where('sucursal', '==', sucursal));
    return collectionData(q, { idField: 'id' }).pipe(
      map((maquinas: any[]) =>
        maquinas.map((m) => this.convertirTimestamps(m))
      )
    );
  }

  /**
   * Verificar si un machine ID está autorizado
   * Retorna la máquina si está activa, null si no
   */
  async verificarMaquinaAutorizada(
    machineId: string
  ): Promise<MaquinaAutorizada | null> {
    const colRef = collection(this.firestore, this.collectionName);
    const q = query(
      colRef,
      where('machineId', '==', machineId),
      where('activo', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Actualizar último acceso
    await this.actualizarUltimoAcceso(doc.id);

    return this.convertirTimestamps({ ...data, id: doc.id });
  }

  /**
   * Registrar o actualizar una máquina autorizada
   */
  async guardarMaquina(
    maquina: Partial<MaquinaAutorizada>,
    autorizadoPor?: string
  ): Promise<void> {
    const maquinaId = maquina.id || maquina.machineId;
    if (!maquinaId) {
      throw new Error('Se requiere ID o machineId');
    }

    const docRef = doc(this.firestore, this.collectionName, maquinaId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // Actualizar existente
      const updateData: any = { ...maquina };
      delete updateData.fechaRegistro; // No modificar fecha de registro
      delete updateData.id; // Eliminar el id del objeto a guardar
      await updateDoc(docRef, updateData);
    } else {
      // Crear nueva
      const nuevaMaquina: any = {
        ...maquina,
        fechaRegistro: new Date(),
        activo: maquina.activo ?? true,
        autorizadoPor: autorizadoPor || null,
      };
      delete nuevaMaquina.id;
      await setDoc(docRef, nuevaMaquina);
    }
  }

  /**
   * Activar/Desactivar una máquina
   */
  async cambiarEstadoMaquina(
    maquinaId: string,
    activo: boolean
  ): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, maquinaId);
    await updateDoc(docRef, { activo });
  }

  /**
   * Eliminar una máquina (soft delete - mejor desactivar)
   */
  async eliminarMaquina(maquinaId: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, maquinaId);
    await deleteDoc(docRef);
  }

  /**
   * Actualizar el último acceso de una máquina
   */
  private async actualizarUltimoAcceso(maquinaId: string): Promise<void> {
    const docRef = doc(this.firestore, this.collectionName, maquinaId);
    await updateDoc(docRef, { ultimoAcceso: new Date() });
  }

  /**
   * Registrar máquinas iniciales (migración de IDs hardcodeados)
   */
  async registrarMaquinasIniciales(autorizadoPor: string): Promise<void> {
    const maquinasIniciales: Partial<MaquinaAutorizada>[] = [
      {
        machineId: '858744ddedd2fca1',
        sucursal: 'DESARROLLO_1',
        nombreMaquina: 'PC Desarrollo 1',
        activo: true,
        observaciones: 'Máquina de desarrollo principal',
      },
      {
        machineId: 'e1561953fadb3e82',
        sucursal: 'DESARROLLO_2',
        nombreMaquina: 'PC Desarrollo 2',
        activo: true,
        observaciones: 'Máquina de desarrollo secundaria',
      },
      {
        machineId: '45dfe499c7a935ed',
        sucursal: 'PASAJE',
        nombreMaquina: 'PC Sucursal Pasaje',
        activo: true,
        observaciones: 'Sucursal Pasaje',
      },
      {
        machineId: 'd87cced3d5d6611b',
        sucursal: 'MACHALA',
        nombreMaquina: 'PC Sede Principal Machala',
        activo: true,
        observaciones: 'Sede principal - Administración',
      },
    ];

    for (const maquina of maquinasIniciales) {
      await this.guardarMaquina(maquina, autorizadoPor);
    }
  }

  /**
   * Convertir Timestamps de Firestore a Date
   */
  private convertirTimestamps(data: any): MaquinaAutorizada {
    return {
      ...data,
      fechaRegistro:
        data.fechaRegistro instanceof Timestamp
          ? data.fechaRegistro.toDate()
          : data.fechaRegistro,
      ultimoAcceso:
        data.ultimoAcceso instanceof Timestamp
          ? data.ultimoAcceso.toDate()
          : data.ultimoAcceso,
    };
  }
}
