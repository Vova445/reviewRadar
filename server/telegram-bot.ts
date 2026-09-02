export const telegramCommands = ["/start", "/status", "/reviews", "/insights", "/settings"] as const;
export type TelegramCommand = typeof telegramCommands[number];

export function parseTelegramCommand(text: string): TelegramCommand | null {
  const command = text.trim().split(/\s+/)[0]?.split("@")[0] as TelegramCommand;
  return telegramCommands.includes(command) ? command : null;
}

export function telegramStartMessage(connected: boolean): { text: string; button?: { label: string; action: string } } {
  return connected
    ? { text: "🔔 Notifications enabled\n\nYou will receive:\n• 1★ reviews\n• Negative reviews\n• Important insights" }
    : { text: "Welcome to ReviewRadar. Connect your account to receive reputation alerts.", button: { label: "Connect account", action: "connect_reviewradar" } };
}
