const express = require('express'),
      app = express(),
      bodyParser = require('body-parser'),
      cors = require('cors'),
      Datastore = require('nedb');

  , db = new Datastore({ filename: './datafile', autoload: true });

app.use(cors());
app.use(bodyParser.json());

app.get('/', (req, res) => res.send('Hello World!'))

app.post('/api/save-subscription/', function (req, res) {
    // console.log(req)
    const isValidSaveRequest = (req, res) => {
        console.log('test')
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

    return saveSubscriptionToDatabase(req.body)
      .then(function(subscriptionId) {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ data: { success: true } }));
      })
      .catch(function(err) {
        res.status(500);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({
          error: {
            id: 'unable-to-save-subscription',
            message: 'The subscription was received but we were unable to save it to our database.'
          }
        }));
      });
});

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
