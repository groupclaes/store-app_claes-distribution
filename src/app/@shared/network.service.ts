import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'

// capacitor imports
import { Network } from '@capacitor/network'
import { TranslateService } from '@ngx-translate/core'
import { ToastController } from '@ionic/angular'
import { environment } from 'src/environments/environment'
import { LoggingProvider } from './logging/log.service'

@Injectable({
  providedIn: 'root'
})
export class NetworkService {
  private _connected?: boolean

  connected: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false)

  constructor(
    private translate: TranslateService,
    private log: LoggingProvider,
    private toastCtrl: ToastController
  ) {
    this.check()

    const t = setInterval(async () => {
      const c = this.check()
      if (c) clearInterval(t)
    }, 150)

    Network.addListener('networkStatusChange', (ev) => {
      this.log.debug('NetworkService.networkStatusChange() -- ev', ev)
      if (this._connected !== undefined && this._connected !== ev.connected) {
        this.connected.next(ev.connected)
      }
      this._connected = ev.connected
    })
  }

  async check(): Promise<boolean> {
    this.log.debug('NetworkService.check() -- start')
    const networkStatus = await Network.getStatus()

    if (this._connected !== undefined && this._connected != networkStatus.connected) {
      this.connected.next(networkStatus.connected)
    }
    this._connected = networkStatus.connected

    this.log.debug('NetworkService.check() -- end', networkStatus.connected)
    return networkStatus.connected
  }

  noop($event?: any) {
    this.toast(this.translate.instant('offline-message'))
      .then(_ => $event?.target.complete())
  }

  private async toast(message: string, duration: number = 3000) {
    const toast = await this.toastCtrl.create({
      message,
      duration,
      position: 'top'
    })
    await toast.present()
  }

  get online(): boolean {
    return environment.mock_offline ? false : this._connected ?? false
  }

  get offline(): boolean {
    return !this.online
  }
}