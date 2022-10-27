import { Injectable } from '@angular/core'
import { LogPublishersService } from './log-publisher.service'
import { LogPublisher } from './log-publishers'

@Injectable({
  providedIn: 'root'
})
export class LoggingProvider {
  private publishers: LogPublisher[] = []
  private _level: LogLevel = LogLevel.All
  logWithDate: boolean = true

  constructor(private publishersService: LogPublishersService) {
    // Set publishers
    this.publishers = this.publishersService.publishers
  }

  log(message?: string, ...optionalParams: any[]) {
    this.writeToLog(message, LogLevel.All, optionalParams)
  }

  debug(message?: string, ...optionalParams: any[]) {
    this.writeToLog(message, LogLevel.Debug, optionalParams)
  }

  info(message?: string, ...optionalParams: any[]) {
    this.writeToLog(message, LogLevel.Info, optionalParams)
  }

  warn(message?: string, ...optionalParams: any[]) {
    this.writeToLog(message, LogLevel.Warn, optionalParams)
  }

  error(message?: string, ...optionalParams: any[]) {
    this.writeToLog(message, LogLevel.Error, optionalParams)
  }

  fatal(message?: string, ...optionalParams: any[]) {
    this.writeToLog(message, LogLevel.Fatal, optionalParams)
  }

  private writeToLog(msg: string, level: LogLevel, params: any[]) {
    // disable logging
    // return
    if (this.shouldLog(level)) {
      let entry: LogEntry = new LogEntry()
      entry.message = msg
      entry.level = level
      entry.extraInfo = params
      entry.logWithDate = this.logWithDate

      for (let logger of this.publishers) {
        logger.log(entry).subscribe(response => {
          if (!response) {
            console.error('could not log entry; ', entry)
          }
        })
      }
    }
  }

  get Level(): LogLevel {
    return this._level
  }

  set Level(value: LogLevel) {
    this._level = value
  }

  private shouldLog(level: LogLevel): boolean {
    let ret: boolean = false
    if ((level >= this._level &&
      level !== LogLevel.Off) ||
      this._level === LogLevel.All) {
      ret = true
    }
    return ret
  }
}

export class LogEntry {
  // Public Properties
  entryDate: Date = new Date()
  message: string = ""
  level: LogLevel = LogLevel.Debug
  extraInfo: any[] = []
  logWithDate: boolean = true

  buildLogString(): string {
    let ret: string = ""

    if (this.logWithDate) {
      ret = new Date().toISOString() + " - "
    }
    ret += "Type: " + LogLevel[this.level]
    ret += " - Message: " + this.message
    if (this.extraInfo.length) {
      ret += " - Extra Info: "
        + this.formatParams(this.extraInfo)
    }

    return ret
  }

  private formatParams(params: any[]): string {
    let ret: string = params.join(",")

    // Is there at least one object in the array?
    if (params.some(p => typeof p == "object")) {
      ret = ""
      // Build comma-delimited string
      for (let item of params) {
        ret += JSON.stringify(item) + ","
      }
    }

    return ret
  }
}

export enum LogLevel {
  All = 0,
  Debug = 1,
  Info = 2,
  Warn = 3,
  Error = 4,
  Fatal = 5,
  Off = 6
}
