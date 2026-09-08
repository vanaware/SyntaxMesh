import { navigate, activeView, pastaSelecionada } from '../stores/router.ts';
import { ContatosSection } from './ContatosSection.tsx';
import { 
  pastasAtivas, 
  isMotorLigar, 
  alternarMotor, 
  progressoMap 
} from '../stores/torrentLabsStore.ts';

interface AppSidebarProps {
  isIdentityValid: boolean;
}

export function AppSidebar({ isIdentityValid }: AppSidebarProps) {
  return (
    <aside class="app-sidebar">
      <header class="sidebar-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="position: relative;">
            <md-icon-button id="btn-menu" onClick={() => {
              const menu: any = document.getElementById('main-menu');
              if (menu) menu.open = !menu.open;
            }}>
              <md-icon>menu</md-icon>
            </md-icon-button>
            
            <md-menu id="main-menu" anchor="btn-menu" positioning="popover">
              <md-menu-item onClick={() => { navigate(''); document.getElementById('main-menu')?.removeAttribute('open'); }}>
                <div slot="headline">Início (Chat)</div>
                <md-icon slot="start">forum</md-icon>
              </md-menu-item>
              <md-menu-item onClick={() => { navigate('#settings'); document.getElementById('main-menu')?.removeAttribute('open'); }}>
                <div slot="headline">Configurações</div>
                <md-icon slot="start">settings</md-icon>
              </md-menu-item>
              <md-menu-item onClick={() => { navigate('#advanced'); document.getElementById('main-menu')?.removeAttribute('open'); }}>
                <div slot="headline">Avançado</div>
                <md-icon slot="start">settings_suggest</md-icon>
              </md-menu-item>
              <md-menu-item onClick={() => { navigate('#labs'); document.getElementById('main-menu')?.removeAttribute('open'); }}>
                <div slot="headline">WebTorrent Labs</div>
                <md-icon slot="start">science</md-icon>
              </md-menu-item>
              <md-menu-item onClick={() => { navigate('#logout'); document.getElementById('main-menu')?.removeAttribute('open'); }}>
                <div slot="headline">Sair do App (Logout)</div>
                <md-icon slot="start">logout</md-icon>
              </md-menu-item>
            </md-menu>
          </div>
          <h1 style="margin: 0; font-size: 1.25rem;">Loco</h1>
        </div>
        
        <div style="display: flex; gap: 4px;">
          <md-icon-button onClick={() => navigate('#profile')} title="Meu Perfil">
            <md-icon>account_circle</md-icon>
          </md-icon-button>
        </div>
      </header>
      
      <div class="sidebar-content" style="padding: 0; display: flex; flex-direction: column;">
        {activeView.value === 'labs' ? (
          /* 🔥 ARQUITETURA: Visão do Labs na Sidebar */
          <div style="display: flex; flex-direction: column; height: 100%;">
            <div style="padding: 16px; border-bottom: 1px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface-container-low);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <span style="font-weight: 600; font-size: 0.95rem; color: var(--md-sys-color-primary); display: flex; align-items: center; gap: 6px;">
                  <md-icon>{isMotorLigar.value ? 'cloud_sync' : 'cloud_off'}</md-icon> Motor P2P
                </span>
                <md-switch selected={isMotorLigar.value} onClick={alternarMotor}></md-switch>
              </div>
              <md-filled-button onClick={() => navigate('#labs')} style="width: 100%;">
                <md-icon slot="icon">create_new_folder</md-icon> Nova Pasta
              </md-filled-button>
            </div>

            <div style="flex-grow: 1; overflow-y: auto; padding: 8px;">
              <md-list style="background: transparent;">
                {pastasAtivas.value.map((pasta) => {
                  const isSelected = pastaSelecionada.value === pasta.id;
                  const liveData = progressoMap.value[pasta.id];
                  const displayProgress = liveData ? liveData.progress : pasta.complete;
                  
                  return (
                    <md-list-item 
                      key={pasta.id} 
                      onClick={() => navigate(`#labs=${pasta.id}`)}
                      style={`
                        cursor: pointer; 
                        border-radius: 8px; 
                        margin-bottom: 4px;
                        background: ${isSelected ? 'var(--md-sys-color-secondary-container)' : 'transparent'};
                      `}
                    >
                      <md-icon slot="start" style={`color: ${pasta.status === 'seeding' ? 'var(--md-sys-color-primary)' : pasta.status === 'downloading' ? '#0288d1' : 'var(--md-sys-color-on-surface-variant)'};`}>
                        {pasta.status === 'seeding' ? 'upload' : pasta.status === 'downloading' ? 'download' : 'pause_circle'}
                      </md-icon>
                      
                      <div slot="headline" style="font-weight: 500; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        {pasta.name}
                      </div>
                      
                      <div slot="supporting-text" style="font-size: 0.75rem; color: var(--md-sys-color-on-surface-variant); display: flex; gap: 8px;">
                        <span>{displayProgress}%</span>
                        <span>•</span>
                        <span>{pasta.files.length} arq.</span>
                      </div>
                    </md-list-item>
                  );
                })}
              </md-list>
            </div>
          </div>
        ) : (
          /* Visão Padrão: Contatos */
          <div style="padding: 12px; animation: fadeIn 0.3s ease;">
            {isIdentityValid ? <ContatosSection/> : <p style="text-align: center; color: var(--md-sys-color-on-surface-variant); margin-top: 40px;">Configure seu perfil primeiro.</p>}
          </div>
        )}
      </div>
    </aside>
  );
}