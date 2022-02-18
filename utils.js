import {ethers} from "ethers";
import {env as conf} from "./config.js";
import {Webhook} from 'discord-webhook-node';

export function cleanString(str) {
    return str?.replace(/[^a-zA-Z ]/g, "")
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

export function getTPId(url) {
    return new URLSearchParams(url).get('https://card.godsunchained.com/?id');
}

export function getTPQuality(url) {
    return new URLSearchParams(url).get('q');
}

export function getTokenProto(item) {
    let id = getTPId(item.sell.data.properties.image_url)
    let q = getTPQuality(item.sell.data.properties.image_url)
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

export const getDiscord = async () => {
    return conf.DISCORD_WEBHOOK ? new Webhook(conf.DISCORD_WEBHOOK) : undefined
}

export const calcPercentageOf = (percentage, base) => {
    return ((base / 100) * percentage);
}

export function filterOutliers(someArray) {
    if (someArray.length < 4) {
        return someArray;
    }

    let values = someArray.slice().sort((a, b) => a - b); // copy array fast and sort

    let q1 = getQuantile(values, 25);
    let q3 = getQuantile(values, 75);

    let iqr, maxValue, minValue;
    iqr = q3 - q1;
    maxValue = q3 + iqr * 1.5;
    minValue = q1 - iqr * 1.5;

    return values.filter((x) => (x >= minValue) && (x <= maxValue));
}

function getQuantile(array, quantile) {
    // Get the index the quantile is at.
    let index = quantile / 100.0 * (array.length - 1);

    // Check if it has decimal places.
    if (index % 1 === 0) {
        return array[index];
    } else {
        // Get the lower index.
        let lowerIndex = Math.floor(index);
        // Get the remaining.
        let remainder = index - lowerIndex;
        // Add the remaining to the lowerindex value.
        return array[lowerIndex] + remainder * (array[lowerIndex + 1] - array[lowerIndex]);
    }
}
