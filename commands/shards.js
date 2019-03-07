module.exports = {
	permitted: (msg) => { return msg.author.id === process.env.DISCORD_OWNERID; },
	execute: (bot, msg, args, cfg) => {
        if(msg.author.id != bot.owner) return;
        let sh = msg.channel.guild.shard;
        process.send({name:"postStats",channelID:msg.channel.id});
	}
};