document.addEventListener("DOMContentLoaded", async function () {
    try {
        const config = { locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}` };
        const SQL = await initSqlJs(config);

        const response = await fetch('../database/database.sqlite');
        const buffer = await response.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(buffer));

        const result = db.exec("SELECT * FROM studi_com");
        if (result.length > 0) {
            const rows = result[0].values;
            const data = rows.map(row => ({
                id: row[0],
                category: row[1],
                name: row[2],
                address: row[3],
                description: row[4],
                phone: row[5],
                image: row[6],
                link: row[7]
            }));

            // Cache delle traduzioni
            const translationCache = {};

            // Funzione per tradurre il testo
            async function translateText(text, targetLanguage) {
                const cacheKey = `${text}-${targetLanguage}`;
                if (translationCache[cacheKey]) {
                    return translationCache[cacheKey];
                }

                try {
                    const apiUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
                    const response = await fetch(apiUrl);
                    const data = await response.json();
                    const translatedText = data[0][0][0];
                    translationCache[cacheKey] = translatedText;
                    return translatedText;
                } catch (error) {
                    console.error('Error translating text');
                    return text; // Ritorna il testo originale in caso di errore
                }
            }

            var table = new Tabulator("#commercialisti-table", {
                layout: "fitColumns",
                pagination: "local",
                paginationSize: 10,
                paginationSizeSelector: false,
                selectable: false,
                columns: [
                    {
                        title: `Trovati ${rows.length} Studi Commercialisti`,
                        field: "name",
                        headerSort: false, // Disabilita l'ordinamento per il campo "name"
                        formatter: function (cell) {
                            var data = cell.getData();
                            var category = data.category;
                            var description = data.description;

                            const container = document.createElement('div');
                            container.className = 'contenitore-generale';
                            container.innerHTML = `<a href="${data.link}" target="_blank" class="commercialista-link">
                                       <div class="commercialista-container">
                                           <div class="image">
                                               <img src="${data.image}" alt="Immagine dello studio">
                                           </div>
                                           <div class="details">
                                               <div class="category highlightable">${category}</div>
                                               <div class="name highlightable">${data.name}</div>
                                               <div class="address highlightable">${data.address}</div>
                                               <div class="description highlightable">${description}</div>
                                               <div class="phone highlightable">${data.phone}</div>
                                           </div>
                                       </div>
                                   </a>`;

                            // Aggiorna il contenuto della cella se l'opzione inglese è selezionata
                            if (document.getElementById('englishLanguage').classList.contains('selected')) {
                                const overlay = document.createElement('div');
                                overlay.className = 'loading-overlay';
                                overlay.textContent = 'Traduzione in corso...';
                                container.appendChild(overlay);

                                const categoryPromise = translateText(category, 'en').then(translatedCategory => {
                                    container.querySelector('.category').textContent = translatedCategory;
                                });

                                const descriptionPromise = translateText(description, 'en').then(translatedDescription => {
                                    container.querySelector('.description').textContent = translatedDescription;
                                });

                                Promise.all([categoryPromise, descriptionPromise]).then(() => {
                                    container.removeChild(overlay);
                                });
                            }


                            return container;
                        }
                    }
                ],
                data: data,
                paginationElement: document.getElementById("commercialisti-paging"),
                footerElement: document.getElementById("commercialisti-info"),
            });

            //funzione aggiorna titolo 
            function updateColumnTitle(totaleRisultati) {
                function getTitolo(count) {
                    const currentLanguage = localStorage.getItem('language');
                    if (currentLanguage == "it") {
                        return `Trovati ${count} Studi Commercialisti`;
                    }
                    else if (currentLanguage == "en") {
                        return `Found ${count} Accounting Firms`;
                    }
                    return `Trovati ${count} Studi Commercialisti`; // Default to Italian
                }

                const totaleRisultatiString = getTitolo(totaleRisultati);
                const col = table.getColumn('name'); // Ottieni la colonna per il titolo
                col.updateDefinition({ title: totaleRisultatiString }); // Imposta il nuovo titolo
            }

            //evidenziazione testo ricerca
            function highlightText(container, searchText) {
                const regex = new RegExp(`(${searchText})`, 'gi');
                const elements = container.querySelectorAll('.highlightable');

                elements.forEach(element => {
                    element.innerHTML = element.textContent.replace(regex, '<span class="highlight">$1</span>');
                });
            }


            //filtri ricerca, ordinamento e selezione città
            function filterAndSortTable(selectedCity, sortOrder, searchValue) {
                searchValue = searchValue.trim().toLowerCase();

                var filteredData = data.filter(function (row) {
                    var matchesCity = selectedCity === "" || row.address.toLowerCase().includes(selectedCity.toLowerCase());
                    var matchesSearch = searchValue === "" ||
                        row.name.toLowerCase().includes(searchValue) ||
                        row.category.toLowerCase().includes(searchValue) ||
                        row.address.toLowerCase().includes(searchValue) ||
                        row.phone.toLowerCase().includes(searchValue) ||
                        row.description.toLowerCase().includes(searchValue);
                    return matchesCity && matchesSearch;
                });

                if (sortOrder === 'az') {
                    filteredData.sort((a, b) => a.name.localeCompare(b.name));
                } else if (sortOrder === 'za') {
                    filteredData.sort((a, b) => b.name.localeCompare(a.name));
                }

                table.setData(filteredData);
                updateColumnTitle(filteredData.length);

                const tableContainer = document.querySelector('#commercialisti-table');
                highlightText(tableContainer, searchValue);
            }

            // Imposta i valori di default per selectedCity, sortOrder e searchValue
            var selectedCity = ""; // Default: tutte le città
            var sortOrder = "az";  // Default: a-z
            var searchValue = "";  // Default: barra di ricerca vuota

            // Gestione del dropdown per le righe per pagina
            $('#dropdown-page .dropdown-item').click(function () {
                var selectedValue = $(this).attr('data-value');
                $('#rowsPerPageDropdown').text(selectedValue);
                $('.rowsPerPage .dropdown-item').removeClass('selected');
                $(this).addClass('selected');
                table.setPageSize(parseInt(selectedValue));
            });

            // Ascolta il click sugli elementi della dropdown e imposta il valore di sortOrder
            $('#dropdown-sort .dropdown-item').on('click', function () {
                sortOrder = $(this).attr('data-value');
                var selectedsortOrder = $(this).text();
                $('.sort .dropdown-item').removeClass('selected');
                $(this).addClass('selected');
                $('#sortDropdown').text(selectedsortOrder);

                // Dopo aver impostato sortOrder, filtra e ordina la tabella
                filterAndSortTable(selectedCity, sortOrder, searchValue);
            });

            // Ascolta l'input della barra di ricerca
            document.getElementById("dt-search-0").addEventListener("input", function () {
                searchValue = this.value;
                filterAndSortTable(selectedCity, sortOrder, searchValue);
            });

            // Ascolta il click sugli elementi della dropdown e imposta il valore di selectedCity
            $('#dropdown-cities .dropdown-item').on('click', function () {
                selectedCity = $(this).attr('data-value');
                var selectedNameCity = $(this).text();
                $('.cities .dropdown-item').removeClass('selected');
                $(this).addClass('selected');
                $('#citiesDropdown').text(selectedNameCity);

                // Dopo aver impostato selectedCity, filtra e ordina la tabella
                filterAndSortTable(selectedCity, sortOrder, searchValue);
            });

            // Applica immediatamente l'ordinamento predefinito al caricamento della pagina
            table.on("tableBuilt", function () {
                filterAndSortTable(selectedCity, sortOrder, searchValue);
            });

            document.getElementById("dropdown-page").addEventListener("change", function () {
                table.setPageSize(parseInt(this.value));
            });

            // Funzione per memorizzare la posizione di scorrimento nella memoria locale
            // function saveScrollPosition() {
            //     localStorage.setItem('scrollPosition', window.scrollY);
            //     // console.log(window.scrollY);
            // }

            // Funzione per ripristinare la posizione di scorrimento dalla memoria locale
            function restoreScrollPosition() {
                // const scrollPosition = localStorage.getItem('scrollPosition');
                // if (scrollPosition) {
                window.scrollTo(0, 500);
                console.log("scroll click: " + window.scrollY);
                // }
            }
            function restoreScrollPosition2() {
                window.scrollTo(0, 0);
            }
            // Memorizza la posizione di scorrimento prima del cambio di lingua
            // saveScrollPosition();
            // Gestione della lingua
            $('.dropdown-menu.lingua .dropdown-item').click(function () {

                // Mantieni la città selezionata
                filterAndSortTable(selectedCity, sortOrder, searchValue);

                // Mantieni il testo della città selezionata nel dropdown
                $('#citiesDropdown').text($('.cities .dropdown-item.selected').text());

                // Al cambio di lingua, mantieni la posizione di scorrimento
                restoreScrollPosition();
            });

            // Al click la visualizzazione va sempre giù
            table.on("pageLoaded", function () {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                const tableContainer = document.querySelector('#commercialisti-table');
                highlightText(tableContainer, searchValue);
            });

            //al caricamento pagina la visualizzazione va al top della pagina
            window.scrollTo(0, 0);
        }
        else {
            console.log('Nessun dato trovato nella tabella studi_com');
        }
    } catch (error) {
        console.error('Errore durante il caricamento di SQL.js o del database:', error);
    }
});

