import type {
  TypeContenuQR,
  TypeQR,
  QRCodeDesign,
} from '@free-qr/shared-types';
import { useState, useCallback, useMemo } from 'react';

export type ContentField = {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select' | 'password';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export const CONTENT_FIELDS: Record<TypeContenuQR, ContentField[]> = {
  url: [{ key: 'url', label: 'URL', type: 'url', required: true, placeholder: 'https://example.com' }],
  texte: [{ key: 'texte', label: 'Texte', type: 'textarea', required: true, placeholder: 'Votre texte...' }],
  email: [
    { key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'contact@example.com' },
    { key: 'objet', label: 'Objet', type: 'text', placeholder: 'Objet du mail' },
    { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Votre message...' },
  ],
  telephone: [{ key: 'telephone', label: 'Téléphone', type: 'tel', required: true, placeholder: '+33 6 12 34 56 78' }],
  sms: [
    { key: 'telephone', label: 'Téléphone', type: 'tel', required: true, placeholder: '+33 6 12 34 56 78' },
    { key: 'message', label: 'Message', type: 'textarea', placeholder: 'Votre SMS...' },
  ],
  wifi: [
    { key: 'ssid', label: 'Nom du réseau (SSID)', type: 'text', required: true, placeholder: 'MonWiFi' },
    { key: 'password', label: 'Mot de passe', type: 'password', placeholder: '••••••••' },
    {
      key: 'securite',
      label: 'Sécurité',
      type: 'select',
      required: true,
      options: [
        { value: 'WPA', label: 'WPA/WPA2' },
        { value: 'WEP', label: 'WEP' },
        { value: 'nopass', label: 'Aucune' },
      ],
    },
    { key: 'cache', label: 'Cacher le SSID', type: 'select', options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }] },
  ],
  vcard: [
    { key: 'prenom', label: 'Prénom', type: 'text', required: true, placeholder: 'Jean' },
    { key: 'nom', label: 'Nom', type: 'text', required: true, placeholder: 'Dupont' },
    { key: 'telephone', label: 'Téléphone', type: 'tel', placeholder: '+33 6 12 34 56 78' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'jean@example.com' },
    { key: 'organisation', label: 'Organisation', type: 'text', placeholder: 'Entreprise' },
    { key: 'site', label: 'Site web', type: 'url', placeholder: 'https://example.com' },
  ],
  geo: [
    { key: 'latitude', label: 'Latitude', type: 'text', required: true, placeholder: '48.8566' },
    { key: 'longitude', label: 'Longitude', type: 'text', required: true, placeholder: '2.3522' },
    { key: 'query', label: 'Requête', type: 'text', placeholder: 'Tour Eiffel' },
  ],
  pdf: [{ key: 'pdfUrl', label: 'URL du PDF', type: 'url', required: true, placeholder: 'https://example.com/document.pdf' }],
};

export const QR_CONTENT_OPTIONS: { value: TypeContenuQR; label: string }[] = [
  { value: 'url', label: 'URL / Lien' },
  { value: 'texte', label: 'Texte simple' },
  { value: 'email', label: 'Email' },
  { value: 'telephone', label: 'Téléphone' },
  { value: 'sms', label: 'SMS' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'vcard', label: 'Carte de visite (vCard)' },
  { value: 'geo', label: 'Géolocalisation' },
  { value: 'pdf', label: 'PDF' },
];

export const QR_TYPES: { value: TypeQR; label: string }[] = [
  { value: 'statique', label: 'Statique' },
  { value: 'dynamique', label: 'Dynamique' },
];

export const QR_CORRECTION_LEVELS = [
  { value: 'L', label: 'L (~7%)' },
  { value: 'M', label: 'M (~15%)' },
  { value: 'Q', label: 'Q (~25%)' },
  { value: 'H', label: 'H (~30%)' },
];

export const QR_SIZES = [200, 400, 600, 800, 1000];

export const DEFAULT_DESIGN: QRCodeDesign = {
  couleur: '#000000',
  background: '#ffffff',
  taille: 400,
  correction: 'M',
  cadre: false,
};

export function encodeContent(type: TypeContenuQR, values: Record<string, string>): string {
  switch (type) {
    case 'url':
      return values.url || '';
    case 'texte':
      return values.texte || '';
    case 'email': {
      const parts = [`mailto:${values.email || ''}`];
      if (values.objet) parts.push(`subject=${encodeURIComponent(values.objet)}`);
      if (values.message) parts.push(`body=${encodeURIComponent(values.message)}`);
      return parts.length > 1 ? parts.join('?') : parts[0];
    }
    case 'telephone':
      return `tel:${values.telephone || ''}`;
    case 'sms': {
      const sms = [`sms:${values.telephone || ''}`];
      if (values.message) sms.push(`body=${encodeURIComponent(values.message)}`);
      return sms.length > 1 ? sms.join('?') : sms[0];
    }
    case 'wifi': {
      const hidden = values.cache === 'true' ? 'true' : 'false';
      return `WIFI:T:${values.securite || 'nopass'};S:${values.ssid || ''};P:${values.password || ''};H:${hidden};;`;
    }
    case 'vcard': {
      const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
      if (values.nom || values.prenom) {
        lines.push(`N:${values.nom || ''};${values.prenom || ''};;;`);
        lines.push(`FN:${values.prenom || ''} ${values.nom || ''}`.trim());
      }
      if (values.telephone) lines.push(`TEL:${values.telephone}`);
      if (values.email) lines.push(`EMAIL:${values.email}`);
      if (values.organisation) lines.push(`ORG:${values.organisation}`);
      if (values.site) lines.push(`URL:${values.site}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }
    case 'geo': {
      if (values.query) return `geo:0,0?q=${encodeURIComponent(values.query)}`;
      return `geo:${values.latitude || '0'},${values.longitude || '0'}`;
    }
    case 'pdf':
      return values.pdfUrl || '';
    default:
      return '';
  }
}

export function useQRForm(defaultType: TypeContenuQR = 'url', defaultTypeQR: TypeQR = 'dynamique') {
  const [contentType, setContentType] = useState<TypeContenuQR>(defaultType);
  const [qrType, setQrType] = useState<TypeQR>(defaultTypeQR);
  const [values, setValues] = useState<Record<string, string>>({});
  const [design, setDesign] = useState<QRCodeDesign>(DEFAULT_DESIGN);
  const [alias, setAlias] = useState('');

  const fields = CONTENT_FIELDS[contentType];

  const updateValue = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetValues = useCallback(() => {
    setValues({});
  }, []);

  const handleContentTypeChange = useCallback((type: TypeContenuQR) => {
    setContentType(type);
    setValues({});
  }, []);

  const encodedContent = useMemo(() => encodeContent(contentType, values), [contentType, values]);

  const setDesignValue = useCallback(<K extends keyof QRCodeDesign>(key: K, value: QRCodeDesign[K]) => {
    setDesign((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isValid = useMemo(() => {
    return encodedContent.length > 0 && fields.every((f) => !f.required || values[f.key]?.trim());
  }, [encodedContent, fields, values]);

  return {
    contentType,
    setContentType: handleContentTypeChange,
    qrType,
    setQrType,
    values,
    updateValue,
    resetValues,
    design,
    setDesign,
    setDesignValue,
    alias,
    setAlias,
    encodedContent,
    fields,
    isValid,
  };
}

export type QRFormState = ReturnType<typeof useQRForm>;
