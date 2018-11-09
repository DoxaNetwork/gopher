import express from 'express';
import bodyParser from 'body-parser'
import cors from 'cors'
import Datastore from 'nedb'
import Web3 from 'web3'

const faucetAccount = '0xd45e8cbb5a04c5e98ceb29d8ad9147ee0d0f3ec2';

const app = express(),
      sentFundsdb = new Datastore({ filename: './sentFunds', autoload: true }),
      provider = new Web3.providers.HttpProvider('http://localhost:8545/'),
      web3 = new Web3(provider);

app.use(cors());
app.use(bodyParser.json());


app.post('/api/request-funds/', async function(req, res) {
  const isValidRequest = (req, res) => {
      // Check the request body has at least an address.
      if (!req.body || !req.body.address || !web3.utils.isAddress(req.body.address)) {
        // Not a valid address.
        res.status(400);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({
          error: {
            id: 'no-address',
            message: 'Request must have an address.'
          }
        }));
        return false;
      }
      return true;
    };
  console.log("valid request: " + isValidRequest(req, res))

  // get address from request
  const requestAccount = req.body.address;

    // check that we have not sent to this address before
  const previouslySent = await getTransactionsFromDatabase(requestAccount);
  if (previouslySent.length) {
    console.log('previously requested')
    res.status(400);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
      error: {
        id: 'duplicate-address',
        message: 'Address must be unique.'
      }
    }));
  } else {
    let transaction;
    try {
      console.log('attempting to send')
      // send to this address
      transaction = await web3.eth.sendTransaction({
        from: faucetAccount, 
        to:requestAccount, 
        value:web3.utils.toWei('1', 'ether'), 
        gasLimit: 21000, 
      // check this gasPrice
        gasPrice: 5000000000})
    } catch(e) {
      console.log(e)
      console.log('failed to send ether to: ' + requestAccount);
      res.status(400);
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({
        error: {
          id: 'send-failed',
          message: 'Transaction send failure'
        }
      }));
    }

    // save this to db
    const transactionId = transaction['transactionHash'];
    try {
      await saveTransactionToDatabase({requestAccount, transactionId});
    } catch(e) {
      console.log('failed to save transaction to db' + requestAccount);
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ data: { success: true } }));
  }
})


function getTransactionsFromDatabase(address) {
    console.log("attempting to load transactions from db");

    return new Promise(function(resolve, reject) {
      // todo search by address here
        sentFundsdb.find({requestAccount: address}, function (err, docs) {
            if (err) {
                console.log("error:" + err)
                reject(err);
                return;
            }
            resolve(docs);
        });
    })
}

function saveTransactionToDatabase(transaction) {
  console.log("transaction save attempted")
  return new Promise(function(resolve, reject) {
    sentFundsdb.insert(transaction, function(err, newDoc) {
      if (err) {
        console.log("error:" + err)
        reject(err);
        return;
      }

      resolve(newDoc._id);
    });
  });
};

app.listen(5001, () => console.log('Facuet up and listening on port 5001'))
