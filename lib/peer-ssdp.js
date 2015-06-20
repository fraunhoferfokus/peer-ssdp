/*******************************************************************************
 * 
 * Copyright (c) 2013 Louay Bassbouss, Fraunhofer FOKUS, All rights reserved.
 * 
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3.0 of the License, or (at your option) any later version.
 * 
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 * 
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library. If not, see <http://www.gnu.org/licenses/>. 
 * 
 * AUTHORS: Louay Bassbouss (louay.bassbouss@fokus.fraunhofer.de)
 *     Martin Lasak (martin.lasak@fokus.fraunhofer.de)
 *     Alexander Futasz (alexander.futasz@fokus.fraunhofer.de)
 *
 ******************************************************************************/

var dgram = require('dgram');
var events = require('events');
var os = require('os');
var util = require('util');
var SSDP_ADDRESS = "239.255.255.250";
var SSDP_PORT = 1900;
var SSDP_HOST = SSDP_ADDRESS + ":" + SSDP_PORT;
var MAX_AGE = "max-age=1800";
var TTL = 128;
var MX = 2;
var ALIVE = "ssdp:alive";
var BYEBYE = "ssdp:byebye";
var UPDATE = "ssdp:update";
var TYPE_M_SEARCH = "M-SEARCH";
var TYPE_NOTIFY = "NOTIFY";
var TYPE_200_OK = "200 OK";

var Peer = function (options) {
    this.mcSocket = null;
    this.ucSocket = null;
};
util.inherits(Peer, events.EventEmitter);

/**
 * start the SSDP listening
 */
Peer.prototype.start = function () {
    var socketMap = {};
    var self = this;
    var ready = 0;
    var close = 0;
    var onMessage = function (msg, address) {
        var req = deserialize(msg);
        self.emit(req.type, req.headers, address);
    };
    var onListening = function () {
        self.emit("listening");
    };
    var onClose = function (err) {
        if (--ready <= 0) {
            self.emit("close", err);
            ready = 0;
        }
    };
    var onError = function (err) {
        self.emit("error", err);
    };
    var onReady = function () {
        if (++ready == 1) {
            self.emit("ready");
        }
    };

    //bind handler: socket, this-object, [interface address], isMulticast
    var onBind = function (s, t, a, isMc) {
        return function () {
            s.setMulticastTTL(TTL);
            if (isMc) {
                s.setBroadcast(true);
                (a) ? s.addMembership(SSDP_ADDRESS, a) : s.addMembership(SSDP_ADDRESS);
                s.setMulticastLoopback(true);
            }
            onReady.call(t);
        }
    };

    // Multicast Socket(s) Handling
    var socketHandling = function (adr) {
        socketMap[adr] = {
            unicast: null,
            multicast: null
        };
        // unicast socket
		var uc = null;
		try {
			// this is for version >= 0.12.x
			uc = dgram.createSocket({
				type: "udp4",
				reuseAddr: true
			});
		}
		catch(e){
			// error is throws if version < 0.12.x. 
			uc = dgram.createSocket("udp4");
		}
        uc.on("message", onMessage);
        uc.on("listening", onListening);
        uc.on('error', onError);
        uc.on('close', onClose);
        uc.bind(50000 + Math.floor(Math.random() * 1000), adr, onBind(uc, this, adr, false));
        socketMap[adr].unicast = uc;
		// multicast socket
		var mc = null;
		try {
			// this is for version >= 0.12.x
			mc = dgram.createSocket({
				type: "udp4",
				reuseAddr: true
			});
		}
		catch(e){
			// error is throws if version < 0.12.x. 
			mc = dgram.createSocket("udp4");
		}
        mc.on("message", onMessage);
        mc.on("listening", onListening);
        mc.on('error', onError);
        mc.on('close', onClose);
        mc.bind(SSDP_PORT, onBind(mc, this, adr, true));
        socketMap[adr].multicast = mc;
    }
    var interfaces = os.networkInterfaces();
    for (var i in interfaces) {
        for (var j = 0; j < interfaces[i].length; j++) {
            var intr = interfaces[i][j];
            if (intr.family == 'IPv4' && !intr.internal) {
                socketHandling(intr.address);
            }
        }
    }

    var interfaceDiscoHandle = setInterval(function () {
        var currentInterfaces = {};
        var interfaces = os.networkInterfaces();
        for (var i in interfaces) {
            for (var j = 0; j < interfaces[i].length; j++) {
                var intr = interfaces[i][j];
                if (intr.family == 'IPv4' && !intr.internal) {
                    currentInterfaces[intr.address] = true;
                }
            }
        }
        for (var i in currentInterfaces) {
            if (socketMap[i] && socketMap[i].multicast && socketMap[i].unicast) {
                //console.log("known address: ",i);
            } else {
                //console.log("new address, so create socket for it: ",i);
                socketHandling(i);
            }
        }
        for (var i in socketMap) {
            if (socketMap[i] && socketMap[i].multicast && socketMap[i].unicast && !currentInterfaces[i]) {
                //console.log("known old address, so remove this socket: ",i);
                socketMap[i].multicast.close();
                delete socketMap[i].multicast;
                socketMap[i].unicast.close();
                delete socketMap[i].unicast;
            }
        }
    }, 15000);
    this.stopInterfaceDisco = function () {
        (interfaceDiscoHandle) ? clearInterval(interfaceDiscoHandle) : 0;
    };


    this.mcSocket = {
        close: function () {
            for (var i in socketMap) {
                if (socketMap[i].multicast) {
                    socketMap[i].multicast.close();
                    delete socketMap[i].multicast;
                }
            }
        },
        send: function (processMessageCallback) {
            var processMessage = (typeof  processMessageCallback == "function");
            for (var i in socketMap) {
                if (socketMap[i].multicast) {
                    var args = processMessage? processMessageCallback(i): arguments;
                    socketMap[i].multicast.send.apply(socketMap[i].multicast, args);
                }
            }
        }
    };
    this.ucSocket = {
        close: function () {
            for (var i in socketMap) {
                if (socketMap[i].unicast) {
                    socketMap[i].unicast.close();
                    delete socketMap[i].unicast;
                }
            }
        },
        send: function (processMessageCallback) {
            var processMessage = (typeof  processMessageCallback == "function");
            for (var i in socketMap) {
                if (socketMap[i].unicast) {
                    var args = processMessage? processMessageCallback(i): arguments;
                    socketMap[i].unicast.send.apply(socketMap[i].unicast, args);
                }
            }
        }
    };
    return this;
};
/**
 * close the SSDP listening.
 */
Peer.prototype.close = function () {
    this.stopInterfaceDisco();
    this.mcSocket && this.mcSocket.close();
    this.ucSocket && this.ucSocket.close();
};

/**
 * notify a SSDP message
 * @param headers
 * @param  callback
 */
Peer.prototype.notify = function (headers, callback) {
    headers['HOST'] = headers['HOST'] || SSDP_HOST;
    headers['CACHE-CONTROL'] = headers['CACHE-CONTROL'] || MAX_AGE;
    headers['EXT'] = headers['EXT'] || "";
    headers['DATE'] = headers['DATE'] || new Date().toUTCString();
    var processMessageCallback = function (networkInterfaceAddress) {
        var msg = new Buffer(serialize(TYPE_NOTIFY + " * HTTP/1.1", headers,networkInterfaceAddress));
        return [msg, 0, msg.length, SSDP_PORT, SSDP_ADDRESS, function (err, bytes) {
            (typeof callback == "function") && callback.call(null, err, bytes);
        }];
    };
    var msg = new Buffer(serialize(TYPE_NOTIFY + " * HTTP/1.1", headers));
    this.mcSocket.send(processMessageCallback);
};

/**
 * notify an SSDP alive message
 */
Peer.prototype.alive = function (headers, callback) {
    headers['NTS'] = ALIVE;
    this.notify(headers, callback);
};

/**
 * notify an SSDP byebye message
 */
Peer.prototype.byebye = function (headers, callback) {
    headers['NTS'] = BYEBYE;
    this.notify(headers, callback);
};

/**
 * notify an SSDP update message
 */
Peer.prototype.update = function (headers, callback) {
    headers['NTS'] = UPDATE;
    this.notify(headers, callback);
};

/**
 * 
 */
Peer.prototype.search = function (headers, callback) {
    headers['HOST'] = headers['HOST'] || SSDP_HOST;
    headers['MAN'] = '"ssdp:discover"';
    headers['MX'] = headers['MX'] || MX;
    var processMessageCallback = function (networkInterfaceAddress) {
        var msg = new Buffer(serialize(TYPE_M_SEARCH + " * HTTP/1.1", headers, networkInterfaceAddress));
        return [msg, 0, msg.length, SSDP_PORT, SSDP_ADDRESS, function (err, bytes) {
            (typeof callback == "function") && callback.call(null, err, bytes);
        }];
    };
    this.ucSocket.send(processMessageCallback);
};

/**
 * 
 */
Peer.prototype.reply = function (headers, address, callback) {
    headers['HOST'] = headers['HOST'] || SSDP_HOST;
    headers['CACHE-CONTROL'] = headers['CACHE-CONTROL'] || MAX_AGE;
    headers['EXT'] = headers['EXT'] || "";
    headers['DATE'] = headers['DATE'] || new Date().toUTCString();
    var processMessageCallback = function (networkInterfaceAddress) {
        var msg = new Buffer(serialize("HTTP/1.1 " + TYPE_200_OK, headers, networkInterfaceAddress));
        return [msg, 0, msg.length, address.port, address.address, function (err, bytes) {
            (typeof callback == "function") && callback.call(null, err, bytes);
        }];
    };
    this.ucSocket.send(processMessageCallback);
};

var serialize = function (head, headers,networkInterfaceAddress) {
    var result = head + "\r\n";

    Object.keys(headers).forEach(function (n) {
        result += n + ": " + headers[n] + "\r\n";
    });
    result += "\r\n";
    if(networkInterfaceAddress){
        result = result.replace(/{{networkInterfaceAddress}}/g, networkInterfaceAddress);
    }

    return result;
};

var deserialize = function (msg) {
    var lines = msg.toString().split('\r\n');
    var line = lines.shift();
    var headers = {};
    var type = null;
    if (line.match(/HTTP\/(\d{1})\.(\d{1}) (\d+) (.*)/)) {
        type = "found";
    } else {
        var t = line.split(' ')[0]
        type = (t == TYPE_M_SEARCH) ? "search" : (t == TYPE_NOTIFY ? "notify" : null);
    }
    lines.forEach(function (line) {
        if (line.length) {
            var vv = line.match(/^([^:]+):\s*(.*)$/);
            if(vv && vv.length ===3){
                headers[vv[1].toUpperCase()] = vv[2];
            }
        }
    });
    return {
        type: type,
        headers: headers
    };
};

/**
 * create an new SSDP Peer
 */
exports.createPeer = function (options) {
    var peer = new Peer(options);
    return peer;
};

exports.ALIVE = ALIVE;
exports.BYEBYE = BYEBYE;
exports.UPDATE = UPDATE;