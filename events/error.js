module.exports = bot => {
	bot.on("error", (err,id) => console.error(`(Shard ${id})`,err));
};