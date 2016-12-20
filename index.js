/*
 ISY-JS
 
 See README.md for details.
*/

var Service, Characteristic, types;

var isy = require('isy-js');

// Global device map. Needed to map incoming notifications to the corresponding HomeKit device for update.
var deviceMap = {};

// This function responds to changes in devices from the isy-js library. Uses the global device map to update
// the state.
// TODO: Move this to a member function of the ISYPlatform object so we don't need a global map.
function ISYChangeHandler(isy,device) {
	var deviceToUpdate = deviceMap[device.address];
	if(deviceToUpdate != null) {
		deviceToUpdate.handleExternalChange();
	}
}

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  types = homebridge.hapLegacyTypes;  
  homebridge.registerPlatform("homebridge-isy-js", "isy-js", ISYPlatform);
}

////////////////////////////////////////////////////////////////////////////////////////////////
// PLATFORM

// Construct the ISY platform. log = Logger, config = homebridge cofnig
function ISYPlatform(log,config) {
	this.log = log;
	this.config = config;
	this.host = config.host;
	this.username = config.username;
	this.password = config.password;
	this.elkEnabled = config.elkEnabled;
	this.debugLoggingEnabled = (config.debugLoggingEnabled==undefined) ? false : config.debugLoggingEnabled;
	this.includeAllScenes = (config.includeAllScenes==undefined) ? false : config.includeAllScenes;
	this.includedScenes = (config.includedScenes==undefined) ? [] : config.includedScenes;
	this.isy = new isy.ISY(this.host, this.username,this.password, config.elkEnabled, ISYChangeHandler, config.useHttps, true, this.debugLoggingEnabled);
}

ISYPlatform.prototype.logger = function(msg) {
	if(this.debugLoggingEnabled || (process.env.ISYJSDEBUG != undefined && process.env.IYJSDEBUG != null)) {
        var timeStamp = new Date();
		this.log(timeStamp.getYear()+"-"+timeStamp.getMonth()+"-"+timeStamp.getDay()+"#"+timeStamp.getHours()+":"+timeStamp.getMinutes()+":"+timeStamp.getSeconds()+"- "+msg);
	}
}

// Checks the device against the configuration to see if it should be ignored. 
ISYPlatform.prototype.shouldIgnore = function(device) {
	var deviceAddress = device.address;
	if(device.deviceType==this.isy.DEVICE_TYPE_SCENE) {
        if (this.includeAllScenes == true) {
            return false;
        } else if (this.includedScenes == undefined) {
            return false;
        } else {
            for (var index = 0; index < this.includedScenes.length; index++) {
                if (this.includedScenes[index] == deviceAddress) {
                    return false;
                }
            }
            return true;
        }
    } else {
        if (this.config.ignoreDevices == undefined) {
            return false;
        }
        var deviceName = device.name;
        for (var index = 0; index < this.config.ignoreDevices.length; index++) {
            var rule = this.config.ignoreDevices[index];
            if (rule.nameContains != undefined && rule.nameContains != "") {
                if (deviceName.indexOf(rule.nameContains) == -1) {
                    continue;
                }
            }
            if (rule.lastAddressDigit != undefined && rule.lastAddressDigit != "") {
                if (deviceAddress.indexOf(rule.lastAddressDigit, deviceAddress.length - 2) == -1) {
                    continue;
                }
            }
            if (rule.address != undefined && rule.address != "") {
                if (deviceAddress != rule.address) {
                    continue;
                }
            }
            this.logger("ISYPLATFORM: Ignoring device: " + deviceName + " [" + deviceAddress + "] because of rule [" + rule.nameContains + "] [" + rule.lastAddressDigit + "] [" + rule.address + "]");
            return true;
        }
    }
	return false;
}

ISYPlatform.prototype.getGarageEntry = function(address) {
    var garageDoorList = this.config.garageDoors;
    if(garageDoorList != undefined) {
        for (var index = 0; index < garageDoorList.length; index++) {
            var garageEntry = garageDoorList[index];
            if (garageEntry.address == address) {
                return garageEntry;
            }
        }
    }
    return null;
}

ISYPlatform.prototype.renameDeviceIfNeeded = function(device) {
    var deviceAddress = device.address;
    var deviceName = device.name;
    if(this.config.renameDevices == undefined) {
        return deviceName;
    }
    for (var index = 0; index < this.config.renameDevices.length; index++) {
        var rule = this.config.renameDevices[index];
        if (rule.nameContains != undefined && rule.nameContains != "") {
            if (deviceName.indexOf(rule.nameContains) == -1) {
                continue;
            }
        }
        if (rule.lastAddressDigit != undefined && rule.lastAddressDigit != "") {
            if (deviceAddress.indexOf(rule.lastAddressDigit, deviceAddress.length - 2) == -1) {
                continue;
            }
        }
        if (rule.address != undefined && rule.address != "") {
            if (deviceAddress != rule.address) {
                continue;
            }
        }
        if(rule.newName == undefined) {
            this.logger("ISYPLATFORM: Rule to rename device is present but no new name specified. Impacting device: "+deviceName);
            return deviceName;
        } else {
            this.logger("ISYPLATFORM: Renaming device: " + deviceName + "[" + deviceAddress + "] to [" + rule.newName + "] because of rule [" + rule.nameContains + "] [" + rule.lastAddressDigit + "] [" + rule.address + "]");
            return rule.newName;
        }
    }
    return deviceName;
}


// Calls the isy-js library, retrieves the list of devices, and maps them to appropriate ISYXXXXAccessory devices.
ISYPlatform.prototype.accessories = function(callback) {
	var that = this;
	this.isy.initialize(function() {
		var results = [];		
		var deviceList = that.isy.getDeviceList();
		for(var index = 0; index < deviceList.length; index++) {
			var device = deviceList[index];
			var homeKitDevice = null;
            var garageInfo = that.getGarageEntry(device.address);
			if(!that.shouldIgnore(device)) {
			    if(results.length >= 100) {
			        that.logger("ISYPLATFORM: Skipping any further devices as 100 limit has been reached");
                    break;
                }
                device.name = that.renameDeviceIfNeeded(device);
                if(garageInfo != null) {
                    var relayAddress = device.address.substr(0, device.address.length-1);
                    relayAddress += '2';
                    var relayDevice = that.isy.getDevice(relayAddress);
                    homeKitDevice = new ISYGarageDoorAccessory(that.logger.bind(that),device, relayDevice, garageInfo.name, garageInfo.timeToOpen, garageInfo.alternate);
                } else if(device.deviceType == that.isy.DEVICE_TYPE_LIGHT || device.deviceType == that.isy.DEVICE_TYPE_DIMMABLE_LIGHT) {
					homeKitDevice = new ISYLightAccessory(that.logger.bind(that),device);
				} else if(device.deviceType == that.isy.DEVICE_TYPE_LOCK || device.deviceType == that.isy.DEVICE_TYPE_SECURE_LOCK) {
					homeKitDevice = new ISYLockAccessory(that.logger.bind(that),device);
				} else if(device.deviceType == that.isy.DEVICE_TYPE_OUTLET) {
					homeKitDevice = new ISYOutletAccessory(that.logger.bind(that),device);
				} else if(device.deviceType == that.isy.DEVICE_TYPE_FAN) {
					homeKitDevice = new ISYFanAccessory(that.logger.bind(that),device);
				} else if(device.deviceType == that.isy.DEVICE_TYPE_DOOR_WINDOW_SENSOR) {
					homeKitDevice = new ISYDoorWindowSensorAccessory(that.logger.bind(that),device);
				} else if(device.deviceType == that.isy.DEVICE_TYPE_ALARM_DOOR_WINDOW_SENSOR) {
					homeKitDevice = new ISYDoorWindowSensorAccessory(that.logger.bind(that),device);
				} else if(device.deviceType == that.isy.DEVICE_TYPE_ALARM_PANEL) {
					homeKitDevice = new ISYElkAlarmPanelAccessory(that.logger.bind(that),device);
				} else if(device.deviceType == that.isy.DEVICE_TYPE_MOTION_SENSOR) {
                    homeKitDevice = new ISYMotionSensorAccessory(that.logger.bind(that),device);
                } else if(device.deviceType == that.isy.DEVICE_TYPE_SCENE) {
					homeKitDevice = new ISYSceneAccessory(that.logger.bind(that),device);
				}
				if(homeKitDevice != null) {
					// Make sure the device is address to the global map
					deviceMap[device.address] = homeKitDevice;
					results.push(homeKitDevice);
				}
			}
		}
		if(that.isy.elkEnabled) {
		    if(results.length >= 100) {
                that.logger("ISYPLATFORM: Skipping adding Elk Alarm panel as device count already at maximum");
            } else {
                var panelDevice = that.isy.getElkAlarmPanel();
                panelDevice.name = that.renameDeviceIfNeeded(panelDevice);
                var panelDeviceHK = new ISYElkAlarmPanelAccessory(that.log, panelDevice);
                deviceMap[panelDevice.address] = panelDeviceHK;
                results.push(panelDeviceHK);
            }
		}
		that.logger("ISYPLATFORM: Filtered device has: "+results.length+" devices");
		callback(results);		
	});
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// BASE FOR ALL DEVICES

// Provides common constructor tasks
function ISYAccessoryBaseSetup(accessory,log,device) {
	accessory.log = log;
	accessory.device = device;
	accessory.address = device.address;
	accessory.name = device.name;	
	accessory.uuid_base = device.isy.address+":"+device.address;
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// FANS - ISYFanAccessory 
// Implemetnts the fan service for an isy fan device. 

// Constructs a fan accessory object. device is the isy-js device object and log is the logger. 
function ISYFanAccessory(log,device) {
	ISYAccessoryBaseSetup(this,log,device);
}

ISYFanAccessory.prototype.identify = function(callback) {
	// Do the identify action
	callback();
}

// Translates the fan speed as an isy-js string into the corresponding homekit constant level.
// Homekit doesn't have steps for the fan speed and needs to have a value from 0 to 100. We 
// split the range into 4 steps and map them to the 4 isy-js levels. 
ISYFanAccessory.prototype.translateFanSpeedToHK = function(fanSpeed) {
	if(fanSpeed == this.device.FAN_OFF) {
		return 0;
	} else if(fanSpeed == this.device.FAN_LEVEL_LOW) {
		return 32;
	} else if(fanSpeed == this.device.FAN_LEVEL_MEDIUM) {
		return 67;
	} else if(fanSpeed == this.device.FAN_LEVEL_HIGH) {
		return 100;
	} else {
		this.log("FAN: "+this.device.name+" !!!! ERROR: Unknown fan speed: "+fanSpeed);
		return 0;
	}
}

// Translates the fan level from homebridge into the isy-js level. Maps from the 0-100
// to the four isy-js fan speed levels. 
ISYFanAccessory.prototype.translateHKToFanSpeed = function(fanStateHK) {
	if(fanStateHK == 0) {
		return this.device.FAN_OFF;
	} else if(fanStateHK > 0 && fanStateHK <=32) {
		return this.device.FAN_LEVEL_LOW;
	} else if(fanStateHK >= 33 && fanStateHK <= 67) {
		return this.device.FAN_LEVEL_MEDIUM;
	} else if(fanStateHK > 67) {
		return this.device.FAN_LEVEL_HIGH;
	} else {
		this.log("FAN: "+this.device.name+" ERROR: Unknown fan state!");
		return this.device.FAN_OFF;
	}
}

// Returns the current state of the fan from the isy-js level to the 0-100 level of HK.
ISYFanAccessory.prototype.getFanRotationSpeed = function(callback) {
	this.log( "FAN: "+this.device.name+" Getting fan rotation speed. Device says: "+this.device.getCurrentFanState()+" translation says: "+this.translateFanSpeedToHK(this.device.getCurrentFanState()))
	callback(null,this.translateFanSpeedToHK(this.device.getCurrentFanState()));
}

// Sets the current state of the fan from the 0-100 level of HK to the isy-js level.
ISYFanAccessory.prototype.setFanRotationSpeed = function(fanStateHK,callback) {
	this.log( "FAN: "+this.device.name+" Sending command to set fan state(pre-translate) to: "+fanStateHK);
	var newFanState = this.translateHKToFanSpeed(fanStateHK);
	this.log("FAN: "+this.device.name+" Sending command to set fan state to: "+newFanState);
	if(newFanState != this.device.getCurrentFanState()) {
		this.device.sendFanCommand(newFanState, function(result) {
			callback();		
		});
	} else {
		this.log("FAN: "+this.device.name+" Fan command does not change actual speed");
		callback();
	}
}

// Returns true if the fan is on
ISYFanAccessory.prototype.getIsFanOn = function() {
	this.log( "FAN: "+this.device.name+" Getting fan is on. Device says: "+this.device.getCurrentFanState()+" Code says: "+(this.device.getCurrentFanState() != "Off"));
	return (this.device.getCurrentFanState() != "Off");
}

// Returns the state of the fan to the homebridge system for the On characteristic
ISYFanAccessory.prototype.getFanOnState = function(callback) {
	callback(null,this.getIsFanOn());
}

// Sets the fan state based on the value of the On characteristic. Default to Medium for on. 
ISYFanAccessory.prototype.setFanOnState = function(onState,callback) {
	this.log( "FAN: "+this.device.name+" Setting fan on state to: "+onState+" Device says: "+this.device.getCurrentFanState());
	if(onState != this.getIsFanOn()) {
		if(onState) {
			this.log( "FAN: "+this.device.name+" Setting fan speed to medium");
			this.setFanRotationSpeed(this.translateFanSpeedToHK(this.device.FAN_LEVEL_MEDIUM), callback);
		} else {
			this.log( "FAN: "+this.device.name+" Setting fan speed to off");
			this.setFanRotationSpeed(this.translateFanSpeedToHK(this.device.FAN_OFF), callback);
		}
	} else {
		this.log("FAN: "+this.device.name+" Fan command does not change actual state");
		callback();
	} 
}

// Mirrors change in the state of the underlying isj-js device object.
ISYFanAccessory.prototype.handleExternalChange = function() {
	this.log( "FAN: "+this.device.name+" Incoming external change. Device says: "+this.device.getCurrentFanState());
	this.fanService
		.setCharacteristic(Characteristic.On, this.getIsFanOn());
		
	this.fanService
		.setCharacteristic(Characteristic.RotationSpeed, this.translateFanSpeedToHK(this.device.getCurrentFanState()));		
}

// Returns the services supported by the fan device. 
ISYFanAccessory.prototype.getServices = function() {
	var informationService = new Service.AccessoryInformation();
	
	informationService
      .setCharacteristic(Characteristic.Manufacturer, "SmartHome")
      .setCharacteristic(Characteristic.Model, this.device.deviceFriendlyName)
      .setCharacteristic(Characteristic.SerialNumber, this.device.address);	
	  
	var fanService = new Service.Fan();
	
	this.fanService = fanService;
	this.informationService = informationService;	
    
    fanService
      .getCharacteristic(Characteristic.On)
      .on('set', this.setFanOnState.bind(this));
	  
	fanService
	  .getCharacteristic(Characteristic.On)
	  .on('get', this.getFanOnState.bind(this));
	  
	fanService
	  .addCharacteristic(Characteristic.RotationSpeed)
	  .on('get', this.getFanRotationSpeed.bind(this));	  
  
	fanService
	  .getCharacteristic(Characteristic.RotationSpeed)	
	  .on('set', this.setFanRotationSpeed.bind(this));	
    
    return [informationService, fanService];	
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// OUTLETS - ISYOutletAccessory
// Implements the Outlet service for ISY devices.

// Constructs an outlet. log = HomeBridge logger, device = isy-js device to wrap
function ISYOutletAccessory(log,device) {
	ISYAccessoryBaseSetup(this,log,device);
}

// Handles the identify command
ISYOutletAccessory.prototype.identify = function(callback) {
	// Do the identify action
	callback();
}

// Handles a request to set the outlet state. Ignores redundant sets based on current states.
ISYOutletAccessory.prototype.setOutletState = function(outletState,callback) {
	this.log("OUTLET: "+this.device.name+" Sending command to set outlet state to: "+outletState);
	if(outletState != this.device.getCurrentOutletState()) {
		this.device.sendOutletCommand(outletState, function(result) {
			callback();		
		});
	} else {
		callback();
	}
}

// Handles a request to get the current outlet state based on underlying isy-js device object.
ISYOutletAccessory.prototype.getOutletState = function(callback) {
	callback(null,this.device.getCurrentOutletState());
}

// Handles a request to get the current in use state of the outlet. We set this to true always as
// there is no way to deterine this through the isy.
ISYOutletAccessory.prototype.getOutletInUseState = function(callback) {
	callback(null, true);
}

// Mirrors change in the state of the underlying isj-js device object.
ISYOutletAccessory.prototype.handleExternalChange = function() {
	this.outletService
		.setCharacteristic(Characteristic.On, this.device.getCurrentOutletState());
}

// Returns the set of services supported by this object.
ISYOutletAccessory.prototype.getServices = function() {
	var informationService = new Service.AccessoryInformation();
	
	informationService
      .setCharacteristic(Characteristic.Manufacturer, "SmartHome")
      .setCharacteristic(Characteristic.Model, this.device.deviceFriendlyName)
      .setCharacteristic(Characteristic.SerialNumber, this.device.address);	
	  
	var outletService = new Service.Outlet();
	
	this.outletService = outletService;
	this.informationService = informationService;	
    
    outletService
      .getCharacteristic(Characteristic.On)
      .on('set', this.setOutletState.bind(this));
	  
	outletService
	  .getCharacteristic(Characteristic.On)
	  .on('get', this.getOutletState.bind(this));
	  
	outletService
	  .getCharacteristic(Characteristic.OutletInUse)
	  .on('get', this.getOutletInUseState.bind(this));
    
    return [informationService, outletService];	
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// LOCKS - ISYLockAccessory
// Implements the lock service for isy-js devices. 

// Constructs a lock accessory. log = homebridge logger, device = isy-js device object being wrapped
function ISYLockAccessory(log,device) {
	ISYAccessoryBaseSetup(this,log,device);
}

// Handles an identify request
ISYLockAccessory.prototype.identify = function(callback) {
	callback();
}

// Handles a set to the target lock state. Will ignore redundant commands.
ISYLockAccessory.prototype.setTargetLockState = function(lockState,callback) {
	this.log(this,"LOCK: "+this.device.name+" Sending command to set lock state to: "+lockState);
	if(lockState != this.getDeviceCurrentStateAsHK()) {
		var targetLockValue = (lockState == 0) ? false : true;
		this.device.sendLockCommand(targetLockValue, function(result) {
			callback();		
		});
	} else {
		callback();
	}
}

// Translates underlying lock state into the corresponding homekit state
ISYLockAccessory.prototype.getDeviceCurrentStateAsHK = function() {
	return (this.device.getCurrentLockState() ? 1 : 0);
}

// Handles request to get the current lock state for homekit
ISYLockAccessory.prototype.getLockCurrentState = function(callback) {
	callback(null, this.getDeviceCurrentStateAsHK());
}

// Handles request to get the target lock state for homekit
ISYLockAccessory.prototype.getTargetLockState = function(callback) {
	this.getLockCurrentState(callback);
}

// Mirrors change in the state of the underlying isj-js device object.
ISYLockAccessory.prototype.handleExternalChange = function() {
	this.lockService
		.setCharacteristic(Characteristic.LockTargetState, this.getDeviceCurrentStateAsHK());
	this.lockService
		.setCharacteristic(Characteristic.LockCurrentState, this.getDeviceCurrentStateAsHK());
}

// Returns the set of services supported by this object.
ISYLockAccessory.prototype.getServices = function() {
	var informationService = new Service.AccessoryInformation();
	
	informationService
      .setCharacteristic(Characteristic.Manufacturer, "SmartHome")
      .setCharacteristic(Characteristic.Model, this.device.deviceFriendlyName)
      .setCharacteristic(Characteristic.SerialNumber, this.device.address);	
	  
	var lockMechanismService = new Service.LockMechanism();
	
	this.lockService = lockMechanismService;
	this.informationService = informationService;	
    
    lockMechanismService
      .getCharacteristic(Characteristic.LockTargetState)
      .on('set', this.setTargetLockState.bind(this));
	  
	lockMechanismService
	  .getCharacteristic(Characteristic.LockTargetState)
	  .on('get', this.getTargetLockState.bind(this));
	  
	lockMechanismService
	  .getCharacteristic(Characteristic.LockCurrentState)
	  .on('get', this.getLockCurrentState.bind(this));
    
    return [informationService, lockMechanismService];	
}

////////////////////////////////////////////////////////////////////////////////////////////////////////
// LIGHTS
// Implements the Light service for homekit based on an underlying isy-js device. Is dimmable or not depending
// on if the underlying device is dimmable. 

// Constructs the light accessory. log = homebridge logger, device = isy-js device object being wrapped
function ISYLightAccessory(log,device) {
	ISYAccessoryBaseSetup(this,log,device);
	this.dimmable = (this.device.deviceType == "DimmableLight");
}

// Handles the identify command
ISYLightAccessory.prototype.identify = function(callback) {
	var that = this;
	this.device.sendLightCommand(true, function(result) {
		that.device.sendLightCommand(false, function(result) {
			callback();			
		});		
	});
}

// Handles request to set the current powerstate from homekit. Will ignore redundant commands. 
ISYLightAccessory.prototype.setPowerState = function(powerOn,callback) {
	this.log("LIGHT: "+this.device.name+" Setting powerstate to "+powerOn);
	if(powerOn != this.device.getCurrentLightState()) {
		this.log("LIGHT: "+this.device.name+" Changing powerstate to "+powerOn);
		this.device.sendLightCommand(powerOn, function(result) {
			callback();
		});
	} else {
		this.log("LIGHT: "+this.device.name+" Ignoring redundant setPowerState");
		callback();
	}
}

// Mirrors change in the state of the underlying isj-js device object.
ISYLightAccessory.prototype.handleExternalChange = function() {
	this.log("LIGHT: "+this.device.name+" Handling external change for light");
	this.lightService
		.setCharacteristic(Characteristic.On, this.device.getCurrentLightState());
	if(this.dimmable) {
		this.lightService
			.setCharacteristic(Characteristic.Brightness, this.device.getCurrentLightDimState()	);
	}
}

// Handles request to get the current on state
ISYLightAccessory.prototype.getPowerState = function(callback) { 
	callback(null,this.device.getCurrentLightState());
}

// Handles request to set the brightness level of dimmable lights. Ignore redundant commands. 
ISYLightAccessory.prototype.setBrightness = function(level,callback) {
	this.log("LIGHT: "+this.device.name+" Setting brightness to "+level);
	if(level != this.device.getCurrentLightDimState()) {
		if(level == 0) {
			this.log("LIGHT: "+this.device.name+" Brightness set to 0, sending off command");
			this.device.sendLightCommand(false, function(result) {
				callback();
			});
		} else {
			this.log("LIGHT: "+this.device.name+" Changing Brightness to "+level);
			this.device.sendLightDimCommand(level, function(result) {
				callback();
			});
		}
	} else {
		this.log("LIGHT: "+this.device.name+" Ignoring redundant setBrightness");
		callback();
	}
}

// Handles a request to get the current brightness level for dimmable lights.
ISYLightAccessory.prototype.getBrightness = function(callback) {
	callback(null,this.device.getCurrentLightDimState());
}

// Returns the set of services supported by this object.
ISYLightAccessory.prototype.getServices = function() {
	var informationService = new Service.AccessoryInformation();
	
	informationService
      .setCharacteristic(Characteristic.Manufacturer, "SmartHome")
      .setCharacteristic(Characteristic.Model, this.device.deviceFriendlyName)
      .setCharacteristic(Characteristic.SerialNumber, this.device.address);	
	  
	var lightBulbService = new Service.Lightbulb();
	
	this.informationService = informationService;
	this.lightService = lightBulbService; 	
	
    lightBulbService
      .getCharacteristic(Characteristic.On)
      .on('set', this.setPowerState.bind(this));
	  
	lightBulbService
	  .getCharacteristic(Characteristic.On)
	  .on('get', this.getPowerState.bind(this));
	  
	if(this.dimmable) {
		lightBulbService
		.addCharacteristic(Characteristic.Brightness)
		.on('get', this.getBrightness.bind(this));
		
		lightBulbService
		.getCharacteristic(Characteristic.Brightness)	  
		.on('set', this.setBrightness.bind(this));
	}
	  
    return [informationService, lightBulbService];	
}

////////////////////////////////////////////////////////////////////////////////////////////////////////
// SCENES
// Implements the Light service for homekit based on an underlying isy-js device. Is dimmable or not depending
// on if the underlying device is dimmable.

// Constructs the light accessory. log = homebridge logger, device = isy-js device object being wrapped
function ISYSceneAccessory(log,device) {
	ISYAccessoryBaseSetup(this,log,device);
}

// Handles the identify command
ISYSceneAccessory.prototype.identify = function(callback) {
	var that = this;
	this.device.sendLightCommand(true, function(result) {
		that.device.sendLightCommand(false, function(result) {
			callback();
		});
	});
}

// Handles request to set the current powerstate from homekit. Will ignore redundant commands.
ISYSceneAccessory.prototype.setPowerState = function(powerOn,callback) {
	this.log("SCENE: "+this.device.name+" Setting powerstate to "+powerOn);
	if(!this.device.getAreAllLightsInSpecifiedState(powerOn)) {
		this.log("SCENE: "+this.device.name+" Changing powerstate to "+powerOn);
		this.device.sendLightCommand(powerOn, function(result) {
			callback();
		});
	} else {
		this.log("SCENE: "+this.device.name+" Ignoring redundant setPowerState");
		callback();
	}
}

// Mirrors change in the state of the underlying isj-js device object.
ISYSceneAccessory.prototype.handleExternalChange = function() {
	this.log("SCENE: "+this.device.name+" Handling external change for light");
    if(this.device.getAreAllLightsInSpecifiedState(true) || this.device.getAreAllLightsInSpecifiedState(false)) {
        this.lightService
            .setCharacteristic(Characteristic.On, this.device.getAreAllLightsInSpecifiedState(true));
    }
}

ISYSceneAccessory.prototype.calculatePowerState = function() {
    return this.device.getAreAllLightsInSpecifiedState(true);
}

// Handles request to get the current on state
ISYSceneAccessory.prototype.getPowerState = function(callback) {
	callback(null,this.calculatePowerState());
}

// Returns the set of services supported by this object.
ISYSceneAccessory.prototype.getServices = function() {
	var informationService = new Service.AccessoryInformation();

	informationService
		.setCharacteristic(Characteristic.Manufacturer, "SmartHome")
		.setCharacteristic(Characteristic.Model, "Insteon Scene")
		.setCharacteristic(Characteristic.SerialNumber, this.device.address);

	var lightBulbService = new Service.Lightbulb();

	this.informationService = informationService;
	this.lightService = lightBulbService;

	lightBulbService
		.getCharacteristic(Characteristic.On)
		.on('set', this.setPowerState.bind(this));

	lightBulbService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getPowerState.bind(this));

	return [informationService, lightBulbService];
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// CONTACT SENSOR - ISYDoorWindowSensorAccessory
// Implements the ContactSensor service.

// Constructs a Door Window Sensor (contact sensor) accessory. log = HomeBridge logger, device = wrapped isy-js device.
function ISYDoorWindowSensorAccessory(log,device) {
	ISYAccessoryBaseSetup(this,log,device);
	this.doorWindowState = false;
}

// Handles the identify command.
ISYDoorWindowSensorAccessory.prototype.identify = function(callback) {
	// Do the identify action
	callback();
}

// Translates the state of the underlying device object into the corresponding homekit compatible state
ISYDoorWindowSensorAccessory.prototype.translateCurrentDoorWindowState = function() {
	return (this.device.getCurrentDoorWindowState()) ? Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : Characteristic.ContactSensorState.CONTACT_DETECTED;	
}

// Handles the request to get he current door window state.
ISYDoorWindowSensorAccessory.prototype.getCurrentDoorWindowState = function(callback) {
	callback(null,this.translateCurrentDoorWindowState());
}

// Mirrors change in the state of the underlying isj-js device object.
ISYDoorWindowSensorAccessory.prototype.handleExternalChange = function() {
	this.sensorService
		.setCharacteristic(Characteristic.ContactSensorState, this.translateCurrentDoorWindowState());
}

// Returns the set of services supported by this object.
ISYDoorWindowSensorAccessory.prototype.getServices = function() {
	var informationService = new Service.AccessoryInformation();
	
	informationService
      .setCharacteristic(Characteristic.Manufacturer, "SmartHome")
      .setCharacteristic(Characteristic.Model, this.device.deviceFriendlyName)
      .setCharacteristic(Characteristic.SerialNumber, this.device.address);	
	  
	var sensorService = new Service.ContactSensor();
	
	this.sensorService = sensorService;
	this.informationService = informationService;	
    
    sensorService
      .getCharacteristic(Characteristic.ContactSensorState)
      .on('get', this.getCurrentDoorWindowState.bind(this));
    
    return [informationService, sensorService];	
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// MOTION SENSOR - ISYMotionSensorAccessory
// Implements the ContactSensor service.

// Constructs a Door Window Sensor (contact sensor) accessory. log = HomeBridge logger, device = wrapped isy-js device.
function ISYMotionSensorAccessory(log,device) {
	ISYAccessoryBaseSetup(this,log,device);
}

// Handles the identify command.
ISYMotionSensorAccessory.prototype.identify = function(callback) {
	// Do the identify action
	callback();
}

// Handles the request to get he current motion sensor state.
ISYMotionSensorAccessory.prototype.getCurrentMotionSensorState = function(callback) {
	callback(null,this.device.getCurrentMotionSensorState());
}

// Mirrors change in the state of the underlying isj-js device object.
ISYMotionSensorAccessory.prototype.handleExternalChange = function() {
	this.sensorService
		.setCharacteristic(Characteristic.MotionDetected, this.device.getCurrentMotionSensorState());
}

// Returns the set of services supported by this object.
ISYMotionSensorAccessory.prototype.getServices = function() {
	var informationService = new Service.AccessoryInformation();
	
    informationService
      .setCharacteristic(Characteristic.Manufacturer, "SmartHome")
      .setCharacteristic(Characteristic.Model, this.device.deviceFriendlyName)
      .setCharacteristic(Characteristic.SerialNumber, this.device.address);	
	  
    var sensorService = new Service.MotionSensor();
	
    this.sensorService = sensorService;
    this.informationService = informationService;	
    
    sensorService
      .getCharacteristic(Characteristic.MotionDetected)
      .on('get', this.getCurrentMotionSensorState.bind(this));
    
    return [informationService, sensorService];	
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// ELK SENSOR PANEL - ISYElkAlarmPanelAccessory
// Implements the SecuritySystem service for an elk security panel connected to the isy system

// Constructs the alarm panel accessory. log = HomeBridge logger, device = underlying isy-js device being wrapped
function ISYElkAlarmPanelAccessory(log,device) {
	ISYAccessoryBaseSetup(this,log,device);
}

// Handles the identify command
ISYElkAlarmPanelAccessory.prototype.identify = function(callback) {
	callback();
}

// Handles the request to set the alarm target state
ISYElkAlarmPanelAccessory.prototype.setAlarmTargetState = function(targetStateHK,callback) {
	this.log("ALARMSYSTEM: "+this.device.name+"Sending command to set alarm panel state to: "+targetStateHK);
	var targetState = this.translateHKToAlarmTargetState(targetStateHK);
	this.log("ALARMSYSTEM: "+this.device.name+" Would send the target state of: "+targetState);
	if(this.device.getAlarmMode() != targetState) {
		this.device.sendSetAlarmModeCommand(targetState, function(result) {
			callback();		
		});
	} else {
		this.log("ALARMSYSTEM: "+this.device.name+" Redundant command, already in that state.");
		callback();
	}
}

// Translates from the current state of the elk alarm system into a homekit compatible state. The elk panel has a lot more
// possible states then can be directly represented by homekit so we map them. If the alarm is going off then it is tripped.
// If it is arming or armed it is considered armed. Stay maps to the state state, away to the away state, night to the night 
// state. 
ISYElkAlarmPanelAccessory.prototype.translateAlarmCurrentStateToHK = function() {
	var tripState = this.device.getAlarmTripState();
	var sourceAlarmState = this.device.getAlarmState();
	var sourceAlarmMode = this.device.getAlarmMode();
	
	if(tripState >= this.device.ALARM_TRIP_STATE_TRIPPED) {
		return Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED;		
	} else if(sourceAlarmState == this.device.ALARM_STATE_NOT_READY_TO_ARM || 
	    sourceAlarmState == this.device.ALARM_STATE_READY_TO_ARM || 
	    sourceAlarmState == this.device.ALARM_STATE_READY_TO_ARM_VIOLATION) {
		return Characteristic.SecuritySystemCurrentState.DISARMED;	   
	} else {
		if(sourceAlarmMode == this.device.ALARM_MODE_STAY || sourceAlarmMode == this.device.ALARM_MODE_STAY_INSTANT ) {
			return Characteristic.SecuritySystemCurrentState.STAY_ARM;
		} else if(sourceAlarmMode == this.device.ALARM_MODE_AWAY || sourceAlarmMode == this.device.ALARM_MODE_VACATION) {
			return Characteristic.SecuritySystemCurrentState.AWAY_ARM;
		} else if(sourceAlarmMode == this.device.ALARM_MODE_NIGHT || sourceAlarmMode == this.device.ALARM_MODE_NIGHT_INSTANT) {
			return Characteristic.SecuritySystemCurrentState.NIGHT_ARM;
		} else {
			this.log("ALARMSYSTEM: "+this.device.name+" Setting to disarmed because sourceAlarmMode is "+sourceAlarmMode);
			return Characteristic.SecuritySystemCurrentState.DISARMED;
		}
	}
}

// Translates the current target state of hthe underlying alarm into the appropriate homekit value
ISYElkAlarmPanelAccessory.prototype.translateAlarmTargetStateToHK = function() {
	var sourceAlarmState = this.device.getAlarmMode();
	if(sourceAlarmState == this.device.ALARM_MODE_STAY || sourceAlarmState == this.device.ALARM_MODE_STAY_INSTANT ) {
 		return Characteristic.SecuritySystemTargetState.STAY_ARM;
	} else if(sourceAlarmState == this.device.ALARM_MODE_AWAY || sourceAlarmState == this.device.ALARM_MODE_VACATION) {
		return Characteristic.SecuritySystemTargetState.AWAY_ARM;
	} else if(sourceAlarmState == this.device.ALARM_MODE_NIGHT || sourceAlarmState == this.device.ALARM_MODE_NIGHT_INSTANT) {
		return Characteristic.SecuritySystemTargetState.NIGHT_ARM;
	} else {
		return Characteristic.SecuritySystemTargetState.DISARM;
	}
}

// Translates the homekit version of the alarm target state into the appropriate elk alarm panel state
ISYElkAlarmPanelAccessory.prototype.translateHKToAlarmTargetState = function(state) {
	if(state == Characteristic.SecuritySystemTargetState.STAY_ARM) {
		return this.device.ALARM_MODE_STAY;
	} else if(state == Characteristic.SecuritySystemTargetState.AWAY_ARM) {
		return this.device.ALARM_MODE_AWAY;
	} else if(state == Characteristic.SecuritySystemTargetState.NIGHT_ARM) {
		return this.device.ALARM_MODE_NIGHT;
	} else {
		return this.device.ALARM_MODE_DISARMED;
	}
}

// Handles request to get the target alarm state
ISYElkAlarmPanelAccessory.prototype.getAlarmTargetState = function(callback) {
	callback(null,this.translateAlarmTargetStateToHK());
}

// Handles request to get the current alarm state
ISYElkAlarmPanelAccessory.prototype.getAlarmCurrentState = function(callback) {
	callback(null,this.translateAlarmCurrentStateToHK());
}

// Mirrors change in the state of the underlying isj-js device object.
ISYElkAlarmPanelAccessory.prototype.handleExternalChange = function() {
	this.log("ALARMPANEL: "+this.device.name+" Source device. Currenty state locally -"+this.device.getAlarmStatusAsText());
	this.log("ALARMPANEL: "+this.device.name+" Got alarm change notification. Setting HK target state to: "+this.translateAlarmTargetStateToHK()+" Setting HK Current state to: "+this.translateAlarmCurrentStateToHK());
	this.alarmPanelService
		.setCharacteristic(Characteristic.SecuritySystemTargetState, this.translateAlarmTargetStateToHK());
	this.alarmPanelService
		.setCharacteristic(Characteristic.SecuritySystemCurrentState, this.translateAlarmCurrentStateToHK());
}

// Returns the set of services supported by this object.
ISYElkAlarmPanelAccessory.prototype.getServices = function() {
	var informationService = new Service.AccessoryInformation();
	
	informationService
      .setCharacteristic(Characteristic.Manufacturer, "SmartHome")
      .setCharacteristic(Characteristic.Model, this.device.deviceFriendlyName)
      .setCharacteristic(Characteristic.SerialNumber, this.device.address);	
	  
	var alarmPanelService = new Service.SecuritySystem();
	
	this.alarmPanelService = alarmPanelService;
	this.informationService = informationService;	
    
    alarmPanelService
      .getCharacteristic(Characteristic.SecuritySystemTargetState)
      .on('set', this.setAlarmTargetState.bind(this));
	  
	alarmPanelService
	  .getCharacteristic(Characteristic.SecuritySystemTargetState)
	  .on('get', this.getAlarmTargetState.bind(this));
	  
	alarmPanelService
	  .getCharacteristic(Characteristic.SecuritySystemCurrentState)
	  .on('get', this.getAlarmCurrentState.bind(this));
    
    return [informationService, alarmPanelService];	
}

/////////////////////////////////////////////////////////////////////////////////////////////////
// LOCKS - ISYGarageDoorAccessory
// Implements the lock service for isy-js devices.

// Constructs a lock accessory. log = homebridge logger, device = isy-js device object being wrapped
function ISYGarageDoorAccessory(log,sensorDevice,relayDevice,name,timeToOpen,alternate) {
    ISYAccessoryBaseSetup(this,log,sensorDevice);
    this.name = name;
    this.timeToOpen = timeToOpen;
    this.relayDevice = relayDevice;
	this.alternate = (alternate == undefined) ? false : alternate;
    if(this.getSensorState()) {
        this.log("GARAGE: "+this.name+" Initial set during startup the sensor is open so defaulting states to open");
        this.targetGarageState = Characteristic.TargetDoorState.OPEN;
        this.currentGarageState = Characteristic.CurrentDoorState.OPEN;
    } else {
        this.log("GARAGE: "+this.name+" Initial set during startup the sensor is closed so defaulting states to closed");
        this.targetGarageState = Characteristic.TargetDoorState.CLOSED;
        this.currentGarageState = Characteristic.CurrentDoorState.CLOSED;
    }
}

ISYGarageDoorAccessory.prototype.getSensorState = function() {
	if(this.alternate) {
		return !this.device.getCurrentDoorWindowState();
	} else {
		return this.device.getCurrentDoorWindowState();
	}
}

// Handles an identify request
ISYGarageDoorAccessory.prototype.identify = function(callback) {
    callback();
}

ISYGarageDoorAccessory.prototype.sendGarageDoorCommand = function(callback) {
    this.relayDevice.sendLightCommand(true, function() { callback(); });
}

// Handles a set to the target lock state. Will ignore redundant commands.
ISYGarageDoorAccessory.prototype.setTargetDoorState = function(targetState,callback) {
    var that = this;
    if(targetState == this.targetGarageState) {
        this.log("GARAGE: Ignoring redundant set of target state");
        callback();
        return;
    }
    this.targetGarageState = targetState;
    if(this.currentGarageState == Characteristic.CurrentDoorState.OPEN) {
        if(targetState == Characteristic.TargetDoorState.CLOSED) {
            this.log("GARAGE: "+this.device.name+" Current state is open and target is closed. Changing state to closing and sending command");
            this.garageDoorService
                .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
            this.sendGarageDoorCommand(callback);
        }
    } else if(this.currentGarageState == Characteristic.CurrentDoorState.CLOSED) {
        if(targetState == Characteristic.TargetDoorState.OPEN) {
            this.log("GARAGE: "+this.device.name+" Current state is closed and target is open. Waiting for sensor change to trigger opening state");
            this.sendGarageDoorCommand(callback);
            return;
        }
    } else if(this.currentGarageState == Characteristic.CurrentDoorState.OPENING) {
        if(targetState == Characteristic.TargetDoorState.CLOSED) {
            this.log("GARAGE: "+this.device.name+" Current state is opening and target is closed. Sending command and changing state to closing");
            this.garageDoorService
                .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
            this.sendGarageDoorCommand(function() {
                setTimeout(function() {
                    that.sendGarageDoorCommand(callback);
                }, 3000);
            });
            return;
        }
    } else if(this.currentGarageState == Characteristic.CurrentDoorState.CLOSING) {
        if(targetState == Characteristic.TargetDoorState.OPEN) {
            this.log("GARAGE: "+this.device.name+" Current state is closing and target is open. Sending command and setting timeout to complete");
            this.garageDoorService
                .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
            this.sendGarageDoorCommand(function() {
                setTimeout(that.sendGarageDoorCommand(callback),3000);
                setTimeout(that.completeOpen.bind(that), that.timeToOpen);
            });
        }
    }
}

// Handles request to get the current lock state for homekit
ISYGarageDoorAccessory.prototype.getCurrentDoorState = function(callback) {
    callback(null, this.currentGarageState);
}

ISYGarageDoorAccessory.prototype.setCurrentDoorState = function(newState,callback) {
    this.currentGarageState = newState;
    callback();
}

// Handles request to get the target lock state for homekit
ISYGarageDoorAccessory.prototype.getTargetDoorState = function(callback) {
    callback(null, this.targetGarageState);
}

ISYGarageDoorAccessory.prototype.completeOpen = function() {
    if(this.currentGarageState == Characteristic.CurrentDoorState.OPENING) {
        this.log("GARAGE:  "+this.device.name+"Current door has bee opening long enough, marking open");
        this.garageDoorService
            .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
    } else {
        this.log("GARAGE:  "+this.device.name+"Opening aborted so not setting opened state automatically");
    }
}

// Mirrors change in the state of the underlying isj-js device object.
ISYGarageDoorAccessory.prototype.handleExternalChange = function() {
    // Handle startup.
    if(this.getSensorState()) {
        if(this.currentGarageState == Characteristic.CurrentDoorState.OPEN) {
            this.log("GARAGE:  "+this.device.name+"Current state of door is open and now sensor matches. No action to take");
        } else if(this.currentGarageState == Characteristic.CurrentDoorState.CLOSED) {
            this.log("GARAGE:  "+this.device.name+"Current state of door is closed and now sensor says open. Setting state to opening");
            this.garageDoorService
                .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
            this.targetGarageState = Characteristic.TargetDoorState.OPEN;
            this.garageDoorService
                .setCharacteristic(Characteristic.TargetDoorState, Characteristic.CurrentDoorState.OPEN);
            setTimeout(this.completeOpen.bind(this), this.timeToOpen);
        } else if(this.currentGarageState == Characteristic.CurrentDoorState.OPENING) {
            this.log("GARAGE:  "+this.device.name+"Current state of door is opening and now sensor matches. No action to take");
        } else if(this.currentGarageState == Characteristic.CurrentDoorState.CLOSING) {
            this.log("GARAGE: C "+this.device.name+"urrent state of door is closing and now sensor matches. No action to take");
        }
    } else {
        if(this.currentGarageState == Characteristic.CurrentDoorState.OPEN) {
            this.log("GARAGE:  "+this.device.name+"Current state of door is open and now sensor shows closed. Setting current state to closed");
            this.garageDoorService
                .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
            this.targetGarageState = Characteristic.TargetDoorState.CLOSED;
            this.garageDoorService
                .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
        } else if(this.currentGarageState == Characteristic.CurrentDoorState.CLOSED) {
            this.log("GARAGE:  "+this.device.name+"Current state of door is closed and now sensor shows closed. No action to take");
        } else if(this.currentGarageState == Characteristic.CurrentDoorState.OPENING) {
            this.log("GARAGE:  "+this.device.name+"Current state of door is opening and now sensor shows closed. Setting current state to closed");
            this.garageDoorService
                .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
            this.targetGarageState = Characteristic.TargetDoorState.CLOSED;
            this.garageDoorService
                .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
        } else if(this.currentGarageState == Characteristic.CurrentDoorState.CLOSING) {
            this.log("GARAGE:  "+this.device.name+"Current state of door is closing and now sensor shows closed. Setting current state to closed");
            this.garageDoorService
                .setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
            this.targetGarageState = Characteristic.TargetDoorState.CLOSED;
            this.garageDoorService
                .setCharacteristic(Characteristic.TargetDoorState, Characteristic.TargetDoorState.CLOSED);
        }
    }
}

ISYGarageDoorAccessory.prototype.getObstructionState = function(callback) {
    callback(null,false);
}

// Returns the set of services supported by this object.
ISYGarageDoorAccessory.prototype.getServices = function() {
    var informationService = new Service.AccessoryInformation();

    informationService
        .setCharacteristic(Characteristic.Manufacturer, "SmartHome")
        .setCharacteristic(Characteristic.Model, this.name)
        .setCharacteristic(Characteristic.SerialNumber, this.device.address);

    var garageDoorService = new Service.GarageDoorOpener();

    this.garageDoorService = garageDoorService;
    this.informationService = informationService;

    garageDoorService
        .getCharacteristic(Characteristic.TargetDoorState)
        .on('set', this.setTargetDoorState.bind(this));

    garageDoorService
        .getCharacteristic(Characteristic.TargetDoorState)
        .on('get', this.getTargetDoorState.bind(this));

    garageDoorService
        .getCharacteristic(Characteristic.CurrentDoorState)
        .on('get', this.getCurrentDoorState.bind(this));

    garageDoorService
        .getCharacteristic(Characteristic.CurrentDoorState)
        .on('set', this.setCurrentDoorState.bind(this));

    garageDoorService
        .getCharacteristic(Characteristic.ObstructionDetected)
        .on('get', this.getObstructionState.bind(this));

    return [informationService, garageDoorService];
}


module.exports.platform = ISYPlatform;
module.exports.ISYFanAccessory = ISYFanAccessory;
module.exports.ISYLightAccessory = ISYLightAccessory;
module.exports.ISYLockAccessory = ISYLockAccessory;
module.exports.ISYOutletAccessory = ISYOutletAccessory;
module.exports.ISYDoorWindowSensorAccessory = ISYDoorWindowSensorAccessory;
module.exports.ISYMotionSensorAccessory = ISYMotionSensorAccessory;
module.exports.ISYElkAlarmPanelAccessory = ISYElkAlarmPanelAccessory;
module.exports.ISYSceneAccessory = ISYSceneAccessory;
module.exports.ISYGarageDoorAccessory = ISYGarageDoorAccessory;

