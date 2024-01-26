import { ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { NavController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { LoggingProvider } from 'src/app/@shared/logging/log.service';
import { CartService } from 'src/app/core/cart.service';
import { ICartDetail } from 'src/app/core/repositories/carts.repository.service';
import { SyncService } from 'src/app/core/sync.service';
import { UserService } from 'src/app/core/user.service';

@Component({
  selector: 'app-cart-history',
  templateUrl: './cart-history.page.html',
  styleUrls: ['./cart-history.page.scss'],
})
export class CartHistoryPage {
  isloading = false;
  _carts: ICartDetail[] = [];
  constructor(
    public navCtrl: NavController,
    private user: UserService,
    private ref: ChangeDetectorRef,
    private sync: SyncService,
    private logger: LoggingProvider,
    private cartService: CartService,
    private translate: TranslateService) { }



  get isAgent(): boolean {
    return this.user.hasAgentAccess;
  }

  get carts(): ICartDetail[] {
    return this._carts;
  }

  get lastChangeDate() {
    return this.cartService.active.lastChangeDate
  }

  get culture() {
    return this.translate.currentLang
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }


  ionViewWillEnter() {
    if (!this.user.userinfo) {
      this.navCtrl.navigateRoot('LoginPage');
    }
  }

  ionViewDidEnter() {
    if (this.user.userinfo && this.isloading === false) {
      this.loadCartsInHistory();
    }
  }

  /**
   * retrieves all carts that have been send by the user, even if the sending has failed.
   * @memberof CartHistoryPage
   */
  async loadCartsInHistory() {
    this.isloading = true;
    this.ref.markForCheck();

    this.isloading = false;
    this._carts = await this.cartService.getHistoryCarts();
    console.log('Loaded history carts')
    this.ref.markForCheck();
  }

  async sendCart(cart: ICartDetail, reload: boolean = true) {
    this.logger.info(`sendCart: ${cart.name} before cartService`);
    const result = await this.cartService.sendCart(cart);
    this.logger.info(`sendCart: ${cart.name} after cartService`);

    if (result) {
      this.logger.debug(`sendCart: ${cart.name} successfully sent cart`);
      if (reload) {
        await this.loadCartsInHistory();
      }
    } else {

      this.logger.error(`sendCart: ${cart.name} (${cart.id}) Failed to send cart`);
    }
  }

  async deleteCart(cart: ICartDetail) {
    await this.cartService.deleteCart(cart);
    this._carts = this._carts.filter(e => e.id !== cart.id);
    this.ref.markForCheck();
  }
}
