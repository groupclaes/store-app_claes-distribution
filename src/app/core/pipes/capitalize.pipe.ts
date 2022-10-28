import { Pipe, PipeTransform } from '@angular/core'

import * as capitalize from 'capitalize'

@Pipe({
  name: 'capitalize'
})
export class CapitalizePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return value
    return capitalize.words(value, { skipWord: /^(en|de|het|et|a|pour|voor|om|van)$/ })
  }
}
