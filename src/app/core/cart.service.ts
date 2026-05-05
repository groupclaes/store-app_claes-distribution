import { Injectable } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { ApiService } from './api.service'
import { CartsRepositoryService, ICartDetail } from './repositories/carts.repository.service'
import { AppCredential, Customer } from './user.service'
import { CustomersRepositoryService } from './repositories/customers.repository.service'
import { environment } from 'src/environments/environment'
import { Queue } from './queue'
import { LoggerService } from '../@shared/logging/log.service'
import { firstValueFrom } from 'rxjs'

const logger = new LoggerService('CartService')

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private _carts: ICartDetail[] = []
  private _credential: AppCredential

  private _queue_running: boolean = false
  private _update_queue: Queue<CartUpdateType> = new Queue<CartUpdateType>()

  constructor(
    public api: ApiService,
    private repo: CartsRepositoryService,
    private customerRepo: CustomersRepositoryService,
    private translate: TranslateService
  ) {
  }

  async init(credential: AppCredential, userId: number) {
    logger.debug('init() -- start', userId)

    try {
      logger.debug('init() -- verifyDb')
      await this.verifyDb()
      logger.debug('init() -- loadCarts')
      await this.loadCarts()
    } catch (err) {
      logger.error('init() error', err)
    } finally {
      this._credential = credential
      logger.debug('init() -- end')
    }
  }

  async verifyDb() {
    await this.repo.init()
  }

  async loadCarts() {
    logger.debug('loadCarts() -- start')
    this._carts = await this.repo.loadUnsent(this.culture)
    logger.debug(`CartService.loadCarts() -- there are ${this._carts.length} rows in carts!`)
    logger.debug('loadCarts() -- end')
  }

  async getHistoryCarts() {
    logger.debug('loadCarts() -- start')
    const carts = await this.repo.loadCarts(false, this.culture)
    logger.debug(`CartService.loadCarts() -- there are ${carts.length} rows in carts!`)
    logger.debug('loadCarts() -- end')

    return carts
  }

  async setProduct(product_id: number, amount: number, customer: number, address: number, credential?: AppCredential, cart_id?: number): Promise<void> {
    if (credential)
      this._credential = credential
    logger.debug('setProduct() -- ', product_id, amount, cart_id)

    if (cart_id) {
      const cart = this._carts.find(e => e.id === cart_id)
      logger.debug('setProduct() -- isValidCart')
      this.isValidCart(cart)

      logger.debug('setProduct() -- enqueue')
      this._update_queue.enqueue({
        type: 'update',
        id: cart.id,
        customer,
        address,
        product_id,
        amount,
        credential
      })
    } else {
      // check if there is an active cart, if not error
      let cust_cart = this._carts.find(e => e.customer === customer && e.address === address && e.send === false)
      if (this.active)
        return this.setProduct(product_id, amount, customer, address, credential, this.active.id)
      else if (cust_cart) {
        return this.setProduct(product_id, amount, customer, address, credential, cust_cart.id)
      }

      this._update_queue.enqueue({
        type: 'create',
        customer,
        address,
        product_id,
        amount,
        credential
      })
    }

    logger.debug('setProduct() -- complete_queue')
    await this.complete_queue()
  }

  async updateActive(customer: number, address: number) {
    logger.debug('updateActive() -- start', customer, address)

    if (this.active && this.active.customer === customer && this.active.address === address && this.active.send === false) {
      logger.debug('updateActive() -- case 1', 'do nothing')
    } else if (this._carts.some(e => e.customer === customer && e.address === address && e.send === false)) {
      // there is a cart for the user
      logger.debug('updateActive() -- case 2', 'loop trough')
      for (const cart of this._carts) {
        cart.active = false
      }
      const myCart: ICartDetail = this._carts.find(e => e.customer === customer && e.address === address && e.send === false)
      if (myCart) {
        myCart.active = true
        await this.repo.changeActive(myCart.id)
      } else {
        logger.debug('updateActive() -- case 2', 'huh ?')
      }
    } else if (!this.active && this._carts.length === 0) {
      // do nothing
      logger.debug('updateActive() -- case 3', 'do nothing')
    } else {
      logger.debug('updateActive() -- case 4', 'set all inactive')
      this._carts.forEach(e => e.active = false)
      await this.repo.changeActive()
    }
    logger.debug('updateActive() -- end')
  }

  deleteCart(cart: ICartDetail): Promise<boolean> {
    this._carts = this._carts.filter(e => e.id !== cart.id)
    return this.repo.delete(cart.id)
  }

  async sendCart(cart: ICartDetail): Promise<boolean> {
    let response: any
    try {
      await this.repo.updateSend(cart.id)
      cart.send = true
      if (environment.production) {
        response = await firstValueFrom(this.api.post('app/carts/complete', {
          credentials: this._credential,
          order: cart
        }))
        logger.debug('Sent cart to backend')
      } else {
        console.error('\n\nMocking cart send, not actually sending!\n\n')
        response = {
          result: false
        }
      }
    } catch (err) {
      logger.error('sendCart() catch error', JSON.stringify(err))
    } finally {
      if (response && response.result === true) {
        this.repo.removeAllActive()
          .then(_ => this._carts.forEach(x => x.active = false))
          .then(_ => logger.debug('Set all carts as inactive'))
        return await this.repo.updateSendOk(cart)
      } else {
        await this.repo.updateSendOk(cart, false)
      }
      return false
    }
  }

  async create(customer: number, address: number, credential: AppCredential) {
    logger.debug('create() -- start')
    await this.complete_queue()
    this._update_queue.enqueue({
      type: 'create',
      customer,
      address,
      credential
    })
    logger.debug('create() -- complete_queue')
    await this.complete_queue()
    logger.debug('create() -- end')
  }

  cancelSend(cart: ICartDetail): Promise<boolean> {
    return this.repo.updateSend(cart.id, false)
  }

  private isValidCart(cart: ICartDetail | undefined) {
    if (!cart)
      throw new Error('Cart is not valid!')
    return
  }

  private async complete_cart_create(task: ICartUpdateCreate) {
    const { name, addressName } = await this.customerRepo.get<Customer>(task.customer, task.address)
    const newCart: ICartDetail = {
      id: this.newId,
      name: 'cart-' + new Date().getTime(),
      customer: task.customer,
      customerName: name,
      addressName,
      address: task.address,
      serverDate: null,
      lastChangeDate: new Date(),
      sendDate: null,
      send: false,
      sendOk: false,
      active: true,
      products: [],
      settings: null
    }

    for (const cart of this._carts) {
      cart.active = false
    }

    this._carts.push(newCart)

    if (task.product_id && task.amount) {
      this._update_queue.enqueue({
        type: 'update',
        id: newCart.id,
        customer: task.customer,
        address: task.address,
        product_id: task.product_id,
        amount: task.amount,
        credential: task.credential
      })
    }

    // craete new cart in db
    await this.repo.create(newCart)

    await new Promise(r => setTimeout(r, 18))
  }

  private async complete_cart_update(task: ICartUpdateUpdate) {
    const cart = this._carts.find(e => e.id === task.id)
    this.isValidCart(cart)

    if (task.amount === -1) {
      cart.products = cart.products.filter(e => e.id !== task.product_id)
      await this.repo.removeProduct(this.active.id, task.product_id)
    } else if (task.amount > -1) {
      // make sure no float's amounts get saved
      const correctAmount = Math.floor(task.amount)
      const product = cart.products.find(e => e.id === task.product_id)

      if (product) {
        product.amount = correctAmount
        await this.repo.updateProduct(task.id, task.product_id, correctAmount)
      } else {
        cart.products.push({
          id: task.product_id,
          itemnum: '',
          amount: correctAmount,
          name: null,
          unit: null,
          color: null,
          url: null,
          availableOn: null
        })
        await this.repo.addProduct(task.id, task.product_id, correctAmount)
      }
    }
  }

  private async complete_queue(): Promise<void> {
    logger.debug('complete_queue() -- running', this._queue_running)
    if (this._queue_running)
      return new Promise<void>(r => {
        const t: number = window.setInterval(() => {
          if (this._queue_running === false) {
            r()
            clearInterval(t)
          }
        }, 18)
      })

    logger.debug('complete_queue() -- start', this._update_queue.size)

    try {
      this._queue_running = true
      while (this._update_queue.size > 0) {
        logger.debug('complete_queue() -- while', this._update_queue.size)
        const task = this._update_queue.dequeue()
        this._credential = task.credential

        switch (task.type) {
          case 'create':
            await this.complete_cart_create(task)
            break

          case 'update':
            await this.complete_cart_update(task)
            break

          case 'delete':
            break
        }

        if (this._update_queue.size === 0)
          break
      }
    } catch (err) {

    } finally {
      this._queue_running = false
      logger.debug('complete_queue() -- end')
    }
  }

  get active(): ICartDetail | null {
    if (this._carts)
      return this._carts.find(e => e.active === true) || null
  }

  get newId(): number {
    return Math.floor(Math.random() * 2147483647)
  }

  get culture(): string {
    return this.translate.currentLang
  }

  get carts(): ICartDetail[] {
    return this._carts
  }
}

export type CartUpdateType = ICartUpdateCreate | ICartUpdateUpdate | ICartUpdateDelete

export interface ICartUpdate {
  type: 'create' | 'update' | 'delete'
  customer: number
  address: number
  credential: AppCredential
}

export interface ICartUpdateCreate extends ICartUpdate {
  type: 'create'
  product_id?: number
  amount?: number
}

export interface ICartUpdateUpdate extends ICartUpdate {
  type: 'update'
  id: number
  product_id: number
  amount: number
}

export interface ICartUpdateDelete extends ICartUpdate {
  type: 'delete'
  id: number
  product_id: number
}
