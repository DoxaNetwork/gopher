import express from 'express';
import bodyParser from 'body-parser'
import cors from 'cors'
import Datastore from 'nedb'
import webpush from 'web-push'
import Web3 from 'web3'

import freqJSON from '../32Daily/build/contracts/DoxaHub.json';
import factories from '../32Daily/build/factories/freqs.json';

const publishAccount = '0x0b64e7dcb7d1580f8898c78610b38e71ddc79236';

const app = express(),
      db = new Datastore({ filename: './subscriptions', autoload: true }),
      sentFundsdb = new Datastore({ filename: './sentFunds', autoload: true }),
      provider = new Web3.providers.HttpProvider('http://localhost:8545/'),
      web3 = new Web3(provider),
      vapidKeys = {
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


async function getContract(freq) {
  let contractJSON = freqJSON;
  const networkId = await web3.eth.net.getId();
  const address = factories[freq]['hub'];
  const contract = new web3.eth.Contract(contractJSON.abi, address);
  return contract;
}

async function publish(freq) {
  console.log(`${freq} - publishing now`)
  const contract = await getContract(freq);
  // const gasEstimate = await contract.methods.publish().estimateGas({from: '0xd45e8cbb5a04c5e98ceb29d8ad9147ee0d0f3ec2'});
  let result;
  try {
    result = await contract.methods.publish().send({from: publishAccount, gas: 8000029});
  } catch(e) {
    console.log("error: " + e)
  }

  // must catch an error here and retry

  const event = result.events["Published"];
  if (event) {
    console.log(`${freq} - new item published`);
    const owner = event.returnValues.owner;
    const version = event.returnValues.version;
    const content = event.returnValues.content;
    await publishNotification(JSON.stringify({freq, owner}));
  }
  return result;
}

async function setNextPublish(freq) {
  const contract = await getContract(freq);
  const nextPublishTime = await contract.methods.nextPublishTime().call();
  const nextPublishDate = new Date(nextPublishTime * 1000);
  const currentTime = new Date();

  let msec = nextPublishDate.getTime() - currentTime.getTime();

  console.log(`${freq} - publishing in ${(msec/(1000*60)).toFixed(2)} mins`);
  setTimeout(async function() {
    await publish(freq);
    await setNextPublish(freq);
  }, msec + 1000)
}

setNextPublish('freq1');
setNextPublish('freq2');
setNextPublish('freq3');


async function publishNotification(dataToSend) {
  const subscriptions = await getSubscriptionsFromDatabase()

  for (let i = 0; i < subscriptions.length; i++) {
    const subscription = subscriptions[i];
    try {
      await triggerPushMsg(subscription, dataToSend);
    } catch(err) {
      console.log(`error sending push to ${subscription}`)
      console.log(err)
    }
  }
}

const triggerPushMsg = async function(subscription, dataToSend) {
  try {
    webpush.sendNotification(subscription, dataToSend);
  } catch(err) {
    if (err.statusCode === 410) {
      return deleteSubscriptionFromDatabase(subscription._id);
    } else {
      console.log('Subscription is no longer valid: ', err);
    }
  }
};

app.post('/save-subscription/', async function (req, res) {
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

app.listen(5000, () => console.log('Publisher up and listening on port 5000'))
