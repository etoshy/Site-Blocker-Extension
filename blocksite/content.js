// Normaliza a URL atual para corresponder ao formato armazenado
function normalizeCurrentUrl(hostname) {
    return hostname.replace(/^www\./, '');
}

chrome.storage.sync.get(["blockedSites"], (data) => {
  const currentSite = normalizeCurrentUrl(window.location.hostname);
  
  if (data.blockedSites && data.blockedSites[currentSite]) {
    const entry = data.blockedSites[currentSite];

    // Para o carregamento de outros scripts e recursos
    window.stop();

    document.head.innerHTML = `<style>
      body { margin: 0; padding: 0; }
    </style>
    <title>Acesso Bloqueado</title>`;

    document.body.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100vh;
        background-color: #1e1e1e;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        text-align: center;
        padding: 20px;
        box-sizing: border-box;
      ">
        <h1 style="font-size: 3em; color: #ff4d4d;">🚫 Acesso Bloqueado</h1>
        <p style="font-size: 1.5em;">Este site foi bloqueado na categoria: <strong>${entry.category}</strong></p>
        <p style="font-size: 1.2em; max-width: 600px;">Motivo: ${entry.reason || "Não especificado"}</p>
        <footer style="position: absolute; bottom: 20px; font-size: 0.9em; color: #888;">
          Site Blocker por <a href="https://github.com/etoshy" target="_blank" style="color: #ccc; text-decoration: none;">Etoshy</a>
        </footer>
      </div>
    `;
  }
});