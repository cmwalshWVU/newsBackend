
require('dotenv').config({ path: 'variables.env' });

const express = require('express');
const cors = require('cors');
const Pusher = require('pusher');
const NewsAPI = require('newsapi');
const topic = 'news';

const app = express();

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_APP_KEY,
    secret: process.env.PUSHER_APP_SECRET,
    cluster: process.env.PUSHER_APP_CLUSTER,
    encrypted: true,
});

const newsapi = new NewsAPI(process.env.NEWS_API_KEY);

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
                pusher.trigger('news-channel', 'update-news', {
                    articles: response.articles,
                });
                counter += 1;
            })
            .catch(error => console.log(error));
    }, 172800);
}

app.get('/live', (req, res) => {
    const topic = 'crypto';
    var now = new Date();
    now.setHours(now.getHours()-6);
   
    fetchNews(topic, 1, now.toISOString())
        .then(response => {
            res.json(response.articles);
            updateFeed(topic);
        })
        .catch(error => console.log(error));
});

app.post('/redirect', (req, res) => {
    console.log(req)
    console.log(res)
    // fetch('https://us-central1-crypto-watch-dbf71.cloudfunctions.net/token')
    //         .then(response => response.json())
    //         .then(articles => {
    //             dispatch(updateNewsData(articles));
    //         }).catch(error => console.log(error))
});

app.set('port', process.env.PORT || 5000);
const server = app.listen(app.get('port'), () => {
    console.log(`Express running → PORT ${server.address().port}`);
});
