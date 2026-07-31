export class InternalAuthStateError extends Error {
  constructor() {
    super('The authentication ceremony is unavailable');
  }
}

export class PasskeyAlreadyRegisteredError extends Error {
  constructor() {
    super('The passkey is already registered');
  }
}

export class InternalUserUnavailableError extends Error {
  constructor() {
    super('The internal user is unavailable');
  }
}
