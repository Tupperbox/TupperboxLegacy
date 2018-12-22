module.exports = bot => {
	bot.on("shardPreReady", id => console.log(`Shard ${id} pre-ready!`));
};