const express = require('express'),
      app = express(),
      bodyParser = require('body-parser'),
      cors = require('cors'),
      Datastore = require('nedb'),
      webpush = require('web-push');
      db = new Datastore({ filename: './datafile', autoload: true });

const vapidKeys = {
    publicKey: 'BMxIuowQ1--yaQr7jFqkV6TLDt8ttKEGXGxKqwJFPkaslR9mvL6CtVfIOTzIRrXFgcjQt5AC08hVsT59jaJ729U',
    privateKey: 'bteELaCCW9Q950OBOnekQ-c7sh7XUAd44TwRtQpqdDQ'
};

webpush.setVapidDetails(
  'mailto:travis@doxa.network',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

app.use(cors());
app.use(bodyParser.json());

const dataToSend = "test!!"

// script that I can turn on
// it will wait until publish time
// then publish by sending to geth
// then go back to sleep
// develop locally then put on aws


// script that can publish
// script that can grab the nextPublishTime from the freqs
// script that can wait until the nextPublishTime before publishing
// put in aws


app.get('/api/send-notification/', function (req, res)  {
    return getSubscriptionsFromDatabase()
      .then(function(subscriptions) {
        let promiseChain = Promise.resolve();

        for (let i = 0; i < subscriptions.length; i++) {
          const subscription = subscriptions[i];
          promiseChain = promiseChain.then(() => {
            return triggerPushMsg(subscription, dataToSend);
          });
        }

        return promiseChain;
      })
      .then(() => {
          res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify({ data: { success: true } }));
        })
        .catch(function(err) {
          res.status(500);
          res.setHeader('Content-Type', 'application/json');
          res.send(JSON.stringify({
            error: {
              id: 'unable-to-send-messages',
              message: `We were unable to send messages to all subscriptions : ` +
                `'${err.message}'`
            }
          }));
        });
});

const triggerPushMsg = function(subscription, dataToSend) {
  return webpush.sendNotification(subscription, dataToSend)
  .catch((err) => {
    if (err.statusCode === 410) {
      return deleteSubscriptionFromDatabase(subscription._id);
    } else {
      console.log('Subscription is no longer valid: ', err);
    }
  });
};

app.post('/api/save-subscription/', async function (req, res) {
    const isValidSaveRequest = (req, res) => {
      // Check the request body has at least an endpoint.
      if (!req.body || !req.body.endpoint) {
        // Not a valid subscription.
        res.status(400);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({
          error: {
            id: 'no-endpoint',
            message: 'Subscription must have an endpoint.'
          }
        }));
        return false;
      }
      return true;
    };
    console.log("valid request:" + isValidSaveRequest(req, res))

    try {
      const subscriptionId = await saveSubscriptionToDatabase(req.body);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({ data: { success: true } }));

    } catch(err) {
      res.status(500);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        error: {
          id: 'unable-to-save-subscription',
          message: 'The subscription was received but we were unable to save it to our database.'
        }
      }));
    }
});

function getSubscriptionsFromDatabase() {
    console.log("attempting to load subscriptions from db");

    return new Promise(function(resolve, reject) {
        db.find({}, function (err, docs) {
            if (err) {
                console.log("error:" + err)
                reject(err);
                return;
            }
            resolve(docs);
        });
    })
}

function saveSubscriptionToDatabase(subscription) {
  console.log("save attempted")
  return new Promise(function(resolve, reject) {
    db.insert(subscription, function(err, newDoc) {
      if (err) {
        console.log("error:" + err)
        reject(err);
        return;
      }

      resolve(newDoc._id);
    });
  });
};

app.listen(5000, () => console.log('Example app listening on port 5000!'))
