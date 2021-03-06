const express = require('express');
const path = require('path');
const db = require('./server/database');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

require('dotenv').config();
const app = express();

// http://expressjs.com/en/starter/static-files.html
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use('/', express.static(path.join(__dirname, 'views'), {index: false, extensions: ['html']}));
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});
app.use(cookieParser())
app.use(bodyParser.json());
app.use((req, resp, next) => {
  console.log("Request body:", req.body);
  console.log("Cookies:", req.cookies);
  next();
});

//-------------------------------------------------------------//
//------------- AUTHORIZATION === auth-app.js -----------------//
//-------------------------------------------------------------//

function handleError(fn) {
  return async function (request, response) {
    try {
      await fn(request, response);
    } catch (ex) {
      console.error(ex);
      response.end();
    }
  }
}

const auth_app = require('./server/auth-app');
auth_app.init(app);

var SpotifyWebApi = require('spotify-web-api-node');

// The object we'll use to interact with the API
var spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET
});

// Using the Client Credentials auth flow, authenticate our app
spotifyApi.clientCredentialsGrant()
  .then(function (data) {

    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);

  }, function (err) {
    console.log('Something went wrong when retrieving an access token', err.message);
  });

//-------------------------------------------------------------//
//------------------------- API CALLS -------------------------//
//-------------------------------------------------------------//

app.post('/addSong', async function (request, response) {
  const userId = request.cookies.user_id;
  const {trackId} = request.body;
  try {
    await db.addSong(userId, trackId);
    response.send({});
  } catch (ex) {
    response.send({error: true});
  }
  response.end();
});

app.post('/removeSong', async function (request, response) {
  const userId = request.cookies.user_id;
  const {trackId} = request.body;
  let removeSong = await db.removeSong(userId, trackId);
  response.send({});
  response.end();
});

app.post('/reactHappy', async function (request, response) {
  const {trackId, userId} = request.body;
  let reactHappy = await db.reactHappy(userId, trackId);
  response.send({});
  response.end();
});

app.post('/reactSad', async function (request, response) {
  const {trackId, userId} = request.body;
  let reactSad = await db.reactSad(userId, trackId);
  response.send({});
  response.end();
});

app.post('/createPlaylist', async function (request, response) {
  const {user_id, access_token} = request.cookies;
  const spotifyApi = new SpotifyWebApi({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET
  });
  spotifyApi.setAccessToken(access_token);
  const description = "This is an auto generated playlist from your Splash Music session.";
  const playlist = (await spotifyApi.createPlaylist(user_id, "Your Splashed Art!", {'description' : description})).body;

  let songs = await db.listSongs();
  songs.sort((a, b) => b.happy_emotion - a.sad_emotion);
  songs = songs.slice(0, 18);
  const trackIds = songs.map(song => "spotify:track:" + song.track_id);
  await spotifyApi.addTracksToPlaylist(playlist.id, trackIds);

  response.send({});
  response.end();
});

const trackCache = {};
const userCache = {};

async function fetchTracks(ids) {
  if (ids.length === 0) return [];
  const pendingIds = [];
  for (let id of ids) {
    if (trackCache[id]) continue;
    pendingIds.push(id);
  }
  const newTracks = pendingIds.length === 0 ? [] : (await spotifyApi.getTracks(pendingIds)).body.tracks;
  const audioFeatures = pendingIds.length === 0 ? [] : (await spotifyApi.getAudioFeaturesForTracks(pendingIds)).body.audio_features;
  for (let track of newTracks) {
    track.features = audioFeatures.find(feature => feature.id === track.id);
    trackCache[track.id] = track;
  }
  return ids.map(id => trackCache[id]);
}

async function fetchUsers(ids) {
  if (ids.length === 0) return [];

  const pendingIds = [];
  for (let id of ids) {
    if (userCache[id]) continue;
    pendingIds.push(id);
  }
  const newUsers = await Promise.all(pendingIds.map(async id => (await spotifyApi.getUser(id)).body));
  for (let user of newUsers) {
    userCache[user.id] = user;
  }
  return ids.map(id => userCache[id]);
}

app.get('/listSongs', handleError(async function (request, response) {
  const listSongs = await db.listSongs();
  const userIds = Array.from(new Set(listSongs.map(song => song.user_id)));
  const users = await fetchUsers(userIds);
  const trackIds = listSongs.map(song => song.track_id);
  const tracks = await fetchTracks(trackIds);

  const result = listSongs.map(({user_id, track_id, happy_emotion, sad_emotion}) => ({
    track: tracks.find(track => track.id === track_id),
    user: users.find(user => user.id === user_id),
    emotions: {
      happy: happy_emotion,
      sad: sad_emotion
    }
  }));
  response.send(result);
  response.end();
}));

app.post('/search-track', handleError(async function (request, response) {
  const {name} = request.body;
  const data = await spotifyApi.searchTracks('track:' + name, {limit: 5});
  response.send(data.body.tracks.items);
  response.end();
}));

app.post('/track-analysis', handleError(async function (request, response) {
  const {trackId} = request.body;
  const data = await spotifyApi.getAudioFeaturesForTrack(trackId);
  response.send(data.body);
  response.end();
}));

//-------------------------------------------------------------//
//------------------------ WEB SERVER -------------------------//
//-------------------------------------------------------------//


// Listen for requests to our app
// We make these requests from client.js

db.create();
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

// db.close();
