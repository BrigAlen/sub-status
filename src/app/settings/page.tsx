import { CredentialsForms } from "@/components/CredentialsForms";
import { GoogleCalendarSettings } from "@/components/GoogleCalendarSettings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-sm text-zinc-500">
          Учётные данные Cursor/Claude и напоминания Google Calendar. Секреты
          шифруются на сервере и никогда не возвращаются в открытом виде.
        </p>
      </div>
      <GoogleCalendarSettings />
      <CredentialsForms />
    </div>
  );
}
