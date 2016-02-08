var util = require('util');
var Characteristic = require('./fakecharacteristic');
var assert = require('assert');

var sourceHap;

function setSourceHap(hap) {
    sourceHap = hap;
}

function isNumber(value) {
    return typeof value == "number";
}

function isBoolean(value) {
    return typeof(value) == "boolean";
}

function FakeService() {
    this.characteristics = {};
}

FakeService.prototype.hasCharacteristic = function(char) {
    return (this.characteristics[char.name] != null && this.characteristics[char.name] != undefined);
}

FakeService.prototype.getCharacteristic = function(char) {
    assert(this.characteristics[char.name] != undefined, "Cannot get a characteristic that isn't part of the service");
    return this.characteristics[char.name];
}

FakeService.prototype.setCharacteristicBase = function(char, value) {
    assert(this.characteristics[char.name] != undefined, "Cannot set a characteristic that isn't part of the service");
    this.characteristics[char.name].setValue(value);
    return this;
}

/////////////////////////////////////////
// Accessory Information Service

function AccessoryInformation() {
    FakeService.call(this);
    this.characteristics[Characteristic.Manufacturer.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.Manufacturer);
    this.characteristics[Characteristic.Model.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.Model);
    this.characteristics[Characteristic.SerialNumber.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.SerialNumber);
}

util.inherits(AccessoryInformation, FakeService);

AccessoryInformation.prototype.setCharacteristic = function(char, value) {
    return this.setCharacteristicBase(char, value);
}

/////////////////////////////////////////
// Fan service

function Fan() {
    FakeService.call(this);
    this.characteristics[Characteristic.On.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.On);
}

util.inherits(Fan, FakeService);

Fan.prototype.addCharacteristic = function(char) {
    assert(this.characteristics[char.name] == undefined, "Cannot add a characteristic that is already part of the service");
    assert(char.name == Characteristic.RotationSpeed.name, "Fans can only add rotation speed characteristic");
    this.characteristics[char.name] = new Characteristic.FakeCharacteristic(sourceHap, char);
    return this.characteristics[char.name];
}

Fan.prototype.setCharacteristic = function(char, value) {
    if(char.name == Characteristic.On.name) {
        assert(isBoolean(value), "Fan On State must be a boolean");
    } else if(char.name == Characteristic.RotationSpeed.name) {
        assert(isNumber(value), "Fan rotation speed must be a number");
        assert(value >= 0 && value <= 100, "Fan rotation speed must be between 0 and 100");
    }
    return this.setCharacteristicBase(char, value);
}

/////////////////////////////////////////
// Outlet service

function Outlet() {
    FakeService.call(this);
    this.characteristics[Characteristic.On.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.On);
    this.characteristics[Characteristic.OutletInUse.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.OutletInUse);
}

util.inherits(Outlet, FakeService);

Outlet.prototype.setCharacteristic = function(char, value) {
    if(char.name == Characteristic.On.name) {
        assert(isBoolean(value), "Outlet On State must be a boolean");
    } else if(char.name == Characteristic.OutletInUse.name) {
        assert(isBoolean(value), "Outlet In Use State must be a boolean");
    }
    return this.setCharacteristicBase(char, value);
}

/////////////////////////////////////////
// Lock Service

function LockMechanism() {
    FakeService.call(this);
    this.characteristics[Characteristic.LockTargetState.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.LockTargetState);
    this.characteristics[Characteristic.LockCurrentState.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.LockCurrentState);
}

util.inherits(LockMechanism, FakeService);

LockMechanism.prototype.setCharacteristic = function(char, value) {
    if(char.name == Characteristic.LockTargetState.name) {
        assert(isNumber(value), "Lock Target State must be a number");
        assert(value == 0 || value == 1, "Lock target state must be a 0 or a 1");
    } else if(char.name == Characteristic.LockCurrentState.name) {
        assert(isNumber(value), "Lock current State must be a number");
        assert(value == 0 || value == 1, "Lock current state must be a 0 or a 1");
    }
    return this.setCharacteristicBase(char, value);
}

/////////////////////////////////////////
// Lightbulb service

function Lightbulb() {
    FakeService.call(this);
    this.characteristics[Characteristic.On.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.On);
}

util.inherits(Lightbulb, FakeService);

Lightbulb.prototype.addCharacteristic = function(char) {
    assert(this.characteristics[char.name] == undefined, "Cannot add a characteristic that is already part of the service");
    assert(char.name == Characteristic.Brightness.name, "Lights can only add dim characteristic");
    this.characteristics[char.name] = new Characteristic.FakeCharacteristic(sourceHap, char);
    return this.characteristics[char.name];
}

Lightbulb.prototype.setCharacteristic = function(char, value) {
    if(char.name == Characteristic.On.name) {
        assert(isBoolean(value), "Lightbulb on state must be boolean");
    } else if(char.name == Characteristic.Brightness.name) {
        assert(isNumber(value), "Lightbulb brightness must be a number");
        assert(value >= 0 && value <= 100, "Lightbulb brightness must be a value between 0 and 100");
    }
    return this.setCharacteristicBase(char, value);
}

/////////////////////////////////////////
// Contact Sensor

function ContactSensor() {
    FakeService.call(this);
    this.characteristics[Characteristic.ContactSensorState.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.ContactSensorState);
}

util.inherits(ContactSensor, FakeService);

ContactSensor.prototype.setCharacteristic = function(char, value) {
    if(char.name == Characteristic.ContactSensorState.name) {
        assert(isNumber(value), "Contact sensor state must be a number");
        assert(value == 0 || value == 1, "Contact sensor state must be a 0 or 1");
    }
    return this.setCharacteristicBase(char, value);
}

/////////////////////////////////////////
// Motion Sensor

function MotionSensor() {
    FakeService.call(this);
    this.characteristics[Characteristic.MotionDetected.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.MotionDetected);
}

util.inherits(MotionSensor, FakeService);

MotionSensor.prototype.setCharacteristic = function(char, value) {
    if(char.name == Characteristic.MotionDetected) {
        assert(isBoolean(value), "Motion sensor state must be a boolean");
    }
    return this.setCharacteristicBase(char, value);
}

/////////////////////////////////////////
// SecuritySystem
function SecuritySystem( ) {
    FakeService.call(this);
    this.characteristics[Characteristic.SecuritySystemTargetState.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.SecuritySystemTargetState);
    this.characteristics[Characteristic.SecuritySystemCurrentState.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.SecuritySystemCurrentState);
}

util.inherits(SecuritySystem, FakeService);

SecuritySystem.prototype.setCharacteristic = function(char, value) {
    if(char.name == Characteristic.SecuritySystemTargetState) {
        assert(isNumber(value), "Security system target state must be a number");
        assert(value >= 0 && value <= 3, "Security system target state must be a value between 0 and 4");
    } else if(char.name == Characteristic.SecuritySystemCurrentState) {
        assert(isNumber(value), "Security system current state must be a number");
        assert(value >= 0 && value <= 4, "Security system current state must be a value between 0 and 4");
    }
    return this.setCharacteristicBase(char, value);
}

/////////////////////////////////////////
// SecuritySystem
function GarageDoorOpener( ) {
    FakeService.call(this);
    this.characteristics[Characteristic.CurrentDoorState.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.CurrentDoorState);
    this.characteristics[Characteristic.TargetDoorState.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.TargetDoorState);
    this.characteristics[Characteristic.ObstructionDetected.name] = new Characteristic.FakeCharacteristic(sourceHap,Characteristic.ObstructionDetected);
}

util.inherits(GarageDoorOpener, FakeService);

GarageDoorOpener.prototype.setCharacteristic = function(char, value) {
    if(char.name == Characteristic.CurrentDoorState) {
        assert(isNumber(value), "Current door state must be a number");
        assert(value >= 0 && value <= 4, "Current door state must be between 0 and 4");
    } else if(char.name == Characteristic.TargetDoorState) {
        assert(isNumber(value), "Target door state must be a number");
        assert(value >= 0 && value <= 1, "Target door state must be between 0 and 4");
    } else if(char.name == Characteristic.ObstructionDetected) {
        assert(isBoolean(value), "Obstruction detected must be a boolean");
    }
    return this.setCharacteristicBase(char, value);
}

module.exports.setSourceHap = setSourceHap;
module.exports.SecuritySystem = SecuritySystem;
module.exports.MotionSensor = MotionSensor;
module.exports.AccessoryInformation = AccessoryInformation;
module.exports.Fan = Fan;
module.exports.LockMechanism = LockMechanism;
module.exports.Outlet = Outlet;
module.exports.ContactSensor = ContactSensor;
module.exports.Lightbulb = Lightbulb;
module.exports.GarageDoorOpener = GarageDoorOpener;
