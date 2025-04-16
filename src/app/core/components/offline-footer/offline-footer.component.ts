import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { NetworkService } from 'src/app/@shared/network.service'
import { SyncService } from '../../sync.service'

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
    public network: NetworkService,
    public sync: SyncService
  ) {
    this.update()
    ref.markForCheck()
    network.connected.subscribe((): void => ref.markForCheck())
    sync.changes.subscribe((): void => ref.markForCheck())
  }

  ngOnChanges(): void {
    this.update()
  }

  update(): void {
    this.text = this.translate.instant('offline-footer')
    if (this.lastSync)
      this.text += '\n' + this.translate.instant('checksum.lastSync') + ' '
    this.culture = this.translate.currentLang
  }
}
