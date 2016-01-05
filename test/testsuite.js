var FakeHomeBridge = require('./fakehomebridge').FakeHomeBridge;
var Service = require('./fakeservice');
var Characteristic = require('./fakecharacteristic');
var assert = require('assert');
var ISYFanAccessory = require('../index').ISYFanAccessory;
var ISYLightAccessory = require('../index').ISYLightAccessory;
var ISYLockAccessory = require('../index').ISYLockAccessory;
var ISYOutletAccessory = require('../index').ISYOutletAccessory;
var ISYDoorWindowSensorAccessory = require('../index').ISYDoorWindowSensorAccessory;
var ISYElkAlarmPanelAccessory = require('../index').ISYElkAlarmPanelAccessory;
var ISYMotionSensorAccessory = require('../index').ISYMotionSensorAccessory;
var restler = require('restler');

var testServerAddress = '127.0.0.1:3000';
var testServerUserName = 'admin';
var testServerPassword = 'password';

var sampleDimmableLightWhichIsOff = '33 9B DC 1';
var sampleDimmableLightWhichIsOn = '17 28 71 1';
var sampleUnLockedDoorLock = 'ZW002_1';
var sampleLockedDoorLock = 'ZW005_1';
var sampleFanOnHigh = '14 A6 C5 2';
var sampleFanOff = '14 A7 12 2';
var sampleInsteonContactSensor = '14 47 41 1';
var sampleOutlet = '1F 46 F0 1';
var sampleMotionSensor = '14 5C B2 1';
var sampleScene = '27346';
var sampleSceneDevices = ['18 12 18 1', '19 53 90 1'];

var numExpectedDevices = 90;
var numExpectedScenes = 1;
var numExpectedLights = 42;
var numExpectedLocks = 3;
var numExpectedMotionSensors = 5;
var numExpectedAlarmSystems = 1;
var numExpectedOutlets = 1;
var numExpectedFans = 3;
var numExpectedDoorWindowSensor = 34;

function findDevice(bridge, isyAddress) {
    for(var deviceIndex = 0; deviceIndex < bridge.deviceList.length; deviceIndex++) {
        if(bridge.deviceList[deviceIndex].device.address == isyAddress) {
            return bridge.deviceList[deviceIndex];
        }
    }
    return null;
}



describe('HomeBridge startup and device enumeration', function() {
    it('Basic startup should work and return the right type of devices', function (done) {
        var bridge = new FakeHomeBridge('./testconfig.json');
        bridge.startPlatform('../index.js', function () {
            assert.equal(bridge.deviceList.length, numExpectedDevices, 'Did not get the expected number of devices');
            var lightCount = 0;
            var lockCount = 0;
            var motionCount = 0;
            var alarmCount = 0;
            var outletCount = 0;
            var fanCount = 0;
            var doorWindowCount = 0;
            var sceneCount = 0;
            for(var deviceIndex = 0; deviceIndex < bridge.deviceList.length; deviceIndex++) {
                var device = bridge.deviceList[deviceIndex];
                assert(device.uuid_base != null && device.uuid_base != undefined && device.uuid_base != "", device.device.address + ' Must have uuid_base');
                if(device instanceof ISYFanAccessory) {
                    bridge.checkValidFan(device, device.device.address);
                    fanCount++;
                } else if(device instanceof ISYLightAccessory) {
                    bridge.checkValidLight(device, device.device.dimmable, device.device.address);
                    if(device.device.deviceType == 'Scene') {
                        sceneCount++
                    } else {
                        lightCount++;
                    }
                } else if(device instanceof ISYLockAccessory) {
                    bridge.checkValidLock(device, device.device.address);
                    lockCount++;
                } else if(device instanceof ISYOutletAccessory) {
                    bridge.checkValidOutlet(device, device.device.address);
                    outletCount++;
                } else if(device instanceof ISYDoorWindowSensorAccessory) {
                    bridge.checkValidContactSensor(device, device.device.address);
                    doorWindowCount++;
                } else if(device instanceof ISYElkAlarmPanelAccessory) {
                    bridge.checkValidAlarmPanel(device, device.device.address);
                    alarmCount++;
                } else if(device instanceof ISYMotionSensorAccessory) {
                    bridge.checkValidMotionSensor(device, device.device.address);
                    motionCount++;
                } else {
                    assert(false, 'Found an unexpected device type');
                }
            }
            assert.equal(fanCount, numExpectedFans, 'Should have expected count of fans');
            assert.equal(lightCount, numExpectedLights, 'Should have expected count of lights');
            assert.equal(lockCount, numExpectedLocks, 'Should have expected count of locks');
            assert.equal(outletCount, numExpectedOutlets, 'Should have expected count of outlets');
            assert.equal(doorWindowCount, numExpectedDoorWindowSensor, 'Should have expected count of door window sensors');
            assert.equal(alarmCount, numExpectedAlarmSystems, 'Should have expected count of alarms');
            assert.equal(motionCount, numExpectedMotionSensors, 'Should have expected count of motion sensors');
            assert.equal(sceneCount, numExpectedScenes, 'Should have expected number of scenes');
            done();
        });
    });
});


function resetServerState(done) {
    restler.get('http://'+testServerAddress+'/config/reset').on('complete', function(result, response) { done(); });
}

function sendISYCommand(address, command, parameter, done) {
    var url = 'http://'+testServerUserName+':'+testServerPassword+'@'+testServerAddress+'/rest/nodes/'+address+'/CMD/'+command;
    if(parameter != null) {
        url += '/' + parameter;
    }
    restler.get(url).on('complete', function() { done(); });
}

function getSpecificServiceForDevice(bridge, device, serviceType) {
    var servicesList = bridge.getServiceListByUuid(device.uuid_base);
    for (var index = 0; index < servicesList.length; index++) {
        if(servicesList[index] instanceof serviceType) {
            return servicesList[index];
        }
    }
    return null;
}

function resetServerState(done) {
    restler.get('http://'+testServerAddress+'/config/reset').on('complete', function(result, response) { done(); });
}

function sendCommandAndCheckState(deviceAddress, char, commandToSend, parameterToSend, stateToTry, done) {
    var bridge = new FakeHomeBridge('./testconfig.json');
    bridge.startPlatform('../index.js', function () {
        var deviceToChange = findDevice(bridge, deviceAddress);
        var stateToExpect = stateToTry;
        assert(deviceToChange != null, 'Could not find test device '+deviceAddress);
        // Add a notification handler so we know when state is set
        bridge.notifyOfSet = function(characteristic) {
            if(characteristic.name  == char.name) {
                if (stateToExpect == characteristic.value) {
                    done();
                }
            }
        }

        sendISYCommand(deviceAddress, commandToSend, parameterToSend, function () {});
    });
}

function sendCommandAndCheckStateViaIsy(deviceAddress, char, commandToSet, parameterForSet, stateToTry, expectedCount, done) {
    var bridge = new FakeHomeBridge('./testconfig.json');
    bridge.startPlatform('../index.js', function () {
        var deviceToChange = findDevice(bridge, deviceAddress);
        var stateToExpect = stateToTry;
        assert(deviceToChange != null, 'Could not find test device '+deviceAddress);
        var callbacksReceived = 0;
        // Add a notification handler so we know when state is set
        bridge.notifyOfSet = function(characteristic) {
            if(characteristic.name  == char.name) {
                if (stateToExpect == characteristic.value) {
                    callbacksReceived++;
                    if(callbacksReceived == expectedCount) {
                        done();
                    }
                }
            }
        }
        deviceToChange.device[commandToSet](parameterForSet, function() {});
    });
}

function setCharacteristicAndCheckResult(deviceAddress, service, char, stateToTry, deviceCheckFunction, deviceStateToExpect, expectedCount, done) {
    var bridge = new FakeHomeBridge('./testconfig.json');
    bridge.startPlatform('../index.js', function () {
        var deviceToChange = findDevice(bridge, deviceAddress);
        assert(deviceToChange != null, 'Could not find test device '+deviceAddress);
        // Hook device change notifications
        var realCallback = deviceToChange.device.isy.changeCallback;
        var callbacksReceived = 0;
        function interceptionCallback(isy,device) {
            realCallback(isy,device);
            if(device.address == deviceToChange.device.address) {
                callbacksReceived++;
                if(callbacksReceived == expectedCount) {
                    assert(deviceToChange.device[deviceCheckFunction]()==deviceStateToExpect, 'State should have been updated');
                    // Restore callback in case we want to make another change
                    isy.changeCallback = realCallback;
                    done();
                }
            }
        }
        deviceToChange.device.isy.changeCallback = interceptionCallback;
        deviceToChange[service].setCharacteristic(char,stateToTry);
    });
}

describe('LIGHT TESTS', function() {
    describe('LIGHT: Device changes update homebridge', function() {
        beforeEach(function(done) {
            resetServerState(function() {
                done();
            });
        });
        it('Light switching on should update homebridge on state', function (done) {
            sendCommandAndCheckStateViaIsy(sampleDimmableLightWhichIsOff, Characteristic.On, 'sendLightCommand', true, true, 1, done);
        });
        it('Light switching off should update homebridge on state', function (done) {
            sendCommandAndCheckStateViaIsy(sampleDimmableLightWhichIsOn, Characteristic.On, 'sendLightCommand', false, false, 1, done);
        });
        it('Light switching on should update homebridge dimness state to 100', function (done) {
            sendCommandAndCheckStateViaIsy(sampleDimmableLightWhichIsOff, Characteristic.Brightness, 'sendLightCommand', true, 100, 1, done);
        });
        it('Light switching off should update homebridge dimness state to 0', function (done) {
            sendCommandAndCheckStateViaIsy(sampleDimmableLightWhichIsOn, Characteristic.Brightness, 'sendLightCommand', false, 0, 1, done);
        });
        it('Light switching on to 50% dim from off should update homebridge dimness state to 50', function (done) {
            sendCommandAndCheckStateViaIsy(sampleDimmableLightWhichIsOff, Characteristic.Brightness, 'sendLightDimCommand', 50, 50, 1, done);
        });
        it('Light switching on to 50% dim from off should update homebridge on state to on', function (done) {
            sendCommandAndCheckStateViaIsy(sampleDimmableLightWhichIsOff, Characteristic.On, 'sendLightDimCommand', 50, true, 1, done);
        });
        it('Light switching from 100% on to 50% dim from off should update homebridge dim state to 50', function (done) {
            sendCommandAndCheckStateViaIsy(sampleDimmableLightWhichIsOn, Characteristic.Brightness, 'sendLightDimCommand', 50, 50, 1, done);
        });
    });
    describe('LIGHT: Making direct changes changes the device', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('Switching light on results in update to on state and then off to off state', function (done) {
            setCharacteristicAndCheckResult(sampleDimmableLightWhichIsOff, 'lightService', Characteristic.On, true, 'getCurrentLightState', true, 1, function() {
                    setCharacteristicAndCheckResult(sampleDimmableLightWhichIsOff, 'lightService', Characteristic.On, false, 'getCurrentLightState', false, 1, done)
                }
            );
        });
        it('Switching light to 50% results in update to on state to on', function (done) {
            setCharacteristicAndCheckResult(sampleDimmableLightWhichIsOff, 'lightService', Characteristic.Brightness, 50, 'getCurrentLightState', true, 1, done);
        });
        it('Switching light to 0% results in update to on state to off', function (done) {
            setCharacteristicAndCheckResult(sampleDimmableLightWhichIsOn, 'lightService', Characteristic.Brightness, 0, 'getCurrentLightState', false, 1, done);
        });
        it('Switching light to 50% results in update to dim level to 50', function (done) {
            setCharacteristicAndCheckResult(sampleDimmableLightWhichIsOff, 'lightService', Characteristic.Brightness, 50, 'getCurrentLightDimState', 50, 1, done);
        });
        it('Switching light to 0% results in update to dim level to 0', function (done) {
            setCharacteristicAndCheckResult(sampleDimmableLightWhichIsOn, 'lightService', Characteristic.Brightness, 0, 'getCurrentLightDimState', 0, 1, done);
        });
    });
});

describe('LOCK TESTS', function() {
    describe('LOCK: Device changes update homebridge', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('Door locking updates lock current state to locked', function (done) {
            sendCommandAndCheckStateViaIsy(sampleUnLockedDoorLock, Characteristic.LockCurrentState, 'sendLockCommand', true, Characteristic.LockCurrentState.SECURED, 1, done);
        });
        it('Door unlocking updates lock current state to unlocked', function (done) {
            sendCommandAndCheckStateViaIsy(sampleLockedDoorLock, Characteristic.LockCurrentState, 'sendLockCommand', false, Characteristic.LockCurrentState.UNSECURED, 1, done);
        });
        it('Door locking updates lock target state to locked', function (done) {
            sendCommandAndCheckStateViaIsy(sampleUnLockedDoorLock, Characteristic.LockTargetState, 'sendLockCommand', true, Characteristic.LockCurrentState.SECURED, 1, done);
        });
        it('Door unlocking updates lock target state to unlocked', function (done) {
            sendCommandAndCheckStateViaIsy(sampleLockedDoorLock, Characteristic.LockTargetState, 'sendLockCommand', false, Characteristic.LockCurrentState.UNSECURED, 1, done);
        });
    });
    describe('LOCK: Making direct changes changes the device', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('Locking the door lock results in a lock state change to locked then unlocked', function (done) {
            setCharacteristicAndCheckResult(sampleLockedDoorLock, 'lockService', Characteristic.LockTargetState, Characteristic.LockTargetState.UNSECURED, 'getCurrentLockState', false, 1, function() {
                    setCharacteristicAndCheckResult(sampleLockedDoorLock, 'lockService', Characteristic.LockTargetState, Characteristic.LockTargetState.SECURED, 'getCurrentLockState', true, 1, done)
                }
            );
        });
    });
});

describe('FAN TESTS', function() {
    describe('FAN: Device changes update homebridge', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('Fan switching to high switches state to on', function (done) {
            sendCommandAndCheckStateViaIsy(sampleFanOff, Characteristic.On, 'sendFanCommand', 'High', true, 1, done);
        });
        it('Fan switching to medium switches state to on', function (done) {
            sendCommandAndCheckStateViaIsy(sampleFanOff, Characteristic.On, 'sendFanCommand', 'Medium', true, 1, done);
        });
        it('Fan switching to low switches state to on', function (done) {
            sendCommandAndCheckStateViaIsy(sampleFanOff, Characteristic.On, 'sendFanCommand', 'Low', true, 1,  done);
        });
        it('Fan switching to off switches state to off', function (done) {
            sendCommandAndCheckStateViaIsy(sampleFanOnHigh, Characteristic.On, 'sendFanCommand', 'Off', false, 1, done);
        });
        it('Fan switching to high switches speed to right value', function (done) {
            sendCommandAndCheckStateViaIsy(sampleFanOff, Characteristic.RotationSpeed, 'sendFanCommand', 'High', 100, 1, done);
        });
        it('Fan switching to medium switches speed to right value', function (done) {
            sendCommandAndCheckStateViaIsy(sampleFanOff, Characteristic.RotationSpeed, 'sendFanCommand', 'Medium', 67, 1, done);
        });
        it('Fan switching to low switches speed to right value', function (done) {
            sendCommandAndCheckStateViaIsy(sampleFanOff, Characteristic.RotationSpeed, 'sendFanCommand', 'Low', 32, 1, done);
        });
        it('Fan switching to off switches speed to right value', function (done) {
            sendCommandAndCheckStateViaIsy(sampleFanOnHigh, Characteristic.RotationSpeed, 'sendFanCommand', 'Off', 0, 1, done);
        });
    });
    describe('FAN: Making direct changes changes the device', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('Setting fan to off turns off the fan', function (done) {
            setCharacteristicAndCheckResult(sampleFanOnHigh, 'fanService', Characteristic.On, false, 'getCurrentFanState', 'Off', 1, done);
        });
        it('Setting fan to on sets fan to Medium', function (done) {
            setCharacteristicAndCheckResult(sampleFanOff, 'fanService', Characteristic.On, true, 'getCurrentFanState', 'Medium', 1, done);
        });
        it('Setting fan to 100% rotation speed sets fan to high', function (done) {
            setCharacteristicAndCheckResult(sampleFanOff, 'fanService', Characteristic.RotationSpeed, 100, 'getCurrentFanState', 'High', 1, done);
        });
        it('Setting fan to 0% rotation speed sets fan to off', function (done) {
            setCharacteristicAndCheckResult(sampleFanOnHigh, 'fanService', Characteristic.RotationSpeed, 0, 'getCurrentFanState', 'Off', 1, done);
        });
        it('Setting fan to 32% rotation speed sets fan to low', function (done) {
            setCharacteristicAndCheckResult(sampleFanOff, 'fanService', Characteristic.RotationSpeed, 32, 'getCurrentFanState', 'Low', 1, done);
        });
        it('Setting fan to 67% rotation speed sets fan to medium', function (done) {
            setCharacteristicAndCheckResult(sampleFanOff, 'fanService', Characteristic.RotationSpeed, 67, 'getCurrentFanState', 'Medium', 1, done);
        });
        it('Setting fan to above 67% rotation speed sets fan to high', function (done) {
            setCharacteristicAndCheckResult(sampleFanOff, 'fanService', Characteristic.RotationSpeed, 82, 'getCurrentFanState', 'High', 1, done);
        });
        it('Setting fan to above 32% and below 67% rotation speed sets fan to medium', function (done) {
            setCharacteristicAndCheckResult(sampleFanOff, 'fanService', Characteristic.RotationSpeed, 45, 'getCurrentFanState', 'Medium', 1, done);
        });
        it('Setting fan to above 0% and below 32% rotation speed sets fan to low', function (done) {
            setCharacteristicAndCheckResult(sampleFanOff, 'fanService', Characteristic.RotationSpeed, 16, 'getCurrentFanState', 'Low', 1, done);
        });
        it('Setting fan which is high to low switches rotation speed sets fan to low', function (done) {
            setCharacteristicAndCheckResult(sampleFanOnHigh, 'fanService', Characteristic.RotationSpeed, 16, 'getCurrentFanState', 'Low', 1, done);
        });
    });
});

describe('CONTACT TESTS', function() {
    describe('CONTACT SENSOR: Device changes update homebridge', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('Sensor detecting open updates local sensor', function (done) {
            sendCommandAndCheckState(sampleInsteonContactSensor, Characteristic.ContactSensorState, 'DON', null, true, function() {
                sendCommandAndCheckState(sampleInsteonContactSensor, Characteristic.ContactSensorState, 'DOF', null, false, done);
            });
        });
    });
});

describe('OUTLET TESTS', function() {
    describe('OUTLET: Device changes update homebridge', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('OUTLET: Outlet switching to on switches On state to on and opposite to off', function (done) {
            sendCommandAndCheckStateViaIsy(sampleOutlet, Characteristic.On, 'sendOutletCommand', true, true, 1, function() {
                sendCommandAndCheckStateViaIsy(sampleOutlet, Characteristic.On, 'sendOutletCommand', false, false, 1, done);
            });
        });
    });
    describe('OUTLET: Making direct changes changes the device propogates to the device', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('OUTLET: Outlet switching to on switches On state to on and opposite to off', function (done) {
            setCharacteristicAndCheckResult(sampleOutlet, 'outletService', Characteristic.On, true, 'getCurrentOutletState', true, 1, function() {
                setCharacteristicAndCheckResult(sampleOutlet, 'outletService', Characteristic.On, false, 'getCurrentOutletState', false, 1, done);
            });
        });
    });
});

describe('MOTION SENSOR TESTS', function() {
    describe('MOTION SENSOR: Device changes update homebridge', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('Motion sensor switching to on switches On state to on and opposite to off', function (done) {
            sendCommandAndCheckState(sampleMotionSensor, Characteristic.MotionDetected, 'DON', null, true, function() {
                sendCommandAndCheckState(sampleMotionSensor, Characteristic.MotionDetected, 'DOF', null, false, done);
            });
        });
    });
});

describe('SCENE TESTS', function() {
    describe('SCENE: Device changes update homebridge', function() {
        beforeEach(function(done) {
            resetServerState(function() {
                done();
            });
        });
        it('Scene switching on then off should update homebridge on state to on then off', function (done) {
            sendCommandAndCheckStateViaIsy(sampleScene, Characteristic.On, 'sendLightCommand', true, true, 2, function() {
                sendCommandAndCheckStateViaIsy(sampleScene, Characteristic.On, 'sendLightCommand', false, false, 2, done);
            });
            done();
        });
    });

    describe('SCENE: Making direct changes changes the device', function() {
        beforeEach(function (done) {
            resetServerState(function () {
                done();
            });
        });
        it('Switching light on results in update to on state and then off to off state', function (done) {
            setCharacteristicAndCheckResult(sampleScene, 'lightService', Characteristic.On, true, 'getCurrentLightState', true, 2, function () {
                setCharacteristicAndCheckResult(sampleScene, 'lightService', Characteristic.On, false, 'getCurrentLightState', false, 2, done)
            });
        });
    });
});






