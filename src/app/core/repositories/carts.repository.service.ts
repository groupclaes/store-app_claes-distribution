import { Injectable } from '@angular/core'
import { SQLiteDBConnection } from '@capacitor-community/sqlite'
import { LoggingProvider } from 'src/app/@shared/logging/log.service'
import { DatabaseService } from '../database.service'
import { Customer } from '../user.service'
import { CustomersRepositoryService } from './customers.repository.service'
import { IProductInfoT, IProductOrderInfo, IProductPricesOverview, ProductsRepositoryService } from './products.repository.service'

@Injectable({
  providedIn: 'root'
})
export class CartsRepositoryService {
  constructor(
    private _db: DatabaseService,
    private logger: LoggingProvider,
    private productsRepo: ProductsRepositoryService,
    private customersRepo: CustomersRepositoryService
  ) { }

  init() {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      await db.execute('CREATE TABLE IF NOT EXISTS carts (id INTEGER PRIMARY KEY, name STRING, customer INTEGER, address INTEGER, '
        + 'serverDate DATETIME, lastChangeDate DATETIME, sendDate DATETIME, send BOOLEAN, sendOk BOOLEAN, active BOOLEAN)')
      await db.execute('CREATE TABLE IF NOT EXISTS cartSettings (cart INTEGER UNIQUE, reference STRING, nextDelivery BOOLEAN, '
        + 'deliveryDate DATETIME, deliveryMethod STRING, deliveryOption STRING, comments STRING, commentsPlanning STRING, '
        + 'commentsInvoice STRING, commentsDriver STRING, acceptedTerms BOOLEAN, offer BOOLEAN)')
      await db.execute('CREATE TABLE IF NOT EXISTS cartProducts (cart INTEGER, product INTEGER, amount INTEGER, '
      + 'PRIMARY KEY (cart, product))')
    })
  }

  changeActive(id: number = 0) {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.executeSet([
        {
          statement: 'UPDATE carts SET active = 1 WHERE id = ?',
          values: [id]
        }, {
          statement: 'UPDATE carts SET active = 0 WHERE id != ?',
          values: [id]
        }
      ])

      return result.changes?.changes > 0
    })
  }

  removeAllActive() {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query('UPDATE carts SET active = 0')

      return result.values?.length > 0
    })
  }

  deleteOld(days: number) {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const date = new Date()
      const ninetyDaysAgo = new Date(date.getTime() - (days * 24 * 60 * 60 * 1000))
        .toISOString()
      this.logger.log(`deleting carts older than ${days} days`)

      // How about you just eat a dick and work, alright?!
      const result = await db.run(
        'DELETE FROM carts WHERE sendDate < ? AND sendOK = 1',
        [ninetyDaysAgo]
      )

      return result.changes?.changes
    })
  }

  create(cart: any): Promise<boolean> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      await db.execute('UPDATE carts SET active = 0')

      if (cart.lastChangeDate) {
        cart.lastChangeDate = cart.lastChangeDate.toISOString()
      }

      const result = await db.run(
        `INSERT INTO carts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cart.id,
          cart.name,
          cart.customer,
          cart.address,
          cart.serverDate,
          cart.lastChangeDate,
          cart.sendDate,
          cart.send ? 1 : 0,
          cart.sendOk ? 1 : 0,
          cart.active ? 1 : 0
        ]
      )

      return result.changes?.changes > 0
    })
  }

  delete(id: number): Promise<boolean> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.executeSet([{
        statement: `DELETE FROM cartProducts WHERE cart = ?`,
        values: [id]
      }, {
        statement: `DELETE FROM cartSettings WHERE cart = ?`,
        values: [id]
      }, {
        statement: `DELETE FROM carts WHERE id = ?`,
        values: [id]
      }])

      return result.changes?.changes > 0
    })
  }

  failedCount(): Promise<number> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.query('SELECT id FROM carts WHERE send = 1 AND sendOk = 0')

      return result.values?.length || 0
    })
  }

  load(id: number, culture: string = 'nl-BE'): Promise<ICartDetailS> {
    const nameString = culture === 'nl-BE' ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      // get all unsend carts
      try {
        const result = await db.query(
          `SELECT cart.id,
          cart.name,
          cart.customer,
          c.name as customerName,
          cart.address,
          c.addressName,
          cart.send,
          cart.sendOk,
          cart.active,
          cart.serverDate,
          cart.lastChangeDate,
          cart.sendDate
        FROM carts AS cart
        INNER JOIN customers AS c ON cart.customer = c.id AND cart.address = c.addressId
        WHERE cart.id = ?`,
          [ id ]
        )

        if (result.values.length === 0) {
          // return empty array if we didn't find any record
          return []
        }

        const cart = result.values[0] as ICartDetailS
        const customer = await this.customersRepo.get<Customer>(cart.customer, cart.address)

        // loop through all records to get products in cart
        cart.products = []
        cart.active = (cart.active as any) === 1 ? true : false
        cart.send = (cart.send as any) === 1 ? true : false
        cart.sendOk = (cart.sendOk as any) === 1 ? true : false

        const productsResult = await db.query(`
        SELECT cp.amount,
          p.itemnum,
          p.id,
          p.${nameString} as name,
          pu.${nameString} as unit,
          p.url,
          p.color,
          p.minOrder,
          p.stackSize
        FROM cartProducts AS cp
        LEFT OUTER JOIN products AS p ON cp.product = p.id
        LEFT OUTER JOIN packingUnits AS pu ON p.packId = pu.id
        WHERE cp.cart = ?
          AND EXISTS (
            SELECT *
            FROM currentExceptions
            WHERE currentExceptions.productId = p.id
          )`, [
          id
        ])

        if (productsResult.values?.length > 0) {
          cart.products = productsResult.values

          for (const product of cart.products) {
            const prices = await this.productsRepo.getPrices(product.id, customer, db)
            if (prices.basePrice > 0) {
              product.prices = prices.prices
              product.basePrice = prices.basePrice
            }
          }
        }

        const settingsResult = await db.query(`
          SELECT *
          FROM cartSettings
          WHERE cart = ?`, [
          id
        ])

        if (settingsResult.values?.length > 0) {
          const settings = settingsResult.values[0]
          cart.settings = {
            reference: settings.reference,
            nextDelivery: settings.nextDelivery === 'true' || settings.nextDelivery === true,
            deliveryDate: settings.deliveryDate,
            deliveryMethod: settings.deliveryMethod,
            deliveryOption: settings.deliveryOption,
            comments: settings.comments,
            commentsPlanning: settings.commentsPlanning,
            commentsInvoice: settings.commentsInvoice,
            commentsDriver: settings.commentsDriver,
            acceptedTerms: settings.nextDelivery === 'acceptedTerms',
            // eslint-disable-next-line eqeqeq
            offer: settings.offer != 0
          }
        } else {
          await db.run(`INSERT INTO cartSettings VALUES (?, '', 0, NULL, 'deliver', 'fastest', '', '', '', '', 0, 0)`, [
            cart.id,
            // '', // reference
            // 0, // nextDelivery
            // null, // deliveryDate
            // 'deliver', // deliveryMethod
            // 'fastest', // deliveryOption
            // '', // comments
            // '', // commentsPlanning
            // '', // commentsInvoice
            // '', // commentsDriver
            // 0, // acceptedTerms,
            // 0 // offer
          ])
          cart.settings = {
            reference: '',
            nextDelivery: false,
            deliveryDate: null,
            deliveryMethod: 'deliver',
            deliveryOption: 'fastest',
            comments: '',
            commentsPlanning: '',
            commentsInvoice: '',
            commentsDriver: '',
            acceptedTerms: false,
            offer: false
          }
        }

        return cart
      } catch (err) {
        console.error(err)
        throw err
      }
    })
  }

  loadUnsent(culture: string = 'nl-BE'): Promise<ICartDetail[]> {
    return this.loadCarts(true, culture)
  }

  loadSentFailed() {
    //
  }

  loadCarts(unsent: boolean = false, culture: string = 'nl-BE'): Promise<ICartDetail[]> {
    const nameString = culture === 'nl-BE' ? 'nameNl' : 'nameFr'

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      // get all unsend carts
      try {
        const result = await db.query(
          `SELECT cart.id,
            cart.name,
            cart.customer,
            c.name as customerName,
            cart.address,
            c.addressName,
            cart.send,
            cart.sendOk,
            cart.active,
            cart.serverDate,
            cart.lastChangeDate,
            cart.sendDate
          FROM carts AS cart
          INNER JOIN customers AS c ON cart.customer = c.id AND cart.address = c.addressId`
            + (unsent !== undefined ? ' WHERE cart.send = ?' : '')
            + ' ORDER BY cart.sendOK ASC, cart.sendDate DESC',
          (unsent !== undefined) ? [unsent ? 0 : 1] : undefined
      )

        if (result.values.length === 0) {
          // return empty array if we didn't find any record
          return []
        }

        // loop through all records to get products in cart
        for (const cart of result.values) {
          cart.products = []
          cart.send = cart.send === 1 ? true : false
          cart.sendOk = cart.sendOk === 1 ? true : false
          cart.active = cart.active === 1 ? true : false

          const productsResult = await db.query(`
          SELECT cp.amount,
            p.itemnum,
            p.id,
            p.${nameString} as name,
            pu.${nameString} as unit,
            p.url,
            p.color
          FROM cartProducts AS cp
          LEFT OUTER JOIN products AS p ON cp.product = p.id
          LEFT OUTER JOIN packingUnits AS pu ON p.packId = pu.id
          WHERE cp.cart = ?
            AND EXISTS (
              SELECT *
              FROM currentExceptions
              WHERE currentExceptions.productId = p.id
            )`, [
            cart.id
          ])

          if (productsResult.values?.length > 0) {
            cart.products = productsResult.values
          }
        }

        return result.values as ICartDetail[]

      } catch (err) {
        console.error(err)
        throw err
      }
    })
  }

  addProduct(id: number, productId: number, amount: number): Promise<boolean> {
    this.logger.debug('CartsRepositoryService.addProduct(id, productId, amount):', id, productId, amount)
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(`INSERT OR REPLACE INTO cartProducts (cart, product, amount) VALUES (?, ?, ?)`, [
        id,
        productId,
        amount
      ])

      if (result.changes?.changes > 0) {
        this.logger.debug(`CartsRepositoryService.addProduct() -- successfully added product`)
      }

      return result.changes?.changes > 0
    })
  }

  removeProduct(id: number, productId: number): Promise<boolean> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(`DELETE FROM cartProducts WHERE cart = ? and product = ?`, [
        id,
        productId
      ])

      return result.changes?.changes > 0
    })
  }

  updateProduct(id: number, productId: number, amount: number): Promise<boolean> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(
        `UPDATE cartProducts SET amount = ? WHERE cart = ? and product = ?`,
        [
          amount,
          id,
          productId
        ]
      )

      return result.changes?.changes > 0
    })
  }

  updateSend(id: number, send: boolean = true): Promise<boolean> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(
        `UPDATE carts SET sendDate = ?, send = ? WHERE id = ?`,
        [
          new Date().toISOString(),
          send ? 1 : 0,
          id
        ]
      )

      return result.changes?.changes > 0
    })
  }

  updateSendOk(cart: ICartDetail | number, sendOk: boolean = true): Promise<boolean> {
    let cartObject
    if (!(cart instanceof Number)) {
      cartObject = (cart as ICartDetail)

      cartObject.active = false
      cartObject.sendOk = sendOk
    }

    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run(
        'UPDATE carts SET sendOk = ?, active=0 WHERE id = ?',
        [
          sendOk ? 1 : 0,
          (cartObject != null) ? cartObject.id : cart
        ]
      )
      return result.changes?.changes > 0
    })
  }

  updateSettings(id: number, settings: any): Promise<boolean> {
    return this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
      const result = await db.run('UPDATE cartSettings SET reference=?, nextDelivery=?, deliveryDate=?, '
        + 'deliveryMethod=?, deliveryOption=?, comments=?, commentsPlanning=?, commentsInvoice=?, commentsDriver=?, '
        + 'acceptedTerms=?, offer=? WHERE cart = ?',
        [
          settings.reference,
          settings.nextDelivery ? 1 : 0,
          settings.deliveryDate,
          settings.deliveryMethod,
          settings.deliveryOption,
          settings.comments,
          settings.commentsPlanning,
          settings.commentsInvoice,
          settings.commentsDriver,
          settings.acceptedTerms ? 1 : 0,
          settings.offer ? 1 : 0,
          id
        ]
      )

      return result.changes?.changes > 0
    })
  }

  getSettings() {}
}

export interface ICartDetail {
  id: number;
  name: string;
  customer: number;
  customerName?: string;
  address: number;
  addressName?: string;
  serverDate: Date;
  lastChangeDate: Date;
  sendDate: Date;
  send: boolean;
  sendOk: boolean;
  active: boolean;
  products: ICartDetailProductT[];
  settings?: ICartDetailSettings;
}

export interface ICartDetailS extends ICartDetail {
  settings: ICartDetailSettings;
  products: ICartDetailProductA[];
}

export interface ICartDetailProductT extends IProductInfoT {
  amount: number;
}

export interface ICartDetailProductA extends ICartDetailProductT, IProductPricesOverview, IProductOrderInfo {
}

export interface ICartDetailSettings {
  reference: string;
  nextDelivery: boolean;
  deliveryDate: string;
  deliveryMethod: string;
  deliveryOption: string;
  comments: string;
  commentsPlanning: string;
  commentsInvoice: string;
  commentsDriver: string;
  commentsMachines?: string;
  acceptedTerms: boolean;
  offer: boolean;
}
