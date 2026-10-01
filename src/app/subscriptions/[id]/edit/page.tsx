import { notFound } from "next/navigation";
import { SubscriptionForm } from "@/components/SubscriptionForm";
import { getSubscription } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function EditSubscriptionPage({ params }: Props) {
  const { id } = await params;
  const sub = await getSubscription(id);
  if (!sub) notFound();

  return (
    <div>
      <h1 className="mb-3 text-xl font-bold sm:mb-4 sm:text-2xl">Редактирование</h1>
      <SubscriptionForm
        initial={{
          id: sub.id,
          name: sub.name,
          provider: sub.provider,
          kind: sub.kind,
          amountCents: sub.amountCents,
          currency: sub.currency,
          billingPeriod: sub.billingPeriod,
          nextBillingAt: sub.nextBillingAt,
          notes: sub.notes,
          isActive: sub.isActive,
          calendarRemind: sub.calendarRemind,
        }}
      />
    </div>
  );
}
