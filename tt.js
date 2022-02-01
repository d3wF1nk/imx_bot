import axios from "axios";
import {getTokenProto} from "./utils.js";

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
    //call tokentrove API
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
    let lastOrder = avg?.reduce((last, val) => {
        if (val.filledTimeSeconds > last.filledTimeSeconds)
            return val
        else
            return last;
    })
    //filter results
    let today_avg = avg?.filter(a => (a.filledTimeSeconds * 1000) > start)
    if (today_avg === undefined || today_avg.length <= 10) return 0
    let sum_price = Math.abs(today_avg.reduce((a, b) => ({takerAssetFilledAmount: a.takerAssetFilledAmount + b.takerAssetFilledAmount})).takerAssetFilledAmount) / 1000000000000000000;
    let avg_price = (sum_price / today_avg.length || 0);
    return {
        last_price: parseFloat((lastOrder.takerAssetFilledAmount / 1000000000000000000).toString()).toFixed(6),
        avg_price: parseFloat(avg_price.toFixed(6)),
        last_date: parseInt(((new Date().getTime() - new Date(lastOrder?.filledTimeSeconds * 1000)) / 60000).toString())
    }
}

export function composeUrl(item) {
    return `[immutable]  https://market.x.immutable.com/assets/${item.sell.data.token_address}/${item.sell.data.token_id}\n[tokentrove] https://tokentrove.com/collection/GodsUnchainedCards/${getTokenProto(item)}`;
}
