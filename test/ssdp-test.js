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

var os = require('os');
var ssdp = require("../lib/peer-ssdp");
var SERVER = os.type() + "/" + os.release() + " UPnP/1.1 famium/0.0.1";
var uuid = "6bd5eabd-b7c8-4f7b-ae6c-a30ccdeb5988";
var peer = ssdp.createPeer();

peer.on("ready", function () {
    console.log("ready");
    onReady();
}).on("notify", function (headers, address) {
    console.log("receive notify message from ", address);
    console.log(headers);
    console.log("=======================");
}).on("search", function (headers, address) {
    console.log("receive search request message from ", address);
    console.log(headers);
    console.log("=======================");
    var ST = headers.ST;
    var headers = {
        LOCATION: "http://{{networkInterfaceAddress}}/upnp/devices/6bd5eabd-b7c8-4f7b-ae6c-a30ccdeb5988/desc.xml",
        SERVER: SERVER,
        ST: "upnp:rootdevice",
        USN: "uuid:" + uuid + "::upnp:rootdevice",
            'BOOTID.UPNP.ORG': 1
    };
    console.log("reply to search request from ", address);
    console.log(headers);
    console.log("=======================");
    peer.reply(headers, address);
}).on("found", function (headers, address) {
    console.log("receive found message from ", address);
    console.log(headers);
    console.log("=======================");
}).on("close", function () {
    console.log("close");
}).start();

var onReady = function () {
    console.log("notify SSDP alive message");
    peer.alive({
        NT: "upnp:rootdevice",
        USN: "uuid:" + uuid + "::upnp:rootdevice",
        LOCATION: "http://{{networkInterfaceAddress}}/upnp/devices/6bd5eabd-b7c8-4f7b-ae6c-a30ccdeb5988/desc.xml",
        SERVER: SERVER
    });

    console.log("search for rootdevices");
    peer.search({
        ST: "upnp:rootdevice"
    });

    setTimeout(function () {
        console.log("notify SSDP byebye message");
        peer.byebye({
            NT: "upnp:rootdevice",
            USN: "uuid:" + uuid + "::upnp:rootdevice",
            LOCATION: "http://{{networkInterfaceAddress}}/upnp/devices/6bd5eabd-b7c8-4f7b-ae6c-a30ccdeb5988/desc.xml",
            SERVER: SERVER
        }, function () {
            peer.close();
        });
    }, 10000);
};