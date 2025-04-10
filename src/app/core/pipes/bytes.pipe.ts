import { Pipe, PipeTransform } from '@angular/core'


export type ByteUnit = 'B' | 'kB' | 'KB' | 'MB' | 'GB' | 'TB' | 'PB'

@Pipe({
  name: 'bytes',
})
export class BytesPipe implements PipeTransform {
  static formats: { [key: string]: { max: number; prev?: ByteUnit } } = {
    B: { max: 1000 },
    kB: { max: Math.pow(1000, 2), prev: 'B' },
    KB: { max: Math.pow(1000, 2), prev: 'B' }, // Backward compatible
    MB: { max: Math.pow(1000, 3), prev: 'kB' },
    GB: { max: Math.pow(1000, 4), prev: 'MB' },
    TB: { max: Math.pow(1000, 5), prev: 'GB' },
    PB: { max: Number.MAX_SAFE_INTEGER, prev: 'TB' },
  }

  // tslint:disable-next-line: member-ordering
  static formatResult(result: string, unit: string): string {
    return `${result} ${unit}`
  }

  static calculateResult(format: { max: number; prev?: ByteUnit }, bytes: number) {
    const prev = format.prev ? BytesPipe.formats[format.prev] : undefined
    return prev ? bytes / prev.max : bytes
  }

  transform(input: any, decimal: number = 99, from: ByteUnit = 'B', to?: ByteUnit): string {
    let bytes = input
    let unit = from
    while (unit !== 'B') {
      bytes *= 1000
      // tslint:disable-next-line: no-non-null-assertion
      unit = BytesPipe.formats[unit].prev!
    }

    if (to) {
      const format = BytesPipe.formats[to]
      const result = toDecimal(BytesPipe.calculateResult(format, bytes), decimal)
      return BytesPipe.formatResult(result.toLocaleString('nl-BE', { maximumFractionDigits: decimal }), to)
    }

    for (const key in BytesPipe.formats) {
      if (BytesPipe.formats.hasOwnProperty(key)) {
        const format = BytesPipe.formats[key]
        if (bytes < format.max) {
          const result = toDecimal(BytesPipe.calculateResult(format, bytes), decimal)

          return BytesPipe.formatResult(result.toLocaleString('nl-BE', { maximumFractionDigits: decimal }), key)
        }
      }
    }
  }
}

function toDecimal(value: number, decimal: number): number {
  return Math.round(value * (decimal * 10)) / (decimal * 10)
}
