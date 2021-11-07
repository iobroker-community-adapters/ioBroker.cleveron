/**
 * cleveron adapter
 */

/* jshint -W097 */ // jshint strict:false
/*jslint node: true */
'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const request = require('request');

let adapter;

const server = "https://server.cleveron.ch";
const apipath = "/apiv1/";
const buildingpath = "building?sessionToken=";
const roompath = "/room?sessionToken=";
const devicepath = "/devices?sessionToken=";


var sessiontoken;
var buildingid = [];
var building = "";
var room = "";
var roomid = [];
var devices = new Array();
var rooms = new Array();
var buildings = new Array();
var dataarray = new Array();

let polling;
var firstrun;
var testend;





function startAdapter(options) {
  options = options || {};
  Object.assign(options, {
    name: 'cleveron'
  });

  adapter = new utils.Adapter(options);

  // when adapter shuts down
  adapter.on('unload', function(callback) {
    try {
      adapter.log.info('[END] Stopping CLEVERON adapter...');
      clearTimeout(polling);
      adapter.setState('info.connection', false, true);
      client.end();
      callback();
    } catch (e) {
      adapter.log && adapter.log.warn("[END 7 catch] adapter stopped ")
      callback();
    }
  });

  // is called if a subscribed object changes
  adapter.on('objectChange', function(id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
  });

  // is called if a subscribed state changes
  adapter.on('stateChange', function(id, state) {
    // Warning, state can be null if it was deleted

    try {
      adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));


      if (!id || state.ack) return; // Ignore acknowledged state changes or error states
      id = id.substring(adapter.namespace.length + 1); // remove instance name and id
      //state = state.val;

      // you can use the ack flag to detect if it is status (true) or command (false)
      if (state && !state.ack) {
        adapter.log.info('ack is not set!');
      }
    } catch (e) {
      adapter.log.debug("Fehler Befehlsauswertung: " + e);
    }
  });

  // you can use the ack flag to detect if it is status (true) or command (false)



  // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
  adapter.on('message', function(obj) {
    if (typeof obj === 'object' && obj.message) {
      if (obj.command === 'send') {
        // e.g. send email or pushover or whatever
        adapter.log('send command');

        // Send response in callback if required
        if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
      }
    }
  });

  // is called when databases are connected and adapter received configuration.
  adapter.on('ready', function() {
    adapter.log.info('[START] Starting solarlog adapter');
    adapter.setState('info.connection', true, true);
    main();
    adapter.subscribeStates('*');
  });

  return adapter;
} // endStartAdapter


function main() {

  const user = adapter.config.user;
  const pass = adapter.config.userpw;

  const pollingtime = (adapter.config.poll * 60000) || 300000;

  const loginpath = "login?username=" + user + "&password=" + pass;
  const tokenurl = server + apipath + loginpath;

  try {
    firstrun = true;
    gettoken(tokenurl);

    if (!polling) {
      polling = setTimeout(function repeat() { // poll states every [30] seconds
        gettoken(tokenurl);
        setTimeout(repeat, pollingTime);
      }, pollingTime);
    } // endIf


  } catch (e) {
    adapter.log.warn("Main connect error: " + e);
  }
} //endMain

function gettoken(tokenurl) {
  try {
    var options = {
      url: tokenurl,
      method: 'GET',
      headers: {
        'User-Agent': 'request'
      }
    };
    adapter.log.debug("Options gettoken: " + options);
    request(options, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var info = JSON.parse(body); // info ist ein Objekt
        adapter.log.debug(info);
        adapter.log.debug('SessionToken= ' + info['sessionToken']);
        sessiontoken = info['sessionToken'].toString();
        getbuilding();
      } else {
        adapter.log.warn("Gettoken nicht erfolgreich! response= " + response);
      }
    });
  } catch (e) {
    adapter.log.warn("gettoken error: " + e);
  }
} //end gettoken

function getbuilding() {
  try {
    adapter.log.debug("Sessiontoken: " + sessiontoken);
    var options = {
      url: server + apipath + buildingpath + sessiontoken,
      method: 'GET',
      headers: {
        'User-Agent': 'request'
      }
    };
    adapter.log.debug("Options getbuilding: " + options);
    request(options, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var infob = JSON.parse(body); // info ist ein Objekt
        adapter.log.debug(infob);
        for (let ib = 0; ib < infob.length; ib++) {
          adapter.log.debug(infob[ib]);
          adapter.log.debug('BuildingID: ' + infob[ib]['objectId']);
          buildingid[ib] = infob[ib]['objectId'];
          dataarray[ib] = new Object();
          dataarray[ib]['Info'] = infob[ib];
          adapter.log.debug("Dataarray:" + JSON.stringify(dataarray));
        }
      } else {
        adapter.log.warn("getbuilding nicht erfolgreich! response= " + response);
      }

      for (let bi = 0; bi < buildingid.length; bi++) {
        getrooms(buildingid[bi], bi)
      }
    });
  } catch (e) {
    adapter.log.warn("getbuilding error: " + e);
  }
} //end getbuilding

function getrooms(building, bi) {
  try {
    adapter.log.debug("SesstionToken: " + sessiontoken + "BuildingID: " + building + "BuildingNr: " + bi);
    var options = {
      url: server + apipath + "building/" + building + roompath + sessiontoken,
      method: 'GET',
      headers: {
        'User-Agent': 'request'
      }
    };
    adapter.log.debug("Options getrooms: " + options);
    request(options, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var infor = JSON.parse(body); // info ist ein Objekt
        adapter.log.debug(infor);
        var rooms = new Array()
        for (let ir = 0; ir < infor.length; ir++) {
          adapter.log.debug("RaumID: " + infor[ir]['objectId']);
          rooms[ir] = infor[ir]['objectId'];
          dataarray[bi]['Rooms'] = new Object();
          dataarray[bi]['Rooms'][rooms[ir]] = new Object();
          dataarray[bi]['Rooms'][rooms[ir]]['Roominfo'] = new Object();
          dataarray[bi]['Rooms'][rooms[ir]]['Roominfo'] = infor[ir];
          adapter.log.debug("Dataarray:" + JSON.stringify(dataarray));
        }
        adapter.log.debug("Räume im Gebäude: " + rooms);
        roomid[bi] = rooms;
        adapter.log.debug("Räume: " + JSOM.stringify(roomid));
      } else {
        adapter.log.warn("getrooms nicht erfolgreich! response= " + response);
      }

      for (let ri = 0; ri < rooms.length; ri++) {
        getdevices(rooms[ri], ri, building);
      }
    });
  } catch (e) {
    adapter.log.warn("getrooms error: " + e);
  }
} //getrooms

function getdevices(room, ri, building) {
  try {
    adapter.log.debug("SessionToken: " + sessiontoken + "BuildingID: " + building + "RoomID: " + room + "RoomNr: " + ri);
    var options = {
      url: server + apipath + "room/" + room + devicepath + sessiontoken,
      method: 'GET',
      headers: {
        'User-Agent': 'request'
      }
    };
    adapter.log.debug("Options getdevices: " + options);
    request(options, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var infod = JSON.parse(body); // info ist ein Objekt
        adapter.log.debug(infod);
        for (let id = 0; id < infod.length; id++) {
          adapter.log.debug(infod[id]['objectId']);
          adapter.log.debug("GEbäudenummer: " + buildingid.indexOf(building));
          adapter.log.debug("raumnummer: " + roomid[buildingid.indexOf(building)].indexOf(room));

          adapter.log.debug("gebäude/raum:" + "'" + building + "'" + "'" + room + "'");
          dataarray[buildingid.indexOf(building)]['Rooms'][room]['Devices'] = new Object();
          dataarray[buildingid.indexOf(building)]['Rooms'][room]['Devices'][infod[id]['objectId']] = infod;
          adapter.log.debug("Dataarray:" + JSON.stringify(dataarray));
          //adapter.log.debug("Länge Datenarray: " + dataarray.length);
          if (firstrun == true) {
            firstrun = false;
            setobjectsfirstrun();
          } else {
            setstates();
          }
        }
      } else {
        adapter.log.warn("getdevices nicht erfolgreich! response= " + response);
      }
    });
  } catch (e) {
    adapter.log.warn("getrooms error: " + e);
  }
} //end getdevices

function setobjectsfirstrun() {
  try {
    for (var sofb = 0; sofb < dataarray.length; sofb++) {
      adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + ".objectId", {
        type: 'state',
        common: {
          name: 'ObjektID Gebäude',
          desc: 'Objekt-ID alphanummerisch, eindeutig Gebäude',
          type: 'string',
          role: "value",
          read: true,
          write: false
        },
        native: {}
      });

      adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + ".city", {
        type: 'state',
        common: {
          name: 'Standort',
          desc: 'Objektstandort (Stadt/Gemeinde)',
          type: 'string',
          role: "value",
          read: true,
          write: false
        },
        native: {}
      });

      for (var sofr = 0; sofr < dataarray[sofb]['Rooms'].length; sofr++) {
        adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + ".objectId", {
          type: 'state',
          common: {
            name: 'ObjektID Raum',
            desc: 'Objekt-ID alphanummerisch, eindeutig Raum',
            type: 'string',
            role: "value",
            read: true,
            write: false
          },
          native: {}
        });
        adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + ".floor", {
          type: 'state',
          common: {
            name: 'Etage',
            desc: 'Etagennummer des Raums',
            type: 'string',
            role: "value",
            read: true,
            write: false
          },
          native: {}
        });

        for (var sofd = 0; sofd < dataarray[sofb]['Rooms'][sofr]['Devices'].length; sofd++) {
          adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + "." + dataarray[sofb]['Rooms'][sofr]['Devices'][sofd]['serialNumber'] + ".objectId", {
            type: 'state',
            common: {
              name: 'ObjektID Gerät',
              desc: 'Objekt-ID alphanummerisch, eindeutig Gerät',
              type: 'string',
              role: "value",
              read: true,
              write: false
            },
            native: {}
          });
          adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + "." + dataarray[sofb]['Rooms'][sofr]['Devices'][sofd]['serialNumber'] + ".macAddress", {
            type: 'state',
            common: {
              name: 'MAC-Adresse Gerät',
              desc: 'MAC-Adresse Gerät',
              type: 'string',
              role: "value",
              read: true,
              write: false
            },
            native: {}
          });
          adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + "." + dataarray[sofb]['Rooms'][sofr]['Devices'][sofd]['serialNumber'] + ".batteryVoltage", {
            type: 'state',
            common: {
              name: 'Batteriespannung',
              desc: 'Batteriespannung (-1 bei Netzanschluss)',
              type: 'number',
              role: "value",
              read: true,
              write: false,
              unit: "V"
            },
            native: {}
          });
          adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + "." + dataarray[sofb]['Rooms'][sofr]['Devices'][sofd]['serialNumber'] + ".co2", {
            type: 'state',
            common: {
              name: 'Messwert CO2',
              desc: 'CO2 - Messwert in ppm',
              type: 'number',
              role: "value",
              read: true,
              write: false,
              unit: "ppm"
            },
            native: {}
          });
          adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + "." + dataarray[sofb]['Rooms'][sofr]['Devices'][sofd]['serialNumber'] + ".lastMeasurement", {
            type: 'state',
            common: {
              name: 'Letzte Messung',
              desc: 'Datum und Uhrzeit der letzten Messung',
              type: 'string',
              role: "value",
              read: true,
              write: false
            },
            native: {}
          });
          adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + "." + dataarray[sofb]['Rooms'][sofr]['Devices'][sofd]['serialNumber'] + ".temperature", {
            type: 'state',
            common: {
              name: 'Temperatur',
              desc: 'Temperaturwert',
              type: 'number',
              role: "value",
              read: true,
              write: false,
              unit: "°C"
            },
            native: {}
          });
          adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + "." + dataarray[sofb]['Rooms'][sofr]['Devices'][sofd]['serialNumber'] + ".humidity", {
            type: 'state',
            common: {
              name: 'Feuchtigkeit',
              desc: 'Relative Feuchte in %',
              type: 'number',
              role: "value",
              read: true,
              write: false,
              unit: "%"
            },
            native: {}
          });
          adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + "." + dataarray[sofb]['Rooms'][sofr]['Devices'][sofd]['serialNumber'] + ".wifiStrength", {
            type: 'state',
            common: {
              name: 'Signalstärke',
              desc: 'Sträke des WLAN - Signals',
              type: 'number',
              role: "value",
              read: true,
              write: false
            },
            native: {}
          });
          adapter.setObjectNotExists(dataarray[sofb]['Info']['homeName'] + "." + dataarray[sofb]['Rooms'][sofr]['Roominfo']['roomName'] + "." + dataarray[sofb]['Rooms'][sofr]['Devices'][sofd]['serialNumber'] + ".deviceType", {
            type: 'state',
            common: {
              name: 'Gerätetyp',
              desc: 'Gerätetyp, Art des Sensors',
              type: 'string',
              role: "value",
              read: true,
              write: false
            },
            native: {}
          });
        } //end rotation devices
      } //end rotation rooms
    } //end rotation Buildings

    testend = setInterval(test, 2000);




  } catch (e) {
    adapter.log.warn("setobjectsfirstrun error: " + e);
  }

} //end setobjectsfirstrun

function test() {
  try {
    adapter.getObject(dataarray[dataarray.length]['Info']['homeName'] + "." + dataarray[dataarray.length]['Rooms'][(dataarray[dataarray.length]['Rooms'].length)]['Roominfo']['roomName'] + "." + dataarray[dataarray.length]['Rooms'][(dataarray[dataarray.length]['Rooms'].length)]['Devices'][(dataarray[dataarray.length]['Rooms'][(dataarray[dataarray.length]['Rooms'].length)]['Devices'].length)]['serialNumber'] + ".deviceType", function(err, obj) {
      if (obj) {
        adapter.log.debug("alle Objekte angelegt, schreibe Werte");
        clearInterval(testend)
        setstates();
      } else {
        adapter.log.warn("Noch nicht alle Objekte vorhanden");
      }
    });

  } catch (e) {
    adapter.log.warn("test error: " + e);
  }
} //end test

function setstates() {
  try {

    adapter.log.debug("Jetzt würden die WErte gesetzt");

  } catch (e) {
    adapter.log.warn("setstates error: " + e);
  }
} //end setstates

function restartAdapter() {
  adapter.getForeignObject('system.adapter.' + adapter.namespace, (err, obj) => {
    if (obj) adapter.setForeignObject('system.adapter.' + adapter.namespace, obj);
  });
} // endFunctionRestartAdapter

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
  module.exports = startAdapter;
} else {
  // or start the instance directly
  startAdapter();
} // endElse
