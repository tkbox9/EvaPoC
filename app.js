/*-----------------------------------------------------------------------------
A simple Language Understanding (LUIS) bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
 * Bot Storage: This is a great spot to register the private state storage for your bot. 
 * We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
 * For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
 * ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureWebJobsStorage = process.env['AzureWebJobsStorage'] || 'DefaultEndpointsProtocol=https;AccountName=evaassitant8b51;AccountKey=h5xR2UHCgWDMvo16tROco9URicHVcYk5R7gQco1Qs7CAk27kuzH8PpV838zFUlzuspvz4+zXQ3kI1BswRuCNsA==;';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, azureWebJobsStorage);
var tableStorage = new botbuilder_azure.AzureBotStorage({
    gzipData: false
}, azureTableClient);

// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send('You reached the default message handler. You said \'%s\'.', session.message.text);
});

bot.set('storage', tableStorage);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId || '6a326155-f029-44ba-8d05-1941627a433e';
var luisAPIKey = process.env.LuisAPIKey || '6b7d8940721e447d9105e4aea60d261b';
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v2.0/apps/' + luisAppId + '?subscription-key=' + luisAPIKey;

// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);


// Add a dialog for each intent that the LUIS app recognizes.
// See https://docs.microsoft.com/en-us/bot-framework/nodejs/bot-builder-nodejs-recognize-intent-luis 

// Add first run dialog
// Welcome message for Node.js bot
bot.on('conversationUpdate', function (message) {
    if (message.membersAdded) {
        message.membersAdded.forEach(function (identity) {
            if (identity.id == message.address.bot.id) {
                // Bot is joining conversation
                // - For WebChat channel you'll get this on page load.
                var reply = new builder.Message()
                    .address(message.address)
                    .text("Hi my name is Eva and I'm here to help you to find the perfect insurance for you and your family, go ahead and ask me what I can do...");
                bot.send(reply);
            }
        });
    }
});



bot.dialog('GreetingDialog',
    (session) => {
        session.send('You reached the Greeting intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Greeting'
});


bot.dialog('QuickQuote', [
    function (session, args, next) {

        var intent = args.intent;
        var age = builder.EntityRecognizer.findEntity(intent.entities, 'builtin.age');
        var personName = builder.EntityRecognizer.findEntity(intent.entities, 'builtin.personName');
        var status = builder.EntityRecognizer.findEntity(intent.entities, 'status');
        var profession = builder.EntityRecognizer.findEntity(intent.entities, 'profession');

        var quickQuote = session.dialogData.quickQuote = {
            age: age ? age.entity : null,
            personName: personName ? personName.entity : null,
            status: status ? status.entity : null,
            profession: profession ? profession.entity : null
        };

        if (!quickQuote.age) {
            builder.Prompts.text(session, 'Sorry didnt get your age. What is your age?');
        } else {
            next();
        }
    },
    function (session, results, next) {
        var quickQuote = session.dialogData.quickQuote;
        if (results.response) {
            quickQuote.age = results.response;
        }
        if (!quickQuote.status) {
            builder.Prompts.text(session, 'Great.. whats your marital status?');
        } else {
            next();
        }
    },
    function (session, results, next) {
        var quickQuote = session.dialogData.quickQuote;
        if (results.response) {
            quickQuote.status = results.response;
        }
        if (!quickQuote.profession) {
            builder.Prompts.text(session, 'What do you do?');
        } else {
            next();
        }
    },
    function (session, results) {
        var quickQuote = session.dialogData.quickQuote;
        if (results.response) {
            quickQuote.profession = results.response;
        }
        session.send('Great, just one moment while I compute all the info..');
        var msg = new builder.Message(session).addAttachment(createAnimationCard(session, 'https://media.giphy.com/media/F77lbfwEAnYNG/giphy.gif'));
        session.send(msg);
        session.sendTyping();



        session.endDialog('People similar to you usually are interested in these products...');

        var msg = new builder.Message(session);
        msg.attachmentLayout(builder.AttachmentLayout.carousel)
        msg.attachments([
            new builder.HeroCard(session)
            .title("Product 1")
            .subtitle("Info about product 1")
            .text("General Product estimate based on a few questions")
            .images([builder.CardImage.create(session, 'https://s3-eu-west-1.amazonaws.com/eva4work/images/pricing.png')])
            .buttons([
                builder.CardAction.imBack(session, "I want to learn more about Pricing", "Learn More")
            ]),        
            new builder.HeroCard(session)
            .title("Product 2")
            .subtitle("Info about product 2")
            .text("General Product questioning")
            .images([builder.CardImage.create(session, 'https://s3-eu-west-1.amazonaws.com/eva4work/images/pricing.png')])
            .buttons([
                builder.CardAction.imBack(session, "I want to learn more about Pricing", "Learn More")
            ]),
          
        ]);

        session.endDialog('Why dont you create a quote here? Click here..');


    }
]).triggerAction({
    matches: 'QuickQuote'
});



bot.dialog('Pricing',
    (session) => {
        session.send('Great lets have you started...');

        setTimeout(() => {
            session.sendTyping();
            session.send('Can you tell me a bit about yourself? Dont be shy....');
            session.send('Okay, I start.. My name is Eva and Im 34 years old, single with no kids and I work as digital assitant ');
            setTimeout(() => {
                session.sendTyping();
                session.send('Now is your turn...');
            }, 2000);
        }, 3000);
        session.endDialog();
    }
).triggerAction({
    matches: 'Pricing'
});

bot.dialog('HelpDialog',
    (session) => {
        session.send('Glad you ask... Look :)');
        var msg = new builder.Message(session).addAttachment(createAnimationCard(session, 'http://media2.giphy.com/media/FiGiRei2ICzzG/giphy.gif'));
        session.send(msg);
        session.sendTyping();

        setTimeout(function () {
            session.send("Also, I can help with questions about...");
            var msg = new builder.Message(session);
            msg.attachmentLayout(builder.AttachmentLayout.carousel)
            msg.attachments([
                new builder.HeroCard(session)
                .title("Product")
                .subtitle("Info about product")
                .text("General pricing estimate based on a few questions")
                .images([builder.CardImage.create(session, 'https://s3-eu-west-1.amazonaws.com/eva4work/images/pricing.png')])
                .buttons([
                    builder.CardAction.imBack(session, "I want to learn more about Pricing", "Learn More")
                ]),
                new builder.HeroCard(session)
                .title("Payouts and Claims")
                .subtitle("Everything you need to know about payouts and claims")
                .text("I can easly answer questions about payouts and lastest status for your claim")
                .images([builder.CardImage.create(session, 'https://s3-eu-west-1.amazonaws.com/eva4work/images/payouts.png')])
                .buttons([
                    builder.CardAction.imBack(session, "I want to know more about Payouts and Claims", "Learn More")
                ]),
                new builder.HeroCard(session)
                .title("Beneficiaries")
                .subtitle("Ask me anything about beneficiaries ")
                .text("Let me help you with your beneficiaries questions and how we can better serve you ")
                .images([builder.CardImage.create(session, 'https://s3-eu-west-1.amazonaws.com/eva4work/images/benefitiaries.png')])
                .buttons([
                    builder.CardAction.imBack(session, "I want to know more about Payouts and Claims", "Learn More")
                ]),
                new builder.HeroCard(session)
                .title("Terms and Conditions")
                .subtitle("Your data and privacy is very important to us ")
                .text("Let me know hown I can help you be sure that your data is always safe with me")
                .images([builder.CardImage.create(session, 'https://s3-eu-west-1.amazonaws.com/eva4work/images/privacy.png')])
                .buttons([
                    builder.CardAction.imBack(session, "I want to know more about Data and Privacy", "Learn More")
                ])

            ]);
            session.send(msg);
        }, 3000);


        session.endDialog();
    }
).triggerAction({
    matches: 'Help'
})

bot.dialog('CancelDialog',
    (session) => {
        session.send('You reached the Cancel intent. You said \'%s\'.', session.message.text);
        session.endDialog();
    }
).triggerAction({
    matches: 'Cancel'
});



//helpers
function createAnimationCard(session, url) {
    return new builder.AnimationCard(session)
        .media([{
            profile: 'gif',
            url: url
        }]);

    /*
    function createAnimationCard(session) {
        return new builder.AnimationCard(session)
            .title('')
            .subtitle('Your bots — wherever your users are talking')
            .text('Build and connect intelligent bots to interact with your users naturally wherever they are, from text/sms to Skype, Slack, Office 365 mail and other popular services.')
            .media([{
                profile: 'gif',
                url: 'http://media2.giphy.com/media/FiGiRei2ICzzG/giphy.gif'
            }]);
    */

}