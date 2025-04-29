import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core'
import { ActivatedRoute, Params } from '@angular/router'
import { TranslateService } from '@ngx-translate/core'
import { Directory, Filesystem, GetUriResult, ReadFileResult } from '@capacitor/filesystem'
import { Share, ShareResult } from '@capacitor/share'
import { firstValueFrom } from 'rxjs'

@Component({
  selector: 'app-datasheet-detail',
  templateUrl: './document-viewer.page.html',
  styles: ['pdf-viewer {\n' +
  '    display: block;\n' +
  '    height: 100%;\n' +
  '    overflow-y: auto;\n' +
  '  }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentViewerPage {
  public fileUrl: string = undefined
  public loading: boolean = true
  public path?: string
  public uuid?: string
  public name?: string

  constructor(
    private translate: TranslateService,
    private ref: ChangeDetectorRef,
    route: ActivatedRoute
  ) {
    firstValueFrom(route.params).then((params: Params): void => {
      const { path, uuid, name } = params
      this.load(path, uuid, name).then()
    })
  }

  async load(path: string, uuid: string, name: string): Promise<void> {
    if (!uuid)
      return

    this.name = name
    this.uuid = uuid
    this.name = name

    this.loading = true
    this.fileUrl = undefined

    try {
      const result: ReadFileResult = await Filesystem.readFile({
        path: `${path}/${uuid}/${name}`,
        directory: Directory.Cache
      })

      if (typeof result.data === 'string') {
        this.fileUrl = 'data:application/pdf;base64,' + result.data
        this.ref.markForCheck()
      } else {
        const reader = new FileReader()
        reader.onload = (): void => {
          if (typeof reader.result === 'string') {
            this.fileUrl = reader.result
            setTimeout((): void => this.ref.markForCheck(), 80)
          }
        }
        reader.readAsDataURL(result.data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  finish(): void {
    this.loading = false
    this.ref.markForCheck()
  }

  async share(): Promise<ShareResult> {
    const result: GetUriResult = await Filesystem.getUri({
      path: `${this.path}/${this.uuid}/${this.name}`,
      directory: Directory.Cache
    })

    return Share.share({
      title: this.name,
      text: this.path + ': ' + this.name,
      url: result.uri
    })
  }

  get backButtonText(): string {
    return this.translate.instant('backButtonText')
  }
}
