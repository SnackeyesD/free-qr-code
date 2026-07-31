import { QRCreateForm } from '@/components/QRForm';

export default function QRCreatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Créer un QR code</h2>
        <p className="mt-1 text-sm text-gray-600">
          Choisissez le type de contenu, personnalisez le design et prévisualisez avant de créer.
        </p>
      </div>

      <QRCreateForm />
    </div>
  );
}
