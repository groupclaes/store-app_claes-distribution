import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class CustomersRepositoryService {

  constructor(private _db: DatabaseService) { }

  get<T>(id?: number, address?: number): Promise<T> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      if (!id && !address) {
        const result = await db.query(
          'SELECT * FROM customers'
        )

        return result.values as T[]
      }
      const result = await db.query(
        `SELECT *
        FROM customers
        WHERE id = ? AND addressId = ?`,
        [
          id,
          address
        ]
      )

      if (result.values?.length === 1) {
        return result.values[0] as T
      }

      return result.values as T[]
    })
  }
}
