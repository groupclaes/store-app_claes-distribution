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
  static logKey = 'logs'

  /**
   * Current logging level.
   * Set it to LogLevel.Off to disable logs completely.
   */
  static level = LogLevel.Debug

  /**
   * Additional log outputs.
   */
  static outputs: any[] = []

  /**
   * Enables production mode.
   * Sets logging level to LogLevel.Warning.
   */
  static enableProductionMode() {
    LoggerService.level = LogLevel.Warning
  }

  constructor(private source?: string) { }

  static listen: Subject<any[]> = new Subject<any[]>

  /**
   * Logs messages or objects  with the trace level.
   * Works the same as console.log().
   */
  trace(...objects: any[]) {
    this.log(console.trace, LogLevel.Trace, objects)
  }

  /**
   * Logs messages or objects  with the debug level.
   * Works the same as console.log().
   */
  debug(...objects: any[]) {
    this.log(console.debug, LogLevel.Debug, objects)
  }

  /**
   * Logs messages or objects  with the info level.
   * Works the same as console.log().
   */
  notice(...objects: any[]) {
    this.log(console.log, LogLevel.Notice, objects)
  }

  /**
   * Logs messages or objects  with the info level.
   * Works the same as console.log().
   */
  info(...objects: any[]) {
    this.log(console.info, LogLevel.Info, objects)
  }

  /**
   * Logs messages or objects  with the warning level.
   * Works the same as console.log().
   */
  warn(...objects: any[]) {
    this.log(console.warn, LogLevel.Warning, objects)
  }

  /**
   * Logs messages or objects  with the error level.
   * Works the same as console.log().
   */
  error(...objects: any[]) {
    this.log(console.error, LogLevel.Critical, objects)
  }

  /**
   * Logs messages or objects  with the emergency level.
   * Works the same as console.log().
   */
  emergency(...objects: any[]) {
    this.log(console.error, LogLevel.Emergency, objects)
  }

  private log(func: Function, level: LogLevel, objects: any[]) {
    let storage: any = sessionStorage.getItem(LoggerService.logKey)
    if (!storage)
      storage = []
    else
      storage = JSON.parse(storage)
    if (level <= LoggerService.level) {
      try {
        const log = [new Date().toISOString(), level, this.source ?? 'unknown'].concat(objects)

        // when testing use console loggin functionality
        if (!environment.production)
          func.apply(console, log)

        LoggerService.outputs.forEach((output) => output(log))
        storage.push(log)
        sessionStorage.setItem(LoggerService.logKey, JSON.stringify(storage))
        LoggerService.listen.next(log)
      } catch (err) {
        console.error(err)
      }
    }
  }

  static get(): any[] {
    let storage: any = sessionStorage.getItem(LoggerService.logKey)

    if (!storage)
      storage = []
    else
      storage = JSON.parse(storage)

    return storage
  }

  static clear() {
    sessionStorage.removeItem(LoggerService.logKey)
    LoggerService.listen.next(undefined)
  }
}
