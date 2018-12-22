module.exports = bot => {
	bot.on("hello", (trace,id) => console.log(`Shard ${id} hello!`));
};