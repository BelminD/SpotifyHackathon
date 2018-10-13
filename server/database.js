const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(':memory:');

function create() {
  db.serialize(function () {
    db.run("CREATE TABLE users (user_id TEXT, name TEXT)");
    db.run("CREATE TABLE songs (user_id TEXT, track_id TEXT, happy_emotion int DEFAULT 0, sad_emotion int DEFAULT 0, UNIQUE(track_id))");
    db.run("CREATE TABLE playlists (user_id TEXT, playlist_id TEXT)");
  });
}

function listSongs() {
  return new Promise((resolve, reject) => {
    db.all("SELECT user_id, track_id, happy_emotion, sad_emotion FROM songs", function (error, rows) {
      if (error) reject(error);
      resolve(rows);
    });
  });
}

function addSong(userId, trackId) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO songs (user_id, track_id) VALUES (?, ?);`, userId, trackId,
      (error) => {
        if (error) reject(error);
        resolve();
      });
  });
}

function removeSong(userId, trackId) {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM songs WHERE user_id = ? AND track_id = ?;`, userId, trackId,
      (error) => {
        if (error) reject(error);
        resolve();
      });
  });
}

function reactHappy(userId, trackId) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE songs SET happy_emotion = happy_emotion + 1 WHERE user_id = ? AND track_id = ?;`, userId, trackId,
      (error) => {
        if (error) reject(error);
        resolve();
      });
  });
}

function reactSad(userId, trackId) {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE songs SET sad_emotion = sad_emotion + 1 WHERE user_id = ? AND track_id = ?;`, userId, trackId,
      (error) => {
        if (error) reject(error);
        resolve();
      });
  });
}

function close() {
  db.close();
}

module.exports = {create, close, listSongs, addSong, removeSong, reactHappy, reactSad};