import { Injectable } from '@angular/core';
import { DatabaseService } from '../database.service';
import { LoggingProvider } from 'src/app/@shared/logging/log.service';
import { SQLiteDBConnection } from '@capacitor-community/sqlite';

@Injectable({
  providedIn: 'root'
})
export class NotesRepositoryService {
  constructor(
    private db: DatabaseService,
    private logger: LoggingProvider) {}

  getAllNotes(limit: number = undefined) {
    return this.db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT customer, address, date, text FROM notes
        ORDER BY date DESC${(limit != null ? ` LIMIT ${limit}` : '')}`)

      return result.values as IVisitNote[]
    })
  }

  /**
   * Get all (sent) notes for a specific customer
   *
   * @param customerId Customer identifier
   * @param addressId Customer address identifier
   * @param limit Only request a specific amount of notes
   * @returns A list of notes bound to the user
   */
  getCustomerNotes(customerId: number, addressId: number,
    limit: number = undefined): Promise<IVisitNote[]> {
    if (customerId === null || addressId === null) {
      return Promise.resolve([])
    }

    return this.db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT customer, address, date, text
        FROM notes WHERE customer = ? AND address = ?
        ORDER BY date DESC${(limit != null ? ` LIMIT ${limit}` : '')}`,
        [ customerId, addressId ])

      return result.values as IVisitNote[]
    })
  }

  /**
   * Retrieve the last unsent note from the database
   *
   * @param customerId Customer identifier
   * @param addressId Customer address identifier
   * @returns The last unsent note, if any
   */
  getLastUnsentNote(customerId: number, addressId: number): Promise<IUnsentVisitNote> {
    if (customerId == null || addressId == null) {
      return Promise.resolve(null)
    }

    return this.db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT id, customer, address, date, text,
            nextVisit, customerCloseFrom, customerOpenFrom, toSend
          FROM unsentNotes WHERE customer = ? AND address = ?
          ORDER BY date DESC LIMIT 1`,
        [ customerId, addressId ])

      if (result.values?.length === 0) {
        return null
      }

      const unsentNote = result.values[0] as IUnsentVisitNote
      if (unsentNote == null) {
        return null
      }

      unsentNote.toSend = (unsentNote.toSend as unknown) === 1 ? true : false
      unsentNote.date = new Date(unsentNote.date as unknown as string)

      return result.values[0]
    })
  }
  /**
   * Get all unsent/saved notes for a specific customer
   *
   * @param customerId Customer identifier
   * @param addressId Customer address identifier
   * @param limit Only request a specific amount of unsent notes
   * @returns A list of all unsent visit notes
   */
  getUnsentNotes(customerId: number, addressId: number,
    limit: number = undefined): Promise<IUnsentVisitNote[]> {
    if (customerId === null || addressId === null) {
      return Promise.resolve([])
    }

    return this.db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT id, customer, address, date, text,
            nextVisit, customerCloseFrom, customerOpenFrom, toSend
          FROM unsentNotes WHERE customer = ? AND address = ?
          ORDER BY date DESC${(limit != null ? ` LIMIT ${limit}` : '')}`,
        [ customerId, addressId ])

      const resultList = result.values as IUnsentVisitNote[]
      for(const note of resultList) {
        note.toSend = (note.toSend as unknown) === 1 ? true : false
        note.date = new Date(note.date as unknown as string)
      }

      return result.values as IUnsentVisitNote[]
    })
  }

  /**
   * Check if the specific customer has unsaved notes
   *
   * @param customerId Customer identifier
   * @param addressId Customer address identifier
   * @returns Whether or not any unsent notes are found
   */
  hasUnsentNotes(customerId: number, addressId: number): Promise<boolean> {
    return this.db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(`SELECT 1 FROM unsentNotes WHERE customer = ? AND address = ?`,
        [ customerId, addressId ])

      return result.values.length > 0
    })
  }

  /**
   * Save or update a specific note
   *
   * @param note unsent visit note object to save
   * @param send Specify if the note should be queued to send
   * @returns Save success state
   */
  saveNote(note: IUnsentVisitNote, send = false) {
    if (note.id != null && note.id > 0) {
      return this.db.executeQuery<any>(async (db: SQLiteDBConnection) => {
        const result = await db.run(`UPDATE unsentNotes SET date=?, text=?,
            nextVisit=?, customerCloseFrom=?, customerOpenFrom=?, toSend=? WHERE id=?`,
          [
            note.date.toISOString(), // 1
            note.text, // 2
            note.nextVisit, // 3
            note.customerCloseFrom, // 4
            note.customerOpenFrom, // 5
            send ? 1 : 0, // 6
            note.id // 7
          ])

        console.log('DEBUG UPDATE', result)

        return result.changes?.changes > 0
      })
    } else {
      return this.db.executeQuery<any>(async (db: SQLiteDBConnection) => {
        const result = await db.run(`INSERT INTO unsentNotes (customer, address, date, text,
            nextVisit, customerCloseFrom, customerOpenFrom, toSend)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            note.customer, // 1
            note.address, // 2
            note.date.toISOString(), // 3
            note.text, // 4
            note.nextVisit, // 5
            note.customerCloseFrom, // 6
            note.customerOpenFrom, // 7
            send ? 1 : 0 // 8
          ])

        console.log('DEBUG INSERT', result)

        if (result.changes?.changes > 0) {
          note.id = result.changes.lastId
          return true
        }

        return false
      })
    }
  }

  /**
   * Delete a specific note from the unsent notes table
   *
   * @param noteId Note identifier
   * @returns Delete success state
   */
  deleteUnsentNote(noteId: number) {
    return this.db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(`DELETE FROM unsentNotes WHERE id=?`,
        [ noteId ])

      return result.changes?.changes > 0
    })
  }
}

export interface IVisitNote {
  date: Date;
  text: string;
  customer: number;
  address: number;
}

export interface IUnsentVisitNote extends IVisitNote {
  id: number;

  nextVisit: string;
  customerCloseFrom?: string;
  customerOpenFrom?: string;
  toSend: boolean;
}
