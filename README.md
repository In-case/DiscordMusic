# Discord Music
A music bot for your server! Written in node.js

Please note this is an early alpha, and as such has several (known) bugs.

## To-Do List
- Add a way to block users from interacting with the bot.

## Install
### Linux
You got it easy. Linux makes it quite easy to install everything you need. Run these commands.

#### Installing ffmpeg
`sudo add-apt-repository ppa:kirillshkrogalev/ffmpeg-next`
`sudo apt-get update`
`sudo apt-get install ffmpeg`
#### Installing everything else
`cd dir/to/install`
`npm install`

### Windows
If you don't already have your Visual C++ compilers set up, you're gonna have a bad time.
Install the following:
- Microsoft Visual Studio (latest version)
- .NET Framework SDK (should come with Windows Server 2008, install that too)

`cd dir/to/install`
`npm install --msvs_version=2012`

If you see an error saying it can't find an .exe, and to install something, install it and try the package install again. Keep doing this until there are no red errors. It sucks, but that's Microsoft for you.

## Setup
### Step 1: Create a bot account.
You cannot put this bot on your account, as per Discord's guidelines, nor can you put it on a regular user account.
- Head on over to https://discordapp.com/developers/applications/me and select New Application.
- Select a name, then Create Application.
- Make sure you are happy with your name, then select Create a Bot User. Once you've created it, you cannot change the bot's name (though support for that is coming!).
- Click Reveal Token, then copy it. You'll need it for Step 2.

### Step 2: Edit configuration files.
- In the `src` folder, open `secret.json`. Replace `BOT_TOKEN_HERE` with your bot's token, but leave the other entries alone.
- Go back to your Application page, and find your Client ID (should be the first field listed). Replace CLIENT_ID_HERE in https://discordapp.com/oauth2/authorize?client_id=CLIENT_ID_HERE&scope=bot&permissions=0 and open it in your web browser. You need the Manage Server permission in order to do this.

### Step 3: In-Server setup.
By default, the list of permitted roles is empty, and needs populating.
- `!listroles` outputs a list of all roles, and their IDs.
- Any staff member with the Manage Server permission can then do `!addstaff [role1ID] [role2ID]` for any number of space-separated Role IDs. Any user with any of those roles can now perform staff commands.
- `!removestaff [role1ID] [role2ID] [role3ID]` is coming!

By default, any user can make the bot join any channel, and the bot will process and respond to commands in any channel. Changing this is similar to adding staff.
- `!listchannels` outputs a list of channels, sorted by Voice and Text, along with their IDs.
- `!settextdefault [textChannelID]` sets the listed channel as the only text channel commands can be used from.
- `!setvoicedefault [voiceChannelID]` sets the listed channel as the only voice channel a non-staff member can summon the bot to. Staff can still force it to join any channel with `!forcejoin`.
- Both of those can be cleared by passing `null` as the channel ID.

That's about it! You are now ready to enjoy the bot with the following commands.

## Commands
### User Commands
Anyone can use these commands, regardless of role.

`!commands`: Displays commands and descriptions, separated by user and staff commands.

`!ping`: Pong!

`!add [search term]`: Searches YouTube for the search term, then adds the first valid video. `search term` also accepts a video ID, or direct link.

`!join`: Adds the bot to your voice channel, unless a Default Voice Channel is set.

`!play`: Starts playback from the queue.

`!queue`: Displays the currently playing song, first 15 songs of the queue, and how many songs cannot be displayed.

`!skip`: Starts a vote skip. Once at least half of the users in the voice channel vote to skip, the song skips.

`!shuffle`: Shuffles the queue. Does not affect the currently playing song.

`!np`: Displays the currently playing song.

`!stop`: Stops playback of the song, and queues up the next song.

### Staff Commands
Only users with a specified staff role may use these commands.

`!addplaylist [direct link]`: Adds up to fifty songs from the playlist. Playlist must not be private.

`!setvolume [volume]`: Sets the output volume of the bot. defaults to 0.1. DO NOT set higher than 0.25 unless you like angering your server.

`!clear`: Clears the queue. Does not affect currently playing song.

`!move [start] [end]`: Moves the song at `start` position on the queue to `end` position.

`!forceskip`: Forces the song to skip, bypassing voting.

`!forcejoin`: Forces the bot to join your voice channel, if it has permission. Overrides Default Voice Channel.

`!leave`: Forces bot to leave the channel.

`!setliteral [character]`: Sets the Command Literal (the character that precedes every command) to the specified character. Useful if you have multiple bots and wish to avoid conflicts.

## Advanced Customization
Everyone has different needs, so this section describes how to make advanced customization, particularly to `settings.json`. This section is for you if you somehow break something. Before you make ANY changes, stop the bot and backup everything.

This requires beginner to intermediate knowledge of Javascript.

`staffRoles`: Array storing string role IDs that correspond to valid staff roles.

`blocked`: Array storing string user IDs of users that may not interact with the bot. Not yet implemented.

`voiceDefault`: String corresponding to the default voice channel ID, or `null` if disabled.

`textDefault`: String corresponding to the default text channel ID, or `null` if disabled.

`commandLiteral`: Single character representing the character preceding all commands. Support for multi-character literals soon.

`commands`: Object storing settings for every command. Each command takes the following format:

```
"commandName": {
	"staff": false, // Whether or not you need to be staff to execute command
	"cooldown": 1500, // Cooldown in milliseconds
	"voiceOnly": 0, // Int representing if you need to be in a voice channel to execute command. 0: No, 1: Must be in any voice channel, 2: Must be in same voice channel as bot
	"permOverride": 1 // Optional. Bool stating if a user with Manage Server can use command without being in listed staff roles. Mainly used for setup.
},
```

`queue`: Array storing queue'd tracks. Highly recommend you don't mess with it.