peer-ssdp 
=========

peer-ssdp is a simple Node.js module implementing the Simple Service Discovery Protocol SSDP as described in the
[UPnP Device Architecture specification, Section 1](http://www.upnp.org/specs/arch/UPnP-arch-DeviceArchitecture-v1.1.pdf)

Setup
=====

  * use `npm install peer-ssdp` to install the module.
  * run example with `node node_modules/peer-ssdp/test/ssdp-test.js`
  
Usage
=====
Peer is an `EventEmitter` so you can use the common `EventEmitter` API to subscribe to specific events.

```javascript
var ssdp = require("peer-ssdp");
var peer = ssdp.createPeer();
var interval;
/**
 * handle peer ready event. This event will be emitted after `peer.start()` is called.
 */
peer.on("ready",function(){
	// handle ready event
	// send ssdp:alive messages every 1s
	// {{networkInterfaceAddress}} will be replaced before
	// sending the SSDP message with the actual IP Address of the corresponding
	// Network interface. This is helpful for example in UPnP for LOCATION value
	interval = setInterval(function(){
		peer.alive({
			ST: "upnp:rootdevice",
			SERVER: "...",
			ST: headers.ST,
			USN: "...",
			LOCATION: "http://{{networkInterfaceAddress}}/device-desc.xml",
		});
	}, 1000);
	// shutdown peer after 10 s and send a ssdp:byebye message before
	setTimeout(function(){
		clearInterval(interval);
		// Close peer. Afer peer is closed the `close` event will be emitted.
		peer.close();
	}, 10000);
});

// handle SSDP NOTIFY messages. 
// param headers is JSON object containing the headers of the SSDP NOTIFY message as key-value-pair. 
// param address is the socket address of the sender
peer.on("notify",function(headers, address){
	// handle notify event
});

// handle SSDP M-SEARCH messages. 
// param headers is JSON object containing the headers of the SSDP M-SEARCH message as key-value-pair. 
// param address is the socket address of the sender
peer.on("search",function(headers, address){
	// handle search request
	// reply to search request
	// Also here the {{networkInterfaceAddress}} will be replaced before
  // sending the SSDP message with the actual IP Address of the corresponding
  // Network interface.
	peer.reply({
		ST: "upnp:rootdevice",
		SERVER: "...",
		ST: headers.ST,
		USN: "...",
		LOCATION: "http://{{networkInterfaceAddress}}/device-desc.xml",
	},address);
});

// handle SSDP HTTP 200 OK messages. 
// param headers is JSON object containing the headers of the SSDP HTTP 200 OK  message as key-value-pair. 
// param address is the socket address of the sender
peer.on("found",function(headers, address){
	// handle found event
});

// handle peer close event. This event will be emitted after `peer.close()` is called.
peer.on("close",function(){
	// handle close event
});

// Start peer. Afer peer is ready the `ready` event will be emitted.
peer.start();
``` 

License
=======

Free for non commercial use released under the GNU Lesser General Public License v3.0
, See LICENSE file.

Contact us for commecial use famecontact@fokus.fraunhofer.de

Copyright (c) 2013 Fraunhofer FOKUS
