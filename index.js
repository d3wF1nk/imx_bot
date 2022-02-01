import {doConnect, doTrade, getAssets, getBalances, getOrders} from "./utils.js";

const client = await doConnect('ALCHEMY');
let balance = await getBalances(client);
console.log(await getAssets(client));
const order = await getOrders(client);
let toBuy = [];
order.forEach(o => {
    if (o?.buy?.data?.quantity?.lt(balance?.imx)){
        toBuy.push(o);
    }
})
console.log(toBuy.length)

console.log(toBuy[0].buy?.data?.quantity.toString());
console.log(balance.imx.toString());

const trade = await doTrade(client,toBuy[1]);
