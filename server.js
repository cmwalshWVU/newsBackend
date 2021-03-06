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
const moment = require("moment")

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

setTimeout(() => updatePayDayDailyHoldings(), 1000);
setInterval(() => updatePayDayDailyHoldings(), 3600000);

setTimeout(() => fetchTopCryptos(100), 10000);
// setTimeout(() => updateDailyHoldings(), 10000);

// const news = cryptoCompareNews();
setTimeout(() => cryptoCompareNews(), 10000);

// repeat with the interval of 2 seconds
setTimeout(() => fetchNewsData(), 5);
setInterval(() => updateFeed("crypto"), 172800);

setInterval(() => fetchTopCryptos(1), 900000);
// setInterval(() => updateDailyHoldings(), 900000);

const fetchNews = (searchTerm, pageNum, date) =>
  newsapi.v2.everything({
    q: searchTerm,
    from: date,
    language: "en",
    sortBy: "recency",
    pageSize: 100
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

        console.log(`attempting to save ${sorted.length} articles`)
        for (let i = 0; i < sorted.length; i++) {
          try {
            Firebase.firestore().collection("articles").doc(`${sorted[i].publishedAt}-${sorted[i].title.replace("/", "_")}`).set({
              article: sorted[i],
              lastUpdated: new Date()
            })
          } catch (error) {
            console.log("Error saving article:", error);
          }
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
        console.log(`attempting to save ${response.data.Data.length} articles`)

        for (let i = 0; i < response.data.Data.length; i++) {
          pusher.trigger("news-channel", "update-news", {
            articles: response.data.Data[i]
          });
          try {
            Firebase.firestore().collection("articles").doc(`${moment(response.data.Data[i].published_on * 1000).format()}-${response.data.Data[i].title.replace("/", "_")}`).set({
              article: response.data.Data[i],
              lastUpdated: new Date()
            })
          } catch (error) {
            console.log("Error saving article:", error);
          }
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
  now.setDate(now.getDate() - 20);
  console.log("Calling Live");
  fetchNews(topic, 1, now.toISOString())
    .then(response => {
      let sorted = response.articles.sort((a, b) =>
        a.publishedAt > b.publishedAt ? 1 : -1
      );
      console.log(`attempting to save ${sorted.length} articles`)
      for (let i = 0; i < sorted.length; i++) {
        try {
          Firebase.firestore().collection("articles").doc(`${sorted[i].publishedAt}-${sorted[i].title.replace("/", "_")}`).set({
            article: sorted[i],
            lastUpdated: new Date()
          })
        } catch (error) {
          console.log("Error saving article:", error);
        }
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

const web3 = new Web3(new Web3.providers.HttpProvider("https://mainnet.infura.io/v3/7b57649a10fe40fbb47f8e2b770ae04c"))

async function getContracts() {
  return ERC20TOKENS.map(async (token) => {
    const tokenContract = new web3.eth.Contract(MinAbi, token.address);
    const dec = await tokenContract.methods.decimals().call()
    contract = {contract: tokenContract, decimal: dec}
    return contract
  })
}

function updatePayDayDailyHoldings() {
  const currentDate = Date.now()
  console.log("Setting Pay Holdings history for timestamp: " + currentDate.toString())
  getContracts().then((contracts) => {
    axios.get("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false").then(async (response) => {
      // console.log(response)
      const currentPrices = response.data
      Firebase.firestore().collection('accounts').get().then(async (userIdsCollectiom) => {
        let userIds = userIdsCollectiom.docs.map(doc => doc.id);
        userIds.map(async (userId) => {
          console.log("User ID: " + userId)

          console.log(currentPrices.data)
          const amount = await web3.eth.getBalance(userId)
          let currentHoldings =  Number(currentPrices.filter((it) => it.symbol === "eth")[0].current_price) * Number(web3.utils.fromWei(amount, 'ether'))

          console.log("ETH Holding" + currentHoldings)
          var ctr = 0;

          ERC20TOKENS.forEach(async (token, index) => {
            let contract = contracts[index]
            let resolvedContract = null
            // GET TOKEN contract and decimals
            if (contract === null || contract === undefined || null === contract.contract || null === contract.decimal) {
              console.log(`getting contract for ${token.symbol}`)
              const tokenContract = new web3.eth.Contract(MinAbi, token.address);
              const dec = await tokenContract.methods.decimals().call()
              resolvedContract = { contract: tokenContract, decimal: dec}
            } else {
             await contract.then((resolved) => {
              resolvedContract = resolved
             })
              console.log(`contract for ${token.symbol} was in array`)
            }

            // GET ERC20 Token Balance and divide by decimals
            let bal = await resolvedContract.contract.methods.balanceOf(userId).call()

            if (bal > 0) {
              // const dec = await contract.methods.decimals().call()
              bal = bal / (10 ** resolvedContract.decimal)

            }

            console.log("checking token " + token.symbol)
            console.log("token balance: " + bal)
            if (currentPrices.filter((it) => it.symbol === token.symbol.toLowerCase())[0]) {
                const tokenHoldings = currentPrices.filter((it) => it.symbol === token.symbol.toLowerCase())[0].current_price * bal
                console.log("token value: " + tokenHoldings)
                currentHoldings += tokenHoldings
            }
            ctr++
            if (ctr === ERC20TOKENS.length) {
              console.log(`${userId} holdings: ${currentHoldings}`)
              var docRef = Firebase.firestore().collection("dailyHoldings").doc(userId)
              try {
                const doc = await docRef.get();
                if (doc.exists) {
                  docRef.collection("holdingsHistory").doc(currentDate.toString()).set({
                    totalHoldings: currentHoldings,
                    lastUpdated: new Date()
                  })
                }
                else {
                  Firebase.firestore().collection("dailyHoldings").doc(userId).set({}).then(() => {
                    docRef.collection("holdingsHistory").doc(currentDate.toString()).set({
                      totalHoldings: currentHoldings,
                      lastUpdated: new Date()
                    }).catch(function(error) {
                      console.log(error)
                    });
                  });
                }
              } catch (error) {
                console.log("Error getting document:", error);
              }
            }
          })
        })
      })
    })
  })
}


app.set("port", process.env.PORT || 5000);
const server = app.listen(app.get("port"), () => {
  console.log(`Express running → PORT ${server.address().port}`);
});

const DAI = {symbol: "DAI", name: "Dai", address: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'}
const USDC = {symbol: "USDC",name: "USD Coin", address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'}
const LINK = {symbol: "LINK",name: "Link", address: '0x514910771af9ca656af840dff83e8264ecf986ca'}
const CDAI = {symbol: "CDAI",name: "Compound Dai", address: '0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643'}
const THETA = {symbol: "THETA",name: "Theta Network", address: '0x3883f5e181fccaf8410fa61e12b59bad963fb645'}
const LEND = {symbol: "LEND",name: "Aave", address: '0x80fB784B7eD66730e8b1DBd9820aFD29931aab03'}
const UNI = {symbol: "UNI",name: "Uniswap", address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'}
const YFI ={symbol: "YFI",name: "yearn.finance", address: '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e'}
const SNX = {symbol: "SNX",name: "Synthetix Network Token", address: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f'}
const BUSD = {symbol: "BUSD",name: "Binance USD", address: '0x4fabb145d64652a948d72533023f6e7a623c7c53'}
const OMG = {symbol: "OMG",name: "OmiseGo", address: '0xd26114cd6EE289AccF82350c8d8487fedB8A0C07'}
const MKR = {symbol: "MKR",name: "Maker", address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'}
const CEL = {symbol: "CEL",name: "Celsius Network", address: '0xaaaebe6fe48e54f431b0c390cfaf0b017d09d42d'}
const UMA = {symbol: "UMA",name: "UMA", address: '0x04fa0d235c4abf4bcf4787af4cf447de572ef828'}
const TUSD = {symbol: "TUSD",name: "TrueUSD", address: '0x0000000000085d4780b73119b644ae5ecd22b376'}
const BAT = {symbol: "BAT",name: "Basic Attention Token", address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF'}
const PAX = {symbol: "PAX",name: "Paxos Standard", address: '0x8e870d67f660d95d5be530380d0ec0bd388289e1'}
const ZRX = {symbol: "ZRX",name: "0RX", address: '0xe41d2489571d322189246dafa5ebde1f4699f498'}
const CETH = {symbol: "CETH",name: "Compound Ether", address: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5'}
const RENBTC = {symbol: "RENBTC",name: "renBTC", address: '0xeb4c2781e4eba804ce9a9803c67d0893436bb27d'}
const LRC = {symbol: "RENBTC",name: "Loopring", address: '0xbbbbca6a901c926f240b89eacb641d8aec7aeafd'}
const REN = {symbol: "LRC",name: "REN", address: '0x408e41876cCCDC0F92210600ef50372656052a38'}
const ALINK = {symbol: "ALINK",name: "Aave LINK", address: '0xa64bd6c70cb9051f6a9ba1f163fdc07e0dfb5f84'}
const CUSDC = {symbol: "CUSDC",name: "Compound USD Coin", address: '0x39aa39c021dfbae8fac545936693ac917d5e7563'}
const KNC = {symbol: "KNC",name: "Kyber Network", address: '0xdd974D5C2e2928deA5F71b9825b8b646686BD200'}
const NMR = {symbol: "NMR",name: "Numeraire", address: '0x1776e1f26f98b1a5df9cd347953a26dd3cb46671'}
const ENJ = {symbol: "ENJ",name: "Enjin Coin", address: '0xf629cbd94d3791c9250152bd8dfbdf380e2a3b9c'}
const BAND = {symbol: "BAND",name: "Band Protocol", address: '0xba11d00c5f74255f56a5e366f4f77f5a186d7f55'}
const BAL = {symbol: "BAL",name: "Balancer", address: '0xba100000625a3754423978a60c9317c58a424e3d'}
const AMPL = {symbol: "AMPL",name: "Ampleforth", address: '0xd46ba6d942050d489dbd938a2c909a5d5039a161'}
const ANT =  {symbol: "ANT",name: "Aragon", address: '0x960b236a07cf122663c4303350609a66a7b288c0'}
const SUSHI = {symbol: "SUSHI",name: "Sushi", address: '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2'}
const SXP = {symbol: "SXP",name: "Swipe", address: '0x8ce9137d39326ad0cd6491fb5cc0cba0e089b6a9'}
const QNT = {symbol: "QNT",name: "Quant", address: '0x4a220e6096b25eadb88358cb44068a3248254675'}
const MANA = {symbol: "MANA",name: "Decentraland", address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942'}
const GNT = {symbol: "GNT",name: "Golem", address: '0xa74476443119a942de498590fe1f2454d7d4ac0d'}
const SNT = {symbol: "SNT",name: "Status", address: '0x744d70fdbe2ba4cf95131626614a1763df805b9e'}
const RSR = {symbol: "RSR",name: "Reserve Rights Token", address: '0x8762db106b2c2a0bccb3a80d1ed41273552616e8'}
const HOT = {symbol: "HOT",name: "Holo", address: '0x6c6ee5e31d828de241282b9606c8e98ea48526e2'}
const NEXO = {symbol: "NEXO",name: "NEXO", address: '0xb62132e35a6c13ee1ee0f84dc5d40bad8d815206'}
const KEEP = {symbol: "KEEP",name: "Keep Network", address: '0x85eee30c52b0b379b046fb0f85f4f3dc3009afec'}
const SUSD = {symbol: "SUSD",name: "sUSD", address: '0x57ab1ec28d129707052df4df418d58a2d46d5f51'}
const MATIC = {symbol: "MATIC",name: "Matic Network", address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0'}
const REP = {symbol: "REP",name: "Augur", address: '0x221657776846890989a759ba2973e427dff5c9bb'}
const STORJ = {symbol: "STORJ",name: "Storj", address: '0xb64ef51c888972c908cfacf59b47c1afbc0ab8ac'}
const BNT = {symbol: "BNT",name: "Bancor Network Token", address: '0x1f573d6fb3f13d689ff844b4ce37794d79a7ff1c'}
const MCO = {symbol: "MCO",name: "MCO", address: '0xb63b606ac810a52cca15e44bb630fd42d8d1d83d'}
const PAXG = {symbol: "PAXG",name: "PAX Gold", address: '0x45804880de22913dafe09f4980848ece6ecbaf78'}
const LPT = {symbol: "LPT",name: "Livepeer", address: '0x58b6a8a3302369daec383334672404ee733ab239'}
const RLC = {symbol: "RLC",name: "iExec RLC", address: '0x607f4c5bb672230e8672085532f7e901544a7375'}
const UTK  = {symbol: "UTK",name: "UTRUST", address: '0xdc9ac3c20d1ed0b540df9b1fedc10039df13f99c'}
const CRV = {symbol: "CRV",name: "Curve DAO Token", address: '0xd533a949740bb3306d119cc777fa900ba034cd52'}
const CZRX = {symbol: "CZRX",name: "c0x", address: '0xb3319f5d18bc0d84dd1b4825dcde5d5f7266d407'}
const ENG = {symbol: "ENG",name: "Enigma", address: '0xf0ee6b27b759c9893ce4f094b49ad28fd15a23e4'}
const UBT = {symbol: "UBT",name: "Unibright", address: '0x8400d94a5cb0fa0d041a3788e395285d61c9ee5e'}
const GNO = {symbol: "GNO",name: "Gnosis", address: '0x6810e776880c02933d47db1b9fc05908e5386b96'}
const ELF = {symbol: "ELF",name: "elf", address: '0xbf2179859fc6d5bee9bf9158632dc51678a4100e'}
const RPL = {symbol: "RPL",name: "Rocket Pool", address: '0xb4efd85c19999d84251304bda99e90b92300bd93'}
const AGI = {symbol: "AGI",name: "SingularityNET", address: '0x8eb24319393716668d768dcec29356ae9cffe285'}
const FET = {symbol: "FET",name: "Fetch.ai", address: '0x1d287cc25dad7ccaf76a26bc660c5f7c8e2a05bd'}
const EURS = {symbol: "EURS",name: "STASIS EURO", address: '0xdb25f211ab05b1c97d595516f45794528a807ad8'}
const PNK = {symbol: "PNK",name: "Kleros", address: '0x93ed3fbe21207ec2e8f2d3c3de6e058cb73bc04d'}
const POWR = {symbol: "POWR",name: "Power Ledger", address: '0x595832f8fc6bf59c85c527fec3740a1b7a361269'}
const DIA = {symbol: "DIA",name: "DIA", address: '0x84ca8bc7997272c7cfb4d0cd3d55cd942b3c9419'}
const NPXS = {symbol: "NPXS",name: "Pundi X", address: '0xa15c7ebe1f07caf6bff097d8a589fb8ac49ae5b3'}
const QKC = {symbol: "QKC",name: "QuarkChain", address: '0xea26c4ac16d4a5a106820bc8aee85fd0b7b2b664'}
const BTU = {symbol: "BTU",name: "BTU Protocol", address: '0xb683d83a532e2cb7dfa5275eed3698436371cc9f'}
const TRB = {symbol: "TRB",name: "Tellor", address: '0x0ba45a8b5d5575935b8158a88c631e9f9c95a2e5'}
const ADAI = {symbol: "ADAI",name: "Aave DAI", address: '0xfc1e690f61efd961294b3e1ce3313fbd8aa4f85d'}
const MLN = {symbol: "MLN",name: "Melon", address: '0xec67005c4e498ec7f55e092bd1d35cbc47c91892'}
const DATA = {symbol: "DATA",name: "Streamr DATAcoin", address: '0x0cf0ee63788a0849fe5297f3407f701e122cc023'}
const POLY = {symbol: "POLY",name: "Polymath Network", address: '0x9992ec3cf6a55b00978cddf2b27bc6882d88d1ec'}
const OGN = {symbol: "OGN",name: "Origin Protocol", address: '0x8207c1ffc5b6804f6024322ccf34f29c3541ae26'}
const BLZ = {symbol: "BLZ",name: "Bluzelle", address: '0x5732046a883704404f284ce41ffadd5b007fd668'}
const DGTX = {symbol: "DGTX",name: "Digitex Futures Exchange", address: '0x1c83501478f1320977047008496dacbd60bb15ef'}
const NEC = {symbol: "NEC",name: "Nectar Token", address: '0xcc80c051057b774cd75067dc48f8987c4eb97a5e'}
const SAND = {symbol: "SAND",name: "SAND", address: '0x3845badade8e6dff049820680d1f14bd3903a5d0'}
const SBTC = {symbol: "SBTC",name: "sBTC", address: '0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6'}
const BZRX = {symbol: "BZRX",name: "bZx Protocol", address: '0x56d811088235f11c8920698a204a5010a788f4b3'}
const PICKLE = {symbol: "PICKLE",name: "Pickle Financel", address: '0x429881672b9ae42b8eba0e26cd9c73711b891ca5'}
const C20 = {symbol: "C20",name: "CRYPTO20", address: '0x26e75307fc0c021472feb8f727839531f112f317'}
const RCN = {symbol: "RCN",name: "Ripio Credit Network", address: '0xf970b8e36e23f7fc3fd752eea86f8be8d83375a6'}
const CRPT = {symbol: "CRPT",name: "Crypterium", address: '0x80a7e048f37a50500351c204cb407766fa3bae7f'}
const MTL = {symbol: "MTL",name: "Metal", address: '0xf433089366899d83a9f26a773d59ec7ecf30355e'}
const AST = {symbol: "AST",name: "AirSwap", address: '0x27054b13b1b798b345b591a4d22e6562d47ea75a'}
const CELR = {symbol: "CELR",name: "Celer Network", address: '0x4f9254c83eb525f9fcf346490bbb3ed28a81c667'}
const ADX = {symbol: "ADX",name: "AdEx", address: '0xade00c28244d5ce17d72e40330b1c318cd12b7c3'}
const CREAM = {symbol: "CREAM",name: "Cream", address: '0x2ba592f78db6436527729929aaf6c908497cb200'}
const DENT = {symbol: "DENT",name: "Dent", address: '0x3597bfd533a99c9aa083587b074434e61eb0a258'}
const MTA = {symbol: "MTA",name: "Meta", address: '0xa3bed4e1c75d00fa6f4e5e6922db7261b5e9acd2'}
const QSP = {symbol: "QSP",name: "Quantstamp", address: '0x99ea4db9ee77acd40b119bd1dc4e33e1c070b80d'}
const FUN = {symbol: "FUN",name: "FunFair", address: '0x419d0d8bdd9af5e606ae2232ed285aff190e711b'}
const CND = {symbol: "CND",name: "Cindicator", address: '0xd4c435f5b09f855c3317c8524cb1f586e42795fa'}
const CVC = {symbol: "CVC",name: "Civic", address: '0x41e5560054824ea6b0732e656e3ad64e20e94e45'}
const LOOM = {symbol: "LOOM",name: "Loom Network", address: '0xa4e8c3ec456107ea67d3075bf9e3df3a75823db0'}
const REQ = {symbol: "REQ",name: "Request", address: '0x8f8221afbb33998d8584a2b05749ba73c37a938a'}
const ZAP = {symbol: "ZAP",name: "Zap", address: '0x6781a0f84c7e9e846dcb84a9a5bd49333067b104'}
const YAM = {symbol: "YAM",name: "YAM", address: '0x0aacfbec6a24756c20d41914f2caba817c0d8521'}
const CBAT = {symbol: "CBAT",name: "cBAT", address: '0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e'}
const GHST  = {symbol: "GHST",name: "Aavegotchi", address: '0x3f382dbd960e3a9bbceae22651e88158d2791550'}
const DRGN = {symbol: "DRGN",name: "Dragonchain", address: '0x419c4db4b9e25d6db2ad9691ccb832c8d9fda05e'}
const NKN = {symbol: "NKN",name: "NKN", address: '0x5cf04716ba20127f1e2297addcf4b5035000c9eb'}
const TKN = {symbol: "TKN",name: "Monolith", address: '0xaaaf91d9b90df800df4f55c205fd6989c977e73a'}
const RDN = {symbol: "RDN",name: "Raiden Network Token", address: '0x255aa6df07540cb5d3d297f0d0d4d84cb52bc8e6'}
const DMG = {symbol: "DMG",name: "DMM: Governance", address: '0xed91879919b71bb6905f23af0a68d231ecf87b14'}
const WTC = {symbol: "WTC",name: "Waltonchain", address: '0xb7cb1c96db6b22b0d3d9536e0108d062bd488f74'}
const FOAM = {symbol: "FOAM",name: "FOAM", address: '0x4946fcea7c692606e8908002e55a582af44ac121'}
const TEL = {symbol: "TEL",name: "Telcoin", address: '0x467bccd9d29f223bce8043b84e8c8b282827790f'}
const SALT = {symbol: "SALT",name: "SALT", address: '0x4156d3342d5c385a87d264f90653733592000581'}
const ABT = {symbol: "ABT",name: "Arcblock", address: '0xb98d4c97425d9908e66e53a6fdf673acca0be986'}
const MEME = {symbol: "MEME",name: "Meme", address: '0xd5525d397898e5502075ea5e830d8914f6f0affe'}
const SAI = {symbol: "SAI",name: "Sai", address: '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359'}
const MET = {symbol: "MET",name: "Metronome", address: '0xa3d58c4e56fedcae3a7c43a725aee9a71f0ece4e'}
const DOCK = {symbol: "DOCK",name: "Dock", address: '0xe5dada80aa6477e85d09747f2842f7993d0df71c'}
const PPT = {symbol: "PPT",name: "Populous", address: '0xd4fa1460f537bb9085d22c7bccb5dd450ef28e3a'}
const SPANK = {symbol: "SPANK",name: "SpankChain", address: '0x42d6622dece394b54999fbd73d108123806f6a18'}
const PAY = {symbol: "PAY",name: "TenX", address: '0xb97048628db6b661d4c2aa833e95dbe1a905b280'}
const UPP = {symbol: "UPP",name: "Sentinel Protocol", address: '0xc86d054809623432210c107af2e3f619dcfbf652'}
const WINGS = {symbol: "WINGS",name: "Wings", address: '0x667088b212ce3d06a1b553a7221e1fd19000d9af'}
const TNB = {symbol: "TNB",name: "Time New Bank", address: '0xf7920b0768ecb20a123fac32311d07d193381d6f'}
const TAU = {symbol: "TAU",name: "Lamden", address: '0xc27a2f05fa577a83ba0fdb4c38443c0718356501'}
const LOC = {symbol: "LOC",name: "LockTrip", address: '0x5e3346444010135322268a4630d2ed5f8d09446c'}
const DNT = {symbol: "DNT",name: "district0x", address: '0x0abdace70d3790235af448c88547603b945604ea'}
const GEN = {symbol: "GEN",name: "DAOstack", address: '0x543ff227f64aa17ea132bf9886cab5db55dcaddf'}
const PMA = {symbol: "PMA",name: "PumaPay", address: '0x846c66cf71c43f80403b51fe3906b3599d63336f'}
const SNGLS = {symbol: "SNGLS",name: "SingularDTV", address: '0xaec2e87e0a235266d9c5adc9deb4b2e29b54d009'}
const WABI = {symbol: "WABI",name: "Tael", address: '0x286bda1413a2df81731d4930ce2f862a35a609fe'}
const SRN = {symbol: "SRN",name: "Sirin Labs Token", address: '0x68d57c9a1c35f63e2c83ee8e49a64e9d70528d25'}
const PRO = {symbol: "PRO",name: "Propy", address: '0x226bb599a12c826476e3a771454697ea52e9e220'}
const SENT = {symbol: "SENT",name: "Sentinel", address: '0xa44e5137293e855b1b7bc7e2c6f8cd796ffcb037'}
const GRID = {symbol: "GRID",name: "Grid+", address: '0x12b19d3e2ccc14da04fae33e63652ce469b3f2fd'}
const EVX = {symbol: "EVX",name: "Everex", address: '0xf3db5fa2c66b7af3eb0c0b782510816cbe4813b8'}
const PRE = {symbol: "PRE",name: "Presearch", address: '0x88a3e4f35d64aad41a6d4030ac9afe4356cb84fa'}
const BRD = {symbol: "BRD",name: "Bread", address: '0x558ec3152e2eb2174905cd19aea4e34a23de9ad6'}
const GVT = {symbol: "GVT",name: "Genesis Vision", address: '0x103c3a209da59d3e7c4a89307e66521e081cfdf0'}
const SNM = {symbol: "SNM",name: "SONM", address: '0x983f6d60db79ea8ca4eb9968c6aff8cfa04b3c63'}
const MDA = {symbol: "MDA",name: "Moeda Loyalty Points", address: '0x51db5ad35c671a87207d88fc11d593ac0c8415bd'}
const OST = {symbol: "OST",name: "OST", address: '0x2c4e8f2d746113d0696ce89b35f0d8bf88e0aeca'}
const TRYB = {symbol: "TRYB",name: "BiLira", address: '0x2c537e5624e4af88a7ae4060c022609376c8d0eb'}
const WPR = {symbol: "WPR",name: "WePower", address: '0x4cf488387f035ff08c371515562cba712f9015d4'}
const CDT = {symbol: "CDT",name: "Blox", address: '0x177d39ac676ed1c67a2b268ad7f1e58826e5b0af'}
const tBTC = {symbol: "tBTC",name: "tBTC", address: '0x8daebade922df735c38c80c7ebd708af50815faa'}
const CREP = {symbol: "CREP",name: "cREP", address: '0x158079ee67fce2f58472a96584a73c7ab9ac95c1'}
const POE = {symbol: "POE",name: "Po.et", address: '0x0e0989b1f9b8a38983c2ba8053269ca62ec9b195'}
const DTA = {symbol: "DTA",name: "DATA", address: '0x69b148395ce0015c13e36bffbad63f49ef874e03'}
const OAX = {symbol: "OAX",name: "OAX", address: '0x701c244b988a513c945973defa05de933b23fe1d'}
const PLR = {symbol: "PLR",name: "Pillar", address: '0xe3818504c1b32bf1557b16c238b2e01fd3149c17'}
const YAMv2 = {symbol: "YAMv2",name: "YAM v2", address: '0xaba8cac6866b83ae4eec97dd07ed254282f6ad8a'}
const APPC = {symbol: "APPC",name: "AppCoins", address: '0x1a7a8bd9106f2b8d977e08582dc7d24c723ab0db'}
const COV = {symbol: "COV",name: "Covesting", address: '0xe2fb6529ef566a080e6d23de0bd351311087d567'}
const ABYSS = {symbol: "ABYSS",name: "Abyss", address: '0x0e8d6b471e332f140e7d9dbb99e5e3822f728da6'}
const NGC = {symbol: "NGC",name: "NAGA", address: '0x72dd4b6bd852a3aa172be4d6c5a6dbec588cf131'}
const DLT = {symbol: "DLT",name: "Agrello", address: '0x07e3c70653548b04f0a75970c1f81b4cbbfb606f'}
const HYDRO = {symbol: "HYDRO",name: "Hydro", address: '0xebbdf302c940c6bfd49c6b165f457fdb324649bc'}
const OCN = {symbol: "OCN",name: "Odyssey", address: '0x4092678e4e78230f46a1534c0fbc8fa39780892b'}
const VIBE = {symbol: "VIBE",name: "VIBE", address: '0xe8ff5c9c75deb346acac493c463c8950be03dfba'}
const FRONT = {symbol: "FRONT",name: "Frontier", address: '0xf8c3527cc04340b208c854e985240c02f7b7793f'}
const VIB = {symbol: "VIB",name: "Viberate", address: '0x2c974b2d0ba1716e644c1fc59982a89ddd2ff724'}
const AUC = {symbol: "AUC",name: "Auctus", address: '0xc12d099be31567add4e4e4d0d45691c3f58f5663'}
const AMB = {symbol: "AMB",name: "Ambrosus", address: '0x4dc3643dbc642b72c158e7f3d2ff232df61cb6ce'}
const XAUR = {symbol: "XAUR",name: "Xaurum", address: '0x4df812f6064def1e5e029f1ca858777cc98d2d81'}
const MTH = {symbol: "MTH",name: "Monetha", address: '0xaf4dce16da2877f8c9e00544c93b62ac40631f16'}
const BCDT = {symbol: "BCDT",name: "BCdiploma-EvidenZ", address: '0xacfa209fb73bf3dd5bbfb1101b9bc999c49062a5'}
const IDRT = {symbol: "IDRT",name: "Rupiah Token", address: '0x998ffe1e43facffb941dc337dd0468d52ba5b48a'}
const ONEUP = {symbol: "1UP",name: "Uptrennd", address: '0x07597255910a51509ca469568b048f2597e72504'}
const DRT = {symbol: "DRT",name: "DomRaider", address: '0x9af4f26941677c706cfecf6d3379ff01bb85d5ab'}
const DPI = {symbol: "DPI",name: "DeFiPulse Index", address: '0x1494ca1f11d487c2bbe4543e90080aeba4ba3c2b'}
const CBC = {symbol: "CBC",name: "CashBet Coin", address: '0x26db5439f651caf491a87d48799da81f191bdb6b'}
const REVV = {symbol: "REVV",name: "REVV", address: '0x557b933a7c2c45672b610f8954a3deb39a51a8ca'}
const CBT = {symbol: "CBT",name: "CommerceBlock Token", address: '0x076c97e1c869072ee22f8c91978c99b4bcb02591'}
const CHAI = {symbol: "CHAI",name: "Chai", address: '0x06af07097c9eeb7fd685c692751d5c66db49c215'}
const CWBTC = {symbol: "CWBTC",name: "cWBTC", address: '0xc11b1268c1a384e55c48c2391d8d480264a3a7f4'}
const MFG = {symbol: "MFG",name: "SyncFab", address: '0x6710c63432a2de02954fc0f851db07146a6c0312'}
const BLT = {symbol: "BLT",name: "Bloom", address: '0x107c4504cd79c5d2696ea0030a8dd4e92601b82e'}
const AXPR = {symbol: "AXPR",name: "aXpire", address: '0xc39e626a04c5971d770e319760d7926502975e47'}
const CMCT = {symbol: "CMCT",name: "Crowd Machine", address: '0x47bc01597798dcd7506dcca36ac4302fc93a8cfb'}
const CHAT = {symbol: "CHAT",name: "ChatCoin", address: '0x442bc47357919446eabc18c7211e57a13d983469'}
const TIME = {symbol: "TIME",name: "chrono.tech", address: '0x6531f133e6deebe7f2dce5a0441aa7ef330b4e53'}
const EKO = {symbol: "EKO",name: "EchoLink", address: '0xa6a840e50bcaa50da017b91a0d86b8b2d41156ee'}
const AMN = {symbol: "AMN",name: "Amon", address: '0x737f98ac8ca59f2c68ad658e3c3d8c8963e40a4c'}
const TRST = {symbol: "TRST",name: "WeTrust", address: '0xcb94be6f13a1182e4a4b6140cb7bf2025d28e41b'}
const PAYX = {symbol: "PAYX",name: "Paypex", address: '0x62a56a4a2ef4d355d34d10fbf837e747504d38d4'}
const EQUAD = {symbol: "EQUAD",name: "Quadrant Protocol", address: '0xc28e931814725bbeb9e670676fabbcb694fe7df2'}
const TWOKEY = {symbol: "2KEY",name: "2key.network", address: '0xe48972fcd82a274411c01834e2f031d4377fa2c0'}
const NTK = {symbol: "NTK",name: "Neurotoken", address: '0x69beab403438253f13b6e92db91f7fb849258263'}
const DAT = {symbol: "DAT",name: "Datum", address: '0x81c9151de0c8bafcd325a57e3db5a5df1cebf79c'}
const SNOV = {symbol: "SNOV",name: "Snovian.Space", address: '0xbdc5bac39dbe132b1e030e898ae3830017d7d969'}
const HMQ = {symbol: "HMQ",name: "Humaniq", address: '0xcbcc0f036ed4788f63fc0fee32873d6a7487b908'}
const ZEROxBTC = {symbol: "0xBTC",name: "0xBitcoin", address: '0xb6ed7644c69416d67b522e20bc294a9a9b405b31'}
const PPP = {symbol: "PPP",name: "PayPie", address: '0xc42209accc14029c1012fb5680d95fbd6036e2a0'}
const FXC  = {symbol: "FXC",name: "Flexacoin", address: '0x4a57e687b9126435a9b19e4a802113e266adebde'}
const ETH12EMACO  = {symbol: "ETH12EMACO",name: "ETH 12 Day EMA Crossover Set", address: '0x2c5a9980b41861d91d30d0e0271d1c093452dca5'}
const PERL = {symbol: "PERL",name: "Perlin", address: '0xeca82185adce47f39c684352b0439f030f860318'}
const TKX = {symbol: "TKX",name: "Tokenize Xchange", address: '0x667102bd3413bfeaa3dffb48fa8288819e480a88'}
const RAE = {symbol: "RAE",name: "Receive Access Ecosystem", address: '0xe5a3229ccb22b6484594973a03a3851dcd948756'}
const SHIP = {symbol: "SHIP",name: "ShipChain", address: '0xe25b0bba01dc5630312b6a21927e578061a13f55'}
const MT = {symbol: "MT",name: "Monarch Token", address: '0x4442556a08a841227bef04c67a7ba7acf01b6fc8'}
const HEX = {symbol: "HEX",name: "HEX", address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'}
const ART = {symbol: "ART",name: "Maecenas", address: '0xfec0cf7fe078a500abf15f1284958f22049c2c7e'}
const PLTC = {symbol: "PLTC",name: "pTokens LTC", address: '0x5979f50f1d4c08f9a53863c2f39a7b0492c38d0f'}
const REAL = {symbol: "REAL",name: "Real Estate Asset Ledger", address: '0x9214ec02cb71cba0ada6896b8da260736a67ab10'}
const EDG = {symbol: "EDG",name: "Edgeless", address: '0x08711d3b02c8758f2fb3ab4e80228418a7f8e39c'}
const SWT = {symbol: "SWT",name: "Swarm City", address: '0xb9e7f8568e08d5659f5d29c4997173d84cdf2607'}
const MYB = {symbol: "MYB",name: "MyBit Token", address: '0x5d60d8d7ef6d37e16ebabc324de3be57f135e0bc'}
const CSAI = {symbol: "CSAI",name: "cSAI", address: '0xf5dce57282a584d2746faf1593d3121fcac444dc'}
const SAFE = {symbol: "SAFE",name: "yieldfarming.insure", address: '0x1aa61c196e76805fcbe394ea00e4ffced24fc469'}
const FTX = {symbol: "FTX",name: "FintruX", address: '0xd559f20296ff4895da39b5bd9add54b442596a61'}
const FUEL = {symbol: "FUEL",name: "Etherparty", address: '0xea38eaa3c86c8f9b751533ba2e562deb9acded40'}
const LUN = {symbol: "LUN",name: "Lunyr", address: '0xfa05a73ffe78ef8f1a739473e462c54bae6567d9'}
const ADT = {symbol: "ADT",name: "adToken", address: '0xd0d6d6c5fe4a677d343cc433536bb717bae167dd'}
const BTCPLUSPLUS = {symbol: "BTC++",name: "PieDAO BTC++", address: '0x0327112423f3a68efdf1fcf402f6c5cb9f7c33fd'}
const ELEC = {symbol: "ELEC",name: "Electrify.Asia", address: '0xd49ff13661451313ca1553fd6954bd1d9b6e02b9'}
const TIE = {symbol: "TIE",name: "Ties.DB", address: '0x999967e2ec8a74b7c8e9db19e039d920b31d39d0'}
const JET = {symbol: "JET",name: "Jetcoin", address: '0x8727c112c712c4a03371ac87a74dd6ab104af768'}
const ESH = {symbol: "ESH",name: "Switch", address: '0xd6a55c63865affd67e2fb9f284f87b7a9e5ff3bd'}
const STX = {symbol: "STX",name: "Stox", address: '0x006bea43baa3f7a6f765f14f10a1a1b08334ef45'}
const EVC = {symbol: "EVC",name: "EventChain", address: '0xb62d18dea74045e822352ce4b3ee77319dc5ff2f'}
const USDS = {symbol: "USDS",name: "Stably Dollar", address: '0xa4bdb11dc0a2bec88d24a3aa1e6bb17201112ebe'}
const LMY = {symbol: "LMY",name: "Lunch Money", address: '0x66fd97a78d8854fec445cd1c80a07896b0b4851f'}
const FOTA = {symbol: "FOTA",name: "Fortuna", address: '0x4270bb238f6dd8b1c3ca01f96ca65b2647c06d3c'}
const FLIXX = {symbol: "FLIXX",name: "Flixxo", address: '0xf04a8ac553fcedb5ba99a64799155826c136b0be'}
const CRED = {symbol: "CRED",name: "Verify", address: '0x672a1ad4f667fb18a333af13667aa0af1f5b5bdd'}
const RVT = {symbol: "RVT",name: "Rivetz", address: '0x3d1ba9be9f66b8ee101911bc36d3fb562eac2244'}
const BNTY = {symbol: "BNTY",name: "Bounty0x", address: '0xd2d6158683aee4cc838067727209a0aaf4359de3'}
const USDPLUSPLUS = {symbol: "USD++ ",name: "PieDAO USD++", address: '0x9a48bd0ec040ea4f1d3147c025cd4076a2e71e3e'}
const WAND = {symbol: "WAND",name: "WandX", address: '0x27f610bf36eca0939093343ac28b1534a721dbb4'}
const XBP = {symbol: "XBP",name: "BlitzPredict", address: '0x28dee01d53fed0edf5f6e310bf8ef9311513ae40'}
const FND = {symbol: "FND",name: "FundRequest", address: '0x4df47b4969b2911c966506e3592c41389493953b'}
const CRAD = {symbol: "CRAD",name: "CryptoAds Marketplace", address: '0x608f006b6813f97097372d0d31fb0f11d1ca3e4e'}
const SOAR = {symbol: "SOAR",name: "Soarcoin", address: '0xd65960facb8e4a2dfcb2c2212cb2e44a02e2a57e'}
const DALC = {symbol: "DALC",name: "Dalecoin", address: '0x07d9e49ea402194bf48a8276dafb16e4ed633317'}

const ERC20TOKENS = [ABT,ABYSS,ADAI,ADT,ADX,AGI,ALINK,AMB,AMN,AMPL,ANT,APPC,ART,AST,AUC,AXPR,BAL,BAND,BAT,BCDT,BLT,BLZ,BNT,BNTY,BRD,BTU,BUSD,BZRX,C20,CBAT,CBC,CBT,CDAI,CDT,CEL,CELR,CETH,CHAI,CHAT,CMCT,CND,COV,CRAD,CREAM,CRED,CREP,CRPT,CRV,CSAI,CUSDC,CVC,CWBTC,CZRX,DAI,DALC,DAT,DATA,DENT,DGTX,DIA,DLT,DMG,DNT,DOCK,DPI,DRGN,DRT,DTA,EDG,EKO,ELEC,ELF,ENG,ENJ,EQUAD,ESH,ETH12EMACO,EURS,EVC,EVX,FET,FLIXX,FND,FOAM,FOTA,FRONT,FTX,FUEL,FUN,FXC,GEN,GHST,GNO,GNT,GRID,GVT,HEX,HMQ,HOT,HYDRO,IDRT,JET,KEEP,KNC,LEND,LINK,LMY,LOC,LOOM,LPT,LRC,LUN,MANA,MATIC,MCO,MDA,MEME,MET,MFG,MKR,MLN,MT,MTA,MTH,MTL,MYB,NEC,NEXO,NGC,NKN,NMR,NPXS,NTK,OAX,OCN,OGN,OMG,ONEUP,OST,PAX,PAXG,PAY,PAYX,PERL,PICKLE,PLR,PLTC,PMA,PNK,POE,POLY,POWR,PPP,PPT,PRE,PRO,QKC,QNT,QSP,RAE,RCN,RDN,REAL,REN,RENBTC,RENBTC,REP,REQ,REVV,RLC,RPL,RSR,RVT,SAFE,SAI,SALT,SAND,SBTC,SENT,SHIP,SNGLS,SNM,SNOV,SNT,SNX,SOAR,SPANK,SRN,STORJ,STX,SUSD,SUSHI,SWT,SXP,TAU,TEL,THETA,TIE,TIME,TKN,TKX,TNB,TRB,TRST,TRYB,TUSD,TWOKEY,UBT,UMA,UNI,UPP,USDC,USDPLUSPLUS,USDS,UTK,VIB,VIBE,WABI,WAND,WINGS,WPR,WTC,XAUR,XBP,YAM,YAMv2,YFI,ZAP,ZEROxBTC,ZRX,tBTC,BTCPLUSPLUS]

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
  