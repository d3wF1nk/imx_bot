import * as Utils from "./utils.js";
import {composeUrl, getAvg} from "./tt.js";
import {env, vars} from "./config.js";
import {BigNumber} from "ethers";
import {readFile} from 'fs/promises';
import {parseEther} from "./utils.js";

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
            const banner = `[${vars.BOT_NAME}] ${parseFloat(Utils.formatEther(balance.imx) || 0).toFixed(6)}`
            console.log(banner)

            //Sending discord notification
            if (i === vars.HB_RATE)
                hook?.send(banner).then(() => console.log('msg_sent'))
            if (bal_diff.value !== 0 && bal_diff.sign)
                if (vars.CHECK_BAL) hook?.send(`[${vars.BOT_NAME}] ${bal_diff.sign}${bal_diff?.value?.toFixed(1)}%`).then(() => console.log('msg_sent'))

            //Getting the latest items
            let orders = await Utils.getOrders(client);
            console.log(`\ntot_order: ${orders.length}`)

            //Get cards lists
            /**
             * @type {Object} card
             * @property {Object} card.black
             * @property {string} black.name
             * @property {string} black.id
             *
             * @property {Object} card.white
             * @property {string} white.name
             * @property {string} white.id
             *
             * @property {Object} card.instant
             * @property {string} instant.name
             * @property {string} instant.id
             * @property {number} instant.eth
             */
            let json_file = await readFile(env.JSON_CARDS_PATH)
            const cards = JSON.parse(json_file.toString());

            //Check for instant buy:
            if (cards?.instant?.length > 0)
                for (const card of cards.instant) {
                    for (const order of orders) {
                        if (card.id === Utils.getId(order) && Utils.formatEther(order.buy.data.quantity) <= card.eth) {
                            const msg = `[${vars.BOT_NAME}] try to snipe ${card.name} at ${Utils.formatEther(order.buy.data.quantity)} ..`
                            console.log(msg)
                            hook.send(msg).then()
                            await Utils.doTrade(client, order, hook)
                        }
                    }
                }

            //Black || White
            if (cards?.white?.length > 0)
                orders = orders.filter(o => cards?.white?.filter(b => b.id === Utils.getId(o)).length > 0)
            else if (cards?.black?.length > 0)
                orders = orders.filter(o => cards?.black?.filter(b => b.id === Utils.getId(o)).length === 0)
            console.log(`filtered_card: ${orders.length}`)

            //Potential buy
            let potBuy = [];
            orders.forEach(o => {
                if (o?.buy?.data?.quantity?.lt(balance?.imx?.div(vars.N_DIV))) {
                    if (o?.buy?.data?.quantity?.gte(parseEther(vars.MIN_PRICE?.toString())))
                        potBuy.push(o);
                }
            })
            console.log(`pot_buy: ${potBuy.length}`)

            //Frequently buy
            let topBuy = []
            if (vars.DISABLE_TT)
                topBuy = potBuy;
            else
                for (const p of potBuy) {
                    const tp = Utils.getTokenProto(p)
                    if (tp !== 0) {
                        const avg = await getAvg(tp)
                        if (avg !== 0)
                            if (!(vars.MAX_TIME) || avg.last_date < vars.MAX_TIME)
                                if (!(vars.MIN_AMOUNT_TRADE) || avg.daily_amount > vars.MIN_AMOUNT_TRADE)
                                    if (avg.avg_price > Utils.formatEther(p.buy.data.quantity))
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
                if (vars.DEBUG) console.log(`MIN_CRESTA is :${Utils.calcPercentageOf(vars.CRESTA, Utils.formatEther(t.buy.data.quantity)).toFixed(7)}`);
                if (diff > Utils.calcPercentageOf(vars.CRESTA, Utils.formatEther(t.buy.data.quantity))) {
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
