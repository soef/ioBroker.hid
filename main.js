﻿"use strict";

var utils = require(__dirname + '/lib/utils'),
    soef = require('soef'),
    HID = require('node-hid');

var hidDevice = null;
var mappings = {};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
//function idWitoutNamespace(id, _adapter) {
//    if (_adapter == undefined) _adapter = adapter;
//    return id.substr(_adapter.namespace.length+1);
//}
//
//var removeAll = function  (adapter, callback) {
//
//    adapter.getStates('*', function (err, states) {
//        var st = [];
//        for (var i in states) {
//            st.push(i);
//        }
//        var s = 0;
//
//        function dels() {
//
//            if (s >= st.length) {
//                adapter.getChannels(function (err, channels) {
//                    var c = 0;
//
//                    function delc() {
//                        if (c >= channels.length) {
//                            adapter.getDevices(function (err, devices) {
//                                var d = 0;
//
//                                function deld() {
//                                    if (d >= devices.length) {
//                                        callback();
//                                        return;
//                                    }
//                                    var did = devices[d++]._id;
//                                    did = idWitoutNamespace(did);
//                                    //adapter.delDevice(did, function(err,obj) {
//                                    adapter.deleteDevice(did, function (err,obj) {
//                                        //adapter.delState(did);
//                                        deld();
//                                    });
//                                }
//                                deld();
//                            });
//                            return;
//                        }
//                        adapter.deleteChannel(channels[c]._id, function () {
//                            delc();
//                        });
//                    }
//                    delc();
//                });
//                return;
//            }
//            var nid = st[s++];
//            adapter.delState(nid, function () {
//                adapter.delObject(nid, function() {
//                    dels();
//                });
//            });
//            //adapter.deleteState(st[s++], function () {
//            //    setTimeout(dels, 1);
//            //});
//        }
//        dels();
//    });
//};


var adapter = soef.Adapter (
    main,
    function onUnload (callback) {
        if (hidDevice) {
            hidDevice.close();
            hidDevice = null;
        }
        callback();
    },
    onMessage,
    onUpdate,
    {
        name: 'hid',
        xready: function () {
            removeAllObjects(adapter, function (){
            });
            return;
        }
        //install: function (callback) {
        //    adapter.log.info('install');
        //    adapter.getForeignObject('system.adapter.' + adapter.namespace, function(err, obj) {
        //        if (!err && obj && obj.common) {
        //            adapter.log.info('installedVersion: ' + obj.common.installedVersion);
        //        }
        //    });
        //    callback();
        //},
        //uninstall: function (callback) {
        //    adapter.log.info('uninstall');
        //    callback();
        //}
    }
);

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function onMessage (obj) {
    if (!obj) return;
    switch (obj.command) {
        case 'discovery':
            var devices = [];
            HID.devices().forEach(function(device) {
                 devices.push({
                     name: device.product,
                     manufacturer: device.manufacturer,
                     productId: device.productId,
                     vendorId: device.vendorId
                 })
            });

            if (obj.callback) {
                adapter.sendTo (obj.from, obj.command, JSON.stringify(devices), obj.callback);
            }
            return true;
        default:
            adapter.log.warn("Unknown command: " + obj.command);
            break;
    }
    if (obj.callback) adapter.sendTo (obj.from, obj.command, obj.message, obj.callback);
    return true;
}

function onUpdate(prevVersion ,aktVersion, callback) {
    if (prevVersion < 1000) {
        removeAllObjects(adapter, callback);
        return;
    }
    callback();
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

var dev;
var last = {
    data: '',
    cnt: 0,
    keyup: '',
    //ts: 0
};

var sub = {
    wo:     '',
    double: '-double',
    single: '-single-short',
    long:   '-long',
    action: '-action',
    dsl:    '-dsl',
    repcnt: '-repcnt',

    raw: 'raw',
    key: 'key'

};

var stateNames = {
    raw:         { n: sub.raw,              val: '',     common: { write: false, name: 'Raw Key Code', desc: 'key-code, changes on first press'}},
    raw_double:  { n: sub.raw+sub.double,   val: '',     common: { write: false, name: 'Double Klick', desc: 'will only change, if double klicked, otherwise raw' + sub.single + ' or raw' + sub.long + ' will be fired' }},
    raw_single:  { n: sub.raw+sub.single,   val: '',     common: { write: false, name: 'Single Klick', desc: 'will only change, if single/short klicked, otherwise raw' + sub.double + ' or raw' + sub.long + ' will be fired' }},
    raw_long:    { n: sub.raw+sub.long,     val: '',     common: { write: false, name: 'Long Press', desc: 'will only change, if long pressed, otherwise raw' + sub.double + ' or raw' + sub.single + ' will be fired' }},
    raw_action:  { n: sub.raw+sub.action,   val: '',     common: { write: false, name: 'Action', desc: 'key-code + .down, .up or .repeat'}},
    raw_dsl:     { n: sub.raw+sub.dsl,      val: '',     common: { write: false, name: 'Double/Single/Long', desc: 'Same than raw' + sub.double + ', raw'+sub.single + ', raw' + sub.long + ' in one (this) state. key-code + .single, .double or .long'}},
    raw_repcnt:  { n: sub.raw+sub.repcnt,   val: '',     common: { write: false, name: 'Repeat Count', desc: 'key-code + .repeat count'}},

    key:         { n: sub.key,              val: '',     common: { write: false, name: 'Mapped Name', desc: 'name of mapped key-code, changes on first press' }},
    key_double:  { n: sub.key+sub.double,   val: '',     common: { write: false, name: 'Named Double Klick', desc: 'will only change, if double klicked, otherwise key' + sub.single + ' or key' + sub.long + ' will be fired' }},
    key_single:  { n: sub.key+sub.single,   val: '',     common: { write: false, name: 'Named Single Klick', desc: 'will only change, if single/short klicked, otherwise key' + sub.double + ' or key' + sub.long + ' will be fired' }},
    key_long:    { n: sub.key+sub.long,     val: '',     common: { write: false, name: 'Named Long Press', desc: 'will only change, if long pressed, otherwise key' + sub.double + ' or key' + sub.single + ' will be fired' }},
    key_action:  { n: sub.key+sub.action,   val: '',     common: { write: false, name: 'Named Action', desc: 'Name + .down, .up or .repeat'}},
    key_dsl:     { n: sub.key+sub.dsl,      val: '',     common: { write: false, name: 'Named Double/Single/Long', desc: 'Same than key' + sub.double + ', key'+sub.single + ', key' + sub.long + ' in one (this) state. name + .single, .double or .long'}},
    key_repcnt:  { n: sub.key+sub.repcnt,   val: '',     common: { write: false, name: 'Named Repeat Count', desc: 'name + .repeat count'}}
};

function createAll(callback) {

    var hidDeviceName = '';
    var d = HID.devices().find(function(d) {
        return (d.vendorId == adapter.config.vendorID && d.productId == adapter.config.productID);
    });
    if (d) {
        hidDeviceName = d.manufacturer + ' - ' + d.product;
    }
    dev = new devices.CDevice(adapter.config.vendorID + '-' + adapter.config.productID, hidDeviceName);

    //for (var prefix in { raw: '', key: '' }) {
        for (var i in stateNames) {
            var st = Object.assign({}, stateNames[i]);
            var n = st.n;
            delete st.n;
            dev.createNew(n, st);
        }
    //}
    dev.update(callback);
}


function set(name, val, ext) {
    ext = ext || '';
    adapter.log.debug('#'+sub.raw + name + '=' + val + ext);
    dev.set(sub.raw + name, val + ext);
    if (mappings[val]) {
        dev.set(sub.key + name, mappings[val] + ext);
        adapter.log.debug('#' + sub.key + name + '=' + mappings[val] + ext);
    }
}

function setDSL(name, val) {
    set(name, val);
    set(sub.dsl, val + '.' + name.substr(1));
}

var Timer = {
    timer: null,
    set: function (func, timeout, v1) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(function() {
            this.timer = null;
            func(v1);
        }.bind(this), timeout);
    },
    clear: function() {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }
};

var upTimer = Object.assign({}, Timer);
var downTimer = Object.assign({}, Timer);

function upEvent(dev, data, from) {
    if (data != '') {
        downTimer.clear();
        set(sub.action, data, '.up');
        //adapter.log.debug('keyup: ' + from + ' data=' + data + ' last.keyupp=' + last.keyup + ' cnt=' + last.cnt + ' lastData=' + last.data);
        if (last.cnt<= 2) upTimer.set(function(_lastKeyUp) {
            if (last.cnt <= 2) setDSL(sub.single, _lastKeyUp);
            last.keyup = '';
        }, adapter.config.keyUpTimeout*2, data);
        if (last.cnt <= 2 && last.keyup == data) {
            upTimer.clear();
            setDSL(sub.double, last.keyup);
            last.keyup = '';
        } else {
            last.keyup = data;
        }
        last.data = '';
        last.cnt = 0;
    }
}

function onData(data) {
    var ext;
    if (adapter.config.keyUpTimeout) {
        downTimer.set(function (_data) {
            upEvent(dev, _data, 'timeout');
        }, adapter.config.keyUpTimeout, data);
    }

    if (last.data == data) {
        last.cnt += 1;
        if (last.cnt == 3) {
            upTimer.clear();
            setDSL(sub.long, data);
        }
        ext = '.repeat';
    } else {
        upEvent(dev, last.data, 'other key');
        set(sub.wo, data);
        ext = '.down';
        last.data = data;
    }
    set(sub.action, data, ext);
    if (last.cnt > 1) {
        set(sub.repcnt, data, '.' + last.cnt);
    }
    dev.update();
}


//function onData(data) {
//    var ext;
//    if (adapter.config.keyUpTimeout) {
//        if (timer) {
//            clearTimeout(timer);
//            adapter.log.debug('clearTimer');
//        }
//        adapter.log.debug('setimg timer: ' + data);
//        timer = setTimeout(function (_data) {
//            timer = null;
//            upEvent(dev, _data, 'to');
//        }, adapter.config.keyUpTimeout, data);
//    }
//
//    if (lastData == data) {
//        cnt += 1;
//        ext = '.repeat';
//    } else {
//        upEvent(dev, lastData, 'other key');
//        set('', data);
//        ext = '.down';
//    }
//    set('func', data, ext);
//    if (cnt > 1) {
//        set('repcnt', data, '.' + cnt);
//    }
//    dev.update();
//    //devices.update();
//    lastData = data;
//}


function normalizeConfig(config) {
    config.keyUpTimeout = parseInt(config.keyUpTimeout) | 0;
}

//function intVersion(vstr) {
//    if (!vstr || vstr=='') return 0;
//    var ar = vstr.split('.');
//    var iVer = 0;
//    for (var i=0; i<ar.length; i++) {
//        iVer *= 1000;
//        iVer += ar[i] >> 0;
//    }
//    return iVer;
//}
//
//function nop() {}
//
//function checkIfUpdated(doUpdateCallback, callback) {
//    if (!doUpdateCallback) return;
//    if (!callback) callback = nop;
//    var id = 'system.adapter.' + adapter.namespace;
//    var vid = id + '.prevVersion';
//    adapter.states.getState(vid, function(err, state) {
//        var prevVersion = 0;
//        var aktVersion = intVersion(adapter.ioPack.common.version);
//
//        function callUpdate() {
//            doUpdateCallback(prevVersion, aktVersion, function(err) {
//                adapter.states.setState(vid, { val: adapter.ioPack.common.version, ack: true, from: id });
//                callback();
//            });
//        }
//
//        if (!err && state) {
//            prevVersion = intVersion(state.val);
//            if (prevVersion < aktVersion) {
//                callUpdate();
//            } else {
//                callback();
//            }
//            return;
//        }
//        adapter.objects.setObject(vid, {
//            type: 'state',
//            common: {name: 'version', role: "indicator.state", desc: 'version check for updates'},
//            native: {}
//        }, function (err, obj) {
//            callUpdate();
//        });
//    });
//}
//
//function doUpdate(prev,akt, cb) {
//    cb();
//}



function main() {

    normalizeConfig(adapter.config);
    mappings = adapter.ioPack.mappings;
    if (!adapter.config.vendorID || !adapter.config.productID) {
        adapter.log.error("VendorID and ProductID has to be configured");
        return;
    }

    var hidDevice = new HID.HID(adapter.config.vendorID, adapter.config.productID);
    if (!hidDevice) {
        adapter.log.error("can not open device with VendorID " + adapter.config.vendorID + " and Product ID " + adapter.config.productID);
    }
    createAll();

    hidDevice.on("data", function (data) {
        var sData = data.toString('hex').toUpperCase();
        //adapter.log.debug("HID event deteced: " + sData);
        onData(sData);
    });
    hidDevice.on("error", function (err) {
        console.log("err: " + err);
    });

    //adapter.subscribeStates('*');
}

