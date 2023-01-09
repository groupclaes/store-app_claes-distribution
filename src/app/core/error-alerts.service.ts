import { Injectable } from '@angular/core'
import { AlertButton, AlertController } from '@ionic/angular'

@Injectable({
  providedIn: 'root'
})
export class ErrorAlertsService {
  constructor(
    private alertCtrl: AlertController
  ) { }

  async alert(title: string, message: string, buttons?: (string | AlertButton)[]): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: title,
      message,
      buttons
    })
    await alert.present()
  }
}
