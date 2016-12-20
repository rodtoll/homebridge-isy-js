var FakeService = require('./fakeservice');
var FakeCharacteristic = require('./fakecharacteristic');
var assert = require('assert');

function FakeHomeBridge(configFileName) {
    FakeService.setSourceHap(this);
    this.hap = {
        Service: FakeService,
        Characteristic: FakeCharacteristic
    };
    this.pluginName = null;
    this.configName = null;
    this.platformType = null;
    this.config = require(configFileName);
    this.activePlatform = null;
    this.log = console.log;
    this.deviceIndex = {};
    this.servicesIndex = {};
    this.characteristicCalledHandler = null;
    this.notifyOfGet = null;
    this.notifyOfSet = null;
}

FakeHomeBridge.prototype.registerPlatform = function(platformName, configName, platformType) {
    this.pluginName = platformName;
    this.configName = configName;
    this.platformType = platformType;
}

FakeHomeBridge.prototype.startPlatform = function(fileName, done) {
    var that = this;
    function handleCallback(deviceList) {
        assert(deviceList != undefined && deviceList != null, 'Must return a device list');
        // assert(deviceList.length <= 100, 'Cannot return more then 100 devices');
        that.deviceList = deviceList;
        for(var deviceIndex = 0; deviceIndex < that.deviceList.length; deviceIndex++) {
            var device = that.deviceList[deviceIndex];
            assert(device.uuid_base != null && device.uuid_base != undefined && device.uuid_base != "", 'Each device must have a uuid_base property');
            that.deviceIndex[device.uuid_base] = device;
            assert(device.getServices != null && device.getServices != undefined, 'Each device must implement a getServices() method');
            var serviceList = device.getServices();
            assert(serviceList != null && serviceList.length > 1, 'Each device must implement at least the accessory service and their specific service(s). Device '+device.uuid_base+' does not');
            var accessoryServiceFound = false;
            for(var serviceIndex = 0; serviceIndex < serviceList.length; serviceIndex++) {
                if(serviceList[serviceIndex] instanceof FakeService.AccessoryInformation) {
                    accessoryServiceFound = true;
                    break;
                }
            }
            assert(accessoryServiceFound, 'Every device must implement an accessory service. Device '+device.uuid_base+' does not');
            that.servicesIndex[device.uuid_base] = device.getServices();
        }
        done();
    }
    var newModule = require(fileName)(this);
    for(var platformIndex = 0; platformIndex < this.config.platforms.length; platformIndex++) {
        if(this.config.platforms[platformIndex].platform == this.configName) {
            this.activePlatform = new this.platformType(this.log, this.config.platforms[platformIndex]);
            assert(this.activePlatform != undefined, 'Invalid platform specified');
            assert(this.activePlatform.accessories != null, 'Must have an accessories entry-point');
            this.activePlatform.accessories(handleCallback);
            return;
        }
    }
    assert(false, 'Could not find specified platform');
}

FakeHomeBridge.prototype.getServiceListByUuid = function(deviceUuid) {
    return this.servicesIndex[deviceUuid];
}

FakeHomeBridge.prototype.getServiceForDevice = function(device, serviceType) {
    var services = this.getServiceListByUuid(device.uuid_base);
    if(services != null) {
        for(var index = 0; index < services.length; index++) {
            if(services[index] instanceof serviceType) {
                return services[index];
            }
        }
    }
    return null;
}

FakeHomeBridge.prototype.checkAccessoryService = function(device, name) {
    var accessoryService = this.getServiceForDevice(device, FakeService.AccessoryInformation);
    assert(accessoryService != null, "Device needs an accessory service. Device "+name+" doesn't");
}

FakeHomeBridge.prototype.checkValidLight = function(device, isDimmable, name) {
    this.checkAccessoryService(device,name);
    var lightService = this.getServiceForDevice(device, FakeService.Lightbulb);
    assert(lightService != null, "Light devices must have a lighting service. Device "+name+" doesn't");
    if(isDimmable) {
        assert(lightService.getCharacteristic(FakeCharacteristic.Brightness) != null, "Light devices must have a lighting service. Device "+name+" doesn't");
    }
}

FakeHomeBridge.prototype.checkValidGarageDoorOpener = function(device,name) {
    this.checkAccessoryService(device,name);
    var garageService = this.getServiceForDevice(device, FakeService.GarageDoorOpener);
}

FakeHomeBridge.prototype.checkValidScene = function(scene,name) {
    this.checkAccessoryService(scene,name);
    var lightService = this.getServiceForDevice(scene, FakeService.Lightbulb);
    assert(lightService != null, "Scene devices must have a lighting service. Device "+name+" doesn't");
}

FakeHomeBridge.prototype.checkValidLock = function(device, isDimmable, name) {
    this.checkAccessoryService(device,name);
    assert(this.getServiceForDevice(device, FakeService.LockMechanism) != null, "Lock devices must have a lock mechanism service. Device "+name+" doesn't");
}

FakeHomeBridge.prototype.checkValidOutlet = function(device, name) {
    this.checkAccessoryService(device,name);
    assert(this.getServiceForDevice(device, FakeService.Outlet) != null, "Outlet devices must have an outlet service. Device "+name+" doesn't");
}

FakeHomeBridge.prototype.checkValidContactSensor = function(device, name) {
    this.checkAccessoryService(device,name);
    assert(this.getServiceForDevice(device, FakeService.ContactSensor) != null, "Contact Sensor devices must have a contact sensor service. Device "+name+" doesn't");
}

FakeHomeBridge.prototype.checkValidAlarmPanel = function(device, name) {
    this.checkAccessoryService(device,name);
    assert(this.getServiceForDevice(device, FakeService.SecuritySystem) != null, "Alarm Panel devices must have a alarm panel service. Device "+name+" doesn't");
}

FakeHomeBridge.prototype.checkValidFan = function(device, name) {
    this.checkAccessoryService(device,name);
    assert(this.getServiceForDevice(device, FakeService.Fan) != null, "Fan devices must have a fan service. Device "+name+" doesn't");
}

FakeHomeBridge.prototype.checkValidMotionSensor = function(device, name) {
    this.checkAccessoryService(device);
    assert(this.getServiceForDevice(device, FakeService.MotionSensor) != null, "Motion sensor devices must have a motion sensor service. Device "+name+" doesn't");
}

module.exports.FakeHomeBridge = FakeHomeBridge;


