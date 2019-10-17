
require('dotenv').config({ path: 'variables.env' });
var admin = require('firebase-admin');

const express = require('express');
const cors = require('cors');
const Pusher = require('pusher');
const NewsAPI = require('newsapi');
const topic = 'news';
const axios = require('axios');
const app = express();

var serviceAccount = require("./key.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://crypto-watch-dbf71.firebaseio.com"
  });


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
                admin.firestore().collection('priceData').doc('priceHistory').collection(ticker).doc(price.time.toString()).set({
                    timeStamp: price.time,
                    price: price })
                pusher.trigger('price-channel', ticker, {
                    prices: price,
                });
            })
        })
        .catch(err => console.log(err));
}

function fetchTopCryptos(numberOfDataPoints) {
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
