
require('dotenv').config({ path: 'variables.env' });
var admin = require('firebase-admin');

const express = require('express');
const cors = require('cors');
const Pusher = require('pusher');
const NewsAPI = require('newsapi');
const topic = 'news';
const axios = require('axios');
const app = express();

// admin.initializeApp({
//     credential: admin.credential.cert(process.env.FIREBASE_CONFIG),
//     databaseURL: "https://crypto-watch-dbf71.firebaseio.com"
//   });

// const config  = {
//     type: "service_account",
//     project_id: "crypto-watch-dbf71",
//     private_key_id: process.env.PRIVATE_KEY_ID,
//     private_key: process.env.PRIVATE_KEY,
//     client_email: process.env.CLIENT_EMAIL,
//     client_id: process.env.CLIENT_ID,
//     auth_uri: process.env.AUTH_URI,
//     token_uri: process.env.TOKEN_URI,
//     auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
//     client_x509_cert_url: process.env.CLIENT_X509_CERT_URL
//   }
// admin.initializeApp({
//     credential: admin.credential.cert(config),
//     databaseURL: "https://crypto-watch-dbf71.firebaseio.com"
//   });


// var serviceAccount = require("./key.json");

// admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
//     databaseURL: "https://crypto-watch-dbf71.firebaseio.com"
//   });

  

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_APP_KEY,
    secret: process.env.PUSHER_APP_SECRET,
    cluster: process.env.PUSHER_APP_CLUSTER,
    encrypted: true,
});

const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

const setPrices = fetchTopCryptos(100);
// repeat with the interval of 2 seconds
let timerId = setInterval(() => fetchTopCryptos(1), 60000);

const fetchNews = (searchTerm, pageNum, date) =>
    newsapi.v2.everything({
    q: searchTerm,
    from: date,
    language: 'en',
    sortBy:'recency',
    });

app.use(cors());

function updateFeed(topic) {
    let counter = 2;
    setInterval(() => {
        fetchNews(topic, counter)
            .then(response => {
                for (i = 0; i < response.articles.length; i++) {
                    // console.log(JSON.stringify(response.articles[i]))
                    pusher.trigger('news-channel', 'update-news', {
                        articles: response.articles[i],
                    });
                }
                counter += 1;
            })
            .catch(error => console.log(error));
    }, 172800);
}

app.get('/live', (req, res) => {
    const topic = 'crypto';
    var now = new Date();
    now.setHours(now.getHours()-6);
    console.log("Calling Live")
    fetchNews(topic, 1, now.toISOString())
        .then(response => {
            for (i = 0; i < response.articles.length; i++) {
                pusher.trigger('news-channel', 'update-news', {
                    articles: response.articles[i],
                });
            }   
            res.json(response.articles);
            updateFeed(topic);
        })
        .catch(error => console.log(error));
});

function fetchPriceData(ticker, numberOfDataPoints) {
    axios.get('https://min-api.cryptocompare.com/data/histominute?fsym=' + ticker + '&tsym=USD&limit=' + numberOfDataPoints + '&aggregate=1&e=CCCAGG')
        .then(response => {
            response.data.Data.map(price => {
                // admin.firestore().collection('priceData').doc('priceHistory').collection(ticker).doc(price.time.toString()).set({
                //     timeStamp: price.time,
                //     price: price })
                pusher.trigger('price-channel', ticker, {
                    prices: price,
                });
            })
        })
        .catch(err => console.log(err));
}

function fetchTopCryptos(numberOfDataPoints) {
    // console.log(JSON.stringify(config))
    axios.get("https://api.coinmarketcap.com/v1/ticker/?limit=20")
        .then(response => {
            var result = response.data.filter(currency => currency.rank <= 10);
            result.map(crypto => fetchPriceData(crypto.symbol, numberOfDataPoints))
        })
        .catch(err => console.log(err));
}

app.set('port', process.env.PORT || 5000);
const server = app.listen(app.get('port'), () => {
    console.log(`Express running → PORT ${server.address().port}`);
});
