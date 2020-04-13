const Eris = require("eris");
const bot = new Eris.Client(process.env.DISCORD_TOKEN);

const reqps = 30;

let queue = [];
module.exports = req => {
    queue.push(req);
};

async function dequeue() {
    if(queue.length > 0) {
        let msg = queue.pop();
        await bot.deleteMessage(msg.channelID, msg.messageID);
    }
    setTimeout(dequeue, 1000/reqps);
}

setTimeout(dequeue, 1000/reqps);