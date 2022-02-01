import {doConnect, doTrade, formatEther, getAssets, getBalances, getOrders, getTokenProto, isTrap} from "./utils.js";
import {composeUrl, getAvg} from "./tt.js";
import {vars} from "./config.js";

const client = await doConnect();
let balance = await getBalances(client);
const order = await getOrders(client);

//Potential buy
let potBuy = [];
order.forEach(o => {
    if (o?.buy?.data?.quantity?.lt(balance?.imx)) {
        potBuy.push(o);
    }
})
console.log(potBuy.length)

//Frequently buy
let topBuy = []
for (const p of potBuy) {
    const tp = getTokenProto(p)
    if (tp !== 0) {
        const avg = await getAvg(tp)
        if (avg !== 0)
            if (avg.last_date < vars.MAX_TIME)
                if (avg.avg_price > formatEther(p.sell.data.quantity))
                    if (avg.last_price > formatEther(p.sell.data.quantity))
                        topBuy.push(p)

    }
}
console.log(topBuy.length)

//Filter for bot-trap
let target = []
for (const t of topBuy) {
    console.log(composeUrl(t))
    await isTrap(client, t)
}

//const trade = await doTrade(client,toBuy[0]);
