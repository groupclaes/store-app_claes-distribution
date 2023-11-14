import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class ReportsRepositoryService {

  constructor(private _db: DatabaseService) { }

  get(agentAccess: boolean, culture: string): Promise<IReport[]> {
    const nameString = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        `SELECT id, ${nameString} as name, extension FROM reports WHERE onlyAgent = ? OR onlyAgent IS FALSE`,
        [
          agentAccess
        ]
      )

      return result.values as IReportT[]
    })
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IReport {

}

export interface IReportT {
  id: number;
  name: string;
  extension: string;
}
