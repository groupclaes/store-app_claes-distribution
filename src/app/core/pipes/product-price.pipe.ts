import { Pipe, PipeTransform } from '@angular/core'
import { ICartDetailProductA } from '../repositories/carts.repository.service'

@Pipe({
  name: 'productPrice'
})
export class ProductPricePipe implements PipeTransform {
  transform(value: ICartDetailProductA): number {
    if (value.amount && value.prices) {
      const amount = value.amount || 0
      let myStack = {
        quantity: 0,
        amount: 0
      }
      for (let price of value.prices) {
        if (price.quantity <= amount && price.quantity > myStack.quantity)
          myStack = price
      }
      return parseFloat((myStack.amount * amount).toFixed(2))
    }

    return 0
  }
}
