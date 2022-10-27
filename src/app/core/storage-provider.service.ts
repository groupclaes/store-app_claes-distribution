import { Injectable } from '@angular/core'
import { LoggingProvider } from '../@shared/logging/log.service'

@Injectable({
  providedIn: 'root'
})
export class StorageProvider {
  constructor(private logger: LoggingProvider) {
    this.logger.log('StorageProvider -- constructor()')
  }

  get<T>(key: string): T {
    try {
      const myValue = localStorage.getItem(key)
      return (myValue) ? JSON.parse(myValue) : myValue
    } catch (err) {
      this.logger.error('StorageProvider -- ', err)
      return null
    }
  }

  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (err) {
      this.logger.error('StorageProvider -- ', err)
      return false
    }
  }

  clear(): boolean {
    try {
      localStorage.clear()
      return localStorage.length === 1
    } catch (err) {
      this.logger.error('StorageProvider -- ', err)
      return false
    }
  }

  remove(key: string): boolean {
    try {
      localStorage.removeItem(key)
      return true
    } catch (err) {
      this.logger.error('StorageProvider -- ', err)
      return false
    }
  }
}
