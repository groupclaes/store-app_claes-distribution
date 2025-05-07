import { Subject } from 'rxjs'
import { environment } from 'src/environments/environment'

/**
 * The possible log levels.
 * LogLevel.Off is never emitted and only used with Logger.level property to disable logs.
 * https://docs.oracle.com/en/industries/communications/session-border-controller/8.2.0/mibguide/log-levels-and-syslog-level-severities.html
 */
export enum LogLevel {
  Off = 0,
  Emergency = 1,
  Critical = 2,
  // Major = 3,
  // Minor = 4,
  Warning = 5,
  Notice = 6,
  Info = 7,
  Trace = 8,
  Debug = 9
}

/**
 * Log output handler function.
 */
export type LogOutput = (source: string, level: LogLevel, ...objects: any[]) => void

export class LoggerService {
  static logKey: string = 'logs-' + new Date().toISOString().substring(0, 10)

  /**
   * Current logging level.
   * Set it to LogLevel.Off to disable logs completely.
   */
  static level: LogLevel = environment.production ? LogLevel.Warning : LogLevel.Debug

  /**
   * Additional log outputs.
   */
  static outputs: any[] = []

  constructor(private source?: string) {
    if (window.localStorage.getItem('logs') !== null)
      window.localStorage.removeItem('logs')

    // only keep 3 days of logs
    const date: Date = new Date()
    const today: string = 'logs-' + date.toISOString().substring(0, 10)
    date.setDate(date.getDate() - 1)
    const yesterday: string = 'logs-' + date.toISOString().substring(0, 10)
    date.setDate(date.getDate() - 1)
    const beforeYesterday: string = 'logs-' + date.toISOString().substring(0, 10)

    const keys: string[] = []

    for (let i: number = 0; i < window.localStorage.length; i++) {
      const key: string = window.localStorage.key(i)
      keys.push(key)
    }

    for (let logKey of keys.filter(e => e.startsWith('logs'))) {
      if (![today, yesterday, beforeYesterday].includes(logKey))
        window.localStorage.removeItem(logKey)
    }

    // console.log(keys)
  }

  static listen: Subject<any[]> = new Subject<any[]>

  /**
   * Logs messages or objects  with the trace level.
   * Works the same as console.log().
   */
  trace(...objects: any[]): void {
    this.log(console.trace, LogLevel.Trace, objects)
  }

  /**
   * Logs messages or objects  with the debug level.
   * Works the same as console.log().
   */
  debug(...objects: any[]): void {
    this.log(console.debug, LogLevel.Debug, objects)
  }

  /**
   * Logs messages or objects  with the info level.
   * Works the same as console.log().
   */
  notice(...objects: any[]): void {
    this.log(console.log, LogLevel.Notice, objects)
  }

  /**
   * Logs messages or objects  with the info level.
   * Works the same as console.log().
   */
  info(...objects: any[]): void {
    this.log(console.info, LogLevel.Info, objects)
  }

  /**
   * Logs messages or objects  with the warning level.
   * Works the same as console.log().
   */
  warn(...objects: any[]): void {
    this.log(console.warn, LogLevel.Warning, objects)
  }

  /**
   * Logs messages or objects  with the error level.
   * Works the same as console.log().
   */
  error(...objects: any[]): void {
    this.log(console.error, LogLevel.Critical, objects)
  }

  /**
   * Logs messages or objects  with the emergency level.
   * Works the same as console.log().
   */
  emergency(...objects: any[]): void {
    this.log(console.error, LogLevel.Emergency, objects)
  }

  private log(func: Function, level: LogLevel, objects: any[]): void {
    if (level <= LoggerService.level) {
      let storage: any = LoggerService.get(this.storage)
      try {
        const log: (string | LogLevel)[] = [new Date().toISOString(), level, this.source ?? 'unknown'].concat(objects)

        // when testing use console logging functionality
        if (!environment.production)
          func.apply(console, log)

        LoggerService.outputs.forEach((output: any): any => output(log))
        storage.push(log)
        try {
          this.storage.setItem(LoggerService.logKey, JSON.stringify(storage))
        } catch (error) {
          // Quota is probably reached
          console.trace('Quota is probably reached, skipping logging')
        }
        LoggerService.listen.next(log)
      } catch (err) {
        console.error(err)
      }
    }
  }

  static get(store: Storage = sessionStorage): any[] {
    let storage: any = store.getItem(LoggerService.logKey)

    if (!storage)
      storage = []
    else
      storage = JSON.parse(storage)

    return storage
  }

  static clear(store: Storage = sessionStorage): void {
    store.removeItem(LoggerService.logKey)
    LoggerService.listen.next(undefined)
  }

  private get storage(): Storage {
    if (environment.production)
      return window.localStorage
    return window.sessionStorage
  }
}
