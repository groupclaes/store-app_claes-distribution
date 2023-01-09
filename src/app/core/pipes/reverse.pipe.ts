import { Pipe, PipeTransform } from '@angular/core';
import { IProductPrice } from '../repositories/products.repository.service';

@Pipe({
  name: 'reverse'
})
export class ReversePipe implements PipeTransform {
  transform(value: any[]): IProductPrice[] {
    if (!value) return
    return value.reverse()
  }
}
