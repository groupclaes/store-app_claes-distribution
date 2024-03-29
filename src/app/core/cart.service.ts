import { Injectable } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { LoggingProvider } from '../@shared/logging/log.service'
import { ApiService } from './api.service'
import { CartsRepositoryService, ICartDetail } from './repositories/carts.repository.service'
import { AppCredential } from './user.service'

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private _carts: ICartDetail[] = []
  private _credential: AppCredential
  private _userId: number

  constructor(
    public api: ApiService,
    private repo: CartsRepositoryService,
    private logger: LoggingProvider,
    private translate: TranslateService
    // private statistics: StatisticsProvider
  ) {
  }

  async verifyDb() {
    await this.repo.init()
  }

  async loadCarts() {
    this.logger.log('CartService.loadCarts() -- start')
    this._carts = await this.repo.loadUnsend(this.culture)
    this.logger.log(`CartService.loadCarts() -- there are ${this._carts.length} rows in carts!`)
    this.logger.log('CartService.loadCarts() -- end')
  }

  async init(credential: AppCredential, userId: number) {
    this.logger.log('CartService.init() -- start')

    try {
      this.logger.log('CartService.init() -- verifyDb')
      await this.verifyDb()
      this.logger.log('CartService.init() -- loadCarts')
      await this.loadCarts()
    } catch (err) {
      this.logger.error('CartService.init() error', err)
    } finally {
      this._credential = credential
      this._userId = userId

      this.logger.log('CartService.init() -- end')
    }
  }

  async updateProduct(id: number, amount: number, customer: number, address: number, credential: AppCredential, cartId?: number) {
    this._credential = credential
    this.logger.log('CartService.updateProduct() -- ', id, amount, customer, address)

    if (cartId) {
      this.logger.log('CartService.updateProduct() -- has cartId')
      const cart = this._carts.find(e => e.id === cartId)
      if (amount === -1) {
        cart.products = cart.products.filter(e => e.id !== id)
        await this.repo.removeProduct(this.active.id, id)
        // this.statistics.cartRemove(this._userId, id)
      } else {
        cart.products.find(e => e.id === id).amount = amount
        await this.repo.updateProduct(cartId, id, amount)
      }
      return
    }

    if (!this._carts || this.carts.length === 0 || (!this.active && !this._carts.some(e => e.customer === customer && e.address === address && e.send === false)) || !(this.active.customer === customer && this.active.address === address)) {
      this.logger.log('CartService.updateProduct() -- createCart')
      if (!await this.createCart(customer, address, credential)) {
        this.logger.error('CartService.updateProduct() -- createCart failed!')
      }
    }

    if (!this.active && this._carts.some(e => e.customer === customer && e.address === address && e.send === false)) {
      this._carts.find(e => e.customer === customer && e.address === address && e.send === false).active = true
      this.logger.log('CartService.updateProduct() -- active = true')
    }

    if (this.active && this.active.products && this.active.products.some(e => e.id === id) && this.active.send === false) {
      this.logger.log('CartService.updateProduct() -- some')
      if (amount === -1) {
        this.active.products = this.active.products.filter(e => e.id !== id)
        await this.repo.removeProduct(this.active.id, id)
        // this.statistics.cartRemove(this._userId, id)
      } else {
        this.active.products.find(e => e.id === id).amount = amount

        await this.repo.updateProduct(this.active.id, id, amount)
      }
    } else {
      this.logger.log('CartService.updateProduct() -- else')
      if (!this.active.products) this.active.products = []
      this.active.products.push({
        id,
        itemnum: '',
        amount,
        name: null,
        unit: null,
        color: null,
        url: null
      })
      await this.repo.addProduct(this.active.id, id, amount)
      // this.statistics.cartAdd(this._userId, id)
    }
  }

  async updateActive(customer: number, address: number) {
    this.logger.log('CartService.updateActive() -- start', customer, address)

    if (this.active && this.active.customer === customer && this.active.address === address && !this.active.send) {
      this.logger.log('CartService.updateActive() -- case 1', 'do nothing')
    } else if (this._carts && this._carts.some(e => e.customer === customer && e.address === address && e.send === false)) {
      // there is a cart for the user
      this.logger.log('CartService.updateActive() -- case 2', 'loop trough')
      for (let cart of this._carts) {
        cart.active = false
      }
      const myCart: ICartDetail = this._carts.find(e => e.customer === customer && e.address === address && e.send === false)
      if (myCart) {
        myCart.active = true
        await this.repo.changeActive(myCart.id)
      } else {
        this.logger.log('CartService.updateActive() -- case 2', 'huh ?')
      }
    } else if (!this.active && this._carts.length === 0) {
      // do nothing
      this.logger.log('CartService.updateActive() -- case 3', 'do nothing')
    } else {
      this.logger.log('CartService.updateActive() -- case 4', 'set all inactive')
      this._carts.forEach(e => e.active = false)
      await this.repo.changeActive()
    }
    this.logger.log('CartService.updateActive() -- end')
  }

  deleteCart(cart: ICartDetail): Promise<boolean> {
    this._carts = this._carts.filter(e => e.id !== cart.id)
    return this.repo.delete(cart.id)
  }

  async createCart(customer: number, address: number, credential: AppCredential) {
    this.logger.log('CartService.createCart() --', customer, address)
    this._credential = credential
    const newCart: ICartDetail = {
      id: this.newId,
      name: 'cart-' + new Date().getTime(),
      customer: customer,
      address: address,
      serverDate: null,
      lastChangeDate: new Date(),
      sendDate: null,
      send: false,
      sendOk: false,
      active: true,
      products: [],
      settings: null
    }

    if (await this.repo.create(newCart)) {
      if (!this._carts) {
        this._carts = []
      }

      for (let cart of this._carts) {
        cart.active = false
      }

      this._carts.push(newCart)
      return true
    }
    return false
  }

  async sendCart(cart: ICartDetail): Promise<boolean> {
    let response: any
    try {
      await this.repo.updateSend(cart.id)
      this._carts = this._carts.filter(e => e.id != cart.id)

      response = await this.api.post('app/carts/complete', {
        credentials: this._credential,
        order: cart
      }).toPromise().catch(err => {
        this.logger.error('CartService.sendCart() error', JSON.stringify(err))
        return undefined
      })
    } catch (err) {
      this.logger.error('CartService.sendCart() catch error', JSON.stringify(err))
    } finally {
      if (response && response.result === true) {
        return await this.repo.updateSendOk(cart.id)
      }
      return false
    }
  }

  get active(): ICartDetail | null {
    if (this._carts) {
      return this._carts.find(e => e.active === true) || null
    }
    return null
  }

  set carts(value: ICartDetail[]) {
    this._carts = value
  }

  get carts(): ICartDetail[] {
    return this._carts
  }

  get newId(): number {
    const newNum = Math.floor(Math.random() * (2147483647 - 0)) + 0
    return newNum
  }

  get culture(): string {
    return this.translate.currentLang
  }
}