import {ethers, providers} from "ethers";
import {ERC721TokenType, ETHTokenType, ImmutableXClient} from "@imtbl/imx-sdk";
import wallet from "@ethersproject/wallet";
import {dev_env as conf} from "./prod_config.js";

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

export const doTrade = async (client, order) => {
    console.log(order)

    return await client.createTrade({
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
}

//todo:
export const doSell = async (client, asset, price) => {
    try {
        await client.createOrder({
            amountSell: "1",
            amountBuy: price,
            user: '',
            include_fees: true,
            tokenSell: {
                type: ERC721TokenType.ERC721,
                data: {
                    tokenAddress: '',
                    tokenId: asset.token_id.toLowerCase(),
                },
            },
            tokenBuy: {
                type: ETHTokenType.ETH,
                data: {
                    decimals: 18,
                },
            },
        });
        console.log("Token", asset.token_id.toLowerCase(), "has been listed for sale!");
    } catch (err) {
        console.log(err)
        console.error("There was an issue creating sale for NFT token ID", asset.token_id.toLowerCase());
    }
}

export const getAssets = async (client) => {
    let assetCursor;
    let assets = [];
    do {
        let result_set = await client.getAssets({user: client.address, cursor: assetCursor});
        assets = assets.concat(result_set.result);
        assetCursor = result_set.cursor;
    } while (assetCursor);
    return assets;
}

export const getOrders = async (client) => {
    let orders = [];
    let result_set = await client.getOrders({
        order_by: 'timestamp',
        page_size: 100,
        status:'active'
    });
    orders = orders.concat(result_set.result);
    return orders;
}

export function formatEther(imx) {
    return ethers.utils.formatEther(imx);
}

export const getBalances = async (client) => {
    const balances = await client.getBalances({
        user: client.address
    });
    let eth = formatEther(balances.imx);
    console.log(`ETH:${eth}`)
    return balances;
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
