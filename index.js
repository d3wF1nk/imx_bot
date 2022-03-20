import * as Utils from "./utils.js";
import * as Imx from "./imx.js";
import {env, vars} from "./config.js";
import {BigNumber} from "ethers";
import {readFile} from 'fs/promises';

const hook = await Utils.getDiscord()
const client = await Imx.doConnect();
let prev_balance = BigNumber.from(0);

let i = 1;
loop(client)

function loop(client) {
    try {
        setTimeout(async () => {
            console.log('\n\n\n')
            console.log(`start-loop(${i}/${vars.HB_RATE})`)

            //Balance
            let balance = await Imx.getBalances(client);
            const bal_diff = Utils.comparePrice(Utils.formatEther(balance), Utils.formatEther(prev_balance))
            prev_balance = balance
            const banner = `[${vars.BOT_NAME}] ${parseFloat(Utils.formatEther(balance) || 0).toFixed(6)}`
            console.log(banner)

            //Sending discord notification
            if (i === vars.HB_RATE)
                hook?.send(banner).then(() => console.log('msg_sent'))
            if (bal_diff.value !== 0 && bal_diff.sign)
                if (vars.CHECK_BAL) hook?.send(`[${vars.BOT_NAME}] ${bal_diff.sign}${bal_diff?.value?.toFixed(1)}%`).then(() => console.log('msg_sent'))

            //Getting the latest items
            let orders = await Imx.getOrders(client);
            console.log(`tot_order: ${orders.length}`)

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
            let toSell = []
            if (cards?.instant?.length > 0)
                for (const card of cards.instant) {
                    for (const order of orders) {
                        if (card.id === Utils.getTPId(order.sell.data.properties.image_url) && Utils.formatEther(order.buy.data.quantity) <= card.eth) {
                            const msg = `[${vars.BOT_NAME}] try to snipe ${card.name} at ${Utils.formatEther(order.buy.data.quantity)} ..`
                            console.log(msg)
                            if (vars.DEBUG) hook.send(msg).then()
                            toSell.push({
                                item: await Imx.doTrade(client, order, hook),
                                price: await Imx.getFixedPrice(client, order, card.eth)
                            })
                        }
                    }
                }

            //Black || White
            if (cards?.white?.length > 0)
                orders = orders.filter(o => cards?.white?.filter(b => b.id === Utils.getTPId(o.sell.data.properties.image_url)).length > 0)
            else if (cards?.black?.length > 0)
                orders = orders.filter(o => cards?.black?.filter(b => b.id === Utils.getTPId(o.sell.data.properties.image_url)).length === 0)
            console.log(`filtered_card: ${orders.length}`)

            //Potential buy
            let potBuy = [];
            orders.forEach(o => {
                if (o?.buy?.data?.quantity?.lt(balance?.div(vars.N_DIV))) {
                    if (o?.buy?.data?.quantity?.gte(Utils.parseEther(vars.MIN_PRICE?.toString())))
                        potBuy.push(o);
                }
            })
            console.log(`pot_buy: ${potBuy.length}`)

            //Filter && buy
            for (const t of potBuy) {
                if (await Imx.isAlreadyBought(client, t))
                    continue;
                if (vars.DEBUG_TIME) console.time(`get_diff`)
                const diff = await Imx.getDiff(client, t)
                if (vars.DEBUG_TIME) console.timeEnd(`get_diff`)
                //if (vars.DEBUG) console.log(`MIN_CRESTA is :${Utils.calcPercentageOf(vars.CRESTA, Utils.formatEther(t.buy.data.quantity)).toFixed(7)}`);
                if (diff > Utils.calcPercentageOf(vars.CRESTA, Utils.formatEther(t.buy.data.quantity))) {
                    if (vars.DEBUG) console.log(`[OK_*]`)
                    toSell.push({
                        item: await Imx.doTrade(client, t, hook),
                        price: (t.buy.data.quantity.add(Utils.parseEther(diff.toString())).sub(Utils.parseEther(vars.X_VAL.toString())))
                    })
                } else {
                    if (vars.DEBUG) console.log(`[__]`)
                }
            }
            console.log(`to_sell: ${toSell.length}`)

            //Sell && log
            toSell.forEach(el => {
                Imx.doSell(client, el.item, el.price).then(x => console.log(x))
            })
            i >= vars.HB_RATE ? i = 1 : i++;
            loop(client)
        }, vars.SET_TIMEOUT)
    } catch (e) {
        hook.send(e).then(() => console.log(e))
    }
}
