import { Injectable } from '@angular/core'
import { LoggerService } from '../@shared/logging/log.service'

const logger = new LoggerService('StorageProvider')

@Injectable({
  providedIn: 'root'
})
export class StorageProvider {
  constructor() {
    logger.debug('constructor()')
  }

  get<T>(key: string): T {
    try {
      const myValue = localStorage.getItem(key)
      return (myValue) ? JSON.parse(myValue) : myValue
    } catch (err) {
      logger.error('get() -- ', err)
      return null
    }
  }

  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (err) {
      logger.error('set() -- ', err)
      return false
    }
  }

  clear(): boolean {
    try {
      localStorage.clear()
      return localStorage.length === 1
    } catch (err) {
      logger.error('clear() -- ', err)
      return false
    }
  }

  remove(key: string): boolean {
    try {
      localStorage.removeItem(key)
      return true
    } catch (err) {
      logger.error('remove() -- ', err)
      return false
    }
  }
}
