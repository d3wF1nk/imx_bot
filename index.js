import {calcPercentageOf, comparePrice, doConnect, doSell, doTrade, formatEther, getBalances, getDiff, getDiscord, getOrders, getTokenProto, isAlreadyBought, parseEther} from "./utils.js";
import {composeUrl, getAvg} from "./tt.js";
import {vars} from "./config.js";
import {BigNumber} from "ethers";

//comment this if u don have WebHook
const hook = await getDiscord()

const client = await doConnect();
let prev_balance = BigNumber.from(0);

loop(client)

//looping
function loop(client) {
    setTimeout(async () => {
        console.log('\nstart-loop(*)')

        //Balance
        let balance = await getBalances(client);
        const bal_diff = comparePrice(formatEther(balance.imx), formatEther(prev_balance))
        prev_balance = balance.imx
        console.log(`ETH:${parseFloat(formatEther(balance.imx) || 0).toFixed(6)}(${bal_diff.sign}${bal_diff.value}%)`)

        //Sending discord notification comment these line if you don't need
        if (bal_diff.value !== 0)
            await hook.send((`${bal_diff.sign}${bal_diff.value}%`))

        //Getting the latest items
        const order = await getOrders(client);

        //Potential buy
        let potBuy = [];
        order.forEach(o => {
            if (o?.buy?.data?.quantity?.lt(balance?.imx?.div(vars.N_DIV))) {
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
                            if (avg.last_price > formatEther(p.buy.data.quantity)) {
                                const diff = comparePrice(formatEther(p.buy.data.quantity), avg.avg_price)
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
            if (diff > calcPercentageOf(vars.CRESTA,formatEther(t.buy.data.quantity))) {
                console.log(`MIN_CRESTA is :${calcPercentageOf(vars.CRESTA,formatEther(t.buy.data.quantity)).toFixed(6)}`);
                console.log(`DIFF is :${(parseFloat(diff) || 0).toFixed(6)}`);
                toSell.push({
                    item: await doTrade(client, t),
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
