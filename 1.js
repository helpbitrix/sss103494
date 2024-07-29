// ==UserScript==
// @name Тинькофф тестирование стратегии
// @namespace http://tampermonkey.net/
// @version 1.4
// @description Отслеживает горизонтальные линии на TradingView и сохраняет уникальные данные в localStorage с историей111
// @match https://ru.tradingview.com/*
// @grant none
// ==/UserScript==
(function() {
    'use strict';
    const storage = {
        get: () => JSON.parse(localStorage.getItem('tradingViewDataTinkoff') || '{}'),
        set: (data) => localStorage.setItem('tradingViewDataTinkoff', JSON.stringify(data)),
        update: (symbol, lines) => {
            const data = storage.get();
            const roundedLines = lines.map(line => ({
                ...line,
                price: Math.round(line.price * 100) / 100 // Округляем до 2 знаков после запятой
            }));

            // Проверяем, изменились ли цены линий
            const hasPriceChanged = !data[symbol] ||
                data[symbol].length !== roundedLines.length ||
                roundedLines.some((line, index) =>
                    !data[symbol][index] ||
                    line.price !== data[symbol][index].price
                );

            // Всегда обновляем данные в localStorage
            data[symbol] = roundedLines;
            storage.set(data);

            return hasPriceChanged;
        }
    };

    function displayLines(symbol, lines) {
        const output = `${symbol}\n\nОбнаружено ${lines.length} горизонтальных линий:\n${
            lines.map((line, i) => `${i + 1}. Линия с ценой ${line.price.toFixed(2)}`).join('\n')
        }`;
        let outputDiv = document.getElementById('horizontal-lines-output');
        if (!outputDiv) {
            outputDiv = document.createElement('div');
            outputDiv.id = 'horizontal-lines-output';
            outputDiv.style = 'position: fixed; top: 150px; left: 10px; background-color: rgba(0,0,0,0.7); color: white; padding: 10px; z-index: 9999;';
            document.body.appendChild(outputDiv);
        }
        outputDiv.innerText = output;
    }

    function processResponse(response) {
        if (response?.success && response?.payload?.sources) {
            const symbol = Object.values(response.payload.sources)[0]?.symbol.split(':')[1];
            const lines = Object.entries(response.payload.sources)
                .filter(([, source]) => source.state?.type === 'LineToolHorzLine')
                .map(([id, source]) => ({
                    id,
                    price: source.state.points[0].price
                }));
            if (symbol && lines.length === 2) {
                // Всегда отображаем линии
                displayLines(symbol, lines);

                // Проверяем, изменились ли цены
                if (storage.update(symbol, lines)) {
                    window.postMessage({type: 'TRADING_VIEW_DATA_UPDATED', symbol}, '*');
                }
            }
        }
    }

    const originalFetch = window.fetch;
    window.fetch = function() {
        return originalFetch.apply(this, arguments).then(async (response) => {
            if (response.url.includes('charts-storage.tradingview.com/charts-storage/get/layout')) {
                const clone = response.clone();
                const json = await clone.json();
                processResponse(json);
            }
            return response;
        });
    };
})();