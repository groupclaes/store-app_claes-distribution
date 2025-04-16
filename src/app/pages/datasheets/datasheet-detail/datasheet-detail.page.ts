import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core'
import { ActivatedRoute, Params } from '@angular/router'
import { TranslateService } from '@ngx-translate/core'
import { NetworkService } from 'src/app/@shared/network.service'
import { Directory, Filesystem, GetUriResult, ReadFileResult } from '@capacitor/filesystem'
import { Share, ShareResult } from '@capacitor/share'
import { IPCMAttachmentEntry } from '../../../core/repositories/products.repository.service'
import { PcmRepositoryService } from '../../../core/repositories/pcm.repository'

@Component({
  selector: 'app-datasheet-detail',
  templateUrl: './datasheet-detail.page.html',
  styles: ['pdf-viewer {\n' +
  '    display: block;\n' +
  '    height: 100%;\n' +
  '    overflow-y: auto;\n' +
  '  }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DatasheetDetailPage implements OnInit {
  public fileUrl: string = undefined
  public loading: boolean = true
  public culture: string = undefined
  public uuid?: string
  public datasheet?: IPCMAttachmentEntry

  constructor(
    private translate: TranslateService,
    private ref: ChangeDetectorRef,
    private repo: PcmRepositoryService,
    route: ActivatedRoute,
    public network: NetworkService
  ) {
    route.params.subscribe(async (params: Params): Promise<void> => {
      this.uuid = params.uuid
      this.load().then((): void => undefined)
    })
    this.network.connected.subscribe((): void => this.ref.markForCheck())
  }

  ngOnInit(): void {
    this.culture = this.translate.currentLang.split('-')[0]
  }

  async load(): Promise<void> {
    if (!this.uuid)
      return

    this.loading = true
    this.fileUrl = undefined

    try {
      this.datasheet = await this.repo.getDatasheet(this.uuid)

      const result: ReadFileResult = await Filesystem.readFile({
        path: `datasheets/${this.datasheet.guid}/${this.datasheet.name}`,
        directory: Directory.Cache
      })

      if (typeof result.data === 'string') {
        this.fileUrl = 'data:application/pdf;base64,' + result.data
      } else {
        const reader = new FileReader()
        reader.onload = (): void => {
          if (typeof reader.result === 'string') {
            this.fileUrl = reader.result
            this.ref.markForCheck()
          }
        }
        reader.readAsDataURL(result.data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      this.ref.markForCheck()
    }
  }

  finish(): void {
    this.loading = false
    this.ref.markForCheck()
  }

  async share(): Promise<ShareResult> {
    const result: GetUriResult = await Filesystem.getUri({
      path: `datasheets/${this.datasheet.guid}/${this.datasheet.name}`,
      directory: Directory.Cache
    })

    return Share.share({
      title: this.datasheet.name,
      text: 'Datasheet: ' + this.datasheet.name,
      url: result.uri
    })
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }
}
