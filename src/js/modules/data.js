var $ = require('jquery');
var Dexie = require('dexie');

var convert = require('./convert');
var fs = require('./filesystem');
var Messaging = require('./messaging');
var Status = require('./status');

/**
 * This script has utilities for working with the data, and is provided
 * as an interface on top of the IndexedDB and FileSystem storage
 * services.
 *
 * Everywhere a replay id is needed, it refers to the replay info id.
 */

/**
 * Clones an object.
 * @param {object} obj - The object to clone.
 * @return {object} - The cloned object.
 */
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Return the index of the first value in the array that satisfies the given
 * function. Same as `findIndex`.
 */
function findIndex(array, fn) {
    for (var i = 0; i < array.length; i++) {
        if (fn(array[i])) {
            return i;
        }
    }
    return -1;
}

/**
 * Return the first value in the array that satisfies the given function. Same
 * functionality as `find`.
 */
function find(array, fn) {
  for (var i = 0; i < array.length; i++) {
    if (fn(array[i])) {
      return array[i];
    }
  }
}

// Initialize FileSystem Replay folder.
fs.createDirectory("savedMovies").then(function () {
    console.log("Saved movies directory created.");
}).catch(function (err) {
    console.error("Error creating saved movies directory: %o.", err);
});

var db = new Dexie("ReplayDatabase");

exports.db = db;

// Initial versions of the database may be either 1 or 2 with
// a 'positions' object store and an empty 'savedMovies' object
// store.
db.version(0.1).stores({
    positions: '',
    savedMovies: ''
});

db.version(0.2).stores({
    positions: '',
    savedMovies: ''
});

// Current version.
db.version(3).stores({
    info: '++id,&replay_id,name,rendered,duration,dateRecorded',
    replay: '++id,&info_id',
    failed_info: '++id,&replay_id',
    failed_replays: '++id,&info_id',
    positions: null,
    savedMovies: null
}).upgrade(function (trans) {
    Status.set("upgrading");
    trans.on('complete', function () {
        console.log("Transaction completed.");
        Status.reset();
    });

    trans.on('abort', function () {
        console.warn("inside transaction abort handler");
        Status.set("upgrade_error");
    });

    trans.on('error', function () {
        console.warn("Inside transaction error handler.");
        Status.set("upgrade_error");
    });
    // Num done.
    var numberDone = 0;
    // Item #.
    var n = 0;
    var numitemsatonce = 50;
    var total;
    // loopfn takes item, cursor, done
    // loopfn shouldn't call anything async if it expects trans to be around.
    // Returns a promise that resolves when complete.
    function fn(table, itemsperloop, loopfn) {
        var total;
        function inner_loop(start) {
            var n = Math.min(itemsperloop, total - start);
            var last = start + itemsperloop >= total;
            var dones = 0;
            var looped = false;
            var donecallfn;
            // Used in case weird synchronous completion case.
            var done = false;
            var err = null;
            var donePromise = new Dexie.Promise(function (resolve, reject) {
                if (!done) {
                    donecallfn = function (err, val) {
                        if (err) {
                            reject(err);
                        } else if (val) {
                            resolve(val);
                        } else {
                            resolve();
                        }
                    };
                } else if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
            // TODO: Change to using then on promise.
            function checkDone(err) {
                if (dones === n && looped) {
                    if (donecallfn) {
                        if (last) {
                            donecallfn(err);
                        } else {
                            donecallfn(err, inner_loop(start + n));
                        }
                    } else {
                        // Shouldn't happen because idb requests are async and there should
                        // be enough time for donecallfn to be set. May cause transaction
                        // lifecycle instability.
                        console.error("Function not set.");
                        done = true;
                    }
                }
            }
            table.offset(start).limit(n).each(function (item, cursor) {
                loopfn(item, cursor, function (err) {
                    dones++;
                    checkDone(err);
                });
            }).then(function () {
                looped = true;
                checkDone();
            });
            return donePromise;
        }

        return table.count().then(function (t) {
            if (!t) {
                return Dexie.Promise.resolve();
            } else {
                total = t;
                return inner_loop(0);
            }
        });
    }


    trans.positions.count().then(function (t) {
        total = t;
        // done err propogates back up.
        fn(trans.positions, 50, function (item, cursor, done) {
            // Skip null values.
            if (item === null) {
                done();
                return;
            }

            var name = cursor.key;
            var i = n++;

            console.log("Iterating item: %d.", i); // DEBUG
            try {
                var data = convert({
                    name: name,
                    data: JSON.parse(item)
                });
                // Save converted replay.
                var replay = data.data;
                var info = generateReplayInfo(replay);
                return trans.info.add(info).then(function (info_id) {
                    console.log("Added info: %d.", i); // DEBUG
                    replay.info_id = info_id;
                    return trans.replay.add(replay).then(function (replay_id) {
                        console.log("Added replay: %d.", i); // DEBUG
                        info.replay_id = replay_id;
                        return trans.info.update(info_id, { replay_id: replay_id }).then(function () {
                            // debugging
                            // Console alert that replay was saved, progress update.
                            Messaging.send("upgradeProgress", {
                                total: total,
                                progress: ++numberDone
                            });
                            console.log("Finished replay: %d (%d).", i, numberDone); // DEBUG
                            done();
                        });
                    });
                });
            } catch(e) {
                console.log("Failed replay: %d.", i); // DEBUG
                // Catch replay conversion or save error.
                //console.warn("Couldn't convert %s due to: %o.", name, e); // DEBUG
                //console.log("Saving %s to failed replay database.", name); // DEBUG
                var failedInfo = {
                    name: name,
                    failure_type: "upgrade_error",
                    timestamp: Date.now(),
                    message: e.message
                };
                return trans.failed_info.add(failedInfo).then(function (info_id) {
                    console.log("Added failed info: %d.", i); // DEBUG
                    var failedReplay = {
                        info_id: info_id,
                        name: name,
                        data: item
                    };
                    return trans.failed_replays.add(failedReplay).then(function (replay_id) {
                        console.log("Added failed replay: %d.", i); // DEBUG
                        return trans.failed_info.update(info_id, { replay_id: replay_id }).then(function () {

                            Messaging.send("upgradeProgress", {
                                total: total,
                                progress: ++numberDone
                            });
                            console.log("Saved failed replay: %d (%d).", i, numberDone); // DEBUG
                            done();
                        });
                    });
                }).catch(function (err) {
                    // TODO: Necessary?
                    // Save error, abort transaction.
                    console.error("Aborting upgrade due to database error: %o.", err);
                    trans.abort();
                    done(Error("error: " + err));
                });
            }
        });
    });
});

/**
 * Call to initialize database.
 */
exports.init = function() {
    // Wait for conversion function to be ready before opening database.
    convert.ready().then(function () {
        return db.open().then(function () {
            // Reset status after applying any upgrades.
            Status.reset();
        }).catch(function (err) {
            console.error("Error opening database: %o.", err);
            // Don't override upgrade error.
            Status.get().then(function (status) {
                console.log("Status: %s.", status);
                if (status !== "upgrade_error" && status !== "upgrading") {
                    Status.set("db_error");
                }
            });
        });
    }).catch(function (err) {
        console.error("Error loading conversion function: %o.", err);
    });
};

/**
 * Generates the replay metadata that is stored in a separate object
 * store.
 * @param {Replay} replay - The replay to generate information for.
 * @return {ReplayInfo} - The information for the replay.
 */
function generateReplayInfo(replay) {
    // Copy replay information.
    // Add player information.
    // Add duration.
    var info = clone(replay.info);
    info.duration = Math.round((1e3 / info.fps) * replay.data.time.length);
    info.players = {};
    // Get player information.
    Object.keys(replay.data.players).forEach(function(id) {
        var player = replay.data.players[id];
        info.players[id] = {
            name: find(player.name, function(v) { return v !== null; }),
            team: find(player.team, function(v) { return v !== null; }),
            id: player.id
        };
    });
    info.rendered = false;
    info.render_id = null;
    info.rendering = false;
    return info;
}

/**
 * Crops a replay to the given start and end frames.
 * @param {Replay} replay - The replay to crop
 * @param {integer} startFrame - The frame to use for the start of the
 *   new replay.
 * @param {integer} endFrame - The frame to use for the end of the new
 *   replay.
 * @return {Replay} - The cropped replay.
 */
function cropReplay(replay, startFrame, endFrame) {
    // Don't do anything if this replay is already the correct size.
    if (startFrame === 0 && endFrame === replay.data.time.length)
        return replay;

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
    var startTime = replay.data.time[startFrame],
        endTime = replay.data.time[endFrame];

    // Crop an array that only contains information for each frame
    // and impacts no later.
    function cropFrameArray(ary) {
        return ary.slice(startFrame, endFrame + 1);
    }

    // Remove events from provided array that occur after the end
    // of the cropped replay, or far enough in advance of the start
    // that they are not relevant.
    function cropEventArray(ary, cutoff) {
        if (typeof cutoff == "undefined") cutoff = null;
        return ary.filter(function(event) {
            return event.time < endTime && (cutoff === null || startTime - event.time < cutoff);
        });
    }

    // Crop the arrays for a player, returning the player or null
    // if this results in the player no longer being relevant.
    function cropPlayer(player) {
        var name = cropFrameArray(player.name);
        var valid = name.some(function(val) {
            return val !== null;
        });
        if (!valid) return null;
        var newPlayer = {
            auth: cropFrameArray(player.auth),
            bomb: cropFrameArray(player.bomb),
            dead: cropFrameArray(player.dead),
            degree: cropFrameArray(player.degree),
            draw: cropFrameArray(player.draw),
            flag: cropFrameArray(player.flag),
            flair: cropFrameArray(player.flair).map(clone), // Necessary to clone?
            grip: cropFrameArray(player.grip),
            id: player.id,
            name: name,
            tagpro: cropFrameArray(player.tagpro),
            team: cropFrameArray(player.team),
            x: cropFrameArray(player.x),
            y: cropFrameArray(player.y)
        };
        if (player.hasOwnProperty("angle")) {
            newPlayer.angle = cropFrameArray(player.angle);
        }
        return newPlayer;
    }

    // Return a dynamic tile with its value array cropped.
    function cropDynamicTile(tile) {
        return {
            x: tile.x,
            y: tile.y,
            value: cropFrameArray(tile.value)
        };
    }

    // Crop array of spawns, taking into account the waiting period
    // for the cutoff.
    function cropSpawns(spawns) {
        return spawns.filter(function(spawn) {
            return spawn.time <= endTime && startTime - spawn.time <= spawn.wait;
        }).map(clone);
    }

    // New, cropped replay.
    var newReplay = {
        info: clone(replay.info),
        data: {
            bombs: cropEventArray(replay.data.bombs, 200),
            chat: cropEventArray(replay.data.chat, 3e4),
            dynamicTiles: replay.data.dynamicTiles.map(cropDynamicTile),
            endTimes: replay.data.endTimes.filter(function(time) {
                return time >= startTime;
            }),
            map: clone(replay.data.map),
            players: {},
            score: cropFrameArray(replay.data.score).map(clone), // necessary to clone?
            spawns: cropSpawns(replay.data.spawns),
            splats: cropEventArray(replay.data.splats),
            time: cropFrameArray(replay.data.time),
            wallMap: clone(replay.data.wallMap)
        },
        version: "2"
    };

    var gameEnd = replay.data.gameEnd;
    if (gameEnd && gameEnd.time <= endTime) {
        newReplay.data.gameEnd = clone(gameEnd);
    }

    // Crop player properties.
    $.each(replay.data.players, function(id, player) {
        var newPlayer = cropPlayer(player);
        if (newPlayer !== null) {
            newReplay.data.players[id] = newPlayer;
        }
    });

    return newReplay;
}

exports.util = {
    cropReplay: cropReplay
};

// Reset the database, for debugging.
exports.resetDatabase = function() {
    db.delete();
};

// Reset the file system, for debugging.
exports.resetFileSystem = function() {

};

// Remove database-specific information from replays.
function cleanReplay(replay) {
    delete replay.id;
    delete replay.info_id;
    return replay;
}

/**
 * @typedef CropRequest
 * @typedef {object}
 * @property {integer} id - The id of the replay to crop.
 * @property {integer} start - The start frame for the new replay.
 * @property {integer} end - The end frame for the new replay.
 * @property {string} [name] - The new name for the replay. If blank, then
 *   a name is made using the name of the replay being cropped + 
 *   " (cropped)".
 */
/**
 * Crop a replay and save it with a new name.
 * @param {CropRequest} info - The information for the cropping.
 * @return {Promise} - Promise object that resolves to a tuple of the form
 *   [replayInfo, replay].
 */
function cropAndSaveReplayAs(request) {
    if (request.name === "") request.name = false;
    return db.transaction("rw", db.info, db.replay, function() {
        return db.replay.where("info_id").equals(request.id).first().then(function (replay) {
            var name = request.name ? request.name : replay.info.name + " (cropped)";
            // TODO: Ensure within bounds of replay and doesn't result in a length 0 replay.
            replay = cropReplay(replay, request.start, request.end);
            replay.info.name = name;
            return saveReplay(replay).then(function (replayInfo) {
                return [replayInfo, replay];
            });
        });
    }).then(function (data) {
        return [data[0], cleanReplay(data[1])];
    });
}

exports.cropAndSaveReplayAs = cropAndSaveReplayAs;

/**
 * Crop a replay and overwrite it.
 * @param {CropRequest} info - The information for the cropping.
 * @return {Promise} - Promise object that resolves to the new replay.
 */
exports.cropAndSaveReplay = function(request) {
    return db.transaction("rw", db.info, db.replay, function() {
        return cropAndSaveReplayAs(request).then(function (data) {
            // Delete original replay.
            return deleteReplays([request.id]).then(function () {
                return data;
            });
        });
    });
};

/**
 * Retrieve the data corresponding to the given replay.
 * @param {integer} id - The info id of the replay to retrieve.
 * @return {Promise} - Promise that resolves to the replay data, or
 *   rejects if the replay is not present or another error occurs.
 */
exports.getReplay = function(id) {
    return db.replay.where("info_id").equals(id).first().then(function (replay) {
        if (replay)
            return cleanReplay(replay);

        throw new Error("No replay found.");
    });
};

/**
 * Iterate over each replay.
 * @param {Arrray.<integer>} ids - Array of ids for the replays to
 *   iterate over.
 * @param {Function} callback - Callback function that receives each of
 *   the replays in turn.
 * @return {Promise} - Promise that resolves when the iteration is
 *   complete.
 */
exports.forEachReplay = function(ids, callback) {
    return db.replay.where("info_id").anyOf(ids).each(function (replay) {
        callback(cleanReplay(replay));
    });
};

/**
 * Get list of replay info for population to menu.
 * @return {Promise} callback - Promise that resolves to an array of
 *   the replay info, or rejects if an error occurred.
 */
exports.getAllReplayInfo = function() {
    return db.info.toArray();
};

/**
 * @typedef {object} ReplaySelector
 * @property {integer} length - The number of replays to select.
 * @property {string} dir - The direction the replays should be sorted
 *   by.
 * @property {integer} start - The offset of the replays from the start
 *   of the sorted list.
 * @property {string} sortedBy - String value referencing an indexed
 *   column in the replays object store. Can be one of "name", "date",
 *   "rendered", or "duration".
 */
/**
 * Retrieve information for a subset of replays.
 * @param {ReplaySelector} data - Information on which replays to
 *   select.
 * @return {Promise} - Promise that resolves to an array with the number
 *   of total replays and the replays that were retrieved.
 */
exports.getReplayInfoList = function(data) {
    var mapped = {
        "name": "name",
        "date": "dateRecorded",
        "rendered": "rendered",
        "duration": "duration"
    };
    var index = mapped[data.sortedBy];
    var collection = db.info.orderBy(index);
    if (data.dir !== "asc") {
        collection.reverse();
    }

    return collection.count().then(function (n) {
        return collection.offset(data.start).limit(data.length).toArray().then(function (results) {
            return [n, results];
        });
    });
};

/**
 * Update the info for a single replay with the provided values.
 * @param {integer} id - The id of the replay info to update.
 * @param {object} update - The update used for the replay info.
 * @return {Promise} - Promise that rejects on error.
 */
exports.updateReplayInfo = function(id, update) {
    // Not allowed to set these.
    var protectedKeys = ["id", "replay_id", "info_id"];
    // These are only set on the info object.
    var dbInfoOnly = ["rendered", "renderId", "players", "duration", "rendering"];

    var keys = Object.keys(update);
    // Ensure no protected keys are set.
    var protectedKeyWrite = keys.some(function (key) {
        return protectedKeys.indexOf(key) !== -1;
    });
    if (protectedKeyWrite)
        return Promise.reject("Cannot write to protected keys!");

    // Object keys that apply to the replay.
    var replayKeys = keys.filter(function(key) {
        return dbInfoOnly.indexOf(key) === -1;
    });

    return db.transaction("rw", db.info, db.replay, function () {
        db.info.update(id, update);
        if (replayKeys.length !== 0) {
            var replayObj = {};
            // Construct update object for info property.
            replayKeys.forEach(function (key) {
                replayObj["info." + key] = update[key];
            });
            db.replay.where("info_id").equals(id).modify(replayObj);
        }
    });
};

/**
 * Saves the replay with the given info and replay values.
 * @param {ReplayInfo} [info] - The info for the replay. If not provided
 *   then it will be generated.
 * @param {Replay} replay - The Replay data.
 * @return {Promise} - Promise that resolves to the info corresponding
 *   to the replay.
 */
function saveReplay(info, replay) {
    if (typeof replay == "undefined") {
        replay = info;
        info = generateReplayInfo(replay);
    }
    return db.transaction("rw", db.info, db.replay, function() {
        return db.info.add(info).then(function (info_id) {
            info.id = info_id;
            replay.info_id = info_id;
            return db.replay.add(replay).then(function (replay_id) {
                info.replay_id = replay_id;
                db.info.update(info_id, { replay_id: replay_id });
                return info;
            });
        });
    });
}

/**
 * See saveReplay.
 */
exports.saveReplay = saveReplay;

/**
 * Rename a replay.
 * @param {integer} id - The id of the info object for the replay to
 *   rename.
 * @param {string} name - A non-empty string to rename the replay to.
 * @return {Promise} - Promise that resolves on successful completion,
 *   or rejects if there was an error.
 */
exports.renameReplay = function(id, name) {
    if (name === "") return Promise.reject("Name cannot be blank.");
    return db.transaction("rw", db.info, db.replay, function() {
        db.info.update(id, { name: name });
        db.replay.where("info_id").equals(id).modify({
            "info.name": name
        });
    });
};

/**
 * Delete replay data, includes the info and raw replay as well as the
 * rendered video, if present.
 * @param {Array.<integer>} ids - The ids of the replays to delete
 * @return {Promise} - Promise that resolves when all ids have been
 *   deleted properly, or rejects on error.
 */
function deleteReplays(ids) {
    return db.transaction("rw", db.info, db.replay, function() {
        return Promise.all(ids.map(function (id) {
            return db.info.get(id).then(function (info) {
                db.info.delete(id);
                db.replay.delete(info.replay_id);
                if (info.rendered) {
                    var movieId = info.renderId || info.render_id;
                    return deleteMovie(movieId);
                }
            });
        }));
    });
}
exports.deleteReplays = deleteReplays;

/**
 * Get movie for a replay.
 * @param {integer} id - The id of the replay to get the movie for.
 * @return {Promise} - Promise that resolves to the file, or rejects if
 *   there is a filesystem error or the movie isn't rendered.
 */
exports.getMovie = function(id) {
    return db.info.get(id).then(function (info) {
        if (!info.rendered)
            throw new Error("Replay is not rendered.");
        var movieId = info.render_id;
        return fs.getFile("savedMovies/" + movieId).then(function (file) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onloadend = function () {
                    var ab = this.result;
                    resolve({
                        name: info.name,
                        data: ab
                    });
                };
                reader.readAsArrayBuffer(file);
            });
        });
    });
};

/**
 * Save a movie to the file system.
 * @param {integer} id - The id of the replay to save the movie for.
 * @param {*} data - The movie data
 * @return {Promise} - The promise that resolves if the saving
 *   completes successfully, or rejects if there is an error.
 */
exports.saveMovie = function(id, data) {
    // Save movie with same id as info.
    var movieId = id;
    return fs.saveFile("savedMovies/" + movieId, data).then(function () {
        fs.readDirectory("savedMovies").then(function (names) {
            console.log("Movie names: %o.", names);
        }).catch(function (err) {
            console.error("Error reading movies: %o.", err);
        });
        return db.info.update(id, {
            rendered: true,
            render_id: movieId
        });
    });
};

/**
 * Delete movie from the file system.
 * @param {(integer|string)} id - The id of the replay to delete the movie for.
 * @param {Promise} - Promise that resolves when the movie has been
 *   deleted successfully.
 */
function deleteMovie(id) {
    var movieId = id;
    return fs.deleteFile("savedMovies/" + movieId).then(function () {
        return fs.readDirectory("savedMovies").then(function (names) {
            console.log("Movie names: %o.", names);
        }).catch(function (err) {
            console.error("Error reading movies: %o.", err);
        });
    });
}

exports.failedReplaysExist = function() {
    return db.failed_info.count().then(function (n) {
        return n > 0;
    });
};

exports.getFailedReplayInfoList = function(data) {
    var collection = db.failed_info.orderBy(":id");
    return collection.count().then(function (n) {
        return collection.offset(data.start).limit(data.length).toArray().then(function (results) {
            return [n, results];
        });
    });
};

// Returns promise that resolves to object with info id key and failed replay
// info value.
exports.getFailedReplayInfoById = function(ids) {
    return db.failed_info.where(":id").anyOf(ids).toArray(function (info) {
        return info.reduce(function (obj, data) {
            obj[data.id] = data;
            return obj;
        }, {});
    });
};

/**
 * Delete replay data, includes the info and raw replay as well as the
 * rendered video, if present.
 * @param {Array.<integer>} ids - The ids of the replays to delete
 * @return {Promise} - Promise that resolves when all ids have been
 *   deleted properly, or rejects on error.
 */
exports.deleteFailedReplays = function(ids) {
    return db.transaction("rw", db.failed_info, db.failed_replays, function() {
        return Promise.all(ids.map(function (id) {
            return db.failed_info.get(id).then(function (info) {
                return Promise.all([
                    db.failed_info.delete(id),
                    db.failed_replays.delete(info.replay_id)
                ]);
            });
        }));
    });
};

/**
 * Retrieve the data corresponding to the given replay.
 * @param {integer} id - The info id of the replay to retrieve.
 * @return {Promise} - Promise that resolves to the replay data, or
 *   rejects if the replay is not present or another error occurs.
 */
exports.getFailedReplay = function(id) {
    return db.failed_replays.where("info_id").equals(id).first().then(function (replay) {
        if (replay)
            return cleanReplay(replay);

        throw new Error("No replay found.");
    });
};

exports.getFailedReplayInfo = function(id) {
    return db.failed_info.get(id).then(function (info) {
        if (info)
            return info;

        throw new Error("No info found.");
    });
};

/**
 * Iterate over each replay.
 * @param {Arrray.<integer>} ids - Array of ids for the replays to
 *   iterate over.
 * @param {Function} callback - Callback function that receives the replay data and id
 *   for each failed replay.
 * @return {Promise} - Promise that resolves when the iteration is
 *   complete.
 */
exports.forEachFailedReplay = function(ids, callback) {
    return db.failed_replays.where("info_id").anyOf(ids).each(function (replay) {
        var info_id = replay.info_id;
        callback(cleanReplay(replay), info_id);
    });
};
