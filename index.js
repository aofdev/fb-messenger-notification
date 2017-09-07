const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();
const admin = require("firebase-admin");
var serviceAccount = require("./key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "",
  storageBucket: ""
});
const Token = ''
const AccToken = '';
app.set('port',(process.env.PORT || 5000))

app.use(bodyParser.urlencoded({extended:false}))
app.use(bodyParser.json())

app.get('/',function(req,res){
        res.send('Hello facebook!')
})


app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === Token) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);          
  }  
});

app.post('/webhook', function (req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function(event) {
        if (event.message) {
          receivedMessage(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});
  
function receivedMessage(event) {
    var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;

  console.log("Received message for user %d and page %d at %d with message:", 
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;
  var messageImage ="";
  if (messageText) {

    // If we receive a text message, check to see if it matches a keyword
    // and send back the example. Otherwise, just echo the text we received.
    switch (messageText) {
      case 'generic':
        sendGenericMessage(senderID);
        break;
      case 'posts':
      sendPostsMessage(senderID);
      break;
      default:
        sendTextMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
   
    messageAttachments.forEach(function(messageAttachment){
       messageImage = messageAttachment.payload.url;
    })
    // sendTextMessage(senderID, "Message with attachment received");
    sendImageMessage(senderID,messageImage);
  }
}


function sendPostsMessage(recipientId){
  const dbRef = admin.database().ref().child('posts');
  dbRef.off();
  dbRef.on('child_added', snap => {
    const valD = snap.val();
     const bucket = admin.storage().bucket();
      const file = bucket.file("posts/thumb_"+valD.image);
      file.getSignedUrl({
          action: 'read',
          expires: '03-17-2025'
      }).then(signedUrls =>{
        var messageData = {
          recipient: {
            id: recipientId
          },
          message: {
            attachment: {
              type: "template",
              payload: {
                template_type: "generic",
                elements: [{
                  title: valD.topic,
                  subtitle: valD.detail,
                  item_url: "https://.firebaseapp.com",               
                  image_url: signedUrls[0],
                  buttons: [{
                    type: "web_url",
                    url: "https://.firebaseapp.com",
                    title: "Open Web URL"
                  }],
                }]
              }
            }
          }
        }; 
        callSendAPI(messageData);
      });
  });
}

function sendGenericMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "rift",
            subtitle: "Next-generation virtual reality",
            item_url: "https://www.oculus.com/en-us/rift/",               
            image_url: "http://messengerdemo.parseapp.com/img/rift.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/rift/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for first bubble",
            }],
          }, {
            title: "touch",
            subtitle: "Your Hands, Now in VR",
            item_url: "https://www.oculus.com/en-us/touch/",               
            image_url: "http://messengerdemo.parseapp.com/img/touch.png",
            buttons: [{
              type: "web_url",
              url: "https://www.oculus.com/en-us/touch/",
              title: "Open Web URL"
            }, {
              type: "postback",
              title: "Call Postback",
              payload: "Payload for second bubble",
            }]
          }]
        }
      }
    }
  };  

  callSendAPI(messageData);
}
function sendImageMessage(recipientId,messageImage){
  console.log('sendImageMessage');
   var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
     "attachment":{
       "type": "image",
       "payload": {
         "url": messageImage
       }
     }
    }
  };

  callSendAPI(messageData);
}
function sendTextMessage(recipientId, messageText) {
  var messageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: messageText
    }
  };
  var options = { method: 'POST',
  url: 'https://onesignal.com/api/v1/notifications',
  headers: 
   { 'postman-token': 'e0df771b-494f-fed8-2cbf-0008a2487eed',
     'cache-control': 'no-cache',
     'content-type': 'application/json',
     authorization: 'Basic OTg5ODg5YjAtOGM1OS00MzczLWJiYTEtNmI2MTIxMGZiMWRl' },
  body: 
   { app_id: '5ad5b87e-2f41-4c13-99f1-9583aa02a55f',
     contents: { en:  messageText },
     included_segments: [ 'All' ] },
  json: true };

request(options, function (error, response, body) {
  if (error) throw new Error(error);

  console.log(body);
});

  callSendAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: { access_token:  AccToken},
    method: 'POST',
    json: messageData

  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent generic message with id %s to recipient %s", 
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
    }
  });  
}

app.listen(app.get('port'), function(){
    console.log('running on port', app.get('port'))
})