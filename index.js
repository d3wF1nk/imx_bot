import * as Utils from "./utils.js";
import {composeUrl, getAvg} from "./tt.js";
import {env, vars} from "./config.js";
import {BigNumber} from "ethers";
import {readFile} from 'fs/promises';

const hook = await Utils.getDiscord()
const client = await Utils.doConnect();
let prev_balance = BigNumber.from(0);

//loopin'
let i = 1;
loop(client)
function loop(client) {
    try {
        setTimeout(async () => {
            console.log(`\nstart-loop(${i}/${vars.HB_RATE})`)

            //Balance
            let balance = await Utils.getBalances(client);
            const bal_diff = Utils.comparePrice(Utils.formatEther(balance.imx), Utils.formatEther(prev_balance))
            prev_balance = balance.imx
            const banner = `ETH:${parseFloat(Utils.formatEther(balance.imx) || 0).toFixed(6)}`
            console.log(banner)

            //Sending discord notification
            if (i === vars.HB_RATE)
                hook?.send(banner).then(() => console.log('msg_sent'))
            if (bal_diff.value !== 0)
                hook?.send(`${bal_diff.sign}${bal_diff?.value?.toFixed(1)}%`).then(() => console.log('msg_sent'))

            //Getting the latest items
            let order = await Utils.getOrders(client);
            console.log(`\ntot_order: ${order.length}`)

            //Get cards lists
            /**
             * @type {Object} card
             * @property {Object} card.black
             * @property {string} black.name
             * @property {string} black.id
             *
             * @property {Object} card.instant
             * @property {string} instant.name
             * @property {string} instant.id
             * @property {number} instant.eth
             */
                //let cards_url = new URL('', import.meta.url)
            let json_file = await readFile(env.JSON_CARDS_PATH)
            const cards = JSON.parse(json_file.toString());

            //Check for instant buy:
            if (cards?.instant?.length > 0)
                cards?.instant?.forEach(i => {
                    order.forEach(o => {
                        if (i.id === Utils.getId(o) && Utils.formatEther(o.buy.data.quantity) <= i.eth) {
                            const msg = `try to snipe ${i.name} at ${Utils.formatEther(o.buy.data.quantity)} ..`
                            console.log(msg)
                            hook.send(msg)
                            Utils.doTrade(client, o, hook)
                        }
                    })
                })

            //Remove black_listed cards:
            if (cards?.black?.length > 0)
                order = order.filter(o => cards?.black?.filter(b => b.id === Utils.getId(o)).length === 0)
            console.log(`no_b_card: ${order.length}`)

            //Potential buy
            let potBuy = [];
            order.forEach(o => {
                if (o?.buy?.data?.quantity?.lt(balance?.imx?.div(vars.N_DIV))) {
                    potBuy.push(o);
                }
            })
            console.log(`pot_buy: ${potBuy.length}`)

            //Frequently buy
            let topBuy = []
            for (const p of potBuy) {
                const tp = Utils.getTokenProto(p)
                if (tp !== 0) {
                    const avg = await getAvg(tp)
                    if (avg !== 0)
                        if (!(vars.MAX_TIME) || avg.last_date < vars.MAX_TIME)
                            if (!(vars.MIN_AMOUNT_TRADE) || avg.daily_amount > vars.MIN_AMOUNT_TRADE)
                                if (avg.avg_price > Utils.formatEther(p.sell.data.quantity))
                                    if (avg.last_price > Utils.formatEther(p.buy.data.quantity)) {
                                        const diff = Utils.comparePrice(Utils.formatEther(p.buy.data.quantity), avg.avg_price)
                                        console.log(`[id:${p.order_id}] [avg:${avg.avg_price}] [${avg.last_date}m => last_price:${avg.last_price}] [actual_price:${Utils.formatEther(p.buy.data.quantity)}] ${p.sell.data.properties.name} (${diff?.sign}${diff?.value?.toFixed(1)}%)${diff.alert ? '⚠ ⚠ ⚠' : ''}`)
                                        console.log(`${composeUrl(p)}\n`)
                                        topBuy.push(p)
                                    }
                }
            }
            console.log(`top_buy: ${topBuy.length}`)

            //Filter && buy
            let toSell = []
            for (const t of topBuy) {
                if (await Utils.isAlreadyBought(client, t))
                    continue;
                const diff = await Utils.getDiff(client, t)
                if (diff > Utils.calcPercentageOf(vars.CRESTA, Utils.formatEther(t.buy.data.quantity))) {
                    console.log(`MIN_CRESTA is :${Utils.calcPercentageOf(vars.CRESTA, Utils.formatEther(t.buy.data.quantity)).toFixed(6)}`);
                    console.log(`DIFF is :${(parseFloat(diff) || 0).toFixed(6)}`);
                    //hook.send(`log_some_sheets_about_trade_to_debug_overpriced_buy`)
                    toSell.push({
                        item: await Utils.doTrade(client, t, hook),
                        price: (t.buy.data.quantity.add(Utils.parseEther(diff.toString())).sub(Utils.parseEther(vars.X_VAL.toString())))
                    })
                }
            }
            console.log(`to_sell: ${toSell.length}`)

            //Sell && log
            toSell.forEach(el => {
                Utils.doSell(client, el.item, el.price).then(x => console.log(x))
            })
            i >= vars.HB_RATE ? i = 1 : i++;
            loop(client)
        }, vars.SET_TIMEOUT)
    } catch (e) {
        hook.send(e).then(() => console.log(e))
    }
}
