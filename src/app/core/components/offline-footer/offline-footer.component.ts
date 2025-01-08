import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { NetworkService } from 'src/app/@shared/network.service'

@Component({
  selector: 'app-offline-footer',
  templateUrl: './offline-footer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {

  }
})
export class OfflineFooterComponent implements OnChanges {
  @Input() lastSync: Date
  text: string
  culture: string

  constructor(
    ref: ChangeDetectorRef,
    private translate: TranslateService,
    public network: NetworkService
  ) {
    this.update()
    ref.markForCheck()
    network.connected.subscribe(() => ref.markForCheck())
  }

  ngOnChanges() {
    this.update()
  }

  update() {
    this.text = this.translate.instant('offline-footer')
    if (this.lastSync)
      this.text += '\n' + this.translate.instant('checksum.lastSync') + ' '
    this.culture = this.translate.currentLang
  }
}
