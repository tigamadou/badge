import Link from "next/link";

export default function RegisterSuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">Inscription envoyée</h1>
        <p className="text-gray-600 mb-6">
          Votre inscription a bien été reçue. Vous recevrez un email de confirmation
          lorsqu&apos;elle sera validée.
        </p>
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          Faire une autre inscription
        </Link>
      </div>
    </div>
  );
}
