import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class NewsRepositoryService {

  constructor(private _db: DatabaseService) { }

  get(customerId: number = 0, addressId: number = 0, culture: string = 'nl-BE'): Promise<INewsT[]> {
    const titleString = (culture === 'nl-BE') ? 'titleNl' : 'titleFr'
    const contentString = (culture === 'nl-BE') ? 'contentNl' : 'contentFr'
    // const nameString = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        `SELECT ${titleString} as title, ${contentString} as content, date
        FROM news
        WHERE (customerId = ? AND addressId = ?) OR
          (customerId = 0 AND addressId = 0)
        ORDER BY date DESC`,
        [
          customerId,
          addressId
        ]
      )

      return result.values as INewsT[]
    })
  }
}

export interface INewsT {
  title: string
  content: string
  date: Date
}