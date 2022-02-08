import axios from "axios";
import * as Utils from "./utils.js";

export const getAvg = async (tokenProto) => {

    // 24 h = 86400000 mills
    const start = new Date().getTime() - (86400000);
    const URL = `https://api.tokentrove.com/cached/historical-prices?tokenAddress=0xacb3c6a43d15b907e8433077b6d38ae40936fe2c&=&tokenProto=${tokenProto}`
    let avg;
    let config = {
        headers: {
            'x-api-key': 'Np8BV2d5QR9TSFEr9EvF66FWcJf0wIxy2qBpOH6s',
            'Referer': 'https://tokentrove.com/'
        }
    }
    await axios.get(URL, config)
        .then(a => {
            avg = a.data;
        }).catch(e => {
            console.log(e);
        })
    /**
     * @type {Object} avg
     * @property {number} a.makerAssetFilledAmount
     * @property {number} a.takerAssetFilledAmount
     * @property {number} a.usd_price
     * @property {number} a.filledTimeSeconds
     * @property {number} a.isBuy
     */

        //filter results
    let today_avg = avg?.filter(a => (a.filledTimeSeconds * 1000) > start)
    if (today_avg === undefined || today_avg.length <= 0) return 0

    //get last trade
    avg = avg.slice().sort((a, b) => b.filledTimeSeconds - a.filledTimeSeconds)
    let lastOrder = avg[0];

    //reduce object to primitive
    today_avg = today_avg.map(x => x.takerAssetFilledAmount)

    //remove outliers
    today_avg = Utils.filterOutliers(today_avg);
    if (today_avg[0] * 10 < today_avg[today_avg.length - 1])
        today_avg = today_avg.filter(x => x < today_avg[today_avg.length - 1] * 0.05)

    //get avg
    let sum_price = Math.abs(today_avg.reduce((a, b) => (a + b)) / 1000000000000000000);
    let avg_price = (sum_price / today_avg.length || 0);
    let last_price = (lastOrder.takerAssetFilledAmount / 1000000000000000000);

    let i = 0;
    while (last_price > (avg_price * 10) && i <= avg.length) {
        console.error(`BOT_TRAP_DETECTED: outlier_last_sell ${last_price} > ${avg_price * 10}`);
        last_price = avg[++i]
    }

    return {
        last_price: parseFloat(last_price.toString()).toFixed(6),
        avg_price: parseFloat(avg_price.toString()).toFixed(6),
        last_date: parseInt(((new Date().getTime() - new Date(lastOrder?.filledTimeSeconds * 1000)) / 60000).toString()),
        daily_amount: today_avg.length
    }
}

export function composeUrl(item) {
    return `[immutable]  https://market.x.immutable.com/assets/${item.sell.data.token_address}/${item.sell.data.token_id}  [tokentrove]  https://tokentrove.com/collection/GodsUnchainedCards/${Utils.getTokenProto(item)}`;
}
