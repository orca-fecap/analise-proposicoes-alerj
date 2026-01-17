// ==UserScript==
// @name         ALERJ — abrir links ?OpenDocument sequencialmente com download
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  [v3.1 Robusto] Abre cada link ?OpenDocument, baixa TXT, espera, e vai para a próxima página automaticamente.
// @author       Você (refinado por IA)
// @match        http://alerjln1.alerj.rj.gov.br/*
// @match        https://alerjln1.alerj.rj.gov.br/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const WAIT_MS = 1000; // tempo na página de detalhe (ms)
    const KEY_IDX = 'tm_alerj_open_idx';
    const KEY_LINKS = 'tm_alerj_links';
    const KEY_LIST_URL = 'tm_alerj_list_url';

    /**
     * Limpa o texto, removendo espaços múltiplos e linhas em branco.
     */
    function cleanText(text) {
        if (!text) return '';
        return text.trim().replace(/\s+/g, ' ');
    }

    /**
     * Raspa os dados da página de detalhe e inicia o download.
     * Esta função foi significativamente melhorada para coletar mais dados
     * e ser à prova de falhas com seletores opcionais (?.
     */
    function scrapeAndDownload() {
        try {
            let output = '';
            let codigoProjeto = 'desconhecido';

            // --- 1. Título e Número ---
            const divTitulo = document.querySelectorAll('body > div[align="center"]')[1];
            if (divTitulo) {
                const bolds = divTitulo.querySelectorAll('b > font');
                // Usa ?. (optional chaining) para evitar erros se bolds[0] ou [2] não existirem
                const titulo = cleanText(bolds[0]?.innerText) || 'PROJETO';
                const numero = cleanText(bolds[2]?.innerText) || 'N/A';
                output += `${titulo} Nº ${numero}\n`;
                codigoProjeto = numero.replace(/[^0-9a-z]/gi, '') || 'desconhecido'; // Limpa o número para usar no nome do arquivo
            }

            // --- 2. Ementa ---
            output += "==================================================\n";
            output += "EMENTA\n";
            output += "==================================================\n";
            const ementa = document.querySelector('body > ul > ul > ul > ul > ul > table > tbody > tr > td > b > font');
            output += (cleanText(ementa?.innerText) || 'N/A') + '\n\n'; // Usa ?.

            // --- 3. Autor(es) ---
            output += "==================================================\n";
            output += "AUTOR(ES)\n";
            output += "==================================================\n";
            const autorLabel = Array.from(document.querySelectorAll('body > b')).find(b => b.innerText.includes('Autor(es)'));
            let autores = [];
            if (autorLabel) {
                let next = autorLabel.nextSibling;
                while (next && next.nodeName !== 'BR') {
                    if (next.nodeName === 'B' && next.innerText.trim()) {
                        autores.push(cleanText(next.innerText));
                    }
                    next = next.nextSibling;
                }
            }
            output += (autores.length ? autores.join(' ') : 'N/A') + '\n\n';

            // --- 4. Texto do Projeto (Artigos) ---
            output += "==================================================\n";
            output += "TEXTO DO PROJETO\n";
            output += "==================================================\n";
            const resolveDiv = Array.from(document.querySelectorAll('div[align="right"] b font')).find(el => el.innerText.includes('RESOLVE:'));
            if (resolveDiv) {
                // Usa ?. no closest para segurança
                let currentNode = resolveDiv.closest('div')?.nextSibling;
                while (currentNode) {
                    if (currentNode.nodeType === 1 && currentNode.innerText.includes('Plenário ALERJ')) {
                        break;
                    }
                    let text = (currentNode.nodeType === 1) ? currentNode.innerText : currentNode.textContent;
                    if (text && text.trim()) {
                         output += text.trim() + '\n';
                    }
                    currentNode = currentNode.nextSibling;
                }
            }
            output += "\n";

            // --- 5. Justificativa ---
            output += "==================================================\n";
            output += "JUSTIFICATIVA\n";
            output += "==================================================\n";
            const justifHeading = Array.from(document.querySelectorAll('div[align="center"] b u font')).find(el => el.innerText.trim() === 'JUSTIFICATIVA');
            if (justifHeading) {
                let currentNode = justifHeading.closest('div')?.nextSibling; // Usa ?.
                while (currentNode) {
                    if (currentNode.nodeType === 1 && currentNode.innerText.includes('Legislação Citada')) {
                        break;
                    }
                    let text = (currentNode.nodeType === 1) ? currentNode.innerText : currentNode.textContent;
                    if (text && text.trim()) {
                        output += text.trim() + '\n\n';
                    }
                    currentNode = currentNode.nextSibling;
                }
            }

            // --- 6. Informações Básicas (Tabela 1) ---
            output += "==================================================\n";
            output += "INFORMAÇÕES BÁSICAS\n";
            output += "==================================================\n";
            // Usa querySelector para pegar o primeiro, é mais seguro que [0]
            const infoTable = document.querySelector('table[width="100%"][border="1"]');
            if (infoTable) {
                const rows = infoTable.querySelectorAll('tr');
                // Usa ?. em todas as buscas para evitar erros
                let codigoTabela = cleanText(rows[0]?.querySelectorAll('td')[1]?.innerText);
                if(codigoTabela) {
                    codigoProjeto = codigoTabela; // Prefere o código da tabela se existir
                }
                output += `Código: ${codigoProjeto || 'N/A'}\n`;
                output += `Autor na Tabela: ${cleanText(rows[0]?.querySelectorAll('td')[3]?.innerText) || 'N/A'}\n`;
                output += `Protocolo: ${cleanText(rows[1]?.querySelectorAll('td')[1]?.innerText) || 'N/A'}\n`;
                output += `Regime de Tramitação: ${cleanText(rows[2]?.querySelectorAll('td')[1]?.innerText) || 'N/A'}\n\n`;
            }

            // --- 7. Datas (Tabela 2) ---
            output += "==================================================\n";
            output += "DATAS\n";
            output += "==================================================\n";
            // Seleção de tabela mais segura. Pega a segunda se ela existir.
            const allTables = document.querySelectorAll('table[width="100%"][border="1"]');
            const datesTable = allTables.length > 1 ? allTables[1] : null;
            if (datesTable) {
                const rows = datesTable.querySelectorAll('tr');
                output += `Entrada: ${cleanText(rows[0]?.querySelectorAll('td')[1]?.innerText) || 'N/A'}\n`;
                output += `Despacho: ${cleanText(rows[0]?.querySelectorAll('td')[3]?.innerText) || 'N/A'}\n`;
                output += `Publicação: ${cleanText(rows[1]?.querySelectorAll('td')[1]?.innerText) || 'N/A'}\n\n`;
            }

            // --- 8. Comissões ---
            output += "==================================================\n";
            output += "COMISSÕES\n";
            output += "==================================================\n";
            const comissaoHeading = Array.from(document.querySelectorAll('b u font')).find(el => el.innerText.includes('Comissões a serem distribuidas'));
            if (comissaoHeading) {
                 let currentNode = comissaoHeading.nextSibling;
                 while (currentNode) {
                       if (currentNode.nodeType === 1 && currentNode.innerText.includes('TRAMITAÇÃO DO PROJETO')) {
                           break;
                       }
                       if (currentNode.nodeName === 'FONT' && currentNode.innerText.trim()) {
                           output += cleanText(currentNode.innerText) + '\n';
                       }
                       currentNode = currentNode.nextSibling;
                 }
            }
             output += "\n";

            // --- 9. Tramitação ---
            output += "==================================================\n";
            output += "TRAMITAÇÃO\n";
            output += "==================================================\n";
            const tramitacaoTable = document.querySelector('table[cellpadding="2"]');
            if (tramitacaoTable) {
                const rows = tramitacaoTable.querySelectorAll('tbody > tr');
                for (let i = 1; i < rows.length; i++) {
                    const cells = rows[i].querySelectorAll('td');
                    // Garante que as células existem antes de acessá-las
                    if (cells.length > 6) {
                        const descriptionCell = cells[5];
                        const dateCell = cells[6];

                        let description = cleanText(descriptionCell?.innerText);
                        let date = cleanText(dateCell?.innerText);

                        if (description && !description.includes('Cadastro de Proposições')) {
                            output += `Data: ${date || 'N/A'}\n`;
                            output += `Evento: ${description}\n\n`;
                        }
                    }
                }
            }

            // --- Download ---
            const filename = `raspagem_alerj_${codigoProjeto.replace(/[^0-9a-z-]/gi, '_')}.txt`;
            const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);

            console.log(`Arquivo baixado: ${filename}`);
            return true; // Retorna sucesso
        } catch (e) {
            console.error('Erro GR AVE ao raspar a página:', e, window.location.href);
            return false; // Retorna falha
        }
    }

    /**
     * Executa na página de listagem de resultados.
     */
    function onListPage() {
        // Filtro de links mais robusto usando a API URL
        const links = Array.from(document.querySelectorAll('a[href*="?OpenDocument"]'))
            .filter(a => {
                try {
                    const url = new URL(a.href);
                    // Exclui links de navegação (que contêm Start=, Count=, etc.)
                    if (url.searchParams.has('Start') || url.searchParams.has('Count') || url.searchParams.has('ExpandSection')) {
                        return false;
                    }
                    // Exclui âncoras
                    if (url.hash) {
                        return false;
                    }
                    // Exclui links internos da tramitação (lógica original)
                    const isInTramitacao = document.querySelector(`table[cellpadding="2"] a[href="${a.href}"]`);
                    return !isInTramitacao;
                } catch (e) {
                    return false; // URL inválida
                }
            })
            .map(a => a.href);

        // Remove duplicados
        const uniqueLinks = [...new Set(links)];

        if (!uniqueLinks.length) {
            console.log('Nenhum link ?OpenDocument válido encontrado nesta página. Processo concluído ou página final atingida.');
            // Limpa a sessão para não ficar em loop
            sessionStorage.removeItem(KEY_IDX);
            sessionStorage.removeItem(KEY_LINKS);
            sessionStorage.removeItem(KEY_LIST_URL);
            return;
        }

        console.log(`Encontrados ${uniqueLinks.length} links para processar.`);
        sessionStorage.setItem(KEY_LINKS, JSON.stringify(uniqueLinks));
        sessionStorage.setItem(KEY_IDX, '0');
        sessionStorage.setItem(KEY_LIST_URL, window.location.href);

        window.location.href = uniqueLinks[0];
    }

    /**
     * Executa na página de detalhe (?OpenDocument).
     */
    function onDetailPage() {
        const links = JSON.parse(sessionStorage.getItem(KEY_LINKS) || '[]');
        let idx = parseInt(sessionStorage.getItem(KEY_IDX) || '0', 10);

        if (!links.length || isNaN(idx)) {
            console.log('Nenhuma sessão de raspagem ativa.');
            return;
        }

        // 1. Raspa e baixa
        // Agora verificamos se o scraping foi bem-sucedido
        const success = scrapeAndDownload();

        if (!success) {
            // Se falhou, registra e tenta novamente a MESMA página.
            // Isso evita pular um arquivo se houver um erro de carregamento.
            // Se a página estiver permanentemente "quebrada", isso pode gerar um loop.
            // Mas é melhor que perder o dado silenciosamente.
            console.error(`Falha ao raspar ${links[idx]}. Tentando novamente em 3 segundos...`);
            setTimeout(() => { window.location.reload(); }, 3000); // Tenta recarregar
            return; // Não continua para o próximo
        }

        // 2. Incrementa o índice (APENAS se teve sucesso)
        idx++;

        if (idx < links.length) {
            // Vai para o próximo link
            console.log(`Processando item ${idx + 1} de ${links.length}...`);
            sessionStorage.setItem(KEY_IDX, String(idx));
            setTimeout(() => { window.location.href = links[idx]; }, WAIT_MS);
        } else {
            // Vai para a próxima página de resultados
            console.log('Itens da página concluídos. Navegando para a próxima página de resultados...');
            const listUrl = sessionStorage.getItem(KEY_LIST_URL);

            sessionStorage.removeItem(KEY_IDX);
            sessionStorage.removeItem(KEY_LINKS);
            sessionStorage.removeItem(KEY_LIST_URL);

            if (!listUrl) {
                console.error('URL da página de lista não encontrada. Retornando ao histórico.');
                setTimeout(() => { window.history.back(); }, WAIT_MS);
                return;
            }

            try {
                const url = new URL(listUrl);
                const count = parseInt(url.searchParams.get('Count') || '15', 10);
                const start = parseInt(url.searchParams.get('Start') || '1', 10);
                url.searchParams.set('Start', String(start + count));

                setTimeout(() => { window.location.href = url.toString(); }, WAIT_MS);
            } catch (e) {
                 console.error('Erro ao construir URL da próxima página:', e);
                 setTimeout(() => { window.history.back(); }, WAIT_MS);
            }
        }
    }

    // --- Roteador Principal (Robusto) ---
    // Espera a página carregar COMPLETAMENTE antes de executar
    function run() {
        if (location.href.includes('?OpenDocument')) {
            onDetailPage();
        } else {
            // Só executa na página de lista se não houver uma sessão ativa (para evitar re-iniciar no meio)
            const activeIdx = sessionStorage.getItem(KEY_IDX);
            if (!activeIdx) {
                 onListPage();
            } else {
                console.log('Sessão de detalhes detectada, mas URL não é ?OpenDocument. Aguardando...');
            }
        }
    }

    // Espera a página estar 100% carregada (incluindo tabelas)
    if (document.readyState === 'complete') {
        run();
    } else {
        window.addEventListener('load', run);
    }

})();
