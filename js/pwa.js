let deferredPrompt;

// Registrar o Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swPath = './service-worker.js';

        navigator.serviceWorker.register(swPath)
            .then(registration => {
                console.log('Service Worker registrado com sucesso:', registration.scope);

                // Tratar atualização de nova versão
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            showPwaUpdateToast();
                        }
                    });
                });
            })
            .catch(error => console.log('Falha ao registrar Service Worker:', error));
    });
}

// Helpers Plataforma
function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || ('standalone' in window.navigator && window.navigator.standalone === true);
}

// Inicialização da Lógica de Instalação UI
document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('btnInstalarApp');
    if (!installBtn) return;

    // ETAPA 4: Esconder botão se já estiver instalado (Standalone mode detect)
    if (isInStandaloneMode()) {
        installBtn.classList.add('hidden');
        installBtn.style.display = 'none';
        return; // PWA ativada, nada mais a fazer
    }

    // ETAPA 1 E 2: ANDROID EXPERIÊNCIA
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;

        // Android: Mostra o botão para baixar app
        installBtn.classList.remove('hidden');
        installBtn.style.display = 'flex';
    });

    installBtn.addEventListener('click', async () => {
        // Se for Android com o prompt pronto
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log("App instalado");
                installBtn.classList.add('hidden');
            }
            deferredPrompt = null;
        }
        // ETAPA 3: iOS EXPERIÊNCIA (Safari não suporta beforeinstallprompt nativo)
        else if (isIOS()) {
            showIOSInstallModal();
        }
        else {
            // Fallback Web Desktop
            if (window.showToast) window.showToast('Para instalar, use a opção "Instalar App" no menu do navegador (Chrome/Edge).', 'success');
        }
    });
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBtn = document.getElementById('btnInstalarApp');
    if (installBtn) {
        installBtn.classList.add('hidden');
        installBtn.style.display = 'none';
    }
    console.log('PWA fully installed');
    if (window.showToast) window.showToast('Aplicativo instalado com sucesso!', 'success');
});

// Modal Explicativo para iOS
function showIOSInstallModal() {
    // Evita duplicatas
    if (document.getElementById('ios-install-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'ios-install-modal';
    modal.className = 'fixed inset-0 z-[200] bg-gray-900/80 backdrop-blur-sm flex items-end md:items-center justify-center p-4 animate-fade-in';
    modal.innerHTML = `
        <div class="bg-white dark:bg-dark-surface p-8 pb-12 w-full max-w-sm rounded-[2rem] shadow-2xl relative transform transition-transform translate-y-0">
            <button id="close-ios-modal" class="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <i class="fas fa-times text-xl"></i>
            </button>
            <div class="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
                <i class="fab fa-apple"></i>
            </div>
            <h3 class="text-2xl font-black text-center mb-2 text-gray-900 dark:text-white">Instalar no iPhone</h3>
            <p class="text-center text-gray-500 dark:text-gray-400 font-medium mb-8 text-sm leading-relaxed">Instale o Maestro Pro para ter a experiência completa de aplicativo em tela cheia.</p>
            
            <div class="space-y-4 mb-8 text-sm font-bold text-gray-700 dark:text-gray-300">
                <div class="flex items-center gap-4 bg-gray-50 dark:bg-dark-element p-4 rounded-xl">
                    <div class="w-8 h-8 rounded-full bg-white dark:bg-dark-surface flex items-center justify-center text-blue-500 shadow-sm border border-gray-100 dark:border-gray-700">1</div>
                    <p>Toque no ícone <i class="fas fa-external-link-alt mx-1 text-blue-500"></i> Compartilhar na barra do Safari</p>
                </div>
                <div class="flex items-center gap-4 bg-gray-50 dark:bg-dark-element p-4 rounded-xl">
                    <div class="w-8 h-8 rounded-full bg-white dark:bg-dark-surface flex items-center justify-center text-blue-500 shadow-sm border border-gray-100 dark:border-gray-700">2</div>
                    <p>Role para baixo e selecione <span class="text-gray-900 dark:text-white font-black">"Adicionar à Tela de Início"</span> <i class="far fa-plus-square ml-1 text-gray-400"></i></p>
                </div>
            </div>
            <button id="btn-understood-ios" class="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all active:scale-95">Entendido</button>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('close-ios-modal').addEventListener('click', () => modal.remove());
    document.getElementById('btn-understood-ios').addEventListener('click', () => modal.remove());
}

// Detecção de status Online/Offline
window.addEventListener('online', () => {
    if (window.showToast) window.showToast('Conexão restabelecida! Sincronização em nuvem ativa.', 'success');
});

window.addEventListener('offline', () => {
    if (window.showToast) window.showToast('Modo Offline: Funcionando usando os dados locais.', 'error');
});

function showPwaUpdateToast() {
    const el = document.createElement('div');
    el.className = 'fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-dark-element text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm z-[200] flex flex-col md:flex-row items-center gap-4 border border-brand/50';
    el.innerHTML = `
        <div class="flex items-center gap-2"><i class="fas fa-sync text-brand animate-spin"></i> Nova versão disponível!</div>
        <button id="btn-update-pwa" class="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">Atualizar</button>
    `;
    document.body.appendChild(el);

    document.getElementById('btn-update-pwa').addEventListener('click', () => {
        if (navigator.serviceWorker.controller) {
            window.location.reload();
        }
    });
}
