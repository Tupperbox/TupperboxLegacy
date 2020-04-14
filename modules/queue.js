const Eris = require("eris");
const bot = new Eris.Client("Bot " + process.env.DISCORD_TOKEN);

const reqps = 100;
console.log("Loaded queue");
let queue = [];
module.exports = req => {
    queue.push(req);
    if(queue.length > 500) queue = queue.slice(50);
    setTimeout(dequeue, 1000/reqps);
};

async function dequeue() {
    if(queue.length > 0) {
        //console.log("Queue size: " + queue.length);
        let msg = queue.pop();
        bot.deleteMessage(msg.channelID, msg.messageID).catch(console.log);
        setTimeout(dequeue, 1000/reqps);
    }
}