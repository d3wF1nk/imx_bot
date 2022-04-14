import mongo from 'mongodb'
import {env, vars} from "./config.js";

const uri = `mongodb+srv://${env.DB_USERNAME}:${env.DB_PASSWORD}@${env.DB_HOST}/myFirstDatabase?retryWrites=true&w=majority`;

export const insert = async (tokenId,tokenName,price,address) => {
    let doc = {
        bot_address:address,
        token_id:tokenId,
        description:tokenName,
        start_price:price,
        actual_price:price,
        curr:vars.CURRENCY_SELL,
        status:'created'
    }
    const client = new mongo.MongoClient(uri);
    client.connect(function(err, db) {
        if (err) throw err;
        db.db(env.DB_NAME).collection(env.DB_COLLECTION).insertOne(doc, function(err, res) {
            if (err) throw err;
            console.log("1 document inserted");
            db.close();
        });
    })
}
