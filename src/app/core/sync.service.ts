import { environment } from './../../environments/environment'
import { ApiService } from './api.service'
import { Injectable } from '@angular/core'
import { LoggingProvider } from '../@shared/logging/log.service'
import { StorageProvider } from './storage-provider.service'
import { capSQLiteSet, Changes, SQLiteDBConnection } from '@capacitor-community/sqlite'
import { DatabaseService } from './database.service'
import { AppCredential, AppCustomerModel } from './user.service'
import { timeout } from 'rxjs/operators'

const TIMEOUT_INTERVAL = 240000

@Injectable({
  providedIn: 'root'
})
export class SyncService {
  private _checksum: Array<Store> = []

  constructor(
    private api: ApiService,
    private storage: StorageProvider,
    private logger: LoggingProvider,
    private _db: DatabaseService
  ) { }

  async checkDB(): Promise<boolean> {
    let ok = false

    await this._db.executeQuery(async (db: SQLiteDBConnection) => {
      ok = true

      await db.execute('DROP TABLE IF EXISTS images')
      await db.execute('CREATE TABLE IF NOT EXISTS dataIntegrityChecksums (dataTable STRING PRIMARY KEY, checksum STRING, dateChanged DATETIME);CREATE UNIQUE INDEX IF NOT EXISTS idx_dataIntegrityChecksums_dataTable ON dataIntegrityChecksums(dataTable)')

      const version = this.storage.get('_db_version')
      this.logger.log(`database ${environment.database_name} has been opened in CheckDB!`, version)
    })

    return ok
  }

  async Initialize(): Promise<boolean> {
    this.logger.log(`SyncService.Initialize() -- start`)
    const check = await this.checkDB()
    this.logger.log(`SyncService.Initialize() -- after checkdb`)
    const checksum = await this.loadIntegrity()
    this.logger.log(`SyncService.Initialize() -- loaded integrity checksum: ${checksum}`)

    if (!checksum) {
      // this is first run or db issue, add loggin here in future versions
      return check
    }

    this.logger.log(`SyncService.Initialize() -- end`)
    return checksum && check
  }

  public async loadIntegrity(): Promise<boolean> {
    this.logger.log(`SyncService.loadIntegrity() -- start`)
    let result = []

    await this._db.executeQuery(async (db: SQLiteDBConnection) => {
      const sqlResult = await db.query(`SELECT * FROM dataIntegrityChecksums`)
      this.logger.log(`SyncService.loadIntegrity() -- after select`)

      if (!sqlResult.values || sqlResult.values.length <= 0) {
        return false
      }

      for (let i = 0; i < sqlResult.values.length; i++) {
        const value: Store = sqlResult.values[i]
        value.dateChanged = new Date(value.dateChanged) || new Date()
        result.push(value)
      }
    })

    this._checksum = result

    this.logger.log(`SyncService.loadIntegrity() -- end`)
    return true
  }

  /**
   * Full sync procedure for app db
   * @param {AppCredential} credential user credentials to determine data-access
   * @param {string} [culture] cultures thet will be synced to db
   * @param {boolean} [force] if true syncronisation and rebuld of table will be forced
   * @returns {Observable<boolean>}
   * @memberof SyncService
   */
  public async fullSync(credential: AppCredential, culture?: string, forceSync?: boolean) {
    this.logger.log(`SyncService.FullSync() -- start`)
    culture = culture || 'all'

    return new Promise<boolean>(async (resolve, reject) => {
      var timertje = setTimeout(() => {
        return reject('timeout_err')
      }, TIMEOUT_INTERVAL)

      this.logger.log('SyncService.FullSync() -- await promises')

      // We used to do a single full sync (running all calls at the same time)
      // But this concurrency is not handled well in the 'new' Capacitor SQLite library, so we changed this to be in 4 steps

      const step1 = await Promise.all([
        this.syncProducts(credential, culture, forceSync),
        this.syncPackingUnits(credential, culture, forceSync),
        this.syncAttributes(credential, culture, forceSync),
        this.syncProductRelations(credential, culture, forceSync),
        this.syncCategories(credential, culture, forceSync),
        this.syncCategoryAttributes(credential, culture, forceSync)
      ])

      const step2 = await Promise.all([
        this.syncFavorites(credential, culture, forceSync),
        this.syncPrices(credential, culture, forceSync),
        this.syncProductExceptions(credential, culture, forceSync),
        this.syncProductTaxes(credential, culture, forceSync),
        this.syncShippingCosts(credential, culture, forceSync),
        this.syncProductDescriptionCustomers(credential, culture, forceSync),
        this.syncNews(credential, culture, forceSync)
      ])

      const step3 = await Promise.all([
        this.syncReports(credential, culture, forceSync),
        this.syncRecipes(credential, culture, forceSync),
        this.syncDatasheets(credential, culture, forceSync),
        this.syncUsageManuals(credential, culture, forceSync),
        this.syncRecipesModule(credential, culture, forceSync)
      ])

      const step4 = await Promise.all([
        this.syncContacts(credential, culture, forceSync),
        this.syncDeliverySchedules(credential, culture, forceSync),
        this.syncCustomers(credential, culture, forceSync),
        this.syncNotes(credential, culture, forceSync)
      ])

      await this.syncDepartments(credential, culture, forceSync)

      const results = step1.concat(step2, step3, step4)

      this.logger.log('SyncService.FullSync() -- promises completed')

      window.clearTimeout(timertje)
      if (results.some(e => e === 'timeout_err')) {
        return reject('timeout_err')
      }

      await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
        this.logger.log('CREATE TABLE IF NOT EXISTS customers')
        await db.execute('CREATE TABLE IF NOT EXISTS customers (id INTEGER, addressId INTEGER, addressGroupId INTEGER, userCode INTEGER, userType INTEGER, name STRING, address STRING, streetNum STRING, zipCode STRING, city STRING, country STRING, phoneNum STRING, vatNum STRING, language STRING, promo BOOLEAN, fostplus BOOLEAN, bonusPercentage REAL, addressName STRING, delvAddress STRING, delvStreetNum STRING, delvZipCode STRING, delvCity STRING, delvCountry STRING, delvPhoneNum STRING, delvLanguage STRING, PRIMARY KEY (id, addressId))', false)
        this.logger.log('CREATE TABLE IF NOT EXISTS productDescriptionCustomers')
        await db.execute('CREATE TABLE IF NOT EXISTS productDescriptionCustomers (id INTEGER PRIMARY KEY, description STRING)', false)

        await this.updateDataIntegrityChecksum(db, 'lastSync', 'distribution-checksum-sha')
      })
      const checksum = await this.loadIntegrity()

      this.logger.log(`SyncProvider.FullSync() -- end`)
      return resolve(checksum)
    })
  }

  async syncProducts(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProducts()`)
      const response = await this.api.post<any>('app/products', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'products')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.products && response.products.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS products')
          await db.execute('DROP TABLE IF EXISTS productTexts')
          await db.execute('DROP TABLE IF EXISTS productAttributes')
          await db.execute('DROP TABLE IF EXISTS productAllergens')

          await db.execute('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, groupId INTEGER, packId INTEGER, itemnum STRING, nameNl STRING, nameFr STRING, [type] STRING, isNew BOOLEAN, c1 INTEGER, c2 INTEGER, c3 INTEGER, c4 INTEGER, c5 INTEGER, c6 INTEGER, stackSize INTEGER, minOrder INTEGER, deliverTime INTEGER, ean STRING, supplierItemIdentifier STRING, relativeQuantity INTEGER, queryWordsNl STRING, queryWordsFr STRING, sortOrder INTEGER, AvailableOn DateTime NULL, contentQuantity INTEGER NULL, contentUnit INTEGER NULL, url STRING, color STRING NULL)')
          await db.execute('CREATE TABLE IF NOT EXISTS productTexts (id INTEGER PRIMARY KEY, descriptionNl STRING, descriptionFr STRING, groupNameNl STRING, groupNameFr STRING, PromoNl STRING, PromoFr STRING)')
          await db.execute('CREATE TABLE IF NOT EXISTS productAttributes (attribute INTEGER, product INTEGER, PRIMARY KEY (attribute, product))')
          await db.execute('CREATE TABLE IF NOT EXISTS productAllergens (product INTEGER, code STRING, value STRING, PRIMARY KEY (product, code))')
          await db.execute('DROP INDEX IF EXISTS products_category_ids')
          await db.execute('CREATE INDEX IF NOT EXISTS products_category_ids ON products (c1, c2, c3, c4, c5, c6)')
          await db.execute('DROP INDEX IF EXISTS products_itemnum')
          await db.execute('CREATE INDEX IF NOT EXISTS products_itemnum ON products (id, itemnum)')

          const sqlStatements: capSQLiteSet[] = []
          response.products.forEach(async (product: any) => {
            const nameNl: string = (product.name && product.name.nl) ? product.name.nl : null
            const nameFr: string = (product.name && product.name.fr) ? product.name.fr : null
            const descriptionNl: string = (product.description && product.description.nl) ? product.description.nl : null
            const descriptionFr: string = (product.description && product.description.fr) ? product.description.fr : null
            const groupNameNl: string = (product.groupName && product.groupName.nl) ? product.groupName.nl : null
            const groupNameFr: string = (product.groupName && product.groupName.fr) ? product.groupName.fr : null
            const promoNl: string = (product.promotext && product.promotext.nl) ? product.promotext.nl : null
            const promoFr: string = (product.promotext && product.promotext.fr) ? product.promotext.fr : null
            const supplierItemIdentifier: string = product.supplierItemIdentifier ? product.supplierItemIdentifier : null
            const queryWordsNl: string = product.queryWordsNl && product.queryWordsNl.length ? product.queryWordsNl : null
            const queryWordsFr: string = product.queryWordsFr && product.queryWordsFr.length ? product.queryWordsFr : null

            const query = 'INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'  // 26
            const textQuery = 'INSERT INTO productTexts VALUES (?, ?, ?, ?, ?, ?, ?)' // 7
            const param = [
              product.id,
              product.groupId,
              product.packId,
              product.itemnum,
              nameNl,
              nameFr,
              product.type,
              product.isNew,
              product.c1,
              product.c2,
              product.c3,
              product.c4,
              product.c5,
              product.c6,
              product.stackSize,
              product.minOrder,
              product.deliverTime,
              product.ean,
              supplierItemIdentifier,
              product.relativeQuantity,
              queryWordsNl,
              queryWordsFr,
              product.sortOrder,
              product.availableOn,
              product.contentQuantity,
              product.contentUnit,
              product.url,
              product.color
            ]
            const textParam = [
              product.id,
              descriptionNl,
              descriptionFr,
              groupNameNl,
              groupNameFr,
              promoNl,
              promoFr
            ]
            sqlStatements.push({ statement: query, values: param })
            sqlStatements.push({ statement: textQuery, values: textParam })
            product.attributes.forEach((attribute: number) => {
              sqlStatements.push({
                statement: 'INSERT INTO productAttributes VALUES (?, ?)', values: [
                  attribute,
                  product.id
                ]
              })
            })
            if (product.allergens) {
              product.allergens.forEach((allergen: any) => {
                sqlStatements.push({
                  statement: 'INSERT INTO productAllergens VALUES (?, ?, ?)', values: [
                    product.id,
                    allergen.code,
                    allergen.value
                  ]
                })
              })
            }
          })
          this.logger.debug(`Inserting ${sqlStatements.length} records into various product tables`)
          await db.executeSet(sqlStatements, true)
          this.logger.log('inserted products; checksum', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'products', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncProducts() -- no changes`)
      }

      return true
    } catch (err) {
      if (err.status === 204) {
        return err
      }
      return 'timeout_err'
    }
  }

  async syncPrices(credential: AppCredential, culture?: string, force?: boolean, customerId?: number, addressId?: number) {
    try {
      this.logger.log(`SyncProvider.syncPrices() -- customerId: ${customerId}, addressId: ${addressId}`)

      const response = await this.api.post<any>('app/prices', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'prices')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.prices && response.prices.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS prices')

          await db.execute('CREATE TABLE IF NOT EXISTS prices (product INTEGER, price REAL, pricepromo REAL, stack INTEGER, promo BOOLEAN, discount REAL, customer INTEGER, address INTEGER, [group] INTEGER, PRIMARY KEY (product, customer, address, [group], stack))')
          this.logger.log('dropped prices', 'inserts todo: ', response.prices.length)

          let sqlStatements: capSQLiteSet[] = []
          if (response.prices.length > 40000) {
            const arrays = this.chunkArray(response.prices, 40000)
            arrays.forEach(async (array: any[]) => {
              sqlStatements = []
              array.forEach(async (price: $TSFixMe) => {
                sqlStatements.push({
                  statement: 'INSERT INTO prices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  values: [
                    price.product,
                    price.price,
                    price.pricepromo,
                    price.stack,
                    price.promo,
                    price.discount,
                    price.customer,
                    price.address,
                    price.group
                  ]
                })
              })
              await db.executeSet(sqlStatements)
              this.logger.log('inserted', array.length, 'prices')
            })
          } else {
            response.prices.forEach((price: $TSFixMe) => {
              sqlStatements.push({
                statement: 'INSERT INTO prices VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                values: [
                  price.product,
                  price.price,
                  price.pricepromo,
                  price.stack,
                  price.promo,
                  price.discount,
                  price.customer,
                  price.address,
                  price.group
                ]
              })
            })
            await db.executeSet(sqlStatements)
          }
          this.logger.log('inserted prices', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'prices', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncPrices() -- no changes`)
      }
      return true
    } catch (err) {

    }
  }

  async syncPackingUnits(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncPackingUnits()`)

      const response = await this.api.post<any>('app/packing-units', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'packingUnits')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.packingUnits && response.packingUnits.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS packingUnits')

          await db.execute('CREATE TABLE IF NOT EXISTS packingUnits (id INTEGER PRIMARY KEY, nameNl STRING, nameFr STRING)')

          const sqlStatements: capSQLiteSet[] = []
          response.packingUnits.forEach((packingUnit: $TSFixMe) => {
            const nameNl: string = (packingUnit.name && packingUnit.name.nl) ? packingUnit.name.nl : null
            const nameFr: string = (packingUnit.name && packingUnit.name.fr) ? packingUnit.name.fr : null
            sqlStatements.push({
              statement: 'INSERT INTO packingUnits VALUES (?, ?, ?)',
              values: [
                packingUnit.id,
                nameNl,
                nameFr
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted packing-units', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'packingUnits', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncPackingUnits() -- no changes`)
      }
      return true
    } catch (err) {

    }
  }

  async syncFavorites(credential: AppCredential, culture?: string, force?: boolean, customerId?: number, addressId?: number) {
    try {
      this.logger.log(`SyncProvider.syncFavorites()`)

      const response = await this.api.post<any>('app/favorites', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'favorites')?.checksum ?? '',
        customerId,
        addressId
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.favorites && response.favorites.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS favorites')

          await db.execute('CREATE TABLE IF NOT EXISTS favorites (id INTEGER, cu INTEGER, ad INTEGER, buy INTEGER, pro INTEGER, ret INTEGER, lastB DateTime, lastA INTEGER, hi BOOLEAN, PRIMARY KEY (id, cu, ad))')

          this.logger.log('dropped favorites', 'inserts todo: ', response.favorites.length)
          let sqlStatements: capSQLiteSet[] = []
          if (response.favorites.length > 40000) {
            const arrays = this.chunkArray(response.favorites, 40000)
            arrays.forEach(async (array: any[]) => {
              sqlStatements = []
              array.forEach((favorite: $TSFixMe) => {
                sqlStatements.push({
                  statement: 'INSERT OR IGNORE INTO favorites VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
                  values: [
                    favorite.id,
                    favorite.cu,
                    favorite.ad,
                    favorite.buy,
                    favorite.pro,
                    favorite.ret,
                    favorite.lastB,
                    favorite.lastA,
                    favorite.hi
                  ]
                })
              })
              await db.executeSet(sqlStatements)
              this.logger.log('inserted', array.length, 'favorites')
            })
          } else {
            response.favorites.forEach((favorite: $TSFixMe) => {
              sqlStatements.push({
                statement: 'INSERT OR IGNORE INTO favorites VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)',
                values: [
                  favorite.id,
                  favorite.cu,
                  favorite.ad,
                  favorite.buy,
                  favorite.pro,
                  favorite.ret,
                  favorite.lastB,
                  favorite.lastA,
                  favorite.hi
                ]
              })
            })
            await db.executeSet(sqlStatements)
          }

          this.logger.log('inserted favorites', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'favorites', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncFavorites() -- no changes`)
      }
      return true
    } catch (err) {
    }
  }

  async syncProductExceptions(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProductExceptions()`)

      const response = await this.api.post<any>('app/product-exceptions', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'productExceptions')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.productExceptions && response.productExceptions.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS productExceptions')
          // We used to delete currentExceptions, due to unexpected outcome we changed this temporarily untill a fix is implemented
          // await db.execute('DROP TABLE IF EXISTS currentExceptions')

          await db.execute('CREATE TABLE IF NOT EXISTS productExceptions (customer INTEGER, address INTEGER, addressGroup INTEGER, deny BOOLEAN, list STRING)')
          // await db.execute('CREATE TABLE IF NOT EXISTS currentExceptions (productId INTEGER PRIMARY KEY)')

          this.logger.log('dropped productExceptions')

          let sqlStatements: capSQLiteSet[] = []

          response.productExceptions.forEach((excecption: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO productExceptions VALUES (?, ?, ?, ?, ?)',
              values: [
                excecption.customer,
                excecption.address,
                excecption.addressGroup,
                excecption.deny,
                excecption.list
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted productExceptions', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'productExceptions', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncProductExceptions() -- no changes`)
      }

      return true
    } catch (err) {

    }
  }

  async syncAttributes(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncAttributes()`)

      const response = await this.api.post<any>('app/attributes', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'attributes')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.attributes && response.attributes.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS attributes')

          await db.execute('CREATE TABLE IF NOT EXISTS attributes (id INTEGER PRIMARY KEY, attribute INTEGER, [group] INTEGER, nameNl STRING, nameFr STRING, groupNameNl STRING, groupNameFr STRING)')

          this.logger.log('dropped attributes')

          let sqlStatements: capSQLiteSet[] = []

          response.attributes.forEach((attribute: $TSFixMe) => {
            const nameNl: string = (attribute.name && attribute.name.nl) ? attribute.name.nl : null
            const nameFr: string = (attribute.name && attribute.name.fr) ? attribute.name.fr : null
            const groupNameNl: string = (attribute.groupName && attribute.groupName.nl) ? attribute.groupName.nl : null
            const groupNameFr: string = (attribute.groupName && attribute.groupName.fr) ? attribute.groupName.fr : null
            sqlStatements.push({
              statement: 'INSERT INTO attributes VALUES (?, ?, ?, ?, ?, ?, ?)',
              values: [
                attribute.id,
                attribute.attribute,
                attribute.group,
                nameNl,
                nameFr,
                groupNameNl,
                groupNameFr
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted attributes', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'attributes', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncAttributes() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncCategoryAttributes(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncCategoryAttributes()`)

      const response = await this.api.post<any>('app/category-attributes', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'categoryAttributes')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.categoryAttributes && response.categoryAttributes.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS categoryAttributes')

          await db.execute('CREATE TABLE IF NOT EXISTS categoryAttributes (categoryId INTEGER, groupId INTEGER, PRIMARY KEY (categoryId, groupId))')

          this.logger.log('dropped categoryAttributes')

          let sqlStatements: capSQLiteSet[] = []

          response.categoryAttributes.forEach((categoryAttribute: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO categoryAttributes VALUES (?, ?)',
              values: [
                categoryAttribute.categoryId,
                categoryAttribute.groupId
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted categoryAttributes', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'categoryAttributes', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncCategoryAttributes() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncProductRelations(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProductRelations()`)

      const response = await this.api.post<any>('app/product-relations', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'productRelations')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.productRelations && response.productRelations.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS productRelations')

          await db.execute('CREATE TABLE IF NOT EXISTS productRelations (item INTEGER, product INTEGER, type INTEGER, PRIMARY KEY (item, product, type))')

          this.logger.log('dropped productRelations')

          let sqlStatements: capSQLiteSet[] = []

          response.productRelations.forEach((productRelation: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO productRelations VALUES (?, ?, ?)',
              values: [
                productRelation.item,
                productRelation.product,
                productRelation.type
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted productRelations', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'productRelations', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncProductRelations() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncReports(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncReports()`)

      const response = await this.api.post<any>('app/reports', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'reports')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.reports && response.reports.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS reports')

          await db.execute('CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY, extension INTEGER, nameNl STRING, nameFr STRING, onlyAgent BOOLEAN)')

          this.logger.log('dropped reports')

          let sqlStatements: capSQLiteSet[] = []

          response.reports.forEach((report: $TSFixMe) => {
            const nameNl: string = (report.name && report.name.nl) ? report.name.nl : null
            const nameFr: string = (report.name && report.name.fr) ? report.name.fr : null
            sqlStatements.push({
              statement: 'INSERT INTO reports VALUES (?, ?, ?, ?, ?)',
              values: [
                report.id,
                report.extension,
                nameNl,
                nameFr,
                report.onlyAgent
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted reports', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'reports', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncReports() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncRecipes(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncRecipes()`)

      const response = await this.api.post<any>('app/recipes', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'recipes')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.recipes && response.recipes.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS recipes')

          await db.execute('CREATE TABLE IF NOT EXISTS recipes (guid STRING PRIMARY KEY, name STRING, languages STRING, products STRING)')

          this.logger.log('dropped recipes')

          let sqlStatements: capSQLiteSet[] = []

          response.recipes.forEach((recipe: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO recipes VALUES (?, ?, ?, ?)',
              values: [
                recipe.guid,
                recipe.name,
                JSON.stringify(recipe.languages),
                JSON.stringify(recipe.products)
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted recipes', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'recipes', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncRecipes() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncDatasheets(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncDatasheets()`)

      const response = await this.api.post<any>('app/datasheets', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'datasheets')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.datasheets && response.datasheets.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS datasheets')

          await db.execute('CREATE TABLE IF NOT EXISTS datasheets (guid STRING PRIMARY KEY, name STRING, languages STRING, products STRING)')

          this.logger.log('dropped datasheets')

          let sqlStatements: capSQLiteSet[] = []

          response.datasheets.forEach((datasheet: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO datasheets VALUES (?, ?, ?, ?)',
              values: [
                datasheet.guid,
                datasheet.name,
                JSON.stringify(datasheet.languages),
                JSON.stringify(datasheet.products)
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted datasheets', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'datasheets', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncDatasheets() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncUsageManuals(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncUsageManuals()`)

      const response = await this.api.post<any>('app/usage-manuals', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'usageManuals')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.usageManuals && response.usageManuals.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS usageManuals')

          await db.execute('CREATE TABLE IF NOT EXISTS usageManuals (guid STRING PRIMARY KEY, name STRING, languages STRING, products STRING)')

          this.logger.log('dropped usageManuals')

          let sqlStatements: capSQLiteSet[] = []

          response.usageManuals.forEach((usageManual: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO usageManuals VALUES (?, ?, ?, ?)',
              values: [
                usageManual.guid,
                usageManual.name,
                JSON.stringify(usageManual.languages),
                JSON.stringify(usageManual.products)
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted usageManuals', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'usageManuals', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncUsageManuals() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncDepartments(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncDepartments()`)

      const response = await this.api.post<any>('app/departments', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'departments')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.departments && response.departments.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS departments')
          await db.execute('DROP TABLE IF EXISTS departmentProducts')

          await db.execute('CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, userCode INTEGER, alias STRING)')
          await db.execute('CREATE TABLE IF NOT EXISTS departmentProducts (department INTEGER, product INTEGER, PRIMARY KEY (department, product))')

          this.logger.log('dropped departments')

          let sqlStatements: capSQLiteSet[] = []

          for (let department of response.departments) {
            sqlStatements.push({
              statement: 'INSERT INTO departments VALUES (?, ?, ?)',
              values: [
                department.id,
                department.userCode,
                department.alias
              ]
            })
            for (let product of department.products) {
              sqlStatements.push({
                statement: 'INSERT INTO departmentProducts VALUES (?, ?)',
                values: [department.id, product]
              })
            }
          }

          await db.executeSet(sqlStatements)

          this.logger.log('inserted departments', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'departments', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncDepartments() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncCategories(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncCategories()`)

      const response = await this.api.post<any>('app/categories', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'categories')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.categories && response.categories.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          const dropResult = await db.execute('DROP TABLE IF EXISTS categories')

          await db.execute('CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, parentId INTEGER NULL, position INTEGER, nameNl STRING, nameFr STRING, descriptionNl STRING, descriptionFr STRING)')

          this.logger.log('dropped categories')

          let sqlStatements: capSQLiteSet[] = []

          response.categories.forEach((category: $TSFixMe) => {
            const nameNl: string = (category.name && category.name.nl) ? category.name.nl : null
            const nameFr: string = (category.name && category.name.fr) ? category.name.fr : null
            const descriptionNl: string = (category.description && category.description.nl) ? category.description.nl : null
            const descriptionFr: string = (category.description && category.description.fr) ? category.description.fr : null
            sqlStatements.push({
              statement: 'INSERT INTO categories VALUES (?, ?, ?, ?, ?, ?, ?)',
              values: [
                category.id,
                category.parentId,
                category.position,
                nameNl,
                nameFr,
                descriptionNl,
                descriptionFr
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted categories', response.categories.length, response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'categories', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncCategories() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncNotes(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncNotes()`)

      const response = await this.api.post<any>('app/notes', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'notes')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.notes && response.notes.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS notes')
          await db.execute('CREATE TABLE IF NOT EXISTS notes (customer INTEGER, address INTEGER, date DATETIME, text STRING NULL)')

          this.logger.log('dropped notes')

          let sqlStatements: capSQLiteSet[] = []

          for (let note of response.notes) {
            sqlStatements.push({
              statement: 'INSERT INTO notes VALUES (?, ?, ?, ?)',
              values: [
                note.customer,
                note.address,
                note.date,
                note.text
              ]
            })
          }

          await db.executeSet(sqlStatements, true)
          this.logger.log('inserted notes', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'notes', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncNotes() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncProductTaxes(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProductTaxes()`)

      const response = await this.api.post<any>('app/productTaxes', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'productTaxes')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.productTaxes && response.productTaxes.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS productTaxes')
          await db.execute('CREATE TABLE IF NOT EXISTS productTaxes (product INTEGER, description STRING, amount REAL, type STRING)')

          this.logger.log('dropped productTaxes')

          let sqlStatements: capSQLiteSet[] = []

          response.productTaxes.forEach((productTax: $TSFixMe) => {
            sqlStatements.push({
              statement: 'INSERT INTO productTaxes VALUES (?, ?, ?, ?)',
              values: [
                productTax.product,
                productTax.description,
                productTax.amount,
                productTax.type
              ]
            })
          })

          await db.executeSet(sqlStatements)
          this.logger.log('inserted productTaxes', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'productTaxes', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncProductTaxes() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncShippingCosts(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncShippingCosts()`)

      const response = await this.api.post<any>('app/shippingCosts', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'shippingCosts')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.shippingCosts && response.shippingCosts.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS shippingCosts')
          await db.execute('CREATE TABLE IF NOT EXISTS shippingCosts (customerId INTEGER, addressId INTEGER, amount REAL, threshold INTEGER)')

          this.logger.log('dropped shippingCosts')

          let sqlStatements: capSQLiteSet[] = []

          for (let shippingCost of response.shippingCosts) {
            sqlStatements.push({
              statement: 'INSERT INTO shippingCosts VALUES (?, ?, ?, ?)',
              values: [
                shippingCost.customerId,
                shippingCost.addressId,
                shippingCost.amount,
                shippingCost.threshold
              ]
            })
          }

          await db.executeSet(sqlStatements, true)
          this.logger.log('inserted shippingCosts', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'shippingCosts', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncShippingCosts() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncContacts(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncContacts()`)

      const response = await this.api.post<any>('app/contacts', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'contacts')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.contacts && response.contacts.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS contacts')
          await db.execute('CREATE TABLE IF NOT EXISTS contacts (id INTEGER, customerId INTEGER, addressId INTEGER, firstName STRING, name STRING, mailAddress STRING, mobileNr STRING, ordConf BOOLEAN, bonus BOOLEAN, invoice BOOLEAN, reminder BOOLEAN, domicilation BOOLEAN, comMailing BOOLEAN, PRIMARY KEY (id, customerId, addressId))')

          this.logger.log('dropped contacts')

          let sqlStatements: capSQLiteSet[] = []

          for (let contact of response.contacts) {
            sqlStatements.push({
              statement: 'INSERT INTO contacts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              values: [
                contact.id,
                contact.customerId,
                contact.addressId,
                contact.firstName,
                contact.name,
                contact.mailAddress,
                contact.mobileNr,
                contact.ordConf,
                contact.bonus,
                contact.invoice,
                contact.reminder,
                contact.domicilation,
                contact.comMailing
              ]
            })
          }

          await db.executeSet(sqlStatements, true)
          this.logger.log('inserted contacts', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'contacts', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncContacts() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncDeliverySchedules(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncDeliverySchedules()`)

      const response = await this.api.post<any>('app/delivery-schedules', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'deliverySchedules')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.deliverySchedules && response.deliverySchedules.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS deliverySchedules')
          await db.execute('CREATE TABLE IF NOT EXISTS deliverySchedules (customerId INTEGER, addressId INTEGER, monAMFr STRING, monAMTo STRING, monPMFr STRING, monPMTo STRING, tueAMFr STRING, tueAMTo STRING, tuePMFr STRING, tuePMTo STRING, wedAMFr STRING, wedAMTo STRING, wedPMFr STRING, wedPMTo STRING, thuAMFr STRING, thuAMTo STRING, thuPMFr STRING, thuPMTo STRING, friAMFr STRING, friAMTo STRING, friPMFr STRING, friPMTo STRING, PRIMARY KEY (customerId, addressId))')

          this.logger.log('dropped deliverySchedules')

          let sqlStatements: capSQLiteSet[] = []

          for (let deliverySchedule of response.deliverySchedules) {
            sqlStatements.push({
              statement: 'INSERT INTO deliverySchedules VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              values: [
                deliverySchedule.customerId,
                deliverySchedule.addressId,
                deliverySchedule.monAMFr,
                deliverySchedule.monAMTo,
                deliverySchedule.monPMFr,
                deliverySchedule.monPMTo,
                deliverySchedule.tueAMFr,
                deliverySchedule.tueAMTo,
                deliverySchedule.tuePMFr,
                deliverySchedule.tuePMTo,
                deliverySchedule.wedAMFr,
                deliverySchedule.wedAMTo,
                deliverySchedule.wedPMFr,
                deliverySchedule.wedPMTo,
                deliverySchedule.thuAMFr,
                deliverySchedule.thuAMTo,
                deliverySchedule.thuPMFr,
                deliverySchedule.thuPMTo,
                deliverySchedule.friAMFr,
                deliverySchedule.friAMTo,
                deliverySchedule.friPMFr,
                deliverySchedule.friPMTo
              ]
            })
          }

          await db.executeSet(sqlStatements, true)
          this.logger.log('inserted deliverySchedules', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'deliverySchedules', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncDeliverySchedules() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncCustomers(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncCustomers()`)

      const response = await this.api.post<any>('app/customers', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'customers')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.customers && response.customers.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS customers')
          await db.execute('CREATE TABLE IF NOT EXISTS customers (id INTEGER, addressId INTEGER, addressGroupId INTEGER, userCode INTEGER, userType INTEGER, name STRING, address STRING, streetNum STRING, zipCode STRING, city STRING, country STRING, phoneNum STRING, vatNum STRING, language STRING, promo BOOLEAN, fostplus BOOLEAN, bonusPercentage REAL, addressName STRING, delvAddress STRING, delvStreetNum STRING, delvZipCode STRING, delvCity STRING, delvCountry STRING, delvPhoneNum STRING, delvLanguage STRING, PRIMARY KEY (id, addressId))')

          this.logger.log('dropped customers')

          let sqlStatements: capSQLiteSet[] = []

          for (let customer of response.customers) {
            sqlStatements.push({
              statement: 'INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              values: [
                customer.id,
                customer.addressId,
                customer.addressGroupId,
                customer.userCode,
                customer.userType,
                customer.name,
                customer.address,
                customer.streetNum,
                customer.zipCode,
                customer.city,
                customer.country,
                customer.phoneNum,
                customer.vatNum,
                customer.language,
                customer.promo,
                customer.fostplus,
                customer.bonusPercentage,
                customer.addressName,
                customer.delvAddress,
                customer.delvStreetNum,
                customer.delvZipCode,
                customer.delvCity,
                customer.delvCountry,
                customer.delvPhoneNum,
                customer.delvLanguage
              ]
            })
          }

          await db.executeSet(sqlStatements, true)
          this.logger.log('inserted customers', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'customers', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncCustomers() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncProductDescriptionCustomers(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncProductDescriptionCustomers()`)

      const response = await this.api.post<any>('app/product-description-customers', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'productDescriptionCustomers')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.productDescriptionCustomers && response.productDescriptionCustomers.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS productDescriptionCustomers')
          await db.execute('CREATE TABLE IF NOT EXISTS productDescriptionCustomers (id INTEGER PRIMARY KEY, description STRING)')

          this.logger.log('dropped productDescriptionCustomers')

          let sqlStatements: capSQLiteSet[] = []

          for (let descriptionCustomer of response.productDescriptionCustomers) {
            sqlStatements.push({
              statement: 'INSERT INTO productDescriptionCustomers VALUES (?, ?)',
              values: [
                descriptionCustomer.id,
                descriptionCustomer.description
              ]
            })
          }

          await db.executeSet(sqlStatements, true)
          this.logger.log('inserted productDescriptionCustomers', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'productDescriptionCustomers', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncProductDescriptionCustomers() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncRecipesModule(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncRecipesModule()`)

      const response = await this.api.post<any>('app/recipes-module', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'recipesModule')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.recipes && response.recipes.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS recipesModule')
          await db.execute('CREATE TABLE IF NOT EXISTS recipesModule (id INTEGER, productId INTEGER, nameNl STRING, nameFr STRING, PRIMARY KEY (id, productId))')

          this.logger.log('dropped recipesModule')

          let sqlStatements: capSQLiteSet[] = []

          for (let recipesModule of response.recipes) {

            sqlStatements.push({
              statement: 'INSERT INTO recipesModule VALUES (?, ?, ?, ?)',
              values: [
                recipesModule.id,
                recipesModule.productId,
                recipesModule.nameNl,
                recipesModule.nameFr
              ]
            })
          }

          await db.executeSet(sqlStatements, true)
          this.logger.log('inserted recipesModule', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'recipesModule', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncRecipesModule() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  async syncNews(credential: AppCredential, culture?: string, force?: boolean) {
    try {
      this.logger.log(`SyncProvider.syncNews()`)

      const response = await this.api.post<any>('app/news', credential, {
        culture,
        checksum: force ? '' : this.checksum.find(e => e.dataTable === 'news')?.checksum ?? ''
      })
        .pipe(timeout(TIMEOUT_INTERVAL))
        .toPromise()

      if (response && response.news && response.news.length > 0) {
        await this._db.executeQuery<any>(async (db: SQLiteDBConnection) => {
          await db.execute('DROP TABLE IF EXISTS news')
          await db.execute('CREATE TABLE IF NOT EXISTS news (id INTEGER PRIMARY KEY, customerId INTEGER, addressId INTEGER, titleNl STRING, titleFr STRING, contentNl BLOB, contentFr BLOB, promo BOOLEAN, spotlight BOOLEAN, template TINYINT, date DATETIME)')

          this.logger.log('dropped news')

          let sqlStatements: capSQLiteSet[] = []

          for (let newsItem of response.news) {
            sqlStatements.push({
              statement: 'INSERT INTO news VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              values: [
                newsItem.id,
                newsItem.customerId,
                newsItem.addressId,
                newsItem.titleNl,
                newsItem.titleFr,
                newsItem.contentNl,
                newsItem.contentFr,
                newsItem.promo,
                newsItem.spotlight,
                newsItem.template,
                newsItem.date
              ]
            })
          }

          await db.executeSet(sqlStatements, true)
          this.logger.log('inserted news', response.checksumSha)
          await this.updateDataIntegrityChecksum(db, 'news', response.checksumSha)
        })
      } else {
        this.logger.log(`SyncProvider.syncNews() -- no changes`)
      }

      return true
    } catch (err) {
    }
  }

  /**
   * Set the checksum in the database for the given dataTable
   * @private
   * @param {string} dataTable name of table
   * @param {string} checksum sha value of checksum
   * @memberof SyncService
   */
  private async updateDataIntegrityChecksum(db: SQLiteDBConnection, dataTable: string, checksum: string): Promise<Changes> {
    const res = await db.run(`INSERT OR REPLACE INTO dataIntegrityChecksums (dataTable, checksum, dateChanged) VALUES (?, ?, ?)`, [
      dataTable,
      checksum,
      new Date().toJSON()
    ])
    return res.changes
  }

  /**
   * Returns an array with arrays of the given size.
   *
   * @param myArray {Array} array to split
   * @param chunk_size {Integer} Size of every group
   */
  private chunkArray(myArray: any[], chunk_size: number) {
    let index = 0
    const arrayLength = myArray.length
    const tempArray = []

    for (index = 0; index < arrayLength; index += chunk_size) {
      const myChunk = myArray.slice(index, index + chunk_size)
      // Do something if you want with the group
      tempArray.push(myChunk)
    }

    return tempArray
  }

  async prepareCurrentExceptions(customer: AppCustomerModel): Promise<boolean> {
    let result = true
    await this._db.executeQuery(async (db: SQLiteDBConnection) => {
      // Check if all tables exist
      const tables = (await db.getTableList()).values
      if (!tables.find(e => e === 'currentExceptions')) {
        this.logger.warn('Creating missing TABLE currentExceptions')
        await db.execute('CREATE TABLE currentExceptions (productId INTEGER PRIMARY KEY)', true)
      }

      if (!tables.find(e => e === 'productExceptions')) {
        this.logger.error('Product Exceptions TABLE does not exist!')
        result = false
        return
      }
      if (!tables.find(e => e === 'products')) {
        this.logger.error('Products TABLE does not exist!')
        result = false
        return
      }

      const defaultExceptions = (await db.query('SELECT * FROM productExceptions WHERE customer = 0 AND address = 0 AND addressGroup = 0 LIMIT 1')).values
      const customerExceptions = (await db.query('SELECT * FROM productExceptions WHERE customer = ? AND address = 0 AND addressGroup = 0 LIMIT 1', [
        customer.id
      ])).values
      const addressExceptions = (await db.query('SELECT * FROM productExceptions WHERE customer = ? AND address = ? AND addressGroup = 0 LIMIT 1', [
        customer.id,
        customer.addressId
      ])).values
      const addressGroupExceptions = (await db.query('SELECT * FROM productExceptions WHERE customer = 0 AND address = 0 AND addressGroup = ? AND addressGroup != 0 LIMIT 1', [
        customer.addressGroupId
      ])).values
      const products = (await db.query('SELECT id,itemnum FROM products')).values

      if (products.length <= 0) {
        this.logger.error('No products found!')
        return
      }

      this.logger.info('We have found ' + products.length + ' products!')
      this.logger.info('We have found ' + defaultExceptions.length + ' defaultExceptions!')
      this.logger.info('We have found ' + customerExceptions.length + ' customerExceptions!')
      this.logger.info('We have found ' + addressExceptions.length + ' addressExceptions!')
      this.logger.info('We have found ' + addressGroupExceptions.length + ' addressGroupExceptions!')

      function uniqBy<T>(a, key): T[] {
        return [
          ...new Map<T, T>(
            a.map(x => [key(x), x])
          ).values()
        ]
      }

      if (defaultExceptions.length <= 0) {
        this.logger.error('No defaultExceptions found!')
        return
      }

      console.time('preparing')

      const hasCustomerExceptions = (customerExceptions && customerExceptions.length > 0)
      const hasAddressExceptions = (addressExceptions && addressExceptions.length > 0)
      const hasAddressGroupExceptions = (addressGroupExceptions && addressGroupExceptions.length > 0)

      let exceptions: string[]
      let allowed: number[]

      if (!hasCustomerExceptions && !hasAddressExceptions && !hasAddressGroupExceptions) {
        this.logger.warn('This user does not have any product exceptions!')
        exceptions = defaultExceptions[0].list.toString().split(',')

        allowed = products.filter(e => !exceptions.includes(e.itemnum.toString())).map(e => e.id)
      } else if (hasAddressExceptions && addressExceptions[0].deny === 'true') {
        this.logger.warn('This user has adressExceptions with deny true')
        exceptions = addressExceptions[0].list.toString().split(',')

        allowed = products.filter(e => exceptions.includes(e.itemnum.toString())).map(e => e.id)
      } else if (hasCustomerExceptions && customerExceptions[0].deny === 'true') {
        this.logger.warn('This user has cusomerExceptions with deny true')
        exceptions = customerExceptions[0].list.toString().split(',')

        if (hasAddressExceptions) {
          this.logger.warn('This user has additional addressExceptions')
          exceptions = exceptions.concat(addressExceptions[0].list.toString().split(','))
        }

        allowed = products.filter(e => exceptions.includes(e.itemnum.toString())).map(e => e.id)
      } else if (hasAddressGroupExceptions && addressGroupExceptions[0].deny === 'true') {
        this.logger.warn('This user has addressGroupExceptions with deny true')
        exceptions = addressGroupExceptions[0].list.toString().split(',')

        if (hasAddressExceptions) {
          this.logger.warn('This user has additional addressExceptions')
          exceptions = exceptions.concat(addressExceptions[0].list.toString().split(','))
        }
        if (hasCustomerExceptions) {
          this.logger.warn('This user has additional customerExceptions')
          exceptions = exceptions.concat(customerExceptions[0].list.toString().split(','))
        }

        allowed = products.filter(e => exceptions.includes(e.itemnum.toString())).map(e => e.id)
      } else if (hasCustomerExceptions || hasAddressExceptions || hasAddressGroupExceptions) {
        this.logger.warn('This user has any type of product exceptions')
        exceptions = defaultExceptions[0].list.toString().split(',')
        const temp = products.filter(e => !exceptions.includes(e.itemnum.toString())).map(e => e.id)

        exceptions = []
        if (hasAddressExceptions) {
          this.logger.warn('This user has additional addressExceptions')
          exceptions = exceptions.concat(addressExceptions[0].list.toString().split(','))
        }
        if (hasCustomerExceptions) {
          this.logger.warn('This user has additional customerExceptions')
          exceptions = exceptions.concat(customerExceptions[0].list.toString().split(','))
        }
        if (hasAddressGroupExceptions) {
          this.logger.warn('This user has additional addressGroupExceptions')
          exceptions = exceptions.concat(addressGroupExceptions[0].list.toString().split(','))
        }
        allowed = uniqBy<number>(temp.concat(products.filter(e => exceptions.includes(e.itemnum.toString())).map(e => e.id)), JSON.stringify)
      } else {
        this.logger.warn('I dont know what is going on here but default will have to do!')
        exceptions = defaultExceptions[0].list.toString().split(',')

        allowed = products.filter(e => !exceptions.includes(e.itemnum.toString())).map(e => e.id)
      }

      let queries = [{
        statement: 'DELETE FROM currentExceptions',
        values: []
      }]

      for (let i = 0; i < allowed.length; i++) {
        const product: number = allowed[i]
        // Remove all existing exceptions and insert new ones
        queries.push({
          statement: 'INSERT OR REPLACE INTO currentExceptions VALUES (?)',
          values: [product]
        })
      }

      this.logger.info('Inserting ' + allowed.length + ' records into currentExceptions')
      await db.executeSet(queries, true)

      console.timeEnd('preparing')
    })
    return result
  }

  private get checksum(): Array<Store> {
    return this._checksum || new Array<Store>()
  }
}

export class Store {
  dataTable: string
  checksum: string
  dateChanged: Date
}