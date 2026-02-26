export class NotificationEvent {
  constructor(public readonly payload: { notification: any; sendEmail: boolean }) {}
}
