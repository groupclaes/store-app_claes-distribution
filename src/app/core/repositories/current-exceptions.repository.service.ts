import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class CurrentExceptionsRepositoryService {

  constructor(private _db: DatabaseService) { }

  delete() {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(
        'DELETE FROM currentExceptions'
      )

      return result.changes
    })
  }
}
