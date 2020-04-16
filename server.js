require("dotenv").config({ path: "variables.env" });
var admin = require("firebase-admin");

const express = require("express");
const cors = require("cors");
const Pusher = require("pusher");
const NewsAPI = require("newsapi");
const axios = require("axios");
const app = express();
var serviceAccount = process.env.FIREBASE_CONFIG;

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(serviceAccount)),
  databaseURL: "https://crypto-watch-dbf71.firebaseio.com"
});

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
  encrypted: true
});

const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

setTimeout(() => fetchTopCryptos(100), 10000);
// setTimeout(() => updateDailyHoldings(), 10000);

// const news = cryptoCompareNews();
setTimeout(() => cryptoCompareNews(), 10000);

// repeat with the interval of 2 seconds
setTimeout(() => fetchNewsData(), 5);
setInterval(() => fetchTopCryptos(1), 900000);
// setInterval(() => updateDailyHoldings(), 900000);

const fetchNews = (searchTerm, pageNum, date) =>
  newsapi.v2.everything({
    q: searchTerm,
    from: date,
    language: "en",
    sortBy: "recency"
  });

app.use(cors());

function updateFeed(topic) {
  let counter = 2;
  var now = new Date();
  now.setMinutes(now.getMinutes() - 3);
  setInterval(() => {
    fetchNews(topic, counter, now)
      .then(response => {
        let sorted = response.articles.sort((a, b) =>
          a.publishedAt > b.publishedAt ? 1 : -1
        );

        for (let i = 0; i < sorted.length; i++) {
          // console.log(JSON.stringify(response.articles[i]))
          pusher.trigger("news-channel", "update-news", {
            articles: sorted[i]
          });
        }
        counter += 1;
      })
      .catch(error => console.log(error));
  }, 172800);
}

app.get("/top", (req, res) => {
  axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?CMC_PRO_API_KEY=5b82bdf3-bf6d-4153-855b-635c1519b7a8")
      .then(response => {
          res.json(response.data);
      })
      .catch(err => console.log(err));
  }
);

app.get("/history", (req, res) => {
  console.log(req.query.ticker)
  axios.get('https://min-api.cryptocompare.com/data/histominute?fsym=' + req.query.ticker + '&tsym=USD&limit=100&aggregate=15&e=CCCAGG')      .then(response => {
    res.json(response.data);
  })
  .catch(err => console.log(err));
  }
);

app.get("/token", (req, res) => {
  axios.post(`https://us-central1-crypto-watch-dbf71.cloudfunctions.net/tokenHodl`, { 'code': req.query.code })
  .then(res => {
      console.log(res);
      console.log(res.data);
      res.json(res.data.authToken);
  }).catch((err) => {
    console.log(err)
    res.json(null)
  })
})

app.get("/live", (req, res) => {
  const topic = "crypto";
  var now = new Date();
  now.setHours(now.getHours() - 6);
  console.log("Calling Live");
  cryptoCompareNews();
  fetchNews(topic, 1, now.toISOString())
    .then(response => {
      let sorted = response.articles.sort((a, b) =>
        a.publishedAt > b.publishedAt ? 1 : -1
      );
      for (let i = 0; i < sorted.length; i++) {
        pusher.trigger("news-channel", "update-news", {
          articles: sorted[i]
        });
      }
      res.json(sorted);
      // updateFeed(topic);
    })
    .catch(error => console.log(error));
});

function cryptoCompareNews() {
  axios
    .get("https://min-api.cryptocompare.com/data/v2/news/")
    .then(response => {
      if (response.data !== null && response.data.Data !== undefined) {
        console.log("sendings news");
        for (let i = 0; i < response.data.Data.length; i++) {
          pusher.trigger("news-channel", "update-news", {
            articles: response.data.Data[i]
          });
        }
      } else {
        console.log("not sendings news");
      }
    })
    .catch(err => console.log(err));
}

function fetchNewsData() {
  const topic = "crypto";
  var now = new Date();
  now.setHours(now.getHours() - 6);
  console.log("Calling Live");
  fetchNews(topic, 1, now.toISOString())
    .then(response => {
      let sorted = response.articles.sort((a, b) =>
        a.publishedAt > b.publishedAt ? 1 : -1
      );

      for (let i = 0; i < sorted.length; i++) {
        pusher.trigger("news-channel", "update-news", {
          articles: sorted[i]
        });
      }
      updateFeed(topic);
    })
    .catch(error => console.log(error));
}

function fetchPriceData(ticker, numberOfDataPoints) {
  axios
    .get(
      "https://min-api.cryptocompare.com/data/histominute?fsym=" +
        ticker +
        "&tsym=USD&limit=" +
        numberOfDataPoints +
        "&aggregate=15&e=CCCAGG"
    )
    .then(response => {
      if (response.data !== null && response.data.Data !== null) {
        for (let i = 0; i < response.data.Data.length; i++) {
          admin
            .firestore()
            .collection("priceData")
            .doc("priceHistory")
            .collection(ticker)
            .doc(response.data.Data[i].time.toString())
            .set({
              timeStamp: response.data.Data[i].time,
              price: response.data.Data[i]
            });
          pusher.trigger("price-channel", ticker, {
            prices: response.data.Data[i]
          });
        }
      }
    })
    .catch(err => console.log(err));
}

function fetchTopCryptos(numberOfDataPoints) {
  axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?CMC_PRO_API_KEY=5b82bdf3-bf6d-4153-855b-635c1519b7a8")
    .then(response => {
      if (response.data.data !== null) {
        updateDailyHoldings(response.data.data)
        var result = response.data.data.filter(currency => currency.cmc_rank <= 20);
        admin
            .firestore()
            .collection("top")
            .doc("top20")
            .set({
              top20: response.data.data,
              lastUpdated: new Date()
            });
        
        pusher.trigger("top-20-channel", "top-20", {
          top20: response.data.data.filter(currency => currency.cmc_rank <= 20)
        });
        result.map(crypto => fetchPriceData(crypto.symbol, numberOfDataPoints));
      }
    })
    .catch(err => console.log(err));
}

function updateDailyHoldings(top100) {
  const currentDate = Date.now()
  console.log("Setting Holdings history for timestamp: " + currentDate.toString())
  // axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?CMC_PRO_API_KEY=5b82bdf3-bf6d-4153-855b-635c1519b7a8")
  //   .then(response => {
      if (top100 !== null) {
        // const top100 = response.data.data
        admin.firestore().collection('users').get().then(async (userIdsCollectiom) => {
          let userIds = userIdsCollectiom.docs.map(doc => doc.id);
          userIds.map(async (userId) => {
            let currentHoldings = 0
            const holdingsDocs = await admin.firestore().collection("holdings").doc(userId).collection("holdings").get()
            if (holdingsDocs.docs !== undefined) {
              let holdings = holdingsDocs.docs.map(doc => doc.data());
              // console.log(holdings)
              holdings.forEach((holding) => {
                const currPrice = top100.find((it) => it.symbol === holding.coin)
                if (currPrice) {
                  currentHoldings += Number(holding.numberOfCoins) * Number(currPrice.quote.USD.price)
                }
              })
            }
            
            const cbHoldingsDocs = await admin.firestore().collection("cbHoldings").doc(userId).collection("cbHoldings").get()
            if (cbHoldingsDocs.docs !== undefined) {
              let cbHoldings = cbHoldingsDocs.docs.map(doc => doc.data());
              // console.log(holdings)
              cbHoldings.forEach((holding) => {
                const currPrice = top100.find((it) => it.symbol === holding.holding.currency)
                if (currPrice) {
                  currentHoldings += Number(holding.holding.amount) * Number(currPrice.quote.USD.price)
                }
              })
              admin
              .firestore()
              .collection("dailyHoldings")
              .doc(userId)
              .collection("holdingsHistory")
              .doc(currentDate.toString())
              .set({
                totalHoldings: currentHoldings,
                lastUpdated: new Date()
              });
            }
          })
        })
      } else {
        return
      }
    // }).catch((err) => {
    //   console.log(err)
    // })  
}


app.set("port", process.env.PORT || 5000);
const server = app.listen(app.get("port"), () => {
  console.log(`Express running → PORT ${server.address().port}`);
});
