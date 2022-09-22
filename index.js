const binance = require('./src/Binance');

const cron = require('node-cron');

const dados = require('./dados')


binance.start();

cron.schedule('* * * * *', () => {
    binance.start();
});