import { HttpRequest, HttpResponse } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'
import { Observable, from, map } from 'rxjs'

@Injectable({
  providedIn: 'root'
})
export class ThumbCacheService {
  get(request: HttpRequest<any>): Observable<any> {
    const itemnum = request.url
      .replace('https://pcm.groupclaes.be/v4/product-images/dis/', '')
      .replace('?s=thumb', '')

    return from(
      Filesystem.readFile({
        path: 'thumbnails/' + itemnum + '.blob',
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      })
    )
      .pipe(map(r => new HttpResponse({
        body: b64toBlob(r.data, 'image/jpeg')
      })))
  }

  put(request: HttpRequest<any>, response: HttpResponse<Blob>) {
    const itemnum = request.url
      .replace('https://pcm.groupclaes.be/v4/product-images/dis/', '')
      .replace('?s=thumb', '')

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        Filesystem.writeFile({
          path: 'thumbnails/' + itemnum + '.blob',
          data: reader.result,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
          recursive: true
        })
      }
    }
    reader.readAsDataURL(response.body)
    // console.log(request, response)
  }
}
function b64toBlob(b64Data, contentType = '', sliceSize = 512) {
  // console.log(b64Data)
  const byteCharacters = atob(b64Data.replace('data:image/jpeg;base64,', ''))
  const byteArrays = []

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize)

    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }

  const blob = new Blob(byteArrays, { type: contentType })
  return blob
}