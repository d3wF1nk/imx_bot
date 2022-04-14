import {ethers, providers} from "ethers";
import {currency, env, env as conf, vars} from "./config.js";
import wallet from "@ethersproject/wallet";
import {ERC20TokenType, ERC721TokenType, ETHTokenType, ImmutableXClient} from "@imtbl/imx-sdk";
import * as Utils from "./utils.js";
import {cleanAssetName, formatEther} from "./utils.js";
import mongo from "mongodb";
import * as mongos from "./mongos.js";

/**
 * @type {Object} order
 *
 * @property {number} order_id
 * @property {string} status
 * @property {string} user
 *
 * @property {Object} sell
 * @property {Object} buy
 * @property {Object} amount_sold
 *
 * @property {Date} expiration_timestamp
 * @property {Date} timestamp
 * @property {Date} updated_timestamp
 *
 * @property {string} sell.type
 * @property {Object} sell.data
 * @property {string} sell.data.token_id
 * @property {string} sell.data.id
 * @property {string} sell.data.token_address
 *
 * @property {Object} sell.data.properties
 * @property {string} sell.data.properties.name
 * @property {string} sell.data.properties.image_url
 * @property {Object} sell.data.properties.collection
 * @property {string} sell.data.properties.collection.name
 * @property {string} sell.data.properties.collection.icon_url
 *
 * @property {Object} sell.data.quantity
 * @property {string} sell.data.quantity.type
 * @property {string} sell.data.quantity.hex
 *
 * @property {string} buy.type
 * @property {Object} buy.data
 * @property {string} buy.data.token_address
 * @property {number} buy.data.decimals
 * @property {Object} buy.data.quantity
 * @property {string} buy.data.quantity.type
 * @property {string} buy.data.quantity.hex
 */

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

export const isAlreadyBought = async (client, item) => {
    let params = {
        user: client.address,
        name: item.sell.data.properties.name
    }
    let copies = await getAssets(client, params)
    if (copies.length <= 0) return false
    const msg = `(${item.sell.data.properties.name}) ALREADY PRESENT IN COLLECTION`
    if (vars.DEBUG) console.log(msg)
    return true;
}

export const doTrade = async (client, order, hook) => {
    if (vars.DEBUG_TIME) console.time(`trade_${order.order_id}`)
    let params = {
        user: client.address,
        orderId: order.order_id,
        amountBuy: order.sell.data.quantity,
        amountSell: order.buy.data.quantity,
        tokenBuy: {
            type: ERC721TokenType.ERC721,
            data: {
                tokenId: order.sell.data.token_id,
                tokenAddress: env.GODS_TOKEN_ADDRESS,
            },
        }
    }
    switch (vars.CURRENCY_BUY) {
        case currency.GODS:
            params.tokenSell = {
                type: ERC20TokenType.ERC20,
                data: {
                    symbol: currency.GODS,
                    decimals: 18,
                    tokenAddress: env.GODS_CURRENCY_TOKEN_ADDRESS
                }
            }
            break;
        case currency.ETH:
            params.tokenSell = {
                type: ETHTokenType.ETH,
                data: {
                    decimals: 18
                }
            }
            break;
    }
    try {
        await client.createTrade(params)
        const msg = `[${vars.BOT_NAME}] ${order.sell.data.properties.name}, has been bought at ${formatEther(order.buy.data.quantity)} ${vars.CURRENCY_BUY}`;
        console.log(msg)
        if (vars.DEBUG_TIME) console.timeEnd(`trade_${order.order_id}`)
        hook.send(msg)
    } catch (err) {
        console.error(err);
        const msg = `There was an issue creating trade for ${order.sell.data.properties.name} at ${formatEther(order.buy.data.quantity)} ${vars.CURRENCY_BUY} \n[https://immutascan.io/address/0xacb3c6a43d15b907e8433077b6d38ae40936fe2c/${order.sell.data.token_id}]`
        console.log(msg)
        if (vars.DEBUG) hook.send(`[${vars.BOT_NAME}] ${msg}`)
        return 0;
    }
    return order;
}

export const doSell = async (client, asset, price) => {
    if (asset === 0 || asset === undefined || asset === null)
        return 0;
    let params = {
        amountSell: 1,
        amountBuy: price,
        user: client.address,
        include_fees: true,
        tokenSell: {
            type: ERC721TokenType.ERC721,
            data: {
                tokenAddress: env.GODS_TOKEN_ADDRESS,
                tokenId: asset.sell.data.token_id.toLowerCase(),
            },
        }
    }
    switch (vars.CURRENCY_BUY) {
        case currency.GODS:
            params.tokenBuy = {
                type: ERC20TokenType.ERC20,
                data: {
                    symbol: currency.GODS,
                    decimals: 18,
                    tokenAddress: env.GODS_CURRENCY_TOKEN_ADDRESS
                }
            };
            break;
        case currency.ETH:
            params.tokenBuy = {
                type: ETHTokenType.ETH,
                data: {
                    decimals: 18,
                },
            };
            break;
    }
    try {
        await client.createOrder(params);
        console.log(`${asset.sell.data.properties.name}, has been listed for sale at ${formatEther(price)}`);
        mongos.insert(asset.sell.data.token_id,asset.sell.data.properties.name,formatEther(price), client.address).then(console.log)
        return 'done';
    } catch (err) {
        console.log(err)
        console.error("There was an issue creating sale for NFT ", asset.sell.data.properties.name);
        return 'fail';
    }
}

export const getAssets = async (client, params) => {
    if (vars.DEBUG_TIME) console.time(`get_asset_${cleanAssetName(params.name)}`)
    let assetCursor;
    params.cursor = assetCursor;
    let assets = [];
    do {
        let result_set = await client.getAssets({user: params.user, name: cleanAssetName(params.name), cursor: assetCursor});
        assets = assets.concat(result_set.result);
        assetCursor = result_set.cursor;
    } while (assetCursor);
    if (vars.DEBUG_TIME) console.timeEnd(`get_asset_${cleanAssetName(params.name)}`)
    return assets;
}

export const getOrders = async (client, filters) => {
    if (vars.DEBUG_TIME) console.time(`get_orders`)
    let params = {
        order_by: 'timestamp',
        page_size: vars.LIST_SIZE,
        status: filters?.status ? filters.status : 'active',
        sell_token_address: env.GODS_TOKEN_ADDRESS,
        sell_token_type: ERC721TokenType.ERC721
    }
    if (filters?.user) params.user = filters.user;
    if (filters?.sell_token_name) params.sell_token_name = filters.sell_token_name;
    switch (vars.CURRENCY_BUY) {
        case
        currency.GODS:
            params.buy_token_address = env.GODS_CURRENCY_TOKEN_ADDRESS;
            break;
        case
        currency.ETH:
            params.buy_token_type = ETHTokenType.ETH
            break;
        case
        currency.ALL:
            break;
    }
    let orders = [];
    let result_set = await client.getOrders(params);
    if (vars.DEBUG_TIME) console.timeEnd(`get_orders`)
    orders = orders.concat(result_set.result);
    return orders;
}

export const getFixedPrice = async (client, item, min_price) => {
    let params = {
        order_by: 'buy_quantity',
        direction: 'asc',
        status: 'active',
        sell_token_address: item.sell.data.token_address,
        sell_token_name: Utils.cleanOrderName(item.sell.data.properties.name),
        sell_token_type: ERC721TokenType.ERC721,
        include_fees: true
    }
    switch (vars.CURRENCY_BUY) {
        case currency.GODS:
            params.buy_token_address = env.GODS_CURRENCY_TOKEN_ADDRESS;
            break;
        case currency.ETH:
            params.buy_token_type = ETHTokenType.ETH
            break;
    }
    let orders = [];
    let result_set = await client.getOrders(params);
    orders = orders.concat(result_set.result)
    orders = orders.filter(i => formatEther(i.buy.data.quantity) > (min_price + Utils.calcPercentageOf(vars.CRESTA, min_price)))
    let cheap = orders.reduce(function (prev, curr) {
        return prev.buy.data.quantity.lt(curr.buy.data.quantity) ? prev : curr;
    });
    return cheap.buy.data.quantity.sub(Utils.parseEther(vars.X_VAL.toString()));
}

export const getDiff = async (client, item) => {
    let params = {
        order_by: 'buy_quantity',
        direction: 'asc',
        page_size: 5,
        status: 'active',
        sell_token_address: item.sell.data.token_address,
        sell_token_name: Utils.cleanOrderName(item.sell.data.properties.name),
        sell_token_type: ERC721TokenType.ERC721,
        include_fees: true
    }
    switch (vars.CURRENCY_BUY) {
        case currency.GODS:
            params.buy_token_address = env.GODS_CURRENCY_TOKEN_ADDRESS;
            break;
        case currency.ETH:
            params.buy_token_type = ETHTokenType.ETH
            break;
    }
    let orders = [];
    let result_set = await client.getOrders(params);
    orders = orders.concat(result_set.result)
    if (orders.length <= 0) {
        if (vars.DEBUG) console.log(`${item.sell.data.properties.name} [ALREADY_SOLD]`);
        return 0;
    }
    orders = orders.filter(i => i.order_id !== item.order_id);
    let cheap = orders.reduce(function (prev, curr) {
        return prev.buy.data.quantity.lt(curr.buy.data.quantity) ? prev : curr;
    });
    if (vars.DEBUG) console.log(`(${Utils.cleanOrderName(item.sell.data.properties.name)}) CHEAP: ${formatEther(cheap.buy.data.quantity)} ACT: ${formatEther(item.buy.data.quantity)}`)
    if (item.buy.data.quantity.lt(cheap.buy.data.quantity)) {
        const diff = formatEther(cheap.buy.data.quantity.sub(item.buy.data.quantity));
        if (vars.DEBUG) console.log(`(${item.sell.data.properties.name}) DIFF is: ${formatEther(cheap.buy.data.quantity.sub(item.buy.data.quantity))} [OK]`)
        if (diff > vars.MIN_DIFF) {
            return diff;
        } else {
            if (vars.DEBUG) console.log(`(${item.sell.data.properties.name}) DIFF (${diff}) is less than MIN_DIFF: ${vars.MIN_DIFF} [KO]`)
            return 0;
        }
    }
    if (vars.DEBUG) console.log(`[LOW DIFF] : ${formatEther(cheap.buy.data.quantity.sub(item.buy.data.quantity))}`)
    return 0;
}

export const getBalances = async (client) => {
    let rs;
    switch (vars.CURRENCY_BUY) {
        case currency.ETH:
            rs = await client.getBalances({user: client.address});
            return rs.imx;
        case currency.GODS:
            rs = await client.getBalance({
                user: client.address,
                tokenAddress: env.GODS_CURRENCY_TOKEN_ADDRESS
            });
            return rs.balance
    }
}
