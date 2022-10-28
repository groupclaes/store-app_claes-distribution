import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class RecipesRepositoryService {

  constructor(private _db: DatabaseService) { }

  getDetail(guid: string, culture: string = 'nl-BE'): Promise<IRecipeDetailT | undefined> {
    const nameString = culture === 'nl-BE' ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        'SELECT * FROM recipes WHERE guid = ?',
        [
          guid
        ]
      )

      if (result.values.length === 0) {
        return undefined
      }

      const recipe = result.values[0] as IRecipe
      const products = JSON.parse(recipe.products)
      const response: IRecipeDetailT = { ...recipe, products: []}
      for (let itemnum of products) {
        const productResult = await db.query(`
        SELECT itemnum, products.id,products.${nameString} as name,packingUnits.${nameString} as unit
        FROM products
        INNER JOIN packingUnits ON products.packId = packingUnits.id
        WHERE EXISTS (SELECT * FROM currentExceptions WHERE currentExceptions.productId = products.id) AND products.itemnum = ?`, [itemnum])
        if (productResult.values.length > 0) {
          response.products.push(productResult.values[0] as IRecipeDetailProductT)
        }
      }

      return response
    })
  }

  queryLimit(query: string, culture: string, start: number, amount: number): Promise<IRecipe[]> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        'SELECT * FROM recipes WHERE name LIKE ? AND languages LIKE ? LIMIT ?,?',
        [
          query,
          culture,
          start,
          amount
        ]
      )

      return result.values as IRecipe[]
    })
  }
}

export interface IRecipe {
  guid: string
  name: string
  languages: string
  products: string
}

export interface IRecipeDetailT {
  guid: string
  name: string
  products: IRecipeDetailProductT[]
}

export interface IRecipeDetailProductT {
  id: number
  itemnum: string
  name: string
  unit: string
}