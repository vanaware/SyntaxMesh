// Arquivo: monorepo/ui/src/stores/profileStore.ts
import { signal, batch } from '@preact/signals';
import { buscarProfile, salvarProfile } from '@loco/utils/db';
import type { ProfileConfig } from '@loco/utils/interfaces';
import { profileName, profileEmail, addDebugLog } from './state.ts';

export const isSavingProfile = signal<boolean>(false);
export const profile = signal<ProfileConfig | null>(null);

export async function carregarProfile() {
  try {
    const p = await buscarProfile();
    batch(() => {
      profile.value = p || null;
      if (p) {
        profileName.value = p.name;
        profileEmail.value = p.email;
      }
    });
  } catch (error) {
    addDebugLog("error", "STORE:PROFILE", "Falha ao carregar perfil do DB", error);
  }
}

export async function atualizarProfile(p: ProfileConfig) {
  if (isSavingProfile.value) {
    addDebugLog("warn", "STORE:PROFILE", "Salvamento de perfil enfileirado/ignorado por concorrência.");
    return;
  }

  let requiresDowngrade = false;
  const oldP = profile.value;
  if (oldP) {
    if (
      oldP.vapidPrivateKeyEnvelope !== p.vapidPrivateKeyEnvelope ||
      oldP.subscription?.endpoint !== p.subscription?.endpoint ||
      oldP.subscription?.proxyserver !== p.subscription?.proxyserver ||
      JSON.stringify(oldP.e2ePublicKey) !== JSON.stringify(p.e2ePublicKey) ||
      JSON.stringify(oldP.vapidPublicKey) !== JSON.stringify(p.vapidPublicKey)
    ) {
      requiresDowngrade = true;
    }
  }

  batch(() => {
    profile.value = { ...p };
    profileName.value = p.name;
    profileEmail.value = p.email;
  });

  isSavingProfile.value = true;
  try {
    await salvarProfile(p);
    if (requiresDowngrade) {
      addDebugLog("info", "STORE:PROFILE", "Mudança estrutural detectada na identidade. Disparando rebaixamento de confiança...");
      const { rebaixarConfiancaContatos } = await import('./contatosStore.ts');
      await rebaixarConfiancaContatos();
    }
  } catch (error) {
    addDebugLog("error", "STORE:PROFILE", "Falha catastrófica ao persistir perfil no DB.", error);
  } finally {
    isSavingProfile.value = false;
  }
}

export async function initProfileStore() {
  await carregarProfile();
}