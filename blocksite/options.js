document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let currentViewMode = 'category'; // 'category' ou 'date'

    // --- ELEMENT SELECTORS ---
    const tabs = document.querySelectorAll('.tab-button');
    const panes = document.querySelectorAll('.tab-pane');
    const addSitesBtn = document.getElementById('addSitesBtn');
    const addCategorySelect = document.getElementById('addCategorySelect');
    const addCustomCategory = document.getElementById('addCustomCategory');
    
    // Gerenciar Tab Elements
    const siteListContainer = document.getElementById('siteList');
    const openAddModalBtn = document.getElementById('openAddModalBtn');
    const viewByCategoryBtn = document.getElementById('viewByCategoryBtn');
    const viewByDateBtn = document.getElementById('viewByDateBtn');

    // Modal Elements
    const modal = document.getElementById('editModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalSaveBtn = document.getElementById('modalSaveBtn');
    const modalUrlInput = document.getElementById('modalUrlInput');
    const modalCategorySelect = document.getElementById('modalCategorySelect');
    const modalCustomCategory = document.getElementById('modalCustomCategory');
    const modalReasonInput = document.getElementById('modalReasonInput');

    // --- INITIAL SETUP ---
    initializeTabs();
    initializeCategorySelect(addCategorySelect, addCustomCategory);
    initializeCategorySelect(modalCategorySelect, modalCustomCategory);
    populateAllCategorySelects();
    renderBlockedSites();

    // --- EVENT LISTENERS ---
    addSitesBtn.addEventListener('click', addSitesFromMainForm);
    
    // View Controls
    viewByCategoryBtn.addEventListener('click', () => setViewMode('category'));
    viewByDateBtn.addEventListener('click', () => setViewMode('date'));
    
    // Modal Controls
    openAddModalBtn.addEventListener('click', () => openModalForAdding());
    modalCloseBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); }); // Close on backdrop click
    modalSaveBtn.addEventListener('click', handleModalSave);

    // Dynamic listener for edit/delete buttons on the site list
    siteListContainer.addEventListener('click', (e) => {
        const url = e.target.dataset.url;
        if (e.target.classList.contains('edit-btn')) {
            openModalForEditing(url);
        }
        if (e.target.classList.contains('delete-btn')) {
            removeSite(url);
        }
    });

    // --- FUNCTIONS ---
    
    function initializeTabs() {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetPane = document.getElementById(tab.dataset.tab);
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                panes.forEach(p => p.classList.remove('active'));
                targetPane.classList.add('active');
            });
        });
    }

    function initializeCategorySelect(selectElement, customInputElement) {
        selectElement.addEventListener('change', () => {
            customInputElement.style.display = selectElement.value === '___new___' ? 'block' : 'none';
        });
    }

    async function populateAllCategorySelects() {
        const { blockedSites = {} } = await chrome.storage.sync.get(["blockedSites"]);
        const standardCategories = ["Redes Sociais", "Pornografia", "Procrastinação", "Notícias"];
        
        const existingCategories = Object.values(blockedSites).map(site => site.category);
        const allCategories = [...new Set([...standardCategories, ...existingCategories])].sort();

        // Populate both select elements
        [addCategorySelect, modalCategorySelect].forEach(select => {
            const currentValue = select.value;
            select.innerHTML = ''; // Clear existing options
            allCategories.forEach(cat => {
                if (!cat) return; // Skip empty categories
                const option = document.createElement('option');
                option.value = cat;
                option.textContent = cat;
                select.appendChild(option);
            });
            const newOption = document.createElement('option');
            newOption.value = '___new___';
            newOption.textContent = 'Outra (digite abaixo)';
            select.appendChild(newOption);

            // Try to restore previous selection
            if (allCategories.includes(currentValue)) {
                select.value = currentValue;
            }
        });
    }

    /**
     * Normaliza uma URL para um formato padrão (ex: google.com).
     * Remove espaços, http/https, www. e a barra final.
     * @param {string} url - A URL a ser normalizada.
     * @returns {string} - A URL normalizada ou uma string vazia se inválida.
     */
    function normalizeUrl(url) {
        // CORREÇÃO APLICADA AQUI: Limpa a string antes de qualquer coisa.
        const trimmedUrl = url.trim();
        if (!trimmedUrl) {
            return ''; // Retorna vazio se a string for só espaços ou vazia.
        }
        
        try {
            // Adiciona um protocolo padrão se não houver para que o construtor de URL funcione
            let fullUrl = trimmedUrl;
            if (!/^(https?:)?\/\//.test(fullUrl)) {
                fullUrl = 'https://' + fullUrl;
            }
            const urlObject = new URL(fullUrl);
            // Remove 'www.' do hostname e retorna
            return urlObject.hostname.replace(/^www\./, '');
        } catch (error) {
            // Fallback para strings que não são URLs válidas (ex: "meusite")
            // Remove o protocolo (se houver) e tudo após a primeira barra.
            return trimmedUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
        }
    }

    function addSitesFromMainForm() {
        const rawInput = document.getElementById("sitesInput").value;
        let category = addCategorySelect.value;
        if (category === "___new___") {
            category = addCustomCategory.value.trim();
        }
        const reason = document.getElementById("reasonInput").value.trim();
        
        addOrUpdateSites(rawInput, category, reason);

        // Clear form
        document.getElementById("sitesInput").value = "";
        document.getElementById("reasonInput").value = "";
        addCustomCategory.value = "";
        addCategorySelect.value = "Redes Sociais";
        addCustomCategory.style.display = "none";
    }
    
    async function addOrUpdateSites(rawUrls, category, reason, oldUrl = null) {
        if (!category) {
            alert("Selecione ou insira uma categoria.");
            return;
        }
        // A mágica acontece aqui: normalizeUrl agora lida com os espaços.
        const urls = rawUrls.split(",").map(normalizeUrl).filter(u => u);

        if (urls.length === 0) {
            alert("Por favor, insira pelo menos uma URL válida.");
            return;
        }

        const { blockedSites = {} } = await chrome.storage.sync.get(["blockedSites"]);
        const now = new Date().toISOString();

        if (oldUrl) { // This is an edit
            const newUrl = urls[0];
            if (oldUrl !== newUrl && blockedSites[newUrl]) {
                alert(`O site "${newUrl}" já está na lista de bloqueio. Não é possível renomear para um site existente.`);
                return;
            }
            const originalEntry = blockedSites[oldUrl];
            delete blockedSites[oldUrl];
            blockedSites[newUrl] = {
                category,
                reason,
                addedAt: originalEntry.addedAt // Preserve original add date
            };
        } else { // This is an add operation
            urls.forEach(url => {
                if (blockedSites[url]) {
                    console.warn(`Site ${url} já existe, pulando.`);
                    return;
                }
                blockedSites[url] = { category, reason, addedAt: now };
            });
        }
        
        await chrome.storage.sync.set({ blockedSites });
        alert("Operação concluída com sucesso!");
        closeModal();
        renderBlockedSites();
        populateAllCategorySelects();
    }

    async function renderBlockedSites() {
        siteListContainer.innerHTML = "Carregando...";
        const { blockedSites = {} } = await chrome.storage.sync.get(["blockedSites"]);
        const sitesArray = Object.entries(blockedSites).map(([url, data]) => ({ url, ...data }));

        if (sitesArray.length === 0) {
            siteListContainer.innerHTML = "<p>Nenhum site bloqueado ainda.</p>";
            return;
        }

        siteListContainer.innerHTML = ""; // Clear for rendering

        if (currentViewMode === 'category') {
            renderByCategory(sitesArray);
        } else {
            renderByDate(sitesArray);
        }
    }
    
    function renderByCategory(sitesArray) {
        const sitesByCategory = sitesArray.reduce((acc, site) => {
            const category = site.category || "Sem Categoria";
            if (!acc[category]) acc[category] = [];
            acc[category].push(site);
            return acc;
        }, {});

        Object.keys(sitesByCategory).sort().forEach(category => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'category-group';
            categoryDiv.innerHTML = `<h3>${category}</h3>`;
            sitesByCategory[category].forEach(site => {
                categoryDiv.appendChild(createSiteEntryElement(site));
            });
            siteListContainer.appendChild(categoryDiv);
        });
    }
    
    function renderByDate(sitesArray) {
        sitesArray.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)); // Newest first
        sitesArray.forEach(site => {
            siteListContainer.appendChild(createSiteEntryElement(site));
        });
    }

    function createSiteEntryElement(site) {
        const div = document.createElement("div");
        div.className = "site-entry";
        const addedDate = new Date(site.addedAt).toLocaleString('pt-BR');
        div.innerHTML = `
            <strong>${site.url}</strong>
            <div class="details">
                Categoria: ${site.category} | Adicionado em: ${addedDate}
            </div>
            <p style="margin:5px 0;">Motivo: ${site.reason || "Não especificado"}</p>
            <button data-url="${site.url}" class="edit-btn">Editar</button>
            <button data-url="${site.url}" class="delete-btn delete">Excluir</button>
        `;
        return div;
    }

    async function removeSite(url) {
        if (!confirm(`Tem certeza que deseja excluir o bloqueio para "${url}"?`)) return;
        
        const { blockedSites } = await chrome.storage.sync.get(["blockedSites"]);
        delete blockedSites[url];
        await chrome.storage.sync.set({ blockedSites });
        
        alert(`"${url}" foi removido da lista de bloqueio.`);
        renderBlockedSites();
        populateAllCategorySelects();
    }

    function setViewMode(mode) {
        currentViewMode = mode;
        viewByCategoryBtn.classList.toggle('active', mode === 'category');
        viewByDateBtn.classList.toggle('active', mode === 'date');
        renderBlockedSites();
    }

    // --- MODAL LOGIC ---
    function openModalForAdding() {
        modal.dataset.editingUrl = '';
        modalTitle.textContent = "Adicionar Novo(s) Site(s)";
        modalUrlInput.value = '';
        modalUrlInput.disabled = false;
        modalReasonInput.value = '';
        modalCategorySelect.value = 'Redes Sociais';
        modalCustomCategory.value = '';
        modalCustomCategory.style.display = 'none';
        modal.style.display = 'flex';
    }

    async function openModalForEditing(url) {
        const { blockedSites } = await chrome.storage.sync.get(["blockedSites"]);
        const siteData = blockedSites[url];
        if (!siteData) return;

        modal.dataset.editingUrl = url;
        modalTitle.textContent = "Editar Site Bloqueado";
        modalUrlInput.value = url;
        modalUrlInput.disabled = false; // Allow URL editing
        modalReasonInput.value = siteData.reason || '';
        
        // Ensure the category exists in the dropdown
        let categoryExists = false;
        for(let i=0; i < modalCategorySelect.options.length; i++) {
            if (modalCategorySelect.options[i].value === siteData.category) {
                categoryExists = true;
                break;
            }
        }
        
        if (categoryExists) {
            modalCategorySelect.value = siteData.category;
            modalCustomCategory.style.display = 'none';
            modalCustomCategory.value = '';
        } else {
            modalCategorySelect.value = '___new___';
            modalCustomCategory.value = siteData.category;
            modalCustomCategory.style.display = 'block';
        }
        
        modal.style.display = 'flex';
    }
    
    function closeModal() {
        modal.style.display = 'none';
    }

    function handleModalSave() {
        const oldUrl = modal.dataset.editingUrl;
        const newUrls = modalUrlInput.value;
        let category = modalCategorySelect.value;
        if (category === '___new___') {
            category = modalCustomCategory.value.trim();
        }
        const reason = modalReasonInput.value.trim();

        addOrUpdateSites(newUrls, category, reason, oldUrl);
    }
});