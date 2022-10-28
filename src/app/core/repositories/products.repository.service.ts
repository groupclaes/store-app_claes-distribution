import { Injectable } from '@angular/core'
import { Changes, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class ProductsRepositoryService {

  constructor(private _db: DatabaseService) { }

  get(): Promise<IProduct[]> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        'SELECT * FROM products'
      )

      return result.values as IProduct[]
    })
  }
}

export interface IProduct {
  /* Unique identifier */
  id: number
  groupId: number
  packId: number
  itemnum: string
  nameNl: string
  nameFr: string
  type: string
  isNew: boolean
  c1: number
  c2: number
  c3: number
  c4: number
  c5: number
  c6: number
  stackSize: number
  minOrder: number
  deliverTime: number
  ean: string
  supplierItemIdentifier: string
  relativeQuantity: number
  queryWordsNl: string
  queryWordsFr: string
  sortOrder: number
  AvailableOn?: Date
  contentQuantity?: number
  contentUnit?: number
}