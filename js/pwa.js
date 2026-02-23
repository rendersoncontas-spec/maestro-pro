let deferredPrompt;

// Registrar o Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Obter caminho correto (padrão GitHub Pages ou local)
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

// Botão Instalar App PWA
window.addEventListener('beforeinstallprompt', (e) => {
    // Evita o mini-infobar default no mobile
    e.preventDefault();
    deferredPrompt = e;

    // Mostra o botão personalizado
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', async () => {
            installBtn.classList.add('hidden');
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                console.log('App instalado com sucesso');
                // Feedback
                if (window.showToast) window.showToast('Instalação Iniciada!', 'success');
            }
            deferredPrompt = null;
        });
    }
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) installBtn.classList.add('hidden');
    console.log('PWA fully installed');
    if (window.showToast) window.showToast('Aplicativo instalado com sucesso!', 'success');
});

// Detecção de status Online/Offline
window.addEventListener('online', () => {
    if (window.showToast) window.showToast('Conexão restabelecida! Sincronização em nuvem ativa.', 'success');
});

window.addEventListener('offline', () => {
    if (window.showToast) window.showToast('Modo Offline: Funcionando usando os dados em cache e baseados no seu navegador.', 'error');
});

function showPwaUpdateToast() {
    const el = document.createElement('div');
    el.className = 'fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 dark:bg-dark-element text-white px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm z-[200] flex flex-col md:flex-row items-center gap-4 border border-brand/50';
    el.innerHTML = `
        <div class="flex items-center gap-2"><i class="fas fa-sync text-brand animate-spin"></i> Nova versão disponAvel!</div>
        <button id="btn-update-pwa" class="bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">Atualizar</button>
    `;
    document.body.appendChild(el);

    document.getElementById('btn-update-pwa').addEventListener('click', () => {
        if (navigator.serviceWorker.controller) {
            // Pede ao novo sw para assumir o controle  --> "skipWaiting" ativado
            window.location.reload();
        }
    });
}
