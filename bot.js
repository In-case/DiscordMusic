/************Music Bot**************
Developer: Tyler Ricketts (Brayzure)
Github: https://github.com/Brayzure/DiscordMusic
***********************************/

// Begin Setup
var settings = require("./src/settings.json"); // Persistent settings
	secret = require('./src/secret.json');
	Discord = require("discord.js");
	google = require('googleapis');
	youtube = google.youtube('v3');
	path = require('path');
	http = require('http');
	fs = require("fs");
	request = require("request");

// Local settings, they don't persist after shutdown	
var local = {
	stopped: true,
	nowPlaying: null,
	skipVotes: [],
	currentChannel: null,
	inter: null,
	transition: 0
};

// Launch bot
var client = new Discord.Client();
client.loginWithToken(secret.token);
//End Setup

// Begin Listeners
client.on("ready", e => {
	log("log", "Music Bot is ready to go!");
});

client.on("error", e => {
	console.log("[ERROR]", e);
});

client.on("disconnected", e => {
	log("error", "Lost connection to the Discord server. This is bad.");
	if(local.inter){
		clearInterval(local.inter);
		local.inter = null;
	}
	client.loginWithToken(secret.token);
});

client.on("message", message =>{
	if(message.content[0] == settings.commandLiteral){
		var end = message.content.indexOf(" ",2);
		if(end == -1){
			end = message.content.length;
		}
		var commandName = message.content.substring(1,end);
		if(settings.commands[commandName]){
			log("log", "Command " + settings.commandLiteral + commandName + " invoked by " + message.author.username);
			var args = message.content.split(" ");
			args.splice(0,1);
			var status = commands[commandName].check(message);
			log("status", status);
			if(status == "OK"){
				commands[commandName].run(message,args);
				commands[commandName].lastUsed = new Date().getTime();
			}
			if(status == "ERR_STAFF"){
				message.channel.sendMessage("You aren't allowed to do that. Try again when you're more awesome!");
			}
			if(status == "ERR_BOT_NO_CHANNEL"){
				message.channel.sendMessage("I'm not in a voice channel, so I can't do that!");
			}
			if(status == "ERR_NOT_IN_DEFAULT_VOICE"){
				message.channel.sendMessage("You aren't in the designated voice channel, move there then try again!");
			}
			if(status == "ERR_NOT_SAME_CHANNEL"){
				message.channel.sendMessage("You aren't in the same voice channel as the bot.");
			}
			if(status == "ERR_USER_NO_CHANNEL"){
				message.channel.sendMessage("You aren't in a voice channel, so I can't do that!");
			}
		}
		else{
			log("error", "Command " + settings.commandLiteral + commandName + " does not exist!");
		}
	}
});
// End Listeners

// Begin Utilities
// Save settings
function save(){
	fs.writeFile("./src/settings.json",JSON.stringify(settings, null, 4),function(err){
		if(err){log("error", "Settings couldn't be saved!");}
	});
}

// Check if user is staff
function isStaff(message){
	var server = message.channel.server;
	var roles = server.rolesOf(message.author);
	for(var q = 0; q < settings.staffRoles.length; q++){
		for(var r = 0; r < roles.length; r++){
			if (settings.staffRoles[q] == roles[r].id){
				return 1;
			}
		}
	}
	return 0;
}

var commands = {
	add: new function (){
		this.staff = settings.commands.add.staff,
		this.cooldown = settings.commands.add.cooldown,
		this.voice = settings.commands.add.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			var q = message.content.substring(5);
			getResult(q, message.author, function(result){
				if(result == null){
					message.channel.sendMessage("No results found.");
				}
				else{
					message.channel.sendMessage("Adding " + result.title + " to the queue!");
					var worked = addVideoToQueue(result,function(worked){
						if(!worked){
							message.channel.sendMessage("The link at http://youtu.be/" + result.id + " does not have an audio version. Directly linking another version should work!");
						}
						else if(settings.autoplay && client.voiceConnection && local.stopped){
							message.channel.sendMessage("Beginning playback. Enjoy your music!");
							client.voiceConnection.setVolume(0.1);
							setTimeout(function(){
								playNext();
							},1000);
							setTimeout(function(){
								local.stopped = 0;
								local.inter = setInterval(interval,5000);
							},2500);
							log("log", "Created interval()");
						}
					});
				}
				
			});
		}
	},
	addplaylist: new function (){
		this.staff = settings.commands.addplaylist.staff,
		this.cooldown = settings.commands.addplaylist.cooldown,
		this.voice = settings.commands.addplaylist.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			var index = message.content.indexOf("?list=")+6;
			if(index != -1){
				var url = message.content.substring(index);
					tempQueue = [];
				console.log(url);
				
				var params = {
					part: 'snippet',
					playlistId: url,
					maxResults: 50,
					auth: secret.key
				}
				
				youtube.playlistItems.list(params, function(err, response){
					if (err) {
						console.log('Encountered error', err);
					}
					else {
						for(var f = 0; f < response.items.length; f++){
							var info = {
								title: response.items[f].snippet.title,
								user: message.author,
								id: response.items[f].snippet.resourceId.videoId
							};
							tempQueue.push(info);
						}
						
						for(var j = 0; j < tempQueue.length; j++){
							addVideoToQueue(tempQueue[j],function(worked){
								/*
								if(!worked){
									console.log("The link at http://youtu.be/" + tempQueue[j].id + " does not have an audio version. Directly linking another version should work!");
								}
								*/
							});
						}
						if(settings.autoplay && client.voiceConnection && local.stopped){
							message.channel.sendMessage("Beginning playback. Enjoy your music!");
							client.voiceConnection.setVolume(0.1);
							playNext();
							setTimeout(function(){
								local.stopped = 0;
								local.inter = setInterval(interval,5000);
							},2500);
							log("log", "Created interval()");
						}
					}
				});
			}
		}
	},
	addstaff: new function (){
		this.staff = settings.commands.addstaff.staff,
		this.cooldown = settings.commands.addstaff.cooldown,
		this.voice = settings.commands.addstaff.voiceOnly,
		this.override = settings.commands.addstaff.permOverride,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			for(var g = 0; g < args.length; g++){
				settings.staffRoles.push(args[g]);
			}
			message.channel.sendMessage("Added " + args.length + " roles to the staff list!");
			save();
		}
	},
	block: new function (){
		this.staff = settings.commands.block.staff,
		this.cooldown = settings.commands.block.cooldown,
		this.voice = settings.commands.block.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			console.log(args);
			for(var m = 0; m < args.length; m++){
				settings.blocked.push(args[m].substring(2,args[m].length-1));
			}
			message.channel.sendMessage("Added " + args.length + " users to the block list!");
			save();
		}
	},
	clear: new function (){
		this.staff = settings.commands.clear.staff,
		this.cooldown = settings.commands.clear.cooldown,
		this.voice = settings.commands.clear.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(args[0]){
				var id = args[0].substring(2,args[0].length-1);
					count = 0;
					len = settings.queue.length;
				for(var z = 0; z < len; z++){
					if(settings.queue[z-count].id == id){
						settings.queue.splice(z-count,z-count+1);
						count++;
					}
				}
				message.channel.sendMessage("Removed " + count + " songs from the queue!");
			}
			else{
				settings.queue = [];
				message.channel.sendMessage("Queue cleared!");
			}
			save();
		}
	},
	commands: new function (){
		this.staff = settings.commands.commands.staff,
		this.cooldown = settings.commands.commands.cooldown,
		this.voice = settings.commands.commands.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			message.channel.sendMessage("`User Commands`\
			\n`" + settings.commandLiteral + "np:` Displays the currently playing song.\
			\n`" + settings.commandLiteral + "add {search term}:` Searches YouTube for the search term. Can also directly link a url.\
			\n`" + settings.commandLiteral + "queue:` Displays the next songs, up to 15.\
			\n`" + settings.commandLiteral + "shuffle:` Shuffles the queue.\
			\n`" + settings.commandLiteral + "join:` Bot joins Radio voice channel. Only staff can move it to another channel.\
			\n`" + settings.commandLiteral + "stop:` Stops playback and queues up next song.\
			\n`" + settings.commandLiteral + "remove {position}:` Removes the song at the listed position from the queue. It must be your song, or you must be staff.\
			\n\n`Staff Commands`\
			\n`" + settings.commandLiteral + "addplaylist {link}:` Adds the first 50 songs of a playlist.\
			\n`" + settings.commandLiteral + "block {user mention}:` Prevents the user mentioned from interacting with the bot at all.\
			\n`" + settings.commandLiteral + "unblock {user mention}:` Removes the block from the mentioned user.\
			\n`" + settings.commandLiteral + "setvolume {float level}:` Sets the volume of the bot. Default is 0.1. Do NOT set to higher than 0.5 unless you want to piss off everyone.\
			\n`" + settings.commandLiteral + "addstaff {roleID}:` Adds the role ID to the list of roles that can use staff commands.\
			\n`" + settings.commandLiteral + "removestaff {roleID}:` Removes the role ID to the list of roles that can use staff commands.\
			\n`" + settings.commandLiteral + "clear:` Clears the queue. Staff only command.\
			\n`" + settings.commandLiteral + "forceskip:` Skips the song.\
			\n`" + settings.commandLiteral + "move {start} {end}:` Moves the song at `start` position to `end` position.\
			\n`" + settings.commandLiteral + "leave:` Forces bot to leave the voice channel.");
		}
	},
	forceskip: new function (){
		this.staff = settings.commands.forceskip.staff,
		this.cooldown = settings.commands.forceskip.cooldown,
		this.voice = settings.commands.forceskip.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(!local.stopped){
				playNext();
				message.channel.sendMessage("Skipping song.");
			}
		}
	},
	forcejoin: new function (){
		this.staff = settings.commands.forcejoin.staff,
		this.cooldown = settings.commands.forcejoin.cooldown,
		this.voice = settings.commands.forcejoin.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			message.author.voiceChannel.join();
			message.channel.sendMessage("Joined your voice channel!");
			local.currentChannel = message.author.voiceChannel;
			setTimeout(function(){
				if(settings.autoplay && client.voiceConnection && local.stopped && settings.queue.length > 0){
					message.channel.sendMessage("Beginning playback. Enjoy your music!");
					client.voiceConnection.setVolume(0.1);
					playNext();
					setTimeout(function(){
						local.stopped = 0;
						local.inter = setInterval(interval,5000);
					},2500);
					log("log", "Created interval()");
				}
			},1000);
		}
	},
	help: new function (){
		this.staff = settings.commands.help.staff,
		this.cooldown = settings.commands.help.cooldown,
		this.voice = settings.commands.help.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			message.channel.sendMessage("`Help`\
			\nFirst, make sure the bot is in the Fury Radio channel. If it isn't, join the voice channel and type `" + settings.commandLiteral + "join` in " + settings.commandLiteral + "music.\
			\nYou can add music by typing `" + settings.commandLiteral + "add {search term}` to automatically search YouTube for your video. Type `" + settings.commandLiteral + "play` to start playing from the queue.\
			\nDon't like a song that is playing? Type `" + settings.commandLiteral + "skip` to vote to skip the song. You can see upcoming songs with `" + settings.commandLiteral + "queue`. If the bot isn't online, yell at Brayzure.\
			\nEnjoy the music!");
		}
	},
	join: new function (){
		this.staff = settings.commands.join.staff,
		this.cooldown = settings.commands.join.cooldown,
		this.voice = settings.commands.join.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			message.author.voiceChannel.join();
			message.channel.sendMessage("Joined your voice channel!");
			local.currentChannel = message.author.voiceChannel;
			setTimeout(function(){
				if(settings.autoplay && client.voiceConnection && local.stopped && settings.queue.length > 0){
					message.channel.sendMessage("Beginning playback. Enjoy your music!");
					client.voiceConnection.setVolume(0.1);
					playNext();
					setTimeout(function(){
						local.stopped = 0;
						local.inter = setInterval(interval,5000);
					},2500);
					log("log", "Created interval()");
				}
			},1000);
		}
	},
	leave: new function (){
		this.staff = settings.commands.leave.staff,
		this.cooldown = settings.commands.leave.cooldown,
		this.voice = settings.commands.leave.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			clearTimeout(local.inter);
			log("log", "Destroyed interval()");
			if (local.currentChannel){
				client.voiceConnection.destroy();
				message.channel.sendMessage("Leaving the voice channel, goodbye!");
			}
			local.nowPlaying = null;
			local.currentChannel = null;
			local.inter = null;
		}
	},
	listchannels: new function (){
		this.staff = settings.commands.listchannels.staff,
		this.cooldown = settings.commands.listchannels.cooldown,
		this.voice = settings.commands.listchannels.voiceOnly,
		this.override = settings.commands.listchannels.permOverride,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			var channels = message.channel.server.channels;
			var str = "`Text Channel List`";
				str2 = "`Voice Channel List`";
			for(var d = 0; d < channels.length; d++){
				if(channels[d].type == "text"){
					str = str + "\n`Name:`" + channels[d].name + " `ID:` " + channels[d].id;
				}
				else{
					str2 = str2 + "\n`Name:`" + channels[d].name + " `ID:` " + channels[d].id;
				}
			}
			
			str = str + "\n\n" + str2;
			message.channel.sendMessage(str);
		}
	},
	listroles: new function (){
		this.staff = settings.commands.listroles.staff,
		this.cooldown = settings.commands.listroles.cooldown,
		this.voice = settings.commands.listroles.voiceOnly,
		this.override = settings.commands.listroles.permOverride,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			var roles = message.channel.server.roles;
			var str = "`Role List`";
			for(var d = 0; d < roles.length; d++){
				if(roles[d].name == "@everyone"){
					str = str + "\n`Name:`" + roles[d].name.substring(1) + " `ID:` " + roles[d].id;
				}
				else{
					str = str + "\n`Name:`" + roles[d].name + " `ID:` " + roles[d].id;
				}
				
			}
			message.channel.sendMessage(str);
		}
	},
	move:  new function (){
		this.staff = settings.commands.move.staff,
		this.cooldown = settings.commands.move.cooldown,
		this.voice = settings.commands.move.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(args.length < 2){
				message.channel.sendMessage("Not enough arguments for the move!");
			}
			else if(args.length > 2){
				message.channel.sendMessage("Too many arguments for the move!");
			}
			else{
				settings.queue.move(args[0]-1,args[1]-1);
				save();
			}
		}
	},
	np:  new function (){
		this.staff = settings.commands.np.staff,
		this.cooldown = settings.commands.np.cooldown,
		this.voice = settings.commands.np.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(local.nowPlaying == null){
				message.channel.sendMessage("Nothing is playing right now!");
			}
			else{
				message.channel.sendMessage("`Now Playing`: " + local.nowPlaying);
			}
		}
	},
	ping:  new function (){
		this.staff = settings.commands.ping.staff,
		this.cooldown = settings.commands.ping.cooldown,
		this.voice = settings.commands.ping.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			message.channel.sendMessage("Pong!");
		}
	},
	play:  new function (){
		this.staff = settings.commands.play.staff,
		this.cooldown = settings.commands.play.cooldown,
		this.voice = settings.commands.play.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(!local.stopped){
				message.channel.sendMessage("Playback has already started!");
			}
			else if(settings.queue.length == 0){
				message.channel.sendMessage("No music on the queue, add some then start playing!");
			}
			else{
				message.channel.sendMessage("Beginning playback. Enjoy your music!");
				client.voiceConnection.setVolume(0.1);
				playNext();
				setTimeout(function(){
					local.stopped = 0;
				},2500);
			}
			
		}
	},
	queue:  new function (){
		this.staff = settings.commands.queue.staff,
		this.cooldown = settings.commands.queue.cooldown,
		this.voice = settings.commands.queue.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			var str;
			if(local.nowPlaying){
				str = "`Now Playing`: " + local.nowPlaying + "\n`Current Queue`";
			}
			else{
				str = "`Current Queue`";
			}
			
			var limit = 15;
				extra = settings.queue.length-limit;
			if(settings.queue.length<15){
				limit = settings.queue.length;
				extra = 0;
			}
			for(var i=0; i<limit; i++){
				var count = i+1
				str = str + "\n`" + count.toString() + ":` " + settings.queue[i].title + " `Added By:` " + settings.queue[i].user;
			}
			if(extra > 0){
				str = str + "\n\n`" + extra.toString() + "` more songs on the queue!";
			}
			message.channel.sendMessage(str);
			}
	},
	removestaff: new function (){
		this.staff = settings.commands.removestaff.staff,
		this.cooldown = settings.commands.removestaff.cooldown,
		this.voice = settings.commands.removestaff.voiceOnly,
		this.override = settings.commands.removestaff.permOverride,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(args.length >= settings.staffRoles.length){
				message.channel.sendMessage("You can't remove ALL staff roles.");
			}
			else{
				for(var g = 0; g < args.length; g++){
					for(var h = 0; h < settings.staffRoles.length; h++){
						if(args[g] == settings.staffRoles[h]){
							settings.staffRoles.splice(h,h+1);
						}
					}
				}
				message.channel.sendMessage("Removed " + args.length + " roles to the staff list!");
				save();
			}
		}
	},
	remove: new function (){
		this.staff = settings.commands.remove.staff,
		this.cooldown = settings.commands.remove.cooldown,
		this.voice = settings.commands.remove.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			var id = message.author.id;
				pos = parseInt(args[0])-1;
			
			if(isStaff(message) || id == settings.queue[pos].id){
				var removed = settings.queue.splice(pos,pos+1);
				message.channel.sendMessage("Removed " + removed[0].title + " from the queue!")
				save();
			}
			else if(!isStaff(message) && id != settings.queue[pos].id){
				message.channel.sendMessage("You must be staff to remove a song you didn't add!");
			}
		}
	},
	setliteral:  new function (){
		this.staff = settings.commands.setliteral.staff,
		this.cooldown = settings.commands.setliteral.cooldown,
		this.voice = settings.commands.setliteral.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			var prev = settings.commandLiteral;
			settings.commandLiteral = args[0];
			message.channel.sendMessage("Changed command literal from `" + prev + "` to `" + settings.commandLiteral + "`.");
			save();
		}
	},
	settextdefault:  new function (){
		this.staff = settings.commands.settextdefault.staff,
		this.cooldown = settings.commands.settextdefault.cooldown,
		this.voice = settings.commands.settextdefault.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(args[0] == "null"){
				settings.textDefault = null;
				message.channel.sendMessage("Cleared default text channel.");
				save();
			}
			else{
				settings.textDefault = args[0];
				message.channel.sendMessage("Set default text channel.");
				save();
			}
		}
	},
	setvoicedefault:  new function (){
		this.staff = settings.commands.setvoicedefault.staff,
		this.cooldown = settings.commands.setvoicedefault.cooldown,
		this.voice = settings.commands.setvoicedefault.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(args[0] == "null"){
				settings.voiceDefault = null;
				message.channel.sendMessage("Cleared default voice channel.");
				save();
			}
			else{
				settings.voiceDefault = args[0];
				message.channel.sendMessage("Set default voice channel.");
				save();
			}
		}
	},
	setvolume:  new function (){
		this.staff = settings.commands.setvolume.staff,
		this.cooldown = settings.commands.setvolume.cooldown,
		this.voice = settings.commands.setvolume.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(parseFloat(args[0]) > 0.5 && args.length == 1){
				message.channel.sendMessage("Cannot set volume higher than 0.5 without the -override tag at the end.");
			}
			if(parseFloat(args[0]) < 0.5 || args[1] == "-override"){
				client.voiceConnection.setVolume(parseFloat(args[0]));
			}
		}
	},
	shuffle: new function (){
		this.staff = settings.commands.shuffle.staff,
		this.cooldown = settings.commands.shuffle.cooldown,
		this.voice = settings.commands.shuffle.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			shuffleArray(settings.queue);
			save();
		}
	},
	skip: new function (){
		this.staff = settings.commands.shuffle.staff,
		this.cooldown = settings.commands.shuffle.cooldown,
		this.voice = settings.commands.shuffle.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			var uid = message.author.id;
				flag = 0;
			
			if(message.author.voiceChannel != null){
				if(message.author.voiceChannel.id == "152518535292125184"){
					for(var g = 0; g < local.skipVotes.length; g++){
						if(uid == local.skipVotes[g]){
							flag = 1;
						}
					}
					if(!flag){
						local.skipVotes.push(uid);
						var members = local.currentChannel.members.length - 1;
						log("log", "Current skip ratio: " + parseFloat(local.skipVotes.length/members).toString());
						if(parseFloat(local.skipVotes.length/members) >= 0.5){
							message.channel.sendMessage("Enough people voted to skip, skipping!");
							playNext();
						}
						else{
							message.channel.sendMessage("Vote skip registered. " + Math.ceil(members/2).toString() + " skip votes are needed, " + local.skipVotes.length + " votes have been submitted!");
						}
					}
				}
				else{
					message.channel.sendMessage("You aren't in the radio channel, so why are you complaining?");
				}
			}
			else{
				message.channel.sendMessage("You must be in the voice channel to vote for a skip!");
			}
		}
	},
	stop: new function (){
		this.staff = settings.commands.stop.staff,
		this.cooldown = settings.commands.stop.cooldown,
		this.voice = settings.commands.stop.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			if(!local.stopped){
				local.stopped = 1;
				client.voiceConnection.stopPlaying();
				message.channel.sendMessage("Stopping playback. You can resume it, starting with the next song, with `" + settings.commandLiteral + "play`!");
				local.nowPlaying = null;
				clearInterval(local.inter);
				local.inter = null;
				log("log", "Destroyed interval()");
				client.setStatus("online",null,function(err){
					if(err){throw err;}
				});
			}
			else{
				message.channel.sendMessage("Playback isn't started.");
			}
		}
	},
	unblock: new function (){
		this.staff = settings.commands.unblock.staff,
		this.cooldown = settings.commands.unblock.cooldown,
		this.voice = settings.commands.unblock.voiceOnly,
		this.override = settings.commands.unblock.permOverride,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			var test = 0;
			for(var g = 0; g < args.length; g++){
				for(var h = 0; h < settings.blocked.length; h++){
					if(args[g].substring(2,args[g].length-1) == settings.blocked[h]){
						settings.blocked.splice(h,h+1);
						test++;
					}
				}
			}
			message.channel.sendMessage("Removed " + test + " users from the block list!");
			save();
		}
	}
}

// Unified command to log to console
function log(type,message){
	var str = type.toUpperCase();
		time = new Date().toTimeString().split(' ').splice(0, 1)[0];
		
	str = str + " [" + time + "] " + message;
	
	console.log(str);
}

// Check if current song is done playing
function interval(){
	if(!local.stopped && settings.queue.length > 0 && !client.voiceConnection.playing && !local.transition7){
		log("log", "Advancing song automatically!");
		playNext();
	}
	else if(!local.stopped && settings.queue.length == 0 && !client.voiceConnection.playing){
		local.stopped = 1;
		log("log", "No more songs!");
		clearInterval(local.inter);
		local.inter = null;
		log("log", "Destroyed interval()!");
		client.setStatus("online",null,function(err){
			if(err){throw err;}
		});
	}
}

// YouTube search
function getResult(q,user,callback){
	var params = { part: 'snippet', q: q, auth: secret.key};
	var str;
	
	youtube.search.list(params, function(err, response) {
		if (err) {
			console.log('Encountered error', err);
		}
		else if(response.items.length == 0){
			result == null;
			callback(result);
			return;
		}
		else {
			var flag = 0;
			var i = 0;
			while(!flag){
				if(response.items[i].id.kind == 'youtube#video'){
					var result = {
						title: response.items[i].snippet.title,
						user: user,
						id: response.items[i].id.videoId
					};
					flag = 1;
					callback(result);
				}
				else{
					i++
				}
			}
		}
	});
}

// Add video to queue
function addVideoToQueue(result,callback) {
	
	var baseURL = "https://savedeo.com/download?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D";
	
	request(baseURL + result.id, function (error, response, body) {
		
		if (!error && response.statusCode == 200) {
			var cheerio = require('cheerio'), $ = cheerio.load(body);
			var videoTitle = $('title').text();
			
			if(videoTitle.indexOf('SaveDeo') != -1) {
				log("error", "Sorry, I couldn't get audio track for that video. No result pushed.");
				return;
			}
			
			var audioURL = $('#main div.clip table tbody tr th span.fa-music').first().parent().parent().find('td a').attr('href');
			
			if(audioURL ==  undefined){
				log("error", "No audio version found.")
				callback(0);
				return;
			}
			
			settings.queue.push({
				title: videoTitle.replace("`", "'"),
				user: result.user.username,
				id: result.user.id,
				url: audioURL
			});
			
			save();
		}
	});
	
	callback(1);
}

// Shuffle given array
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

// Move element from one place to another
Array.prototype.move = function (old_index, new_index) {
    while (old_index < 0) {
        old_index += this.length;
    }
    while (new_index < 0) {
        new_index += this.length;
    }
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this; // for testing purposes
};

// Advance song
function playNext(){
	log("log", "playNext() called!");
	if(settings.queue.length > 0){
		local.transition = 1;
		client.voiceConnection.playFile(settings.queue[0].url,{},function(){
			log("log", "Playing " + settings.queue[0].title);
			local.nowPlaying = settings.queue[0].title;
			skipvotes = [];
			client.setStatus("online",settings.queue[0].title,function(err){
				if(err){throw err;}
			});
			
			settings.queue.shift();
			setTimeout(function(){
				local.transition = 0;
			},5000);
			save();
		});
	}
	else{
		log("log", "No more songs!");
		client.voiceConnection.stopPlaying();
		client.setStatus("online",null,function(err){
				if(err){throw err;}
			});
		local.stopped = 1;
		local.nowPlaying = null;
	}
}

// Check if command should be run
function check(message){
	for(var e = 0; e < settings.blocked.length; e++){
		if(message.author.id == settings.blocked[e] && message.author.id != secret.dev){
			return "ERR_USER_BLOCKED";
		}
	}
	if(this.staff && message.author.id != secret.dev){
		if(!isStaff(message)){
			var flag = 1;
			if(this.override){
				var roles = message.channel.server.rolesOf(message.author);
				for(var s = 0; s < roles.length; s++){
					if(roles[s].hasPermission("manageServer")){
						flag = 0;
					}
				}
			}
			if(flag){
				return "ERR_STAFF";
			}
		}
	}
	if(this.voice == 2){
		// Strict, must be in bot's channel.
		if(local.currentChannel == null){
			return "ERR_BOT_NO_CHANNEL"; // Bot isn't in a channel
		}
		else if(!message.author.voiceChannel){
			return "ERR_USER_NO_CHANNEL"; // User isn't in a channel
		}
		else if(local.currentChannel != message.author.voiceChannel){
			return "ERR_NOT_SAME_CHANNEL"; // User isn't in same channel as bot
		}
	}
	else if(this.voice == 1){
		// Soft, must be in a voice channel
		if(!message.author.voiceChannel){
			return "ERR_USER_NO_CHANNEL"; // User isn't in a channel
		}
	}
	if(settings.textDefault){
		// Must be in channel designated by settings.textDefault
		if(message.channel.id != settings.textDefault){
			return "ERR_NOT_IN_DEFAULT_TEXT"; // Message was not posted in default text channel
		}
	}
	if(settings.voiceDefault && this.voice == 1 && !this.staff){
		var voice = message.author.voiceChannel;
		if(voice){
			if(voice.id != settings.voiceDefault){
				return "ERR_NOT_IN_DEFAULT_VOICE"; // User is not in correct voice channel
			}
		}
	}
	var now = new Date().getTime();
	if(now-this.lastUsed < this.cooldown){
		return "ERR_COOLDOWN"; // Command is still on cooldown
	}
	
	return "OK";
}
// End Utilities