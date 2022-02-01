import {comparePrice, doConnect, doSell, doTrade, formatEther, getBalances, getDiff, getOrders, getTokenProto, isAlreadyBought, parseEther} from "./utils.js";
import {composeUrl, getAvg} from "./tt.js";
import {vars} from "./config.js";

const client = await doConnect();
loop(client)

//loopin'
function loop(client) {
    setTimeout(async () => {
        console.log('\nstart-loop()')
        let balance = await getBalances(client);
        const order = await getOrders(client);

        //Potential buy
        let potBuy = [];
        order.forEach(o => {
            if (o?.buy?.data?.quantity?.lt(balance?.imx?.div(3))) {
                potBuy.push(o);
            }
        })
        console.log(`\npot_buy: ${potBuy.length}`)

        //Frequently buy
        let topBuy = []
        for (const p of potBuy) {
            const tp = getTokenProto(p)
            if (tp !== 0) {
                const avg = await getAvg(tp)
                if (avg !== 0)
                    if (avg.last_date < vars.MAX_TIME)
                        if (avg.avg_price > formatEther(p.sell.data.quantity))
                            if (avg.last_price > formatEther(p.buy.data.quantity)){
                                const diff = comparePrice(formatEther(p.buy.data.quantity),avg.avg_price)
                                console.log(`[id:${p.order_id}] [avg:${avg.avg_price}] [${avg.last_date}m => last_price:${avg.last_price}] [actual_price:${formatEther(p.buy.data.quantity)}] ${p.sell.data.properties.name} (${diff.sign}${diff.value}%)${diff.alert ? '⚠ ⚠ ⚠' : ''}`)
                                console.log(`${composeUrl(p)}\n`)
                                topBuy.push(p)
                            }

            }
        }
        console.log(`top_buy: ${topBuy.length}`)

        //Filter && buy
        let toSell = []
        for (const t of topBuy) {
            if (await isAlreadyBought(client, t))
                continue;
            const diff = await getDiff(client, t)
            if (diff > 0.000005) {
                toSell.push({
                    item : await doTrade(client, t),
                    price: (t.buy.data.quantity.add(parseEther(diff.toString())).sub(parseEther(vars.X_VAL.toString())))
                })
            }
        }
        console.log(`to_sell: ${toSell.length}`)


        //Sell && log
        toSell.forEach(el => {
            doSell(client, el.item, el.price).then(x => console.log(x))
        })

        loop(client)
    }, 5000)
}
