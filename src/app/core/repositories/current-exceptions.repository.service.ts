import { Injectable } from '@angular/core'
import { Changes, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class CurrentExceptionsRepositoryService {

  constructor(private _db: DatabaseService) { }

  get(): Promise<ICurrentException[]> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        'SELECT * FROM currentExceptions'
      )

      return result.values as ICurrentException[]
    })
  }

  delete(): Promise<Changes> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(
        'DELETE FROM currentExceptions'
      )

      return result.changes
    })
  }
}

export interface ICurrentException {
  productId: number
}