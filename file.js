var _ 					= require('underscore');
var walk    			= require('walk');
var fs 					= require('fs');
var stack 				= require('./stack').main;
var request				= require('request');
var path				= require('path');


function file() {
	
}

// List file by extention in any subdirectory
file.prototype.listFiles = function(dir, ext, callback, options) {
	
	options = _.extend({
		followLinks: 	false
	},options);
	
	var files   = [];
	
	// Walker options
	var walker  = walk.walk(dir, options);
	
	walker.on('file', function(root, stat, next) {
		var parts = stat.name.split(".");
		if (parts[parts.length-1] == ext || !ext) {
			files.push(path.normalize(root + '/' + stat.name));
		}
		next();
	});
	
	walker.on('end', function() {
		callback(files);
	});
}
file.prototype.exists = function(file, callback) {
	fs.exists(file, function(exists) {
		callback(exists);
	});
}
file.prototype.copy = function(from, to, callback) {
	var input = fs.createReadStream(from);
	input.on("end", function () {
		callback();
	});
	input.on("error", function (err) {
		throw err
	});
	input.pipe(fs.createWriteStream(to));
}
file.prototype.getDirContent = function(dirpath, callback) {
	var scope 	= this;
	
	var output 	= {files:[],directories: []};
	
	var opStack = new stack();
	
	// List the files
	opStack.add(function(p, cb) {
		fs.readdir(dirpath, function(err, files) {
			_.each(files, function(file) {
				if(fs.statSync(dirpath+'/'+file).isDirectory()) {
					output.directories.push(file);
				} else {
					output.files.push(file);
				}
			});
			//output.files = files;
			cb();
		});
	}, {});
	/*
	// List the directories
	opStack.add(function(p, cb) {
		var files = fs.readdirSync(dirpath);
		console.log("files",files, dirpath+'/'+file);
		files.forEach(function(file,index){
			if(fs.statSync(dirpath+'/'+file).isDirectory()) {
				output.directories.push(file);
			}
		});
		cb();
	}, {});
	*/
	opStack.process(function() {
		callback(output);
	});
}
file.prototype.isDir = function(filepath) {
	return fs.statSync(filepath).isDirectory()
}
// List file by extention in any subdirectory
file.prototype.listByFilename = function(dir, filename, callback, options) {
	
	options = _.extend({
		followLinks: 	false
	},options);
	
	var files   = [];
	
	// Walker options
	var walker  = walk.walk(dir, options);
	
	walker.on('file', function(root, stat, next) {
		if (stat.name == filename) {
			files.push(root + '/' + stat.name);
		}
		next();
	});
	
	walker.on('end', function() {
		callback(files);
	});
}

// List directories
file.prototype.listDirectories = function(dir, callback) {
	var folders = [];
	var opstack = new stack();
	
	fs.readdir(dir, function (err, files) {
		if (err) throw err;
		
		files.forEach( function (file) {
			opstack.add(function(p, cb) {
				fs.lstat(p.dir+'/'+p.file, function(err, stats) {
					if (!err && stats.isDirectory()) {
						folders.push(p.file);
					}
					cb();
				});
			},{dir:dir,file:file});
		});
		
		opstack.process(function() {
			callback(folders);
		}, false);

	});
}

// File to Object
file.prototype.toObject = function(file, callback) {
	this.read(file, function(data) {
		callback(JSON.parse(data));
	});
}
file.prototype.read = function(file, callback) {
	if (file.substr(0,4) == "http") {
		request.get(file, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				callback(body);
			} else {
				callback(false);
			}
		});
	} else {
		fs.readFile(file, 'utf8', function (err, data) {
			if (err) {
				callback(false);
			} else {
				callback(data);
			}
		});
	}
}
file.prototype.readBinary = function(file, callback) {
	if (file.substr(0,4) == "http") {
		request.get(file, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				callback(body);
			} else {
				callback(false);
			}
		});
	} else {
		fs.readFile(file, function (err, data) {
			if (err) {
				callback(false);
			} else {
				callback(data);
			}
		});
	}
}
file.prototype.append = function(file, content, callback) {
	fs.appendFile(file, content, callback);
}
file.prototype.write = function(file, content, callback) {
	fs.writeFile(file, content, callback);
}
file.prototype.writeJson = function(file, content, callback) {
	fs.writeFile(file, JSON.stringify(content), callback);
}
file.prototype.removeFile = function(file, callback) {
	fs.unlink(file, callback);
}
file.prototype.createPath = function(pathstr, callback) {
	var parts = pathstr.split("/");
	parts = _.compact(parts);
	var pointer = "";
	
	var checkstack = new stack();
	
	_.each(parts, function(part) {
		checkstack.add(function(p, cb) {
			pointer += part+"/";
			fs.exists(pointer, function(exists) {
				if (!exists) {
					fs.mkdir(pointer, 0777, function() {
						cb();
					});
				} else {
					cb();
				}
			});
		},{});
	});
	
	checkstack.process(function() {
		callback();
	}, false);
}
file.prototype.removeDir = function(pathstr, callback) {
	var scope = this;
	fs.exists(pathstr, function(exists) {
		if (!exists) {
			callback();
		} else {
			var files = [];
			if( fs.existsSync(pathstr) ) {
				files = fs.readdirSync(pathstr);
				var opStack = new stack();
				files.forEach(function(file,index){
					var curPath = pathstr + "/" + file;
					
					if(fs.statSync(curPath).isDirectory()) { // recurse
						opStack.add(function(p, cb) {
							scope.removeDir(p.curPath, function() {
								//console.log("Deleting dir\t",p.curPath);
								fs.rmdir(p.curPath, cb);
							});
						},{curPath:curPath});
					} else { // delete file
						opStack.add(function(p, cb) {
							//console.log("Deleting file\t",p.curPath);
							fs.unlink(p.curPath, cb);
						},{curPath:curPath});
						
					}
				});
				opStack.process(function() {
					callback();
				}, false);	// sync
				
			}
		}
	});

}

exports.main = new file();