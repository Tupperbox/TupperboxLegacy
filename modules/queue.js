const Eris = require("eris");
const bot = new Eris.Client("Bot " + process.env.DISCORD_TOKEN);

const reqps = 30;
console.log("Loaded queue");
let queue = [];
module.exports = req => {
    queue.push(req);
    if(queue.length > 500) queue = queue.slice(50);
};

async function dequeue() {
    if(queue.length > 0) {
        let msg = queue.pop();
        await bot.deleteMessage(msg.channelID, msg.messageID);
    }
    setTimeout(dequeue, 1000/reqps);
}

setTimeout(dequeue, 1000/reqps);