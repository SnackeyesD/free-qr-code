import type { Utilisateur as User } from "@free-qr/shared-types";
import { api } from "./api";

export type ProfileUpdateInput = {
  nom?: string;
  consentementMarketing?: boolean;
};

export type PasswordUpdateInput = {
  ancienMotDePasse: string;
  nouveauMotDePasse: string;
};

export type MeUpdateInput = ProfileUpdateInput & Partial<PasswordUpdateInput>;

export async function getMe(): Promise<User> {
  const response = await api.get<User>("/me");
  return response.data;
}

export async function updateProfile(data: MeUpdateInput): Promise<User> {
  const { ancienMotDePasse, ...resData } = data;
  const response = await api.patch<User>("/me", {
    motDePasseActuel: ancienMotDePasse,
    ...resData,
  });
  return response.data;
}
