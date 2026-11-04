import { formatEventDate } from "@/lib/format-date";
import { VerifyBanner } from "@/components/ui/VerifyBanner";
import { Card, CardBody } from "@/components/ui/Card";
import { CatPill } from "@/components/ui/Labels";
import { KeyValue } from "@/components/ui/JournalBlocks";
import { Icon } from "@/components/ui/Icon";

type Props = {
  data:
    | { valid: false; event?: { title: string; date: Date | string } }
    | {
        valid: true;
        event: { title: string; date: Date | string };
        category: { name: string; color: string; anonymous: boolean };
        participant?: { firstName: string; lastName: string; structure: string };
      };
};

export function BadgeVerifyView({ data }: Props) {
  if (!data.valid) {
    return (
      <div className="space-y-4">
        <VerifyBanner valid={false} title="Badge non valide">
          <p className="mt-1 text-sm text-white/85">Ce badge a été révoqué ou n&apos;existe pas.</p>
        </VerifyBanner>
        <Card>
          <CardBody className="text-center">
            <span className="text-rose-600">
              <Icon name="x" size={44} />
            </span>
            <p className="mt-3 text-sm font-medium text-slate-900">Accès refusé</p>
            <p className="mt-1 text-[13px] text-slate-400">
              Ce QR code ne correspond à aucun badge actif. Adressez-vous à l&apos;accueil.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const anonymous = data.category.anonymous || !data.participant;
  return (
    <div className="space-y-4">
      <VerifyBanner valid title="Badge valide" />
      <Card>
        <CardBody className="text-center">
          <span className="mx-auto mb-3 flex h-[88px] w-[88px] items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Icon name={anonymous ? "lock" : "user"} size={34} />
          </span>
          {anonymous || !data.participant ? (
            <div className="text-base font-semibold italic text-slate-400">Nom masqué</div>
          ) : (
            <div className="font-badge text-xl font-bold text-navy">
              {data.participant.firstName} {data.participant.lastName}
            </div>
          )}
          <div className="mt-2.5 flex justify-center">
            <CatPill color={data.category.color} label={data.category.name} />
          </div>
          <div className="my-4 border-t border-line" />
          <KeyValue
            items={[
              { label: "Événement", value: data.event.title },
              { label: "Date", value: formatEventDate(data.event.date as Date) },
              ...(anonymous || !data.participant
                ? []
                : [{ label: "Structure", value: data.participant.structure }]),
            ]}
          />
          {anonymous && (
            <p className="mt-4 text-[13px] text-slate-400">
              Cette catégorie est anonyme : l&apos;identité du porteur n&apos;est pas divulguée.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
