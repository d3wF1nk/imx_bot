import {ethers, providers} from "ethers";
import {ERC721TokenType, ETHTokenType, ImmutableXClient} from "@imtbl/imx-sdk";
import wallet from "@ethersproject/wallet";
import {env as conf, vars} from "./config.js";
import { Webhook } from 'discord-webhook-node';

export const getProvider = (provider_name) => {
    let provider;
    switch (provider_name) {
        case 'INFURA':
            provider = new providers.InfuraProvider(
                conf.NETWORK,
                conf.API_KEY_INFURA
            );
            break;
        case 'ETHERSCAN':
            provider = new providers.EtherscanProvider(
                conf.NETWORK,
                conf.API_KEY_ETHERSCAN
            );
            break;
        case 'ALCHEMY':
            provider = new providers.AlchemyProvider(
                conf.NETWORK,
                conf.API_KEY_ALCHEMY
            );
            break;
        default:
            provider = ethers.getDefaultProvider(conf.NETWORK)
    }
    return provider;
}

export const doConnect = async () => {
    const signer = new wallet.Wallet(conf.PRIVATE_WALLET_KEY).connect(getProvider());
    return await ImmutableXClient.build({
        publicApiUrl: conf.IMXURL.toLowerCase(),
        signer: signer,
        starkContractAddress: conf.STARK.toLowerCase(),
        registrationContractAddress: conf.REGISTRATION.toLowerCase(),
    });
}

export const doTrade = async (client, order,hook) => {
    let trade;
    try {
        trade = await client.createTrade({
            user: client.address,
            orderId: order.order_id,
            amountBuy: order.sell.data.quantity,
            amountSell: order.buy.data.quantity,
            tokenBuy: {
                type: ERC721TokenType.ERC721,
                data: {
                    tokenId: order.sell.data.token_id,
                    tokenAddress: order.sell.data.token_address,
                },
            },
            tokenSell: {
                type: ETHTokenType.ETH,
                data: {
                    decimals: 18
                }
            }
        })
        const msg = `${order.sell.data.properties.name}, has been bought at ${formatEther(order.buy.data.quantity)}`;
        console.log(msg)
        hook.send(msg)

    } catch (err) {
        console.error(err);
        const msg = `There was an issue creating trade for NFT TOKEN_ID:[${order.sell.data.token_id} https://immutascan.io/tx/${order.sell.data.token_id}]`
        console.log(msg)
        if (vars.DEBUG) hook.send(msg)
        return 0;
    }
    return order;
}

export const doSell = async (client, asset, price) => {
    if (asset === 0 || asset === undefined || asset === null)
        return 0;
    try {
        await client.createOrder({
            amountSell: 1,
            amountBuy: price,
            user: client.address,
            include_fees: true,
            tokenSell: {
                type: ERC721TokenType.ERC721,
                data: {
                    tokenAddress: asset.sell.data.token_address,
                    tokenId: asset.sell.data.token_id.toLowerCase(),
                },
            },
            tokenBuy: {
                type: ETHTokenType.ETH,
                data: {
                    decimals: 18,
                },
            },
        });
        console.log(`${asset.sell.data.properties.name}, has been listed for sale at ${formatEther(price)}`);
        return 'done';
    } catch (err) {
        console.log(err)
        console.error("There was an issue creating sale for NFT ", asset.sell.data.properties.name);
        return 'fail';
    }
}

export function cleanString(str) {
    return str.replace(/[^a-zA-Z ]/g, "")
}

export const getAssets = async (client, params) => {
    let assetCursor;
    params.cursor = assetCursor;
    let assets = [];
    do {
        let result_set = await client.getAssets({user: params.user, name: cleanString(params.name), cursor: assetCursor});
        assets = assets.concat(result_set.result);
        assetCursor = result_set.cursor;
    } while (assetCursor);
    return assets;
}

export const isAlreadyBought = async (client, item) => {
    const copies = await getAssets(client, {
        user: client.address,
        name: item.sell.data.properties.name
    });
    return copies.length >= 1
}

export const getOrders = async (client) => {
    let orders = [];
    let result_set = await client.getOrders({
        order_by: 'timestamp',
        page_size: vars.LIST_SIZE,
        status: 'active',
        collection: {name: 'Gods Unchained'},
        sell_token_type: ERC721TokenType.ERC721,
        buy_token_type: ETHTokenType.ETH
    });
    orders = orders.concat(result_set.result);
    return orders;
}

export function comparePrice(price, avg) {

    let diff = ((price / avg) * 100).toFixed(1);

    let rs = {};
    if (price < avg && diff !== '100') {
        rs.value = 100 - diff;
        rs.sign = '-'
        if (rs.value >= 25) {
            rs.alert = true
        }
    } else {
        rs.value = diff - 100;
        rs.sign = '+'
    }
    return rs;
}

export const getDiff = async (client, item) => {
    let orders = [];
    let result_set = await client.getOrders({
        order_by: 'buy_quantity',
        direction: 'asc',
        page_size: 5,
        status: 'active',
        sell_token_address: item.sell.data.token_address,
        sell_token_name: cleanString(item.sell.data.properties.name),
        sell_token_type: ERC721TokenType.ERC721,
        buy_token_type: ETHTokenType.ETH,
        include_fees: true
    });
    orders = orders.concat(result_set.result)
    if (orders.length <= 0) return 0;
    orders = orders.filter(i => i.order_id !== item.order_id);
    let cheap = orders.reduce(function (prev, curr) {
        return prev.buy.data.quantity.lt(curr.buy.data.quantity) ? prev : curr;
    });
    if (item.buy.data.quantity.lt(cheap.buy.data.quantity)) {
        const diff = formatEther(cheap.buy.data.quantity.sub(item.buy.data.quantity));
        if (diff > 0.000005)
            return diff;
    }
    return 0;
}

export function getId(item){
    return new URLSearchParams(item.sell.data.properties.image_url).get('https://card.godsunchained.com/?id');
}

export function getTokenProto(item) {
    const params = new URLSearchParams(item.sell.data.properties.image_url)
    let id = params.get('https://card.godsunchained.com/?id');
    let q = params.get('q')
    /*
    * q = quality ::
    * 1 - platinum
    * 2 - gold
    * 3 - shadow
    * 4 - meteor
    */
    if (q !== '4') return 0
    return `${id}-${q}`;
}

export function formatEther(imx) {
    return ethers.utils.formatEther(imx);
}

export function parseEther(num) {
    return ethers.utils.parseEther(num)
}

export const getBalances = async (client) => {
    return await client.getBalances({user: client.address});
}

//todo:
const getTrades = async (client) => {
    let tradeCursor;
    let trades = [];
    do {
        let result_set = await client.getTrades({
            user: '',
            cursor: tradeCursor,
            token_address: ''
        });
        trades = trades.concat(result_set.result);
        tradeCursor = result_set.cursor;
    } while (tradeCursor);
    return trades;
}

export const getDiscord = async () => {
    return conf.DISCORD_WEBHOOK ? new Webhook(conf.DISCORD_WEBHOOK) : undefined
}

export const calcPercentageOf = (percentage,base) =>{
    return ((base / 100) * percentage);
}
