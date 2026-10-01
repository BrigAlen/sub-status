import { CredentialsForms } from "@/components/CredentialsForms";
import { GoogleCalendarSettings } from "@/components/GoogleCalendarSettings";
import { PushSettings } from "@/components/PushSettings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-sm text-zinc-500">
          Claude — OAuth-вход; Cursor — сессия браузера (официального OAuth
          нет); Google Calendar — отдельный OAuth вход. Секреты хранятся на
          сервере в зашифрованном виде. Push — напоминание «завтра оплата».
        </p>
      </div>
      <PushSettings />
      <GoogleCalendarSettings />
      <CredentialsForms />
    </div>
  );
}
