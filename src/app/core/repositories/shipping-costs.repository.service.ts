import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class ShippingCostsRepositoryService {
  constructor(private _db: DatabaseService) { }

  get(customer: number, address: number): Promise<IShippingCost[]> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        `SELECT amount, threshold
        FROM shippingCosts
        WHERE customerId = ? AND addressId = ?
        ORDER BY threshold DESC`,
        [
          customer,
          address
        ]
      )

      return result.values as IShippingCost[]
    })
  }
}

export interface IShippingCost {
  amount: number
  threshold: number
}
