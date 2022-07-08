import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPage implements OnInit {
  private _loading: HTMLIonLoadingElement;
  public account = {
    username: '',
    password: ''
  }
  busy = false
  dbError = false

  constructor(
    private ref: ChangeDetectorRef
  ) { }

  ngOnInit() {
  }

  ionViewDidEnter() {
    const credential = this.user.getStoredCredential();
    if (credential) {
      this.account = credential
      this.ref.markForCheck()
    }

    this.busy = true
    this.ref.markForCheck()

    const timer = setTimeout(() => {
      // console.error('There was an error loading the database...');
      this.toast(this.translateService.instant('dbLoadError'));
      this.busy = false
      this.dbError = true
      this.ref.markForCheck()
    }, 10000)

    this.sync.Initialize().then((dbOk) => {
      this.busy = !dbOk
      clearTimeout(timer)
      this.ref.markForCheck()
    })
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

}
