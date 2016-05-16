/************Music Bot**************
Developer: Tyler Ricketts (Brayzure)
Github: Soon
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
	inter: null
};

// Launch bot
var client = new Discord.Client();
client.loginWithToken(secret.token);
//End Setup

// Begin Listeners
client.on("ready", e => {
	console.log("Music Bot is ready to go!");
	interval();
});

client.on("message", message =>{
	if(message.content[0] == settings.commandLiteral){
		var end = message.content.indexOf(" ",2);
		if(end == -1){
			end = message.content.length;
		}
		var commandName = message.content.substring(1,end);
		if(settings.commands[commandName]){
			console.log("[LOG] Command "+ settings.commandLiteral + commandName + " invoked by " + message.author.username);
			var args = message.content.split(" ");
			args.splice(0,1);
			var status = commands[commandName].check(message);
			console.log("[STATUS] " + status);
			if(status == "OK"){
				commands[commandName].run(message,args);
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
			console.log("[LOG] Command " + commandName + " does not exist!");
		}
	}
});
// End Listeners

// Begin Utilities
// Save settings
function save(){
	fs.writeFile("./src/settings.json",JSON.stringify(settings, null, 4),function(err){
		if(err){console.log("[ERROR] Settings couldn't be saved!");}
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
	clear: new function (){
		this.staff = settings.commands.clear.staff,
		this.cooldown = settings.commands.clear.cooldown,
		this.voice = settings.commands.clear.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			settings.queue = [];
			save();
			message.channel.sendMessage("Queue cleared!");
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
			\n`$np:` Displays the currently playing song.\
			\n`$add {search term}:` Searches YouTube for the search term. Can also directly link a url.\
			\n`$queue:` Displays the next songs, up to 15.\
			\n`$shuffle:` Shuffles the queue.\
			\n`$join:` Bot joins Radio voice channel. Only staff can move it to another channel.\
			\n`$stop:` Stops playback and queues up next song.\
			\n\n`Staff Commands`\
			\n`$addplaylist {link}:` Adds the first 50 songs of a playlist.\
			\n`$setvolume {float level}:` Sets the volume of the bot. Default is 0.1. Do NOT set to higher than 0.25 unless you want to piss off everyone.\
			\n`$clear:` Clears the queue. Staff only command.\
			\n`$forceskip:` Skips the song.\
			\n`$leave:` Forces bot to leave the voice channel.");
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
			
		}
	},
	help: new function (){
		this.staff = settings.commands.join.staff,
		this.cooldown = settings.commands.join.cooldown,
		this.voice = settings.commands.join.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			message.channel.sendMessage("`Help`\
			\nFirst, make sure the bot is in the Fury Radio channel. If it isn't, join the voice channel and type `$join` in $music.\
			\nYou can add music by typing `$add {search term}` to automatically search YouTube for your video. Type `$play` to start playing from the queue.\
			\nDon't like a song that is playing? Type `$skip` to vote to skip the song. You can see upcoming songs with `$queue`. If the bot isn't online, yell at Brayzure.\
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
		}
	},
	leave: new function (){
		this.staff = settings.commands.leave.staff,
		this.cooldown = settings.commands.leave.cooldown,
		this.voice = settings.commands.leave.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			clearInterval(local.inter);
			if (local.currentChannel){
				client.voiceConnection.destroy();
				message.channel.sendMessage("Leaving the voice channel, goodbye!");
			}
			local.nowPlaying = null;
			local.currentChannel = null;
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
			message.channel.sendMessage("Beginning playback. Enjoy your music!");
			client.voiceConnection.setVolume(0.1);
			playNext();
			local.stopped = 0;
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
			settings.textDefault = args[0];
			message.channel.sendMessage("Set default text channel.");
			save();
		}
	},
	setvoicedefault:  new function (){
		this.staff = settings.commands.setvoicedefault.staff,
		this.cooldown = settings.commands.setvoicedefault.cooldown,
		this.voice = settings.commands.setvoicedefault.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			settings.voiceDefault = args[0];
			message.channel.sendMessage("Set default voice channel.");
			save();
		}
	},
	setvolume:  new function (){
		this.staff = settings.commands.setvolume.staff,
		this.cooldown = settings.commands.setvolume.cooldown,
		this.voice = settings.commands.setvolume.voiceOnly,
		this.lastUsed = 0,
		this.check = check,
		this.run = function(message, args){
			client.voiceConnection.setVolume(parseInt(args[0]));
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
			
			if(message.author.voiceChannel){
				if(message.author.voiceChannel.id == "152518535292125184"){
					for(var g = 0; g < local.skipVotes.length; g++){
						if(uid == local.skipVotes[g]){
							flag = 1;
						}
					}
					if(!flag){
						local.skipVotes.push(uid);
						var members = local.currentChannel.members.length - 1;
						console.log("Skip ratio: " + parseFloat(local.skipVotes.length/members).toString());
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
				message.channel.sendMessage("Stopping playback. You can resume it, starting with the next song, with `#play`!");
				local.nowPlaying = null;
				client.setStatus("online",null,function(err){
					if(err){throw err;}
				});
			}
			else{
				message.channel.sendMessage("Playback isn't started.");
			}
		}
	}
}

// Check if current song is done playing
function interval(){
	if(!local.stopped && settings.queue.length > 0 && !client.voiceConnection.playing){
		playNext();
	}
	local.inter = setTimeout(interval,2000);
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
				console.log("Sorry, I couldn't get audio track for that video. No result pushed.");
				console.log(videoTitle);
				return;
			}
			
			var audioURL = $('#main div.clip table tbody tr th span.fa-music').first().parent().parent().find('td a').attr('href');
			
			if(audioURL ==  undefined){
				console.log("No audio version found.")
				callback(0);
				return;
			}
			
			settings.queue.push({
				title: videoTitle,
				user: result.user.username,
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
	if(settings.queue.length > 0){
		setTimeout(function() {
			client.voiceConnection.playFile(settings.queue[0].url,{},function(){
				console.log("Playing " + settings.queue[0].title);
				local.nowPlaying = settings.queue[0].title;
				skipvotes = [];
				client.setStatus("online",settings.queue[0].title,function(err){
					if(err){throw err;}
				});
				
				settings.queue.shift();
				save();
			});
		}, 250);
	}
	else{
		console.log("No more songs!");
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
	if(settings.voiceDefault && this.voice == 1){
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