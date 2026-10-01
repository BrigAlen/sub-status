import { CredentialsForms } from "@/components/CredentialsForms";
import { GoogleCalendarSettings } from "@/components/GoogleCalendarSettings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-sm text-zinc-500">
          Claude — OAuth-кнопка; Cursor — сессия браузера (официального OAuth
          нет); Google Calendar — отдельный OAuth ниже. Секреты шифруются на
          сервере и не возвращаются в браузер.
        </p>
      </div>
      <GoogleCalendarSettings />
      <CredentialsForms />
    </div>
  );
}