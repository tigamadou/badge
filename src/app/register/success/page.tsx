import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";

export default function RegisterSuccessPage() {
  return (
    <AuthCard title="Inscription envoyée">
      <div className="text-center space-y-4">
        <p className="text-sm text-slate-600">
          Votre inscription a bien été reçue. Vous recevrez un email de confirmation
          lorsqu&apos;elle sera validée.
        </p>
        <Link href="/" className="text-green-600 hover:underline text-sm">
          Faire une autre inscription
        </Link>
      </div>
    </AuthCard>
  );
}
