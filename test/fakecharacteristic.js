var util = require('util');
var EventEmitter = require("events").EventEmitter;
var assert = require('assert');

////////////////////////////////////////////////////////////////////////
// Base Characteristic Functionality

function FakeCharacteristic(hap, char) {
    this.hap = hap;
    this.name = char.name;
    this.value = "";
    EventEmitter.call(this);
}

util.inherits(FakeCharacteristic, EventEmitter);

FakeCharacteristic.prototype.notifyOfGet = function() {
    if(this.hap != null) {
        if(this.hap.notifyOfGet != null) {
            this.hap.notifyOfGet(this);
        }
    }
}

FakeCharacteristic.prototype.notifyOfSet = function() {
    if(this.hap != null) {
        if(this.hap.notifyOfSet != null) {
            this.hap.notifyOfSet(this);
        }
    }
}

FakeCharacteristic.prototype.setValue = function(value) {
    var that = this;
    if(this.listeners('set').length > 0) {
        this.emit('set', value, function () {
            that.value = value;
            that.notifyOfSet()
        });
    } else {
        this.value = value;
        this.notifyOfSet();
    }
}

FakeCharacteristic.prototype.getValue = function() {
    var that = this;
    if(this.listeners('get').length > 0) {
        this.emit('get', function (ignore, valueToSet) {
            that.value = valueToSet;
            that.notifyOfGet();
        });
    } else {
        this.notifyOfGet();
    }
}

////////////////////////////////////////////////////////////////////////
// Manufacturer

function Manufacturer() {
    FakeCharacteristic.call(this);
}

Manufacturer.name = 'Manufacturer';

util.inherits(Manufacturer, FakeCharacteristic);

////////////////////////////////////////////////////////////////////////
// Model

function Model() {
    FakeCharacteristic.call(this);
}

Model.name = 'Model';

util.inherits(Model, FakeCharacteristic);

////////////////////////////////////////////////////////////////////////
// SerialNumber

function SerialNumber() {
    FakeCharacteristic.call(this);
}

SerialNumber.name = 'SerialNumber';

util.inherits(SerialNumber, FakeCharacteristic);

////////////////////////////////////////////////////////////////////////
// On

function On() {
    FakeCharacteristic.call(this);
}

On.name = 'On';

util.inherits(On, FakeCharacteristic);

////////////////////////////////////////////////////////////////////////
// RotationSpeed

function RotationSpeed() {
    EventEmitter.call(this);
}

RotationSpeed.name = 'RotationSpeed';

util.inherits(RotationSpeed, FakeCharacteristic);

////////////////////////////////////////////////////////////////////////
// OutletInUse

function OutletInUse() {
    EventEmitter.call(this);
}

OutletInUse.name = 'OutletInUse';

util.inherits(OutletInUse, FakeCharacteristic);

////////////////////////////////////////////////////////////////////////
// LockTargetState

function LockTargetState() {
    EventEmitter.call(this);
}

LockTargetState.name = 'LockTargetState';

util.inherits(LockTargetState, FakeCharacteristic);

LockTargetState.UNSECURED = 0;
LockTargetState.SECURED = 1;

////////////////////////////////////////////////////////////////////////
// LockCurrentState

function LockCurrentState() {
    EventEmitter.call(this);
}

LockCurrentState.name = 'LockTargetState';

util.inherits(LockCurrentState, FakeCharacteristic);

LockCurrentState.UNSECURED = 0;
LockCurrentState.SECURED = 1;
LockCurrentState.JAMMED = 2;
LockCurrentState.UNKNOWN = 3;


////////////////////////////////////////////////////////////////////////
// Brightness

function Brightness() {
    EventEmitter.call(this);
}

Brightness.name = 'Brightness';

util.inherits(Brightness, FakeCharacteristic);

////////////////////////////////////////////////////////////////////////
// ContactSensorState

function ContactSensorState() {
    EventEmitter.call(this);
}

ContactSensorState.name = 'ContactSensorState';

util.inherits(ContactSensorState, FakeCharacteristic);

ContactSensorState.CONTACT_DETECTED = 0;
ContactSensorState.CONTACT_NOT_DETECTED = 1;

////////////////////////////////////////////////////////////////////////
// MotionDetected

function MotionDetected() {
    EventEmitter.call(this);
}

MotionDetected.name = 'MotionDetected';

util.inherits(MotionDetected, FakeCharacteristic);

////////////////////////////////////////////////////////////////////////
// SecuritySystemTargetState

function SecuritySystemTargetState() {
    EventEmitter.call(this);
}

SecuritySystemTargetState.name = 'SecuritySystemTargetState';

SecuritySystemTargetState.STAY_ARM = 0;
SecuritySystemTargetState.AWAY_ARM = 1;
SecuritySystemTargetState.NIGHT_ARM = 2;
SecuritySystemTargetState.DISARM = 3;

util.inherits(SecuritySystemTargetState, FakeCharacteristic);

////////////////////////////////////////////////////////////////////////
// SecuritySystemCurrentState

function SecuritySystemCurrentState() {
    EventEmitter.call(this);
}

SecuritySystemCurrentState.name = 'SecuritySystemCurrentState';

util.inherits(SecuritySystemCurrentState, FakeCharacteristic);

SecuritySystemCurrentState.STAY_ARM = 0;
SecuritySystemCurrentState.AWAY_ARM = 1;
SecuritySystemCurrentState.NIGHT_ARM = 2;
SecuritySystemCurrentState.DISARMED = 3;
SecuritySystemCurrentState.ALARM_TRIGGERED = 4;

module.exports.FakeCharacteristic = FakeCharacteristic;
module.exports.Manufacturer = Manufacturer;
module.exports.Model = Model;
module.exports.SerialNumber = SerialNumber;
module.exports.On = On;
module.exports.RotationSpeed = RotationSpeed;
module.exports.OutletInUse = OutletInUse;
module.exports.LockTargetState = LockTargetState;
module.exports.LockCurrentState = LockCurrentState;
module.exports.Brightness = Brightness;
module.exports.ContactSensorState = ContactSensorState;
module.exports.MotionDetected = MotionDetected;
module.exports.SecuritySystemTargetState = SecuritySystemTargetState;
module.exports.SecuritySystemCurrentState = SecuritySystemCurrentState;
