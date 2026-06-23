import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  ILogger,
  LogLevel,
} from '@microsoft/signalr';

const signalRLogger: ILogger = {
  log(logLevel, message) {
    // React StrictMode mounts effects twice in development. It can stop the
    // first, still-negotiating connection before the second one connects.
    if (
      message.includes('connection was stopped during negotiation') ||
      message.includes('stopped before the hub handshake could complete')
    ) {
      return;
    }

    // Do not emit informational logs: SignalR includes the access token in
    // the WebSocket URL, which should not be copied into browser consoles.
    if (logLevel < LogLevel.Warning) return;
    if (logLevel >= LogLevel.Error) console.error(`[SignalR] ${message}`);
    else console.warn(`[SignalR] ${message}`);
  },
};

export function createHubConnection(
  url: string,
  getToken: () => string | null,
): HubConnection {
  return new HubConnectionBuilder()
    .configureLogging(signalRLogger)
    .withUrl(url, {
      accessTokenFactory: () => getToken() ?? '',
    })
    .withAutomaticReconnect()
    .build();
}

export { HubConnection, HubConnectionState };
