import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class CartsRepositoryService {
  constructor(private _db: DatabaseService) { }

  deleteOld(days: number) {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const date = new Date()
      const ninetyDaysAgo = new Date(date.getTime() - (days * 24 * 60 * 60 * 1000))
        .toISOString()
      console.log(`deleting carts older than ${days} days`)

      const result = await db.run(
        'DELETE FROM carts WHERE sendDate < ? AND sendOK = ?',
        [ninetyDaysAgo, true]
      )

      return result.changes
    })
  }
}
