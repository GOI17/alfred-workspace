import type { BridgeRefusal } from './bridge/bridge-caps'

export class BridgeHostDisposedError extends Error {
  constructor() {
    super('the page bridge was torn down before this request answered')
    this.name = 'BridgeHostDisposedError'
  }
}

export class BridgeCapExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BridgeCapExceededError'
  }
}

export class BridgeReplyUndeliverableError extends Error {
  constructor(refusal: BridgeRefusal) {
    super(`the reply could not be delivered to the page (${refusal})`)
    this.name = 'BridgeReplyUndeliverableError'
  }
}
