import { QREditForm } from '@/components/QRForm';

export default function QREditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Modifier le QR code</h2>
        <p className="mt-1 text-sm text-gray-600">
          Modifiez le design et les paramètres du QR code. Le contenu d'un QR statique ne peut pas être modifié.
        </p>
      </div>

      <QREditForm />
    </div>
  );
}
