require('dotenv/config');
const fs = require('fs');


const dados = require('../dados.json')
const trades = require('../trade.json')
const logserro = require('../error.json')

const Binance = require('node-binance-api');

const binance = new Binance().options({
	APIKEY: process.env.BINANCE_APIKEY,
	APISECRET: process.env.BINANCE_APISECRET
});


class Bot211Binance {

	static async start() {

		if (dados.saldo_cripto.length > 0) {
			
		
			dados.saldo_cripto.forEach(async e => {

				if (e.qtd > 0) { 	// moedas que tenho saldo 

					var porcenategem_venda = e.margem;

					var book = await binance.bookTickers(e.cripto); // consultar o preço atual 

					var valor_atual = parseFloat(book.askPrice); // valor de venda
					let valor_prev_venda = ((porcenategem_venda * e.valor_compra) / 100);
					valor_prev_venda = (valor_prev_venda + e.valor_compra);
					var valor_diff = (valor_atual - valor_prev_venda);

					console.log('------------\n');
					console.log(`valor desejado ${e.cripto}:`, valor_prev_venda)
					console.log(`valor atual ${e.cripto}:`, valor_atual)
					console.log(`valor diff ${e.cripto}:`, valor_diff)
					console.log('\n------------\n');

					if (valor_diff > 0) { // iniciar a venda 
						Bot211Binance.vender(e.cripto, e.qtd, valor_atual);
					}
				}
			});
		}


		await Bot211Binance.verredura();


	}

	static async vender(cripto, quantity, valor) {

		// realizando a venda pelo valor de mercado 
		binance.marketSell(cripto, quantity, (error, response) => { 
			if (error) {
				logserro.push(JSON.parse(error.body));
				fs.writeFile('error.json', JSON.stringify(logserro, null, 2), err => {
					if (err) throw err;
				});
			} else {
				trades.push(response);
				fs.writeFile('trade.json', JSON.stringify(trades, null, 2), err => {
					if (err) throw err;
				});

				dados.saldo_BRL = parseFloat(parseFloat(dados.saldo_BRL) + parseFloat(response.cummulativeQuoteQty));

				for (const e of dados.saldo_cripto) {
					if (e.cripto == cripto) {
						e.qtd = parseFloat((e.qtd - quantity));
						e.valor_venda = parseFloat(valor);
					}
				}

				fs.writeFile('dados.json', JSON.stringify(dados, null, 2), err => {
					if (err) throw err;
				});
			}
		});

	}

	static async verredura() {

	
		if (dados.saldo_BRL > process.env.SALDO_MINIMO) {

			// buscando todas as moedas e variação de preço em 24 horas
			binance.prevDay(false, async (error, prevDay) => {

				let array = [];
				for (let obj of prevDay) {
					if (obj.symbol.indexOf(process.env.MOEDA) != -1) {  
						if (0 > parseFloat(obj.priceChangePercent)) { // pegando apenas as variação negativa 
							array.push([parseFloat(obj.priceChangePercent), obj.symbol]);
						}
					}
				}
				array.sort();
				let stop = 0;
				let x = 1;
			
				while (stop == 0) {
					var variacao = array[array.length - x][0];
					var cripto = array[array.length - x][1];

					console.log(cripto, variacao);

					var confere = dados.saldo_cripto.find(c => c.cripto == cripto);

					if (confere == undefined) {

						var book = await binance.bookTickers(cripto); // buscando o valor de mercado 
						var valor_atual = book.bidPrice;
						var quantity = (parseFloat(dados.saldo_BRL) / parseFloat(valor_atual));

						Bot211Binance.comprar(cripto, dados.saldo_BRL, quantity, valor_atual);
						stop = 1;
					} else {
						if (confere.qtd == 0) {
							var book = await binance.bookTickers(cripto);
							var valor_atual = book.bidPrice;
							var quantity = (parseFloat(dados.saldo_BRL) / parseFloat(valor_atual));
							Bot211Binance.comprar(cripto, dados.saldo_BRL, quantity, valor_atual);
							stop = 1;
						}
					}

					x++;

				}
			});

		}

	}

	static async comprar(cripto, valor, quantity, valor_atual) {


		console.log(cripto, `valor total: ${valor} quantity: ${Number((quantity).toFixed(2))} valor autal: ${valor_atual}`)

		binance.marketBuy(cripto, Number((quantity).toFixed(2)), (error, response) => {
			if (error) {
				logserro.push(JSON.parse(error.body));
				fs.writeFile('error.json', JSON.stringify(logserro, null, 2), err => {
					if (err) throw err;
				});

				console.log(error.body);

			} else {
				trades.push(response);
				fs.writeFile('trade.json', JSON.stringify(trades, null, 2), err => {
					if (err) throw err;
				});
				console.log(response);

				dados.saldo_BRL = parseFloat(parseFloat(dados.saldo_BRL) - parseFloat(response.cummulativeQuoteQty));

				dados.saldo_cripto.push({
					"margem": 5,
					"cripto": cripto,
					"qtd": quantity,
					"valor_compra": parseFloat(valor_atual),
					"valor_venda": 0
				});

				fs.writeFile('dados.json', JSON.stringify(dados, null, 2), err => {
					if (err) throw err;
				});
			}

		})

	}



}

module.exports = Bot211Binance;