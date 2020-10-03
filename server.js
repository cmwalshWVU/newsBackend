require("dotenv").config({ path: "variables.env" });
var admin = require("firebase-admin");
const Web3 = require("web3")

require('dotenv').config()

const firebase = require("firebase");
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

const allowedOrigins = [
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost'
];

// Reflect the origin if it's in the allowed list or not defined (cURL, Postman, etc.)
const corsOptions = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Origin not allowed by CORS'));
    }
  }
}

app.options('*', cors(corsOptions));

console.log(process.env.REACT_APP_API_KEY_PAYDAY)
const config = {
  apiKey: process.env.REACT_APP_API_KEY_PAYDAY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN_PAYDAY,
  databaseURL: process.env.REACT_APP_DATABASE_URL_PAYDAY,
  projectId: process.env.REACT_APP_PROJECT_ID_PAYDAY,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET_PAYDAY,
  messagingSenderId: process.env.REACT_APP_SENDER_ID_PAYDAY,
  appId: process.env.REACT_APP_APP_ID_PAYDAY,
};

const Firebase  = firebase.initializeApp(config);

const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

setInterval(() => updatePayDayDailyHoldings(), 900000);

setTimeout(() => fetchTopCryptos(100), 10000);
// setTimeout(() => updateDailyHoldings(), 10000);

// const news = cryptoCompareNews();
setTimeout(() => cryptoCompareNews(), 10000);

// repeat with the interval of 2 seconds
setTimeout(() => updateFeed("crypto"), 5);
setInterval(() => updateFeed("crypto"), 172800);

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
  let counter = 1;
    var now = new Date();
    now.setMinutes(now.getMinutes() - 10);
    console.log("Calling Update Feed");
    cryptoCompareNews();
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

app.get("/token", cors(corsOptions), (req, res) => {
  axios.post(`https://us-central1-crypto-watch-dbf71.cloudfunctions.net/tokenHodl`, { 'code': req.query.code })
  .then(response => {
      console.log(response);
      console.log(response.data);
      res.json(response.data.authToken);
  }).catch((err) => {
    console.log(err)
    res.json(null)
  })
})


app.get("/tokenMobile", cors(corsOptions), (req, res) => {
  axios.post(`https://us-central1-crypto-watch-dbf71.cloudfunctions.net/tokenHodlMobile`, { 'code': req.query.code })
  .then(response => {
      console.log(response);
      console.log(response.data);
      res.json(response.data.authToken);
  }).catch((err) => {
    console.log(err)
    res.json(null)
  })
})

app.get("/wallets", cors(corsOptions), (req, res) => {
  // console.log(req)
  const headers = {'Authorization': 'Bearer ' + req.query.code }

  axios.get('https://us-central1-crypto-watch-dbf71.cloudfunctions.net/walletHodl', {headers})
    .then(response => {
        console.log(response.data);
        res.json(response.data);
    })
    .catch(error => {
      console.log(error);
      res.json(null)
    }); 
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
          top20: response.data.data
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

const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/v3/fe144c9b7ccd44fc9f4ef53807df0bc5"))



function updatePayDayDailyHoldings() {
  const currentDate = Date.now()
  console.log("Setting Pay Holdings history for timestamp: " + currentDate.toString())
  // axios.get("https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?CMC_PRO_API_KEY=5b82bdf3-bf6d-4153-855b-635c1519b7a8")
  //   .then(response => {
  // const top100 = response.data.data
  Firebase.firestore().collection('accounts').get().then(async (userIdsCollectiom) => {
    let userIds = userIdsCollectiom.docs.map(doc => doc.id);
    userIds.map(async (userId) => {
      console.log("User ID: " + userId)
      const response = await axios.get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false")
      const currentPrices = response.data
      console.log(currentPrices.data)
      const amount = await web3.eth.getBalance(userId)
      let currentHoldings =  Number(currentPrices.filter((it) => it.symbol === "eth")[0].current_price) * Number(web3.utils.fromWei(amount, 'ether'))

      console.log("ETH Holding" + currentHoldings)
      ERC20TOKENS.forEach(async (token) => {
        // GET TOKEN contract and decimals
        console.log("checking token " + token.symbol)
        const contract = new web3.eth.Contract(MinAbi, token.address);
        const dec = await contract.methods.decimals().call()

        // GET ERC20 Token Balance and divide by decimals
        let bal = await contract.methods.balanceOf(userId).call()

        bal = bal / (10 ** dec)

        console.log("token balance: " + bal)
        if (currentPrices.filter((it) => it.symbol === token.symbol.toLowerCase())[0]) {
            const tokenHoldings = currentPrices.filter((it) => it.symbol === token.symbol.toLowerCase())[0].current_price * bal
            console.log("token value: " + tokenHoldings)

            currentHoldings += tokenHoldings
        }
      })
      
      Firebase.firestore().collection("dailyHoldings").doc(userId).collection("holdingsHistory")
        .doc(currentDate.toString()).set({
            totalHoldings: currentHoldings,
            lastUpdated: new Date()
          });

    })
  })
}




app.set("port", process.env.PORT || 5000);
const server = app.listen(app.get("port"), () => {
  console.log(`Express running → PORT ${server.address().port}`);
});


const BAND = {symbol: "BAND",name: "Band Protocol", address: '0xba11d00c5f74255f56a5e366f4f77f5a186d7f55'}
const BAT = {symbol: "BAT",name: "Basic Attention Token", address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF'}
const BNB = {symbol: "BNB",name: "Binance Coin", address: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52'}
const CBAT = {symbol: "CBAT",name: "Compound Basic Attention Token", address: '0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e'}
const CDAI = {symbol: "CDAI",name: "Compound Dai", address: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643'}
const CEL = {symbol: "CEL",name: "Celsius Network", address: '0xaaaebe6fe48e54f431b0c390cfaf0b017d09d42d'}
const CETH = {symbol: "CETH",name: "Compound Ether", address: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5'}
const CUSDC = {symbol: "CUSDC",name: "Compound USD Coin", address: '0x39aa39c021dfbae8fac545936693ac917d5e7563'}
const CZRX = {symbol: "CZRX",name: "Compound 0rx", address: '0xb3319f5d18bc0d84dd1b4825dcde5d5f7266d407'}
const DAI = {symbol: "DAI", name: "Dai", address: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'}
const KNC = {symbol: "KNC",name: "Kyber Network", address: '0xdd974D5C2e2928deA5F71b9825b8b646686BD200'}
const LEND = {symbol: "LEND",name: "Aave", address: '0x80fB784B7eD66730e8b1DBd9820aFD29931aab03'}
const LINK = {symbol: "LINK",name: "Link", address: '0x514910771af9ca656af840dff83e8264ecf986ca'}
const MATIC = {symbol: "MATIC",name: "MATIC Network", address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0'}
const MKR = {symbol: "MKR",name: "Maker", address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'}
const OMG = {symbol: "OMG",name: "OmiseGo", address: '0xd26114cd6EE289AccF82350c8d8487fedB8A0C07'}
const PAX = {symbol: "PAX",name: "Paxos Standard", address: '0x8e870d67f660d95d5be530380d0ec0bd388289e1'}
const POWR = {symbol: "POWR",name: "Power Ledger", address: '0x595832f8fc6bf59c85c527fec3740a1b7a361269'}
const REN = {symbol: "REN",name: "REN", address: '0x408e41876cCCDC0F92210600ef50372656052a38'}
const SNX = {symbol: "SNX",name: "Synthetix Network Token", address: '0xC011A72400E58ecD99Ee497CF89E3775d4bd732F'}
const RLC = {symbol: "RLC",name: "iExec RLC", address: '0x607F4C5BB672230e8672085532f7e901544a7375'}
const USDC = {symbol: "USDC",name: "USD Coin", address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'}
const UBT = {symbol: "UBT",name: "Unibright", address: '0x8400d94a5cb0fa0d041a3788e395285d61c9ee5e'}
const WETH = {symbol: "WETH",name: "Wrapped Ether", address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'}
const USDT = {symbol: "USDT",name: "Tether", address: '0xdac17f958d2ee523a2206206994597c13d831ec7'}
const WBTC = {symbol: "WBTC",name: "Wrapped Bitcoin", address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'}
const ZRX = {symbol: "ZRX",name: "0RX", address: '0xe41d2489571d322189246dafa5ebde1f4699f498'}

const ERC20TOKENS = [BAND, BAT, BNB, CBAT, CDAI, CEL, CETH, CUSDC, CZRX, DAI,
    KNC, LEND, LINK, MATIC, MKR, OMG, PAX, POWR, REN, RLC, SNX, UBT, USDC, USDT, WETH, ZRX, WBTC]

const MinAbi = [
  // balanceOf
  {
    "constant":true,
    "inputs":[{"name":"_owner","type":"address"}],
    "name":"balanceOf",
    "outputs":[{"name":"balance","type":"uint256"}],
    "type":"function"
  },
  // decimals
  {
    "constant":true,
    "inputs":[],
    "name":"decimals",
    "outputs":[{"name":"","type":"uint8"}],
    "type":"function"
  }
];
  