module.exports = {
    postStats: (wrk,msg,shrd) => {
        console.log("postStats");
        if(!msg.channelID) return;
        shrd.eris.createMessage(msg.channelID,"test");
    }
}