import { firstValueFrom } from 'rxjs';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AppCredential, UserService } from 'src/app/core/user.service';
import { NavController, ToastController } from '@ionic/angular';
import { TranslateService } from '@ngx-translate/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StorageProvider } from 'src/app/core/storage-provider.service';
import { BrowserService } from 'src/app/core/browser.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SignupPage {
  private _form: FormGroup

  constructor(private user: UserService,
    private navCtrl: NavController,
    private ref: ChangeDetectorRef,
    private toastCtrl: ToastController,
    private translate: TranslateService,
    private storage: StorageProvider,
    private browser: BrowserService,
    fb: FormBuilder) {

    this._form = fb.group({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      given_name: [ '', [ Validators.required, Validators.minLength(2) ] ],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      family_name: [ '', [ Validators.required, Validators.minLength(2) ] ],
      username: [ '', [
        Validators.required,
        Validators.minLength(2),
        Validators.email ] ],
      password: [ '', [ Validators.required, Validators.minLength(8) ] ],
      code: [ '', [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(12) ] ]
    })
  }

  get form() {
    return this._form
  }

  async doSignup() {
    // Attempt to login in through our User service
    try {
      const result = await firstValueFrom(this.user.signup(this._form.value))
      if (result) {
        // Set the registered username
        this.storage.set<AppCredential>('credential', {
          username: this.form.value.username,
          password: ''
        })

        this.navCtrl.navigateRoot('/account/login')
        return
      }
    } catch {
      const toast = await this.toastCtrl.create({
        message: this.translate.instant('signupError'),
        duration: 3000,
        position: 'top'
      });
      await toast.present()
      this.ref.markForCheck()
    }
  }

  openWebshop() {
    this.browser.open('https://shop.claes-distribution.be/login?action=signup', '_system', 'location=yes')
  }
}
