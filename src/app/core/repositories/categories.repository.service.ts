import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from '../database.service'

@Injectable({
  providedIn: 'root'
})
export class CategoriesRepositoryService {

  constructor(private _db: DatabaseService) { }

  get(culture: string = 'nl-BE'): Promise<ICategoryT[]> {
    const nameString = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        `SELECT categories.id, categories.${nameString} as name FROM categories`
      )

      return result.values as ICategoryT[]
    })
  }

  getAssortment(culture: string = 'nl-BE', id?: number): Promise<ICategoryT[]> {
    const nameString = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      let result
      let categories: ICategoryT[] = []

      if (!id) {
        result = await db.query(
          `SELECT categories.id, categories.${nameString} as name
           FROM categories
           WHERE categories.parentId IS NULL
           ORDER BY categories.position`
        )
      } else {
        result = await db.query(
          `SELECT categories.id, categories.${nameString} as name
           FROM categories
           WHERE categories.id = ?
           ORDER BY categories.position`,
          [
            id
          ]
        )
      }
      categories = result.values as ICategoryT[]

      for (const category of categories) {
        result = await db.query(
          `SELECT categories.id, categories.parentId, categories.${nameString} as name, COUNT(products.id) as products
           FROM categories
           INNER JOIN products ON products.c1 = categories.id
            OR products.c2 = categories.id
            OR products.c3 = categories.id
            OR products.c4 = categories.id
            OR products.c5 = categories.id
            OR products.c6 = categories.id
           WHERE categories.parentId = ? AND EXISTS (
            SELECT * FROM currentExceptions
            WHERE currentExceptions.productId = products.id
           )
           GROUP BY categories.id, categories.parentId ORDER BY categories.position`,
          [
            category.id
          ]
        )
        category.categories = result.values as ICategoryST[]
      }

      return categories
    })
  }

  find(id: number, culture: string = 'nl-BE'): Promise<ICategoryT> {
    const nameString = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        `SELECT categories.id, categories.${nameString} as name FROM categories WHERE categories.id = ? ORDER BY categories.position`,
        [
          id
        ]
      )

      return result.values[0] as ICategoryT
    })
  }

  findChildren(id: number, culture: string = 'nl-BE'): Promise<ICategoryT[]> {
    const nameString = (culture === 'nl-BE') ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query(
        `SELECT categories.id, categories.${nameString} as name FROM categories WHERE categories.parentId = ? ORDER BY categories.position`,
        [
          id
        ]
      )

      return result.values as ICategoryT[]
    })
  }
}

export interface ICategory {
  id: number
  parentId?: number
  position: number
  nameNl: string
  nameFr: string
  descriptionNl: string
  descriptionFr: string
}

export interface ICategoryT {
  id: number
  name: string
  categories: ICategoryST[]
}

export interface ICategoryST {
  id: number
  name: string
  parentId: number
  products: number
}
